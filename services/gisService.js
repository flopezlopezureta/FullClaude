const fs = require('fs');
const path = require('path');

let geojson = null;

// Load comunas_rm.geojson on startup
try {
    const filePath = path.join(__dirname, '../scripts/comunas_rm.geojson');
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        geojson = JSON.parse(fileContent);
        console.log(`[GIS Service] Loaded ${geojson.features.length} comunas/sectors from GeoJSON.`);
    } else {
        console.warn(`[GIS Service] comunas_rm.geojson not found at ${filePath}. Spatial sector validation will be disabled.`);
    }
} catch (e) {
    console.error('[GIS Service] Failed to load GeoJSON:', e);
}

/**
 * Ray-Casting Algorithm to detect if a point is inside a polygon.
 * @param {Array} point [longitude, latitude]
 * @param {Array} vs vertices of polygon ring [[lon1, lat1], [lon2, lat2], ...]
 */
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

/**
 * Checks if a point is inside a Geometry (Polygon or MultiPolygon).
 */
function isPointInGeometry(point, geometry) {
    if (geometry.type === 'Polygon') {
        return isPointInPolygon(point, geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
        for (const polygonCoords of geometry.coordinates) {
            if (polygonCoords && polygonCoords[0]) {
                if (isPointInPolygon(point, polygonCoords[0])) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Resolves the Comuna and custom Sector name for a set of coordinates.
 * @param {number|string} lat Latitude
 * @param {number|string} lon Longitude
 * @returns {string|null} Format: "Comuna (Sector)" or "Comuna" or null
 */
function getSectorForCoordinates(lat, lon) {
    if (!geojson || !lat || !lon) return null;
    const pLat = parseFloat(lat);
    const pLon = parseFloat(lon);
    
    if (isNaN(pLat) || isNaN(pLon)) return null;
    const point = [pLon, pLat];
    
    for (const feature of geojson.features) {
        if (feature.geometry && isPointInGeometry(point, feature.geometry)) {
            const comuna = feature.properties.Comuna || '';
            const sector = feature.properties.Sector || '';
            return sector ? `${comuna} (${sector})` : comuna;
        }
    }
    return null;
}

function getSectorDetailsForCoordinates(lat, lon) {
    if (!geojson || !lat || !lon) return null;
    const pLat = parseFloat(lat);
    const pLon = parseFloat(lon);
    
    if (isNaN(pLat) || isNaN(pLon)) return null;
    const point = [pLon, pLat];
    
    for (const feature of geojson.features) {
        if (feature.geometry && isPointInGeometry(point, feature.geometry)) {
            const comuna = feature.properties.Comuna || '';
            const sector = feature.properties.Sector || '';
            return {
                comuna,
                sector: sector || comuna,
                sectorLabel: sector ? `${comuna} (${sector})` : comuna,
                geometry: feature.geometry
            };
        }
    }
    return null;
}

module.exports = {
    getSectorForCoordinates,
    getSectorDetailsForCoordinates
};
