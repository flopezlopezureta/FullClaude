const db = require('../db');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

// --- MELI API HELPERS (Duplicated from integrations.js for independence) ---
const makeMeliRequest = (options, postData = null) => {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        reject({ statusCode: res.statusCode, body: parsedData });
                    }
                } catch (e) {
                    reject({ statusCode: res.statusCode, body: data, isRaw: true });
                }
            });
        });
        req.on('error', (e) => reject(e));
        if (postData) req.write(postData);
        req.end();
    });
};

const makeMeliGetRequest = (path, accessToken) => makeMeliRequest({
    hostname: 'api.mercadolibre.com',
    path,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
});

const makeMeliPostRequest = (path, postData) => makeMeliRequest({
    hostname: 'api.mercadolibre.com',
    path,
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
    }
}, postData);

async function getValidMeliToken(clientId) {
    const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [clientId]);
    if (userRows.length === 0) return null;
    
    let meliIntegration = userRows[0].integrations?.meli;
    if (!meliIntegration) return null;

    if (Date.now() >= meliIntegration.expiresAt) {
        try {
            const { rows: settingsRows } = await db.query('SELECT meli_app_id, meli_client_secret FROM integration_settings WHERE id = 1');
            if (settingsRows.length === 0) return null;
            
            const { meli_app_id, meli_client_secret } = settingsRows[0];
            const refreshData = new URLSearchParams({
                grant_type: 'refresh_token', 
                client_id: meli_app_id, 
                client_secret: meli_client_secret, 
                refresh_token: meliIntegration.refreshToken,
            }).toString();
            
            const refreshed = await makeMeliPostRequest('/oauth/token', refreshData);
            meliIntegration = {
                ...meliIntegration,
                accessToken: refreshed.access_token,
                refreshToken: refreshed.refresh_token,
                expiresAt: Date.now() + (refreshed.expires_in * 1000),
            };
            await db.query('UPDATE users SET integrations = $1 WHERE id = $2', [JSON.stringify({ ...userRows[0].integrations, meli: meliIntegration }), clientId]);
        } catch (err) {
            console.error(`Error refreshing ML token for client ${clientId}:`, err);
            return null;
        }
    }
    return meliIntegration.accessToken;
}

async function pollMeliPackages() {
    console.log('[MeliPolling] Starting poll cycle...');
    try {
        // 1. Get all active Mercado Libre packages that are not finished
        const { rows: packages } = await db.query(`
            SELECT id, "meliOrderId", "driverId", status, "creatorId" 
            FROM packages 
            WHERE source = 'MERCADO_LIBRE' 
            AND status NOT IN ('ENTREGADO', 'DEVUELTO', 'CANCELADO')
            AND "meliOrderId" IS NOT NULL
        `);

        if (packages.length === 0) {
            console.log('[MeliPolling] No active ML packages to poll.');
            return;
        }

        // Group by creatorId to optimize token fetching
        const packagesByClient = packages.reduce((acc, pkg) => {
            if (!acc[pkg.creatorId]) acc[pkg.creatorId] = [];
            acc[pkg.creatorId].push(pkg);
            return acc;
        }, {});

        for (const clientId in packagesByClient) {
            const accessToken = await getValidMeliToken(clientId);
            if (!accessToken) continue;

            for (const pkg of packagesByClient[clientId]) {
                try {
                    // Check status in Mercado Libre
                    const shipment = await makeMeliGetRequest(`/shipments/${pkg.meliOrderId}`, accessToken);
                    
                    // Logic to detect "Rescheduled"
                    // In ML, this might be status: 'handling' with specific substatus, or just 'rescheduled'
                    // For this implementation, we assume if ML says it's rescheduled, we update.
                    // We also check if our local status is already 'REPROGRAMADO' to avoid duplicate notifications.
                    
                    const mlStatus = shipment.status;
                    const mlSubstatus = shipment.substatus;
                    
                    // Placeholder: adjust based on real ML status mapping
                    const isRescheduledInML = mlStatus === 'rescheduled' || mlSubstatus === 'rescheduled' || mlSubstatus === 'reprogrammed';

                    if (isRescheduledInML && pkg.status !== 'REPROGRAMADO') {
                        console.log(`[MeliPolling] Package ${pkg.id} detected as RESCHEDULED in ML.`);
                        
                        const now = new Date();
                        // 1. Update package status
                        await db.query('UPDATE packages SET status = $1, "updatedAt" = $2 WHERE id = $3', ['REPROGRAMADO', now, pkg.id]);
                        
                        // 2. Add tracking event
                        await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
                            [pkg.id, 'Reprogramado', 'Mercado Libre', 'El envío ha sido reprogramado por Mercado Libre.', now]);
                        
                        // 3. Notify driver if assigned
                        if (pkg.driverId) {
                            const notificationId = `notif-${uuidv4()}`;
                            await db.query(`
                                INSERT INTO notifications (id, "userId", title, message, type, "relatedId")
                                VALUES ($1, $2, $3, $4, $5, $6)
                            `, [
                                notificationId, 
                                pkg.driverId, 
                                'Envío Reprogramado', 
                                `El paquete ${pkg.id} ha sido reprogramado por Mercado Libre.`, 
                                'PACKAGE_RESCHEDULED',
                                pkg.id
                            ]);
                            console.log(`[MeliPolling] Notification sent to driver ${pkg.driverId} for package ${pkg.id}`);
                        }
                    }
                } catch (err) {
                    console.error(`[MeliPolling] Error polling shipment ${pkg.meliOrderId}:`, err.body || err);
                }
            }
        }
    } catch (err) {
        console.error('[MeliPolling] Fatal error in poll cycle:', err);
    }
}

let intervalId = null;

function start(intervalMs = 5 * 60 * 1000) { // Default 5 minutes
    if (intervalId) return;
    
    // Run immediately on start
    pollMeliPackages();
    
    intervalId = setInterval(pollMeliPackages, intervalMs);
}

function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

module.exports = { start, stop };
