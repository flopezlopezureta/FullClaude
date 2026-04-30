require('dotenv').config();
const db = require('../db');
const https = require('https');

async function inspectMeliShipment(packageId) {
    try {
        console.log(`--- INSPECCIÓN TÉCNICA DE PAQUETE: ${packageId} ---`);
        
        // 1. Obtener datos del paquete y token
        const { rows } = await db.query('SELECT "meliOrderId", "meliFlexCode", "creatorId", "sourceAccountId" FROM packages WHERE id = $1', [packageId]);
        if (rows.length === 0) return console.log('Paquete no encontrado.');
        
        const pkg = rows[0];
        const shipmentId = pkg.meliFlexCode || pkg.meliOrderId;
        
        // Obtener token (usando la lógica del servicio)
        const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [pkg.creatorId]);
        let integrations = userRows[0].integrations || {};
        let meliIntegration = integrations.meli || (integrations.accounts && integrations.accounts.find(a => a.type === 'MERCADO_LIBRE')?.credentials);
        
        if (!meliIntegration || !meliIntegration.accessToken) return console.log('No se encontró token de Meli.');

        // 2. Consultar API de Meli directamente
        const options = {
            hostname: 'api.mercadolibre.com',
            path: `/shipments/${shipmentId}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${meliIntegration.accessToken}` }
        };

        const shipment = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => resolve(JSON.parse(data)));
            });
            req.on('error', reject);
            req.end();
        });

        // 3. Mostrar TODAS las fechas posibles
        console.log('\n--- FECHAS DETECTADAS EN LA API ---');
        console.log('ID Envío:', shipment.id);
        console.log('Estado:', shipment.status);
        console.log('Subestado:', shipment.substatus);
        console.log('-----------------------------------');
        console.log('date_created:     ', shipment.date_created);
        console.log('date_first_printed:', shipment.date_first_printed);
        console.log('date_delivered:   ', shipment.date_delivered);
        console.log('delivered_date:   ', shipment.delivered_date);
        console.log('status_history:   ', JSON.stringify(shipment.status_history, null, 2));
        console.log('-----------------------------------');

    } catch (err) {
        console.error('Error en inspección:', err);
    } finally {
        process.exit();
    }
}

// Tomamos el ID del primer paquete de Mercado Libre que encontremos entregado hoy
db.query("SELECT id FROM packages WHERE source = 'MERCADO_LIBRE' AND status = 'ENTREGADO' AND \"updatedAt\" > NOW() - INTERVAL '24 hours' LIMIT 1")
    .then(r => {
        if (r.rows.length > 0) inspectMeliShipment(r.rows[0].id);
        else { console.log('No hay paquetes entregados hoy para inspeccionar.'); process.exit(); }
    });
