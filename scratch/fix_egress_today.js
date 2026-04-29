require('dotenv').config();
const db = require('../db');

async function fixTodayEgress() {
    try {
        // Fecha de hoy en Chile
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
        console.log(`Buscando paquetes de hoy (${today}) sin fecha de egreso...`);

        // Actualizamos assignedAt usando updatedAt para los paquetes que se asignaron hoy pero no marcaron assignedAt
        const query = `
            UPDATE packages 
            SET "assignedAt" = "updatedAt" 
            WHERE "driverId" IS NOT NULL 
            AND "assignedAt" IS NULL 
            AND "updatedAt"::text LIKE $1
        `;
        
        const res = await db.query(query, [today + '%']);
        console.log(`✅ ¡Hecho! Se han reparado ${res.rowCount} paquetes.`);
        console.log('Ahora deberían aparecer correctamente en el filtro de EGRESO.');
        
        process.exit(0);
    } catch (err) {
        console.error('Error reparando datos:', err);
        process.exit(1);
    }
}

fixTodayEgress();
