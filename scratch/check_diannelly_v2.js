require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function checkDiannelly() {
    try {
        console.log('--- Buscando en tabla users ---');
        // Usamos la query directa para evitar el pool de db.js si está fallando por timeout, 
        // pero db.js usa Pool, así que debería funcionar si la config es correcta.
        const { rows: users } = await db.query("SELECT id, name, email, role, status FROM users WHERE name ILIKE '%Diannelly%'");
        console.log(JSON.stringify(users, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkDiannelly();
