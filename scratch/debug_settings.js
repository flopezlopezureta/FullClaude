require('dotenv').config();
const db = require('../db');
async function debug() {
    try {
        const { rows } = await db.query('SELECT "timezone", "logicalDayCutoffHour" FROM system_settings WHERE id = 1');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
debug();
