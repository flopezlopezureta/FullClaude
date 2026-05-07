require('dotenv').config();
const db = require('./db');

async function createIndexes() {
    console.log('--- Creating Indexes ---');
    try {
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_meli_order ON packages("meliOrderId")');
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_meli_flex ON packages("meliFlexCode")');
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_tracking ON packages("trackingId")');
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_creator ON packages("creatorId")');
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_driver ON packages("driverId")');
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_status ON packages("status")');
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_est_delivery ON packages("estimatedDelivery")');
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_updated ON packages("updatedAt")');
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_shopify_id ON packages("shopifyOrderId")');
        console.log('Indexes created successfully.');
    } catch (err) {
        console.error('Error creating indexes:', err.message);
    } finally {
        process.exit(0);
    }
}

createIndexes();
