const fs = require('fs');
try {
    const dotenvContent = fs.readFileSync('c:\\IA ANTIGRAVITY\\FULLENVIOS\\CLIENTE2\\.env', 'utf8');
    dotenvContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length === 2) {
            process.env[parts[0].trim()] = parts[1].trim();
        }
    });
} catch (e) {
    console.error('Error loading .env:', e.message);
}

const db = require('c:\\IA ANTIGRAVITY\\FULLENVIOS\\CLIENTE2\\db');

async function run() {
    try {
        const t0 = Date.now();
        console.log('Running query for packages search searchQuery = "panga"...');
        const query = `
            SELECT p.id, p."recipientName", p.status, p."createdAt", p."updatedAt"
            FROM packages p
            LEFT JOIN users u ON p."creatorId" = u.id
            WHERE (p."recipientName" ILIKE $1 
                OR p."recipientAddress" ILIKE $1 
                OR p."recipientCity" ILIKE $1 
                OR p."recipientCommune" ILIKE $1 
                OR p.id ILIKE $1 
                OR p."meliOrderId" ILIKE $1 
                OR p."shopifyOrderId" ILIKE $1 
                OR p."wooOrderId" ILIKE $1 
                OR p."jumpsellerOrderId" ILIKE $1 
                OR p."trackingId" ILIKE $1 
                OR p."recipientPhone" ILIKE $1
                OR p."recipientEmail" ILIKE $1
                OR p."meliFlexCode" ILIKE $1 
                OR p.notes ILIKE $1
                OR u.name ILIKE $1)
            ORDER BY p."updatedAt" DESC, p.id DESC
            LIMIT 25 OFFSET 0
        `;
        const { rows } = await db.query(query, ['%panga%']);
        console.log(`QUERY SUCCESS in ${Date.now() - t0}ms. Returned ${rows.length} rows.`);
        console.log(rows);
    } catch (err) {
        console.error('QUERY FAILED:', err);
    }
    process.exit(0);
}

run();
