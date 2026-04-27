require('dotenv').config();
const db = require('../db');

async function test() {
    try {
        const { rows } = await db.query('SELECT * FROM packages LIMIT 1');
        if (rows.length === 0) {
            console.log("No packages to test with.");
            process.exit(0);
        }
        
        const pkg = rows[0];
        const packageIds = [pkg.id];
        const placeholders = packageIds.map((_, i) => `$${i + 6}`).join(', ');
        const finalDriverId = '123e4567-e89b-12d3-a456-426614174000'; // dummy UUID
        const newDeliveryDate = new Date();
        const targetStatus = 'ASIGNADO';
        
        const searchPlaceholders = packageIds.map((_, i) => `$${i + 1}`).join(', ');
        const { rows: currentStates } = await db.query(`SELECT id, "driverId" FROM packages WHERE id IN (${searchPlaceholders})`, packageIds);
        console.log("Current states fetched:", currentStates);

        const updateQuery = `
            UPDATE packages 
            SET "driverId" = $1, 
                "estimatedDelivery" = $2, 
                "updatedAt" = $3, 
                status = $4, 
                "assignedAt" = $5,
                "isReassigned" = CASE 
                    WHEN $1 IS NULL THEN false 
                    ELSE "isReassigned" OR ("driverId" IS NOT NULL AND "driverId" != $1) 
                END
            WHERE id IN (${placeholders})
            RETURNING *
        `;
        
        console.log("Executing update with params:", [finalDriverId, newDeliveryDate, new Date(), targetStatus, new Date(), ...packageIds]);
        // Use a transaction and rollback so we don't mess up data
        const client = await db.getClient();
        await client.query('BEGIN');
        const updateResult = await client.query(updateQuery, [finalDriverId, newDeliveryDate, new Date(), targetStatus, new Date(), ...packageIds]);
        console.log("Update result:", updateResult.rows);
        await client.query('ROLLBACK');
        client.release();
        
        console.log("Test completed successfully without errors.");
    } catch (e) {
        console.error("Error during test:", e);
    }
    process.exit(0);
}

test();
