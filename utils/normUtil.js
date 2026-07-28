/**
 * Utility functions for data normalization across the system.
 */

/**
 * Normalizes a commune name:
 * 1. Trims whitespace
 * 2. Converts to Uppercase
 * 3. Removes accents (Optional, keeping it conservative for now)
 * @param {string} commune 
 * @returns {string}
 */
const normalizeCommune = (commune) => {
    if (!commune) return 'SIN COMUNA';
    
    let normalized = commune.trim().toUpperCase();
    
    // Replace accents but keep Ñ
    const map = {
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
        'Ä': 'A', 'Ë': 'E', 'Ï': 'I', 'Ö': 'O', 'Ü': 'U'
    };
    
    let clean = normalized.split('').map(char => map[char] || char).join('');
    
    // Handle N/Ñ variations, accents, and aliases to match canonical names with correct accents
    if (clean === 'PENALOLEN' || clean === 'PEÑALOLEN') return 'PEÑALOLÉN';
    if (clean === 'NUNOA') return 'ÑUÑOA';
    if (clean === 'PENAFLOR') return 'PEÑAFLOR';
    if (clean === 'SAN JOAQUIN') return 'SAN JOAQUÍN';
    if (clean === 'SAN RAMON') return 'SAN RAMÓN';
    if (clean === 'MAIPU') return 'MAIPÚ';
    if (clean === 'ESTACION CENTRAL') return 'ESTACIÓN CENTRAL';
    if (clean === 'CONCHALI') return 'CONCHALÍ';
    if (clean === 'CURACAVI') return 'CURACAVÍ';
    if (clean === 'SAN JOSE DE MAIPO') return 'SAN JOSÉ DE MAIPO';
    if (clean === 'MARIA PINTO') return 'MARÍA PINTO';
    if (clean === 'ALHUE') return 'ALHUÉ';
    if (clean === 'SANTIAGO CENTRO' || clean === 'STGO CENTRO' || clean === 'STGO') return 'SANTIAGO';
    
    // For other communes, if we have a direct match in RM_COMMUNES (e.g. they came with accents), we keep the accent.
    // However, since clean has accents removed, let's restore them if they are in RM_COMMUNES.
    const RM_COMMUNES = [
        "SANTIAGO", "LAS CONDES", "VITACURA", "LO BARNECHEA", "PROVIDENCIA", "ÑUÑOA", "LA REINA", 
        "MACUL", "PEÑALOLÉN", "LA FLORIDA", "SAN JOAQUÍN", "LA GRANJA", "SAN RAMÓN", "LA CISTERNA", 
        "EL BOSQUE", "SAN MIGUEL", "LO ESPEJO", "PEDRO AGUIRRE CERDA", "CERRILLOS", "MAIPÚ", 
        "ESTACIÓN CENTRAL", "QUINTA NORMAL", "LO PRADO", "CERRO NAVIA", "RENCA", "INDEPENDENCIA", 
        "RECOLETA", "CONCHALÍ", "HUECHURABA", "QUILICURA", "PUDAHUEL", "LA PINTANA", "SAN BERNARDO", 
        "PUENTE ALTO", "LAMPA", "COLINA", "BUIN", "PAINE", "PEÑAFLOR", "TALAGANTE", "MELIPILLA", 
        "CURACAVÍ", "PIRQUE", "SAN JOSÉ DE MAIPO", "CALERA DE TANGO", "PADRE HURTADO", "EL MONTE", 
        "ISLA DE MAIPO", "MARÍA PINTO", "SAN PEDRO", "ALHUÉ"
    ];
    
    // Helper mapper to find the canonical name
    const canonicalMap = {};
    for (const rm of RM_COMMUNES) {
        // Strip accents to map from clean
        const rmNormalized = rm.split('').map(char => map[char] || char).join('');
        canonicalMap[rmNormalized] = rm;
    }
    
    return canonicalMap[clean] || clean;
};

/**
 * Normalizes a city name.
 * @param {string} city 
 * @returns {string}
 */
const normalizeCity = (city) => {
    if (!city) return 'SANTIAGO';
    return city.trim().toUpperCase();
};

module.exports = {
    normalizeCommune,
    normalizeCity
};
