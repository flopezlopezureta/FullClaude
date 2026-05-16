require('dotenv').config();
const { Pool } = require('pg');

async function check() {
    const pool1 = new Pool({
        host: '192.168.1.138',
        user: 'postgres',
        password: 'postgres',
        database: 'fullenvios',
        port: 5433
    });

    const pool2 = new Pool({
        host: '192.168.1.138',
        user: 'postgres',
        password: 'postgres',
        database: 'fullenvios_dev',
        port: 5433
    });

    try {
        const res1 = await pool1.query('SELECT COUNT(*) FROM packages');
        console.log('Production (fullenvios) package count:', res1.rows[0].count);

        const res2 = await pool2.query('SELECT COUNT(*) FROM packages');
        console.log('Test (fullenvios_dev) package count:', res2.rows[0].count);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
