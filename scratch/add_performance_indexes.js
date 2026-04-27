
require('dotenv').config();
const db = require('../db');

async function migrate() {
    try {
        console.log("Adding performance indexes to packages table...");
        
        // Use individual queries to handle cases where indexes might already exist (IF NOT EXISTS)
        const queries = [
            'CREATE INDEX IF NOT EXISTS idx_packages_meliOrderId ON packages("meliOrderId")',
            'CREATE INDEX IF NOT EXISTS idx_packages_shopifyOrderId ON packages("shopifyOrderId")',
            'CREATE INDEX IF NOT EXISTS idx_packages_wooOrderId ON packages("wooOrderId")',
            'CREATE INDEX IF NOT EXISTS idx_packages_jumpsellerOrderId ON packages("jumpsellerOrderId")',
            'CREATE INDEX IF NOT EXISTS idx_packages_trackingId ON packages("trackingId")',
            'CREATE INDEX IF NOT EXISTS idx_packages_meliFlexCode ON packages("meliFlexCode")',
            'CREATE INDEX IF NOT EXISTS idx_packages_driverId ON packages("driverId")',
            'CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status)',
            'CREATE INDEX IF NOT EXISTS idx_packages_createdAt ON packages("createdAt")',
            'CREATE INDEX IF NOT EXISTS idx_packages_updatedAt ON packages("updatedAt")',
            'CREATE INDEX IF NOT EXISTS idx_tracking_events_packageId ON tracking_events("packageId")',
            'CREATE INDEX IF NOT EXISTS idx_packages_creatorId ON packages("creatorId")'
        ];

        for (const q of queries) {
            console.log(`Executing: ${q}`);
            await db.query(q);
        }

        console.log("Indexing migration successful.");
        process.exit(0);
    } catch (err) {
        console.error("Indexing migration failed:", err);
        process.exit(1);
    }
}

migrate();
