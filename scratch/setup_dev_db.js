require('dotenv').config();
const { Client } = require('pg');

async function setupDevDb() {
    console.log('🚀 Iniciando configuración de la base de datos de Desarrollo...');
    
    // Conexión inicial a la DB 'postgres' para poder crear la nueva DB
    const masterClient = new Client({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'postgres',
        port: process.env.DB_PORT || 5432,
    });

    const devDbName = 'fullenvios_dev';

    try {
        await masterClient.connect();
        console.log('✅ Conectado al servidor PostgreSQL.');

        // Verificar si la DB ya existe
        const checkRes = await masterClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [devDbName]);
        
        if (checkRes.rowCount === 0) {
            console.log(`🔨 Creando base de datos "${devDbName}"...`);
            // CREATE DATABASE no permite parámetros, así que concatenamos con cuidado
            await masterClient.query(`CREATE DATABASE ${devDbName}`);
            console.log(`✅ Base de datos "${devDbName}" creada exitosamente.`);
        } else {
            console.log(`ℹ️ La base de datos "${devDbName}" ya existe.`);
        }

    } catch (err) {
        console.error('❌ Error configurando la base de datos:', err.message);
        if (err.message.includes('permission denied')) {
            console.error('💡 Tip: Asegúrate de que el usuario "postgres" tenga permisos para crear bases de datos.');
        }
    } finally {
        await masterClient.end();
    }
}

setupDevDb();
