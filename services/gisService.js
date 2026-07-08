// services/gisService.js
// Servicio GIS con prioridad: sectores custom > comunas RM base

const fs = require('fs');
const path = require('path');
const db = require('../db');

// ── Archivos de datos ─────────────────────────────────────────────────────────
const COMUNAS_FILE = path.join(__dirname, '../scripts/comunas_rm.geojson');

// ── Cache en memoria ──────────────────────────────────────────────────────────
let comunasGeojson = null;   // comunas_rm.geojson (polígonos de comunas base)
let customSectors = [];       // sectors_custom in DB (sectores definidos por admin)

// ── Carga inicial ─────────────────────────────────────────────────────────────
function loadComunas() {
    try {
        if (fs.existsSync(COMUNAS_FILE)) {
            const raw = fs.readFileSync(COMUNAS_FILE, 'utf8');
            comunasGeojson = JSON.parse(raw);
            console.log(`[GIS Service] Loaded ${comunasGeojson.features.length} comunas from GeoJSON.`);
        } else {
            console.warn('[GIS Service] comunas_rm.geojson not found. Spatial commune lookup disabled.');
        }
    } catch (e) {
        console.error('[GIS Service] Failed to load comunas_rm.geojson:', e);
    }
}

async function loadSectors() {
    try {
        const { rows } = await db.query('SELECT * FROM gis_sectors');
        customSectors = rows;
        console.log(`[GIS Service] Loaded ${customSectors.length} custom sectors from DB.`);
    } catch (e) {
        console.warn('[GIS Service] Failed to load custom sectors from DB (table might not exist yet).', e.message);
        customSectors = [];
    }
}

// Carga inicial al arrancar
loadComunas();
loadSectors().catch(() => {});

// ── Exportable para recarga en caliente (llamado desde routes/gis.js) ─────────
async function reloadSectors() {
    await loadSectors();
}

// ── Algoritmo Ray-Casting ─────────────────────────────────────────────────────
function isPointInPolygon(point, vs) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function isPointInGeometry(point, geometry) {
    if (!geometry) return false;
    if (geometry.type === 'Polygon') {
        return isPointInPolygon(point, geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
        for (const polygonCoords of geometry.coordinates) {
            if (polygonCoords && polygonCoords[0]) {
                if (isPointInPolygon(point, polygonCoords[0])) return true;
            }
        }
    }
    return false;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Retorna el nombre de sector para una coordenada.
 * Formato: "Las Condes (Norte)" o "Providencia" o null.
 */
function getSectorForCoordinates(lat, lon) {
    const result = getSectorDetailsForCoordinates(lat, lon);
    return result ? result.sectorLabel : null;
}

/**
 * Retorna objeto completo con comuna, sector, sectorLabel y geometry.
 * Prioridad: sectores custom → comunas base
 */
function getSectorDetailsForCoordinates(lat, lon) {
    if (!lat || !lon) return null;
    const pLat = parseFloat(lat);
    const pLon = parseFloat(lon);
    if (isNaN(pLat) || isNaN(pLon)) return null;

    const point = [pLon, pLat]; // GeoJSON usa [lon, lat]

    // 1️⃣ Buscar en sectores custom (mayor precisión)
    for (const s of customSectors) {
        if (s.geometry && isPointInGeometry(point, s.geometry)) {
            return {
                comuna: s.comuna,
                sector: s.sector,
                sectorLabel: `${s.comuna} (${s.sector})`,
                geometry: s.geometry,
            };
        }
    }

    // 2️⃣ Buscar en comunas base
    if (comunasGeojson) {
        for (const feature of comunasGeojson.features) {
            if (feature.geometry && isPointInGeometry(point, feature.geometry)) {
                const comuna = feature.properties.Comuna || '';
                const sector = feature.properties.Sector || '';
                return {
                    comuna,
                    sector: sector || comuna,
                    sectorLabel: sector ? `${comuna} (${sector})` : comuna,
                    geometry: feature.geometry,
                };
            }
        }
    }

    return null;
}

/**
 * Retorna el GeoJSON de una comuna por nombre (para el editor de sectores).
 */
function getComunaGeometry(comunaName) {
    if (!comunasGeojson) return null;
    const feature = comunasGeojson.features.find(
        f => (f.properties.Comuna || '').toLowerCase() === comunaName.toLowerCase()
    );
    return feature || null;
}

/**
 * Lista de todas las comunas disponibles en el GeoJSON base.
 */
function getAllComunas() {
    if (!comunasGeojson) return [];
    return comunasGeojson.features
        .map(f => f.properties.Comuna)
        .filter(Boolean)
        .sort();
}

module.exports = {
    getSectorForCoordinates,
    getSectorDetailsForCoordinates,
    getComunaGeometry,
    getAllComunas,
    reloadSectors,
};
