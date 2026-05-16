const dotenv = require('dotenv');
dotenv.config();
const db = require('./db');

async function check() {
    try {
        const query = `
            SELECT "driverId", count(*) 
            FROM packages 
            WHERE status NOT IN ('ENTREGADO', 'CANCELADO', 'DEVUELTO') 
            AND "assignedAt" < NOW() - INTERVAL '24 hours' 
            GROUP BY "driverId" 
            ORDER BY count DESC 
            LIMIT 5
        `;
        const res = await db.query(query);
        console.log('Drivers with old active packages:');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
