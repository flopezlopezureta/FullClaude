const db = require('./c:/IA ANTIGRAVITY/FULLENVIOS/Test1/db');

async function checkUser() {
    try {
        const { rows } = await db.query("SELECT id, name, email, \"clientIdentifier\" FROM users WHERE email = 'kdelaossa@cosmeticaval.cl'");
        console.log("User Data:", JSON.stringify(rows[0], null, 2));
    } catch (err) {
        console.error("DB Error:", err);
    } finally {
        process.exit();
    }
}

checkUser();
