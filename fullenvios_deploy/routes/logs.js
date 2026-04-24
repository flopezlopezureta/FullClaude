const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const adminOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
};

// GET /api/logs - Get all system logs
router.get('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { rows: logs } = await db.query('SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 1000');
        
        // Try to parse details if it's JSON
        const parsedLogs = logs.map(log => {
            let details = log.details;
            if (details && typeof details === 'string') {
                try {
                    details = JSON.parse(details);
                } catch (e) {
                    // Not JSON, keep as string
                }
            }
            return { ...log, details };
        });

        res.json(parsedLogs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener los logs del sistema.' });
    }
});

module.exports = router;
