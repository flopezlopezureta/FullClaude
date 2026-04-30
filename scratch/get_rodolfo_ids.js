require('dotenv').config();
const db = require('../db');

async function getRodolfoIds() {
    try {
        const query = `
            SELECT id, "recipientName", "meliOrderId", "meliFlexCode"
            FROM packages 
            WHERE "driverId" IN (SELECT id FROM users WHERE name LIKE '%Rodolfo%') 
            AND status = 'ENTREGADO' 
            AND "updatedAt" > NOW() - INTERVAL '48 hours'
            LIMIT 5
        `;
        const { rows } = await db.query(query);
        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

getRodolfoIds();
