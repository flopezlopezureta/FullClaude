require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
});

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log("Columns in 'users' table:");
        res.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type}`);
        });
    } catch (err) {
        console.error("Error checking schema:", err);
    } finally {
        await pool.end();
    }
}

checkSchema();
