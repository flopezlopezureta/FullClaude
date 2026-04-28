
const fs = require('fs');
const db = require('./db');

async function importUsers() {
    console.log('Iniciando importación de usuarios...');
    const data = fs.readFileSync('/users_data.txt', 'utf8');
    const lines = data.split('\n').filter(l => l.trim() !== '' && l !== '\\.');

    const columns = [
        'id', 'name', 'email', 'phone', 'password', 'role', 'status', 
        'assignedDriverId', 'lastAssignmentTimestamp', 'rut', 'address', 
        'pickupAddress', 'storesInfo', 'pricing', 'clientIdentifier', 
        'pickupCost', 'billingName', 'billingRut', 'billingAddress', 
        'billingCommune', 'billingGiro', 'invoices', 'personalRut', 
        'hasCompany', 'companyName', 'companyRut', 'companyAddress', 
        'licenseExpiry', 'licenseType', 'backgroundCheckNotes', 'vehicles', 
        'driverPermissions', 'latitude', 'longitude', 'lastLocationUpdate', 
        'integrations'
    ];

    let count = 0;
    for (const line of lines) {
        const fields = line.split('\t');
        
        // Limpiar campos: \N -> null, t -> true, f -> false
        const values = fields.slice(0, 36).map(f => {
            const val = f.trim();
            if (val === '\\N') return null;
            if (val === 't') return true;
            if (val === 'f') return false;
            if (val === '') return null;
            return val;
        });

        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO users (${columns.map(c => `"${c}"`).join(', ')}) 
                       VALUES (${placeholders}) 
                       ON CONFLICT (email) DO UPDATE SET 
                       ${columns.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ')}`;
        
        try {
            await db.query(query, values);
            count++;
        } catch (err) {
            console.error(`Error importando usuario ${values[2]}:`, err.message);
        }
    }

    console.log(`✅ Importación finalizada. ${count} usuarios procesados.`);
    process.exit();
}

importUsers();
