const db = require('../db');

async function checkPackage() {
    const packId = '12291088309';

    console.log(`Buscando paquete con packId: ${packId}...`);

    try {
        const res = await db.query(
            `SELECT id, status, "recipientName", "meliOrderId", "meliFlexCode", "trackingId", "driverId", "creatorId" 
             FROM packages 
             WHERE "meliFlexCode" = $1 OR "meliOrderId" = $1 OR "trackingId" = $1 OR id = $1`,
            [packId]
        );

        if (res.rows.length > 0) {
            console.log('✅ Paquete encontrado:', JSON.stringify(res.rows, null, 2));
        } else {
            console.log('❌ Paquete no encontrado en la base de datos.');
            
            // Buscar coincidencias parciales por si acaso
            const partial = await db.query(
                `SELECT id, "recipientName", "meliFlexCode" FROM packages WHERE "meliFlexCode" LIKE $1 OR "meliOrderId" LIKE $1 LIMIT 5`,
                [`%${packId.slice(-6)}%`]
            );
            if (partial.rows.length > 0) {
                console.log('🔍 Coincidencias parciales:', JSON.stringify(partial.rows, null, 2));
            }
        }

        // Buscar clientes con integración ML para ver si el polling está funcionando
        const clients = await db.query(
            `SELECT id, name, integrations->'meli'->'userId' as "meliUser" FROM users WHERE integrations->'meli' IS NOT NULL`
        );
        console.log('📋 Clientes ML detectados:', clients.rows.length);
        clients.rows.forEach(c => console.log(` - ${c.name} (ML User: ${c.meliUser})`));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkPackage();
