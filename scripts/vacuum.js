const db = require('../db');
require('dotenv').config();

async function run() {
  console.log("Starting Database Maintenance: VACUUM ANALYZE...");
  const start = Date.now();
  
  try {
    console.log("1. Running VACUUM ANALYZE on 'packages' table...");
    await db.query('VACUUM ANALYZE packages');
    console.log("✓ 'packages' table optimized successfully.");

    console.log("2. Running VACUUM ANALYZE on 'tracking_events' table...");
    await db.query('VACUUM ANALYZE tracking_events');
    console.log("✓ 'tracking_events' table optimized successfully.");
    
    console.log(`\nDatabase maintenance completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during database maintenance:", err.message);
    process.exit(1);
  }
}

run();
