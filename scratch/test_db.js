
require('dotenv').config();
const { Client } = require('pg');

async function test() {
    const client = new Client({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 5432,
        connectionTimeoutMillis: 5000,
    });

    try {
        await client.connect();
        console.log('Connected!');
        const res = await client.query('SELECT now()');
        console.log(res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('Connection failed:', err.message);
    }
}

test();
