/**
 * Prueba del bloqueo de perfiles ELIMINADOS y DESHABILITADOS (services/accountAccess.js, middleware/auth.js, routes/auth.js y routes/users.js).
 * El problema que corrige: eliminar un perfil no le quitaba el acceso. El login solo rechazaba PENDIENTE y DESHABILITADO y el middleware solo verificaba la firma del
 * token (7 días), así que un perfil eliminado siguió entrando y trabajando. Lo que NO debe cambiar: cualquier otro perfil sigue operando exactamente igual.
 *   A. las reglas sueltas
 *   B. el middleware real con una base falsa: bloquea solo ELIMINADO y DESHABILITADO, deja pasar todo lo demás, no se cae si la base falla, caché de 30 s solo para activos
 *   C. el login real (y el segundo paso del 2FA si el código lo tiene)
 *   D. las rutas reales de eliminar, reintegrar, deshabilitar y editar: el efecto es inmediato
 *   E. guardas del código
 * Los perfiles, claves y correos son inventados; no toca ninguna red ni la base real.
 *
 * Uso:   node tests/accountAccess.test.js
 *        HARNESS_ROOT=<carpeta con otra copia del código> node tests/accountAccess.test.js   (el código ANTERIOR debe FALLAR en lo que corrige; Staging/Producción antes de subir)
 */
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const ROOT = path.resolve(process.env.HARNESS_ROOT || path.join(__dirname, '..'));
const load = (m) => require(require.resolve(m, { paths: [ROOT] }));
const express = load('express');
const jwt = load('jsonwebtoken');
const bcrypt = load('bcryptjs');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba-local';

// ───────────── base falsa ─────────────
let S;
const reset = () => { S = { users: {}, statusQueries: 0, statusDelay: 0, failStatus: false, logs: [], unknown: [], deletedPackagesOf: [] }; };
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const R = (rows) => ({ rows, rowCount: rows.length });
const PASS = 'clave-de-prueba-1';
const HASH = bcrypt.hashSync(PASS, 4);
const mk = (id, status, role = 'DRIVER', over = {}) => ({ id, name: `Perfil ${id}`, email: `${id}@ejemplo.invalid`, role, status, password: HASH, twoFactorEnabled: false, twoFactorSecret: null, personalRut: null, rut: null, ...over });
const put = (id, status, role, over) => (S.users[id] = mk(id, status, role, over));
async function run(text, params = []) {
    const q = norm(text); let m;
    if (q === 'SELECT status FROM users WHERE id = $1') {
        S.statusQueries++; if (S.statusDelay) await new Promise((r) => setTimeout(r, S.statusDelay)); if (S.failStatus) throw new Error('la base no responde');
        const u = S.users[params[0]]; return R(u ? [{ status: u.status }] : []);
    }
    if (/^INSERT INTO system_logs/.test(q)) { S.logs.push({ userId: params[0], userName: params[1], action: params[2], details: params[3] }); return R([]); }
    if (q === 'SELECT * FROM users WHERE email = $1') { const u = Object.values(S.users).find((x) => x.email === params[0]); return R(u ? [{ ...u }] : []); }
    if (q === 'SELECT * FROM users WHERE id = $1') { const u = S.users[params[0]]; return R(u ? [{ ...u }] : []); }
    if (q === 'SELECT "isAppEnabled" FROM system_settings WHERE id = 1') return R([{ isAppEnabled: true }]);
    if (q === 'SELECT password FROM users WHERE id = $1') { const u = S.users[params[0]]; return R(u ? [{ password: u.password }] : []); }
    if (q === "UPDATE users SET status = 'ELIMINADO' WHERE id = $1") { const u = S.users[params[0]]; if (!u) return { rows: [], rowCount: 0 }; u.status = 'ELIMINADO'; return { rows: [], rowCount: 1 }; }
    if (q === "UPDATE users SET integrations = '{}' WHERE id = $1") return { rows: [], rowCount: 1 };
    if (q === "UPDATE users SET status = 'APROBADO' WHERE id = $1") { const u = S.users[params[0]]; if (!u) return { rows: [], rowCount: 0 }; u.status = 'APROBADO'; return { rows: [], rowCount: 1 }; }
    if (q === 'DELETE FROM packages WHERE "creatorId" = $1') { S.deletedPackagesOf.push(params[0]); return { rows: [], rowCount: 0 }; }
    if (q === 'UPDATE users SET status = $1 WHERE id = $2') { const u = S.users[params[1]]; if (!u) return { rows: [], rowCount: 0 }; u.status = params[0]; return { rows: [], rowCount: 1 }; }
    if ((m = q.match(/^UPDATE users SET (.+) WHERE id = \$(\d+)$/))) {
        const cols = m[1].split(',').map((c) => c.trim().match(/^"([^"]+)" = \$\d+$/)[1]);
        const u = S.users[params[params.length - 1]]; if (!u) return { rows: [], rowCount: 0 };
        cols.forEach((c, i) => { u[c] = params[i]; }); return { rows: [], rowCount: 1 };
    }
    if (q === 'SELECT id, name, role, status, email FROM users' || q === 'SELECT id, name, role, status, email, "personalRut", rut FROM users') return R(Object.values(S.users).map((u) => ({ id: u.id, name: u.name, role: u.role, status: u.status, email: u.email, personalRut: u.personalRut, rut: u.rut })));
    S.unknown.push(q); throw new Error('Consulta no prevista en la base falsa: ' + q.slice(0, 200));
}
const stub = (rel, exports) => { const p = require.resolve(path.join(ROOT, rel)); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
const stubOptional = (rel, exports) => { try { stub(rel, exports); } catch (e) { /* ese módulo no existe en este código (por ejemplo, el 2FA en Producción) */ } };
reset();
stub('db.js', { query: (t, p) => run(t, p), getClient: async () => { throw new Error('no se usa'); } });
stubOptional('services/ipIntelligence.js', { checkVpnOrProxy: async () => ({ isVpn: false }) });
stubOptional('services/falabellaCrypto.js', { encrypt: (x) => x, decrypt: (x) => x });
stubOptional('services/totp.js', { generateSecret: () => 'SECRETO', buildOtpAuthUri: () => 'otpauth://x', verifyTotp: (secret, code) => String(code) === '123456' });

let aa = null;
try { aa = require(path.join(ROOT, 'services/accountAccess.js')); } catch (e) { /* el código anterior no lo tiene: las pruebas fallan con un mensaje claro */ }
const need = () => { if (!aa) throw new Error(`no existe services/accountAccess.js en ${ROOT}`); };
const authSrc = fs.readFileSync(path.join(ROOT, 'routes/auth.js'), 'utf8');
const HAS_2FA = authSrc.includes('verify-2fa');

const tests = []; const t = (name, fn) => tests.push({ name, fn });
const tick = () => new Promise((r) => setImmediate(r));

// ═════════════ A. reglas sueltas ═════════════
t('A1 solo ELIMINADO y DESHABILITADO bloquean (sin importar mayúsculas ni espacios); todo lo demás deja pasar', () => {
    need();
    for (const s of ['ELIMINADO', 'DESHABILITADO', 'eliminado', ' Deshabilitado ', 'EliMinadO']) assert.strictEqual(aa.isBlockedStatus(s), true, String(s));
    for (const s of ['APROBADO', 'PENDIENTE', 'aprobado', '', null, undefined, 'ACTIVO', 'ELIMINADOS', 'DESHABILITADA', 0]) assert.strictEqual(aa.isBlockedStatus(s), false, String(s));
    assert.deepStrictEqual([...aa.BLOCKED_STATUSES], ['ELIMINADO', 'DESHABILITADO']);
});
t('A2 los mensajes son claros y distintos para cada estado', () => {
    need();
    assert.strictEqual(aa.blockedMessage('ELIMINADO'), 'Tu cuenta ha sido eliminada. Contacta a un administrador.');
    assert.strictEqual(aa.blockedMessage('deshabilitado'), 'Tu cuenta ha sido deshabilitada.');
    assert.match(aa.blockedMessage('OTRO'), /no está habilitada/);
});

// ═════════════ B. el middleware real ═════════════
let base = null, server = null;
const tok = (id, role = 'DRIVER') => jwt.sign({ user: { id, role } }, process.env.JWT_SECRET, { expiresIn: '5m' });
const ping = async (token, qs = '') => { const r = await fetch(`${base}/api/_ping${qs}`, { headers: token ? { Authorization: 'Bearer ' + token } : {} }); let body = null; try { body = await r.json(); } catch (e) { /* */ } return { status: r.status, body }; };
const fresh = () => { reset(); if (aa) aa._reset(); };
let CLOCK = 1_000_000; const setClock = (ms) => { CLOCK = ms; if (aa) aa._setNow(() => CLOCK); };

t('B1 un perfil activo pasa y se recuerda 30 s (no hay una consulta por petición); a los 31 s se vuelve a revisar', async () => {
    need(); fresh(); setClock(1_000_000); put('u1', 'APROBADO');
    for (let i = 0; i < 3; i++) assert.strictEqual((await ping(tok('u1'))).status, 200);
    assert.strictEqual(S.statusQueries, 1, 'tres peticiones, una sola consulta');
    setClock(1_000_000 + 29_000); await ping(tok('u1')); assert.strictEqual(S.statusQueries, 1);
    setClock(1_000_000 + 31_000); await ping(tok('u1')); assert.strictEqual(S.statusQueries, 2);
});
t('B2 un perfil ELIMINADO recibe 401 con su motivo y NO llega a la ruta; no se recuerda: reintegrarlo rige de inmediato', async () => {
    need(); fresh(); setClock(2_000_000); put('u2', 'ELIMINADO');
    const a = await ping(tok('u2')); assert.strictEqual(a.status, 401); assert.strictEqual(a.body.code, 'ACCOUNT_INACTIVE'); assert.strictEqual(a.body.message, 'Tu cuenta ha sido eliminada. Contacta a un administrador.'); assert.ok(!a.body.ok);
    await ping(tok('u2')); assert.strictEqual(S.statusQueries, 2, 'un bloqueado se consulta siempre, no se guarda');
    S.users.u2.status = 'APROBADO'; assert.strictEqual((await ping(tok('u2'))).status, 200, 'reintegrado: entra al instante');
});
t('B3 un perfil DESHABILITADO también recibe 401, con su propio mensaje', async () => {
    need(); fresh(); setClock(3_000_000); put('u3', 'DESHABILITADO');
    const a = await ping(tok('u3')); assert.strictEqual(a.status, 401); assert.strictEqual(a.body.code, 'ACCOUNT_INACTIVE'); assert.strictEqual(a.body.message, 'Tu cuenta ha sido deshabilitada.');
});
t('B4 PENDIENTE, vacío, nulo, desconocido o en minúsculas NO se bloquean: pasan como siempre (nadie más se ve afectado)', async () => {
    fresh(); setClock(4_000_000);
    const casos = { p1: 'PENDIENTE', p2: '', p3: null, p4: 'ACTIVO', p5: 'aprobado', p6: 'APROBADO' };
    for (const [id, st] of Object.entries(casos)) { put(id, st); assert.strictEqual((await ping(tok(id))).status, 200, `${id} (${st})`); }
});
t('B5 si la base falla se deja pasar (nadie queda afuera por un error) y el aviso no se repite en cada petición', async () => {
    need(); fresh(); setClock(5_000_000); put('u5', 'APROBADO'); S.failStatus = true;
    const e0 = console.error; let avisos = 0; console.error = () => { avisos++; };
    try { for (let i = 0; i < 4; i++) assert.strictEqual((await ping(tok('u5'))).status, 200); } finally { console.error = e0; }
    assert.strictEqual(avisos, 1, 'un solo aviso por minuto');
    S.failStatus = false; S.users.u5.status = 'ELIMINADO'; assert.strictEqual((await ping(tok('u5'))).status, 401, 'cuando la base vuelve, se bloquea');
});
t('B6 un perfil que no existe en la base se deja pasar (como siempre); no se inventa un bloqueo', async () => {
    fresh(); setClock(6_000_000);
    assert.strictEqual((await ping(tok('no-existe'))).status, 200);
});
t('B7 invalidate(): un activo recordado que se elimina por la app se bloquea al instante; sin invalidar, rige a los 30 s', async () => {
    need(); fresh(); setClock(7_000_000); put('u7', 'APROBADO');
    assert.strictEqual((await ping(tok('u7'))).status, 200);
    S.users.u7.status = 'ELIMINADO';
    assert.strictEqual((await ping(tok('u7'))).status, 200, 'dentro de los 30 s y sin invalidar sigue pasando (es el plazo documentado)');
    aa.invalidate('u7'); assert.strictEqual((await ping(tok('u7'))).status, 401, 'invalidado: bloqueado de inmediato');
    put('u7b', 'APROBADO'); await ping(tok('u7b')); S.users.u7b.status = 'DESHABILITADO'; setClock(7_000_000 + 31_000);
    assert.strictEqual((await ping(tok('u7b'))).status, 401, 'pasados los 30 s también se bloquea solo');
});
t('B8 muchas peticiones juntas del mismo perfil hacen una sola consulta', async () => {
    need(); fresh(); setClock(8_000_000); put('u8', 'APROBADO'); S.statusDelay = 60;   // la base tarda: las 25 peticiones se solapan de verdad
    const rs = await Promise.all(Array.from({ length: 25 }, () => ping(tok('u8'))));
    assert.ok(rs.every((r) => r.status === 200)); assert.strictEqual(S.statusQueries, 1);
});
t('B9 los perfiles son independientes: bloquear a uno no toca a otro', async () => {
    need(); fresh(); setClock(9_000_000); put('x', 'ELIMINADO'); put('y', 'APROBADO', 'ADMIN'); put('z', 'APROBADO', 'CLIENT');
    const [a, b, c] = await Promise.all([ping(tok('x')), ping(tok('y', 'ADMIN')), ping(tok('z', 'CLIENT'))]);
    assert.deepStrictEqual([a.status, b.status, c.status], [401, 200, 200]);
});
t('B10 lo de siempre no cambia: sin token, formato malo, firma falsa, y los roles se siguen normalizando', async () => {
    fresh(); setClock(10_000_000); put('r1', 'APROBADO');
    const sin = await ping(null); assert.strictEqual(sin.status, 401); assert.strictEqual(sin.body.message, 'No hay token, autorización denegada.');
    const mal = await fetch(`${base}/api/_ping`, { headers: { Authorization: 'Token abc' } }); assert.strictEqual(mal.status, 401); assert.strictEqual((await mal.json()).message, 'Formato de token inválido.');
    const falso = await ping(jwt.sign({ user: { id: 'r1', role: 'ADMIN' } }, 'otro-secreto')); assert.strictEqual(falso.status, 401); assert.strictEqual(falso.body.message, 'Token no es válido.');
    for (const [dado, esperado] of [['ADMINISTRADOR', 'ADMIN'], ['ADMIN_SISTEMAS', 'ADMIN'], ['ADMIN', 'ADMIN'], ['CHOFER', 'DRIVER'], ['CONDUCTOR', 'DRIVER'], ['DRIVER', 'DRIVER'], ['CLIENTE', 'CLIENT'], ['CLIENT', 'CLIENT'], ['FACTURACION', 'FACTURACION'], ['OPERADOR_SISTEMAS', 'OPERADOR_SISTEMAS']]) {
        const r = await ping(tok('r1', dado)); assert.strictEqual(r.status, 200, dado); assert.strictEqual(r.body.user.role, esperado, `${dado} → ${esperado}`);
    }
    if (HAS_2FA) { const pend = await ping(jwt.sign({ purpose: 'login_verify', userId: 'r1' }, process.env.JWT_SECRET, { expiresIn: '5m' })); assert.strictEqual(pend.status, 401, 'el token del 2FA pendiente sigue rechazado'); }
});
t('B11 el token por ?token= (descargas directas) se revisa igual', async () => {
    need(); fresh(); setClock(11_000_000); put('q1', 'ELIMINADO'); put('q2', 'APROBADO');
    assert.strictEqual((await ping(null, `?token=${tok('q1')}`)).status, 401);
    assert.strictEqual((await ping(null, `?token=${tok('q2')}`)).status, 200);
});
t('B12 cada intento bloqueado se anota en el registro, como mucho una vez por hora por perfil, y sin el token', async () => {
    need(); fresh(); setClock(12_000_000); put('l1', 'ELIMINADO', 'ADMIN'); put('l2', 'DESHABILITADO');
    for (let i = 0; i < 5; i++) await ping(tok('l1', 'ADMIN'), `?token=SECRETO-QUE-NO-DEBE-QUEDAR&x=${i}`);
    await ping(tok('l2'));
    await tick(); await tick();
    const a = S.logs.filter((l) => l.action === 'ACCESS_BLOCKED_INACTIVE_PROFILE'); assert.strictEqual(a.filter((l) => l.userId === 'l1').length, 1, 'cinco intentos, un registro');
    assert.strictEqual(a.filter((l) => l.userId === 'l2').length, 1, 'el otro perfil tiene el suyo');
    const d = JSON.parse(a.find((l) => l.userId === 'l1').details); assert.deepStrictEqual([d.status, d.role, d.path], ['ELIMINADO', 'ADMIN', '/api/_ping']); assert.ok(!JSON.stringify(a).includes('SECRETO-QUE-NO-DEBE-QUEDAR'));
    setClock(12_000_000 + 61 * 60 * 1000); await ping(tok('l1', 'ADMIN')); await tick(); await tick();
    assert.strictEqual(S.logs.filter((l) => l.action === 'ACCESS_BLOCKED_INACTIVE_PROFILE' && l.userId === 'l1').length, 2, 'pasada la hora se anota otra vez');
});

// ═════════════ C. el login real ═════════════
let ipSeq = 0;
const login = async (email, password) => { const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': `10.7.${Math.floor(++ipSeq / 200)}.${ipSeq % 200}` }, body: JSON.stringify({ email, password }) }); let body = null; try { body = await r.json(); } catch (e) { /* */ } return { status: r.status, body }; };
t('C1 un perfil ELIMINADO con la clave correcta recibe 403, queda anotado y NO recibe token', async () => {
    need(); fresh(); put('c1', 'ELIMINADO', 'ADMIN');
    const r = await login('c1@ejemplo.invalid', PASS); assert.strictEqual(r.status, 403); assert.strictEqual(r.body.message, 'Tu cuenta ha sido eliminada. Contacta a un administrador.'); assert.ok(!r.body.token && !r.body.user);
    assert.deepStrictEqual(S.logs.filter((l) => l.action === 'LOGIN_BLOCKED_INACTIVE_PROFILE').map((l) => l.userId), ['c1']);
});
t('C2 con la clave equivocada un eliminado recibe lo mismo que cualquiera («Credenciales inválidas»): no se revela nada', async () => {
    fresh(); put('c2', 'ELIMINADO');
    const r = await login('c2@ejemplo.invalid', 'otra-clave'); assert.strictEqual(r.status, 400); assert.strictEqual(r.body.message, 'Credenciales inválidas.');
});
t('C3 DESHABILITADO y PENDIENTE siguen igual que antes', async () => {
    fresh(); put('c3a', 'DESHABILITADO'); put('c3b', 'PENDIENTE');
    const a = await login('c3a@ejemplo.invalid', PASS); assert.deepStrictEqual([a.status, a.body.message], [403, 'Tu cuenta ha sido deshabilitada.']);
    const b = await login('c3b@ejemplo.invalid', PASS); assert.deepStrictEqual([b.status, b.body.message], [403, 'Tu cuenta está pendiente de aprobación.']);
});
t('C4 un perfil activo entra igual que siempre (token de 7 días con su id y rol) y ese token funciona en una ruta protegida', async () => {
    fresh(); setClock(13_000_000); put('c4', 'APROBADO', 'ADMIN'); put('c4b', null, 'DRIVER'); put('c4c', 'APROBADO', 'CLIENT');
    for (const [id, role] of [['c4', 'ADMIN'], ['c4b', 'DRIVER'], ['c4c', 'CLIENT']]) {
        const r = await login(`${id}@ejemplo.invalid`, PASS); assert.strictEqual(r.status, 200, id); assert.ok(r.body.token && r.body.user && !r.body.user.password);
        const dec = jwt.decode(r.body.token); assert.deepStrictEqual([dec.user.id, dec.user.role], [id, role]); assert.strictEqual(dec.exp - dec.iat, 7 * 24 * 3600);
        assert.strictEqual((await ping(r.body.token)).status, 200, `${id} con su token`);
    }
});
t('C5 con 2FA: un eliminado se bloquea en el primer paso y no recibe el token temporal', async () => {
    if (!HAS_2FA) return; fresh(); put('c5', 'ELIMINADO', 'ADMIN', { twoFactorEnabled: true, twoFactorSecret: 'SECRETO' });
    const r = await login('c5@ejemplo.invalid', PASS); assert.strictEqual(r.status, 403); assert.ok(!r.body.tempToken && !r.body.requires2FA);
});
t('C6 con 2FA: si el perfil se elimina entre la clave y el código, el segundo paso lo bloquea', async () => {
    if (!HAS_2FA) return; fresh(); put('c6', 'APROBADO', 'ADMIN', { twoFactorEnabled: true, twoFactorSecret: 'SECRETO' });
    const paso1 = await login('c6@ejemplo.invalid', PASS); assert.strictEqual(paso1.status, 200); assert.strictEqual(paso1.body.requires2FA, true);
    S.users.c6.status = 'ELIMINADO';
    const r = await fetch(`${base}/api/auth/login/verify-2fa`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '10.9.9.9' }, body: JSON.stringify({ tempToken: paso1.body.tempToken, code: '123456' }) });
    assert.strictEqual(r.status, 403); assert.ok(!(await r.json()).token);
    S.users.c6.status = 'APROBADO'; const ok = await fetch(`${base}/api/auth/login/verify-2fa`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '10.9.9.10' }, body: JSON.stringify({ tempToken: paso1.body.tempToken, code: '123456' }) });
    assert.strictEqual(ok.status, 200, 'un activo con el código correcto entra como siempre');
});

// ═════════════ D. eliminar / reintegrar / deshabilitar / editar ═════════════
const api = async (method, url, token, body) => { const r = await fetch(`${base}${url}`, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined }); let b = null; try { b = await r.json(); } catch (e) { /* sin cuerpo */ } return { status: r.status, body: b }; };
t('D1 eliminar a un usuario con sesión abierta lo saca AL INSTANTE (aunque estuviera recordado como activo)', async () => {
    need(); fresh(); setClock(14_000_000); put('adm', 'APROBADO', 'ADMIN'); put('victima', 'APROBADO', 'ADMIN');
    assert.strictEqual((await ping(tok('victima', 'ADMIN'))).status, 200, 'antes: opera');
    const del = await api('DELETE', '/api/users/victima', tok('adm', 'ADMIN'), { password: PASS }); assert.strictEqual(del.status, 204, JSON.stringify(del.body));
    assert.strictEqual(S.users.victima.status, 'ELIMINADO');
    const r = await ping(tok('victima', 'ADMIN')); assert.strictEqual(r.status, 401); assert.strictEqual(r.body.code, 'ACCOUNT_INACTIVE');
    assert.strictEqual((await ping(tok('adm', 'ADMIN'))).status, 200, 'quien eliminó sigue operando');
});
t('D2 reintegrar a un eliminado le devuelve el acceso de inmediato (y borra solo los paquetes de ese perfil, como antes)', async () => {
    need(); fresh(); setClock(15_000_000); put('adm', 'APROBADO', 'ADMIN'); put('volvio', 'ELIMINADO', 'ADMIN');
    assert.strictEqual((await ping(tok('volvio', 'ADMIN'))).status, 401);
    const r = await api('POST', '/api/users/volvio/reintegrate', tok('adm', 'ADMIN')); assert.strictEqual(r.status, 200, JSON.stringify(r.body)); assert.strictEqual(S.users.volvio.status, 'APROBADO');
    assert.strictEqual((await ping(tok('volvio', 'ADMIN'))).status, 200); assert.deepStrictEqual(S.deletedPackagesOf, ['volvio'], 'el comportamiento de «empezar de cero» no cambió');
});
t('D3 deshabilitar saca al usuario al instante y habilitarlo lo devuelve', async () => {
    need(); fresh(); setClock(16_000_000); put('adm', 'APROBADO', 'ADMIN'); put('chofer', 'APROBADO', 'DRIVER');
    assert.strictEqual((await ping(tok('chofer'))).status, 200);
    const off = await api('POST', '/api/users/chofer/toggle-status', tok('adm', 'ADMIN')); assert.strictEqual(off.status, 200); assert.strictEqual(S.users.chofer.status, 'DESHABILITADO');
    assert.strictEqual((await ping(tok('chofer'))).status, 401);
    const on = await api('POST', '/api/users/chofer/toggle-status', tok('adm', 'ADMIN')); assert.strictEqual(on.status, 200);
    assert.strictEqual((await ping(tok('chofer'))).status, 200);
});
t('D4 editar el estado de un usuario desde el formulario de edición también rige al instante', async () => {
    need(); fresh(); setClock(17_000_000); put('adm', 'APROBADO', 'ADMIN'); put('editado', 'APROBADO', 'DRIVER');
    assert.strictEqual((await ping(tok('editado'))).status, 200);
    const r = await api('PUT', '/api/users/editado', tok('adm', 'ADMIN'), { status: 'ELIMINADO' }); assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual((await ping(tok('editado'))).status, 401);
});
t('D5 un usuario que no es administrador no puede eliminar a nadie (los permisos de siempre no cambian)', async () => {
    fresh(); setClock(18_000_000); put('chofer', 'APROBADO', 'DRIVER'); put('otro', 'APROBADO', 'DRIVER');
    const r = await api('DELETE', '/api/users/otro', tok('chofer'), { password: PASS }); assert.strictEqual(r.status, 403); assert.strictEqual(S.users.otro.status, 'APROBADO');
});

// ═════════════ E. guardas del código ═════════════
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
t('E1 el middleware revisa el perfil y el login/eliminar/reintegrar/deshabilitar/editar avisan al módulo', () => {
    const mw = read('middleware/auth.js'); assert.match(mw, /accountAccess\.checkProfile\(req\.user\.id\)/); assert.match(mw, /status\(401\)\.json\(\{ message: accountAccess\.blockedMessage\(profile\.status\), code: 'ACCOUNT_INACTIVE' \}\)/);
    assert.match(read('routes/auth.js'), /accountAccess\.isBlockedStatus\(user\.status\)/);
    assert.ok((read('routes/users.js').match(/accountAccess\.invalidate\(/g) || []).length >= 5, 'editar, eliminar, reintegrar, aprobar y habilitar/deshabilitar deben invalidar');
});

// ═════════════ ejecución ═════════════
(async () => {
    const app = express(); app.use(express.json());
    const authMiddleware = require(path.join(ROOT, 'middleware/auth.js'));
    app.get('/api/_ping', authMiddleware, (req, res) => res.json({ ok: true, user: req.user }));
    try { app.use('/api/auth', require(path.join(ROOT, 'routes/auth.js'))); } catch (e) { console.error('No se pudo montar routes/auth.js:', e.message); }
    try { app.use('/api/users', require(path.join(ROOT, 'routes/users.js'))); } catch (e) { console.error('No se pudo montar routes/users.js:', e.message); }
    server = await new Promise((resolve) => { const sv = app.listen(0, '127.0.0.1', () => resolve(sv)); }); base = `http://127.0.0.1:${server.address().port}`;
    const log = console.log; let ok = 0; const fails = [];
    for (const { name, fn } of tests) {
        const quiet = console.log; console.log = () => {};
        try { await fn(); ok++; console.log = quiet; log('OK    ' + name); }
        catch (e) { console.log = quiet; fails.push(name); log('FALLA ' + name + '\n      ' + String(e && e.message).split('\n').slice(0, 6).join('\n      ')); }
    }
    log(`\n${ok} de ${tests.length} pruebas OK`);
    server.close(); process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e.stack); process.exit(2); });
