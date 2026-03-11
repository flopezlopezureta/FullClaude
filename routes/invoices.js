const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const adminOrBillingOnly = (req, res, next) => {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'FACTURACION') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    next();
};

// POST /api/invoices
router.post('/', authMiddleware, adminOrBillingOnly, async (req, res) => {
    const { clientId, packageIds, amount, pickupCount, pickupCostTotal } = req.body;
    try {
        const { rows: clientRows } = await db.query('SELECT invoices FROM users WHERE id = $1', [clientId]);
        if (clientRows.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }

        const newInvoice = {
            id: `inv-${uuidv4().split('-')[0]}`,
            date: new Date(),
            amount,
            packageIds,
            pickupCount,
            pickupCostTotal,
        };

        const existingInvoices = clientRows[0].invoices || [];
        const updatedInvoices = [newInvoice, ...existingInvoices];

        await db.query(
            'UPDATE users SET invoices = $1 WHERE id = $2',
            [JSON.stringify(updatedInvoices), clientId]
        );

        res.status(201).json(newInvoice);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al crear la factura.' });
    }
});

module.exports = router;