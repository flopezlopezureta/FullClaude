
const db = require('./db');
require('dotenv').config();

async function testConn() {
    console.log("Testing DB Connection...");
    try {
        const res = await db.query("SELECT COUNT(*)::int FROM users");
        console.log("Connection OK. Total users:", res.rows[0].count);
    } catch (err) {
        console.error("Connection FAILED:", err.message);
    } finally {
        process.exit(0);
    }
}
testConn();
