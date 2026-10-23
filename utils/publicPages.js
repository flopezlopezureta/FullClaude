/**
 * Páginas públicas estáticas (SEO) que sirve el servidor: /fullenvios, /software-ruteo-ecommerce.
 *
 * El archivo fuente vive en public/, pero la imagen de producción (Dockerfile, etapa "runner") copia SOLO dist/ — Vite copia el
 * contenido de public/ dentro de dist/ al compilar —, así que en producción el archivo está en dist/ y public/ no existe: leerlo de
 * public/ daba 404 ("Error" de Express) en el servidor aunque funcionara en el computador de desarrollo. En producción se busca primero
 * en dist/ y en desarrollo primero en public/; si no está en ninguno responde 404 sin caché (nunca la pantalla de la app).
 */
const fs = require('fs');
const path = require('path');

const resolvePublicPage = (rootDir, fileName, isProduction) => {
    const order = isProduction ? ['dist', 'public'] : ['public', 'dist'];
    for (const dir of order) {
        const candidate = path.join(rootDir, dir, fileName);
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
};

const servePublicPage = (rootDir, fileName) => (req, res) => {
    const file = resolvePublicPage(rootDir, fileName, process.env.NODE_ENV === 'production');
    if (!file) {
        res.status(404).set('Cache-Control', 'no-store').type('text/plain').send('Not found');
        return;
    }
    res.set('Cache-Control', 'public, max-age=300').sendFile(file);
};

module.exports = { resolvePublicPage, servePublicPage };
