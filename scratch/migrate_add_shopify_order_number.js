require('dotenv').config();
const db = require('../db');

async function runMigration() {
    try {
        console.log("Adding 'shopifyOrderNumber' column to 'packages' table...");
        await db.query(`
            ALTER TABLE packages ADD COLUMN IF NOT EXISTS "shopifyOrderNumber" TEXT;
        `);
        console.log("Column added successfully.");
    } catch (err) {
        console.error("Error running migration:", err);
    } finally {
        process.exit(0);
    }
}

runMigration();
