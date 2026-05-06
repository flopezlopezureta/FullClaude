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

async function getLogicalRange(startDateStr, endDateStr) {
    // Start of logical day for startDateStr: YYYY-MM-DD 02:00:00
    const start = `${startDateStr} 02:00:00`;
    
    // Calculate the end (01:59:59 AM of the day after endDateStr)
    const endCalendarDate = new Date(endDateStr + 'T12:00:00');
    endCalendarDate.setDate(endCalendarDate.getDate() + 1);
    const endStr = endCalendarDate.toISOString().split('T')[0];
    const nextDayStart = `${endStr} 02:00:00`;
    
    return { start, nextDayStart };
}

/**
 * Returns the logical "Today" range for SQL queries.
 */
async function getLogicalTodayRange() {
    const todayStr = await getLogicalDate();
    const { start, nextDayStart } = await getLogicalRange(todayStr, todayStr);
    return { 
        dateStr: todayStr, 
        start, 
        nextDayStart 
    };
}

module.exports = {
    getSystemTimezone,
    getLogicalDate,
    getLogicalTodayRange,
    getLogicalRange
};
