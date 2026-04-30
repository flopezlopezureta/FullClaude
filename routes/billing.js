const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/billing/summary
 * Returns a summary of packages grouped by client and status for a given date range.
 * Restricted to Super Admin.
 */
router.get('/summary', authMiddleware, async (req, res) => {
    // Check if user is Super Admin
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores.' });
    }

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Se requieren fechas de inicio y fin.' });
    }

    try {
        // We use a query that joins packages with users to get client names
        // We filter by createdAt range and group by client and status
        const query = `
            SELECT 
                u.id as "clientId", 
                u.name as "clientName", 
                u."companyName",
                p.status, 
                COUNT(*) as count
            FROM packages p
            JOIN users u ON p."creatorId" = u.id
            WHERE p."createdAt" >= $1 AND p."createdAt" <= $2
            GROUP BY u.id, u.name, u."companyName", p.status
            ORDER BY u.name ASC;
        `;

        const result = await db.query(query, [startDate + ' 00:00:00', endDate + ' 23:59:59']);
        
        // Transform the flat result into a more usable structure for the frontend
        // Structure: { [clientId]: { clientName, companyName, statuses: { [status]: count }, total } }
        const summary = {};
        
        result.rows.forEach(row => {
            if (!summary[row.clientId]) {
                summary[row.clientId] = {
                    clientId: row.clientId,
                    clientName: row.clientName,
                    companyName: row.companyName,
                    statuses: {},
                    total: 0
                };
            }
            
            summary[row.clientId].statuses[row.status] = parseInt(row.count);
            summary[row.clientId].total += parseInt(row.count);
        });

        res.json(Object.values(summary));
    } catch (err) {
        console.error('Error fetching billing summary:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;
