
const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const https = require('https');
const bcrypt = require('bcryptjs');

// Middleware to check for Admin role
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
};

// Helper to verify admin password
async function verifyAdminPassword(userId, password) {
    const { rows } = await db.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return false;
    return await bcrypt.compare(password, rows[0].password);
}

const meliPollingService = require('../services/meliPollingService');

// GET /api/settings/meli-polling-status
router.get('/meli-polling-status', authMiddleware, (req, res) => {
    res.json(meliPollingService.getStatus());
});

// GET /api/settings/system
router.get('/system', async (req, res) => {
    try {
        const { rows: settings } = await db.query('SELECT "companyName", "isAppEnabled", "requiredPhotos", "messagingPlan", "pickupMode", "meliFlexValidation", "saveFlexLabelPhoto", "meliAutoImport" FROM system_settings WHERE id = 1');
        const fallbackSettings = {
            companyName: 'FULL ENVIOS',
            isAppEnabled: true,
            requiredPhotos: 1,
            messagingPlan: 'NONE',
            pickupMode: 'SCAN',
            meliFlexValidation: true,
            saveFlexLabelPhoto: false,
            meliAutoImport: false,
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
    const { companyName, isAppEnabled, requiredPhotos, messagingPlan, pickupMode, meliFlexValidation, saveFlexLabelPhoto, meliAutoImport } = req.body;

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
                saveFlexLabelPhoto: saveFlexLabelPhoto !== undefined ? saveFlexLabelPhoto : currentSettings.saveFlexLabelPhoto,
                meliAutoImport: meliAutoImport !== undefined ? meliAutoImport : currentSettings.meliAutoImport,
            };
            
            await db.query(
                'UPDATE system_settings SET "companyName" = $1, "isAppEnabled" = $2, "requiredPhotos" = $3, "messagingPlan" = $4, "pickupMode" = $5, "meliFlexValidation" = $6, "saveFlexLabelPhoto" = $7, "meliAutoImport" = $8 WHERE id = 1',
                [updatedSettings.companyName, updatedSettings.isAppEnabled, updatedSettings.requiredPhotos, updatedSettings.messagingPlan, updatedSettings.pickupMode, updatedSettings.meliFlexValidation, updatedSettings.saveFlexLabelPhoto, updatedSettings.meliAutoImport]
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
                saveFlexLabelPhoto: saveFlexLabelPhoto !== undefined ? saveFlexLabelPhoto : false,
                meliAutoImport: meliAutoImport !== undefined ? meliAutoImport : false,
            };

            await db.query(
                'INSERT INTO system_settings (id, "companyName", "isAppEnabled", "requiredPhotos", "messagingPlan", "pickupMode", "meliFlexValidation", "saveFlexLabelPhoto", "meliAutoImport") VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)',
                [updatedSettings.companyName, updatedSettings.isAppEnabled, updatedSettings.requiredPhotos, updatedSettings.messagingPlan, updatedSettings.pickupMode, updatedSettings.meliFlexValidation, updatedSettings.saveFlexLabelPhoto, updatedSettings.meliAutoImport]
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
    
    if (!(await verifyAdminPassword(req.user.id, password))) {
        return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query('TRUNCATE TABLE tracking_events, packages, assignment_events, pickup_assignments, pickup_runs RESTART IDENTITY CASCADE');
        await client.query(`UPDATE users SET "assignedDriverId" = NULL, "lastAssignmentTimestamp" = NULL, "invoices" = '[]'::jsonb`);
        await client.query("DELETE FROM users WHERE email != 'admin'");
        await client.query('COMMIT');
        res.status(200).json({ message: 'Sistema limpio para producción.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error al limpiar la base de datos.' });
    } finally {
        client.release();
    }
});

// POST /api/settings/reset-packages
router.post('/reset-packages', authMiddleware, adminOnly, async (req, res) => {
    const { password } = req.body;
    if (!(await verifyAdminPassword(req.user.id, password))) {
        return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
    }

    try {
        await db.query('BEGIN');
        await db.query('TRUNCATE TABLE tracking_events, packages RESTART IDENTITY CASCADE');
        await db.query('COMMIT');
        res.status(200).json({ message: 'Paquetes e historial eliminados con éxito.' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar paquetes.' });
    }
});

// POST /api/settings/reset-clients
router.post('/reset-clients', authMiddleware, adminOnly, async (req, res) => {
    const { password } = req.body;
    if (!(await verifyAdminPassword(req.user.id, password))) {
        return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
    }

    try {
        await db.query('BEGIN');
        // First remove assignments related to clients
        await db.query("DELETE FROM assignment_events WHERE \"clientId\" IN (SELECT id FROM users WHERE role = 'CLIENT')");
        await db.query("DELETE FROM pickup_assignments WHERE \"clientId\" IN (SELECT id FROM users WHERE role = 'CLIENT')");
        // Then delete clients
        await db.query("DELETE FROM users WHERE role = 'CLIENT'");
        await db.query('COMMIT');
        res.status(200).json({ message: 'Clientes eliminados con éxito.' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar clientes.' });
    }
});

// POST /api/settings/reset-drivers
router.post('/reset-drivers', authMiddleware, adminOnly, async (req, res) => {
    const { password } = req.body;
    if (!(await verifyAdminPassword(req.user.id, password))) {
        return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
    }

    try {
        await db.query('BEGIN');
        // Unassign packages from drivers
        await db.query('UPDATE packages SET "driverId" = NULL');
        // Delete runs and assignments
        await db.query('TRUNCATE TABLE assignment_events, pickup_assignments, pickup_runs RESTART IDENTITY CASCADE');
        // Delete drivers
        await db.query("DELETE FROM users WHERE role = 'DRIVER'");
        await db.query('COMMIT');
        res.status(200).json({ message: 'Conductores y auxiliares eliminados con éxito.' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar conductores.' });
    }
});

// POST /api/settings/reset-zones
router.post('/reset-zones', authMiddleware, adminOnly, async (req, res) => {
    const { password } = req.body;
    if (!(await verifyAdminPassword(req.user.id, password))) {
        return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
    }

    try {
        await db.query('TRUNCATE TABLE delivery_zones RESTART IDENTITY CASCADE');
        res.status(200).json({ message: 'Zonas de entrega eliminadas con éxito.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar zonas.' });
    }
});

// POST /api/settings/reset-invoices
router.post('/reset-invoices', authMiddleware, adminOnly, async (req, res) => {
    const { password } = req.body;
    if (!(await verifyAdminPassword(req.user.id, password))) {
        return res.status(403).json({ message: 'Contraseña de administrador incorrecta.' });
    }

    try {
        await db.query("UPDATE users SET invoices = '[]'::jsonb, \"pickupCost\" = 0");
        await db.query("UPDATE packages SET billed = false");
        res.status(200).json({ message: 'Historial de facturación reiniciado con éxito.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al reiniciar facturación.' });
    }
});

// GET /api/settings/integrations
router.get('/integrations', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT meli_app_id, meli_client_secret, shopify_shop_url, shopify_access_token, github_token, github_repo, github_owner, woo_url, woo_consumer_key, woo_consumer_secret, falabella_api_key, falabella_seller_id FROM integration_settings WHERE id = 1');
        if (rows.length === 0) return res.json({});
        res.json({ 
            meliAppId: rows[0].meli_app_id,
            meliClientSecret: rows[0].meli_client_secret,
            shopifyShopUrl: rows[0].shopify_shop_url,
            shopifyAccessToken: rows[0].shopify_access_token,
            githubToken: rows[0].github_token,
            githubRepo: rows[0].github_repo,
            githubOwner: rows[0].github_owner,
            wooUrl: rows[0].woo_url,
            wooConsumerKey: rows[0].woo_consumer_key,
            wooConsumerSecret: rows[0].woo_consumer_secret,
            falabellaApiKey: rows[0].falabella_api_key,
            falabellaSellerId: rows[0].falabella_seller_id
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener configuración de integraciones.' });
    }
});

// PUT /api/settings/integrations
router.put('/integrations', authMiddleware, adminOnly, async (req, res) => {
    const { 
        meliAppId, meliClientSecret, 
        shopifyShopUrl, shopifyAccessToken, 
        githubToken, githubRepo, githubOwner,
        wooUrl, wooConsumerKey, wooConsumerSecret,
        falabellaApiKey, falabellaSellerId
    } = req.body;

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
        if (githubToken !== undefined) {
            updates.push(`github_token = $${idx++}`);
            values.push(githubToken);
        }
        if (githubRepo !== undefined) {
            updates.push(`github_repo = $${idx++}`);
            values.push(githubRepo);
        }
        if (githubOwner !== undefined) {
            updates.push(`github_owner = $${idx++}`);
            values.push(githubOwner);
        }
        if (wooUrl !== undefined) {
            updates.push(`woo_url = $${idx++}`);
            values.push(wooUrl);
        }
        if (wooConsumerKey !== undefined) {
            updates.push(`woo_consumer_key = $${idx++}`);
            values.push(wooConsumerKey);
        }
        if (wooConsumerSecret !== undefined) {
            updates.push(`woo_consumer_secret = $${idx++}`);
            values.push(wooConsumerSecret);
        }
        if (falabellaApiKey !== undefined) {
            updates.push(`falabella_api_key = $${idx++}`);
            values.push(falabellaApiKey);
        }
        if (falabellaSellerId !== undefined) {
            updates.push(`falabella_seller_id = $${idx++}`);
            values.push(falabellaSellerId);
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
                shopifyAccessToken: saved.shopify_access_token,
                githubToken: saved.github_token,
                githubRepo: saved.github_repo,
                githubOwner: saved.github_owner,
                wooUrl: saved.woo_url,
                wooConsumerKey: saved.woo_consumer_key,
                wooConsumerSecret: saved.woo_consumer_secret,
                falabellaApiKey: saved.falabella_api_key,
                falabellaSellerId: saved.falabella_seller_id
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

// POST /api/settings/github-backup
router.post('/github-backup', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT github_token, github_repo, github_owner FROM integration_settings WHERE id = 1');
        if (rows.length === 0 || !rows[0].github_token || !rows[0].github_repo || !rows[0].github_owner) {
            return res.status(400).json({ message: 'Configuración de GitHub incompleta.' });
        }

        const { github_token, github_repo, github_owner } = rows[0];

        // 1. Get all data to backup
        const { rows: users } = await db.query('SELECT * FROM users');
        const { rows: packages } = await db.query('SELECT * FROM packages');
        const { rows: tracking } = await db.query('SELECT * FROM tracking_events');

        const backupData = {
            timestamp: new Date().toISOString(),
            users,
            packages,
            tracking
        };

        const content = Buffer.from(JSON.stringify(backupData, null, 2)).toString('base64');
        const fileName = `backups/backup-${new Date().toISOString().split('T')[0]}.json`;

        const pushToBranch = async (branch) => {
            const options = {
                hostname: 'api.github.com',
                path: `/repos/${github_owner}/${github_repo}/contents/${fileName}`,
                method: 'PUT',
                headers: {
                    'Authorization': `token ${github_token}`,
                    'User-Agent': 'Full-Envios-App',
                    'Content-Type': 'application/json'
                }
            };

            // Check if file exists to get SHA (optional, but good for updates)
            // For backups, we usually want new files, so we use a timestamped name.

            const body = JSON.stringify({
                message: `Backup auto-generado ${new Date().toISOString()}`,
                content: content,
                branch: branch
            });

            return new Promise((resolve, reject) => {
                const reqGh = https.request(options, (resGh) => {
                    let data = '';
                    resGh.on('data', (chunk) => { data += chunk; });
                    resGh.on('end', () => {
                        if (resGh.statusCode >= 200 && resGh.statusCode < 300) {
                            resolve(JSON.parse(data));
                        } else {
                            reject(new Error(`GitHub API Error (${branch}): ${resGh.statusCode} - ${data}`));
                        }
                    });
                });
                reqGh.on('error', (e) => reject(e));
                reqGh.write(body);
                reqGh.end();
            });
        };

        // Push to both branches as requested
        await Promise.all([
            pushToBranch('main'),
            pushToBranch('developer')
        ]);

        res.json({ message: 'Respaldo enviado con éxito a GitHub (main y developer).' });

    } catch (err) {
        console.error('Error in GitHub backup:', err);
        res.status(500).json({ message: `Error al realizar el respaldo: ${err.message}` });
    }
});

module.exports = router;
