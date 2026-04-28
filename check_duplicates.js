require('dotenv').config();
const db = require('./db');

async function checkDuplicates() {
    try {
        const { rows: meli } = await db.query('SELECT "meliOrderId", COUNT(*) FROM packages WHERE "meliOrderId" IS NOT NULL GROUP BY "meliOrderId" HAVING COUNT(*) > 1');
        console.log('Meli Duplicates:', meli);
        
        const { rows: shopify } = await db.query('SELECT "shopifyOrderId", COUNT(*) FROM packages WHERE "shopifyOrderId" IS NOT NULL GROUP BY "shopifyOrderId" HAVING COUNT(*) > 1');
        console.log('Shopify Duplicates:', shopify);

        const { rows: jump } = await db.query('SELECT "jumpsellerOrderId", COUNT(*) FROM packages WHERE "jumpsellerOrderId" IS NOT NULL GROUP BY "jumpsellerOrderId" HAVING COUNT(*) > 1');
        console.log('Jumpseller Duplicates:', jump);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDuplicates();
