const db = require('./db');
require('dotenv').config();

async function findMeliUsers() {
    try {
        const { rows } = await db.query("SELECT id, name FROM users WHERE integrations->'meli' IS NOT NULL LIMIT 5");
        console.log('\n--- Clientes con Integración Mercado Libre ---\n');
        if (rows.length === 0) {
            console.log('No se encontraron clientes con integración ML activa.');
        } else {
            rows.forEach(user => {
                console.log(`Nombre: ${user.name}`);
                console.log(`ID: ${user.id}`);
                console.log(`URL de Diagnóstico: https://dev.selcom.cl/api/integrations/debug-poll/${user.id}?secret=fullenvios_debug`);
                console.log('-------------------------------------------\n');
            });
        }
    } catch (err) {
        console.error('Error querying DB:', err.message);
    } finally {
        process.exit();
    }
}

findMeliUsers();
