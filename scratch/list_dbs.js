require('dotenv').config();
const { Client } = require('pg');

async function listDatabases() {
    const client = new Client({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'postgres', // Connect to default postgres DB to list others
        port: process.env.DB_PORT || 5432,
    });

    try {
        await client.connect();
        const res = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
        console.log('Databases available:');
        res.rows.forEach(row => console.log(`- ${row.datname}`));
    } catch (err) {
        console.error('Error connecting to postgres:', err.message);
    } finally {
        await client.end();
    }
}

listDatabases();
