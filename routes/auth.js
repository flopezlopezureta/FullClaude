const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, email, password, role, phone, rut, address, pickupAddress, storesInfo } = req.body;

    if (!name || !email || !password || !role || !phone) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    try {
        const { rows: existingUsers } = await db.query('SELECT email FROM users WHERE email = $1', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'El nombre de usuario ya está registrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const newUser = {
            id: `user-${uuidv4()}`,
            name,
            email,
            password: hashedPassword,
            role,
            phone,
            status: 'PENDIENTE', // All new registrations are pending approval
            rut: role === 'CLIENT' ? rut : null,
            address: role === 'CLIENT' ? address : null,
            "pickupAddress": role === 'CLIENT' ? pickupAddress : null,
            "storesInfo": role === 'CLIENT' ? storesInfo : null,
            "clientIdentifier": role === 'CLIENT' ? `${name.substring(0, 4).toUpperCase()}-${uuidv4().split('-')[1]}` : null,
        };
        
        const columns = Object.keys(newUser).map(k => `"${k}"`).join(', ');
        const values = Object.values(newUser);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        await db.query(`INSERT INTO users (${columns}) VALUES (${placeholders})`, values);
        
        // Do not return the hashed password
        delete newUser.password;

        res.status(201).json(newUser);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error del servidor al registrar el usuario.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
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
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        if (user.status === 'PENDIENTE') {
            return res.status(403).json({ message: 'Tu cuenta está pendiente de aprobación.' });
        }

        if (user.status === 'DESHABILITADO') {
            return res.status(403).json({ message: 'Tu cuenta ha sido deshabilitada.' });
        }

        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        delete user.password;
        res.json({ token, user });

    } catch (err) {
        console.error('Error en /api/auth/login:', err);
        res.status(500).json({ message: 'Error del servidor al iniciar sesión.' });
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
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});


module.exports = router;