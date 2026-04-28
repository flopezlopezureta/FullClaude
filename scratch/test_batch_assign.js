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
        const finalDriverId = null; // Unassigning
        const newDeliveryDate = new Date();
        const targetStatus = 'RETIRADO';
        
        const updateQuery = `
            UPDATE packages 
            SET "driverId" = $1, 
                "estimatedDelivery" = $2, 
                "updatedAt" = $3, 
                status = $4, 
                "assignedAt" = $5,
                "isReassigned" = CASE 
                    WHEN $1::uuid IS NULL THEN false 
                    ELSE COALESCE("isReassigned", false) OR ("driverId" IS NOT NULL AND "driverId" != $1::uuid) 
                END
            WHERE id IN (${placeholders})
            RETURNING *
        `;
        
        console.log("Executing update with params:", [finalDriverId, newDeliveryDate, new Date(), targetStatus, null, ...packageIds]);
        
        // Mock query without DB connection for debugging locally
        // Instead of connecting, let's just log what we would do.
        // Wait, the error ONLY happens if we hit the DB.
        
    } catch (e) {
        console.error("Error during test:", e);
    }
    process.exit(0);
}

test();
