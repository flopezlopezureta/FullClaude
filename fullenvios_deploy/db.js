const { Pool } = require('pg');

let pool;

function getPool() {
    if (pool) {
        return pool;
    }

    const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missingEnv = requiredEnv.filter(v => !process.env[v]);

    if (missingEnv.length > 0) {
        console.error(`FATAL ERROR: Missing PostgreSQL environment variables: ${missingEnv.join(', ')}.`);
        // Mock pool that always fails, providing a clear error message.
        return {
            query: () => Promise.reject(new Error(`La base de datos PostgreSQL no está configurada en el servidor (faltan variables de entorno: ${missingEnv.join(', ')})`)),
            connect: () => Promise.reject(new Error(`La base de datos PostgreSQL no está configurada en el servidor (faltan variables de entorno: ${missingEnv.join(', ')})`)),
        };
    }
    
    try {
        pool = new Pool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 5432,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        
        console.log("PostgreSQL pool created successfully.");
        return pool;

    } catch (error) {
        console.error("CRITICAL: Failed to create PostgreSQL pool.", error);
        return {
             query: () => Promise.reject(new Error("La configuración para la base de datos PostgreSQL es inválida.")),
             connect: () => Promise.reject(new Error("La configuración para la base de datos PostgreSQL es inválida.")),
        };
    }
}

async function query(text, params) {
    const start = Date.now();
    const currentPool = getPool();
    const res = await currentPool.query(text, params);
    const duration = Date.now() - start;
    // console.log('executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
}

const getClient = async () => {
    const pool = getPool();
    const client = await pool.connect();
    return client;
};


module.exports = {
    query,
    getClient,
};