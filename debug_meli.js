require('dotenv').config();
const db = require('./db');
const https = require('https');

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
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
};

async function getValidMeliToken(clientId) {
    const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [clientId]);
    if (userRows.length === 0) return null;
    let meliIntegration = userRows[0].integrations?.meli;
    if (!meliIntegration) return null;

    if (Date.now() >= meliIntegration.expiresAt) {
        const { rows: settingsRows } = await db.query('SELECT meli_app_id, meli_client_secret FROM integration_settings WHERE id = 1');
        if (settingsRows.length === 0) return null;
        const { meli_app_id, meli_client_secret } = settingsRows[0];
        
        const postData = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: meli_app_id,
            client_secret: meli_client_secret,
            refresh_token: meliIntegration.refreshToken
        }).toString();

        const refreshed = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.mercadolibre.com',
                path: '/oauth/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => resolve(JSON.parse(data)));
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        meliIntegration.accessToken = refreshed.access_token;
        meliIntegration.refreshToken = refreshed.refresh_token;
        meliIntegration.expiresAt = Date.now() + (refreshed.expires_in * 1000);
        await db.query('UPDATE users SET integrations = $1 WHERE id = $2', [JSON.stringify({ ...userRows[0].integrations, meli: meliIntegration }), clientId]);
    }
    return meliIntegration.accessToken;
}

async function run() {
    const shipmentId = '46943879843';
    console.log(`Searching for Shipment ID: ${shipmentId}...`);
    
    try {
        const { rows: users } = await db.query("SELECT id, name FROM users WHERE integrations->'meli' IS NOT NULL");
        console.log(`Found ${users.length} clients with ML integration.`);
        
        for (const user of users) {
            console.log(`Checking client: ${user.name} (${user.id})...`);
            try {
                const token = await getValidMeliToken(user.id);
                if (!token) {
                    console.log(`  - No valid token for ${user.name}`);
                    continue;
                }
                
                const shipment = await makeMeliRequest(`/shipments/${shipmentId}`, token);
                if (shipment.id) {
                    console.log('SUCCESS! Found shipment details:');
                    console.log(JSON.stringify(shipment, null, 2));
                    process.exit(0);
                } else {
                    console.log(`  - Not found for this client (ML Error: ${shipment.message || 'Unknown'})`);
                }
            } catch (err) {
                console.error(`  - Error checking client ${user.name}:`, err.message);
            }
        }
        console.log('Shipment not found in any of the integrated accounts.');
    } catch (e) {
        console.error('Fatal error:', e.message);
    } finally {
        process.exit();
    }
}

run();
