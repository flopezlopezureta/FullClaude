const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/notifications
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM notifications WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 50',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ message: 'Error al obtener notificaciones.' });
    }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authMiddleware, async (req, res) => {
    try {
        await db.query(
            'UPDATE notifications SET read = true WHERE id = $1 AND "userId" = $2',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Notificación marcada como leída.' });
    } catch (err) {
        console.error('Error marking notification as read:', err);
        res.status(500).json({ message: 'Error al actualizar notificación.' });
    }
});

// DELETE /api/notifications/:id
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM notifications WHERE id = $1 AND "userId" = $2',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Notificación eliminada.' });
    } catch (err) {
        console.error('Error deleting notification:', err);
        res.status(500).json({ message: 'Error al eliminar notificación.' });
    }
});

module.exports = router;
