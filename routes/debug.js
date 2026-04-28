const express = require('express');
const router = express.Router();
const db = require('../db');

// This file was missing and is referenced in server.js.
// Creating a placeholder to ensure server stability.

// Example debug route to check DB connection
router.get('/db-check', async (req, res) => {
    try {
        const { rows: dbInfo } = await db.query("SELECT current_database(), current_user, inet_server_addr()");
        const { rows: packageCount } = await db.query("SELECT count(*) FROM packages");
        
        res.status(200).json({ 
            status: 'ok', 
            message: 'Database connection successful.',
            database: dbInfo[0].current_database,
            user: dbInfo[0].current_user,
            server_addr: dbInfo[0].inet_server_addr,
            packageCount: parseInt(packageCount[0].count),
            envHost: process.env.DB_HOST,
            envName: process.env.DB_NAME,
            nodeEnv: process.env.NODE_ENV
        });
    } catch (err) {
        res.status(500).json({ 
            status: 'error', 
            message: 'Database connection failed.', 
            error: err.message,
            envHost: process.env.DB_HOST,
            envName: process.env.DB_NAME
        });
    }
});


router.get('/meli-check/:id', async (req, res) => {
    const shipmentId = req.params.id;
    const https = require('https');
    const meliPollingService = require('../services/meliPollingService');

    const makeMeliRequest = (path, accessToken) => {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.mercadolibre.com',
                path,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                });
            });
            req.on('error', (e) => reject(e));
            req.end();
        });
    };

    try {
        const { rows: users } = await db.query("SELECT id, name FROM users WHERE integrations->'meli' IS NOT NULL");
        let results = [];
        
        for (const user of users) {
            try {
                const token = await meliPollingService.getValidMeliToken(user.id);
                if (!token) continue;
                
                const shipment = await makeMeliRequest(`/shipments/${shipmentId}`, token);
                results.push({
                    client: user.name,
                    clientId: user.id,
                    found: !!shipment.id,
                    details: shipment.id ? shipment : shipment.message || shipment
                });
            } catch (err) {
                results.push({ client: user.name, error: err.message });
            }
        }
        res.json({ shipmentId, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
