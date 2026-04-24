const db = require('../db');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const { triggerBackgroundGeocoding } = require('./geocodingService');

// --- JUMPSELLER API HELPERS ---
const makeJumpsellerRequest = (login, token, path, method = 'GET', postData = null) => {
    return new Promise((resolve, reject) => {
        if (!login) return reject(new Error('El Login de Jumpseller es requerido.'));
        if (!token) return reject(new Error('El API Token de Jumpseller es requerido.'));

        const url = new URL(`https://api.jumpseller.com/v1${path}`);
        url.searchParams.append('login', login);
        url.searchParams.append('authtoken', token);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

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

        // Set 15s timeout
        req.setTimeout(15000, () => {
           req.destroy();
           reject(new Error('Jumpseller API request timed out after 15s'));
        });

        req.on('error', (e) => reject(e));
        if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        req.end();
    });
};

let isPolling = false;
let pollingStartTime = null;
let lastPollTime = Date.now();
let currentIntervalMs = 5 * 60 * 1000;
let nextScheduledTime = lastPollTime + currentIntervalMs;

async function pollJumpsellerPackages() {
    if (isPolling) {
        console.log('[JumpsellerPolling] Already polling, skipping...');
        return;
    }
    isPolling = true;
    pollingStartTime = Date.now();
    lastPollTime = Date.now();
    console.log('[JumpsellerPolling] Starting poll cycle...');
    try {
        // 0. Check if auto-import is enabled (global setting)
        let autoImportEnabled = false;
        try {
            const { rows: settingsRows } = await db.query('SELECT "jumpsellerAutoImport" FROM system_settings WHERE id = 1');
            autoImportEnabled = settingsRows.length > 0 && settingsRows[0].jumpsellerAutoImport;
        } catch (settingsErr) {
            // Column might not exist yet if migration hasn't run or fail
            console.warn('[JumpsellerPolling] Could not fetch jumpsellerAutoImport from DB. Defaulting to true for active customers.');
            autoImportEnabled = true; 
        }

        if (autoImportEnabled) {
            await autoImportJumpsellerPackages();
        }

    } catch (err) {
        console.error('[JumpsellerPolling] Fatal error in poll cycle:', err);
    } finally {
        isPolling = false;
        pollingStartTime = null;
        nextScheduledTime = Date.now() + currentIntervalMs;
        if (timeoutId !== null) {
            timeoutId = setTimeout(pollJumpsellerPackages, currentIntervalMs);
        }
    }
}

async function autoImportJumpsellerPackages() {
    console.log('[JumpsellerPolling] Starting auto-import cycle...');
    try {
        // 1. Get all users with Jumpseller integration
        const { rows: users } = await db.query("SELECT id, integrations, \"clientIdentifier\", address, \"pickupAddress\" FROM users WHERE integrations->'jumpseller' IS NOT NULL");
        
        for (const user of users) {
            const clientId = user.id;
            const clientIdentifier = user.clientIdentifier || 'CLI';
            const jumpseller = user.integrations.jumpseller;

            if (!jumpseller.login || !jumpseller.token) continue;

            // Check if the individual client has auto-import disabled
            if (jumpseller.autoImport === false) {
                console.log(`[JumpsellerPolling] Skipping client ${clientId} - Auto-import is currently set to MANUAL.`);
                continue;
            }

            // --- PER-USER INTERVAL CHECK ---
            const syncIntervalMin = jumpseller.syncInterval || 10; // Default to 10 mins for Jumpseller
            const lastSync = jumpseller.lastSync ? new Date(jumpseller.lastSync).getTime() : 0;
            const now = Date.now();
            
            if (now - lastSync < (syncIntervalMin * 60 * 1000)) {
                continue;
            }

            try {
                // Update lastSync timestamp in DB
                await db.query(`UPDATE users SET integrations = jsonb_set(integrations, '{jumpseller,lastSync}', $1) WHERE id = $2`, [JSON.stringify(new Date().toISOString()), clientId]);

                // 2. Fetch recent orders
                const orders = await makeJumpsellerRequest(jumpseller.login, jumpseller.token, '/orders.json?status=all&limit=50');
                
                if (!orders || orders.length === 0) {
                    continue;
                }

                console.log(`[JumpsellerPolling] Found ${orders.length} orders for client ${clientId}`);

                for (const o of orders) {
                    try {
                        const order = o.order;
                        if (!order) continue;
                        
                        // 3. Status Check: Only Paid or Ready
                        if (order.status !== 'Paid' && order.status !== 'Ready') continue;

                        const orderId = order.id.toString();
                        
                        // 4. Check if already imported
                        const { rows: existing } = await db.query('SELECT id FROM packages WHERE "jumpsellerOrderId" = $1', [orderId]);
                        if (existing.length > 0) continue;

                        // 5. Region Check (Santiago/RM) - Optional but consistent with Shopify
                        const shipping = order.shipping_address || {};
                        const municipality = (shipping.municipality || '').toLowerCase();
                        const city = (shipping.city || '').toLowerCase();
                        
                        const isRM = municipality.includes('metropolitana') || 
                                     municipality.includes('santiago') || 
                                     municipality === 'rm' ||
                                     city.includes('santiago') ||
                                     city.includes('metropolitana') ||
                                     city.includes('santiago de chile');
                        
                        // If not RM, we might still import but log it, or skip if business rule says RM only
                        // For now we'll import all but prioritize RM if needed.
                        // Based on codebase, we usually skip for automatic polling if not RM to avoid cluttering.
                        if (!isRM && municipality !== '' && city !== '') {
                             console.log(`[JumpsellerPolling] Skipping order ${orderId} - Outside RM (${municipality}, ${city})`);
                             continue;
                        }

                        // 6. Import Package
                        const importNow = new Date();
                        const origin = user.pickupAddress || user.address || 'Centro de Distribución';
                        const customer = order.customer || {};

                        const newPackage = {
                            id: `${clientIdentifier}-${uuidv4().split('-')[0]}`,
                            recipientName: shipping.fullname || customer.fullname || 'N/A',
                            recipientPhone: shipping.phone || customer.phone || 'N/A',
                            recipientEmail: customer.email || '',
                            status: 'PENDIENTE',
                            shippingType: 'SAME_DAY',
                            origin: origin,
                            recipientAddress: shipping.address || 'N/A',
                            recipientCommune: shipping.municipality || 'N/A',
                            recipientCity: shipping.city || 'Santiago',
                            notes: `Auto-Import Jumpseller Order: ${order.id}`,
                            estimatedDelivery: importNow,
                            createdAt: importNow,
                            updatedAt: importNow,
                            creatorId: clientId,
                            source: 'JUMPSELLER',
                            jumpsellerOrderId: orderId
                        };

                        const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
                        const vals = Object.values(newPackage);
                        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');

                        await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, vals);
                        await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
                            [newPackage.id, 'Creado', origin, 'Auto-importado vía Jumpseller Polling.', importNow]);
                        
                        console.log(`[JumpsellerPolling] Auto-imported order ${orderId} for client ${clientId}`);
                        
                    } catch (orderErr) {
                        console.error(`[JumpsellerPolling] Error processing order ${o?.order?.id}:`, orderErr.message);
                    }
                }
            } catch (apiErr) {
                console.error(`[JumpsellerPolling] Error fetching orders for client ${clientId}:`, apiErr.body || apiErr);
            }
        }
        
        // Trigger background geocoding after import
        setTimeout(() => triggerBackgroundGeocoding(), 2000);
    } catch (err) {
        console.error('[JumpsellerPolling] Fatal error in auto-import cycle:', err);
    }
}

let timeoutId = null;

function start(intervalMs = 10 * 60 * 1000, delayMs = 0) { 
    if (timeoutId !== null) return;
    currentIntervalMs = intervalMs;
    nextScheduledTime = Date.now() + delayMs;
    
    console.log(`[JumpsellerPolling] Service starting (Interval: ${intervalMs/1000/60} min, Initial Delay: ${delayMs/1000}s)`);
    
    timeoutId = setTimeout(pollJumpsellerPackages, delayMs);
}

function stop() {
    if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
}

function getStatus() {
    if (isPolling && pollingStartTime && (Date.now() - pollingStartTime > 15 * 60 * 1000)) {
        console.warn('[JumpsellerPolling] Polling cycle took too long (>15m), force reset.');
        isPolling = false;
        pollingStartTime = null;
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(pollJumpsellerPackages, currentIntervalMs);
        }
    }

    return {
        isPolling,
        pollingStartTime,
        lastPollTime,
        nextPollTime: nextScheduledTime
    };
}

module.exports = { start, stop, pollJumpsellerPackages, getStatus, makeJumpsellerRequest };
