
require('dotenv').config();
const db = require('../db');

async function check() {
    try {
        console.log('--- BUSCANDO EVENTOS DE HOY ---');
        const res = await db.query(`
            SELECT status, COUNT(*) 
            FROM tracking_events 
            WHERE timestamp::date = current_date 
            GROUP BY status
        `);
        console.table(res.rows);

        console.log('\n--- BUSCANDO CIERRES ML ESPECÍFICOS ---');
        const ml = await db.query(`
            SELECT te.timestamp, te.details, p.id, u.name as driver
            FROM tracking_events te
            JOIN packages p ON te."packageId" = p.id
            JOIN users u ON p."driverId" = u.id
            WHERE te.status = 'CIERRE_OFICIAL_ML'
            ORDER BY te.timestamp DESC
            LIMIT 10
        `);
        console.table(ml.rows);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
