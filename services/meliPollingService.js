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

let isPolling = false;
let lastPollTime = Date.now();
let currentIntervalMs = 5 * 60 * 1000;

async function pollMeliPackages() {
    if (isPolling) {
        console.log('[MeliPolling] Already polling, skipping...');
        return;
    }
    isPolling = true;
    lastPollTime = Date.now();
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
            SELECT id, "meliOrderId", "meliFlexCode", "driverId", status, "creatorId" 
            FROM packages 
            WHERE source = 'MERCADO_LIBRE' 
            AND status NOT IN ('ENTREGADO', 'DEVUELTO', 'CANCELADO')
            AND ("meliOrderId" IS NOT NULL OR "meliFlexCode" IS NOT NULL)
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
                        // Use meliFlexCode (Shipment ID) if available, otherwise meliOrderId
                        const shipmentId = pkg.meliFlexCode || pkg.meliOrderId;
                        if (!shipmentId) continue;

                        // Check status in Mercado Libre
                        const shipment = await makeMeliGetRequest(`/shipments/${shipmentId}`, accessToken);
                        
                        const mlStatus = shipment.status;
                        const mlSubstatus = shipment.substatus;
                        
                        let newStatus = null;
                        let eventDetails = '';
                        let eventStatus = '';

                        if (mlStatus === 'delivered' && pkg.status !== 'ENTREGADO') {
                            newStatus = 'ENTREGADO';
                            eventStatus = 'Entregado';
                            eventDetails = 'El envío ha sido marcado como ENTREGADO en Mercado Libre.';
                        } else if (mlStatus === 'cancelled' && pkg.status !== 'CANCELADO') {
                            newStatus = 'CANCELADO';
                            eventStatus = 'Cancelado';
                            eventDetails = 'El envío ha sido CANCELADO en Mercado Libre.';
                        } else if ((mlStatus === 'rescheduled' || mlSubstatus === 'rescheduled' || mlSubstatus === 'reprogrammed') && pkg.status !== 'REPROGRAMADO') {
                            newStatus = 'REPROGRAMADO';
                            eventStatus = 'Reprogramado';
                            eventDetails = 'El envío ha sido REPROGRAMADO por Mercado Libre.';
                        } else if (mlStatus === 'not_delivered' && pkg.status !== 'PROBLEMA') {
                            newStatus = 'PROBLEMA';
                            eventStatus = 'Problema';
                            eventDetails = 'El envío ha sido marcado como NO ENTREGADO en Mercado Libre.';
                        }

                        if (newStatus) {
                            console.log(`[MeliPolling] Package ${pkg.id} status update detected: ${newStatus} (ML Status: ${mlStatus})`);
                            
                            const now = new Date();
                            await db.query('UPDATE packages SET status = $1, "updatedAt" = $2 WHERE id = $3', [newStatus, now, pkg.id]);
                            await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
                                [pkg.id, eventStatus, 'Mercado Libre', eventDetails, now]);
                            
                            if (pkg.driverId) {
                                const notificationId = `notif-${uuidv4()}`;
                                await db.query(`
                                    INSERT INTO notifications (id, "userId", title, message, type, "relatedId")
                                    VALUES ($1, $2, $3, $4, $5, $6)
                                `, [
                                    notificationId, 
                                    pkg.driverId, 
                                    `Envío ${eventStatus}`, 
                                    `El paquete ${pkg.id} ha sido actualizado a ${eventStatus} por Mercado Libre.`, 
                                    `PACKAGE_${newStatus}`,
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
    } finally {
        isPolling = false;
    }
}

async function syncPackage(packageId) {
    console.log(`[MeliPolling] Manually syncing package ${packageId}...`);
    try {
        const { rows } = await db.query(`
            SELECT id, "meliOrderId", "meliFlexCode", "driverId", status, "creatorId", source 
            FROM packages 
            WHERE id = $1
        `, [packageId]);

        if (rows.length === 0) throw new Error('Paquete no encontrado.');
        const pkg = rows[0];

        if (pkg.source !== 'MERCADO_LIBRE') {
            throw new Error('El paquete no es de Mercado Libre.');
        }

        const shipmentId = pkg.meliFlexCode || pkg.meliOrderId;
        if (!shipmentId) {
            throw new Error('El paquete no tiene un ID de Mercado Libre (Order ID o Flex Code) asociado.');
        }

        const accessToken = await getValidMeliToken(pkg.creatorId);
        if (!accessToken) {
            throw new Error('No se pudo obtener el token de Mercado Libre para el cliente propietario de este paquete. Asegúrate de que la integración esté activa.');
        }

        console.log(`[MeliPolling] Requesting ML shipment ${shipmentId} for package ${packageId}...`);
        const shipment = await makeMeliGetRequest(`/shipments/${shipmentId}`, accessToken);
        
        const mlStatus = shipment.status;
        const mlSubstatus = shipment.substatus;
        
        console.log(`[MeliPolling] ML Status for ${shipmentId}: ${mlStatus} (${mlSubstatus || 'no substatus'})`);

        let newStatus = null;
        let eventDetails = '';
        let eventStatus = '';

        if (mlStatus === 'delivered' && pkg.status !== 'ENTREGADO') {
            newStatus = 'ENTREGADO';
            eventStatus = 'Entregado';
            eventDetails = 'Sincronización manual: El envío figura como ENTREGADO en Mercado Libre.';
        } else if (mlStatus === 'cancelled' && pkg.status !== 'CANCELADO') {
            newStatus = 'CANCELADO';
            eventStatus = 'Cancelado';
            eventDetails = 'Sincronización manual: El envío figura como CANCELADO en Mercado Libre.';
        } else if ((mlStatus === 'rescheduled' || mlSubstatus === 'rescheduled' || mlSubstatus === 'reprogrammed') && pkg.status !== 'REPROGRAMADO') {
            newStatus = 'REPROGRAMADO';
            eventStatus = 'Reprogramado';
            eventDetails = 'Sincronización manual: El envío figura como REPROGRAMADO en Mercado Libre.';
        } else if (mlStatus === 'not_delivered' && pkg.status !== 'PROBLEMA') {
            newStatus = 'PROBLEMA';
            eventStatus = 'Problema';
            eventDetails = 'Sincronización manual: El envío figura como NO ENTREGADO en Mercado Libre.';
        }

        if (newStatus) {
            const now = new Date();
            await db.query('UPDATE packages SET status = $1, "updatedAt" = $2 WHERE id = $3', [newStatus, now, pkg.id]);
            await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
                [pkg.id, eventStatus, 'Mercado Libre (Sync)', eventDetails, now]);
            
            const { rows: updatedRows } = await db.query('SELECT * FROM packages WHERE id = $1', [pkg.id]);
            const { rows: history } = await db.query('SELECT * FROM tracking_events WHERE "packageId" = $1 ORDER BY timestamp DESC', [pkg.id]);
            return { ...updatedRows[0], history };
        }

        const { rows: history } = await db.query('SELECT * FROM tracking_events WHERE "packageId" = $1 ORDER BY timestamp DESC', [pkg.id]);
        return { ...pkg, history, noChange: true, mlStatus, mlSubstatus };

    } catch (err) {
        console.error(`[MeliPolling] Error syncing package ${packageId}:`, err.body || err);
        if (err.statusCode === 404) {
            throw new Error(`El ID de envío ${packageId} no fue encontrado en Mercado Libre. Verifica que el ID sea correcto.`);
        }
        if (err.statusCode === 401 || err.statusCode === 403) {
            throw new Error('Error de autenticación con Mercado Libre. Por favor, reconecta la cuenta del cliente.');
        }
        throw new Error(err.message || 'Error desconocido al sincronizar con Mercado Libre.');
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
            // We search for orders with status 'paid' or 'partially_paid'
            // Added sort=date_desc and limit=50 to get the most recent orders first
            const ordersData = await makeMeliGetRequest(`/orders/search?seller=${meliIntegration.userId}&order.status=paid,partially_paid&shipping.mode=self_service&sort=date_desc&limit=50`, accessToken);
            
            if (!ordersData.results || ordersData.results.length === 0) {
                console.log(`[MeliPolling] No new paid/partially_paid Flex orders for client ${clientId} (ML User ID: ${meliIntegration.userId})`);
                continue;
            }

            console.log(`[MeliPolling] Found ${ordersData.results.length} paid/partially_paid Flex orders for client ${clientId}`);

            for (const order of ordersData.results) {
                try {
                    const orderId = order.id.toString();
                    const shipmentId = order.shipping?.id;
                    
                    if (!shipmentId) {
                        console.log(`[MeliPolling] Skipping order ${orderId} - No shipment ID`);
                        continue;
                    }

                    // 3. Check if already imported
                    // We check by both orderId and shipmentId (meliFlexCode) to be extra safe
                    const { rows: existing } = await db.query('SELECT id FROM packages WHERE "meliOrderId" = $1 OR "meliFlexCode" = $2', [orderId, shipmentId.toString()]);
                    if (existing.length > 0) {
                        // console.log(`[MeliPolling] Order ${orderId} already imported, skipping.`);
                        continue;
                    }

                    // 4. Get Shipment Details to check address
                    const shipment = await makeMeliGetRequest(`/shipments/${shipmentId}`, accessToken);
                    
                    // 5. Region Check (Optional/Permissive)
                    let stateName = shipment.receiver_address?.state?.name || 'Santiago';
                    const lowerState = stateName.toLowerCase();
                    
                    // Normalize Region/City name for RM
                    const isRM = lowerState.includes('metropolitana') || 
                                 lowerState.includes('santiago') || 
                                 lowerState === 'rm' ||
                                 lowerState.includes('r.m.');
                    
                    if (isRM) {
                        stateName = 'Región Metropolitana';
                    } else {
                        console.log(`[MeliPolling] Order ${orderId} is in state: ${stateName}. Still importing as it is a Flex order.`);
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
                        recipientCity: stateName,
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

async function cleanupDuplicates() {
    console.log('[MeliPolling] Starting cleanup of duplicate packages...');
    try {
        // Find duplicate meliFlexCode
        const { rows: duplicates } = await db.query(`
            SELECT "meliFlexCode", array_agg(id ORDER BY "createdAt" ASC) as ids
            FROM packages 
            WHERE "meliFlexCode" IS NOT NULL 
            GROUP BY "meliFlexCode" 
            HAVING count(*) > 1
        `);

        if (duplicates.length === 0) {
            console.log('[MeliPolling] No duplicates found.');
            return;
        }

        for (const row of duplicates) {
            const [keepId, ...deleteIds] = row.ids;
            console.log(`[MeliPolling] Cleaning up ${deleteIds.length} duplicates for Flex Code ${row.meliFlexCode}. Keeping ID ${keepId}`);
            
            // Delete tracking events first
            await db.query('DELETE FROM tracking_events WHERE "packageId" = ANY($1)', [deleteIds]);
            // Delete packages
            await db.query('DELETE FROM packages WHERE id = ANY($1)', [deleteIds]);
        }
        console.log(`[MeliPolling] Cleanup complete. Removed duplicates for ${duplicates.length} Flex codes.`);
    } catch (err) {
        console.error('[MeliPolling] Error during cleanup:', err);
    }
}

let intervalId = null;

function start(intervalMs = 5 * 60 * 1000) { // Default 5 minutes
    if (intervalId) return;
    currentIntervalMs = intervalMs;
    
    // Run cleanup once on start
    cleanupDuplicates();
    
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

function getStatus() {
    return {
        nextPollTime: lastPollTime + currentIntervalMs,
        isPolling,
        intervalMs: currentIntervalMs
    };
}

module.exports = { start, stop, getStatus, pollMeliPackages, syncPackage };
