require('dotenv').config();
const db = require('./db');

async function findPackage() {
    try {
        const id = '46941596728';
        const { rows } = await db.query('SELECT * FROM packages WHERE "meliOrderId" = $1 OR "meliFlexCode" = $1', [id]);
        console.log('Result:', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findPackage();
