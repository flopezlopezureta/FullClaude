require('dotenv').config();
const db = require('../db');

async function checkCommunes() {
    try {
        const { rows } = await db.query('SELECT name, "isActive" FROM active_communes ORDER BY name ASC');
        console.log(`Found ${rows.length} communes in database:`);
        const active = rows.filter(r => r.isActive).map(r => r.name);
        const inactive = rows.filter(r => !r.isActive).map(r => r.name);
        
        console.log(`\nActive (${active.length}):\n${active.join(', ')}`);
        console.log(`\nInactive (${inactive.length}):\n${inactive.join(', ')}`);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

checkCommunes();
