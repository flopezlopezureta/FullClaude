const db = require('./db');

async function migrate() {
    try {
        await db.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS "timeFormat" VARCHAR(10) DEFAULT '12h'`);
        console.log("Migration successful");
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

migrate();
