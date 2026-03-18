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
        // 0. Check if auto-import is enabled
        const { rows: settingsRows } = await db.query('SELECT "meliAutoImport" FROM system_settings WHERE id = 1');
        const autoImportEnabled = settingsRows.length > 0 && settingsRows[0].meliAutoImport;

        if (autoImportEnabled) {
            await autoImportMeliPackages();
        }

        // 1. Get all active Mercado Libre packages that are not finished
        const { rows: packages } = await db.query(`
            SELECT id, "meliOrderId", "driverId", status, "creatorId" 
            FROM packages 
            WHERE source = 'MERCADO_LIBRE' 
            AND status NOT IN ('ENTREGADO', 'DEVUELTO', 'CANCELADO')
            AND "meliOrderId" IS NOT NULL
        `);

        if (packages.length === 0) {
            console.log('[MeliPolling] No active ML packages to poll status.');
        } else {
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
                        
                        const mlStatus = shipment.status;
                        const mlSubstatus = shipment.substatus;
                        
                        const isRescheduledInML = mlStatus === 'rescheduled' || mlSubstatus === 'rescheduled' || mlSubstatus === 'reprogrammed';

                        if (isRescheduledInML && pkg.status !== 'REPROGRAMADO') {
                            console.log(`[MeliPolling] Package ${pkg.id} detected as RESCHEDULED in ML.`);
                            
                            const now = new Date();
                            await db.query('UPDATE packages SET status = $1, "updatedAt" = $2 WHERE id = $3', ['REPROGRAMADO', now, pkg.id]);
                            await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
                                [pkg.id, 'Reprogramado', 'Mercado Libre', 'El envío ha sido reprogramado por Mercado Libre.', now]);
                            
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
                            }
                        }
                    } catch (err) {
                        console.error(`[MeliPolling] Error polling shipment ${pkg.meliOrderId}:`, err.body || err);
                    }
                }
            }
        }
    } catch (err) {
        console.error('[MeliPolling] Fatal error in poll cycle:', err);
    }
}

async function autoImportMeliPackages() {
    console.log('[MeliPolling] Starting auto-import cycle...');
    try {
        // 1. Get all users with Meli integration
        const { rows: users } = await db.query("SELECT id, integrations, \"clientIdentifier\" FROM users WHERE integrations->'meli' IS NOT NULL");
        
        for (const user of users) {
            const clientId = user.id;
            const clientIdentifier = user.clientIdentifier || 'CLI';
            const accessToken = await getValidMeliToken(clientId);
            if (!accessToken) continue;

            const meliIntegration = user.integrations.meli;

            // 2. Fetch paid orders with shipping mode 'self_service' (Flex)
            // We search for orders with status 'paid'
            const ordersData = await makeMeliGetRequest(`/orders/search?seller=${meliIntegration.userId}&order.status=paid&shipping.mode=self_service`, accessToken);
            
            if (!ordersData.results || ordersData.results.length === 0) continue;

            for (const order of ordersData.results) {
                try {
                    const orderId = order.id.toString();

                    // 3. Check if already imported
                    const { rows: existing } = await db.query('SELECT id FROM packages WHERE "meliOrderId" = $1', [orderId]);
                    if (existing.length > 0) continue;

                    // 4. Get Shipment Details to check address
                    const shipmentId = order.shipping?.id;
                    if (!shipmentId) continue;

                    const shipment = await makeMeliGetRequest(`/shipments/${shipmentId}`, accessToken);
                    
                    // 5. Filter by Region (Santiago / RM)
                    const stateName = shipment.receiver_address?.state?.name || '';
                    const isRM = stateName.toLowerCase().includes('metropolitana') || stateName.toLowerCase().includes('santiago');
                    
                    if (!isRM) {
                        console.log(`[MeliPolling] Skipping order ${orderId} - Not in RM (${stateName})`);
                        continue;
                    }

                    // 6. Import Package
                    const now = new Date();
                    const newPackage = {
                        id: `${clientIdentifier}-${uuidv4().split('-')[0]}`,
                        recipientName: shipment.receiver_address?.receiver_name || order.buyer?.nickname || 'N/A',
                        recipientPhone: shipment.receiver_address?.receiver_phone || 'N/A',
                        status: 'PENDIENTE',
                        shippingType: 'SAME_DAY',
                        origin: 'Centro de Distribución',
                        recipientAddress: shipment.receiver_address?.address_line || 'N/A',
                        recipientCommune: shipment.receiver_address?.city?.name || 'N/A',
                        recipientCity: stateName || 'Santiago',
                        notes: `Auto-Import ML Order: ${orderId}`,
                        estimatedDelivery: now,
                        createdAt: now,
                        updatedAt: now,
                        creatorId: clientId,
                        source: 'MERCADO_LIBRE',
                        meliOrderId: orderId,
                        meliFlexCode: shipmentId.toString()
                    };

                    const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
                    const values = Object.values(newPackage);
                    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                    await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, values);
                    await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
                        [newPackage.id, 'Creado', newPackage.origin, 'Importado automáticamente vía integración ML.', now]);

                    console.log(`[MeliPolling] Auto-imported order ${orderId} for client ${clientId}`);
                } catch (err) {
                    console.error(`[MeliPolling] Error auto-importing order ${order.id}:`, err.body || err);
                }
            }
        }
    } catch (err) {
        console.error('[MeliPolling] Fatal error in auto-import cycle:', err);
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
