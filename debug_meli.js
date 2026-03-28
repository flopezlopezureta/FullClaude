require('dotenv').config({path: require('path').join(__dirname, '.env')});
const db = require('./db');
const https = require('https');

const makeMeliRequest = (options) => {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) { resolve(data); }
            });
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
};

const makeMeliGetRequest = (path, accessToken) => makeMeliRequest({
    hostname: 'api.mercadolibre.com', path, method: 'GET', headers: { 'Authorization': `Bearer ${accessToken}` }
});

async function main() {
    try {
        const orderId = '2000015727103370';
        
        const { rows: users } = await db.query("SELECT id, integrations FROM users WHERE integrations->'meli' IS NOT NULL");
        
        if (users.length === 0) {
            console.log("No ML integrations found.");
            process.exit(1);
        }

        for (const user of users) {
             const token = user.integrations.meli.accessToken;
             const order = await makeMeliGetRequest(`/orders/${orderId}`, token);
             
             if (order.id) {
                  console.log(`\n=== DATOS DE LA ORDEN ${orderId} ===`);
                  console.log(`Modo de Envío (shipping.mode): ${order.shipping?.mode || 'N/A'}`);
                  
                  if (order.shipping?.id) {
                       const shipment = await makeMeliGetRequest(`/shipments/${order.shipping.id}`, token);
                       console.log(`\n=== DATOS DEL ENVÍO ${order.shipping.id} ===`);
                       console.log(`Estado Nativo ML (status): ${shipment.status}`);
                       console.log(`Subestado ML (substatus): ${shipment.substatus || 'N/A'}`);
                       console.log(`Tipo de logística (logistic_type): ${shipment.logistic_type || 'N/A'}`);
                  }
                  
                  const { rows: settingsRows } = await db.query('SELECT "meliAutoImport" FROM system_settings WHERE id = 1');
                  console.log(`\n=== CONFIGURACIÓN DE TU SISTEMA ===`);
                  console.log(`Auto Importar Habilitado: ${settingsRows[0]?.meliAutoImport ? 'SÍ' : 'NO'}`);
                  process.exit(0);
             }
        }
        console.log("No se pudo obtener la orden con los tokens actuales.");
    } catch(e) {
        console.error(e);
    }
    process.exit(1);
}

main();
