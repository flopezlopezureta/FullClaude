require('dotenv').config();
const db = require('../db');

async function test() {
    try {
        const res = await db.query(`SELECT count(*) FROM packages WHERE "driverId" = (SELECT id FROM users WHERE name ILIKE '%Ignacio%' LIMIT 1)`);
        console.log('Total packages in DB for Ignacio:', res.rows[0].count);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
