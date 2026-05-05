require('dotenv').config();
const db = require('./db');

async function checkStatus() {
    try {
        const query = `
            SELECT status, count(*) 
            FROM packages 
            WHERE ("createdAt" >= '2026-05-01' AND "createdAt" <= '2026-05-03 23:59:59') 
               OR ("updatedAt" >= '2026-05-01' AND "updatedAt" <= '2026-05-03 23:59:59') 
            GROUP BY status 
            ORDER BY count DESC;
        `;
        const result = await db.query(query);
        console.log('Status Breakdown:');
        console.table(result.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkStatus();
