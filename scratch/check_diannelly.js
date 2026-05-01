require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function checkDiannelly() {
    try {
        console.log('--- Buscando en tabla users ---');
        const { rows: users } = await db.query("SELECT id, name, email, role, \"accountId\" FROM users WHERE name ILIKE '%Diannelly%'");
        console.log(JSON.stringify(users, null, 2));

        console.log('\n--- Buscando en tabla drivers (si existe) ---');
        try {
            const { rows: drivers } = await db.query("SELECT id, name FROM drivers WHERE name ILIKE '%Diannelly%'");
            console.log(JSON.stringify(drivers, null, 2));
        } catch (e) {
            console.log('No existe la tabla drivers o error:', e.message);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDiannelly();
