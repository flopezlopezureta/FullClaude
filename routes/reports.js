const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/reports/activity-audit
 * Detailed report of delivery activities, attempts, and status breakdown.
 */
router.get('/activity-audit', authMiddleware, async (req, res) => {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'FACTURACION') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Se requieren fechas de inicio y fin.' });
    }

    try {
        // Query logic:
        // 1. Get package counts grouped by client and their final status
        // 2. Correlate with tracking_events to count "Attempts" (Problem events before success)
        
        const query = `
            WITH attempts_count AS (
                SELECT 
                    "packageId",
                    COUNT(*) FILTER (WHERE status IN ('PROBLEMA', 'REPROGRAMADO')) as problem_events
                FROM tracking_events
                WHERE timestamp >= $1 AND timestamp <= $2
                GROUP BY "packageId"
            ),
            package_data AS (
                SELECT 
                    p.id,
                    p."creatorId",
                    p.status,
                    COALESCE(ac.problem_events, 0) as failed_attempts
                FROM packages p
                LEFT JOIN attempts_count ac ON p.id = ac."packageId"
                WHERE 
                    (p."createdAt" >= $1 AND p."createdAt" <= $2)
                    OR (p."updatedAt" >= $1 AND p."updatedAt" <= $2)
            )
            SELECT 
                u.id as "clientId",
                u.name as "clientName",
                u."companyName",
                COUNT(pd.id) as "totalProcessed",
                COUNT(pd.id) FILTER (WHERE pd.status = 'ENTREGADO') as "successTotal",
                COUNT(pd.id) FILTER (WHERE pd.status = 'ENTREGADO' AND pd.failed_attempts = 0) as "successFirstAttempt",
                COUNT(pd.id) FILTER (WHERE pd.status = 'ENTREGADO' AND pd.failed_attempts = 1) as "successSecondAttempt",
                COUNT(pd.id) FILTER (WHERE pd.status = 'ENTREGADO' AND pd.failed_attempts > 1) as "successMultipleAttempts",
                COUNT(pd.id) FILTER (WHERE pd.status IN ('PROBLEMA', 'REPROGRAMADO')) as "failedCurrently",
                COUNT(pd.id) FILTER (WHERE pd.status = 'DEVUELTO') as "returnedTotal",
                COUNT(pd.id) FILTER (WHERE pd.status IN ('ASIGNADO', 'RETIRADO', 'EN_TRANSITO')) as "inTransit"
            FROM package_data pd
            JOIN users u ON pd."creatorId" = u.id
            GROUP BY u.id, u.name, u."companyName"
            ORDER BY u.name ASC;
        `;

        const result = await db.query(query, [startDate + ' 00:00:00', endDate + ' 23:59:59']);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error in activity-audit report:', err);
        res.status(500).json({ message: 'Error al generar el reporte de auditoría.' });
    }
});

module.exports = router;
