

const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const https = require('https');

// Helper to get tracking history for a package
async function getHistory(packageId) {
    const { rows: history } = await db.query(
        'SELECT * FROM tracking_events WHERE "packageId" = $1 ORDER BY timestamp DESC',
        [packageId]
    );
    return history;
}

// Helper function to geocode address
async function geocodeAddress(address, commune, city) {
    if (!address || !commune) return { lat: null, lng: null };
    
    try {
        // Construct a search query. Prioritize street + commune + country
        const query = `${address}, ${commune}, Chile`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'FullEnviosApp/1.0' // Nominatim requires a User-Agent
            }
        });

        if (!response.ok) return { lat: null, lng: null };
        
        const data = await response.json();
        if (data && data.length > 0) {
            return { 
                lat: parseFloat(data[0].lat), 
                lng: parseFloat(data[0].lon) 
            };
        }
    } catch (error) {
        console.error("Geocoding error:", error.message);
    }
    return { lat: null, lng: null };
}

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
            whereClauses.push(`("recipientName" ILIKE $${paramIndex} OR id ILIKE $${paramIndex} OR "meliOrderId" ILIKE $${paramIndex} OR "shopifyOrderId" ILIKE $${paramIndex} OR "wooOrderId" ILIKE $${paramIndex})`);
            queryParams.push(`%${searchQuery}%`);
            paramIndex++;
        }

        if (statusFilter) {
            whereClauses.push(`status = $${paramIndex++}`);
            queryParams.push(statusFilter);
        }

        if (driverFilter) {
            whereClauses.push(`"driverId" = $${paramIndex++}`);
            queryParams.push(driverFilter);
        }
        
        if (clientFilter) { // Admin filtering by client from the filter bar
            whereClauses.push(`"creatorId" = $${paramIndex++}`);
            queryParams.push(clientFilter);
        }

        if (communeFilter) {
            whereClauses.push(`"recipientCommune" = $${paramIndex++}`);
            queryParams.push(communeFilter);
        }

        if (cityFilter) {
            whereClauses.push(`"recipientCity" = $${paramIndex++}`);
            queryParams.push(cityFilter);
        }
        
        if (startDate) {
            whereClauses.push(`"createdAt" >= $${paramIndex++}`);
            queryParams.push(startDate);
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1); // Make it inclusive of the end day
            whereClauses.push(`"createdAt" < $${paramIndex++}`);
            queryParams.push(end.toISOString().split('T')[0]);
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Query for total count
        const countQuery = `SELECT COUNT(*) FROM packages ${whereString}`;
        const { rows: countRows } = await db.query(countQuery, queryParams);
        const total = parseInt(countRows[0].count, 10);
        
        // Query for paginated data
        const limitClause = limit > 0 ? `LIMIT $${paramIndex++} OFFSET $${paramIndex++}` : '';
        const packageQuery = `SELECT * FROM packages ${whereString} ORDER BY "createdAt" DESC ${limitClause}`;
        
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

// POST /api/packages
router.post('/', authMiddleware, async (req, res) => {
    const { creatorId, recipientName, recipientPhone, recipientAddress, recipientCommune, recipientCity, notes, estimatedDelivery, shippingType, origin, source, meliOrderId, shopifyOrderId, wooOrderId } = req.body;
    
    try {
        const { rows: creatorRows } = await db.query('SELECT "clientIdentifier" FROM users WHERE id = $1', [creatorId]);
        if (creatorRows.length === 0) {
            return res.status(404).json({ message: 'Cliente creador no encontrado.' });
        }

        // Geocode the address
        const coords = await geocodeAddress(recipientAddress, recipientCommune, recipientCity);

        const now = new Date();
        const newPackage = {
            id: `${creatorRows[0].clientIdentifier}-${uuidv4().split('-')[0]}`,
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
            estimatedDelivery,
            createdAt: now,
            updatedAt: now,
            creatorId,
            source,
            meliOrderId,
            shopifyOrderId,
            wooOrderId,
            destLatitude: coords.lat,
            destLongitude: coords.lng
        };

        const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
        const values = Object.values(newPackage);
        const placeholders = values.map((_, i) => `$${i+1}`).join(', ');

        await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, values);
        await addTrackingEvent(newPackage.id, 'Creado', origin, 'Paquete creado.');
        
        newPackage.history = await getHistory(newPackage.id);
        res.status(201).json(newPackage);
    } catch (err) {
        console.error('Error in POST /api/packages:', err);
        res.status(500).json({ message: 'Error del servidor al crear el paquete.' });
    }
});

// POST /api/packages/batch
router.post('/batch', authMiddleware, async (req, res) => {
    const { packages } = req.body;
    if (!packages || !Array.isArray(packages)) {
        return res.status(400).json({ message: "Se esperaba un array de paquetes." });
    }

    try {
        const results = [];

        for (const pkgData of packages) {
            const { creatorId, recipientName, recipientPhone, recipientAddress, recipientCommune, recipientCity, notes, estimatedDelivery, shippingType, origin, source, meliOrderId, shopifyOrderId, wooOrderId } = pkgData;
            
            const { rows: creatorRows } = await db.query('SELECT "clientIdentifier" FROM users WHERE id = $1', [creatorId]);
            if (creatorRows.length === 0) throw new Error(`Cliente creador no encontrado para uno de los paquetes.`);
            
            // Geocode
            const coords = await geocodeAddress(recipientAddress, recipientCommune, recipientCity);

            const now = new Date();
            const newPackage = {
                id: `${creatorRows[0].clientIdentifier}-${uuidv4().split('-')[0]}`,
                recipientName, recipientPhone, status: 'PENDIENTE', shippingType, origin, destination: recipientAddress, recipientAddress, recipientCommune, recipientCity, notes, estimatedDelivery, createdAt: now, updatedAt: now, creatorId, source, meliOrderId, shopifyOrderId, wooOrderId,
                destLatitude: coords.lat,
                destLongitude: coords.lng
            };
            
            const columns = Object.keys(newPackage).map(k => `"${k}"`).join(', ');
            const values = Object.values(newPackage);
            const placeholders = values.map((_, i) => `$${i+1}`).join(', ');

            await db.query(`INSERT INTO packages (${columns}) VALUES (${placeholders})`, values);
            await addTrackingEvent(newPackage.id, 'Creado', origin, 'Paquete creado.');
            
            newPackage.history = await getHistory(newPackage.id);
            results.push(newPackage);
            
            // Small delay to respect Nominatim rate limits if batching many
            if (packages.length > 1) await new Promise(r => setTimeout(r, 1000));
        }
        
        res.status(201).json(results);

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
        
        const placeholders = packageIds.map((_, i) => `$${i + 4}`).join(', ');

        // Force status to PENDIENTE to allow re-scanning/picking up by new driver
        const updateQuery = `
            UPDATE packages 
            SET "driverId" = $1, "estimatedDelivery" = $2, "updatedAt" = $3, status = 'PENDIENTE' 
            WHERE id IN (${placeholders})
        `;
        
        await client.query(updateQuery, [driverId, newDeliveryDate, new Date(), ...packageIds]);

        // Create tracking events for all updated packages
        const eventPromises = packageIds.map(packageId => {
            const details = `Asignado a conductor ${driverName}. Estado reiniciado a Pendiente.`;
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

        // If address fields are present (even if identical, to force re-geocoding), we try to geocode.
        if (updateData.recipientAddress || updateData.recipientCommune) {
             // Fetch current data if some fields are missing in updateData
             const { rows: currentPkg } = await db.query('SELECT "recipientAddress", "recipientCommune", "recipientCity" FROM packages WHERE id = $1', [id]);
             
             if (currentPkg.length > 0) {
                 const addr = updateData.recipientAddress !== undefined ? updateData.recipientAddress : currentPkg[0].recipientAddress;
                 const comm = updateData.recipientCommune !== undefined ? updateData.recipientCommune : currentPkg[0].recipientCommune;
                 const city = updateData.recipientCity !== undefined ? updateData.recipientCity : currentPkg[0].recipientCity;
                 
                 const coords = await geocodeAddress(addr, comm, city);
                 if (coords.lat && coords.lng) {
                     updateData.destLatitude = coords.lat;
                     updateData.destLongitude = coords.lng;
                 }
             }
        }

        const fields = Object.keys(updateData);
        const values = Object.values(updateData);
        const setClause = fields.map((field, i) => `"${field}" = $${i + 1}`).join(', ');
        
        const result = await db.query(`UPDATE packages SET ${setClause} WHERE id = $${fields.length + 1}`, [...values, id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        
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
        // Force status to PENDIENTE
        const { rows } = await db.query(
            'UPDATE packages SET "driverId" = $1, "estimatedDelivery" = $2, "updatedAt" = $3, status = \'PENDIENTE\' WHERE id = $4 RETURNING *',
            [driverId, newDeliveryDate, new Date(), id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        
        const driverName = driverId ? (await db.query('SELECT name FROM users WHERE id = $1', [driverId])).rows[0]?.name : 'Nadie';
        await addTrackingEvent(id, 'Asignado', 'Centro de Distribución', `Asignado a conductor ${driverName}. Estado reiniciado a Pendiente.`);
        
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
    const { driverId } = req.body;
    try {
        // Broad search for package by Internal ID OR External tracking numbers
        const { rows: pkgRows } = await db.query(
            'SELECT id, status, "driverId" FROM packages WHERE id = $1 OR "meliOrderId" = $1 OR "shopifyOrderId" = $1 OR "wooOrderId" = $1', 
            [id]
        );
        
        if (pkgRows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        const currentPkg = pkgRows[0];
        const realId = currentPkg.id; // Use the internal ID for updates
        
        if (['ENTREGADO', 'DEVUELTO'].includes(currentPkg.status)) {
            return res.status(400).json({ message: `Paquete ya se encuentra ${currentPkg.status}.` });
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

        const { rows } = await db.query(
            'UPDATE packages SET "driverId" = $1, status = $2, "updatedAt" = $3 WHERE id = $4 RETURNING *',
            [driverId, 'EN_TRANSITO', new Date(), realId]
        );

        await addTrackingEvent(realId, 'EN_TRANSITO', 'Centro de Distribución', details);
        
        res.json({ message: `Paquete ${realId} asignado a ${driverName} y en tránsito.` });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al despachar paquete.' });
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

        // --- NEW MELI VALIDATION (CONDITIONAL) ---
        if (meliFlexValidation) {
            const { rows: pkgRows } = await db.query('SELECT "meliOrderId", "creatorId" FROM packages WHERE id = $1', [id]);
            if (pkgRows.length > 0 && pkgRows[0].meliOrderId) {
                const { meliOrderId, creatorId } = pkgRows[0];

                const { rows: userRows } = await db.query('SELECT integrations FROM users WHERE id = $1', [creatorId]);
                let meliIntegration = userRows[0]?.integrations?.meli;
                
                if (meliIntegration) {
                    if (Date.now() >= meliIntegration.expiresAt) {
                        const { rows: integrationSettingsRows } = await db.query('SELECT meli_app_id, meli_client_secret FROM integration_settings WHERE id = 1');
                        if (integrationSettingsRows[0]?.meli_app_id) {
                            const { meli_app_id, meli_client_secret } = integrationSettingsRows[0];
                            const refreshData = new URLSearchParams({ grant_type: 'refresh_token', client_id: meli_app_id.trim(), client_secret: meli_client_secret.trim(), refresh_token: meliIntegration.refreshToken }).toString();
                            const refreshedTokenData = await makeMeliPostRequest('/oauth/token', refreshData);
                            meliIntegration = { ...meliIntegration, accessToken: refreshedTokenData.access_token, refreshToken: refreshedTokenData.refresh_token, expiresAt: Date.now() + (refreshedTokenData.expires_in * 1000) };
                            await db.query('UPDATE users SET integrations = $1 WHERE id = $2', [JSON.stringify({ ...userRows[0].integrations, meli: meliIntegration }), creatorId]);
                        }
                    }
                    
                    try {
                        const shippingDetails = await makeMeliGetRequest(`/shipments/${meliOrderId}`, meliIntegration.accessToken);
                        if (shippingDetails.status !== 'delivered') {
                            return res.status(400).json({ message: 'Aún no has finalizado la entrega en la app de Mercado Libre Flex. Por favor, complétala allí primero y luego confirma aquí.' });
                        }
                    } catch(meliError) {
                         console.warn(`Could not verify Meli status for shipment ${meliOrderId}. Allowing delivery.`, meliError.body || meliError.message);
                    }
                }
            }
        }
        // --- END MELI VALIDATION ---

        const { rows } = await db.query(
            'UPDATE packages SET status = $1, "deliveryReceiverName" = $2, "deliveryReceiverId" = $3, "deliveryPhotosBase64" = $4, "updatedAt" = $5 WHERE id = $6 RETURNING *',
            ['ENTREGADO', receiverName, receiverId, JSON.stringify(photosBase64), new Date(), id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });

        await addTrackingEvent(id, 'ENTREGADO', rows[0].recipientAddress, `Entregado a ${receiverName}.`);
        
        const updatedPackage = rows[0];
        updatedPackage.history = await getHistory(id);
        res.json(updatedPackage);

    } catch(err) {
        console.error(err);
        res.status(500).json({ message: 'Error al confirmar la entrega.' });
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
        res.json(updatedPackage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al reportar el problema.' });
    }
});

// POST /api/packages/:id/pickup
router.post('/:id/pickup', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const driverId = req.user.id;
    try {
         const { rows } = await db.query(
            'UPDATE packages SET status = $1, "driverId" = $2, "updatedAt" = $3 WHERE id = $4 RETURNING *',
            ['RETIRADO', driverId, new Date(), id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Paquete no encontrado.' });
        
        const driverName = (await db.query('SELECT name FROM users WHERE id = $1', [driverId])).rows[0]?.name;
        await addTrackingEvent(id, 'RETIRADO', rows[0].origin, `Retirado por conductor ${driverName}.`);
        
        const updatedPackage = rows[0];
        updatedPackage.history = await getHistory(id);
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
        res.json(updatedPackage);

    } catch(err) {
        console.error(err);
        res.status(500).json({ message: 'Error al confirmar la devolución.' });
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

module.exports = router;