const db = require('../db');

let systemTimezone = 'America/Santiago';
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches the system timezone from database settings.
 * Uses a simple cache to avoid excessive DB queries.
 */
async function getSystemTimezone() {
    const now = Date.now();
    if (now - lastFetch < CACHE_DURATION) {
        return systemTimezone;
    }

    try {
        const { rows } = await db.query('SELECT timezone FROM system_settings WHERE id = 1');
        if (rows.length > 0 && rows[0].timezone) {
            systemTimezone = rows[0].timezone;
        }
        lastFetch = now;
    } catch (err) {
        console.error('[TimeService] Error fetching system timezone:', err.message);
    }
    return systemTimezone;
}

/**
 * Returns a "Logical Date" string (YYYY-MM-DD) based on a 02:00 AM cutoff.
 * If current time is before 02:00 AM, it returns the previous day's date.
 */
async function getLogicalDate(date = new Date()) {
    const tz = await getSystemTimezone();
    
    // Get time in the target timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(date);
    const map = {};
    parts.forEach(p => map[p.type] = p.value);

    let year = parseInt(map.year);
    let month = parseInt(map.month);
    let day = parseInt(map.day);
    let hour = parseInt(map.hour);

    // LOGIC: If it's between 00:00 and 01:59 AM, we treat it as "yesterday"
    if (hour < 2) {
        const yesterday = new Date(date);
        yesterday.setHours(yesterday.getHours() - 3); // Shift back enough to get yesterday in same TZ
        
        const yParts = formatter.formatToParts(yesterday);
        const yMap = {};
        yParts.forEach(p => yMap[p.type] = p.value);
        
        return `${yMap.year}-${yMap.month}-${yMap.day}`;
    }

    return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Returns the logical "Today" range for SQL queries.
 * Respects the 02:00 AM cutoff and the system timezone.
 */
async function getLogicalTodayRange() {
    const tz = await getSystemTimezone();
    const todayStr = await getLogicalDate();
    
    // The logical day starts at 02:00 AM of the logical date
    // and ends at 01:59:59 AM of the next calendar day.
    
    // We can use PostgreSQL intervals for this, but for JS filtering:
    return {
        dateStr: todayStr,
        start: `${todayStr} 02:00:00`,
        // We add 24 hours to the start to get the end of the logical day
        nextDayStart: `(${todayStr}::date + interval '1 day' + interval '2 hours')`
    };
}

module.exports = {
    getSystemTimezone,
    getLogicalDate,
    getLogicalTodayRange
};
