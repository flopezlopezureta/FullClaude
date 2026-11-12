const jwt = require('jsonwebtoken');
const accountAccess = require('../services/accountAccess');

module.exports = function(req, res, next) {
    let token = '';
    const authHeader = req.header('Authorization');
    
    if (authHeader) {
        // Enfoque estándar: Authorization: Bearer <token>
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        } else {
            return res.status(401).json({ message: 'Formato de token inválido.' });
        }
    } else if (req.query.token) {
        // Enfoque para descargas directas: ?token=<token>
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ message: 'No hay token, autorización denegada.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // The 2FA pending-login token (issued between password success and code verification)
        // carries this marker instead of a real user session — reject it here so it can never be
        // used as a substitute for a completed login on any other route.
        if (decoded.purpose === 'login_verify') {
            return res.status(401).json({ message: 'Token no es válido.' });
        }
        req.user = decoded.user;
        if (req.user && req.user.role) {
            const upperRole = String(req.user.role).toUpperCase();
            if (['ADMINISTRADOR', 'ADMIN_SISTEMAS', 'ADMIN'].includes(upperRole)) {
                req.user.role = 'ADMIN';
            } else if (['CLIENTE', 'CLIENT'].includes(upperRole)) {
                req.user.role = 'CLIENT';
            } else if (['CHOFER', 'CONDUCTOR', 'DRIVER'].includes(upperRole)) {
                req.user.role = 'DRIVER';
            }
        }
    } catch (err) {
        return res.status(401).json({ message: 'Token no es válido.' });
    }

    // Un perfil eliminado o deshabilitado no puede seguir usando una sesión que ya tenía (dura 7 días). Ver services/accountAccess.js.
    if (!req.user || req.user.id == null) return next();
    accountAccess.checkProfile(req.user.id).then((profile) => {
        if (profile.active) return next();
        accountAccess.noteBlocked(req.user.id, { status: profile.status, role: req.user.role, path: String(req.originalUrl || req.url || '').split('?')[0] });
        return res.status(401).json({ message: accountAccess.blockedMessage(profile.status), code: 'ACCOUNT_INACTIVE' });
    }, () => next());
};
