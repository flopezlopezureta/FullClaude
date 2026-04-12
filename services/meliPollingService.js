const db = require('../db');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const { triggerBackgroundGeocoding } = require('./geocodingService');

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
        let autoImportEnabled = false;
        try {
            const { rows: settingsRows } = await db.query('SELECT "meliAutoImport" FROM system_settings WHERE id = 1');
            autoImportEnabled = settingsRows.length > 0 && settingsRows[0].meliAutoImport;
        } catch (settingsErr) {
            console.warn('[MeliPolling] Could not fetch meliAutoImport from DB or column missing. Defaulting to true...', settingsErr.message);
            autoImportEnabled = true; // Safety default
        }

        // Emergency Override: If we are debugging, let's keep it true for now
        autoImportEnabled = true;

        if (autoImportEnabled) {
            await autoImportMeliPackages();
        }

        // [NUEVO] Limpieza automática de registros fuera de zona (Santiago/RM)
        await cleanupOutOfZonePackages();

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

                        // IMPORTANTE: Req. de Usuario -> Solo marcar entregado si estaba en ruta y tiene conductor.
                        if (mlStatus === 'delivered' && pkg.status !== 'ENTREGADO') {
                            if ((pkg.status === 'EN_TRANSITO' || pkg.status === 'EN_RUTA' || pkg.isFlexed) && pkg.driverId) {
                                newStatus = 'ENTREGADO';
                                eventStatus = 'Entregado';
                                eventDetails = 'El envío ha sido marcado como ENTREGADO en Mercado Libre.';
                            } else {
                                console.log(`[MeliPolling] Blocked false 'delivered' update for ${pkg.id} (status: ${pkg.status}, driver: ${pkg.driverId})`);
                            }
                        } else if (mlStatus === 'shipped' && pkg.status !== 'EN_TRANSITO' && pkg.status !== 'EN_RUTA') {
                            newStatus = 'EN_TRANSITO';
                            eventStatus = 'En Tránsito';
                            eventDetails = 'El envío ha sido marcado como SHIPPED (En Camino) por Mercado Libre.';
                            // Note: NotificationService should ideally be triggered, we will handle that separately.
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

                        // [NUEVO] Capturar el trackingId original (SCA) si está disponible
                        const trackingId = shipment.tracking_id ? String(shipment.tracking_id) : null;
                        
                        if (newStatus || trackingId) {
                            console.log(`[MeliPolling] Syncing package ${pkg.id}: trackingId=${trackingId}, status=${newStatus || pkg.status}`);
                            
                            const now = new Date();
                            const isFlexed = mlStatus === 'shipped' || mlStatus === 'delivered';
                            
                            await db.query(
                                'UPDATE packages SET status = COALESCE($1, status), "trackingId" = COALESCE($2, "trackingId"), "updatedAt" = $3, "isFlexed" = $4, "flexedAt" = CASE WHEN $4 = true AND "flexedAt" IS NULL THEN $3 ELSE "flexedAt" END WHERE id = $5', 
                                [newStatus, trackingId, now, isFlexed, pkg.id]
                            );
                            
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
        
        // [NUEVO] Paso de Auto-Fix para paquetes sin tracking_id en las últimas 48 horas
        console.log('[MeliPolling] Checking for packages missing tracking_id (SCA)...');
        const { rows: missingTracking } = await db.query(`
            SELECT id, "meliFlexCode", "meliOrderId", "creatorId" 
            FROM packages 
            WHERE source = 'MERCADO_LIBRE' 
            AND "trackingId" IS NULL 
            AND "createdAt" > NOW() - INTERVAL '48 hours'
            LIMIT 50
        `);

        for (const pkg of missingTracking) {
            try {
                const accessToken = await getValidMeliToken(pkg.creatorId);
                if (accessToken) {
                    const shipmentId = pkg.meliFlexCode || pkg.meliOrderId;
                    const shipment = await makeMeliGetRequest(`/shipments/${shipmentId}`, accessToken);
                    if (shipment.tracking_id) {
                        await db.query('UPDATE packages SET "trackingId" = $1 WHERE id = $2', [String(shipment.tracking_id), pkg.id]);
                        console.log(`[MeliPolling] Auto-fixed trackingId for ${pkg.id}: ${shipment.tracking_id}`);
                    }
                }
            } catch (err) {
                // Silently fail for background auto-fix
            }
        }

    } catch (err) {
        console.error('[MeliPolling] Fatal error in poll cycle:', err);
    } finally {
        isPolling = false;
    }
}

// [NUEVO] Función para asegurar el tracking_id inmediatamente después de importar
async function syncTrackingId(packageId) {
    try {
        const { rows } = await db.query('SELECT id, "meliFlexCode", "meliOrderId", "creatorId", "trackingId" FROM packages WHERE id = $1', [packageId]);
        if (rows.length === 0 || rows[0].trackingId) return;
        
        const pkg = rows[0];
        const accessToken = await getValidMeliToken(pkg.creatorId);
        if (!accessToken) return;

        const shipmentId = pkg.meliFlexCode || pkg.meliOrderId;
        const shipment = await makeMeliGetRequest(`/shipments/${shipmentId}`, accessToken);
        if (shipment.tracking_id) {
            await db.query('UPDATE packages SET "trackingId" = $1 WHERE id = $2', [String(shipment.tracking_id), packageId]);
            console.log(`[MeliPolling] Immediate sync for ${packageId}: trackingId=${shipment.tracking_id}`);
        }
    } catch (err) {
        console.warn(`[MeliPolling] Could not sync trackingId immediately for ${packageId}:`, err.message);
    }
}

async function syncPackage(packageId) {
    console.log(`[MeliPolling] Manually syncing package ${packageId}...`);
    try {
        const { rows } = await db.query(`
            SELECT * 
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

        const trackingId = shipment.tracking_id ? String(shipment.tracking_id) : null;

        if (newStatus || trackingId) {
            const now = new Date();
            await db.query('UPDATE packages SET status = COALESCE($1, status), "trackingId" = COALESCE($2, "trackingId"), "updatedAt" = $3 WHERE id = $4', [newStatus, trackingId, now, pkg.id]);
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

            // 2. Fetch recent orders that are paid or partially_paid
            // We broaden the search by removing shipping.mode=self_service to ensure No order is missed, 
            // and we filter for Flex/Self-Service later in the loop.
            const ordersData = await makeMeliGetRequest(`/orders/search?seller=${meliIntegration.userId}&order.status=paid&sort=date_desc&limit=50`, accessToken);
            
            if (!ordersData.results || ordersData.results.length === 0) {
                console.log(`[MeliPolling] No recent paid orders for client ${clientId} (ML User ID: ${meliIntegration.userId})`);
                continue;
            }

            console.log(`[MeliPolling] Found ${ordersData.results.length} recent paid orders for client ${clientId}. Processing...`);

            for (const order of ordersData.results) {
                try {
                    const orderId = order.id.toString();
                    const shipmentId = order.shipping?.id;
                    const sellerId = order.seller?.id?.toString();
                    const integrationUserId = meliIntegration.userId?.toString();

                    // Safety Check: Ensure the seller ID matches the user's integration
                    if (sellerId && integrationUserId && sellerId !== integrationUserId) {
                        console.warn(`[MeliPolling] Skipping order ${orderId} - Seller ID mismatch (${sellerId} vs ${integrationUserId})`);
                        continue;
                    }

                    console.log(`[MeliPolling] Order ${orderId} belongs to seller ${integrationUserId}. Proceeding...`);
                    
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
                    
                    // Prevent importing history (old packages already delivered or cancelled natively)
                    if (shipment.status === 'delivered' || shipment.status === 'cancelled') {
                        console.log(`[MeliPolling] Order ${orderId} is already ${shipment.status} in ML, skipping import to prevent history flood.`);
                        continue;
                    }

                    // [NEW] 4.5 Deep Search for Phone Number
                    // ML often hides phone in /shipments but provides it in /orders/{id} for authorized sellers
                    let recipientPhone = 'N/A';
                    try {
                        const fullOrder = await makeMeliGetRequest(`/orders/${orderId}`, accessToken);
                        
                        // Cascade search for phone
                        const phoneCandidates = [
                            shipment.receiver_address?.receiver_phone,
                            shipment.receiver_address?.phone,
                            fullOrder.buyer?.phone?.number,
                            fullOrder.buyer?.mobile?.number,
                            fullOrder.buyer?.phone?.area_code ? `${fullOrder.buyer.phone.area_code}${fullOrder.buyer.phone.number}` : null,
                            fullOrder.status_info?.reason // Sometimes hidden here in some specific ML versions
                        ];

                        for (const candidate of phoneCandidates) {
                            if (candidate && 
                                typeof candidate === 'string' && 
                                candidate.length > 5 && 
                                !candidate.includes('*') && 
                                !candidate.includes('obfuscated') &&
                                !candidate.includes('@')) {
                                recipientPhone = candidate;
                                break;
                            }
                        }
                        
                        if (recipientPhone === 'N/A') {
                            console.log(`[MeliPolling] Phone still N/A for order ${orderId} after deep search.`);
                        } else {
                            console.log(`[MeliPolling] Successfully recovered phone for order ${orderId}: ${recipientPhone}`);
                        }
                    } catch (phoneErr) {
                        console.warn(`[MeliPolling] Failed to fetch full order ${orderId} for phone recovery:`, phoneErr.message);
                        recipientPhone = shipment.receiver_address?.receiver_phone || 'N/A';
                    }
                    
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
                        console.log(`[MeliPolling] Skipping order ${orderId} as it is in state: ${stateName} (Outside RM).`);
                        continue; // SKIP import
                    }

                    // 6. Import Package
                    const now = new Date();
                    const newPackage = {
                        id: `${clientIdentifier}-${uuidv4().split('-')[0]}`,
                        recipientName: shipment.receiver_address?.receiver_name || order.buyer?.nickname || 'N/A',
                        recipientPhone: recipientPhone,
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
                        meliOrderId: orderId.toString(),
                        meliFlexCode: shipmentId.toString(),
                        trackingId: shipment.tracking_id ? String(shipment.tracking_id) : null,
                        recipientRut: shipment.receiver_address?.federal_id || null
                    };

                    const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
                    const values = Object.values(newPackage).map(v => v === undefined ? null : v);
                    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                    try {
                        await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, values);
                        await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
                            [newPackage.id, 'Creado', newPackage.origin, 'Auto-importado vía integración ML.', now]);
                        
                        console.log(`[MeliPolling] Auto-imported order ${orderId} for client ${clientId}`);
                        
                        // [NUEVO] Intentar sincronizar el tracking_id original inmediatamente
                        if (!newPackage.trackingId) {
                            syncTrackingId(newPackage.id); 
                        }
                    } catch (dbErr) {
                        if (dbErr.code === '23505') { // Duplicate unique key
                             console.warn(`[MeliPolling] Order ${orderId} seems to be already in DB, skipping...`);
                        } else {
                             throw dbErr;
                        }
                    }
                } catch (err) {
                    console.error(`[MeliPolling] Error auto-importing order ${order.id}:`, err.body || err);
                }
            }
        }
        
        // Trigger background geocoding after import
        setTimeout(() => triggerBackgroundGeocoding(), 2000);
    } catch (err) {
        console.error('[MeliPolling] Fatal error in auto-import cycle:', err);
    }
}

async function cleanupOutOfZonePackages() {
    try {
        // Buscamos paquetes que no sean de RM/Santiago o que tengan nombres explícitos de fuera de zona
        const queryFind = `
            SELECT id FROM packages 
            WHERE 
               LOWER("recipientCity") LIKE '%puerto montt%' OR 
               LOWER("recipientCity") LIKE '%loncoche%' OR 
               LOWER("recipientCommune") LIKE '%puerto montt%' OR 
               LOWER("recipientCommune") LIKE '%loncoche%' OR
               (
                 source = 'MERCADO_LIBRE' AND 
                 LOWER("recipientCity") NOT LIKE '%metropolitana%' AND 
                 LOWER("recipientCity") NOT LIKE '%santiago%' AND 
                 LOWER("recipientCity") != 'rm' AND
                 "recipientCity" != 'Región Metropolitana'
               )
        `;
        const { rows: toDelete } = await db.query(queryFind);
        
        if (toDelete.length > 0) {
            const ids = toDelete.map(r => r.id);
            console.log(`[MeliPolling] Cleanup: Deleting ${ids.length} out-of-zone packages...`);
            await db.query('DELETE FROM tracking_events WHERE "packageId" = ANY($1)', [ids]);
            await db.query('DELETE FROM packages WHERE id = ANY($1)', [ids]);
        }
    } catch (err) {
        console.error('[MeliPolling] Error during automatic cleanup:', err);
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


// [NUEVO] Función para importar un paquete específico en tiempo real (Just-In-Time)
async function importSpecificMeliPackage(clientId, shipmentId, skipRegionFilter = false) {
    // [NUEVO] Si shipmentId es un JSON (etiqueta oficial), extraer solo el ID
    if (shipmentId && typeof shipmentId === 'string' && shipmentId.startsWith('{')) {
        try {
            const parsed = JSON.parse(shipmentId);
            if (parsed.id) shipmentId = String(parsed.id);
        } catch (e) {}
    }

    console.log(`[MeliPolling] Attempting just-in-time import for Shipment ID ${shipmentId} (Client: ${clientId}, SkipRegionFilter: ${skipRegionFilter})`);
    try {
        const accessToken = await getValidMeliToken(clientId);
        if (!accessToken) throw new Error('Token ML no disponible');

        // 1. Fetch Shipment Details
        const shipment = await makeMeliGetRequest(`/shipments/${shipmentId}`, accessToken);
        const orderId = shipment.order_id?.toString();

        if (!orderId) {
            console.error(`[MeliPolling] Shipment ${shipmentId} has no associated Order ID.`);
            return null;
        }

        // 2. Double-check if already in DB (to avoid race conditions)
        const { rows: existing } = await db.query('SELECT id FROM packages WHERE "meliFlexCode" = $1 OR "meliOrderId" = $2 OR "id" = $1', [shipmentId.toString(), orderId]);
        if (existing.length > 0) return existing[0].id;

        // 3. Region Filter (Santiago/RM) - Only check if skipRegionFilter is false
        if (!skipRegionFilter) {
            let stateName = shipment.receiver_address?.state?.name || 'Santiago';
            const lowerState = stateName.toLowerCase();
            const isRM = lowerState.includes('metropolitana') || 
                         lowerState.includes('santiago') || 
                         lowerState === 'rm' ||
                         lowerState.includes('r.m.');
            
            if (!isRM) {
                console.warn(`[MeliPolling] Just-in-time skipped: Shipment ${shipmentId} is in ${stateName} (Outside RM)`);
                return null;
            }
        }

        // 4. Create Package Data
        const { rows: userRows } = await db.query('SELECT "clientIdentifier" FROM users WHERE id = $1', [clientId]);
        const clientIdentifier = userRows[0]?.clientIdentifier || 'CLI';
        const now = new Date();

        const newPackage = {
            id: `${clientIdentifier}-${uuidv4().split('-')[0]}`,
            recipientName: shipment.receiver_address?.receiver_name || 'N/A',
            recipientPhone: shipment.receiver_address?.receiver_phone || 'N/A',
            status: 'PENDIENTE',
            shippingType: 'SAME_DAY',
            origin: 'Centro de Distribución',
            recipientAddress: shipment.receiver_address?.address_line || 'N/A',
            recipientCommune: shipment.receiver_address?.city?.name || 'N/A',
            recipientCity: 'Región Metropolitana',
            notes: `Just-In-Time Import ML: ${shipmentId}`,
            estimatedDelivery: now,
            createdAt: now,
            updatedAt: now,
            creatorId: clientId,
            source: 'MERCADO_LIBRE',
            meliOrderId: orderId,
            meliFlexCode: shipmentId.toString(),
            trackingId: shipment.tracking_id ? String(shipment.tracking_id) : null,
            recipientRut: shipment.receiver_address?.federal_id || null
        };

        const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
        const values = Object.values(newPackage).map(v => v === undefined ? null : v);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, values);
        await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
            [newPackage.id, 'Creado', newPackage.origin, 'Importado bajo demanda (escaneado).', now]);

        console.log(`[MeliPolling] Successfully imported package ${newPackage.id} for shipment ${shipmentId}`);
        return newPackage.id;

    } catch (err) {
        console.error(`[MeliPolling] Just-in-time import error for ${shipmentId}:`, err.message);
        return null;
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

module.exports = { start, stop, getStatus, pollMeliPackages, syncPackage, getValidMeliToken, autoImportMeliPackages, syncTrackingId, importSpecificMeliPackage };
