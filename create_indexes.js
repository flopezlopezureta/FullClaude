require('dotenv').config();
const db = require('./db');

async function createIndexes() {
    console.log('--- Creating Indexes ---');
    try {
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_meli_order ON packages("meliOrderId")');
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_meli_flex ON packages("meliFlexCode")');
        await db.query('CREATE INDEX IF NOT EXISTS idx_packages_tracking ON packages("trackingId")');
        console.log('Indexes created successfully.');
    } catch (err) {
        console.error('Error creating indexes:', err.message);
    } finally {
        process.exit(0);
    }
}

createIndexes();
