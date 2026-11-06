/**
 * Prueba de los CONTROLES DEL CIERRE DE ENTREGA: nombre de quien recibe sin sentido («.», una letra…) y fotos de evidencia repetidas.
 *   A. regla del nombre (services/receiverName.js)             B. huella exacta de las fotos (services/deliveryPhotos.js)
 *   C. la ruta real POST /api/packages/:id/deliver contra una base FALSA en memoria
 *   D. la regla del navegador (utils/receiverName.ts) da lo mismo que la del servidor
 *   E. la huella visual de las fotos (utils/photoSimilarity.ts, partes que no necesitan imagen)
 *   F. la cola sin conexión del conductor (services/offlineQueueProcessor.ts) no reintenta para siempre un cierre rechazado por sus datos
 * No toca ninguna base de datos real; todos los nombres y datos de aquí son inventados. En C cada consulta se interpreta a mano: una consulta no prevista hace fallar la prueba.
 *
 * Uso:   node tests/deliveryChecks.test.js
 *        HARNESS_ROOT=<carpeta con otra copia del código> node tests/deliveryChecks.test.js
 *        (otra copia = el código ANTERIOR, para comprobar que la prueba detecta el defecto, o el clon de Staging/Producción antes de subir)
 */
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const ROOT = path.resolve(process.env.HARNESS_ROOT || path.join(__dirname, '..'));
const load = (m) => require(require.resolve(m, { paths: [ROOT] }));
const express = load('express');
const jwt = load('jsonwebtoken');
const esbuild = load('esbuild');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba-local';

// ───────────── base falsa (solo lo que usa /deliver) ─────────────
let S;
const reset = () => { S = { packages: {}, events: [], logs: [], settings: { requiredPhotos: 2, meliFlexValidation: false, blockDeliveryOnMeliConfirmed: false }, updates: 0, unknown: [] }; };
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const R = (rows) => ({ rows, rowCount: rows.length });
const mkPkg = (id, over = {}) => ({ id, status: 'EN_TRANSITO', driverId: 'drv-1', creatorId: 'c1', source: 'MANUAL', recipientAddress: 'Calle Falsa 123', deliveryReceiverName: null, deliveryReceiverId: null, deliveryPhotosBase64: null, meliOrderId: null, meliFlexCode: null, sourceAccountId: null, jumpsellerOrderId: null, ...over });
const add = (id, over) => (S.packages[id] = mkPkg(id, over));
async function run(text, params = []) {
    const q = norm(text);
    if (/^INSERT INTO system_logs/.test(q)) { S.logs.push({ action: params[2], details: params[3] }); return R([]); }
    if (/^INSERT INTO tracking_events \("packageId", status, location, details, timestamp\) VALUES \(\$1, \$2, \$3, \$4, \$5\)$/.test(q)) { S.events.push({ packageId: params[0], status: params[1], details: params[3] }); return R([]); }
    if (/^SELECT \* FROM tracking_events WHERE "packageId" = \$1 ORDER BY timestamp DESC$/.test(q)) return R(S.events.filter(e => e.packageId === params[0]).reverse());
    if (/^SELECT "requiredPhotos" FROM system_settings WHERE id = 1$/.test(q)) return R([{ requiredPhotos: S.settings.requiredPhotos }]);
    if (/^SELECT status, "deliveryReceiverName", "deliveryReceiverId" FROM packages WHERE id = \$1$/.test(q)) { const p = S.packages[params[0]]; return R(p ? [{ status: p.status, deliveryReceiverName: p.deliveryReceiverName, deliveryReceiverId: p.deliveryReceiverId }] : []); }
    if (/^SELECT "deliveryPhotosBase64" FROM packages WHERE id = \$1$/.test(q)) { const p = S.packages[params[0]]; return R(p ? [{ deliveryPhotosBase64: p.deliveryPhotosBase64 }] : []); }
    if (/^SELECT \* FROM packages WHERE id = \$1$/.test(q)) { const p = S.packages[params[0]]; return R(p ? [{ ...p }] : []); }
    if (/^SELECT source, "falabellaDirectLpn", "driverId" FROM packages WHERE id = \$1$/.test(q)) { const p = S.packages[params[0]]; return R(p ? [{ source: p.source, falabellaDirectLpn: 'LPN-1', driverId: p.driverId }] : []); }
    if (/^SELECT "blockDeliveryOnMeliConfirmed" FROM system_settings WHERE id = 1$/.test(q)) return R([{ blockDeliveryOnMeliConfirmed: S.settings.blockDeliveryOnMeliConfirmed }]);
    if (/^SELECT "meliFlexValidation" FROM system_settings WHERE id = 1$/.test(q)) return R([{ meliFlexValidation: S.settings.meliFlexValidation }]);
    if (/^UPDATE packages SET status = \$1, "deliveryReceiverName" = \$2, "deliveryReceiverId" = \$3, "deliveryPhotosBase64" = \$4, "meliDeliveredNeedsPhotos" = false, "updatedAt" = \$5 WHERE id = \$6 RETURNING \*$/.test(q)) {
        const p = S.packages[params[5]]; if (!p) return R([]); S.updates++;
        Object.assign(p, { status: params[0], deliveryReceiverName: params[1], deliveryReceiverId: params[2], deliveryPhotosBase64: params[3], updatedAt: params[4] }); return R([{ ...p }]);
    }
    if (/^SELECT "meliOrderId", "creatorId", "meliFlexCode", "sourceAccountId" FROM packages WHERE id = \$1$/.test(q)) { const p = S.packages[params[0]]; return R(p ? [{ meliOrderId: p.meliOrderId, creatorId: p.creatorId, meliFlexCode: p.meliFlexCode, sourceAccountId: p.sourceAccountId }] : []); }
    S.unknown.push(q); throw new Error('Consulta no prevista en la base falsa: ' + q.slice(0, 200));
}
const stub = (rel, exports) => { const p = require.resolve(path.join(ROOT, rel)); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
stub('db.js', { query: (t, p) => run(t, p), getClient: async () => { throw new Error('no se usa'); } });
stub('services/notificationService.js', { notifyRecipient: () => Promise.resolve(), notifyRecipientsBulk: () => Promise.resolve(), notifyAdminPendingDelivery: () => Promise.resolve() });
stub('services/meliPollingService.js', { optimizedJITDiscovery: async () => null, getValidMeliToken: async () => 'TOKEN-1' });
stub('services/jumpsellerPollingService.js', {});
stub('services/geocodingService.js', { geocodeAddress: async () => null, triggerBackgroundGeocoding: () => {} });
stub('services/gisService.js', { getSectorForCoordinates: () => 'Sector de prueba', reloadSectors: async () => {} });
stub('services/timeService.js', { getLogicalDate: async (d) => (d ? new Date(d) : new Date()).toISOString().slice(0, 10), getSystemTimezone: async () => 'America/Santiago', getLogicalRange: async () => ({ start: new Date(), end: new Date() }), getLogicalTodayRange: async () => ({ start: new Date(), nextDayStart: new Date() }) });
stub('services/falabellaDirectService.js', { getOrderByLpn: async () => { throw new Error('no debe llamarse'); }, pushStatusUpdate: async () => {} });
stub('services/driverEvents.js', { emitDriverEvent: () => {}, bus: new (require('events'))() });

const tests = []; const t = (name, fn) => tests.push([name, fn]);
// En el código anterior (HARNESS_ROOT) estos módulos no existen: las pruebas que los usan fallan por eso, que es justo lo que debe verse.
const tryLoad = (rel) => { try { return require(path.join(ROOT, rel)); } catch (e) { return null; } };
const names = tryLoad('services/receiverName.js');
const photos = tryLoad('services/deliveryPhotos.js');
const need = (mod, rel) => assert.ok(mod, 'no existe ' + rel);

// datos de prueba: «fotos» mínimas pero con firma real de PNG/JPEG (el servidor revisa los primeros bytes) y contenido distinto entre sí
const png = (n) => 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.from('foto-' + n + '-abcdefgh')]).toString('base64');
const jpg = (n) => 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from('foto-' + n + '-abcdefghijkl')]).toString('base64');

// ───────────── A. regla del nombre ─────────────
const GOOD_NAMES = ['Juan', 'Ana', 'María José', 'Rosa', 'José', 'Conserje', 'Conserjería', 'Portería', 'Porteria', 'Titular', 'Vecino', 'Familiar', 'Cliente', 'Juan Pérez', 'Ana Li',
    'A. Pérez', 'Pepe', 'Wu Xi', '  juan   perez  ', 'Marcelo (conserje)', 'Depto 304 Juan', 'Sr. González', 'DON JOSÉ', 'Ñancupil', 'Raúl', 'Luis'];
const BAD_NAMES = { EMPTY: ['', '   ', null, undefined],
    NO_LETTERS: ['.', '..', '...', '  .  ', '-', '???', '12', '304', '#', '0'],
    TOO_SHORT: ['m', 'c', 'J', 'ab', 'Jo', '.m.', 'x1', 'N N'.replace(' ', '')],
    INITIALS_ONLY: ['a b c', 'J P M', 'A. B. C.'],
    REPEATED: ['aaa', 'xxxx', 'AAAA', 'jajaja', 'lalala', 'ñññ', 'a.a.a'],
    PLACEHOLDER: ['asd', 'ASDF', 'qwerty', 'abc', 'xyz', 'test', 'Prueba', 'no sabe', 'No se', 'sin nombre', 'Sin  Nombre', 'ninguno', 'por', 'Con', 'Sin', 'Nadie', 'desconocido', 'Anónimo'] };
t('A1 los nombres reales y quién fue (conserje, vecino, titular…) pasan; un nombre de pila solo también', () => {
    need(names, 'services/receiverName.js');
    for (const n of GOOD_NAMES) assert.strictEqual(names.receiverNameProblem(n), null, JSON.stringify(n));
});
t('A2 cada tipo de nombre sin sentido se rechaza con su motivo', () => {
    need(names, 'services/receiverName.js');
    for (const [reason, list] of Object.entries(BAD_NAMES)) for (const n of list) assert.strictEqual(names.receiverNameProblem(n), reason, JSON.stringify(n));
});
t('A3 los mensajes dicen qué escribir (conserje, vecino o familiar) y no hay mensaje si el nombre sirve', () => {
    need(names, 'services/receiverName.js');
    assert.strictEqual(names.receiverNameMessage(null), null);
    for (const reason of ['NO_LETTERS', 'TOO_SHORT', 'INITIALS_ONLY', 'REPEATED', 'PLACEHOLDER']) assert.ok(/Conserje/.test(names.receiverNameMessage(reason)) && /Vecino/.test(names.receiverNameMessage(reason)), reason);
    assert.ok(/3 letras/.test(names.receiverNameMessage('TOO_SHORT')));
    assert.ok(/no parece un nombre real/.test(names.receiverNameMessage('REPEATED')));
});
t('A4 no se rechaza un nombre solo por tener tildes, ñ, guion o mayúsculas raras', () => {
    need(names, 'services/receiverName.js');
    for (const n of ['MUÑOZ', 'Ñuñoa Pérez', 'María-José', 'o\'Higgins', 'Zúñiga', 'ÁNGEL']) assert.strictEqual(names.receiverNameProblem(n), null, n);
});

// ───────────── B. huella exacta de las fotos ─────────────
t('B1 la misma imagen es la misma foto aunque cambie el encabezado data: o haya saltos de línea en el base64', () => {
    need(photos, 'services/deliveryPhotos.js');
    const a = png(1); const b64 = a.split(',')[1];
    assert.strictEqual(photos.photoDigest(a), photos.photoDigest('data:image/webp;base64,' + b64));
    assert.strictEqual(photos.photoDigest(a), photos.photoDigest('data:image/png;base64,' + b64.slice(0, 10) + '\n' + b64.slice(10)));
    assert.notStrictEqual(photos.photoDigest(png(1)), photos.photoDigest(png(2)));
});
t('B2 se cuentan las imágenes DISTINTAS de la lista', () => {
    need(photos, 'services/deliveryPhotos.js');
    assert.strictEqual(photos.distinctPhotoCount([png(1), png(1)]), 1);
    assert.strictEqual(photos.distinctPhotoCount([png(1), jpg(2), png(1)]), 2);
    assert.strictEqual(photos.distinctPhotoCount([]), 0);
    assert.strictEqual(photos.distinctPhotoCount(null), 0);
    assert.ok(/2 fotos distintas/.test(photos.duplicatePhotosMessage(2)));
});

// ───────────── C. la ruta real /deliver ─────────────
let call; let server;
const deliver = (id, body, role = 'DRIVER', uid = 'drv-1') => call('POST', `/packages/${id}/deliver`, body, role, uid);
const good = (over = {}) => ({ receiverName: 'Ana Receptora', receiverId: '', photosBase64: [png(1), png(2)], ...over });
t('C1 nombre «.» → 400 INVALID_RECEIVER_NAME y el paquete NO se cierra', async () => {
    add('P1'); const r = await deliver('P1', good({ receiverName: '.' }));
    assert.strictEqual(r.status, 400, JSON.stringify(r.body)); assert.strictEqual(r.body.code, 'INVALID_RECEIVER_NAME'); assert.ok(/Conserje/.test(r.body.message), r.body.message);
    assert.strictEqual(S.packages.P1.status, 'EN_TRANSITO'); assert.strictEqual(S.updates, 0);
});
t('C2 nombre de una letra, relleno o teclazos → 400; un nombre real o «Conserje» → 200', async () => {
    for (const n of ['m', 'c', 'aaa', 'asd', 'por', '12']) { add('P2'); const r = await deliver('P2', good({ receiverName: n })); assert.strictEqual(r.status, 400, n + ' ' + JSON.stringify(r.body)); assert.strictEqual(S.packages.P2.status, 'EN_TRANSITO', n); }
    for (const n of ['Juan', 'Conserje', 'Ana Pérez']) { add('P3'); const r = await deliver('P3', good({ receiverName: n })); assert.strictEqual(r.status, 200, n + ' ' + JSON.stringify(r.body)); assert.strictEqual(S.packages.P3.deliveryReceiverName, n); }
});
t('C3 las 2 fotos son la misma imagen → 400 DUPLICATE_PHOTOS y el paquete NO se cierra', async () => {
    add('P4'); const r = await deliver('P4', good({ photosBase64: [png(7), png(7)] }));
    assert.strictEqual(r.status, 400, JSON.stringify(r.body)); assert.strictEqual(r.body.code, 'DUPLICATE_PHOTOS'); assert.ok(/2 fotos distintas/.test(r.body.message), r.body.message);
    assert.strictEqual(S.packages.P4.status, 'EN_TRANSITO'); assert.strictEqual(S.updates, 0);
});
t('C4 dos fotos distintas y nombre real → 200, ENTREGADO, y se guarda exactamente lo enviado', async () => {
    add('P5'); const sent = good({ receiverName: 'Pedro Soto', photosBase64: [png(1), jpg(2)] }); const r = await deliver('P5', sent);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body)); assert.strictEqual(S.packages.P5.status, 'ENTREGADO');
    assert.strictEqual(S.packages.P5.deliveryReceiverName, 'Pedro Soto'); assert.strictEqual(S.packages.P5.deliveryPhotosBase64, JSON.stringify(sent.photosBase64));
});
t('C5 si el cliente pide 1 foto, una sola foto basta', async () => {
    S.settings.requiredPhotos = 1; add('P6'); const r = await deliver('P6', good({ photosBase64: [png(1)] }));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
});
t('C6 si el cliente pide 2 fotos y mandan 3 con una repetida, hay 2 distintas: se acepta', async () => {
    add('P7'); const r = await deliver('P7', good({ photosBase64: [png(1), png(1), png(2)] }));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
});
t('C7 Falabella Directo exige 2 fotos DISTINTAS aunque el cliente pida solo 1', async () => {
    S.settings.requiredPhotos = 1; add('P8', { source: 'FALABELLA_DIRECTO' });
    const r = await deliver('P8', good({ photosBase64: [png(3), png(3)], receiverId: '12.345.678-5' }));
    assert.strictEqual(r.status, 400, JSON.stringify(r.body)); assert.strictEqual(r.body.code, 'DUPLICATE_PHOTOS');
});
t('C8 un cierre REPETIDO de uno ya guardado (aunque tenga el nombre o las fotos de antes del control) se responde OK sin juzgarlo de nuevo', async () => {
    const sent = good({ receiverName: '.', photosBase64: [png(5), png(5)] });
    add('P9', { status: 'ENTREGADO', deliveryReceiverName: '.', deliveryReceiverId: '', deliveryPhotosBase64: JSON.stringify(sent.photosBase64) });
    S.packages.P9.deliveryPhotosBase64 = sent.photosBase64;           // la columna jsonb vuelve como arreglo
    const r = await deliver('P9', sent);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body)); assert.strictEqual(S.updates, 0, 'no debe reprocesar nada');
});
t('C9 una corrección real de un paquete ya entregado SÍ pasa por los controles', async () => {
    add('P10', { status: 'ENTREGADO', deliveryReceiverName: 'Ana Receptora', deliveryReceiverId: '', deliveryPhotosBase64: [png(1), png(2)] });
    const r = await deliver('P10', good({ receiverName: 'x' }));
    assert.strictEqual(r.status, 400, JSON.stringify(r.body)); assert.strictEqual(r.body.code, 'INVALID_RECEIVER_NAME');
});
t('C10 si la configuración no pide fotos (0), un cierre sin fotos sigue pasando con un nombre válido', async () => {
    S.settings.requiredPhotos = 0; add('P11'); const r = await deliver('P11', good({ photosBase64: [] }));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
});
t('C11 el nombre vacío y la falta de fotos siguen dando los mensajes de siempre', async () => {
    add('P12'); let r = await deliver('P12', good({ receiverName: '  ' })); assert.strictEqual(r.status, 400); assert.ok(/obligatorio/.test(r.body.message), r.body.message);
    r = await deliver('P12', good({ photosBase64: [png(1)] })); assert.strictEqual(r.status, 400); assert.ok(/al menos 2 fotos/.test(r.body.message), r.body.message);
});
t('C12 también aplica al cierre administrativo (mismo servicio) y no cambia los códigos de error del resto', async () => {
    add('P13'); let r = await deliver('P13', good({ receiverName: '.' }), 'ADMIN', 'adm-1'); assert.strictEqual(r.status, 400); assert.strictEqual(r.body.code, 'INVALID_RECEIVER_NAME');
    r = await deliver('P13', good({ photosBase64: ['no-es-una-foto', 'tampoco'] }), 'ADMIN', 'adm-1'); assert.strictEqual(r.status, 400); assert.ok(/imagen válido/.test(r.body.message), r.body.message);
});

// ───────────── D. el navegador y el servidor opinan igual sobre el nombre ─────────────
const tsModule = (rel) => { const code = esbuild.transformSync(fs.readFileSync(path.join(ROOT, rel), 'utf8'), { loader: 'ts', format: 'cjs' }).code; const m = { exports: {} }; new Function('module', 'exports', 'require', code)(m, m.exports, require); return m.exports; };
t('D1 utils/receiverName.ts y services/receiverName.js dan el mismo motivo y el mismo mensaje en cada nombre de prueba', () => {
    need(names, 'services/receiverName.js'); const web = tsModule('utils/receiverName.ts');
    const all = [...GOOD_NAMES, ...Object.values(BAD_NAMES).flat()];
    for (const n of all) {
        assert.strictEqual(web.receiverNameProblem(n), names.receiverNameProblem(n), JSON.stringify(n));
        assert.strictEqual(web.receiverNameMessage(web.receiverNameProblem(n)), names.receiverNameMessage(names.receiverNameProblem(n)), JSON.stringify(n));
    }
});
t('D2 ... y en 30.000 textos al azar (letras con tildes, espacios, signos, números, rellenos conocidos)', () => {
    need(names, 'services/receiverName.js'); const web = tsModule('utils/receiverName.ts');
    let seed = 20261103; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const alphabet = 'aaaabcdeeeefghiiijklmnñooopqrsstuuvwxyzáéíóúüÁÑ  ..-_/0123456789!?'.split('');
    const known = ['asd', 'qwerty', 'por', 'sin nombre', 'jajaja', 'aaa', 'abc', 'No sabe', 'Conserje'];
    for (let i = 0; i < 30000; i++) {
        const s = rnd() < 0.15 ? known[Math.floor(rnd() * known.length)] : Array.from({ length: Math.floor(rnd() * 14) }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join('');
        assert.strictEqual(web.receiverNameProblem(s), names.receiverNameProblem(s), JSON.stringify(s));
        assert.strictEqual(web.receiverNameErrorMessage(s), s.trim() ? names.receiverNameMessage(names.receiverNameProblem(s)) : null, JSON.stringify(s));
    }
});

// ───────────── E. huella visual de las fotos (la parte que no necesita una imagen real) ─────────────
const gray = (fn) => Float64Array.from({ length: 1024 }, (_, i) => fn(i % 32, Math.floor(i / 32)));
const sceneOf = (seed) => { // imagen sintética con "objetos" (manchas) en posiciones y brillos propios
    let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const blobs = Array.from({ length: 7 }, () => ({ x: rnd() * 32, y: rnd() * 32, r: 3 + rnd() * 8, v: (rnd() - 0.5) * 220 }));
    return (x, y) => 110 + blobs.reduce((acc, b) => acc + b.v * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.r * b.r)), 0);
};
t('E1 la distancia entre huellas cuenta bits', () => {
    const ps = tsModule('utils/photoSimilarity.ts');
    assert.strictEqual(ps.bitDistance('0000000000000000', 'ffffffffffffffff'), 64);
    assert.strictEqual(ps.bitDistance('f000000000000000', '0000000000000000'), 4);
    assert.strictEqual(ps.bitDistance('0123456789abcdef', '0123456789abcdef'), 0);
    assert.strictEqual(ps.bitDistance('0123456789abcdef', 'fedcba9876543210'), ps.bitDistance('fedcba9876543210', '0123456789abcdef'));
});
t('E2 la misma imagen, con otro brillo, más contraste o un poco de ruido, queda dentro del umbral; otra imagen queda lejos', () => {
    const ps = tsModule('utils/photoSimilarity.ts'); const scene = sceneOf(11); const other = sceneOf(99);
    const base = ps.fingerprintFromGray(gray(scene));
    assert.strictEqual(base.length, 16);
    assert.strictEqual(ps.bitDistance(base, ps.fingerprintFromGray(gray(scene))), 0);
    assert.strictEqual(ps.bitDistance(base, ps.fingerprintFromGray(gray((x, y) => scene(x, y) + 25))), 0, 'más brillo');
    assert.ok(ps.bitDistance(base, ps.fingerprintFromGray(gray((x, y) => 110 + (scene(x, y) - 110) * 1.25))) <= ps.MAX_SIMILAR_BITS, 'más contraste');
    let noiseSeed = 5; const noise = () => ((noiseSeed = (noiseSeed * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5) * 8;
    assert.ok(ps.bitDistance(base, ps.fingerprintFromGray(gray((x, y) => scene(x, y) + noise()))) <= ps.MAX_SIMILAR_BITS, 'ruido de compresión');
    assert.ok(ps.bitDistance(base, ps.fingerprintFromGray(gray(other))) > 16, 'otra imagen');
});
t('E3 muchas imágenes distintas no se confunden entre sí (ninguna pareja bajo el umbral)', () => {
    const ps = tsModule('utils/photoSimilarity.ts'); const prints = Array.from({ length: 150 }, (_, i) => ps.fingerprintFromGray(gray(sceneOf(1000 + i * 7))));
    let min = 64; for (let i = 0; i < prints.length; i++) for (let j = i + 1; j < prints.length; j++) min = Math.min(min, ps.bitDistance(prints[i], prints[j]));
    assert.ok(min > ps.MAX_SIMILAR_BITS, 'la pareja más parecida de 150 imágenes distintas está a ' + min + ' bits');
});
t('E4 dos imágenes lisas (p. ej. dos fotos tapadas) dan la misma huella, y es determinista', () => {
    const ps = tsModule('utils/photoSimilarity.ts');
    assert.strictEqual(ps.fingerprintFromGray(gray(() => 0)), ps.fingerprintFromGray(gray(() => 0)));
    assert.strictEqual(ps.bitDistance(ps.fingerprintFromGray(gray(() => 0)), ps.fingerprintFromGray(gray(() => 200))), 0);
});
t('E5 repeatedPhotoIndexes marca la foto que repite a una ANTERIOR, deja pasar las sin huella y no depende del orden de las demás', () => {
    const ps = tsModule('utils/photoSimilarity.ts'); const a = '0123456789abcdef'; const nearA = '0123456789abcdee'; const far = 'fedcba9876543210';
    assert.deepStrictEqual(ps.repeatedPhotoIndexes([a, far, nearA]), [null, null, 0]);
    assert.deepStrictEqual(ps.repeatedPhotoIndexes([a, a, a]), [null, 0, 0]);
    assert.deepStrictEqual(ps.repeatedPhotoIndexes([a, null, a]), [null, null, 0]);
    assert.deepStrictEqual(ps.repeatedPhotoIndexes([null, null]), [null, null]);
    assert.deepStrictEqual(ps.repeatedPhotoIndexes([]), []);
    assert.deepStrictEqual(ps.repeatedPhotoIndexes([a, far]), [null, null]);
    assert.deepStrictEqual(ps.repeatedPhotoIndexes([a, '0123456789abcd00'], 0), [null, null]);   // umbral 0: solo idénticas
});

t('E6 una foto que no se puede leer (o que tarda demasiado) queda sin huella en vez de bloquear el formulario', async () => {
    const ps = tsModule('utils/photoSimilarity.ts');
    const had = Object.getOwnPropertyDescriptor(globalThis, 'Image');
    try {
        globalThis.Image = class { set src(v) { /* nunca termina de cargar */ } };
        const t0 = Date.now(); assert.strictEqual(await ps.photoFingerprint('data:image/png;base64,AAAA', 60), null); assert.ok(Date.now() - t0 < 1500, 'debe rendirse por tiempo');
        globalThis.Image = class { set src(v) { setImmediate(() => this.onerror && this.onerror(new Error('ilegible'))); } };
        assert.strictEqual(await ps.photoFingerprint('data:image/png;base64,AAAA', 60), null);
    } finally { if (had) Object.defineProperty(globalThis, 'Image', had); else delete globalThis.Image; }
});

// ───────────── F. cola sin conexión ─────────────
const queueModule = async () => {
    const entry = `export { processOfflineQueue } from './services/offlineQueueProcessor.ts'; export { api, ApiError } from './services/api.ts';`;
    const fakeQueue = `const state = globalThis.__queue = { items: [] };
        const waiting = (a) => a.type === 'DELIVER' && !!(a.meta && a.meta.waitingMeli);
        export const offlineQueue = {
            getPending: () => state.items.map(a => ({ ...a })), getPendingCount: () => state.items.length, getWaitingMeliCount: () => state.items.filter(waiting).length,
            remove: (id) => { state.items = state.items.filter(a => a.id !== id); },
            setMeta: (id, meta) => { state.items = state.items.map(a => (a.id === id ? { ...a, meta } : a)); },
        };`;
    const out = await esbuild.build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent',
        plugins: [{ name: 'cola-falsa', setup(b) {
            b.onResolve({ filter: /\.\/offlineQueue$/ }, () => ({ path: 'cola-falsa', namespace: 'falso' }));
            b.onLoad({ filter: /.*/, namespace: 'falso' }, () => ({ contents: fakeQueue, loader: 'js' }));
        } }] });
    const m = { exports: {} }; new Function('module', 'exports', 'require', out.outputFiles[0].text)(m, m.exports, require); return m.exports;
};
t('F1 un cierre rechazado por su nombre o sus fotos sale de la cola y se avisa; los demás se siguen enviando', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
    const { processOfflineQueue, api, ApiError } = await queueModule();
    const item = (id, pkgId, type = 'DELIVER') => ({ id, type, pkgId, data: { receiverName: 'x', photosBase64: [] }, timestamp: 1 });
    globalThis.__queue.items = [item('a1', 'PK-1'), item('a2', 'PK-2'), item('a3', 'PK-3'), item('a4', 'PK-4')];
    const sent = [];
    api.confirmDelivery = async (pkgId) => {
        sent.push(pkgId);
        if (pkgId === 'PK-1') throw new ApiError('Ese no parece un nombre real.', 400, { code: 'INVALID_RECEIVER_NAME', message: 'Ese no parece un nombre real.' });
        if (pkgId === 'PK-2') throw new ApiError('Las fotos de evidencia son la misma imagen repetida.', 400, { code: 'DUPLICATE_PHOTOS' });
        if (pkgId === 'PK-3') throw new ApiError('Mercado Libre aún no confirma.', 400, { code: 'MELI_NOT_CONFIRMED' });
        return {};
    };
    const r = await processOfflineQueue();
    assert.deepStrictEqual(sent, ['PK-1', 'PK-2', 'PK-3', 'PK-4']);
    assert.deepStrictEqual(r.discarded.map(d => d.pkgId), ['PK-1', 'PK-2']); assert.ok(/nombre real/.test(r.discarded[0].message));
    assert.deepStrictEqual(r.synced, ['PK-4']);
    assert.deepStrictEqual(globalThis.__queue.items.map(a => a.id), ['a3'], 'solo el rechazado por Mercado Libre se queda en la cola');
    assert.strictEqual(globalThis.__queue.items[0].meta.waitingMeli, true, 'y queda marcado como esperando a Mercado Libre (se reintenta solo, sin reenviarlo cada 30 s)');
    assert.strictEqual(r.stillPending, 1); assert.strictEqual(r.waiting, 1);
});
t('F2 un corte de red detiene el ciclo sin descartar nada', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
    const { processOfflineQueue, api } = await queueModule();
    globalThis.__queue.items = [{ id: 'b1', type: 'DELIVER', pkgId: 'PK-9', data: {}, timestamp: 1 }, { id: 'b2', type: 'DELIVER', pkgId: 'PK-10', data: {}, timestamp: 2 }];
    let calls = 0; api.confirmDelivery = async () => { calls++; throw new TypeError('Failed to fetch'); };
    const r = await processOfflineQueue();
    assert.strictEqual(calls, 1); assert.deepStrictEqual(r.discarded, []); assert.strictEqual(r.stillPending, 2);
});

// ───────────── ejecutar ─────────────
(async () => {
    const packagesRouter = require(path.join(ROOT, 'routes/packages.js'));
    const app = express(); app.use(express.json({ limit: '5mb' })); app.use('/api/packages', packagesRouter);
    const log = console.log; console.error = () => {}; console.warn = () => {};
    server = app.listen(0, '127.0.0.1'); await new Promise(r => server.on('listening', r));
    const port = server.address().port;
    const tok = (role, id) => jwt.sign({ user: { id, role, name: id } }, process.env.JWT_SECRET, { expiresIn: '5m' });
    call = async (method, p, body, role = 'ADMIN', id = 'adm-1') => {
        const r = await fetch(`http://127.0.0.1:${port}/api${p}`, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok(role, id) }, body: body ? JSON.stringify(body) : undefined });
        let json = null; try { json = await r.json(); } catch (e) { /* sin cuerpo */ }
        return { status: r.status, body: json };
    };
    let ok = 0; const fails = [];
    for (const [name, fn] of tests) {
        reset();
        console.log = () => {};
        try { await fn(); ok++; log('OK    ' + name); } catch (e) { fails.push(name); log('FALLA ' + name + '\n      ' + String(e.message).split('\n').slice(0, 3).join('\n      ') + (S.unknown.length ? '\n      consultas no previstas: ' + S.unknown.join(' | ') : '')); }
    }
    console.log = log;
    log(`\n${ok} de ${tests.length} pruebas OK`);
    server.close(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e.stack); process.exit(2); });
