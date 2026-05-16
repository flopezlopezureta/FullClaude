const dotenv = require('dotenv');
dotenv.config();
const db = require('./db');
const timeService = require('./services/timeService');

async function simulate() {
    try {
        const driverId = 'user-3613cb40-fa28-44c4-b666-5566d0fcc842';
        const todayStr = await timeService.getLogicalDate();
        const { start, nextDayStart } = await timeService.getLogicalRange(todayStr, todayStr);
        
        console.log('Simulating request for Driver:', driverId);
        console.log('Today:', todayStr);
        
        // This is the logic from routes/packages.js
        const query = `
            SELECT count(*) 
            FROM packages p
            WHERE p."driverId" = $1
            AND (
                (
                    p."createdAt" >= $2 AND p."createdAt" < $3 OR 
                    p."assignedAt" >= $2 AND p."assignedAt" < $3 OR
                    p."updatedAt" >= $2 AND p."updatedAt" < $3 OR
                    p."estimatedDelivery" >= $2 AND p."estimatedDelivery" < $3
                ) OR (
                    p.status NOT IN ('ENTREGADO', 'DEVUELTO', 'CANCELADO')
                )
            )
        `;
        
        const res = await db.query(query, [driverId, start, nextDayStart]);
        console.log('Server would return:', res.rows[0].count, 'packages');
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
simulate();
