const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

// --- MELI API HELPERS ---
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

// --- WOOCOMMERCE API HELPERS ---
const makeWooCommerceRequest = (wooUrl, consumerKey, consumerSecret, path, method = 'GET', postData = null) => {
    return new Promise((resolve, reject) => {
        if (!wooUrl) return reject(new Error('La URL de WooCommerce es requerida.'));
        if (!consumerKey) return reject(new Error('El Consumer Key de WooCommerce es requerido.'));
        if (!consumerSecret) return reject(new Error('El Consumer Secret de WooCommerce es requerido.'));

        // Clean URL
        let cleanUrl = wooUrl.trim().replace(/\/$/, '');
        if (!cleanUrl.startsWith('http')) {
            cleanUrl = 'https://' + cleanUrl;
        }

        const url = new URL(`${cleanUrl}/wp-json/wc/v3${path}`);
        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = (url.protocol === 'https:' ? https : require('http')).request(options, (res) => {
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

// --- FALABELLA API HELPERS ---
const makeFalabellaRequest = (apiKey, sellerId, path, method = 'GET', postData = null) => {
    return new Promise((resolve, reject) => {
        if (!apiKey) return reject(new Error('La API Key de Falabella es requerida.'));
        if (!sellerId) return reject(new Error('El Seller ID de Falabella es requerido.'));

        // This is a placeholder for Falabella (Seller Center) API
        // In a real scenario, this would involve specific headers and signature
        const options = {
            hostname: 'sellercenter-api.falabella.com',
            path: `/${path}`,
            method: method,
            headers: {
                'Api-Key': apiKey,
                'Seller-Id': sellerId,
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

const getValidMeliIntegration = async (clientId) => {
    const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [clientId]);
    if (userRows.length === 0) throw new Error('Cliente no encontrado.');
    
    let meliIntegration = userRows[0].integrations?.meli;
    if (!meliIntegration) throw new Error('El cliente no tiene Mercado Libre conectado.');

    // Refresh Token if needed
    if (Date.now() >= meliIntegration.expiresAt) {
        const { rows: settingsRows } = await db.query('SELECT meli_app_id, meli_client_secret FROM integration_settings WHERE id = 1');
        if (settingsRows.length === 0) throw new Error('Configuración de Mercado Libre no encontrada en el servidor.');
        const { meli_app_id, meli_client_secret } = settingsRows[0];
        
        const refreshData = new URLSearchParams({
            grant_type: 'refresh_token', client_id: meli_app_id, client_secret: meli_client_secret, refresh_token: meliIntegration.refreshToken,
        }).toString();
        
        const refreshed = await makeMeliPostRequest('/oauth/token', refreshData);
        meliIntegration = {
            ...meliIntegration,
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            expiresAt: Date.now() + (refreshed.expires_in * 1000),
        };
        await db.query('UPDATE users SET integrations = $1 WHERE id = $2', [JSON.stringify({ ...userRows[0].integrations, meli: meliIntegration }), clientId]);
    }
    return meliIntegration;
};

// POST /api/integrations/import/meli-scanned
router.post('/import/meli-scanned', authMiddleware, async (req, res) => {
    const { clientId, scannedId, flexCode } = req.body;

    try {
        // 1. Get Valid Integration
        const meliIntegration = await getValidMeliIntegration(clientId);
        const { rows: userRows } = await db.query('SELECT "clientIdentifier" FROM users WHERE id = $1', [clientId]);

        // 2. Get Shipment Details from ML
        const shipment = await makeMeliGetRequest(`/shipments/${scannedId}`, meliIntegration.accessToken);
        
        // 3. Create local package
        const now = new Date();
        const newPackage = {
            id: `${userRows[0].clientIdentifier}-${uuidv4().split('-')[0]}`,
            recipientName: shipment.receiver_address?.receiver_name || 'N/A',
            recipientPhone: shipment.receiver_address?.receiver_phone || 'N/A',
            status: 'PENDIENTE',
            shippingType: 'SAME_DAY',
            origin: 'Centro de Distribución',
            recipientAddress: shipment.receiver_address?.address_line || 'N/A',
            recipientCommune: shipment.receiver_address?.city?.name || 'N/A',
            recipientCity: shipment.receiver_address?.state?.name || 'Santiago',
            notes: `ML ID: ${scannedId}`,
            estimatedDelivery: now,
            createdAt: now,
            updatedAt: now,
            creatorId: clientId,
            source: 'MERCADO_LIBRE',
            meliOrderId: scannedId,
            meliFlexCode: flexCode || scannedId
        };

        const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
        const values = Object.values(newPackage);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, values);
        await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
            [newPackage.id, 'Creado', newPackage.origin, 'Importado vía escaneo ML.', now]);

        res.status(201).json({ message: `Paquete para ${newPackage.recipientName} importado!`, pkg: newPackage });

    } catch (err) {
        console.error("Meli Scanned Import Error:", err.body || err);
        res.status(500).json({ message: err.message || 'Error al importar desde ML.' });
    }
});

// GET /api/integrations/status/:shipmentId
router.get('/status/:shipmentId', authMiddleware, async (req, res) => {
    const { shipmentId } = req.params;

    try {
        const { rows: pkgRows } = await db.query('SELECT "creatorId" FROM packages WHERE "meliOrderId" = $1 OR id = $1', [shipmentId]);
        if (pkgRows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado localmente.' });

        const clientId = pkgRows[0].creatorId;
        const meliIntegration = await getValidMeliIntegration(clientId);

        const shipmentData = await makeMeliGetRequest(`/shipments/${shipmentId}`, meliIntegration.accessToken);
        res.json({ status: shipmentData.status, substatus: shipmentData.substatus });

    } catch (err) {
        console.error("Meli Status Check Error:", err.body || err);
        res.status(500).json({ message: err.message || 'Error al consultar ML.' });
    }
});

// GET /api/integrations/:clientId/meli/orders
router.get('/:clientId/meli/orders', authMiddleware, async (req, res) => {
    const { clientId } = req.params;

    // Security check: only admin or the client themselves can fetch orders
    if (req.user.role !== 'ADMIN' && req.user.id !== clientId) {
        return res.status(403).json({ message: 'No tienes permiso para ver estos pedidos.' });
    }

    try {
        const meliIntegration = await getValidMeliIntegration(clientId);
        
        // Fetch recent orders (last 2 days) that are paid and not shipped yet
        // ML API: /orders/search?seller=${seller_id}&order.status=paid
        const ordersData = await makeMeliGetRequest(`/orders/search?seller=${meliIntegration.userId}&order.status=paid`, meliIntegration.accessToken);
        
        const orders = await Promise.all(ordersData.results.map(async (order) => {
            // For each order, we need shipment details to get the address
            const shipmentId = order.shipping?.id;
            let shipment = null;
            if (shipmentId) {
                try {
                    shipment = await makeMeliGetRequest(`/shipments/${shipmentId}`, meliIntegration.accessToken);
                } catch (e) {
                    console.error(`Error fetching shipment ${shipmentId} for order ${order.id}`);
                }
            }

            return {
                id: order.id.toString(),
                recipientName: shipment?.receiver_address?.receiver_name || order.buyer?.nickname || 'N/A',
                address: shipment?.receiver_address?.address_line || 'N/A',
                commune: shipment?.receiver_address?.city?.name || 'N/A',
                city: shipment?.receiver_address?.state?.name || 'N/A',
                notes: `ML Order: ${order.id}`,
                shipmentId: shipmentId
            };
        }));

        res.json(orders);
    } catch (err) {
        console.error("Meli Fetch Orders Error:", err.body || err);
        res.status(500).json({ message: err.message || 'Error al obtener pedidos de Mercado Libre.' });
    }
});

// POST /api/integrations/:clientId/meli/import
router.post('/:clientId/meli/import', authMiddleware, async (req, res) => {
    const { clientId } = req.params;
    const { orderIds } = req.body;

    if (req.user.role !== 'ADMIN' && req.user.id !== clientId) {
        return res.status(403).json({ message: 'No tienes permiso para importar estos pedidos.' });
    }

    try {
        const meliIntegration = await getValidMeliIntegration(clientId);
        const { rows: userRows } = await db.query('SELECT "clientIdentifier" FROM users WHERE id = $1', [clientId]);
        const clientIdentifier = userRows[0].clientIdentifier;

        const results = [];
        for (const orderId of orderIds) {
            try {
                // 1. Get Order Details
                const order = await makeMeliGetRequest(`/orders/${orderId}`, meliIntegration.accessToken);
                const shipmentId = order.shipping?.id;
                
                if (!shipmentId) {
                    results.push({ orderId, status: 'error', message: 'No shipment ID found for this order.' });
                    continue;
                }

                // 2. Get Shipment Details
                const shipment = await makeMeliGetRequest(`/shipments/${shipmentId}`, meliIntegration.accessToken);

                // 3. Check if already imported
                const { rows: existing } = await db.query('SELECT id FROM packages WHERE "meliOrderId" = $1', [orderId]);
                if (existing.length > 0) {
                    results.push({ orderId, status: 'skipped', message: 'Already imported.' });
                    continue;
                }

                // 4. Create local package
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
                    recipientCity: shipment.receiver_address?.state?.name || 'Santiago',
                    notes: `ML Order: ${orderId}`,
                    estimatedDelivery: now,
                    createdAt: now,
                    updatedAt: now,
                    creatorId: clientId,
                    source: 'MERCADO_LIBRE',
                    meliOrderId: orderId.toString(),
                    meliFlexCode: shipmentId.toString()
                };

                const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
                const values = Object.values(newPackage);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, values);
                await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)', 
                    [newPackage.id, 'Creado', newPackage.origin, 'Importado vía integración ML.', now]);

                results.push({ orderId, status: 'success' });
            } catch (e) {
                console.error(`Error importing order ${orderId}:`, e.body || e);
                results.push({ orderId, status: 'error', message: e.message || 'Unknown error' });
            }
        }

        res.json({ results });
    } catch (err) {
        console.error("Meli Import Orders Error:", err.body || err);
        res.status(500).json({ message: err.message || 'Error al importar pedidos de Mercado Libre.' });
    }
});

// --- SHOPIFY API HELPERS ---
const makeShopifyRequest = (shopUrl, accessToken, path, method = 'GET', postData = null) => {
    return new Promise((resolve, reject) => {
        if (!shopUrl) return reject(new Error('La URL de la tienda es requerida.'));
        if (!accessToken) return reject(new Error('El Access Token de Shopify es requerido.'));

        // Extract only the hostname (e.g., shopname.myshopify.com)
        let hostname = shopUrl.trim();
        
        // Remove protocol
        hostname = hostname.replace(/^https?:\/\//, '');
        
        // Remove path if present (e.g. tienda.myshopify.com/admin)
        hostname = hostname.split('/')[0];
        
        // Remove port if present
        hostname = hostname.split(':')[0];

        // Basic validation: if no dots, assume it's just the shop name
        if (hostname && !hostname.includes('.')) {
            hostname += '.myshopify.com';
        }

        if (!hostname) {
            return reject(new Error('URL de tienda inválida. Por favor usa el formato "tienda.myshopify.com".'));
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
                        // Shopify often returns errors as { errors: "..." } or { errors: { field: ["error"] } }
                        reject({ statusCode: res.statusCode, body: parsedData });
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject({ statusCode: res.statusCode, body: data, isRaw: true });
                    }
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Shopify Request Error (${hostname}):`, e.message);
            reject(new Error(`Error de red al contactar a Shopify (${hostname}): ${e.message}`));
        });

        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
};

const getValidShopifyIntegration = async (clientId) => {
    const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [clientId]);
    if (userRows.length === 0) throw new Error('Cliente no encontrado.');
    
    let shopifyIntegration = userRows[0].integrations?.shopify;
    
    // If not in user, check global settings
    if (!shopifyIntegration || !shopifyIntegration.shopUrl || !shopifyIntegration.accessToken) {
        const { rows: settingsRows } = await db.query('SELECT shopify_shop_url, shopify_access_token FROM integration_settings WHERE id = 1');
        if (settingsRows.length > 0 && settingsRows[0].shopify_shop_url && settingsRows[0].shopify_access_token) {
            shopifyIntegration = {
                shopUrl: settingsRows[0].shopify_shop_url,
                accessToken: settingsRows[0].shopify_access_token
            };
        }
    }

    if (!shopifyIntegration || !shopifyIntegration.shopUrl || !shopifyIntegration.accessToken) {
        throw new Error('El cliente no tiene Shopify configurado.');
    }

    return shopifyIntegration;
};

const getValidWooCommerceIntegration = async (clientId) => {
    const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [clientId]);
    if (userRows.length === 0) throw new Error('Cliente no encontrado.');
    
    let wooIntegration = userRows[0].integrations?.woocommerce;
    
    // If not in user, check global settings
    if (!wooIntegration || !wooIntegration.wooUrl || !wooIntegration.wooConsumerKey || !wooIntegration.wooConsumerSecret) {
        const { rows: settingsRows } = await db.query('SELECT woo_url, woo_consumer_key, woo_consumer_secret FROM integration_settings WHERE id = 1');
        if (settingsRows.length > 0 && settingsRows[0].woo_url && settingsRows[0].woo_consumer_key && settingsRows[0].woo_consumer_secret) {
            wooIntegration = {
                wooUrl: settingsRows[0].woo_url,
                wooConsumerKey: settingsRows[0].woo_consumer_key,
                wooConsumerSecret: settingsRows[0].woo_consumer_secret
            };
        }
    }

    if (!wooIntegration || !wooIntegration.wooUrl || !wooIntegration.wooConsumerKey || !wooIntegration.wooConsumerSecret) {
        throw new Error('El cliente no tiene WooCommerce configurado.');
    }

    return wooIntegration;
};

const getValidFalabellaIntegration = async (clientId) => {
    const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [clientId]);
    if (userRows.length === 0) throw new Error('Cliente no encontrado.');
    
    let falabellaIntegration = userRows[0].integrations?.falabella;
    
    // If not in user, check global settings
    if (!falabellaIntegration || !falabellaIntegration.falabellaApiKey || !falabellaIntegration.falabellaSellerId) {
        const { rows: settingsRows } = await db.query('SELECT falabella_api_key, falabella_seller_id FROM integration_settings WHERE id = 1');
        if (settingsRows.length > 0 && settingsRows[0].falabella_api_key && settingsRows[0].falabella_seller_id) {
            falabellaIntegration = {
                falabellaApiKey: settingsRows[0].falabella_api_key,
                falabellaSellerId: settingsRows[0].falabella_seller_id
            };
        }
    }

    if (!falabellaIntegration || !falabellaIntegration.falabellaApiKey || !falabellaIntegration.falabellaSellerId) {
        throw new Error('El cliente no tiene Falabella configurado.');
    }

    return falabellaIntegration;
};

// POST /api/integrations/test/shopify
router.post('/test/shopify', authMiddleware, async (req, res) => {
    const { shopifyShopUrl, shopifyAccessToken } = req.body;

    if (!shopifyShopUrl || !shopifyAccessToken) {
        return res.status(400).json({ message: 'URL de la tienda y Access Token son requeridos.' });
    }

    try {
        // Test by fetching shop info
        const shopData = await makeShopifyRequest(shopifyShopUrl, shopifyAccessToken, '/shop.json');
        res.json({ 
            message: 'Conexión exitosa con Shopify.',
            shopName: shopData?.shop?.name
        });
    } catch (err) {
        console.error("Shopify Test Connection Error:", err.body || err);
        let errorMsg = 'Error al conectar con Shopify.';
        let statusCode = 500;
        
        if (err.statusCode) {
            statusCode = err.statusCode;
            if (err.statusCode === 401) {
                errorMsg = 'No autorizado. Verifica que el Access Token sea correcto y tenga los permisos necesarios.';
            } else if (err.statusCode === 404) {
                errorMsg = 'No encontrado. Verifica que la URL de la tienda sea correcta.';
            } else if (err.statusCode === 403) {
                errorMsg = 'Acceso prohibido. El token no tiene permisos para acceder a la información de la tienda.';
            }
        }

        if (err.body && err.body.errors) {
            if (typeof err.body.errors === 'string') {
                errorMsg = err.body.errors;
            } else if (typeof err.body.errors === 'object') {
                errorMsg = JSON.stringify(err.body.errors);
            }
        } else if (err.message) {
            errorMsg = err.message;
        }

        res.status(statusCode).json({ message: `Error de Shopify: ${errorMsg}` });
    }
});

// POST /api/integrations/test/woocommerce
router.post('/test/woocommerce', authMiddleware, async (req, res) => {
    const { wooUrl, wooConsumerKey, wooConsumerSecret } = req.body;
    
    if (!wooUrl || !wooConsumerKey || !wooConsumerSecret) {
        return res.status(400).json({ message: 'URL, Consumer Key y Consumer Secret son requeridos.' });
    }

    try {
        // Test by fetching system status or just a simple endpoint
        await makeWooCommerceRequest(wooUrl, wooConsumerKey, wooConsumerSecret, '/system_status');
        res.json({ message: 'Conexión exitosa con WooCommerce.' });
    } catch (err) {
        console.error("WooCommerce Test Connection Error:", err.body || err);
        let errorMsg = 'Error al conectar con WooCommerce.';
        let statusCode = 500;
        
        if (err.statusCode) {
            statusCode = err.statusCode;
            if (err.statusCode === 401) {
                errorMsg = 'No autorizado. Verifica que el Consumer Key y Consumer Secret sean correctos.';
            } else if (err.statusCode === 404) {
                errorMsg = 'No encontrado. Verifica que la URL sea correcta y la API REST esté habilitada.';
            }
        }

        if (err.body && err.body.message) {
            errorMsg = err.body.message;
        } else if (err.message) {
            errorMsg = err.message;
        }

        res.status(statusCode).json({ message: `Error de WooCommerce: ${errorMsg}` });
    }
});

// POST /api/integrations/test/falabella
router.post('/test/falabella', authMiddleware, async (req, res) => {
    const { falabellaApiKey, falabellaSellerId } = req.body;
    
    if (!falabellaApiKey || !falabellaSellerId) {
        return res.status(400).json({ message: 'API Key y Seller ID son requeridos.' });
    }

    try {
        // Placeholder for Falabella test
        // In a real scenario, we would call a "ping" or "status" endpoint.
        // For now, we'll simulate a successful connection if the fields are provided.
        res.json({ message: 'Configuración de Falabella guardada (Prueba de conexión pendiente de implementación exacta).' });
    } catch (err) {
        console.error("Falabella Test Connection Error:", err);
        res.status(500).json({ message: 'Error al conectar con Falabella: ' + (err.message || 'Error desconocido') });
    }
});

// GET /api/integrations/:clientId/shopify/orders
router.get('/:clientId/shopify/orders', authMiddleware, async (req, res) => {
    const { clientId } = req.params;

    if (req.user.role !== 'ADMIN' && req.user.id !== clientId) {
        return res.status(403).json({ message: 'No tienes permiso para ver estos pedidos.' });
    }

    try {
        const shopifyIntegration = await getValidShopifyIntegration(clientId);
        
        // Fetch open orders
        const data = await makeShopifyRequest(
            shopifyIntegration.shopUrl, 
            shopifyIntegration.accessToken, 
            '/orders.json?status=open&fulfillment_status=unfulfilled'
        );
        
        if (!data || !data.orders) {
            return res.json([]);
        }

        const orders = data.orders.map(order => ({
            id: order.id.toString(),
            recipientName: `${order.shipping_address?.first_name || ''} ${order.shipping_address?.last_name || ''}`.trim() || order.customer?.first_name || 'N/A',
            recipientPhone: order.shipping_address?.phone || order.customer?.phone || 'N/A',
            address: `${order.shipping_address?.address1 || ''} ${order.shipping_address?.address2 || ''}`.trim() || 'N/A',
            commune: order.shipping_address?.city || 'N/A',
            city: order.shipping_address?.province || 'N/A',
            notes: `Shopify Order: ${order.name || order.id}`,
        }));

        res.json(orders);
    } catch (err) {
        console.error("Shopify Fetch Orders Error:", err.body || err);
        let errorMsg = 'Error al obtener pedidos de Shopify.';
        let statusCode = 500;

        if (err.statusCode) {
            statusCode = err.statusCode;
            if (err.statusCode === 401) {
                errorMsg = 'No autorizado. Verifica las credenciales de Shopify.';
            } else if (err.statusCode === 404) {
                errorMsg = 'No encontrado. Verifica la URL de la tienda.';
            }
        }

        if (err.body && err.body.errors) {
            if (typeof err.body.errors === 'string') {
                errorMsg = err.body.errors;
            } else if (typeof err.body.errors === 'object') {
                errorMsg = JSON.stringify(err.body.errors);
            }
        } else if (err.message) {
            errorMsg = err.message;
        }

        res.status(statusCode).json({ message: errorMsg });
    }
});

// GET /api/integrations/:clientId/woocommerce/orders
router.get('/:clientId/woocommerce/orders', authMiddleware, async (req, res) => {
    const { clientId } = req.params;

    if (req.user.role !== 'ADMIN' && req.user.id !== clientId) {
        return res.status(403).json({ message: 'No tienes permiso para ver estos pedidos.' });
    }

    try {
        const wooIntegration = await getValidWooCommerceIntegration(clientId);
        
        // Fetch processing orders
        const ordersData = await makeWooCommerceRequest(
            wooIntegration.wooUrl, 
            wooIntegration.wooConsumerKey, 
            wooIntegration.wooConsumerSecret, 
            '/orders?status=processing'
        );
        
        if (!ordersData || !Array.isArray(ordersData)) {
            return res.json([]);
        }

        const orders = ordersData.map(order => ({
            id: order.id.toString(),
            recipientName: `${order.shipping?.first_name || ''} ${order.shipping?.last_name || ''}`.trim() || `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'N/A',
            recipientPhone: order.billing?.phone || 'N/A',
            address: `${order.shipping?.address_1 || ''} ${order.shipping?.address_2 || ''}`.trim() || order.billing?.address_1 || 'N/A',
            commune: order.shipping?.city || order.billing?.city || 'N/A',
            city: order.shipping?.state || order.billing?.state || 'N/A',
            notes: `WooCommerce Order: ${order.number || order.id}`,
        }));

        res.json(orders);
    } catch (err) {
        console.error("WooCommerce Fetch Orders Error:", err.body || err);
        res.status(500).json({ message: 'Error al obtener pedidos de WooCommerce: ' + (err.message || 'Error desconocido') });
    }
});

// GET /api/integrations/:clientId/falabella/orders
router.get('/:clientId/falabella/orders', authMiddleware, async (req, res) => {
    const { clientId } = req.params;

    if (req.user.role !== 'ADMIN' && req.user.id !== clientId) {
        return res.status(403).json({ message: 'No tienes permiso para ver estos pedidos.' });
    }

    try {
        const falabellaIntegration = await getValidFalabellaIntegration(clientId);
        
        // Placeholder for Falabella fetch orders
        // In a real scenario, we would call the Falabella Seller Center API
        // For now, we'll return an empty list or a simulated list if needed
        res.json([]);
    } catch (err) {
        console.error("Falabella Fetch Orders Error:", err);
        res.status(500).json({ message: 'Error al obtener pedidos de Falabella: ' + (err.message || 'Error desconocido') });
    }
});

// GET /api/integrations/meli/callback
// This is the public callback URL for Mercado Libre OAuth
router.get('/meli/callback', async (req, res) => {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
        return res.status(400).send('Faltan parámetros de autorización (code o state).');
    }

    try {
        // 1. Get App Credentials
        const { rows: settingsRows } = await db.query('SELECT meli_app_id, meli_client_secret FROM integration_settings WHERE id = 1');
        if (settingsRows.length === 0) {
            return res.status(500).send('Configuración de Mercado Libre no encontrada en el servidor.');
        }
        const { meli_app_id, meli_client_secret } = settingsRows[0];

        // 2. Exchange Code for Tokens
        // Force https as the app is running behind a proxy that handles SSL
        const host = req.get('host');
        const redirectUri = `https://${host}/api/integrations/meli/callback`;
        
        const postData = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: meli_app_id,
            client_secret: meli_client_secret,
            code: code,
            redirect_uri: redirectUri
        }).toString();

        const tokenData = await makeMeliPostRequest('/oauth/token', postData);

        // 3. Store Tokens in User record
        const meliIntegration = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + (tokenData.expires_in * 1000),
            userId: tokenData.user_id,
            connectedAt: new Date().toISOString()
        };

        const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [userId]);
        const currentIntegrations = userRows[0]?.integrations || {};
        
        await db.query('UPDATE users SET integrations = $1 WHERE id = $2', [
            JSON.stringify({ ...currentIntegrations, meli: meliIntegration }),
            userId
        ]);

        // 4. Redirect back to the frontend with success
        res.send(`
            <html>
                <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f3f4f6;">
                    <div style="background: white; padding: 2rem; border-radius: 1rem; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                        <h2 style="color: #059669;">¡Conexión Exitosa!</h2>
                        <p>Mercado Libre se ha conectado correctamente a tu cuenta de Full Envios.</p>
                        <p>Puedes cerrar esta ventana y refrescar el panel de administración.</p>
                        <button onclick="window.close()" style="background: #10b981; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cerrar Ventana</button>
                    </div>
                    <script>
                        setTimeout(() => {
                            window.close();
                        }, 5000);
                    </script>
                </body>
            </html>
        `);

    } catch (err) {
        console.error("Meli Callback Error:", err.body || err);
        res.status(500).send(`Error al procesar la conexión con Mercado Libre: ${JSON.stringify(err.body || err)}`);
    }
});

module.exports = router;