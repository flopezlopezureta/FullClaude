
const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Middleware to check for Admin or Retiros role
const adminOrRetirosOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'RETIROS') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    next();
};

router.get('/history', authMiddleware, async (req, res) => {
    try {
        let query = 'SELECT * FROM assignment_events';
        const params = [];
        
        if (req.user.role === 'DRIVER') {
            query += ' WHERE "driverId" = $1';
            params.push(req.user.id);
        }
        
        query += ' ORDER BY "assignedAt" DESC';
        
        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener el historial de asignaciones.' });
    }
});

router.post('/assign-client', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { clientId, driverId } = req.body;
    try {
        const { rows: clientRows } = await db.query('SELECT name FROM users WHERE id = $1', [clientId]);
        const { rows: driverRows } = await db.query('SELECT name FROM users WHERE id = $1', [driverId]);

        if (clientRows.length === 0 || (driverId && driverRows.length === 0)) {
            return res.status(404).json({ message: 'Cliente o conductor no encontrado.' });
        }

        const newEvent = {
            id: `asgn-${uuidv4()}`,
            clientId,
            clientName: clientRows[0].name,
            driverId,
            driverName: driverId ? driverRows[0].name : null,
            assignedAt: new Date(),
            status: 'PRE_ASIGNADO'
        };

        await db.query(
            'INSERT INTO assignment_events (id, "clientId", "clientName", "driverId", "driverName", "assignedAt", status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            Object.values(newEvent)
        );
        
        res.status(201).json(newEvent);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al asignar conductor al cliente.' });
    }
});

router.post('/complete', authMiddleware, async (req, res) => {
    const { clientId, packagesPickedUp } = req.body;
    const driverId = req.user.id;

    try {
        // 1. Try Legacy System (assignment_events)
        const { rows: eventRows } = await db.query(
            'SELECT * FROM assignment_events WHERE "clientId" = $1 AND "driverId" = $2 AND status = \'PENDIENTE\' ORDER BY "assignedAt" DESC LIMIT 1',
            [clientId, driverId]
        );

        if (eventRows.length > 0) {
            const eventToComplete = eventRows[0];
            
            const { rows: updatedRows } = await db.query(
                'UPDATE assignment_events SET status = \'COMPLETADO\', "completedAt" = $1, "packagesPickedUp" = $2 WHERE id = $3 RETURNING *',
                [new Date(), packagesPickedUp, eventToComplete.id]
            );
            
            await db.query('UPDATE users SET "assignedDriverId" = NULL, "lastAssignmentTimestamp" = NULL WHERE id = $1', [clientId]);
            
            return res.json(updatedRows[0]);
        }

        // 2. Try New System (pickup_assignments)
        // Look for ANY active assignment for this driver/client combo regardless of strict date matching.
        // This allows finishing a pickup even if the run was created "yesterday" or in a different timezone context.
        const { rows: updatedAssignments } = await db.query(
            `UPDATE pickup_assignments 
             SET status = 'RETIRADO', "packagesPickedUp" = $1, "updatedAt" = NOW() 
             WHERE "clientId" = $2 
             AND status IN ('ASIGNADO', 'EN_RUTA', 'PENDIENTE')
             AND "runId" IN (SELECT id FROM pickup_runs WHERE "driverId" = $3)
             RETURNING *`,
            [packagesPickedUp, clientId, driverId]
        );

        if (updatedAssignments.length > 0) {
            return res.json({ message: 'Retiro completado en sistema de rutas.', count: updatedAssignments.length });
        }

        // Fallback: If strictly no ASIGNADO task found but user is scanning, we might want to log it or auto-create.
        // For now, return 404 but with a specific message.
        return res.status(404).json({ message: 'No se encontró una asignación activa para finalizar. Asegúrese de que el retiro esté asignado.' });
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al completar el retiro.' });
    }
});


// PUT /api/assignments/:id/cost - Update pickup cost for an assignment
router.put('/:id/cost', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { id } = req.params;
    const { cost } = req.body;

    if (cost === undefined || typeof cost !== 'number' || cost < 0) {
        return res.status(400).json({ message: 'Se requiere un costo válido.' });
    }

    try {
        const { rows } = await db.query(
            'UPDATE assignment_events SET "pickupCost" = $1 WHERE id = $2 RETURNING *',
            [cost, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Asignación no encontrada.' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar el costo de la asignación.' });
    }
});

// POST /api/assignments/:id/dispatch - Sends the pre-assigned pickup to the driver
router.post('/:id/dispatch', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { id } = req.params;

    try {
        const { rows: eventRows } = await db.query(
            'SELECT * FROM assignment_events WHERE id = $1',
            [id]
        );

        if (eventRows.length === 0) {
            return res.status(404).json({ message: 'Asignación no encontrada.' });
        }
        
        const event = eventRows[0];
        
        if (event.status !== 'PRE_ASIGNADO') {
            return res.status(400).json({ message: 'Esta asignación ya ha sido enviada o completada.'});
        }
        
        if (event.pickupCost === null || event.pickupCost === undefined) {
            return res.status(400).json({ message: 'Se debe asignar un costo antes de enviar al conductor.'});
        }

        // 1. Update the user record to make the assignment visible to the driver
        const now = new Date();
        await db.query(
            'UPDATE users SET "assignedDriverId" = $1, "lastAssignmentTimestamp" = $2 WHERE id = $3',
            [event.driverId, now, event.clientId]
        );

        // 2. Update the assignment event status to PENDING
        const { rows: updatedEventRows } = await db.query(
            'UPDATE assignment_events SET status = \'PENDIENTE\', "assignedAt" = $1 WHERE id = $2 RETURNING *',
            [now, id]
        );

        res.json(updatedEventRows[0]);

    } catch (err) {
        console.error('Error in dispatch-pickup:', err);
        res.status(500).json({ message: 'Error al enviar la asignación al conductor.' });
    }
});

// POST /api/assignments/:id/reassign
router.post('/:id/reassign', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { id } = req.params;
    const { newDriverId, reason } = req.body;
    
    try {
        const { rows: eventRows } = await db.query('SELECT * FROM assignment_events WHERE id = $1', [id]);
        if (eventRows.length === 0) return res.status(404).json({ message: 'Asignación no encontrada.' });
        const event = eventRows[0];

        const { rows: newDriverRows } = await db.query('SELECT name FROM users WHERE id = $1', [newDriverId]);
        if (newDriverRows.length === 0) return res.status(404).json({ message: 'Nuevo conductor no encontrado.' });
        const newDriverName = newDriverRows[0].name;

        // If the assignment was already live, update the client's assigned driver
        if (event.status === 'PENDIENTE') {
            await db.query(
                'UPDATE users SET "assignedDriverId" = $1, "lastAssignmentTimestamp" = $2 WHERE id = $3',
                [newDriverId, new Date(), event.clientId]
            );
        }

        // Update the assignment event itself
        const { rows: updatedEventRows } = await db.query(
            'UPDATE assignment_events SET "driverId" = $1, "driverName" = $2, "assignedAt" = $3 WHERE id = $4 RETURNING *',
            [newDriverId, newDriverName, new Date(), id]
        );

        res.json(updatedEventRows[0]);
    } catch (err) {
        console.error('Error in reassign-pickup:', err);
        res.status(500).json({ message: 'Error al reasignar el conductor.' });
    }
});


module.exports = router;
