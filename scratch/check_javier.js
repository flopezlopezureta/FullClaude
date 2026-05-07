const db = require('../db');
const timeService = require('../services/timeService');

async function checkJavier() {
    try {
        const targetDate = await timeService.getLogicalDate();
        const { start, nextDayStart } = await timeService.getLogicalRange(targetDate, targetDate);
        
        const { rows: drivers } = await db.query("SELECT id FROM users WHERE name = 'JAVIER FUENTES'");
        if (drivers.length === 0) {
            console.log('Driver not found');
            return;
        }
        const driverId = drivers[0].id;
        console.log('Driver ID:', driverId);

        const { rows: pkgs } = await db.query(`
            SELECT id, status, "updatedAt", "estimatedDelivery"
            FROM packages
            WHERE "driverId" = $1
            AND ("estimatedDelivery" >= $2 AND "estimatedDelivery" <= $3 OR "updatedAt" >= $2 AND "updatedAt" <= $3)
        `, [driverId, start, nextDayStart]);

        console.log('Packages for Javier:', JSON.stringify(pkgs, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
checkJavier();
