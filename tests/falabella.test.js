/**
 * Test Suite: Falabella Seller Center QA Certification
 * Habilidades: QA Automation, Criptografía, Bases de Datos, Resiliencia
 */

// Cargar variables de entorno del archivo .env si está disponible
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const assert = require('assert').strict;
const { encrypt, decrypt, buildFalabellaSignature } = require('../services/falabellaCrypto');
const db = require('../db');

async function runTests() {
    console.log("==================================================");
    console.log("   CERTIFICACIÓN QA AUTOMATION: FALABELLA API     ");
    console.log("==================================================");
    let passed = 0;
    let failed = 0;

    // PRUEBA 1: Criptografía y Firma (SHA256)
    try {
        console.log("\n🧪 Prueba 1: Firma Criptográfica HMAC-SHA256...");
        const params = {
            Action: 'GetDocumentTemplates',
            Timestamp: '2026-07-01T00:00:00Z',
            UserID: 'seller_12345',
            Version: '1.0',
            Format: 'JSON'
        };
        const apiKey = 'test_secret_api_key';
        
        // Calcular firma real usando el módulo del sistema
        const signature = buildFalabellaSignature(params, apiKey);
        
        // Verificar que el cálculo sea determinista y correcto
        assert.ok(signature, "La firma no debe estar vacía");
        assert.strictEqual(signature.length, 64, "La firma debe tener una longitud de 64 caracteres (SHA-256)");
        
        // Validar firma esperada calculada por separado
        const expectedSignature = '4cf463c183195d476ee0cc5dded512d29f8486e6b984994535e8842d25390521';
        assert.strictEqual(signature, expectedSignature, "La firma calculada no coincide con el estándar esperado");
        
        console.log("   ✅ Prueba 1 PASADA.");
        passed++;
    } catch (err) {
        console.error("   ❌ Prueba 1 FALLADA:", err.message);
        failed++;
    }

    // PRUEBA 2: Cifrado y Descifrado AES-256-CBC
    try {
        console.log("\n🧪 Prueba 2: Cifrado de API Key en Base de Datos (AES-256-CBC)...");
        const originalApiKey = 'falabella_live_api_key_secure_value_102030';
        
        // Cifrar llave
        const encrypted = encrypt(originalApiKey);
        assert.ok(encrypted, "El cifrado no debe estar vacío");
        assert.ok(encrypted.includes(':'), "El cifrado debe tener el formato iv:ciphertext");
        
        // Asegurarse de que el texto cifrado no es igual al texto plano
        assert.notStrictEqual(encrypted, originalApiKey, "El valor cifrado no debe exponer el texto plano");
        
        // Descifrar llave
        const decrypted = decrypt(encrypted);
        assert.strictEqual(decrypted, originalApiKey, "El descifrado debe recuperar el texto original");
        
        console.log("   ✅ Prueba 2 PASADA.");
        passed++;
    } catch (err) {
        console.error("   ❌ Prueba 2 FALLADA:", err.message);
        failed++;
    }

    // PRUEBA 3: Estructura de Base de Datos (QA Integración)
    try {
        console.log("\n🧪 Prueba 3: Columnas de Mapeo en packages...");
        
        // Consultar columnas de la tabla packages
        const { rows: columns } = await db.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'packages'"
        );
        const columnNames = columns.map(c => c.column_name);
        
        assert.ok(columnNames.includes('falabellaOrderId'), "La columna 'falabellaOrderId' no existe en packages");
        assert.ok(columnNames.includes('falabellaTrackingId'), "La columna 'falabellaTrackingId' no existe en packages");
        
        console.log("   ✅ Prueba 3 PASADA (Columnas falabellaOrderId y falabellaTrackingId certificadas).");
        passed++;
    } catch (err) {
        console.error("   ❌ Prueba 3 FALLADA:", err.message);
        failed++;
    }

    // PRUEBA 4: Tabla de Cola de Reintentos
    try {
        console.log("\n🧪 Prueba 4: Tabla de Cola de Sincronización (integration_sync_queue)...");
        
        // Consultar si existe la tabla
        const { rows: tables } = await db.query(
            "SELECT table_name FROM information_schema.tables WHERE table_name = 'integration_sync_queue'"
        );
        
        assert.strictEqual(tables.length, 1, "La tabla 'integration_sync_queue' no está registrada en la base de datos");
        
        // Probar inserción simulada en la cola
        const testPkgId = 'TEST-PKG-QA';
        const testAction = 'DELIVERY_CONFIRM';
        const testError = 'HTTP 503 Service Unavailable';
        
        const insertRes = await db.query(
            'INSERT INTO integration_sync_queue ("packageId", integration, action, error, attempts) VALUES ($1, $2, $3, $4, 1) RETURNING id',
            [testPkgId, 'FALABELLA', testAction, testError]
        );
        
        assert.ok(insertRes.rows[0].id, "No se pudo insertar en la cola de sincronización");
        const queueId = insertRes.rows[0].id;
        
        // Limpiar registro de prueba
        await db.query('DELETE FROM integration_sync_queue WHERE id = $1', [queueId]);
        
        console.log("   ✅ Prueba 4 PASADA (Cola de reintentos certificada y operacional).");
        passed++;
    } catch (err) {
        console.error("   ❌ Prueba 4 FALLADA:", err.message);
        failed++;
    }

    console.log("\n==================================================");
    console.log(` RESULTADOS FINALES: ${passed} pasadas, ${failed} falladas.`);
    console.log("==================================================");
    
    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

// Ejecutar suite
runTests().catch(err => {
    console.error("Fallo crítico en el test runner:", err);
    process.exit(1);
});
