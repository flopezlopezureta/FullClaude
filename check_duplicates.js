const db = require('./db');

async function checkDuplicates() {
    try {
        const { rows } = await db.query(`
            SELECT 
                integrations->'meli'->>'userId' as meliUserId, 
                COUNT(*), 
                ARRAY_AGG(id) as userIds,
                ARRAY_AGG(name) as userNames
            FROM users 
            WHERE integrations->'meli' IS NOT NULL 
            GROUP BY integrations->'meli'->>'userId' 
            HAVING COUNT(*) > 1
        `);
        console.log("Duplicate Meli User IDs found:");
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkDuplicates();
