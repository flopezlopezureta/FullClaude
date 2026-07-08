// routes/gis.js — CRUD de sectores GIS personalizados
// Los sectores se persisten en scripts/sectors_custom.json
// El gisService los usa con prioridad sobre comunas_rm.geojson

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const { logAction } = require('../services/logger');
const gisService = require('../services/gisService');

const SECTORS_FILE = path.join(__dirname, '../scripts/sectors_custom.json');
const COMUNAS_FILE = path.join(__dirname, '../scripts/comunas_rm.geojson');

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


// Admin-only guard
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    next();
};

// Helper: read sectors file
function readSectors() {
    try {
        if (!fs.existsSync(SECTORS_FILE)) return [];
        return JSON.parse(fs.readFileSync(SECTORS_FILE, 'utf8'));
    } catch (e) {
        console.error('[GIS Route] Error reading sectors_custom.json:', e);
        return [];
    }
}

// Helper: write sectors file
function writeSectors(sectors) {
    fs.writeFileSync(SECTORS_FILE, JSON.stringify(sectors, null, 2), 'utf8');
}

// ─── GET /api/gis/sectors ────────────────────────────────────────────────────
// Devuelve todos los sectores (opcionalmente filtrados por ?comuna=)
router.get('/sectors', authMiddleware, (req, res) => {
    try {
        let sectors = readSectors();
        if (req.query.comuna) {
            const q = req.query.comuna.toLowerCase();
            sectors = sectors.filter(s => s.comuna.toLowerCase() === q);
        }
        res.json(sectors);
    } catch (e) {
        res.status(500).json({ message: 'Error al leer sectores.' });
    }
});

// ─── GET /api/gis/sectors/comunas ────────────────────────────────────────────
// Devuelve lista de comunas que tienen al menos un sector definido, con count
router.get('/sectors/comunas', authMiddleware, (req, res) => {
    try {
        const sectors = readSectors();
        const counts = {};
        sectors.forEach(s => { counts[s.comuna] = (counts[s.comuna] || 0) + 1; });
        const result = Object.entries(counts).map(([comuna, count]) => ({ comuna, count }));
        res.json(result);
    } catch (e) {
        res.status(500).json({ message: 'Error al leer sectores.' });
    }
});

// ─── POST /api/gis/sectors ───────────────────────────────────────────────────
// Crea un nuevo sector con geometría dibujada en el frontend
router.post('/sectors', authMiddleware, adminOnly, (req, res) => {
    try {
        const { comuna, sector, geometry } = req.body;
        if (!comuna || !sector || !geometry) {
            return res.status(400).json({ message: 'comuna, sector y geometry son requeridos.' });
        }

        const sectors = readSectors();
        const newSector = {
            id: uuidv4(),
            comuna: comuna.trim(),
            sector: sector.trim(),
            geometry,
            createdAt: new Date().toISOString(),
        };

        sectors.push(newSector);
        writeSectors(sectors);

        // Reload gisService in-memory cache
        if (typeof gisService.reloadSectors === 'function') gisService.reloadSectors();

        logAction(req.user.id, req.user.name, 'CREATE_GIS_SECTOR', { id: newSector.id, comuna, sector }).catch(() => {});
        res.status(201).json(newSector);
    } catch (e) {
        console.error('[GIS Route] Error creating sector:', e);
        res.status(500).json({ message: 'Error al crear el sector.' });
    }
});

// ─── PUT /api/gis/sectors/:id ────────────────────────────────────────────────
// Renombra un sector (o actualiza su geometría)
router.put('/sectors/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const { id } = req.params;
        const { sector, geometry } = req.body;

        const sectors = readSectors();
        const idx = sectors.findIndex(s => s.id === id);
        if (idx === -1) return res.status(404).json({ message: 'Sector no encontrado.' });

        if (sector) sectors[idx].sector = sector.trim();
        if (geometry) sectors[idx].geometry = geometry;
        sectors[idx].updatedAt = new Date().toISOString();

        writeSectors(sectors);
        if (typeof gisService.reloadSectors === 'function') gisService.reloadSectors();

        logAction(req.user.id, req.user.name, 'UPDATE_GIS_SECTOR', { id, sector }).catch(() => {});
        res.json(sectors[idx]);
    } catch (e) {
        console.error('[GIS Route] Error updating sector:', e);
        res.status(500).json({ message: 'Error al actualizar el sector.' });
    }
});

// ─── DELETE /api/gis/sectors/:id ─────────────────────────────────────────────
router.delete('/sectors/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const { id } = req.params;
        const sectors = readSectors();
        const filtered = sectors.filter(s => s.id !== id);

        if (filtered.length === sectors.length) {
            return res.status(404).json({ message: 'Sector no encontrado.' });
        }

        writeSectors(filtered);
        if (typeof gisService.reloadSectors === 'function') gisService.reloadSectors();

        logAction(req.user.id, req.user.name, 'DELETE_GIS_SECTOR', { id }).catch(() => {});
        res.status(204).send();
    } catch (e) {
        console.error('[GIS Route] Error deleting sector:', e);
        res.status(500).json({ message: 'Error al eliminar el sector.' });
    }
});

module.exports = router;
