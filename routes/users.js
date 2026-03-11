const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Middleware to check for Admin or Retiros role
const adminOrRetirosOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'RETIROS') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    next();
};

const adminOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
};


// GET /api/users - Get all users
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { rows: users } = await db.query('SELECT * FROM users');
        const safeUsers = users.map(user => {
            delete user.password;
            return user;
        });
        res.json(safeUsers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener los usuarios.' });
    }
});

// POST /api/users - Create a new user (Admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
    const { name, email, password, role, ...otherData } = req.body;

     if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Nombre, email, password y rol son obligatorios.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = {
            id: `user-${uuidv4()}`,
            name,
            email,
            password: hashedPassword,
            role,
            status: 'APROBADO', // User created by admin is auto-approved
             ...otherData,
        };
        
        if (role === 'CLIENT') {
             newUser.clientIdentifier = `${name.substring(0, 4).toUpperCase()}-${uuidv4().split('-')[1]}`;
        }
        
        const columns = Object.keys(newUser).map(k => `"${k}"`).join(', ');
        const values = Object.values(newUser);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        await db.query(`INSERT INTO users (${columns}) VALUES (${placeholders})`, values);
        
        delete newUser.password;
        res.status(201).json(newUser);

    } catch (err) {
        console.error(err);
        if (err.code === '23505') { // PG unique violation
            return res.status(400).json({ message: 'El correo electrónico ya existe.' });
        }
        res.status(500).json({ message: 'Error del servidor al crear el usuario.' });
    }
});

// PUT /api/users/:id - Update a user
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { password, ...updateData } = req.body;

    try {
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const fields = Object.keys(updateData);
        const values = Object.values(updateData);
        const setClause = fields.map((field, i) => `"${field}" = $${i + 1}`).join(', ');

        const queryText = `UPDATE users SET ${setClause} WHERE id = $${fields.length + 1}`;
        const queryParams = [...values, id];
        
        const result = await db.query(queryText, queryParams);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        const updatedUser = rows[0];
        delete updatedUser.password;
        
        res.json(updatedUser);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar el usuario.' });
    }
});


// DELETE /api/users/:id - Delete a user
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al eliminar el usuario.' });
    }
});

// POST /api/users/:id/approve - Approve a user
router.post('/:id/approve', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await db.query("UPDATE users SET status = 'APROBADO' WHERE id = $1", [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        const user = rows[0];
        delete user.password;
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al aprobar el usuario.' });
    }
});

// POST /api/users/:id/toggle-status
router.post('/:id/toggle-status', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query('SELECT status FROM users WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado.' });
        const newStatus = rows[0].status === 'APROBADO' ? 'DESHABILITADO' : 'APROBADO';
        await db.query('UPDATE users SET status = $1 WHERE id = $2', [newStatus, id]);
        const { rows: updatedRows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        const user = updatedRows[0];
        delete user.password;
        res.json(user);
    } catch(err) {
        console.error(err);
        res.status(500).json({ message: 'Error al cambiar el estado del usuario.' });
    }
});

module.exports = router;
