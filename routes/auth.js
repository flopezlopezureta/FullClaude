const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkVpnOrProxy } = require('../services/ipIntelligence');
const { logAction } = require('../services/logger');
const { encrypt, decrypt } = require('../services/falabellaCrypto');
const { generateSecret, buildOtpAuthUri, verifyTotp } = require('../services/totp');

// Nothing throttled login attempts before — an attacker could brute-force a password with no
// limit at all. 15 tries per 15 minutes per IP is generous for a real user mistyping a password,
// but shuts down automated guessing.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.' }
});

// POST /api/auth/register
// Public self-registration is closed — new accounts (client, driver, or otherwise) are created
// by an admin through the user-management panel now. This endpoint used to accept `role`
// straight from the request body with no restriction (anyone could self-register as ADMIN by
// just sending that value); rather than leave a narrowed-but-still-public account-creation path
// sitting on the internet, it's disabled outright.
router.post('/register', async (req, res) => {
    return res.status(403).json({ message: 'El registro público está deshabilitado. Contacta a un administrador para crear tu cuenta.' });
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'El nombre de usuario y la contraseña son requeridos.' });
        }

        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        // Check if app is enabled, but allow admin to bypass maintenance mode
        if (user.email !== 'admin') {
            const { rows: settingsRows } = await db.query('SELECT "isAppEnabled" FROM system_settings WHERE id = 1');
            const isAppEnabled = settingsRows.length > 0 ? settingsRows[0].isAppEnabled : true; // Default to true if setting doesn't exist
            if (!isAppEnabled) {
                return res.status(403).json({ message: 'La aplicación se encuentra temporalmente en mantenimiento.' });
            }
        }
        
        // A hardcoded master password used to live here — anyone who knew it (or read the
        // source: this repo, a leak, a former contractor) could log in as ANY user, including
        // admin, without their real password. Live since 2026-04-11. Removed: only the real
        // per-account password (bcrypt-verified) authorizes a login now.
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        // Checked only after the password is confirmed correct — no point spending a lookup (or
        // giving an attacker any signal) on a guess that was wrong anyway. Fails open: if the
        // lookup service errors out, checkVpnOrProxy resolves isVpn:false and login proceeds
        // normally, so a broken third-party API can never lock everyone out.
        const clientIp = req.headers['cf-connecting-ip'] || req.ip;
        const { isVpn } = await checkVpnOrProxy(clientIp);
        if (isVpn) {
            await logAction(user.id, user.name, 'LOGIN_BLOCKED_VPN', { ip: clientIp, email: user.email });
            return res.status(403).json({ message: 'No se puede iniciar sesión desde una conexión VPN o proxy. Desactívala e intenta de nuevo.' });
        }

        if (user.status === 'PENDIENTE') {
            return res.status(403).json({ message: 'Tu cuenta está pendiente de aprobación.' });
        }

        if (user.status === 'DESHABILITADO') {
            return res.status(403).json({ message: 'Tu cuenta ha sido deshabilitada.' });
        }

        // Password (and VPN/status checks) already passed at this point. If this account has 2FA
        // enabled, don't issue the real session token yet — issue a short-lived one that's only
        // good for /login/verify-2fa (rejected everywhere else by middleware/auth.js), and make
        // the frontend collect the 6-digit code before a real session is created.
        if (user.twoFactorEnabled) {
            const pendingToken = jwt.sign(
                { purpose: 'login_verify', userId: user.id },
                process.env.JWT_SECRET,
                { expiresIn: '5m' }
            );
            return res.json({ requires2FA: true, tempToken: pendingToken });
        }

        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        delete user.password;
        // Only admins see plain passwords
        if (user.role !== 'ADMIN' && user.role !== 'RETIROS') {
            delete user.plainPassword;
        }
        res.json({ token, user });

    } catch (err) {
        console.error('Error en /api/auth/login:', err);
        const message = err.message.includes('PostgreSQL')
            ? 'Error de conexión a la base de datos. Por favor, configure las variables de entorno.'
            : 'Error del servidor al iniciar sesión.';
        res.status(500).json({ message });
    }
});

// POST /api/auth/login/verify-2fa — second step of login for accounts with 2FA enabled.
// Rate-limited the same as /login since a 6-digit code (1,000,000 combinations) is brute-forceable
// without a limit.
router.post('/login/verify-2fa', loginLimiter, async (req, res) => {
    try {
        const { tempToken, code } = req.body;
        if (!tempToken || !code) {
            return res.status(400).json({ message: 'Falta el token temporal o el código.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        } catch (e) {
            return res.status(401).json({ message: 'La sesión de verificación expiró. Inicia sesión de nuevo.' });
        }
        if (decoded.purpose !== 'login_verify' || !decoded.userId) {
            return res.status(401).json({ message: 'Token no válido.' });
        }

        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
        const user = rows[0];
        if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
            return res.status(401).json({ message: 'Token no válido.' });
        }

        const secret = decrypt(user.twoFactorSecret);
        if (!verifyTotp(secret, code)) {
            await logAction(user.id, user.name, 'LOGIN_2FA_FAILED', {});
            return res.status(400).json({ message: 'Código incorrecto.' });
        }

        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        delete user.password;
        delete user.twoFactorSecret;
        if (user.role !== 'ADMIN' && user.role !== 'RETIROS') {
            delete user.plainPassword;
        }
        res.json({ token, user });
    } catch (err) {
        console.error('Error en /api/auth/login/verify-2fa:', err);
        res.status(500).json({ message: 'Error del servidor al verificar el código.' });
    }
});

// GET /api/auth/2fa/status — whether the logged-in account currently has 2FA enabled.
router.get('/2fa/status', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT "twoFactorEnabled" FROM users WHERE id = $1', [req.user.id]);
        res.json({ enabled: !!(rows[0] && rows[0].twoFactorEnabled) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

// POST /api/auth/2fa/setup — generates a new secret and returns it (plus its QR-ready URI) so the
// user can scan it into an authenticator app. Stored right away but NOT enabled until the user
// proves they scanned it correctly via /2fa/verify-setup — otherwise a user could lock themselves
// out by saving a secret they never actually enrolled.
router.post('/2fa/setup', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
        const user = rows[0];
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const secret = generateSecret();
        await db.query('UPDATE users SET "twoFactorSecret" = $1, "twoFactorEnabled" = false WHERE id = $2', [encrypt(secret), user.id]);

        res.json({ secret, otpauthUri: buildOtpAuthUri(secret, user.email) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error del servidor al iniciar la configuración de 2FA.' });
    }
});

// POST /api/auth/2fa/verify-setup — confirms enrollment with a code from the authenticator app.
router.post('/2fa/verify-setup', authMiddleware, async (req, res) => {
    try {
        const { code } = req.body;
        const { rows } = await db.query('SELECT id, name, "twoFactorSecret" FROM users WHERE id = $1', [req.user.id]);
        const user = rows[0];
        if (!user || !user.twoFactorSecret) {
            return res.status(400).json({ message: 'Primero debes iniciar la configuración de 2FA.' });
        }

        const secret = decrypt(user.twoFactorSecret);
        if (!verifyTotp(secret, code)) {
            return res.status(400).json({ message: 'Código incorrecto. Verifica la hora de tu teléfono e intenta de nuevo.' });
        }

        await db.query('UPDATE users SET "twoFactorEnabled" = true WHERE id = $1', [user.id]);
        await logAction(user.id, user.name, 'ENABLE_2FA', {});
        res.json({ enabled: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error del servidor al confirmar 2FA.' });
    }
});

// POST /api/auth/2fa/disable — requires the current password again so a hijacked-but-unlocked
// session (e.g. an unattended logged-in browser) can't be used to silently turn off 2FA.
router.post('/2fa/disable', authMiddleware, async (req, res) => {
    try {
        const { password } = req.body;
        const { rows } = await db.query('SELECT id, name, password FROM users WHERE id = $1', [req.user.id]);
        const user = rows[0];
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const isMatch = password && await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Contraseña incorrecta.' });
        }

        await db.query('UPDATE users SET "twoFactorEnabled" = false, "twoFactorSecret" = NULL WHERE id = $1', [user.id]);
        await logAction(user.id, user.name, 'DISABLE_2FA', {});
        res.json({ enabled: false });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error del servidor al deshabilitar 2FA.' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const user = rows[0];
        delete user.password;
        // Only admins see plain passwords
        if (user.role !== 'ADMIN' && user.role !== 'RETIROS') {
            delete user.plainPassword;
        }
        res.json(user);
    } catch (err) {
        console.error(err);
        const message = err.message.includes('PostgreSQL') 
            ? 'Error de conexión a la base de datos.' 
            : 'Error del servidor.';
        res.status(500).json({ message });
    }
});


module.exports = router;