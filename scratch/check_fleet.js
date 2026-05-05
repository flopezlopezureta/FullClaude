
const db = require('./db');

async function debugFleet() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    console.log('--- DIAGNÓSTICO DE FLOTA ---');
    console.log('Fecha consultada:', today);

    try {
        const query = `
            SELECT 
                u.id, u.name, u.role, u.status,
                (SELECT COUNT(*) FROM packages WHERE "driverId" = u.id) as total_life_packages,
                (SELECT COUNT(*) FROM tracking_events WHERE "userId" = u.id AND (timestamp AT TIME ZONE 'America/Santiago')::date = $1::date) as events_today
            FROM users u
            WHERE u.name ILIKE '%Pruebas%' OR u.role = 'DRIVER';
        `;
        const res = await db.query(query, [today]);
        console.log('Resultados:', JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

debugFleet();
