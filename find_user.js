const db = require('./db');

async function findUser() {
    try {
        const { rows } = await db.query("SELECT id, name, email, role FROM users WHERE name ILIKE '%Nicole Marchant%'");
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

findUser();
