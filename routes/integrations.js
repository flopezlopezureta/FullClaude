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

// POST /api/integrations/import/meli-scanned
router.post('/import/meli-scanned', authMiddleware, async (req, res) => {
    const { clientId, scannedId } = req.body;

    try {
        // 1. Get Client Tokens
        const { rows: userRows } = await db.query('SELECT integrations, "clientIdentifier", name FROM users WHERE id = $1', [clientId]);
        if (userRows.length === 0) return res.status(404).json({ message: 'Cliente no encontrado.' });
        
        let meliIntegration = userRows[0].integrations?.meli;
        if (!meliIntegration) return res.status(400).json({ message: 'El cliente no tiene Mercado Libre conectado.' });

        // 2. Refresh Token if needed
        if (Date.now() >= meliIntegration.expiresAt) {
            const { rows: settingsRows } = await db.query('SELECT meli_app_id, meli_client_secret FROM integration_settings WHERE id = 1');
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

        // 3. Get Shipment Details from ML
        const shipment = await makeMeliGetRequest(`/shipments/${scannedId}`, meliIntegration.accessToken);
        
        // 4. Create local package
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
            meliOrderId: scannedId
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
        res.status(500).json({ message: 'Error al importar desde ML.' });
    }
});

// GET /api/integrations/status/:shipmentId
router.get('/status/:shipmentId', authMiddleware, async (req, res) => {
    const { shipmentId } = req.params;

    try {
        const { rows: pkgRows } = await db.query('SELECT "creatorId" FROM packages WHERE "meliOrderId" = $1 OR id = $1', [shipmentId]);
        if (pkgRows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado localmente.' });

        const clientId = pkgRows[0].creatorId;
        const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [clientId]);
        let meliIntegration = userRows[0]?.integrations?.meli;

        if (!meliIntegration) return res.status(400).json({ message: 'Cliente sin integración ML.' });

        if (Date.now() >= meliIntegration.expiresAt) {
            const { rows: settingsRows } = await db.query('SELECT meli_app_id, meli_client_secret FROM integration_settings WHERE id = 1');
            const refreshData = new URLSearchParams({
                grant_type: 'refresh_token', client_id: settingsRows[0].meli_app_id, client_secret: settingsRows[0].meli_client_secret, refresh_token: meliIntegration.refreshToken,
            }).toString();
            const refreshed = await makeMeliPostRequest('/oauth/token', refreshData);
            meliIntegration = { ...meliIntegration, accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token, expiresAt: Date.now() + (refreshed.expires_in * 1000) };
            await db.query('UPDATE users SET integrations = $1 WHERE id = $2', [JSON.stringify({ ...userRows[0].integrations, meli: meliIntegration }), clientId]);
        }

        const shipmentData = await makeMeliGetRequest(`/shipments/${shipmentId}`, meliIntegration.accessToken);
        res.json({ status: shipmentData.status, substatus: shipmentData.substatus });

    } catch (err) {
        console.error("Meli Status Check Error:", err.body || err);
        res.status(500).json({ message: 'Error al consultar ML.' });
    }
});

module.exports = router;