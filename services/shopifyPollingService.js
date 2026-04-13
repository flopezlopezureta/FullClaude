const db = require('../db');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const { triggerBackgroundGeocoding } = require('./geocodingService');

// --- SHOPIFY API HELPERS ---
const makeShopifyRequest = (shopUrl, accessToken, path, method = 'GET', postData = null) => {
    return new Promise((resolve, reject) => {
        if (!shopUrl) return reject(new Error('La URL de la tienda es requerida.'));
        if (!accessToken) return reject(new Error('El Access Token de Shopify es requerido.'));

        // Extract only the hostname
        let hostname = shopUrl.trim().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

        // Basic validation and correction
        if (hostname && !hostname.includes('.')) {
            hostname += '.myshopify.com';
        } else if (hostname && hostname.endsWith('.shopify.com')) {
            hostname = hostname.replace('.shopify.com', '.myshopify.com');
        }

        const options = {
            hostname: hostname,
            path: `/admin/api/2024-04${path}`,
            method: method,
            headers: {
                'X-Shopify-Access-Token': accessToken,
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
        req.on('error', (e) => reject(e));
        if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        req.end();
    });
};

let isPolling = false;
let lastPollTime = Date.now();
let currentIntervalMs = 5 * 60 * 1000;
let nextScheduledTime = lastPollTime + currentIntervalMs;

async function pollShopifyPackages() {
    if (isPolling) {
        console.log('[ShopifyPolling] Already polling, skipping...');
        return;
    }
    isPolling = true;
    lastPollTime = Date.now();
    console.log('[ShopifyPolling] Starting poll cycle...');
    try {
        // 0. Check if auto-import is enabled (similar to Meli)
        let autoImportEnabled = false;
        try {
            const { rows: settingsRows } = await db.query('SELECT "shopifyAutoImport" FROM system_settings WHERE id = 1');
            autoImportEnabled = settingsRows.length > 0 && settingsRows[0].shopifyAutoImport;
        } catch (settingsErr) {
            // If column doesn't exist yet, we can't decide, but based on user request "hazlo", we assume true for now if missing
            console.warn('[ShopifyPolling] Could not fetch shopifyAutoImport from DB. Defaulting to true for active customers.');
            autoImportEnabled = true; 
        }

        // We'll proceed if enabled
        if (autoImportEnabled) {
            await autoImportShopifyPackages();
        }

    } catch (err) {
        console.error('[ShopifyPolling] Fatal error in poll cycle:', err);
    } finally {
        isPolling = false;
        nextScheduledTime = Date.now() + currentIntervalMs;
    }
}

async function autoImportShopifyPackages() {
    console.log('[ShopifyPolling] Starting auto-import cycle...');
    try {
        // 1. Get all users with Shopify integration
        const { rows: users } = await db.query("SELECT id, integrations, \"clientIdentifier\" FROM users WHERE integrations->'shopify' IS NOT NULL");
        
        for (const user of users) {
            const clientId = user.id;
            const clientIdentifier = user.clientIdentifier || 'CLI';
            const shopify = user.integrations.shopify;

            if (!shopify.shopUrl || !shopify.accessToken) continue;

            // Check if the individual client has auto-import disabled
            // If it's undefined, we can default to true for backward compatibility or false if we want strictly opt-in.
            // According to user request "seleccionar si será manual o automatica", we'll check if it's explicitly true.
            if (shopify.autoImport !== true) {
                console.log(`[ShopifyPolling] Skipping client ${clientId} - Auto-import is currently set to MANUAL.`);
                continue;
            }

            try {
                // 2. Fetch recent paid orders
                // status=open & financial_status=paid
                const ordersData = await makeShopifyRequest(shopify.shopUrl, shopify.accessToken, '/orders.json?status=open&financial_status=paid&limit=50');
                
                if (!ordersData.orders || ordersData.orders.length === 0) {
                    continue;
                }

                console.log(`[ShopifyPolling] Found ${ordersData.orders.length} paid orders for client ${clientId} (${shopify.shopUrl})`);

                for (const order of ordersData.orders) {
                    try {
                        const orderId = order.id.toString();
                        
                        // 3. Check if already imported
                        const { rows: existing } = await db.query('SELECT id FROM packages WHERE "shopifyOrderId" = $1 OR "id" = $2', [orderId, orderId]);
                        if (existing.length > 0) continue;

                        // 4. Region Check (Santiago/RM)
                        const address = order.shipping_address || order.billing_address || {};
                        const province = (address.province || '').toLowerCase();
                        const city = (address.city || '').toLowerCase();
                        
                        const isRM = province.includes('metropolitana') || 
                                     province.includes('santiago') || 
                                     province === 'rm' ||
                                     province.includes('r.m.') ||
                                     city.includes('santiago') ||
                                     city.includes('metropolitana');
                        
                        if (!isRM) {
                            console.log(`[ShopifyPolling] Skipping order ${orderId} - Outside RM (${province}, ${city})`);
                            continue;
                        }

                        // 5. Import Package
                        const now = new Date();
                        const newPackage = {
                            id: `${clientIdentifier}-${uuidv4().split('-')[0]}`,
                            recipientName: `${address.first_name || ''} ${address.last_name || ''}`.trim() || 'N/A',
                            recipientPhone: address.phone || 'N/A',
                            status: 'PENDIENTE',
                            shippingType: 'SAME_DAY',
                            origin: 'Centro de Distribución',
                            recipientAddress: `${address.address1 || ''} ${address.address2 || ''}`.trim() || 'N/A',
                            recipientCommune: address.city || 'N/A',
                            recipientCity: 'Región Metropolitana',
                            notes: `Auto-Import Shopify Order: ${order.name || orderId}`,
                            estimatedDelivery: now,
                            createdAt: now,
                            updatedAt: now,
                            creatorId: clientId,
                            source: 'SHOPIFY',
                            shopifyOrderId: orderId
                        };

                        const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
                        const values = Object.values(newPackage).map(v => v === undefined ? null : v);
                        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                        await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, values);
                        await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
                            [newPackage.id, 'Creado', newPackage.origin, 'Auto-importado vía Shopify.', now]);
                        
                        console.log(`[ShopifyPolling] Auto-imported order ${orderId} for client ${clientId}`);
                        
                    } catch (orderErr) {
                        console.error(`[ShopifyPolling] Error processing order ${order.id}:`, orderErr.message);
                    }
                }
            } catch (apiErr) {
                console.error(`[ShopifyPolling] Error fetching orders for ${shopify.shopUrl}:`, apiErr.body || apiErr);
            }
        }
        
        // Trigger background geocoding after import
        setTimeout(() => triggerBackgroundGeocoding(), 2000);
    } catch (err) {
        console.error('[ShopifyPolling] Fatal error in auto-import cycle:', err);
    }
}

let intervalId = null;

function start(intervalMs = 5 * 60 * 1000, delayMs = 0) { 
    if (intervalId) return;
    currentIntervalMs = intervalMs;
    nextScheduledTime = Date.now() + delayMs;
    
    console.log(`[ShopifyPolling] Service starting (Interval: ${intervalMs/1000/60} min, Initial Delay: ${delayMs/1000}s)`);
    
    // Schedule first run and then the interval
    setTimeout(() => {
        pollShopifyPackages();
        intervalId = setInterval(pollShopifyPackages, intervalMs);
    }, delayMs);
}

function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

function getStatus() {
    return {
        isPolling,
        lastPollTime,
        nextPollTime: nextScheduledTime
    };
}

module.exports = { start, stop, pollShopifyPackages, getStatus };
