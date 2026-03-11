
const fs = require('fs');
const db = require('./db');
const path = require('path');

async function restore(sqlFilePath) {
    console.log(`Iniciando restauración desde: ${sqlFilePath}`);
    
    try {
        const sql = fs.readFileSync(sqlFilePath, 'utf8');
        
        // Dividir por punto y coma para ejecutar sentencias individuales si es necesario,
        // o ejecutar todo el bloque. PostgreSQL maneja bien bloques grandes.
        console.log('Ejecutando SQL...');
        await db.query(sql);
        
        console.log('✅ Restauración completada con éxito.');
    } catch (error) {
        console.error('❌ Error durante la restauración:', error);
    } finally {
        process.exit();
    }
}

// Uso: node restore.js ruta/al/archivo.sql
const filePath = process.argv[2];
if (!filePath) {
    console.error('Por favor, especifica la ruta del archivo SQL. Ejemplo: node restore.js backup.sql');
    process.exit(1);
}

restore(path.resolve(filePath));
