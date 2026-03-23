const db = require('../db');

/**
 * Records a system log entry.
 * @param {string} userId - The ID of the user performing the action.
 * @param {string} userName - The name of the user performing the action.
 * @param {string} action - A brief description of the action (e.g., "UPDATE_PACKAGE").
 * @param {string|object} details - Additional details about the action.
 */
async function logAction(userId, userName, action, details) {
    try {
        const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
        await db.query(
            'INSERT INTO system_logs ("userId", "userName", action, details) VALUES ($1, $2, $3, $4)',
            [userId, userName, action, detailsStr]
        );
    } catch (err) {
        console.error('Error recording system log:', err);
    }
}

module.exports = {
    logAction
};
