// Fotos de evidencia repetidas en el cierre de una entrega, en el servidor.
//
// Quien cierra desde su casa cumplía la exigencia de «2 fotos» mandando la MISMA foto dos veces. El servidor no decodifica imágenes (no tiene librería para eso), así
// que solo puede reconocer la foto idéntica byte a byte: compara el SHA-256 de los bytes de cada imagen, no el texto base64 (el mismo archivo puede venir con otro
// encabezado «data:image/…» o con saltos de línea y es la misma foto). Las tomas casi iguales las frena el formulario del teléfono (utils/photoSimilarity.ts).

const crypto = require('crypto');

// Código que devuelve POST /packages/:id/deliver (HTTP 400) cuando las fotos de evidencia son la misma imagen repetida.
const DUPLICATE_PHOTOS = 'DUPLICATE_PHOTOS';

/** SHA-256 (hex) de los bytes de la imagen: lo que viene después de la coma de «data:image/jpeg;base64,…». */
function photoDigest(dataUri) {
    const text = typeof dataUri === 'string' ? dataUri : '';
    const comma = text.indexOf(',');
    return crypto.createHash('sha256').update(Buffer.from(comma === -1 ? text : text.slice(comma + 1), 'base64')).digest('hex');
}

/** Cuántas imágenes DISTINTAS (byte a byte) hay en la lista. */
function distinctPhotoCount(photos) {
    if (!Array.isArray(photos)) return 0;
    return new Set(photos.map(photoDigest)).size;
}

/** Mensaje para el conductor cuando las fotos no alcanzan a ser `needed` imágenes distintas. */
function duplicatePhotosMessage(needed) {
    return `Las fotos de evidencia son la misma imagen repetida. Se necesitan ${needed} fotos distintas: toma otra foto del lugar de la entrega.`;
}

module.exports = { DUPLICATE_PHOTOS, photoDigest, distinctPhotoCount, duplicatePhotosMessage };
