require('dotenv').config();
const db = require('../db');
async function debug() {
    try {
        const { rows } = await db.query('SELECT id, status, "driverId", "assignedAt", "createdAt" FROM packages WHERE "assignedAt" IS NOT NULL ORDER BY "assignedAt" DESC LIMIT 10');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
debug();
