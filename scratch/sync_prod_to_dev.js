require('dotenv').config();
const { Pool } = require('pg');

async function syncProdToDev() {
    console.log('🔄 Iniciando sincronización de Producción a Desarrollo...');
    
    const prodConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'fullenvios', // DB de Producción
        port: process.env.DB_PORT || 5432,
    };

    const devConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'fullenvios_dev', // DB de Desarrollo
        port: process.env.DB_PORT || 5432,
    };

    const prodPool = new Pool(prodConfig);
    const devPool = new Pool(devConfig);

    // Asegurar que la tabla integration_settings existe en Desarrollo
    await devPool.query(`
        CREATE TABLE IF NOT EXISTS integration_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            meli_app_id TEXT,
            meli_client_secret TEXT,
            shopify_shop_url TEXT,
            shopify_access_token TEXT,
            github_token TEXT,
            github_repo TEXT,
            github_owner TEXT,
            whatsapp_api_key TEXT,
            whatsapp_phone_number TEXT,
            woo_url TEXT,
            woo_consumer_key TEXT,
            woo_consumer_secret TEXT,
            falabella_api_key TEXT,
            falabella_seller_id TEXT,
            shopify_webhook_secret TEXT,
            jumpseller_login TEXT,
            jumpseller_token TEXT
        );
    `);
    console.log('✅ Tabla integration_settings asegurada en Desarrollo.');

    const tablesToSync = [
        'users',
        'active_communes',
        'delivery_zones',
        'system_settings',
        'integration_settings',
        'packages',
        'tracking_events',
        'assignment_events',
        'pickup_runs',
        'pickup_assignments'
    ];

    try {
        console.log('📡 Conectando a ambas bases de datos...');
        
        for (const table of tablesToSync) {
            // Verificar si la tabla existe en Desarrollo
            const tableExistsRes = await devPool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                )
            `, [table]);

            if (!tableExistsRes.rows[0].exists) {
                console.log(`⚠️ Saltando tabla ${table}: No existe en Desarrollo aún.`);
                continue;
            }

            console.log(`📦 Sincronizando tabla: ${table}...`);
            
            // 1. Obtener datos de Producción
            const { rows } = await prodPool.query(`SELECT * FROM ${table}`);
            console.log(`   - Obtenidas ${rows.length} filas de Producción.`);

            if (rows.length === 0) continue;

            // 2. Obtener columnas válidas en Desarrollo para evitar errores de schema
            const devColumnsRes = await devPool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            const validColumns = devColumnsRes.rows.map(r => r.column_name);

            // 3. Limpiar tabla en Desarrollo
            await devPool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);

            // 4. Insertar en Desarrollo filtrando columnas que no existan (USANDO BLOQUES PARA RAPIDEZ)
            const tableColumns = Object.keys(rows[0]).filter(c => validColumns.includes(c));
            const columnsStr = tableColumns.map(c => `"${c}"`).join(', ');
            
            const batchSize = 100;
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                const values = [];
                const valuePlaceholders = batch.map((row, rowIdx) => {
                    const rowValues = tableColumns.map(c => {
                        const val = row[c];
                        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
                            return JSON.stringify(val);
                        }
                        return val;
                    });
                    const baseIdx = rowIdx * tableColumns.length;
                    const placeholders = rowValues.map((_, vIdx) => `$${baseIdx + vIdx + 1}`).join(', ');
                    values.push(...rowValues);
                    return `(${placeholders})`;
                }).join(', ');

                await devPool.query(`INSERT INTO ${table} (${columnsStr}) VALUES ${valuePlaceholders}`, values);
                console.log(`   - ...procesadas ${Math.min(i + batchSize, rows.length)} / ${rows.length} filas.`);
            }
            console.log(`   - ✅ ${table} sincronizada.`);
        }

        console.log('\n✨ Sincronización completada con éxito.');
        console.log('🚀 Ahora puedes hacer pruebas en el ambiente de Desarrollo sin miedo.');

    } catch (err) {
        console.error('\n❌ Error durante la sincronización:', err.message);
    } finally {
        await prodPool.end();
        await devPool.end();
    }
}

syncProdToDev();
