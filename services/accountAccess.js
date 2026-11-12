'use strict';
/**
 * Acceso según el estado del perfil.
 *
 * Un perfil ELIMINADO o DESHABILITADO no debe poder entrar ni seguir usando una sesión que ya tenía abierta. Hasta ahora el login solo rechazaba PENDIENTE y
 * DESHABILITADO, y el middleware de autenticación solo verificaba la firma del token (que dura 7 días): eliminar a alguien no le quitaba el acceso, aunque la pantalla
 * de eliminar promete «no podrá volver a ingresar hasta ser reintegrado». Un perfil eliminado el 18-may siguió trabajando todos los días.
 *
 * Reglas (pensadas para no afectar a nadie más):
 *  - Solo bloquean los estados ELIMINADO y DESHABILITADO. Cualquier otro valor (APROBADO, PENDIENTE, vacío, desconocido) deja pasar como siempre.
 *  - Si la base no responde o el perfil no existe, se deja pasar: un error o un dato que falta nunca deja a nadie afuera.
 *  - Un perfil activo se vuelve a revisar como máximo cada 30 s (no hay una consulta por petición). Un perfil bloqueado NUNCA se guarda en memoria: cada intento
 *    consulta la base, así que reintegrar o rehabilitar a alguien tiene efecto de inmediato.
 *  - Eliminar, deshabilitar o editar un usuario desde la app llama a invalidate(): el bloqueo es inmediato; si el estado se cambia por otro medio (la base
 *    directamente), rige en 30 s como máximo.
 *  - Cada intento bloqueado de una sesión queda anotado en el registro de actividad, como mucho una vez por hora por perfil.
 */

const BLOCKED_STATUSES = Object.freeze(['ELIMINADO', 'DESHABILITADO']);
const ACTIVE_CACHE_MS = 30 * 1000;
const LOG_EVERY_MS = 60 * 60 * 1000;
const ERROR_LOG_EVERY_MS = 60 * 1000;
const MAX_CACHE = 5000;

const MESSAGES = Object.freeze({
    ELIMINADO: 'Tu cuenta ha sido eliminada. Contacta a un administrador.',
    DESHABILITADO: 'Tu cuenta ha sido deshabilitada.',
});

const normalize = (status) => String(status == null ? '' : status).trim().toUpperCase();
const isBlockedStatus = (status) => BLOCKED_STATUSES.includes(normalize(status));
const blockedMessage = (status) => MESSAGES[normalize(status)] || 'Tu cuenta no está habilitada. Contacta a un administrador.';

let now = () => Date.now();                // solo las pruebas lo cambian
const activeUntil = new Map();             // id → hasta cuándo vale «está activo» (solo se guarda lo activo)
const inflight = new Map();                // id → consulta en curso (una sola por perfil aunque lleguen muchas peticiones juntas)
const lastLogged = new Map();              // id → cuándo se anotó el último bloqueo
let lastErrorLog = 0;

/** { active: true } si puede seguir; { active: false, status } si el perfil está ELIMINADO o DESHABILITADO. Nunca lanza: ante cualquier error deja pasar. */
function checkProfile(userId, opts = {}) {
    const id = String(userId);
    const t = now();
    const until = activeUntil.get(id);
    if (until && until > t) return Promise.resolve({ active: true });
    const pending = inflight.get(id);
    if (pending) return pending;
    const p = (async () => {
        try {
            const db = opts.db || require('../db');
            const { rows } = await db.query('SELECT status FROM users WHERE id = $1', [id]);
            const status = rows && rows[0] ? rows[0].status : undefined;
            if (isBlockedStatus(status)) { activeUntil.delete(id); return { active: false, status: normalize(status) }; }
            if (activeUntil.size >= MAX_CACHE) {
                for (const [k, v] of activeUntil) if (v <= now()) activeUntil.delete(k);
                if (activeUntil.size >= MAX_CACHE) activeUntil.clear();
            }
            activeUntil.set(id, now() + ACTIVE_CACHE_MS);
            return { active: true };
        } catch (err) {
            if (now() - lastErrorLog > ERROR_LOG_EVERY_MS) { lastErrorLog = now(); console.error('[accountAccess] No se pudo revisar el estado del perfil (se deja pasar):', err && err.message); }
            return { active: true, error: true };
        } finally {
            inflight.delete(id);
        }
    })();
    inflight.set(id, p);
    return p;
}

/** Olvida lo que se sabe de un perfil: la próxima petición vuelve a consultar la base (para que eliminar/deshabilitar rija al instante). */
function invalidate(userId) {
    if (userId != null) activeUntil.delete(String(userId));
}

/** Anota un intento bloqueado en el registro de actividad (como mucho una vez por hora por perfil). */
function noteBlocked(userId, details, opts = {}) {
    const id = String(userId);
    const t = now();
    const last = lastLogged.get(id);
    if (last && t - last < LOG_EVERY_MS) return;
    lastLogged.set(id, t);
    if (lastLogged.size > MAX_CACHE) lastLogged.clear();
    try {
        const logAction = opts.logAction || require('./logger').logAction;
        Promise.resolve(logAction(id, null, 'ACCESS_BLOCKED_INACTIVE_PROFILE', details)).catch(() => {});
    } catch (e) { /* el registro nunca debe tumbar una petición */ }
}

module.exports = {
    BLOCKED_STATUSES, ACTIVE_CACHE_MS, LOG_EVERY_MS,
    isBlockedStatus, blockedMessage, checkProfile, invalidate, noteBlocked,
    _setNow: (fn) => { now = fn || (() => Date.now()); },
    _reset: () => { activeUntil.clear(); inflight.clear(); lastLogged.clear(); lastErrorLog = 0; now = () => Date.now(); },
};
