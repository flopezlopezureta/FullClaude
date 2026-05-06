require('dotenv').config();
const db = require('../db');

async function check() {
    try {
        const { rows } = await db.query("SELECT NOW() as db_now, CURRENT_DATE as db_date, CURRENT_SETTING('timezone') as db_tz");
        console.log('DB Data:', rows[0]);
        console.log('Node Now:', new Date().toString());
        console.log('Node ISO:', new Date().toISOString());
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
