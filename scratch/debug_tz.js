const db = require('./db');

async function debugTimezone() {
    try {
        const query = `
            SELECT 
                id, 
                status, 
                timestamp as raw_timestamp,
                (timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago') as converted_chile,
                NOW() as db_now,
                EXTRACT(HOUR FROM (timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago')) as extracted_hour
            FROM tracking_events
            WHERE status = 'ENTREGADO'
            ORDER BY timestamp DESC
            LIMIT 5;
        `;
        const res = await db.query(query);
        console.log("=== DEBUG TIMEZONE ===");
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugTimezone();
