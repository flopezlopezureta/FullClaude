const jwt = require('jsonwebtoken');

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
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token no es válido.' });
    }
};
