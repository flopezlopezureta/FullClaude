const db = require('./db');

async function checkPackage() {
    const meliOrderId = '2000015676219900';
    const trackingId = '46712604447';

    console.log(`Buscando paquete con meliOrderId: ${meliOrderId} o trackingId: ${trackingId}...`);

    try {
        const res = await db.query(
            `SELECT * FROM packages WHERE "meliOrderId" = $1 OR "trackingId" = $2 OR "meliFlexCode" = $2`,
            [meliOrderId, trackingId]
        );

        if (res.rows.length > 0) {
            console.log('✅ Paquete encontrado:', JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log('❌ Paquete no encontrado en la base de datos.');
        }

        // También buscar por nombre de cliente
        const clientRes = await db.query(
            `SELECT id, name, email, integrations FROM users WHERE name ILIKE '%Factorynet%'`
        );

        if (clientRes.rows.length > 0) {
            console.log('✅ Cliente encontrado:', JSON.stringify(clientRes.rows[0], null, 2));
        } else {
            console.log('❌ Cliente "Factorynet" no encontrado en la base de datos.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkPackage();
