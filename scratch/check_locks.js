const db = require('../db');

async function checkLocks() {
    try {
        console.log('--- Checking Active Queries ---');
        const { rows } = await db.query(`
            SELECT pid, state, query, duration
            FROM (
                SELECT pid, state, query, now() - query_start AS duration
                FROM pg_stat_activity
                WHERE state <> 'idle'
            ) AS active_queries
            ORDER BY duration DESC;
        `);
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
checkLocks();
