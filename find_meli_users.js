require('dotenv').config();
const db = require('./db');

async function findMeliUsers() {
    try {
        const { rows } = await db.query("SELECT id, name, integrations FROM users WHERE role = 'CLIENT'");
        const meliUsers = rows.filter(u => u.integrations && (u.integrations.meli || u.integrations.accounts));
        console.log('Meli Users:', JSON.stringify(meliUsers, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findMeliUsers();
