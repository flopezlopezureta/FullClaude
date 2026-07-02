const { Pool } = require('pg');

async function run() {
    const pool = new Pool({
        host: '192.168.1.138',
        user: 'postgres',
        password: 'postgres',
        port: 5433,
        database: 'fullenvios'
    });

    try {
        const { rows: packageCols } = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'packages'
        `);
        console.log('Columns in "packages" table:');
        console.log(packageCols.map(r => r.column_name).sort().join(', '));

        const { rows: trackingCols } = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tracking_events'
        `);
        console.log('\nColumns in "tracking_events" table:');
        console.log(trackingCols.map(r => r.column_name).sort().join(', '));
    } catch (e) {
        console.error('Error querying columns:', e.message);
    } finally {
        await pool.end();
    }
}

run();
