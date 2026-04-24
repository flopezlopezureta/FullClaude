const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// POST /api/geo/update-location
router.post('/update-location', authMiddleware, async (req, res) => {
    const { driverId, latitude, longitude } = req.body;
    
    // Quick validation
    if (req.user.id !== driverId && req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'No tienes permiso para actualizar esta ubicación.' });
    }

    try {
        await db.query(
            'UPDATE users SET latitude = $1, longitude = $2, "lastLocationUpdate" = $3 WHERE id = $4',
            [latitude, longitude, new Date(), driverId]
        );
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar la ubicación.' });
    }
});

// GET /api/geo/active-drivers
router.get('/active-drivers', authMiddleware, async (req, res) => {
    try {
        // Get drivers with a location update in the last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const { rows: drivers } = await db.query(
            'SELECT id, name, email, latitude, longitude, "lastLocationUpdate" FROM users WHERE role = \'DRIVER\' AND status = \'APROBADO\' AND "lastLocationUpdate" > $1',
            [fiveMinutesAgo]
        );
        res.json(drivers);
    } catch (err) {
        if (err.code === '42P01' || err.code === '42703') { // undefined_table or undefined_column
            return res.json([]); // Return empty if table/column doesn't exist
        }
        console.error(err);
        res.status(500).json({ message: 'Error al obtener la ubicación de los conductores.' });
    }
});

module.exports = router;