/**
 * Respuesta de respaldo del SPA (la pantalla de la app) para el servidor de producción.
 *
 * Cualquier GET que no sea API ni un archivo real de /dist cae aquí. Las rutas de la app (/, /tracking/..., etc.) deben recibir el
 * index.html. Pero un ARCHIVO ESTÁTICO que no existe (p. ej. el archivo principal recién compilado, /assets/index-xxxx.js, pedido
 * mientras el contenedor anterior todavía atendía durante un despliegue) NO debe recibir esa página HTML con código 200: Cloudflare
 * la guardaba 24 horas bajo la dirección del .js, los navegadores y los service workers de los teléfonos la guardaban como si fuera
 * el JavaScript y la pantalla quedaba en blanco ("Failed to load module script ... MIME type text/html"). Con un 404 sin caché,
 * el navegador solo ve un error, el service worker (Workbox) falla la instalación en vez de guardar una página HTML como archivo,
 * y la pantalla puede recuperarse sola (ver el bloque de auto-recuperación de index.html).
 */
const path = require('path');

// Extensiones que nunca son una ruta de la app: si el archivo no existe, la respuesta correcta es 404.
const STATIC_FILE_EXT = /\.(?:js|mjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|json|webmanifest|txt|xml|pdf|apk|zip|mp3|mp4|wav|webm)$/i;

const isStaticAssetPath = (requestPath) =>
    typeof requestPath === 'string' && (requestPath.startsWith('/assets/') || STATIC_FILE_EXT.test(requestPath));

const createSpaFallback = (distPath) => (req, res) => {
    if (isStaticAssetPath(req.path)) {
        res.status(404).set('Cache-Control', 'no-store').type('text/plain').send('Not found');
        return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
};

module.exports = { isStaticAssetPath, createSpaFallback };
