require('dotenv').config();
const db = require('./db');

async function debugDriverDiscrepancy() {
    try {
        // 1. Buscar al conductor
        const { rows: drivers } = await db.query("SELECT id, name FROM users WHERE name ILIKE '%Camila Palma%'");
        if (drivers.length === 0) {
            console.log('Driver not found');
            process.exit(0);
        }
        
        const driver = drivers[0];
        console.log(`Checking driver: ${driver.name} (${driver.id})`);

        // 2. Ver paquetes asignados actualmente (que no estén entregados ni cancelados)
        const { rows: packages } = await db.query(`
            SELECT id, "meliOrderId", "meliFlexCode", status, "updatedAt", "createdAt"
            FROM packages 
            WHERE "driverId" = $1 
            AND status NOT IN ('ENTREGADO', 'CANCELADO', 'DEVUELTO')
            ORDER BY "createdAt" DESC
        `, [driver.id]);

        console.log(`Current active packages in DB: ${packages.length}`);
        console.log(JSON.stringify(packages, null, 2));

        // 3. Ver si hay duplicados por meliOrderId
        const { rows: duplicates } = await db.query(`
            SELECT "meliOrderId", COUNT(*) 
            FROM packages 
            WHERE "driverId" = $1 
            AND "meliOrderId" IS NOT NULL
            GROUP BY "meliOrderId" 
            HAVING COUNT(*) > 1
        `, [driver.id]);
        
        if (duplicates.length > 0) {
            console.log('DUPLICATES FOUND:', JSON.stringify(duplicates, null, 2));
        } else {
            console.log('No duplicates found by meliOrderId for this driver.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugDriverDiscrepancy();
