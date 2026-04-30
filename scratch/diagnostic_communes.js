require('dotenv').config();
const db = require('../db');

async function diagnosticCommunes() {
    try {
        console.log("--- DIAGNÓSTICO DE INTEGRIDAD DE COMUNAS ---");
        
        const query = `
            SELECT "recipientCommune", COUNT(*) as count
            FROM packages
            GROUP BY "recipientCommune"
            ORDER BY "recipientCommune" ASC;
        `;
        
        const result = await db.query(query);
        
        console.log(`Total de variantes encontradas: ${result.rows.length}`);
        console.log("\nVariantes detectadas (Muestra):");
        
        const duplicates = {};
        result.rows.forEach(row => {
            const normalized = (row.recipientCommune || '').trim().toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
            
            if (!duplicates[normalized]) duplicates[normalized] = [];
            duplicates[normalized].push({ original: row.recipientCommune, count: parseInt(row.count) });
        });

        let issuesFound = 0;
        Object.entries(duplicates).forEach(([norm, variants]) => {
            if (variants.length > 1) {
                issuesFound++;
                console.log(`\nProblema en [${norm}]:`);
                variants.forEach(v => {
                    console.log(`  - "${v.original}": ${v.count} paquetes`);
                });
            }
        });

        if (issuesFound === 0) {
            console.log("\n✅ No se encontraron duplicados por inconsistencia de texto.");
        } else {
            console.log(`\n⚠️ Se encontraron ${issuesFound} comunas con nombres inconsistentes.`);
        }

    } catch (err) {
        console.error("Error en diagnóstico:", err);
    } finally {
        process.exit();
    }
}

diagnosticCommunes();
