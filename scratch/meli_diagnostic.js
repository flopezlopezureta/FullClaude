require('dotenv').config();
const db = require('../db');

async function check() {
    try {
        console.log('--- GLOBAL SETTINGS ---');
        const settings = await db.query('SELECT "meliAutoImport" FROM system_settings WHERE id = 1');
        console.log('Global Meli Auto Import:', settings.rows[0]?.meliAutoImport);

        console.log('\n--- CLIENTS WITH ML INTEGRATION ---');
        const users = await db.query(`
            SELECT id, name, integrations 
            FROM users 
            WHERE role = 'CLIENT' 
            AND (integrations->'meli' IS NOT NULL OR integrations->'accounts' IS NOT NULL)
        `);
        
        console.log('Clients found:', users.rows.length);
        
        for (const u of users.rows) {
            console.log(`\nClient: ${u.name} (ID: ${u.id})`);
            const integrations = u.integrations;
            
            if (integrations.accounts) {
                const meliAccounts = integrations.accounts.filter(a => a.type === 'MERCADO_LIBRE');
                console.log(`  Multi-account structure found. ${meliAccounts.length} ML accounts:`);
                meliAccounts.forEach(a => {
                    const expiresAt = a.credentials?.expiresAt;
                    const isExpired = expiresAt ? Date.now() >= expiresAt : 'N/A';
                    console.log(`  - Nickname: ${a.nickname}`);
                    console.log(`    AutoImport: ${a.settings?.autoImport}`);
                    console.log(`    LastSync: ${a.settings?.lastSync}`);
                    console.log(`    SyncInterval: ${a.settings?.syncInterval} min`);
                    console.log(`    Token Expired: ${isExpired} (Expires: ${expiresAt ? new Date(expiresAt).toISOString() : 'N/A'})`);
                });
            } else if (integrations.meli) {
                console.log('  Legacy Meli integration structure:');
                const m = integrations.meli;
                const isExpired = m.expiresAt ? Date.now() >= m.expiresAt : 'N/A';
                console.log(`    AutoImport: ${m.autoImport !== false}`);
                console.log(`    LastSync: ${m.lastSync}`);
                console.log(`    Token Expired: ${isExpired} (Expires: ${m.expiresAt ? new Date(m.expiresAt).toISOString() : 'N/A'})`);
            } else {
                console.log('  No specific ML integration data found in integrations field.');
            }
        }

        console.log('\n--- RECENT PACKAGES FROM MERCADO_LIBRE ---');
        const recentPackages = await db.query(`
            SELECT id, "meliOrderId", status, "createdAt", "recipientCity", "recipientCommune"
            FROM packages 
            WHERE source = 'MERCADO_LIBRE'
            ORDER BY "createdAt" DESC 
            LIMIT 10
        `);
        
        if (recentPackages.rows.length === 0) {
            console.log('No ML packages found in database.');
        } else {
            recentPackages.rows.forEach(p => {
                console.log(`- ID: ${p.id} | Order: ${p.meliOrderId} | Status: ${p.status} | Created: ${p.createdAt.toISOString()} | City: ${p.recipientCity} | Commune: ${p.recipientCommune}`);
            });
        }

        console.log('\n--- TOTAL ML PACKAGES TODAY ---');
        const todayCount = await db.query(`
            SELECT count(*) 
            FROM packages 
            WHERE source = 'MERCADO_LIBRE' 
            AND "createdAt" >= CURRENT_DATE
        `);
        console.log('Packages imported today:', todayCount.rows[0].count);

        process.exit(0);
    } catch (err) {
        console.error('Diagnostic error:', err);
        process.exit(1);
    }
}

check();
