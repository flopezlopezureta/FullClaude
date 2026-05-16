const { Pool } = require('pg');
const pool = new Pool({
    host: '192.168.1.138',
    user: 'postgres',
    password: 'postgres',
    database: 'fullenvios',
    port: 5433
});

async function run() {
    try {
        const { rows } = await pool.query('SELECT id, status, "createdAt", "assignedAt", "updatedAt" FROM packages ORDER BY "createdAt" DESC LIMIT 20');
        console.table(rows);
        
        const { rows: summary } = await pool.query('SELECT status, COUNT(*) FROM packages GROUP BY status');
        console.log('Status Summary:');
        console.table(summary);
        
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
