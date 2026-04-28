require('dotenv').config();
const db = require('./db');

async function findClients() {
    console.log('--- Finding Clients ---');
    try {
        const { rows } = await db.query(`
            SELECT id, name, email, integrations 
            FROM users 
            WHERE name ILIKE '%kanino%' OR name ILIKE '%razas%'
        `);
        
        if (rows.length === 0) {
            console.log('No clients found matching "kanino" or "razas".');
        } else {
            rows.forEach(r => {
                console.log(`ID: ${r.id}, Name: ${r.name}, Email: ${r.email}`);
                console.log('Integrations:', JSON.stringify(r.integrations, null, 2));
                console.log('---');
            });
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

findClients();
