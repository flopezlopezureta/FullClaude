require('dotenv').config();
const db = require('../db');

async function debugMeliEvents() {
    try {
        console.log('--- DIAGNÓSTICO DE CIERRE ML ---');
        const query = `
            SELECT 
                p.id, 
                p."driverId",
                te.details, 
                te.timestamp as db_timestamp,
                te.timestamp AT TIME ZONE 'America/Santiago' as local_timestamp
            FROM tracking_events te 
            JOIN packages p ON te."packageId" = p.id 
            WHERE te.status = 'CIERRE_OFICIAL_ML' 
            ORDER BY te.id DESC 
            LIMIT 15
        `;
        const { rows } = await db.query(query);
        
        if (rows.length === 0) {
            console.log('No se encontraron eventos CIERRE_OFICIAL_ML hoy.');
        } else {
            console.table(rows.map(r => ({
                id: r.id,
                details: r.details,
                db_time: r.db_timestamp,
                local_time: r.local_timestamp
            })));
        }
    } catch (err) {
        console.error('Error durante el diagnóstico:', err);
    } finally {
        process.exit();
    }
}

debugMeliEvents();
