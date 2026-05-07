const db = require('../db');

async function analyze() {
    try {
        const pkgCount = await db.query('SELECT count(*) FROM packages');
        const userCount = await db.query('SELECT count(*) FROM users');
        const eventCount = await db.query('SELECT count(*) FROM tracking_events');
        console.log('Packages:', pkgCount.rows[0].count);
        console.log('Users:', userCount.rows[0].count);
        console.log('Tracking Events:', eventCount.rows[0].count);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
analyze();
