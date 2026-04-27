
require('dotenv').config();
const db = require('../db');

async function migrate() {
    try {
        console.log("Adding alertChecked and alertCheckedAt to packages table...");
        await db.query(`
            ALTER TABLE packages 
            ADD COLUMN IF NOT EXISTS "alertChecked" BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS "alertCheckedAt" TIMESTAMP;
        `);
        console.log("Migration successful.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
