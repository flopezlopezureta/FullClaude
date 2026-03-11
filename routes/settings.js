
const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const https = require('https');

// Middleware to check for Admin role
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
};

// GET /api/settings/system
router.get('/system', async (req, res) => {
    try {
        const { rows: settings } = await db.query('SELECT "companyName", "isAppEnabled", "requiredPhotos", "messagingPlan", "pickupMode", "meliFlexValidation" FROM system_settings WHERE id = 1');
        const fallbackSettings = {
            companyName: 'FULL ENVIOS',
            isAppEnabled: true,
            requiredPhotos: 1,
            messagingPlan: 'NONE',
            pickupMode: 'SCAN',
            meliFlexValidation: true,
        };
        if (settings.length === 0) {
            return res.json(fallbackSettings);
        }
        res.json({ ...fallbackSettings, ...settings[0] });
    } catch (err) {
        console.error("ERROR in /api/settings/system:", err);
        // Fail gracefully if DB not ready
        res.json({ companyName: 'FULL ENVIOS', isAppEnabled: true, requiredPhotos: 1, messagingPlan: 'NONE', pickupMode: 'SCAN', meliFlexValidation: true });
    }
});

// PUT /api/settings/system
router.put('/system', authMiddleware, adminOnly, async (req, res) => {
    const { companyName, isAppEnabled, requiredPhotos, messagingPlan, pickupMode, meliFlexValidation } = req.body;

    try {
        const { rows: currentSettingsRows } = await db.query('SELECT * FROM system_settings WHERE id = 1');

        if (currentSettingsRows.length > 0) {
            const currentSettings = currentSettingsRows[0];
            const updatedSettings = {
                companyName: companyName !== undefined ? companyName : currentSettings.companyName,
                isAppEnabled: isAppEnabled !== undefined ? isAppEnabled : currentSettings.isAppEnabled,
                requiredPhotos: requiredPhotos !== undefined ? requiredPhotos : currentSettings.requiredPhotos,
                messagingPlan: messagingPlan !== undefined ? messagingPlan : currentSettings.messagingPlan,
                pickupMode: pickupMode !== undefined ? pickupMode : currentSettings.pickupMode,
                meliFlexValidation: meliFlexValidation !== undefined ? meliFlexValidation : currentSettings.meliFlexValidation,
            };
            
            await db.query(
                'UPDATE system_settings SET "companyName" = $1, "isAppEnabled" = $2, "requiredPhotos" = $3, "messagingPlan" = $4, "pickupMode" = $5, "meliFlexValidation" = $6 WHERE id = 1',
                [updatedSettings.companyName, updatedSettings.isAppEnabled, updatedSettings.requiredPhotos, updatedSettings.messagingPlan, updatedSettings.pickupMode, updatedSettings.meliFlexValidation]
            );
            res.json(updatedSettings);

        } else {
            const updatedSettings = {
                companyName: companyName !== undefined ? companyName : 'FULL ENVIOS',
                isAppEnabled: isAppEnabled !== undefined ? isAppEnabled : true,
                requiredPhotos: requiredPhotos !== undefined ? requiredPhotos : 1,
                messagingPlan: messagingPlan !== undefined ? messagingPlan : 'NONE',
                pickupMode: pickupMode !== undefined ? pickupMode : 'SCAN',
                meliFlexValidation: meliFlexValidation !== undefined ? meliFlexValidation : true,
            };

            await db.query(
                'INSERT INTO system_settings (id, "companyName", "isAppEnabled", "requiredPhotos", "messagingPlan", "pickupMode", "meliFlexValidation") VALUES (1, $1, $2, $3, $4, $5, $6)',
                [updatedSettings.companyName, updatedSettings.isAppEnabled, updatedSettings.requiredPhotos, updatedSettings.messagingPlan, updatedSettings.pickupMode, updatedSettings.meliFlexValidation]
            );
            res.status(201).json(updatedSettings);
        }
    } catch (err) {
        console.error('Error updating system settings:', err);
        res.status(500).json({ message: 'Error al actualizar la configuración del sistema.' });
    }
});

// POST /api/settings/reset-database
router.post('/reset-database', authMiddleware, adminOnly, async (req, res) => {
    const { password } = req.body;
    if (password !== 'adminborrar') {
        return res.status(403).json({ message: 'Contraseña maestra incorrecta.' });
    }
    const client = await db.getClient();
    try {
        const { rows } = await client.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
        if (rows.length === 0 || rows[0].email !== 'admin') {
            client.release();
            return res.status(403).json({ message: 'Acción no autorizada.' });
        }
        await client.query('BEGIN');
        await client.query('TRUNCATE TABLE tracking_events, packages, assignment_events, pickup_assignments, pickup_runs RESTART IDENTITY CASCADE');
        await client.query(`UPDATE users SET "assignedDriverId" = NULL, "lastAssignmentTimestamp" = NULL, "invoices" = '[]'::jsonb`);
        await client.query("DELETE FROM users WHERE email != 'admin'");
        await client.query('COMMIT');
        res.status(200).json({ message: 'Sistema limpio para producción.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error al limpiar la base de datos.' });
    } finally {
        client.release();
    }
});

// GET /api/settings/integrations
router.get('/integrations', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT meli_app_id, meli_client_secret, shopify_shop_url, shopify_access_token FROM integration_settings WHERE id = 1');
        if (rows.length === 0) return res.json({});
        res.json({ 
            meliAppId: rows[0].meli_app_id,
            meliClientSecret: rows[0].meli_client_secret,
            shopifyShopUrl: rows[0].shopify_shop_url,
            shopifyAccessToken: rows[0].shopify_access_token,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener configuración de integraciones.' });
    }
});

// PUT /api/settings/integrations
router.put('/integrations', authMiddleware, adminOnly, async (req, res) => {
    const { meliAppId, meliClientSecret, shopifyShopUrl, shopifyAccessToken } = req.body;

    try {
        // Ensure the row exists
        await db.query(`INSERT INTO integration_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);

        const updates = [];
        const values = [];
        let idx = 1;

        if (meliAppId !== undefined) {
            updates.push(`meli_app_id = $${idx++}`);
            values.push(meliAppId);
        }
        if (meliClientSecret !== undefined) {
            updates.push(`meli_client_secret = $${idx++}`);
            values.push(meliClientSecret);
        }
        if (shopifyShopUrl !== undefined) {
            updates.push(`shopify_shop_url = $${idx++}`);
            values.push(shopifyShopUrl);
        }
        if (shopifyAccessToken !== undefined) {
            updates.push(`shopify_access_token = $${idx++}`);
            values.push(shopifyAccessToken);
        }

        if (updates.length > 0) {
            const query = `UPDATE integration_settings SET ${updates.join(', ')} WHERE id = 1 RETURNING *`;
            const { rows } = await db.query(query, values);
            
            // Return updated settings
            const saved = rows[0];
            res.status(200).json({
                meliAppId: saved.meli_app_id,
                meliClientSecret: saved.meli_client_secret,
                shopifyShopUrl: saved.shopify_shop_url,
                shopifyAccessToken: saved.shopify_access_token
            });
        } else {
            res.status(200).json({ message: "No se enviaron cambios." });
        }
    } catch (err) {
        console.error('Error in PUT /api/settings/integrations:', err);
        res.status(500).json({ message: 'Error al guardar la configuración de integraciones.' });
    }
});

// POST /api/settings/test-meli
router.post('/test-meli', authMiddleware, adminOnly, async (req, res) => {
    const { meliAppId, meliClientSecret } = req.body;

    if (!meliAppId || !meliClientSecret) {
        return res.status(400).json({ message: 'App ID y Client Secret son requeridos.' });
    }

    const postData = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: meliAppId,
        client_secret: meliClientSecret
    }).toString();

    const options = {
        hostname: 'api.mercadolibre.com',
        path: '/oauth/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const reqApi = https.request(options, (resApi) => {
        let data = '';
        resApi.on('data', (chunk) => { data += chunk; });
        resApi.on('end', () => {
            try {
                const response = JSON.parse(data);
                if (resApi.statusCode === 200) {
                    return res.json({ message: 'Conexión exitosa con Mercado Libre.' });
                }
                if (response.error === 'invalid_client') {
                     return res.status(400).json({ message: 'Credenciales inválidas. Verifica el App ID y Secret.' });
                }
                return res.status(resApi.statusCode).json({ message: `Error de Mercado Libre: ${response.message || response.error}` });
            } catch (e) {
                return res.status(500).json({ message: 'Respuesta inválida de Mercado Libre.' });
            }
        });
    });

    reqApi.on('error', (e) => {
        console.error("Meli Connection Error:", e);
        return res.status(500).json({ message: `Error de red: ${e.message}` });
    });

    reqApi.write(postData);
    reqApi.end();
});

module.exports = router;
