require('dotenv').config();
const db = require('../db');

async function testQuery() {
    try {
        console.log("Checking Ignacio's packages in CLIENTE2 database...");
        
        // Find Ignacio's user ID
        const userRes = await db.query("SELECT id, name FROM users WHERE name ILIKE '%Ignacio%'");
        if (userRes.rows.length === 0) {
            console.log("Ignacio not found");
            return;
        }
        const ignacioId = userRes.rows[0].id;
        console.log(`Found Ignacio: ${ignacioId}`);

        // Count total delivered packages
        const totalDelivered = await db.query(`SELECT COUNT(*) as count FROM packages WHERE "driverId" = $1 AND status = 'ENTREGADO'`, [ignacioId]);
        console.log(`Total ENTREGADO for Ignacio: ${totalDelivered.rows[0].count}`);

        // Check date logic
        const startDate = '2026-05-01';
        const endDate = '2026-05-16';
        
        const start = '2026-05-01 02:00:00';
        const nextDayStart = '2026-05-17 02:00:00';

        const dateQuery = `
            SELECT COUNT(*) as count
            FROM packages p
            WHERE "driverId" = $1
            AND (
                p."createdAt" >= $2 AND p."createdAt" < $3 OR 
                p."assignedAt" >= $2 AND p."assignedAt" < $3 OR
                p."updatedAt" >= $2 AND p."updatedAt" < $3 OR
                p."estimatedDelivery" >= $2 AND p."estimatedDelivery" < $3
            )
            AND status = 'ENTREGADO'
        `;
        const matchRes = await db.query(dateQuery, [ignacioId, start, nextDayStart]);
        console.log(`Packages matching date query (createdAt/assignedAt/updatedAt/estimatedDelivery in May): ${matchRes.rows[0].count}`);

        // Also check what WOULD match if we use the old logic (without updatedAt)
        const oldDateQuery = `
            SELECT COUNT(*) as count
            FROM packages p
            WHERE "driverId" = $1
            AND (
                p."createdAt" >= $2 AND p."createdAt" < $3 OR 
                p."assignedAt" >= $2 AND p."assignedAt" < $3 OR
                p."estimatedDelivery" >= $2 AND p."estimatedDelivery" < $3
            )
            AND status = 'ENTREGADO'
        `;
        const oldMatchRes = await db.query(oldDateQuery, [ignacioId, start, nextDayStart]);
        console.log(`Packages matching OLD date query (without updatedAt): ${oldMatchRes.rows[0].count}`);

        // Check if there are any history events
        const historyQuery = `
            SELECT COUNT(*) as count
            FROM tracking_events
            WHERE "packageId" IN (
                SELECT id FROM packages WHERE "driverId" = $1 AND status = 'ENTREGADO'
            )
        `;
        const histRes = await db.query(historyQuery, [ignacioId]);
        console.log(`Total history events for Ignacio's delivered packages: ${histRes.rows[0].count}`);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

testQuery();
