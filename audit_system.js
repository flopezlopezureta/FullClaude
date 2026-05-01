
const db = require('./db');
require('dotenv').config();

async function runAudit() {
    console.log("---AUDIT_START---");
    try {
        const results = {};
        
        // 1. Roles
        const roles = await db.query("SELECT id, name, role FROM users WHERE role NOT IN ('ADMIN', 'CLIENT', 'DRIVER', 'OPERADOR_SISTEMAS', 'FACTURACION', 'RETIROS', 'AUXILIAR')");
        results.invalidRoles = roles.rows;

        // 2. Status
        const statuses = await db.query("SELECT id, name, status FROM users WHERE status NOT IN ('APROBADO', 'PENDIENTE', 'DESHABILITADO', 'ELIMINADO')");
        results.invalidStatuses = statuses.rows;

        // 3. Legacy Integrations
        const legacy = await db.query("SELECT id, name FROM users WHERE integrations IS NOT NULL AND (integrations->'accounts') IS NULL AND (integrations::text != '{}')");
        results.legacyIntegrations = legacy.rows;

        // 4. Orphaned Packages
        const orphaned = await db.query("SELECT p.id, p.\"recipientName\", p.\"driverId\" FROM packages p LEFT JOIN users u ON p.\"driverId\" = u.id WHERE p.\"driverId\" IS NOT NULL AND u.id IS NULL");
        results.orphanedPackages = orphaned.rows;

        console.log(JSON.stringify(results, null, 2));
    } catch (err) {
        console.error("Audit failed:", err.message);
    } finally {
        console.log("---AUDIT_END---");
        process.exit(0);
    }
}
runAudit();
