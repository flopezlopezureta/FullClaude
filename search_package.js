require('dotenv').config();
const { Pool } = require('pg');

async function debugSearch() {
    console.log('Connecting to:', process.env.DB_HOST);
    const pool = new Pool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 5432,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
    });

    try {
        const id = '46941596728';
        console.log(`Searching for ${id}...`);
        const { rows } = await pool.query('SELECT id, status, "meliOrderId", "meliFlexCode", "trackingId" FROM packages WHERE "meliOrderId" LIKE $1 OR "meliFlexCode" LIKE $1 OR id LIKE $1 OR "trackingId" LIKE $1', [`%${id}%`]);
        console.log('Found:', rows.length, 'rows');
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

debugSearch();
