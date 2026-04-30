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
    
    return normalized.split('').map(char => map[char] || char).join('');
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
