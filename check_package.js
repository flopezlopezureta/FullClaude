require('dotenv').config();
const db = require('./db');
async function run() {
    const id = '46943879843';
    try {
        const { rows } = await db.query('SELECT * FROM packages WHERE "meliOrderId" = $1 OR "meliFlexCode" = $1 OR id = $1', [id]);
        console.log('--- Packages ---');
        console.log(JSON.stringify(rows, null, 2));
        
        const { rows: events } = await db.query('SELECT * FROM tracking_events WHERE "packageId" IN (SELECT id FROM packages WHERE "meliOrderId" = $1 OR "meliFlexCode" = $1 OR id = $1)', [id]);
        console.log('--- Events ---');
        console.log(JSON.stringify(events, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
