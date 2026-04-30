require('dotenv').config();
const db = require('../db');

async function migrate() {
    try {
        console.log("Adding meliDeliveredAt column to packages table...");
        await db.query('ALTER TABLE packages ADD COLUMN IF NOT EXISTS "meliDeliveredAt" TIMESTAMP;');
        console.log("Column added successfully.");
    } catch (err) {
        console.error("Migration error:", err);
    } finally {
        process.exit();
    }
}

migrate();
