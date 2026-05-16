require('dotenv').config();
const db = require('../db');
const timeService = require('../services/timeService');

async function testQuery() {
    const driverId = 'user-6f1a40f8-ccb1-499f-9e51-f3e6c7a5d998'; // Using a real driver ID from earlier debug
    const todayStr = await timeService.getLogicalDate();
    const { start, nextDayStart } = await timeService.getLogicalRange(todayStr, todayStr);
    
    const query = `
        SELECT p.id, p.status, p."driverId", p."assignedAt", p."createdAt"
        FROM packages p 
        WHERE p."driverId" = $1
        AND (
            p."createdAt" >= $2 AND p."createdAt" < $3 OR 
            p."assignedAt" >= $2 AND p."assignedAt" < $3 OR
            p."updatedAt" >= $2 AND p."updatedAt" < $3 OR
            p."estimatedDelivery" >= $2 AND p."estimatedDelivery" < $3
        )
    `;
    
    try {
        console.log(`Testing query for driver ${driverId} on date ${todayStr}`);
        console.log(`Range: ${start} to ${nextDayStart}`);
        const { rows } = await db.query(query, [driverId, start, nextDayStart]);
        console.log(`Found ${rows.length} packages:`);
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testQuery();
