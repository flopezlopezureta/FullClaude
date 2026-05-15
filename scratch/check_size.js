const db = require('../db');

async function checkSize() {
    try {
        const { rows } = await db.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
        console.log(`Database Size: ${rows[0].size}`);
        
        const { rows: tableRows } = await db.query(`
            SELECT
                relname AS "table",
                pg_size_pretty(pg_total_relation_size(relid)) AS "size"
            FROM pg_catalog.pg_statio_user_tables
            ORDER BY pg_total_relation_size(relid) DESC;
        `);
        console.table(tableRows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
checkSize();
