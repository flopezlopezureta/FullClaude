const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/entregas
 * Entrega la lista de entregas pendientes para el conductor autenticado.
 * Estructura ultra ligera para App Android Nativa.
 */
router.get('/entregas', authMiddleware, async (req, res) => {
    try {
        // Solo conductores pueden ver sus entregas
        if (req.user.role !== 'DRIVER' && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Acceso denegado.' });
        }

        const driverId = req.user.id;
        
        // Buscamos paquetes asignados al conductor con estado PENDIENTE o EN_TRANSITO
        const { rows: entregas } = await db.query(
            `SELECT 
                id, 
                "recipientName" as cliente, 
                "recipientAddress" || ', ' || "recipientCommune" as direccion, 
                "recipientPhone" as telefono, 
                status as estado, 
                "destLatitude" as latitud, 
                "destLongitude" as longitud 
             FROM packages 
             WHERE "driverId" = $1 AND status IN ('PENDIENTE', 'EN_TRANSITO', 'PROBLEMA')
             ORDER BY "createdAt" ASC`,
            [driverId]
        );

        res.json(entregas);
    } catch (err) {
        console.error('Error en GET /api/entregas:', err);
        res.status(500).json({ message: 'Error al obtener las entregas.' });
    }
});

/**
 * POST /api/cerrar-entrega
 * Cierra una entrega recibiendo el ID y una imagen en base64 como evidencia.
 */
router.post('/cerrar-entrega', authMiddleware, async (req, res) => {
    const { id, imagen } = req.body;

    if (!id || !imagen) {
        return res.status(400).json({ message: 'ID de entrega e imagen son requeridos.' });
    }

    try {
        // Verificar que el paquete existe y está asignado al conductor (o es admin)
        const { rows: pkgRows } = await db.query('SELECT "driverId", status FROM packages WHERE id = $1', [id]);
        
        if (pkgRows.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada.' });
        }

        if (req.user.role !== 'ADMIN' && pkgRows[0].driverId !== req.user.id) {
            return res.status(403).json({ message: 'No tienes permiso para cerrar esta entrega.' });
        }

        // Actualizar el estado del paquete
        const now = new Date();
        await db.query(
            `UPDATE packages 
             SET status = 'ENTREGADO', 
                 "deliveryPhotosBase64" = $1, 
                 "updatedAt" = $2 
             WHERE id = $3`,
            [JSON.stringify([imagen]), now, id]
        );

        // Registrar evento de seguimiento
        await db.query(
            'INSERT INTO tracking_events ("packageId", status, location, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
            [id, 'ENTREGADO', 'Destino Final', 'Entrega cerrada desde App Móvil.', now]
        );

        res.json({ message: 'Entrega cerrada con éxito.', id });
    } catch (err) {
        console.error('Error en POST /api/cerrar-entrega:', err);
        res.status(500).json({ message: 'Error al cerrar la entrega.' });
    }
});

module.exports = router;
