
const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const adminOrRetirosOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'RETIROS') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    next();
};

// GET /api/pickups/colectas/available
router.get('/colectas/available', authMiddleware, async (req, res) => {
    try {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
        
        // Find clients who have pending packages AND don't have an active assignment for today
        const { rows: availableClients } = await db.query(`
            SELECT u.id, u.name, u."pickupAddress" as address, u.phone,
                   (SELECT COUNT(*) FROM packages p WHERE p."creatorId" = u.id AND p.status = 'PENDIENTE') as "pendingCount"
            FROM users u
            WHERE u.role = 'CLIENT'
            AND u.status = 'APROBADO'
            AND (SELECT COUNT(*) FROM packages p WHERE p."creatorId" = u.id AND p.status = 'PENDIENTE') > 0
            AND u.id NOT IN (
                SELECT pa."clientId"
                FROM pickup_assignments pa
                JOIN pickup_runs pr ON pa."runId" = pr.id
                WHERE pr.date = $1
                AND pa.status != 'NO_RETIRADO'
            )
        `, [today]);

        res.json(availableClients);
    } catch (err) {
        console.error('Error fetching available colectas:', err);
        res.status(500).json({ message: 'Error al obtener colectas disponibles.' });
    }
});

// POST /api/pickups/colectas/claim
router.post('/colectas/claim', authMiddleware, async (req, res) => {
    const { clientId, shift } = req.body;
    const driverId = req.user.id;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    
    if (!clientId) return res.status(400).json({ message: 'Se requiere el ID del cliente.' });

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // 1. Check if already claimed
        const { rows: conflicts } = await client.query(`
            SELECT 1 FROM pickup_assignments pa
            JOIN pickup_runs pr ON pa."runId" = pr.id
            WHERE pa."clientId" = $1 AND pr.date = $2 AND pa.status != 'NO_RETIRADO'
        `, [clientId, today]);

        if (conflicts.length > 0) {
            throw new Error('Este retiro ya ha sido tomado por otro conductor.');
        }

        // 2. Find or create run for this driver today
        const { rows: existingRuns } = await client.query(
            'SELECT id FROM pickup_runs WHERE "driverId" = $1 AND date = $2 AND shift = $3',
            [driverId, today, shift || 'MANANA']
        );

        let runId;
        if (existingRuns.length > 0) {
            runId = existingRuns[0].id;
        } else {
            runId = `run-${uuidv4()}`;
            await client.query(
                'INSERT INTO pickup_runs (id, "driverId", date, shift) VALUES ($1, $2, $3, $4)',
                [runId, driverId, today, shift || 'MANANA']
            );
        }

        // 3. Get client info and pending count
        const { rows: clientRows } = await client.query('SELECT "pickupCost" FROM users WHERE id = $1', [clientId]);
        const { rows: pkgCountRows } = await client.query('SELECT COUNT(*) FROM packages WHERE "creatorId" = $1 AND status = \'PENDIENTE\'', [clientId]);
        
        const cost = clientRows[0].pickupCost || 0;
        const pendingCount = parseInt(pkgCountRows[0].count, 10);

        // 4. Create assignment
        const assignmentId = `pka-${uuidv4()}`;
        await client.query(
            'INSERT INTO pickup_assignments (id, "runId", "clientId", status, cost, "packagesToPickup") VALUES ($1, $2, $3, $4, $5, $6)',
            [assignmentId, runId, clientId, 'ASIGNADO', cost, pendingCount]
        );

        // 5. Sync legacy
        await client.query('UPDATE users SET "assignedDriverId" = $1 WHERE id = $2', [driverId, clientId]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Retiro tomado con éxito.', assignmentId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error claiming colecta:', err);
        res.status(400).json({ message: err.message || 'Error al tomar el retiro.' });
    } finally {
        client.release();
    }
});

// GET /api/pickups?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Se requieren fechas de inicio y fin.' });
    }

    try {
        const { rows: runs } = await db.query(
            `SELECT r.*, d.name as "driverName" 
             FROM pickup_runs r 
             JOIN users d ON r."driverId" = d.id 
             WHERE r.date >= $1 AND r.date <= $2`,
            [startDate, endDate]
        );

        if (runs.length === 0) {
            return res.json([]);
        }

        const runIds = runs.map(r => r.id);
        const placeholders = runIds.map((_, i) => `$${i + 1}`).join(',');
        const { rows: assignments } = await db.query(
            `SELECT pa.*, c.name as "clientName", c.address as "clientAddress", c.phone as "clientPhone"
             FROM pickup_assignments pa
             JOIN users c ON pa."clientId" = c.id
             WHERE pa."runId" IN (${placeholders})
             ORDER BY pa."createdAt" ASC`,
            runIds
        );

        const runsWithAssignments = runs.map(run => ({
            ...run,
            assignments: assignments.filter(a => a.runId === run.id)
        }));

        res.json(runsWithAssignments);
    } catch (err) {
        console.error('Error fetching pickup runs:', err);
        res.status(500).json({ message: 'Error al obtener las rutas de retiro.' });
    }
});

// POST /api/pickups
router.post('/', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { driverId, assignments, shift, date } = req.body; // assignments = [{ clientId, cost, packagesToPickup }]
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // TIMEZONE FIX: If date is missing, default to Santiago time, NOT UTC.
        // Also ensure we use the date string provided directly to avoid timezone shifts.
        const runDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
        
        // VALIDATION: Check if any client is already assigned for this date.
        // Strict check: pa.status != 'NO_RETIRADO' ensures we block if they are assigned (ASIGNADO) OR already picked up (RETIRADO).
        // This enforces one driver per client per day rule.
        
        for (const assignment of assignments) {
            const { rows: conflicts } = await client.query(
                `SELECT pr.id, u.name as "driverName", pr.shift
                 FROM pickup_assignments pa
                 JOIN pickup_runs pr ON pa."runId" = pr.id
                 JOIN users u ON pr."driverId" = u.id
                 WHERE pa."clientId" = $1 
                 AND pr.date = $2::date
                 AND pa.status != 'NO_RETIRADO'`,
                [assignment.clientId, runDate]
            );

            if (conflicts.length > 0) {
                const conflict = conflicts[0];
                // If it's a different run (or same run ID is not yet generated, but logic here checks DB state), it's a conflict.
                // Since we are creating a NEW run or updating, checking against DB is correct.
                // We allow update if it's the SAME run ID, but here we don't have runId yet for new runs.
                // However, existingRuns check below handles update logic. 
                // The conflict check here is primarily for OTHER runs.
                
                // We need to see if the conflict is actually the run we are about to update.
                const { rows: existingRuns } = await client.query(
                    'SELECT id FROM pickup_runs WHERE "driverId" = $1 AND date = $2::date AND shift = $3',
                    [driverId, runDate, shift]
                );
                const currentRunId = existingRuns.length > 0 ? existingRuns[0].id : null;

                if (conflict.id !== currentRunId) {
                    throw new Error(`El cliente ya tiene un retiro programado hoy con ${conflict.driverName} (Turno: ${conflict.shift}).`);
                }
            }
        }

        let runId;

        // Check if a run already exists for this driver, date, AND shift
        const { rows: existingRuns } = await client.query(
            'SELECT id FROM pickup_runs WHERE "driverId" = $1 AND date = $2::date AND shift = $3',
            [driverId, runDate, shift]
        );

        if (existingRuns.length > 0) {
            runId = existingRuns[0].id;
            await client.query('UPDATE pickup_runs SET informed = false WHERE id = $1', [runId]);
        } else {
            runId = `run-${uuidv4()}`;
            await client.query(
                'INSERT INTO pickup_runs (id, "driverId", date, shift) VALUES ($1, $2, $3, $4)',
                [runId, driverId, runDate, shift]
            );
        }

        for (const assignment of assignments) {
            // Double check to prevent inserting duplicate for same run if logic slipped (though conflict check above covers it)
            const { rows: existsInRun } = await client.query(
                'SELECT id FROM pickup_assignments WHERE "runId" = $1 AND "clientId" = $2',
                [runId, assignment.clientId]
            );

            if (existsInRun.length === 0) {
                const assignmentId = `pka-${uuidv4()}`;
                await client.query(
                    'INSERT INTO pickup_assignments (id, "runId", "clientId", status, cost, "packagesToPickup") VALUES ($1, $2, $3, $4, $5, $6)',
                    [assignmentId, runId, assignment.clientId, 'ASIGNADO', assignment.cost, assignment.packagesToPickup]
                );
                
                // SYNC LEGACY FIELD: Update user's assigned driver so it shows in driver app immediately
                await client.query('UPDATE users SET "assignedDriverId" = $1 WHERE id = $2', [driverId, assignment.clientId]);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ id: runId, driverId, date: runDate, shift, assignments });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating/updating pickup run:', err);
        res.status(400).json({ message: err.message || 'Error al crear o actualizar la ruta de retiro.' });
    } finally {
        client.release();
    }
});

// POST /api/pickups/runs/:id/copy - Copy a run to other dates
router.post('/runs/:id/copy', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { id: sourceRunId } = req.params;
    const { dates, assignmentIds } = req.body; 

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({ message: 'Se requiere un array de fechas de destino.' });
    }
    if (!assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
        return res.status(400).json({ message: 'Se requiere un array de IDs de asignaciones para copiar.' });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { rows: sourceRunRows } = await client.query('SELECT * FROM pickup_runs WHERE id = $1', [sourceRunId]);
        if (sourceRunRows.length === 0) {
            return res.status(404).json({ message: 'Ruta de origen no encontrada.' });
        }
        const sourceRun = sourceRunRows[0];

        const assignmentPlaceholders = assignmentIds.map((_, i) => `$${i + 2}`).join(',');
        const { rows: sourceAssignments } = await client.query(`SELECT * FROM pickup_assignments WHERE "runId" = $1 AND id IN (${assignmentPlaceholders})`, [sourceRunId, ...assignmentIds]);

        if (sourceAssignments.length === 0) {
            return res.status(200).json({ message: 'La ruta de origen no tiene retiros seleccionados para copiar.' });
        }
        
        const { rows: pendingPackages } = await client.query(`SELECT "creatorId" FROM packages WHERE status = 'PENDIENTE'`);
        const pendingPackagesByClient = pendingPackages.reduce((acc, pkg) => {
            if (!acc[pkg.creatorId]) acc[pkg.creatorId] = 0;
            acc[pkg.creatorId]++;
            return acc;
        }, {});


        for (const date of dates) {
            let targetRunId;
            const { rows: existingRuns } = await client.query(
                'SELECT id FROM pickup_runs WHERE "driverId" = $1 AND date = $2::date AND shift = $3',
                [sourceRun.driverId, date, sourceRun.shift]
            );

            if (existingRuns.length > 0) {
                targetRunId = existingRuns[0].id;
            } else {
                targetRunId = `run-${uuidv4()}`;
                await client.query(
                    'INSERT INTO pickup_runs (id, "driverId", date, shift) VALUES ($1, $2, $3, $4)',
                    [targetRunId, sourceRun.driverId, date, sourceRun.shift]
                );
            }

            for (const sourceAssignment of sourceAssignments) {
                // VALIDATION: Check if client already assigned on target date
                const { rows: conflicts } = await client.query(
                    `SELECT 1 FROM pickup_assignments pa JOIN pickup_runs pr ON pa."runId" = pr.id 
                     WHERE pa."clientId" = $1 AND pr.date = $2::date AND pa.status != 'NO_RETIRADO' AND pr.id != $3`,
                    [sourceAssignment.clientId, date, targetRunId]
                );
                
                if (conflicts.length > 0) {
                    // Skip this assignment if already assigned to avoid crash, or log warning
                    continue; 
                }

                // Check avoid duplicates in same run
                const { rows: existingTargetAssignments } = await client.query(
                    'SELECT id FROM pickup_assignments WHERE "runId" = $1 AND "clientId" = $2',
                    [targetRunId, sourceAssignment.clientId]
                );

                if (existingTargetAssignments.length === 0) {
                    const packageCount = pendingPackagesByClient[sourceAssignment.clientId] || 0;
                    const newAssignmentId = `pka-${uuidv4()}`;
                    await client.query(
                        'INSERT INTO pickup_assignments (id, "runId", "clientId", status, cost, "packagesToPickup") VALUES ($1, $2, $3, $4, $5, $6)',
                        [newAssignmentId, targetRunId, sourceAssignment.clientId, 'ASIGNADO', sourceAssignment.cost, packageCount]
                    );
                    
                    // SYNC LEGACY FIELD: If date is today, update assignment immediately
                    const today = new Date().toISOString().split('T')[0];
                    if (date === today) {
                         await client.query('UPDATE users SET "assignedDriverId" = $1 WHERE id = $2', [sourceRun.driverId, sourceAssignment.clientId]);
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Rutas copiadas exitosamente.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error copying pickup run:', err);
        res.status(500).json({ message: 'Error al copiar la ruta de retiro.' });
    } finally {
        client.release();
    }
});


// POST /api/pickups/runs/:id/assignments - Add assignments to an existing run
router.post('/runs/:id/assignments', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { id: runId } = req.params;
    const { assignments } = req.body; 
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const { rows: runRows } = await client.query('SELECT id, "driverId", date FROM pickup_runs WHERE id = $1', [runId]);
        if (runRows.length === 0) {
            return res.status(404).json({ message: 'Ruta de retiro no encontrada.' });
        }
        const driverId = runRows[0].driverId;
        const runDate = runRows[0].date; // This is a Date object or string depending on driver
        
        // Format date for query comparison
        const dateStr = new Date(runDate).toISOString().split('T')[0];

        for (const assignment of assignments) {
            // VALIDATION: Check duplicates on date
            const { rows: conflicts } = await client.query(
                `SELECT pr.id, u.name as "driverName" 
                 FROM pickup_assignments pa
                 JOIN pickup_runs pr ON pa."runId" = pr.id
                 JOIN users u ON pr."driverId" = u.id
                 WHERE pa."clientId" = $1 
                 AND pr.date = $2::date
                 AND pa.status != 'NO_RETIRADO'`,
                [assignment.clientId, dateStr]
            );

            if (conflicts.length > 0) {
                // If the conflict is in a DIFFERENT run, throw error.
                if (conflicts[0].id !== runId) {
                     throw new Error(`El cliente ya tiene un retiro programado hoy con ${conflicts[0].driverName}.`);
                } else {
                    // If it's the same run, it's a duplicate entry attempt, skip or error.
                    // Check if assignment already exists in this run
                    const { rows: existingAssignment } = await client.query(
                        'SELECT id FROM pickup_assignments WHERE "runId" = $1 AND "clientId" = $2',
                        [runId, assignment.clientId]
                    );
                    if (existingAssignment.length > 0) {
                        continue; // Skip existing
                    }
                }
            }

            const assignmentId = `pka-${uuidv4()}`;
            await client.query(
                'INSERT INTO pickup_assignments (id, "runId", "clientId", status, cost, "packagesToPickup") VALUES ($1, $2, $3, $4, $5, $6)',
                [assignmentId, runId, assignment.clientId, 'ASIGNADO', assignment.cost, assignment.packagesToPickup]
            );
            // SYNC LEGACY FIELD
            await client.query('UPDATE users SET "assignedDriverId" = $1 WHERE id = $2', [driverId, assignment.clientId]);
        }

        await client.query('UPDATE pickup_runs SET informed = false, "informedAt" = NULL WHERE id = $1', [runId]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Asignaciones agregadas con éxito.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding assignments to run:', err);
        res.status(400).json({ message: err.message || 'Error al agregar retiros a la ruta.' });
    } finally {
        client.release();
    }
});


// GET /api/pickups/driver/today
router.get('/driver/today', authMiddleware, async (req, res) => {
    const driverId = req.user.id;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

    try {
        const { rows: runs } = await db.query(
            'SELECT * FROM pickup_runs WHERE "driverId" = $1 AND date = $2',
            [driverId, today]
        );

        if (runs.length === 0) {
            return res.json([]);
        }

        const runIds = runs.map(r => r.id);
        const placeholders = runIds.map((_, i) => `$${i + 1}`).join(',');

        const { rows: assignments } = await db.query(
            `SELECT pa.*, c.name as "clientName", c."pickupAddress" as "clientAddress", c.phone as "clientPhone"
             FROM pickup_assignments pa
             JOIN users c ON pa."clientId" = c.id
             WHERE pa."runId" IN (${placeholders})
             ORDER BY pa.status ASC, pa."createdAt" ASC`,
            runIds
        );

        const runsWithAssignments = runs.map(run => ({
            ...run,
            assignments: assignments.filter(a => a.runId === run.id)
        }));
        
        res.json(runsWithAssignments);

    } catch (err) {
        console.error('Error fetching driver run:', err);
        res.status(500).json({ message: 'Error al obtener la ruta del conductor.' });
    }
});

// PUT /api/pickups/assignments/:id/status
router.put('/assignments/:id/status', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { status, packagesPickedUp } = req.body;
    try {
        const fieldsToUpdate = {
            status,
            updatedAt: new Date(),
        };
        if (packagesPickedUp !== undefined && status === 'RETIRADO') {
            fieldsToUpdate.packagesPickedUp = packagesPickedUp;
        }

        const setClauses = Object.keys(fieldsToUpdate).map((key, index) => `"${key}" = $${index + 1}`).join(', ');
        const values = Object.values(fieldsToUpdate);

        await db.query(
            `UPDATE pickup_assignments SET ${setClauses} WHERE id = $${values.length + 1}`,
            [...values, id]
        );

        res.status(204).send();
    } catch (err) {
        console.error('Error updating assignment status:', err);
        res.status(500).json({ message: 'Error al actualizar el estado del retiro.' });
    }
});

// PUT /api/pickups/assignments/:id (Single Reassign)
router.put('/assignments/:id', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { id } = req.params;
    const { cost, driverId } = req.body;
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        if (cost !== undefined) {
             await client.query('UPDATE pickup_assignments SET cost = $1, "updatedAt" = $2 WHERE id = $3', [cost, new Date(), id]);
        }
        
        if (driverId) {
            // 1. Find current assignment
            const { rows: assignmentRows } = await client.query('SELECT "runId", "clientId", status FROM pickup_assignments WHERE id = $1', [id]);
            if (assignmentRows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Asignación no encontrada.' });
            }
            const currentAssignment = assignmentRows[0];
            const oldRunId = currentAssignment.runId;

            // 2. Find target run details
            const { rows: oldRunRows } = await client.query('SELECT date, shift FROM pickup_runs WHERE id = $1', [oldRunId]);
            if (oldRunRows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Ruta de retiro original no encontrada.' });
            }
            const { date: runDate, shift: runShift } = oldRunRows[0];

            // 3. Find or create new run for NEW driver
            const { rows: newRunRows } = await client.query(
                'SELECT id FROM pickup_runs WHERE "driverId" = $1 AND date = $2 AND shift = $3',
                [driverId, runDate, runShift]
            );

            let newRunId;
            if (newRunRows.length > 0) {
                newRunId = newRunRows[0].id;
            } else {
                newRunId = `run-${uuidv4()}`;
                await client.query(
                    'INSERT INTO pickup_runs (id, "driverId", date, shift) VALUES ($1, $2, $3, $4)',
                    [newRunId, driverId, runDate, runShift]
                );
            }
            
            // 4. CRITICAL: Reset packages to PENDING if they were 'RETIRADO'
            // This forces the new driver to scan them again.
            await client.query(
                `UPDATE packages 
                 SET "driverId" = NULL, status = 'PENDIENTE', "updatedAt" = NOW()
                 WHERE "creatorId" = $1 AND status = 'RETIRADO'`, 
                [currentAssignment.clientId]
            );

            // 5. Move assignment to new run, reset status to ASIGNADO and count to 0/null
            await client.query(
                `UPDATE pickup_assignments 
                 SET "runId" = $1, status = 'ASIGNADO', "packagesPickedUp" = NULL, "updatedAt" = $2 
                 WHERE id = $3`,
                [newRunId, new Date(), id]
            );
            
            // 6. SYNC LEGACY FIELD
            await client.query('UPDATE users SET "assignedDriverId" = $1 WHERE id = $2', [driverId, currentAssignment.clientId]);
            
            // 7. Cleanup old run if empty
            const { rows: remainingAssignments } = await client.query('SELECT id FROM pickup_assignments WHERE "runId" = $1', [oldRunId]);
            if (remainingAssignments.length === 0) {
                await client.query('DELETE FROM pickup_runs WHERE id = $1', [oldRunId]);
                await client.query(
                    'UPDATE pickup_runs SET informed = false, "informedAt" = NULL WHERE id = $1',
                    [newRunId]
                );
            } else {
                 await client.query(
                    'UPDATE pickup_runs SET informed = false, "informedAt" = NULL WHERE id = $1 OR id = $2',
                    [oldRunId, newRunId]
                );
            }
        }
        await client.query('COMMIT');
        res.status(204).send();
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating assignment:', err);
        res.status(500).json({ message: 'Error al actualizar la asignación de retiro.' });
    } finally {
        client.release();
    }
});

// PUT /api/pickups/runs/:id/reassign (Full Run Reassign)
router.put('/runs/:id/reassign', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { id: sourceRunId } = req.params;
    const { newDriverId } = req.body;

    if (!newDriverId) {
        return res.status(400).json({ message: 'Se requiere el ID del nuevo conductor.' });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { rows: sourceRunRows } = await client.query('SELECT * FROM pickup_runs WHERE id = $1', [sourceRunId]);
        if (sourceRunRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Ruta de retiro de origen no encontrada.' });
        }
        const sourceRun = sourceRunRows[0];

        const { rows: targetRunRows } = await client.query(
            'SELECT id FROM pickup_runs WHERE "driverId" = $1 AND date = $2 AND shift = $3',
            [newDriverId, sourceRun.date, sourceRun.shift]
        );

        let finalRunId;
        
        // CRITICAL: Reset ALL packages associated with ANY client in this run to PENDING if they were RETIRADO.
        await client.query(`
            UPDATE packages
            SET "driverId" = NULL, status = 'PENDIENTE', "updatedAt" = NOW()
            WHERE status = 'RETIRADO' AND "creatorId" IN (
                SELECT "clientId" FROM pickup_assignments WHERE "runId" = $1
            )
        `, [sourceRunId]);


        if (targetRunRows.length > 0) {
            const targetRunId = targetRunRows[0].id;
            
            // Move assignments to existing target run, reset status
            await client.query(
                `UPDATE pickup_assignments 
                 SET "runId" = $1, status = 'ASIGNADO', "packagesPickedUp" = NULL, "updatedAt" = NOW()
                 WHERE "runId" = $2`,
                [targetRunId, sourceRunId]
            );

            await client.query('DELETE FROM pickup_runs WHERE id = $1', [sourceRunId]);
            finalRunId = targetRunId;
        } else {
            // Just change the driver of the current run and reset assignments status
            await client.query(
                'UPDATE pickup_runs SET "driverId" = $1 WHERE id = $2',
                [newDriverId, sourceRunId]
            );
            
            await client.query(
                `UPDATE pickup_assignments 
                 SET status = 'ASIGNADO', "packagesPickedUp" = NULL, "updatedAt" = NOW()
                 WHERE "runId" = $1`,
                [sourceRunId]
            );

            finalRunId = sourceRunId;
        }
        
        // SYNC LEGACY FIELD for ALL assignments in the run
        const { rows: affectedAssignments } = await client.query('SELECT "clientId" FROM pickup_assignments WHERE "runId" = $1', [finalRunId]);
        for (const assignment of affectedAssignments) {
             await client.query('UPDATE users SET "assignedDriverId" = $1 WHERE id = $2', [newDriverId, assignment.clientId]);
        }
        
        await client.query('UPDATE pickup_runs SET informed = false, "informedAt" = NULL WHERE id = $1', [finalRunId]);
        
        const { rows: finalRunRows } = await client.query(
             `SELECT r.*, d.name as "driverName" 
              FROM pickup_runs r 
              JOIN users d ON r."driverId" = d.id 
              WHERE r.id = $1`,
            [finalRunId]
        );
        const finalRun = finalRunRows[0];
        
        const { rows: finalAssignments } = await client.query(
            `SELECT pa.*, c.name as "clientName", c.address as "clientAddress", c.phone as "clientPhone"
             FROM pickup_assignments pa
             JOIN users c ON pa."clientId" = c.id
             WHERE pa."runId" = $1
             ORDER BY pa."createdAt" ASC`,
            [finalRunId]
        );
        
        finalRun.assignments = finalAssignments;

        await client.query('COMMIT');
        res.status(200).json(finalRun);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error reassigning pickup run:', err);
        res.status(500).json({ message: 'Error al reasignar la ruta de retiro.' });
    } finally {
        client.release();
    }
});

// PUT /api/pickups/runs/:id/inform
router.put('/runs/:id/inform', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(
            'UPDATE pickup_runs SET informed = true, "informedAt" = $1 WHERE id = $2',
            [new Date(), id]
        );
        res.status(204).send();
    } catch (err) {
        console.error('Error marking run as informed:', err);
        res.status(500).json({ message: 'Error al marcar la ruta como notificada.' });
    }
});

// DELETE /api/pickups/runs/:id
router.delete('/runs/:id', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM pickup_runs WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Ruta de retiro no encontrada.' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting pickup run:', err);
        res.status(500).json({ message: 'Error al eliminar la ruta de retiro.' });
    }
});


// DELETE /api/pickups/assignments/:id
router.delete('/assignments/:id', authMiddleware, adminOrRetirosOnly, async (req, res) => {
    const { id } = req.params;
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { rows: assignmentRows } = await client.query('SELECT "runId", "clientId" FROM pickup_assignments WHERE id = $1', [id]);
        if (assignmentRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Asignación no encontrada.' });
        }
        const { runId, clientId } = assignmentRows[0];

        const deleteResult = await client.query('DELETE FROM pickup_assignments WHERE id = $1', [id]);
        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK'); 
            return res.status(404).json({ message: 'Asignación no encontrada al intentar borrar.' });
        }
        
        // Clean up legacy assignment
        await client.query('UPDATE users SET "assignedDriverId" = NULL WHERE id = $1', [clientId]);

        await client.query('UPDATE pickup_runs SET informed = false WHERE id = $1', [runId]);
        
        await client.query('COMMIT');
        res.status(204).send();

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting assignment:', err);
        res.status(500).json({ message: 'Error al eliminar la asignación de retiro.' });
    } finally {
        client.release();
    }
});


module.exports = router;
