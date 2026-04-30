require('dotenv').config();
const db = require('../db');

async function quickNormalize() {
    console.log('--- Iniciando Limpieza Relámpago ---');
    try {
        const query = `
            UPDATE packages 
            SET 
                "recipientCommune" = UPPER(TRIM(translate("recipientCommune", 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))), 
                "recipientCity" = UPPER(TRIM(translate("recipientCity", 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))) 
            WHERE "recipientCommune" IS NOT NULL
        `;
        
        const result = await db.query(query);
        console.log(`Limpieza terminada: ${result.rowCount} registros unificados.`);
        
    } catch (error) {
        console.error('Error durante la limpieza:', error);
    } finally {
        process.exit();
    }
}

quickNormalize();
