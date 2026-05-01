
const db = require('../db');
require('dotenv').config();

async function runFullAudit() {
    console.log("Starting Full System Integrity Audit...");
    const report = {
        timestamp: new Date().toISOString(),
        findings: []
    };

    try {
        // 1. Check for non-standard roles or statuses
        const rolesQuery = await db.query(`
            SELECT id, name, role, status 
            FROM users 
            WHERE role NOT IN ('ADMIN', 'CLIENT', 'DRIVER', 'OPERADOR_SISTEMAS', 'FACTURACION', 'RETIROS', 'AUXILIAR')
               OR status NOT IN ('APROBADO', 'PENDIENTE', 'DESHABILITADO', 'ELIMINADO')
        `);
        if (rolesQuery.rows.length > 0) {
            report.findings.push({
                type: 'INVALID_USER_METADATA',
                severity: 'MEDIUM',
                message: 'Users found with non-standard roles or statuses.',
                data: rolesQuery.rows
            });
        }

        // 2. Check for old integration structure (missing 'accounts' array)
        const integrationsQuery = await db.query(`
            SELECT id, name, integrations 
            FROM users 
            WHERE integrations IS NOT NULL 
              AND (integrations->'accounts') IS NULL
              AND (integrations::text != '{}')
        `);
        if (integrationsQuery.rows.length > 0) {
            report.findings.push({
                type: 'LEGACY_INTEGRATIONS',
                severity: 'LOW',
                message: 'Users with integrations in legacy format (missing "accounts" array).',
                count: integrationsQuery.rows.length,
                sample: integrationsQuery.rows.slice(0, 5)
            });
        }

        // 3. Orphaned Packages
        const orphanedPackagesQuery = await db.query(`
            SELECT p.id, p."recipientName", p."driverId"
            FROM packages p
            LEFT JOIN users u ON p."driverId" = u.id
            WHERE p."driverId" IS NOT NULL AND u.id IS NULL
        `);
        if (orphanedPackagesQuery.rows.length > 0) {
            report.findings.push({
                type: 'ORPHAN_PACKAGES',
                severity: 'HIGH',
                message: 'Packages assigned to non-existent drivers.',
                count: orphanedPackagesQuery.rows.length,
                data: orphanedPackagesQuery.rows
            });
        }

        // 4. Duplicate Integration Orders
        const duplicateMeli = await db.query(`
            SELECT "meliOrderId", COUNT(*) 
            FROM packages 
            WHERE "meliOrderId" IS NOT NULL 
            GROUP BY "meliOrderId" HAVING COUNT(*) > 1
        `);
        if (duplicateMeli.rows.length > 0) {
            report.findings.push({
                type: 'DUPLICATE_MELI_ORDERS',
                severity: 'MEDIUM',
                message: 'Duplicate Mercado Libre orders found in database.',
                data: duplicateMeli.rows
            });
        }

        const duplicateShopify = await db.query(`
            SELECT "shopifyOrderId", COUNT(*) 
            FROM packages 
            WHERE "shopifyOrderId" IS NOT NULL 
            GROUP BY "shopifyOrderId" HAVING COUNT(*) > 1
        `);
        if (duplicateShopify.rows.length > 0) {
            report.findings.push({
                type: 'DUPLICATE_SHOPIFY_ORDERS',
                severity: 'MEDIUM',
                message: 'Duplicate Shopify orders found in database.',
                data: duplicateShopify.rows
            });
        }

        // 5. Packages with missing source metadata
        const missingMetadata = await db.query(`
            SELECT id, source, "creatorId"
            FROM packages
            WHERE source IN ('SHOPIFY', 'WOOCOMMERCE', 'JUMPSELLER')
              AND "sourceAccountId" IS NULL
        `);
        if (missingMetadata.rows.length > 0) {
            report.findings.push({
                type: 'MISSING_SOURCE_METADATA',
                severity: 'LOW',
                message: 'Integration packages missing account metadata (legacy imports).',
                count: missingMetadata.rows.length
            });
        }

        console.log("Audit complete.");
        console.log("---REPORT_START---");
        console.log(JSON.stringify(report, null, 2));
        console.log("---REPORT_END---");

    } catch (err) {
        console.error("Audit failed:", err);
    } finally {
        process.exit(0);
    }
}

runFullAudit();
