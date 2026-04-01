const db = require('../db');

async function check() {
  try {
    console.log("Checking recent MELI packages...");
    const res = await db.query('SELECT id, source, "meliFlexCode", "meliOrderId", status, "createdAt" FROM packages WHERE source = \'MERCADO_LIBRE\' ORDER BY "createdAt" DESC LIMIT 10');
    console.table(res.rows);
    
    console.log("\nChecking ML Integrations...");
    const users = await db.query("SELECT id, name, email FROM users WHERE integrations->'meli' IS NOT NULL");
    console.table(users.rows);
    
  } catch (err) {
    console.error("Database check failed:", err.message);
  } finally {
    process.exit(0);
  }
}
check();
