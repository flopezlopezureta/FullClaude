const db = require('./db');

async function findUser() {
    try {
        const { rows } = await db.query("SELECT id, name, email, integrations FROM users WHERE name ILIKE '%FACTORY%'");
        console.log('Usuarios encontrados:', JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

findUser();
