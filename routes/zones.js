const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Admin only middleware
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    next();
};

// GET /api/zones
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { rows: zones } = await db.query('SELECT * FROM delivery_zones');
        // The pg driver for PostgreSQL automatically parses JSONB columns into JavaScript objects.
        // By returning `zones` directly, we rely on the driver's native handling.
        res.json(zones);
    } catch (err) {
        if (err.code === '42P01') { // PostgreSQL undefined_table
            return res.json([]); // Return empty array if table doesn't exist yet
        }
        console.error(err);
        res.status(500).json({ message: 'Error al obtener las zonas.' });
    }
});

// POST /api/zones
router.post('/', authMiddleware, adminOnly, async (req, res) => {
    const { name, communes, pricing } = req.body;
    try {
        const newZone = {
            id: `zone-${uuidv4()}`,
            name,
            communes,
            pricing
        };
        // Explicitly stringify JSONB fields for robustness, even though the pg driver often handles it.
        await db.query(
            'INSERT INTO delivery_zones (id, name, communes, pricing) VALUES ($1, $2, $3, $4)',
            [newZone.id, newZone.name, JSON.stringify(newZone.communes), JSON.stringify(newZone.pricing)]
        );
        res.status(201).json(newZone);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al crear la zona.' });
    }
});

// PUT /api/zones/:id
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { name, communes, pricing } = req.body;
    try {
        // Explicitly stringify JSONB fields for robustness.
        await db.query(
            'UPDATE delivery_zones SET name = $1, communes = $2, pricing = $3 WHERE id = $4',
            [name, JSON.stringify(communes), JSON.stringify(pricing), id]
        );
        res.json({ id, name, communes, pricing });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar la zona.' });
    }
});

// DELETE /api/zones/:id
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM delivery_zones WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar la zona.' });
    }
});

module.exports = router;