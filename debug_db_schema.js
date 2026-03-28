const { Client } = require('pg');
require('dotenv').config();

async function checkSchema() {
    const client = new Client({
        connectionString: `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
    });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'packages';
        `);
        console.log("Columns in 'packages' table:");
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });
    } catch (err) {
        console.error("Error checking schema:", err);
    } finally {
        await client.end();
    }
}

checkSchema();
