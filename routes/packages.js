

const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const https = require('https');
const NotificationService = require('../services/notificationService');
const { logAction } = require('../services/logger');
const meliPollingService = require('../services/meliPollingService');
const { geocodeAddress, triggerBackgroundGeocoding } = require('../services/geocodingService');

// Helper to get tracking history for a package
async function getHistory(packageId) {
    const { rows: history } = await db.query(
        'SELECT * FROM tracking_events WHERE "packageId" = $1 ORDER BY timestamp DESC',
        [packageId]
    );
    return history;
}

// Geocoding logic moved to services/geocodingService.js

// Middleware to authorize dispatch actions
const dispatchAllowed = (req, res, next) => {
    const allowedRoles = ['ADMIN', 'DRIVER', 'AUXILIAR'];
    if (allowedRoles.includes(req.user.role)) {
        return next();
    }
    return res.status(403).json({ message: 'No tiene permiso para despachar paquetes.' });
};


// GET /api/packages - with server-side pagination and filtering
router.get('/', authMiddleware, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 25,
            searchQuery,
            statusFilter,
            driverFilter,
            clientFilter,
            communeFilter,
            cityFilter,
            startDate,
            endDate,
            flexFilter,
            quickFilter,
            sortOrder = 'desc',
        } = req.query;

        const offset = (page - 1) * limit;
        let whereClauses = [];
        let queryParams = [];
        let paramIndex = 1;

        if (req.user.role === 'CLIENT') {
            whereClauses.push(`"creatorId" = $${paramIndex++}`);
            queryParams.push(req.user.id);
        }

        if (searchQuery) {
            whereClauses.push(`(p."recipientName" ILIKE $${paramIndex} OR p."recipientAddress" ILIKE $${paramIndex} OR p."recipientCity" ILIKE $${paramIndex} OR p."recipientCommune" ILIKE $${paramIndex} OR p.id ILIKE $${paramIndex} OR p."meliOrderId" ILIKE $${paramIndex} OR p."shopifyOrderId" ILIKE $${paramIndex} OR p."wooOrderId" ILIKE $${paramIndex} OR p."trackingId" ILIKE $${paramIndex} OR p."meliFlexCode" ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`);
            queryParams.push(`%${searchQuery}%`);
            paramIndex++;
        }

        if (statusFilter) {
            let statuses = Array.isArray(statusFilter) ? statusFilter : statusFilter.split(',');
            // Expand "closed" to include both ENTREGADO and DEVUELTO
            if (statuses.includes('closed')) {
                statuses = statuses.filter(s => s !== 'closed');
                if (!statuses.includes('ENTREGADO')) statuses.push('ENTREGADO');
                if (!statuses.includes('DEVUELTO')) statuses.push('DEVUELTO');
            }
            if (statuses.length > 0) {
                const placeholders = statuses.map((_, i) => `$${paramIndex + i}`).join(',');
                whereClauses.push(`p.status IN (${placeholders})`);
                queryParams.push(...statuses);
                paramIndex += statuses.length;
            }
        }

        if (driverFilter) {
            whereClauses.push(`p."driverId" = $${paramIndex++}`);
            queryParams.push(driverFilter);
        }
        
        if (clientFilter) { // Admin filtering by client from the filter bar
            whereClauses.push(`p."creatorId" = $${paramIndex++}`);
            queryParams.push(clientFilter);
        }

        if (communeFilter) {
            whereClauses.push(`p."recipientCommune" = $${paramIndex++}`);
            queryParams.push(communeFilter);
        }

        if (cityFilter) {
            whereClauses.push(`p."recipientCity" = $${paramIndex++}`);
            queryParams.push(cityFilter);
        }
        
        if (startDate) {
            whereClauses.push(`p."createdAt" >= $${paramIndex++}`);
            queryParams.push(startDate);
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1); // Make it inclusive of the end day
            whereClauses.push(`p."createdAt" < $${paramIndex++}`);
            queryParams.push(end.toISOString().split('T')[0]);
        }

        if (flexFilter) {
            if (flexFilter === 'flexed') {
                whereClauses.push(`p."isFlexed" = true`);
            } else if (flexFilter === 'not_flexed') {
                whereClauses.push(`(p."isFlexed" IS NULL OR p."isFlexed" = false)`);
            }
        }

        if (quickFilter) {
            if (quickFilter === 'closed') {
                whereClauses.push(`p.status IN ('ENTREGADO', 'DEVUELTO')`);
            } else if (quickFilter === 'cancelled') {
                whereClauses.push(`p.status = 'CANCELADO'`);
            } else if (quickFilter === 'rescheduled') {
                whereClauses.push(`p.status = 'REPROGRAMADO'`);
            }
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Query for total count
        const countQuery = `
            SELECT COUNT(*) 
            FROM packages p
            LEFT JOIN users u ON p."creatorId" = u.id
            ${whereString}
        `;
        const { rows: countRows } = await db.query(countQuery, queryParams);
        const total = parseInt(countRows[0].count, 10);
        
        const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
        const limitClause = limit > 0 ? `LIMIT $${paramIndex++} OFFSET $${paramIndex++}` : '';
        const packageQuery = `
            SELECT p.*, u.name as "clientName" 
            FROM packages p 
            LEFT JOIN users u ON p."creatorId" = u.id 
            ${whereString} 
            ORDER BY p."createdAt" ${orderDirection}
            ${limitClause}
        `;
        
        const finalQueryParams = [...queryParams];
        if (limit > 0) {
            finalQueryParams.push(limit, offset);
        }

        const { rows: packages } = await db.query(packageQuery, finalQueryParams);

        // Get history for only the paginated packages
        const packageIds = packages.map(p => p.id);
        let eventsByPackageId = {};
        if (packageIds.length > 0) {
            const placeholders = packageIds.map((_, i) => `$${i + 1}`).join(',');
            const { rows: allEvents } = await db.query(`SELECT * FROM tracking_events WHERE "packageId" IN (${placeholders}) ORDER BY timestamp DESC`, packageIds);
            
            eventsByPackageId = allEvents.reduce((acc, event) => {
                if (!acc[event.packageId]) acc[event.packageId] = [];
                acc[event.packageId].push(event);
                return acc;
            }, {});
        }

        const packagesWithHistory = packages.map(pkg => ({
            ...pkg,
            history: eventsByPackageId[pkg.id] || []
        }));
        
        res.json({ packages: packagesWithHistory, total });

    } catch (err) {
        console.error("Error in GET /api/packages:", err);
        res.status(500).json({ message: 'Error al obtener los paquetes.' });
    }
});


// Helper to add a tracking event
async function addTrackingEvent(packageId, status, location, details) {
    await db.query(
        'INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [packageId, status, location, details, new Date()]
    );
}

// GET /api/packages/reports/flex-discrepancies
router.get('/reports/flex-discrepancies', authMiddleware, async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Solo los administradores pueden ver este reporte.' });
    }
    try {
        const query = `
            SELECT 
                u.id as "driverId",
                u.name as "driverName",
                COUNT(p.id) as "totalAssigned",
                COUNT(p.id) FILTER (WHERE p."isFlexed" = true) as "totalFlexed",
                COUNT(p.id) FILTER (WHERE (p."isFlexed" = false OR p."isFlexed" IS NULL)) as "totalUnflexed"
            FROM packages p
            JOIN users u ON p."driverId" = u.id
            WHERE p."driverId" IS NOT NULL
              AND DATE(p."estimatedDelivery") = current_date
              AND (p.source = 'MERCADO_LIBRE' OR p."meliFlexCode" IS NOT NULL OR p."meliOrderId" IS NOT NULL)
            GROUP BY u.id, u.name
            ORDER BY "totalUnflexed" DESC
        `;
        const { rows } = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error in /api/packages/reports/flex-discrepancies:', err);
        res.status(500).json({ message: 'Error al generar el reporte de discrepancias.' });
    }
});

// GET /api/packages/reports/flex-discrepancies/:driverId
router.get('/reports/flex-discrepancies/:driverId', authMiddleware, async (req, res) => {
    try {
        const { driverId } = req.params;
        const query = `
            SELECT 
                p.id,
                p."recipientName",
                p."recipientAddress",
                p."recipientCommune",
                p.status,
                p."isFlexed",
                p."meliOrderId",
                p."trackingId"
            FROM packages p
            WHERE p."driverId" = $1
              AND DATE(p."estimatedDelivery") = current_date
              AND (p."isFlexed" = false OR p."isFlexed" IS NULL)
              AND (p.source = 'MERCADO_LIBRE' OR p."meliFlexCode" IS NOT NULL OR p."meliOrderId" IS NOT NULL)
            ORDER BY p.id ASC
        `;
        const { rows } = await db.query(query, [driverId]);
        res.json(rows);
    } catch (err) {
        console.error('Error in /api/packages/reports/flex-discrepancies/:driverId:', err);
        res.status(500).json({ message: 'Error al obtener los detalles de las discrepancias.' });
    }
});
router.post('/', authMiddleware, async (req, res) => {
    const { creatorId, recipientName, recipientPhone, recipientEmail, recipientAddress, recipientCommune, recipientCity, notes, estimatedDelivery, shippingType, origin, source, meliOrderId, shopifyOrderId, wooOrderId, trackingId } = req.body;
    
    // Validation
    const requiredFields = {
        creatorId: 'ID del cliente creador',
        recipientName: 'Nombre del destinatario',
        recipientPhone: 'Teléfono del destinatario',
        recipientAddress: 'Dirección del destinatario',
        recipientCommune: 'Comuna del destinatario',
        recipientCity: 'Ciudad del destinatario',
        estimatedDelivery: 'Fecha de entrega estimada',
        shippingType: 'Tipo de envío',
        origin: 'Origen del paquete'
    };

    const missingFields = [];
    for (const [field, label] of Object.entries(requiredFields)) {
        if (!req.body[field]) {
            missingFields.push(label);
        }
    }

    if (missingFields.length > 0) {
        return res.status(400).json({ 
            message: `Faltan datos obligatorios o están incompletos: ${missingFields.join(', ')}.` 
        });
    }

    try {
        const { rows: creatorRows } = await db.query('SELECT "clientIdentifier" FROM users WHERE id = $1', [creatorId]);
        if (creatorRows.length === 0) {
            return res.status(404).json({ message: 'Cliente creador no encontrado.' });
        }

        // Geocode the address
        const coords = await geocodeAddress(recipientAddress, recipientCommune, recipientCity);

        const now = new Date();
        const packageId = trackingId || `${creatorRows[0].clientIdentifier}-${uuidv4().split('-')[0]}`;
        
        const newPackage = {
            id: packageId,
            recipientName,
            recipientPhone,
            status: 'PENDIENTE',
            shippingType,
            origin,
            destination: recipientAddress, // legacy, can be removed later
            recipientAddress,
            recipientCommune,
            recipientCity,
            notes,
            estimatedDelivery: new Date(estimatedDelivery),
            createdAt: now,
            updatedAt: now,
            creatorId,
            source,
            meliOrderId,
            shopifyOrderId,
            wooOrderId,
            trackingId,
            recipientEmail,
            destLatitude: coords.lat,
            destLongitude: coords.lng
        };

        const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
        const values = Object.values(newPackage);
        const placeholders = values.map((_, i) => `$${i+1}`).join(', ');

        await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, values);
        await addTrackingEvent(newPackage.id, 'Creado', origin, 'Paquete creado.');
        
        await logAction(req.user.id, req.user.name, 'CREATE_PACKAGE', { packageId: newPackage.id, recipientName });

        newPackage.history = await getHistory(newPackage.id);
        
        // REQ: Do not send message on PENDIENTE, wait for Flex/Dispatch
        // NotificationService.notifyRecipient(newPackage.id, 'PENDIENTE');

        res.status(201).json(newPackage);
    } catch (err) {
        console.error('Error in POST /api/packages:', err);
        
        // Handle specific database errors
        if (err.code === '23505') {
            return res.status(400).json({ 
                message: 'Ya existe un paquete con este ID o código de seguimiento.' 
            });
        }
        
        if (err.code === '23502') {
            return res.status(400).json({ 
                message: `Faltan datos obligatorios en la base de datos: ${err.column}.` 
            });
        }

        res.status(500).json({ 
            message: 'Error al crear el paquete. Por favor, verifica que todos los datos sean correctos e intenta nuevamente.' 
        });
    }
});

// POST /api/packages/batch
router.post('/batch', authMiddleware, async (req, res) => {
    const { packages } = req.body;
    if (!packages || !Array.isArray(packages)) {
        return res.status(400).json({ message: "Se esperaba un array de paquetes." });
    }

    const results = [];
    const errors = [];

    try {
        for (let i = 0; i < packages.length; i++) {
            const pkgData = packages[i];
            try {
                const { 
                    creatorId, 
                    recipientName, 
                    recipientPhone, 
                    recipientEmail,
                    recipientAddress, 
                    recipientCommune, 
                    recipientCity, 
                    notes, 
                    estimatedDelivery, 
                    shippingType, 
                    origin, 
                    source, 
                    meliOrderId, 
                    shopifyOrderId, 
                    wooOrderId, 
                    trackingId 
                } = pkgData;
                
                // Validate required fields for each package
                const requiredFields = {
                    creatorId: 'ID del cliente creador',
                    recipientName: 'Nombre del destinatario',
                    recipientPhone: 'Teléfono del destinatario',
                    recipientAddress: 'Dirección del destinatario',
                    recipientCommune: 'Comuna del destinatario',
                    recipientCity: 'Ciudad del destinatario',
                    estimatedDelivery: 'Fecha de entrega estimada',
                    shippingType: 'Tipo de envío',
                    origin: 'Origen del paquete'
                };

                const missingFields = [];
                for (const [field, label] of Object.entries(requiredFields)) {
                    if (!pkgData[field] || (typeof pkgData[field] === 'string' && pkgData[field].trim() === '')) {
                        missingFields.push(label);
                    }
                }

                if (missingFields.length > 0) {
                    errors.push({
                        index: i,
                        recipientName: recipientName || 'Desconocido',
                        error: `Faltan datos obligatorios: ${missingFields.join(', ')}`
                    });
                    continue;
                }

                const { rows: creatorRows } = await db.query('SELECT "clientIdentifier" FROM users WHERE id = $1', [creatorId]);
                if (creatorRows.length === 0) {
                    errors.push({ 
                        index: i, 
                        recipientName: recipientName || 'Desconocido',
                        error: `Cliente creador no encontrado.` 
                    });
                    continue;
                }
                
                // Geocoding is now handled in the background for speed
                const coords = { lat: null, lng: null };

                const now = new Date();
                const packageId = trackingId || `${creatorRows[0].clientIdentifier}-${uuidv4().split('-')[0]}`;

                const newPackage = {
                    id: packageId,
                    recipientName, 
                    recipientPhone, 
                    status: 'PENDIENTE', 
                    shippingType, 
                    origin, 
                    destination: recipientAddress, 
                    recipientAddress, 
                    recipientCommune, 
                    recipientCity, 
                    notes, 
                    estimatedDelivery: new Date(estimatedDelivery), 
                    createdAt: now, 
                    updatedAt: now, 
                    creatorId, 
                    source, 
                    meliOrderId, 
                    shopifyOrderId, 
                    wooOrderId, 
                    trackingId,
                    recipientEmail,
                    destLatitude: coords.lat,
                    destLongitude: coords.lng
                };
                
                const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
                const values = Object.values(newPackage);
                const placeholders = values.map((_, i) => `$${i+1}`).join(', ');

                await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, values);
                await addTrackingEvent(newPackage.id, 'Creado', origin, 'Paquete creado.');
                
                results.push(newPackage);
            } catch (err) {
                console.error(`Error creating package at index ${i}:`, err);
                
                let errorMessage = err.message;
                if (err.code === '23505') {
                    errorMessage = 'Ya existe un paquete con este ID o código de seguimiento.';
                } else if (err.code === '23502') {
                    errorMessage = `Faltan datos obligatorios en la base de datos: ${err.column}.`;
                }

                errors.push({ 
                    index: i, 
                    recipientName: pkgData.recipientName || 'Desconocido',
                    error: errorMessage
                });
            }
        }
        
        // Trigger background geocoding without awaiting it
        setTimeout(() => {
            triggerBackgroundGeocoding();
        }, 1000);

        res.status(201).json({ 
            success: true, 
            importedCount: results.length, 
            errorCount: errors.length,
            errors: errors
        });

    } catch (err) {
        console.error('Error in POST /api/packages/batch:', err);
        res.status(500).json({ message: 'Error del servidor al crear los paquetes en lote.' });
    }
});

// POST /api/packages/batch-assign-driver
router.post('/batch-assign-driver', authMiddleware, async (req, res) => {
    const { packageIds, driverId, newDeliveryDate } = req.body;
    if (!packageIds || !Array.isArray(packageIds) || packageIds.length === 0 || !driverId || !newDeliveryDate) {
        return res.status(400).json({ message: 'IDs de paquetes, ID de conductor y fecha son requeridos.' });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { rows: driverRows } = await client.query('SELECT name FROM users WHERE id = $1', [driverId]);
        if (driverRows.length === 0) {
            throw new Error('Conductor no encontrado.');
        }
        const driverName = driverRows[0].name;
        
        const placeholders = packageIds.map((_, i) => `$${i + 5}`).join(', ');

        // Force status to ASIGNADO only if driverId is provided, otherwise RETIRADO (Available)
        const targetStatus = driverId && driverId !== 'none' ? 'ASIGNADO' : 'RETIRADO';
        const finalDriverId = driverId === 'none' ? null : driverId;

        const updateQuery = `
            UPDATE packages 
            SET "driverId" = $1, "estimatedDelivery" = $2, "updatedAt" = $3, status = $4
            WHERE id IN (${placeholders})
        `;
        
        await client.query(updateQuery, [finalDriverId, newDeliveryDate, new Date(), targetStatus, ...packageIds]);

        // Create tracking events for all updated packages
        const eventPromises = packageIds.map(packageId => {
            const details = `Asignado a conductor ${driverName}. Estado actualizado a Asignado.`;
            return client.query(
                'INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
                [packageId, 'Asignado', 'Centro de Distribución', details, new Date()]
            );
        });
        
        await Promise.all(eventPromises);

        await client.query('COMMIT');
        res.status(200).json({ message: `${packageIds.length} paquetes asignados correctamente.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in POST /api/packages/batch-assign-driver:', err);
        res.status(500).json({ message: 'Error del servidor al asignar los paquetes.' });
    } finally {
        client.release();
    }
});

// PUT /api/packages/:id
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        updateData.updatedAt = new Date();

        // Fetch current data to compare and for geocoding
        const { rows: currentPkgRows } = await db.query('SELECT "recipientAddress", "recipientCommune", "recipientCity" FROM packages WHERE id = $1', [id]);
        if (currentPkgRows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        const currentPkg = currentPkgRows[0];

        // Check if address changed to add a tracking event
        const newAddr = updateData.recipientAddress !== undefined ? updateData.recipientAddress : currentPkg.recipientAddress;
        const newComm = updateData.recipientCommune !== undefined ? updateData.recipientCommune : currentPkg.recipientCommune;
        const newCity = updateData.recipientCity !== undefined ? updateData.recipientCity : currentPkg.recipientCity;

        const addressChanged = 
            (updateData.recipientAddress !== undefined && updateData.recipientAddress !== currentPkg.recipientAddress) ||
            (updateData.recipientCommune !== undefined && updateData.recipientCommune !== currentPkg.recipientCommune) ||
            (updateData.recipientCity !== undefined && updateData.recipientCity !== currentPkg.recipientCity);

        if (addressChanged) {
            const oldFullAddr = `${currentPkg.recipientAddress}, ${currentPkg.recipientCommune}, ${currentPkg.recipientCity}`;
            const newFullAddr = `${newAddr}, ${newComm}, ${newCity}`;
            await addTrackingEvent(id, 'Dirección Actualizada', newComm, `Dirección cambiada de "${oldFullAddr}" a "${newFullAddr}".`);
            
            // Geocode the new address
            const coords = await geocodeAddress(newAddr, newComm, newCity);
            if (coords.lat && coords.lng) {
                updateData.destLatitude = coords.lat;
                updateData.destLongitude = coords.lng;
            }
        }

        const fields = Object.keys(updateData);
        const values = Object.values(updateData);
        const setClause = fields.map((field, i) => `"${field}" = $${i + 1}`).join(', ');
        
        const result = await db.query(`UPDATE packages SET ${setClause} WHERE id = $${fields.length + 1}`, [...values, id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        
        await logAction(req.user.id, req.user.name, 'UPDATE_PACKAGE', { packageId: id, updatedFields: fields });

        const { rows } = await db.query('SELECT * FROM packages WHERE id = $1', [id]);
        const updatedPackage = rows[0];
        updatedPackage.history = await getHistory(id);
        res.json(updatedPackage);

    } catch (err) {
        console.error('Error in PUT /api/packages/:id:', err);
        res.status(500).json({ message: 'Error al actualizar el paquete.' });
    }
});

// DELETE /api/packages/:id
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM tracking_events WHERE "packageId" = $1', [id]);
        const result = await db.query('DELETE FROM packages WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });

        await logAction(req.user.id, req.user.name, 'DELETE_PACKAGE', { packageId: id });

        res.status(204).send();
    } catch (err) {
        console.error('Error in DELETE /api/packages/:id:', err);
        res.status(500).json({ message: 'Error al eliminar el paquete.' });
    }
});

// POST /api/packages/:id/assign-driver
router.post('/:id/assign-driver', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { driverId, newDeliveryDate } = req.body;
    try {
        // Force status to ASIGNADO only if driverId is provided, otherwise RETIRADO (Available)
        const targetStatus = driverId ? 'ASIGNADO' : 'RETIRADO';
        const { rows } = await db.query(
            'UPDATE packages SET "driverId" = $1, "estimatedDelivery" = $2, "updatedAt" = $3, status = $4 WHERE id = $5 RETURNING *',
            [driverId, newDeliveryDate, new Date(), targetStatus, id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        
        const driverName = driverId ? (await db.query('SELECT name FROM users WHERE id = $1', [driverId])).rows[0]?.name : 'Nadie';
        await addTrackingEvent(id, 'Asignado', 'Centro de Distribución', `Asignado a conductor ${driverName}. Estado actualizado a Asignado.`);
        
        const updatedPackage = rows[0];
        updatedPackage.history = await getHistory(id);
        res.json(updatedPackage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al asignar conductor.' });
    }
});

// POST /api/packages/:id/dispatch
router.post('/:id/dispatch', authMiddleware, dispatchAllowed, async (req, res) => {
    const { id } = req.params;
    const { driverId, flexCode, flexLabelPhotoBase64 } = req.body;
    try {
        // [NUEVO] Búsqueda extendida: Intentar encontrar por ID interno, ID de Mercado Libre, Shopify, Woo o Tracking ID
        let { rows: pkgRows } = await db.query(
            'SELECT id, status, "driverId", "meliFlexCode", source FROM packages WHERE id = $1 OR "meliOrderId" = $1 OR "shopifyOrderId" = $1 OR "wooOrderId" = $1 OR "trackingId" = $1 OR "meliFlexCode" = $1', 
            [id]
        );
        
        // [NUEVO] IMPORTACIÓN BAJO DEMANDA (Just-In-Time)
        // Si el paquete no se encuentra, intentamos buscarlo directamente en Mercado Libre a través de nuestros clientes integrados
        if (pkgRows.length === 0) {
            console.log(`[Dispatch] Package ${id} NOT found in DB. Starting JIT Discovery loop...`);
            const { rows: meliUsers } = await db.query("SELECT id, name FROM users WHERE integrations->'meli' IS NOT NULL");
            console.log(`[Dispatch] Found ${meliUsers.length} potential MELI clients to check.`);
            
            for (const u of meliUsers) {
                try {
                    console.log(`[Dispatch] Checking ML client ${u.name} (ID: ${u.id}) for shipment ${id}...`);
                    // IMPORTANT: We pass TRUE for skipRegionFilter because a driver is physically holding the package
                    const importedId = await meliPollingService.importSpecificMeliPackage(u.id, id, true);
                    if (importedId) {
                        console.log(`[Dispatch] SUCCESS! Shipment ${id} found for client ${u.name}. Linked as ${importedId}.`);
                        const { rows: reCheck } = await db.query('SELECT id, status, "driverId", "meliFlexCode", source FROM packages WHERE id = $1', [importedId]);
                        pkgRows = reCheck;
                        break;
                    }
                } catch (meliErr) {
                    console.error(`[Dispatch] JIT check failed for client ${u.name}:`, meliErr.message);
                }
            }
        }

        if (pkgRows.length === 0) {
            console.warn(`[Dispatch] JIT Discovery failed for ID ${id}. Returning 404.`);
            return res.status(404).json({ message: `Paquete ${id} no encontrado. Asegúrate de que pertenezca a un cliente con integración activa.` });
        }
        const currentPkg = pkgRows[0];
        const realId = currentPkg.id; // Use the internal ID for updates
        
        if (['ENTREGADO', 'DEVUELTO'].includes(currentPkg.status)) {
            return res.status(400).json({ message: `Paquete ya se encuentra ${currentPkg.status}.` });
        }

        // If a flexCode is explicitly provided in the body, use it.
        // Otherwise, if scanned ID is different from internal ID and we don't have a flex code, save it.
        let flexCodeToSave = flexCode || currentPkg.meliFlexCode;

        // [NUEVO] Si flexCodeToSave es un JSON (etiqueta oficial), extraer solo el ID
        if (flexCodeToSave && flexCodeToSave.startsWith('{')) {
            try {
                const parsed = JSON.parse(flexCodeToSave);
                if (parsed.id) flexCodeToSave = String(parsed.id);
            } catch (e) {
                // Fallback si no es un JSON válido
            }
        }

        if (!flexCode && id !== realId && !currentPkg.meliFlexCode) {
            flexCodeToSave = id;
        }

        const { rows: driverRows } = await db.query('SELECT name FROM users WHERE id = $1', [driverId]);
        if (driverRows.length === 0) return res.status(404).json({ message: 'Conductor no encontrado.' });
        const driverName = driverRows[0].name;

        let details = `Paquete despachado por ${driverName}.`;
        if (currentPkg.driverId && currentPkg.driverId !== driverId) {
            const { rows: oldDriverRows } = await db.query('SELECT name FROM users WHERE id = $1', [currentPkg.driverId]);
            const oldDriverName = oldDriverRows[0]?.name || 'desconocido';
            details = `Paquete re-asignado de ${oldDriverName} a ${driverName}.`;
        }

        // If flexCode provided, add it to notes as requested
        let notesUpdate = '';
        if (flexCode) {
            notesUpdate = `\n[Cod. Escaneado: ${flexCode}]`;
        }

        const isFlexed = currentPkg.source === 'MERCADO_LIBRE';
        const now = new Date();

        const { rows } = await db.query(
            'UPDATE packages SET "driverId" = $1, status = $2, "updatedAt" = $3, "meliFlexCode" = $4, "flexLabelPhotoBase64" = $5, "isFlexed" = $6, "flexedAt" = CASE WHEN $6 = true AND "flexedAt" IS NULL THEN $3 ELSE "flexedAt" END, notes = COALESCE(notes, \'\') || $7 WHERE id = $8 RETURNING *',
            [driverId, 'EN_TRANSITO', now, flexCodeToSave, flexLabelPhotoBase64, isFlexed, notesUpdate, realId]
        );

        await addTrackingEvent(realId, 'EN_TRANSITO', 'Centro de Distribución', details + (flexCode ? ` (QR: ${flexCode})` : ''));
        
        await logAction(req.user.id, req.user.name, 'DISPATCH_PACKAGE', { packageId: realId, driverId });

        const updatedPkg = rows[0];
        updatedPkg.history = await getHistory(realId);
        
        // Notify recipient
        NotificationService.notifyRecipient(realId, 'EN_TRANSITO');

        res.json({ 
            message: `Paquete ${realId} asignado a ${driverName} y en tránsito.`,
            package: updatedPkg
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al despachar paquete.' });
    }
});

// POST /api/packages/:id/flex
router.post('/:id/flex', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { isFlexed, flexLabelPhotoBase64 } = req.body;
    try {
        // Check current status before flex
        const checkResult = await db.query('SELECT status FROM packages WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Paquete no encontrado.' });
        }
        
        const currentStatus = checkResult.rows[0].status;
        if (currentStatus === 'ENTREGADO' || currentStatus === 'DEVUELTO') {
            return res.status(400).json({ 
                message: `No se puede marcar como Flex un paquete que ya está ${currentStatus}.` 
            });
        }

        const { rows } = await db.query(
            `UPDATE packages SET "isFlexed" = $1, "flexedAt" = $2, "updatedAt" = $3, "flexLabelPhotoBase64" = $4${isFlexed ? ", status = 'EN_TRANSITO'" : ""} WHERE id = $5 RETURNING *`,
            [isFlexed, isFlexed ? new Date() : null, new Date(), flexLabelPhotoBase64 || null, id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        
        const statusText = isFlexed ? 'Flexeado' : 'No Flexeado';
        const details = flexLabelPhotoBase64 ? `Paquete marcado como ${statusText} con respaldo de etiqueta.` : `Paquete marcado como ${statusText}.`;
        await addTrackingEvent(id, statusText, 'Centro de Distribución', details);
        
        await logAction(req.user.id, req.user.name, 'FLEX_PACKAGE', { packageId: id, isFlexed });

        if (isFlexed) {
            // REQ: Exact moment to send the tracking URL to the client
            const NotificationService = require('../services/notificationService');
            NotificationService.notifyRecipient(id, 'EN_TRANSITO');
        }

        const updatedPackage = rows[0];
        updatedPackage.history = await getHistory(id);
        res.json(updatedPackage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar estado Flex.' });
    }
});

// POST /api/packages/sync-meli-all
router.post('/sync-meli-all', authMiddleware, async (req, res) => {
    try {
        const result = await meliPollingService.pollMeliPackages();
        res.json({ message: 'Sincronización masiva completada.', result });
    } catch (err) {
        console.error('Error in POST /api/packages/sync-meli-all:', err);
        res.status(500).json({ message: err.message || 'Error al sincronizar paquetes con Mercado Libre.' });
    }
});

// POST /api/packages/:id/sync-meli
router.post('/:id/sync-meli', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await meliPollingService.syncPackage(id);
        res.json(result);
    } catch (err) {
        console.error('Error in POST /api/packages/:id/sync-meli:', err);
        res.status(500).json({ message: err.message || 'Error al sincronizar con Mercado Libre.' });
    }
});

// --- MELI API HELPERS (to be used in /deliver endpoint) ---
const makeMeliRequest = (options, postData = null) => {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        reject({ statusCode: res.statusCode, body: parsedData });
                    }
                } catch (e) {
                    reject({ statusCode: res.statusCode, body: data, isRaw: true });
                }
            });
        });
        req.on('error', (e) => reject(e));
        if (postData) req.write(postData);
        req.end();
    });
};
const makeMeliGetRequest = (path, accessToken) => makeMeliRequest({
    hostname: 'api.mercadolibre.com', path, method: 'GET', headers: { 'Authorization': `Bearer ${accessToken}` }
});
const makeMeliPostRequest = (path, postData) => makeMeliRequest({
    hostname: 'api.mercadolibre.com', path, method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
}, postData);
// --- END MELI HELPERS ---

// POST /api/packages/:id/deliver
router.post('/:id/deliver', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { receiverName, receiverId, photosBase64 } = req.body;
    try {
        const { rows: settingsRows } = await db.query('SELECT "meliFlexValidation" FROM system_settings WHERE id = 1');
        const meliFlexValidation = settingsRows.length > 0 ? settingsRows[0].meliFlexValidation : true;

        // --- NEW MELI VALIDATION (STRICT) ---
        if (meliFlexValidation) {
            try {
                const { rows: pkgRows } = await db.query('SELECT "meliFlexCode", "creatorId" FROM packages WHERE id = $1', [id]);
                if (pkgRows.length > 0 && pkgRows[0].meliFlexCode) {
                    const { meliFlexCode, creatorId } = pkgRows[0];

                    const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [creatorId]);
                    let meliIntegration = userRows[0]?.integrations?.meli;
                    
                    if (meliIntegration) {
                        if (Date.now() >= meliIntegration.expiresAt) {
                            try {
                                const { rows: integrationSettingsRows } = await db.query('SELECT meli_app_id, meli_client_secret FROM integration_settings WHERE id = 1');
                                if (integrationSettingsRows[0]?.meli_app_id) {
                                    const { meli_app_id, meli_client_secret } = integrationSettingsRows[0];
                                    const refreshData = new URLSearchParams({ grant_type: 'refresh_token', client_id: meli_app_id.trim(), client_secret: meli_client_secret.trim(), refresh_token: meliIntegration.refreshToken }).toString();
                                    const refreshedTokenData = await makeMeliPostRequest('/oauth/token', refreshData);
                                    meliIntegration = { ...meliIntegration, accessToken: refreshedTokenData.access_token, refreshToken: refreshedTokenData.refresh_token, expiresAt: Date.now() + (refreshedTokenData.expires_in * 1000) };
                                    await db.query('UPDATE users SET integrations = $1 WHERE id = $2', [JSON.stringify({ ...userRows[0].integrations, meli: meliIntegration }), creatorId]);
                                }
                            } catch (refreshError) {
                                console.error(`[Deliver] Error refreshing ML token for shipment ${meliFlexCode}:`, refreshError);
                                return res.status(400).json({ message: 'Error de conexión con Mercado Libre. Por favor, reintenta en unos momentos.' });
                            }
                        }
                        
                        try {
                            const shippingDetails = await makeMeliGetRequest(`/shipments/${meliFlexCode}`, meliIntegration.accessToken);
                            if (shippingDetails.status !== 'delivered') {
                                return res.status(400).json({ message: 'Aún no has finalizado la entrega en la app de Mercado Libre Flex. Por favor, complétala allí primero y luego confirma aquí.' });
                            }
                        } catch(meliError) {
                             console.error(`[Deliver] Meli status verification failed for shipment ${meliFlexCode}:`, meliError.body || meliError.message);
                             return res.status(400).json({ message: 'No se pudo verificar el estado en Mercado Libre. Asegúrate de haber completado la entrega en la app de Flex.' });
                        }
                    }
                }
            } catch (validationError) {
                console.error('[Deliver] Fatal error in Meli validation block:', validationError);
                return res.status(500).json({ message: 'Error interno validando estado con Mercado Libre.' });
            }
        }
        // --- END MELI VALIDATION ---

        const { rows } = await db.query(
            'UPDATE packages SET status = $1, "deliveryReceiverName" = $2, "deliveryReceiverId" = $3, "deliveryPhotosBase64" = $4, "updatedAt" = $5 WHERE id = $6 RETURNING *',
            ['ENTREGADO', receiverName, receiverId, JSON.stringify(photosBase64), new Date(), id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });

        await addTrackingEvent(id, 'ENTREGADO', rows[0].recipientAddress, `Entregado a ${receiverName}.`);
        
        await logAction(req.user.id, req.user.name, 'DELIVER_PACKAGE', { packageId: id, receiverName });

        const updatedPackage = rows[0];
        updatedPackage.history = await getHistory(id);

        // Notify recipient
        NotificationService.notifyRecipient(id, 'ENTREGADO');

        res.json(updatedPackage);

    } catch(err) {
        console.error(`[Deliver] Fatal error confirming delivery for package ${id}:`, err);
        res.status(500).json({ message: `Error al confirmar la entrega: ${err.message || 'Error desconocido'}` });
    }
});

// POST /api/packages/:id/problem
router.post('/:id/problem', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { reason, photosBase64 } = req.body;
    try {
        const { rows } = await db.query(
            'UPDATE packages SET status = $1, "deliveryPhotosBase64" = $2, "updatedAt" = $3 WHERE id = $4 RETURNING *',
            ['PROBLEMA', JSON.stringify(photosBase64), new Date(), id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        await addTrackingEvent(id, 'PROBLEMA', rows[0].recipientAddress, `Problema reportado: ${reason}`);
        
        const updatedPackage = rows[0];
        updatedPackage.history = await getHistory(id);

        // Notify recipient
        NotificationService.notifyRecipient(id, 'PROBLEMA');

        res.json(updatedPackage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al reportar el problema.' });
    }
});

// POST /api/packages/:id/pickup
router.post('/:id/pickup', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { flexCode } = req.body;
    const driverId = req.user.id;
    try {
         const { rows } = await db.query(
            'UPDATE packages SET status = $1, "driverId" = $2, "updatedAt" = $3, "meliFlexCode" = $4 WHERE id = $5 RETURNING *',
            ['RETIRADO', driverId, new Date(), flexCode || null, id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        
        const driverName = (await db.query('SELECT name FROM users WHERE id = $1', [driverId])).rows[0]?.name;
        await addTrackingEvent(id, 'RETIRADO', rows[0].origin, `Retirado por conductor ${driverName}.`);
        
        const updatedPackage = rows[0];
        updatedPackage.history = await getHistory(id);

        // Notify recipient
        NotificationService.notifyRecipient(id, 'RETIRO');

        res.json(updatedPackage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al marcar como retirado.' });
    }
});

// POST /api/packages/bulk-pickup-client
router.post('/bulk-pickup-client', authMiddleware, async (req, res) => {
    const { clientId } = req.body;
    const driverId = req.user.id;
    
    if (!clientId) {
        return res.status(400).json({ message: 'Client ID is required.' });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        
        // Get the driver's name for the event log
        const { rows: driverRows } = await client.query('SELECT name FROM users WHERE id = $1', [driverId]);
        const driverName = driverRows.length > 0 ? driverRows[0].name : 'Conductor';

        // Find all pending packages for this client
        const { rows: pendingPackages } = await client.query(
            'SELECT id, origin FROM packages WHERE "creatorId" = $1 AND status = $2',
            [clientId, 'PENDIENTE']
        );
        
        if (pendingPackages.length === 0) {
             await client.query('ROLLBACK');
             return res.status(200).json({ count: 0, message: 'No hay paquetes pendientes para retirar.' });
        }

        const packageIds = pendingPackages.map(p => p.id);

        // Update all pending packages to RETIRADO
        const placeholders = packageIds.map((_, i) => `$${i + 4}`).join(', ');
        await client.query(
            `UPDATE packages SET status = $1, "driverId" = $2, "updatedAt" = $3 WHERE id IN (${placeholders})`,
            ['RETIRADO', driverId, new Date(), ...packageIds]
        );

        // Log events for each package
        const location = pendingPackages[0].origin || 'Tienda Cliente';
        const details = `Retiro masivo confirmado por conductor ${driverName}.`;
        
        const eventPromises = packageIds.map(pkgId => {
             // Notify recipient
             NotificationService.notifyRecipient(pkgId, 'RETIRO');

             return client.query(
                'INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
                [pkgId, 'RETIRADO', location, details, new Date()]
            );
        });
        
        await Promise.all(eventPromises);

        // Update pickup_assignments table (New System)
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
        await client.query(
            `UPDATE pickup_assignments 
             SET status = 'RETIRADO', "packagesPickedUp" = $1, "updatedAt" = $2
             WHERE "clientId" = $3 AND status = 'ASIGNADO' 
             AND "runId" IN (SELECT id FROM pickup_runs WHERE "driverId" = $4 AND date = $5)`,
            [packageIds.length, new Date(), clientId, driverId, today]
        );


        await client.query('COMMIT');
        res.status(200).json({ count: packageIds.length, message: `Se retiraron ${packageIds.length} paquetes exitosamente.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error al procesar el retiro masivo.' });
    } finally {
        client.release();
    }
});

// POST /api/packages/:id/mark-for-return
router.post('/:id/mark-for-return', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query(
            'UPDATE packages SET status = $1, "updatedAt" = $2 WHERE id = $3 RETURNING *',
            ['PENDIENTE_DEVOLUCION', new Date(), id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        await addTrackingEvent(id, 'PENDIENTE_DEVOLUCION', 'Centro de Distribución', 'Devolución solicitada por administrador.');
        
        const updatedPackage = rows[0];
        updatedPackage.history = await getHistory(id);
        res.json(updatedPackage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al marcar para devolución.' });
    }
});

// POST /api/packages/:id/return
router.post('/:id/return', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { receiverName, receiverId, photosBase64 } = req.body;
    try {
        const { rows } = await db.query(
            'UPDATE packages SET status = $1, "deliveryReceiverName" = $2, "deliveryReceiverId" = $3, "deliveryPhotosBase64" = $4, "updatedAt" = $5 WHERE id = $6 RETURNING *',
            ['DEVUELTO', receiverName, receiverId, JSON.stringify(photosBase64), new Date(), id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });

        await addTrackingEvent(id, 'DEVUELTO', rows[0].origin, `Devuelto a remitente. Recibido por ${receiverName}.`);
        
        const updatedPackage = rows[0];
        updatedPackage.history = await getHistory(id);

        // Notify recipient
        NotificationService.notifyRecipient(id, 'DEVOLUCION');

        res.json(updatedPackage);

    } catch(err) {
        console.error(err);
        res.status(500).json({ message: 'Error al confirmar la devolución.' });
    }
});

// POST /api/packages/:id/scan-admin
router.post('/:id/scan-admin', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: pkgRows } = await db.query(
            'SELECT id, status, "meliFlexCode" FROM packages WHERE id = $1 OR "meliOrderId" = $1 OR "shopifyOrderId" = $1 OR "wooOrderId" = $1 OR "trackingId" = $1 OR "meliFlexCode" = $1', 
            [id]
        );
        
        if (pkgRows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        
        const currentPkg = pkgRows[0];
        const realId = currentPkg.id;
        
        let flexCodeToSave = currentPkg.meliFlexCode;
        if (id !== realId && !currentPkg.meliFlexCode) {
            flexCodeToSave = id;
            await db.query('UPDATE packages SET "meliFlexCode" = $1 WHERE id = $2', [flexCodeToSave, realId]);
        }
        
        res.json({ message: `Paquete ${realId} escaneado correctamente.`, package: { ...currentPkg, meliFlexCode: flexCodeToSave } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al escanear paquete por admin.' });
    }
});

// POST /api/packages/mark-billed
router.post('/mark-billed', authMiddleware, async (req, res) => {
    const { packageIds } = req.body;
    if (!packageIds || !Array.isArray(packageIds)) {
        return res.status(400).json({ message: 'Se requiere un array de IDs de paquetes.' });
    }
    try {
        const placeholders = packageIds.map((_, i) => `$${i + 1}`).join(', ');
        if (packageIds.length > 0) {
            await db.query(`UPDATE packages SET billed = true WHERE id IN (${placeholders})`, packageIds);
        }
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al marcar los paquetes como facturados.' });
    }
});

// GET /api/packages/public/track/:id
router.get('/public/track/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check if public tracking is enabled
        const { rows: settings } = await db.query('SELECT "publicTrackingEnabled" FROM system_settings WHERE id = 1');
        const isEnabled = settings.length > 0 ? settings[0].publicTrackingEnabled : true;

        if (!isEnabled) {
            return res.status(403).json({ message: 'El seguimiento público está desactivado por el administrador.' });
        }

        const { rows } = await db.query(
            `SELECT p.id, p.status, p."recipientName", p."recipientAddress", p."recipientCommune", p."recipientCity", 
                    p."estimatedDelivery", p."updatedAt", p."meliOrderId", p."trackingId", p."destLatitude", p."destLongitude",
                    u.latitude AS "driverLatitude", u.longitude AS "driverLongitude", u."lastLocationUpdate" AS "driverLastUpdate"
             FROM packages p
             LEFT JOIN users u ON p."driverId" = u.id
             WHERE p.id = $1 OR p."meliOrderId" = $1 OR p."shopifyOrderId" = $1 OR p."wooOrderId" = $1 OR p."trackingId" = $1 OR p."meliFlexCode" = $1`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        
        const pkg = rows[0];

        // Only share driver location if package is in transit or assigned
        const sharableStatuses = ['EN_TRANSITO', 'ASIGNADO'];
        if (!sharableStatuses.includes(pkg.status)) {
            delete pkg.driverLatitude;
            delete pkg.driverLongitude;
            delete pkg.driverLastUpdate;
        }

        pkg.history = await getHistory(pkg.id);
        res.json(pkg);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al consultar el seguimiento.' });
    }
});

// POST /api/packages/sys/bulk-mark-processed - Super Admin only reset
router.post('/sys/bulk-mark-processed', authMiddleware, async (req, res) => {
    // Only 'admin' account can perform this global reset
    if (req.user.email !== 'admin' && req.user.email !== 'admin@selcom.cl') {
        return res.status(403).json({ message: 'Solo el Super Administrador puede fijar un punto de inicio.' });
    }

    try {
        const query = `
            UPDATE packages 
            SET status = 'ENTREGADO', 
                billed = true, 
                "driverId" = NULL,
                "updatedAt" = NOW() 
            WHERE (status != 'ENTREGADO' AND status != 'CANCELADO' AND status != 'DEVUELTO') OR billed = false
        `;
        const result = await db.query(query);
        
        // Log action if logAction helper is available, otherwise console
        try {
            await db.query('INSERT INTO audit_logs (userId, userName, action, details) VALUES ($1, $2, $3, $4)', 
                [req.user.id, req.user.name, 'SYS_BULK_RESET', JSON.stringify({ count: result.rowCount })]);
        } catch (e) { console.warn('Audit log failed', e); }
        
        res.json({ 
            message: 'Punto de inicio establecido correctamente.', 
            updatedCount: result.rowCount 
        });
    } catch (err) {
        console.error('Error in /api/packages/sys/bulk-mark-processed:', err);
        res.status(500).json({ message: 'Error al establecer el punto de inicio.' });
    }
});

// POST /api/packages/sys/force-close-old - Admin only
router.post('/sys/force-close-old', authMiddleware, async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Solo el Administrador puede forzar el cierre de envíos.' });
    }

    const days = parseInt(req.body.days) || 30;

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const result = await db.query(`
            UPDATE packages
            SET status = 'CANCELADO',
                billed = true,
                "updatedAt" = NOW()
            WHERE status NOT IN ('ENTREGADO', 'DEVUELTO', 'CANCELADO')
            AND "updatedAt" < $1
        `, [cutoffDate.toISOString()]);

        try {
            await db.query('INSERT INTO audit_logs ("userId", "userName", action, details) VALUES ($1, $2, $3, $4)',
                [req.user.id, req.user.name, 'FORCE_CLOSE_OLD', JSON.stringify({ days, count: result.rowCount, cutoffDate })]);
        } catch (e) { console.warn('Audit log failed', e); }

        res.json({
            message: `Cierre forzoso completado. ${result.rowCount} envíos cerrados.`,
            updatedCount: result.rowCount
        });
    } catch (err) {
        console.error('Error in /api/packages/sys/force-close-old:', err);
        res.status(500).json({ message: 'Error al forzar el cierre de envíos.' });
    }
});

// POST /api/packages/bulk-update-status
router.post('/bulk-update-status', authMiddleware, async (req, res) => {
    const { packageIds, status } = req.body;
    if (!packageIds || !Array.isArray(packageIds) || !status) {
        return res.status(400).json({ message: 'Se requiere un array de IDs y el nuevo estado.' });
    }

    try {
        const billed = status === 'ENTREGADO' || status === 'CANCELADO' || status === 'DEVUELTO';
        const placeholders = packageIds.map((_, i) => `$${i + 2}`).join(', ');
        
        await db.query(`
            UPDATE packages 
            SET status = $1, 
                billed = $2, 
                "updatedAt" = NOW() 
            WHERE id IN (${placeholders})
        `, [status, billed, ...packageIds]);

        // Add tracking events
        for (const pkgId of packageIds) {
            await db.query('INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, NOW())', 
                [pkgId, status, 'Operaciones', `Estado actualizado masivamente por el administrador a ${status}.`, new Date()]);
        }

        res.json({ message: `Se actualizaron ${packageIds.length} paquetes a ${status}.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al actualizar paquetes masivamente.' });
    }
});

module.exports = router;
