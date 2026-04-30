
require('dotenv').config();
const db = require('./db');
const meliPollingService = require('./services/meliPollingService');
const https = require('https');

// Helper for ML API
const makeMeliGetRequest = (path, accessToken) => {
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
                    const parsed = JSON.parse(data);
                    if (res.statusCode === 200) resolve(parsed);
                    else reject(parsed);
                } catch (e) { reject(data); }
            });
        });
        req.on('error', reject);
        req.end();
    });
};

async function repair() {
    try {
        console.log('--- REPARACIÓN RETROACTIVA DE CIERRES ML ---');
        
        // Find packages delivered today (or yesterday) that don't have CIERRE_OFICIAL_ML
        const query = `
            SELECT p.id, p."meliOrderId", p."meliFlexCode", p."creatorId", p."sourceAccountId"
            FROM packages p
            LEFT JOIN tracking_events te ON p.id = te."packageId" AND te.status = 'CIERRE_OFICIAL_ML'
            WHERE p.status = 'ENTREGADO' 
            AND p.source = 'MERCADO_LIBRE'
            AND p."updatedAt"::date >= current_date - interval '1 day'
            AND te.id IS NULL
        `;
        
        const { rows: pending } = await db.query(query);
        console.log(`Encontrados ${pending.length} paquetes para sincronizar.`);

        for (const pkg of pending) {
            try {
                const shipmentId = pkg.meliFlexCode || pkg.meliOrderId;
                console.log(`Procesando ${pkg.id} (Shipment: ${shipmentId})...`);
                
                const accessToken = await meliPollingService.getValidMeliToken(pkg.creatorId, pkg.sourceAccountId);
                if (!accessToken) {
                    console.error(`  - No se pudo obtener token para el cliente ${pkg.creatorId}`);
                    continue;
                }

                const details = await makeMeliGetRequest(`/shipments/${shipmentId}`, accessToken);
                if (details.status_history) {
                    const deliveredEvent = details.status_history.find(h => h.status === 'delivered');
                    if (deliveredEvent && deliveredEvent.date) {
                        const meliTime = new Date(deliveredEvent.date);
                        
                        await db.query(
                            'INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
                            [pkg.id, 'CIERRE_OFICIAL_ML', 'Mercado Libre API (Retroactivo)', `Hora recuperada: ${meliTime.toISOString()}`, meliTime]
                        );
                        console.log(`  ✅ Sincronizado: ${meliTime.toLocaleTimeString()}`);
                    } else {
                        console.log(`  - No se encontró evento 'delivered' en Meli para ${shipmentId}`);
                    }
                }
            } catch (err) {
                console.error(`  ❌ Error en ${pkg.id}:`, err.message || err);
            }
        }

        console.log('\n--- REPARACIÓN COMPLETADA ---');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

repair();
