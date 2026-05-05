require('dotenv').config();
const db = require('../db');

async function checkSchema() {
    try {
        const res = await db.query(`
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
        process.exit(0);
    }
}

checkSchema();
