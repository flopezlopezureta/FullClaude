const db = require('./db');

async function check() {
    try {
        const res = await db.query('SELECT name, role, status FROM users LIMIT 20');
        console.log('--- LISTA DE USUARIOS ---');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
