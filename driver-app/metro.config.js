const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Agregamos soporte explícito para resolución de archivos .ts y .tsx si no están
config.resolver.sourceExts.push('ts', 'tsx', 'js', 'jsx', 'json');

module.exports = config;
