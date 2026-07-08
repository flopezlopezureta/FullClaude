// routes/gis.js — CRUD de sectores GIS personalizados
// Los sectores se persisten en la base de datos (tabla: gis_sectors)
// El gisService los usa con prioridad sobre comunas_rm.geojson

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { logAction } = require('../services/logger');
const gisService = require('../services/gisService');
const db = require('../db');

const COMUNAS_FILE = path.join(__dirname, '../scripts/comunas_rm.geojson');

// Admin-only guard
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    next();
};

let comunasCache = null;
function getComunasGeojson() {
    if (!comunasCache) {
        try {
            if (fs.existsSync(COMUNAS_FILE)) {
                comunasCache = JSON.parse(fs.readFileSync(COMUNAS_FILE, 'utf8'));
            }
        } catch (e) { console.error('[GIS Route] Failed to load comunas_rm.geojson:', e); }
    }
    return comunasCache;
}

// Helper: read sectors from DB
async function readSectors(comuna) {
    try {
        let q = 'SELECT * FROM gis_sectors';
        let params = [];
        if (comuna) {
            q += ' WHERE LOWER(comuna) = LOWER($1)';
            params.push(comuna);
        }
        const { rows } = await db.query(q, params);
        return rows;
    } catch (e) {
        console.error('[GIS Route] Error reading sectors from DB:', e);
        return [];
    }
}

// ─── GET /api/gis/comunas ─────────────────────────────────────────────────────
// Devuelve la lista de nombres de comunas disponibles
router.get('/comunas', authMiddleware, (req, res) => {
    const geojson = getComunasGeojson();
    if (!geojson) return res.status(404).json({ message: 'GeoJSON no disponible.' });
    const names = geojson.features.map(f => f.properties.Comuna).filter(Boolean).sort();
    res.json(names);
});

// ─── GET /api/gis/comunas/:name/geometry ────────────────────────────────────
// Devuelve el GeoJSON feature de una comuna específica (para pintar el límite)
router.get('/comunas/:name/geometry', authMiddleware, (req, res) => {
    const geojson = getComunasGeojson();
    if (!geojson) return res.status(404).json({ message: 'GeoJSON no disponible.' });
    const name = req.params.name.toLowerCase();
    const feature = geojson.features.find(f => (f.properties.Comuna || '').toLowerCase() === name);
    if (!feature) return res.status(404).json({ message: `Comuna "${req.params.name}" no encontrada.` });
    res.json(feature);
});

// ─── GET /api/gis/sectors ────────────────────────────────────────────────────
// Devuelve todos los sectores (opcionalmente filtrados por ?comuna=)
router.get('/sectors', authMiddleware, async (req, res) => {
    try {
        const sectors = await readSectors(req.query.comuna);
        res.json(sectors);
    } catch (e) {
        res.status(500).json({ message: 'Error al leer sectores.' });
    }
});

// ─── GET /api/gis/sectors/comunas ────────────────────────────────────────────
// Devuelve lista de comunas que tienen al menos un sector definido, con count
router.get('/sectors/comunas', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT comuna, COUNT(*) as count FROM gis_sectors GROUP BY comuna'
        );
        const result = rows.map(r => ({ comuna: r.comuna, count: parseInt(r.count) }));
        res.json(result);
    } catch (e) {
        res.status(500).json({ message: 'Error al leer sectores.' });
    }
});

// ─── POST /api/gis/sectors ───────────────────────────────────────────────────
// Crea un nuevo sector con geometría dibujada en el frontend
router.post('/sectors', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { comuna, sector, geometry } = req.body;
        if (!comuna || !sector || !geometry) {
            return res.status(400).json({ message: 'comuna, sector y geometry son requeridos.' });
        }

        const id = uuidv4();
        const createdAt = new Date().toISOString();
        await db.query(
            'INSERT INTO gis_sectors (id, comuna, sector, geometry, "createdAt") VALUES ($1, $2, $3, $4, $5)',
            [id, comuna.trim(), sector.trim(), JSON.stringify(geometry), createdAt]
        );

        // Reload gisService in-memory cache
        if (typeof gisService.reloadSectors === 'function') await gisService.reloadSectors();

        logAction(req.user.id, req.user.name, 'CREATE_GIS_SECTOR', { id, comuna, sector }).catch(() => {});
        
        res.status(201).json({
            id,
            comuna: comuna.trim(),
            sector: sector.trim(),
            geometry,
            createdAt
        });
    } catch (e) {
        console.error('[GIS Route] Error creating sector:', e);
        res.status(500).json({ message: 'Error al crear el sector.' });
    }
});

// ─── PUT /api/gis/sectors/:id ────────────────────────────────────────────────
// Renombra un sector (o actualiza su geometría)
router.put('/sectors/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { sector, geometry } = req.body;

        const { rows } = await db.query('SELECT * FROM gis_sectors WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Sector no encontrado.' });

        const updatedAt = new Date().toISOString();
        let q = 'UPDATE gis_sectors SET "updatedAt" = $1';
        let params = [updatedAt];
        let paramIdx = 2;

        if (sector) {
            q += `, sector = $${paramIdx++}`;
            params.push(sector.trim());
        }
        if (geometry) {
            q += `, geometry = $${paramIdx++}`;
            params.push(JSON.stringify(geometry));
        }
        q += ` WHERE id = $${paramIdx}`;
        params.push(id);

        await db.query(q, params);

        if (typeof gisService.reloadSectors === 'function') await gisService.reloadSectors();

        logAction(req.user.id, req.user.name, 'UPDATE_GIS_SECTOR', { id, sector }).catch(() => {});
        
        res.json({
            id,
            comuna: rows[0].comuna,
            sector: sector ? sector.trim() : rows[0].sector,
            geometry: geometry || rows[0].geometry,
            updatedAt
        });
    } catch (e) {
        console.error('[GIS Route] Error updating sector:', e);
        res.status(500).json({ message: 'Error al actualizar el sector.' });
    }
});

// ─── DELETE /api/gis/sectors/:id ─────────────────────────────────────────────
router.delete('/sectors/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { rowCount } = await db.query('DELETE FROM gis_sectors WHERE id = $1', [id]);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Sector no encontrado.' });
        }

        if (typeof gisService.reloadSectors === 'function') await gisService.reloadSectors();

        logAction(req.user.id, req.user.name, 'DELETE_GIS_SECTOR', { id }).catch(() => {});
        res.status(204).send();
    } catch (e) {
        console.error('[GIS Route] Error deleting sector:', e);
        res.status(500).json({ message: 'Error al eliminar el sector.' });
    }
});

module.exports = router;
