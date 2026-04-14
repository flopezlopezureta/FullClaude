require('dotenv').config();
const db = require('./db');

async function migrate() {
    try {
        console.log("Adding columns shopify_client_id and shopify_client_secret to integration_settings table...");
        await db.query(`ALTER TABLE integration_settings ADD COLUMN IF NOT EXISTS shopify_client_id VARCHAR(255);`);
        await db.query(`ALTER TABLE integration_settings ADD COLUMN IF NOT EXISTS shopify_client_secret VARCHAR(255);`);
        console.log("Migration successful.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
