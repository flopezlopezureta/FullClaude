require('dotenv').config();
const db = require('../db');

async function check() {
    try {
        console.log('--- Paquetes con fecha futura (mañana) ---');
        const { rows: pkgs } = await db.query(`
            SELECT id, status, "createdAt", "updatedAt", "assignedAt", "estimatedDelivery", source 
            FROM packages 
            WHERE "createdAt" >= '2026-05-06' 
               OR "assignedAt" >= '2026-05-06'
               OR "estimatedDelivery" >= '2026-05-06'
            LIMIT 20
        `);
        console.table(pkgs);

        console.log('--- Eventos de tracking futuros ---');
        const { rows: events } = await db.query(`
            SELECT id, "packageId", status, timestamp 
            FROM tracking_events 
            WHERE timestamp >= '2026-05-06'
            LIMIT 20
        `);
        console.table(events);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
