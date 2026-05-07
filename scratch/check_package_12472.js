const db = require('../db');

async function checkPackage() {
    try {
        const id = '#12472';
        const res = await db.query('SELECT * FROM packages WHERE id = $1', [id]);
        console.log('Package Data:', JSON.stringify(res.rows[0], null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
checkPackage();
