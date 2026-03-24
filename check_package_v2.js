const db = require('./db');

async function checkPackage() {
    const meliOrderId = '2000015676219900';
    const meliFlexCode = '46712604447';

    console.log(`Buscando paquete con meliOrderId: ${meliOrderId} o meliFlexCode: ${meliFlexCode}...`);

    try {
        const res = await db.query(
            `SELECT p.*, u.name as client_name 
             FROM packages p 
             LEFT JOIN users u ON p."creatorId" = u.id 
             WHERE p."meliOrderId" = $1 OR p."meliFlexCode" = $2 OR p."trackingId" = $2`,
            [meliOrderId, meliFlexCode]
        );

        if (res.rows.length > 0) {
            console.log('✅ Paquete encontrado:', JSON.stringify(res.rows, null, 2));
        } else {
            console.log('❌ Paquete no encontrado en la base de datos.');
            
            // Buscar por parte del ID por si acaso
            const partialRes = await db.query(
                `SELECT id, "meliOrderId", "meliFlexCode", "trackingId" FROM packages WHERE "meliOrderId" LIKE $1 OR "meliFlexCode" LIKE $1 OR "trackingId" LIKE $1`,
                [`%${meliFlexCode.slice(-6)}%`]
            );
            if (partialRes.rows.length > 0) {
                console.log('🔍 Coincidencias parciales encontradas:', JSON.stringify(partialRes.rows, null, 2));
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkPackage();
