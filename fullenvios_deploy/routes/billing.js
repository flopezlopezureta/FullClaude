const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/billing/summary
 * Returns a summary of packages grouped by client and status for a given date range.
 * Restricted to Super Admin.
 */
router.get('/summary', authMiddleware, async (req, res) => {
    // Check if user is Super Admin
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores.' });
    }

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Se requieren fechas de inicio y fin.' });
    }

    try {
        // We use a query that joins packages with users to get client names
        // We filter by createdAt range and group by client and status
        const query = `
            SELECT 
                u.id as "clientId", 
                u.name as "clientName", 
                u."companyName",
                p.status, 
                COUNT(*) as count
            FROM packages p
            JOIN users u ON p."creatorId" = u.id
            WHERE p."createdAt" >= $1 AND p."createdAt" <= $2
            GROUP BY u.id, u.name, u."companyName", p.status
            ORDER BY u.name ASC;
        `;

        const result = await db.query(query, [startDate + ' 00:00:00', endDate + ' 23:59:59']);
        
        // Transform the flat result into a more usable structure for the frontend
        // Structure: { [clientId]: { clientName, companyName, statuses: { [status]: count }, total } }
        const summary = {};
        
        result.rows.forEach(row => {
            if (!summary[row.clientId]) {
                summary[row.clientId] = {
                    clientId: row.clientId,
                    clientName: row.clientName,
                    companyName: row.companyName,
                    statuses: {},
                    total: 0
                };
            }
            
            summary[row.clientId].statuses[row.status] = parseInt(row.count);
            summary[row.clientId].total += parseInt(row.count);
        });

        res.json(Object.values(summary));
    } catch (err) {
        console.error('Error fetching billing summary:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

const https = require('https');

function getUfValueFromApi(dateStr) {
    return new Promise((resolve, reject) => {
        const url = `https://mindicador.cl/api/uf/${dateStr}`;
        https.get(url, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.serie && parsed.serie.length > 0) {
                        resolve(parsed.serie[0].valor);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', (e) => {
            resolve(null);
        });
    });
}

/**
 * GET /api/billing/superadmin-monthly-report
 * Exclusively for ADMIN_SISTEMAS. Returns daily detail of dispatches, costs in UF, and conversions to CLP using the UF value of the 1st day of the next month.
 */
router.get('/superadmin-monthly-report', authMiddleware, async (req, res) => {
    if (req.user.role !== 'ADMIN_SISTEMAS') {
        return res.status(403).json({ message: 'Acceso denegado. Exclusivo para el Superadministrador.' });
    }

    const { clientId, year, month, ufValue } = req.query;

    if (!clientId || !year || !month) {
        return res.status(400).json({ message: 'Se requieren clientId, year y month.' });
    }

    try {
        // Calculate date ranges
        const startMonthStr = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
        let nextMonth = parseInt(month) + 1;
        let nextYear = parseInt(year);
        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
        }
        const endMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01 00:00:00`;

        // Get UF value
        const ufDateStr = `01-${String(nextMonth).padStart(2, '0')}-${nextYear}`;
        let finalUfValue = ufValue ? parseFloat(ufValue) : null;
        let ufSource = 'Manual';

        if (!finalUfValue) {
            finalUfValue = await getUfValueFromApi(ufDateStr);
            ufSource = 'API (mindicador.cl)';
        }

        // Fetch daily count of packages for client in range
        const query = `
            SELECT 
                DATE(p."createdAt" AT TIME ZONE 'America/Santiago') as date,
                COUNT(*) as count
            FROM packages p
            WHERE p."creatorId" = $1 
              AND p."createdAt" >= ($2::timestamp AT TIME ZONE 'America/Santiago')
              AND p."createdAt" < ($3::timestamp AT TIME ZONE 'America/Santiago')
            GROUP BY DATE(p."createdAt" AT TIME ZONE 'America/Santiago')
            ORDER BY date ASC;
        `;
        const { rows } = await db.query(query, [clientId, startMonthStr, endMonthStr]);

        // Fetch client details
        const { rows: clientRows } = await db.query('SELECT name, "companyName", email FROM users WHERE id = $1', [clientId]);
        const clientName = clientRows.length > 0 ? clientRows[0].name : 'Cliente desconocido';
        const companyName = clientRows.length > 0 ? clientRows[0].companyName : '';

        // Calculate values
        const ratePerPackageUf = 0.00099667;
        let totalPackages = 0;
        const dailyDetails = [];

        rows.forEach(row => {
            const count = parseInt(row.count, 10);
            totalPackages += count;

            const costUf = count * ratePerPackageUf;
            const costClp = finalUfValue ? costUf * finalUfValue : null;

            dailyDetails.push({
                date: row.date.toISOString().split('T')[0],
                packagesCount: count,
                costUf: parseFloat(costUf.toFixed(8)),
                costClp: costClp ? Math.round(costClp) : null
            });
        });

        const totalCostUf = totalPackages * ratePerPackageUf;
        const totalCostClp = finalUfValue ? totalCostUf * finalUfValue : null;

        res.json({
            client: {
                id: clientId,
                name: clientName,
                companyName: companyName
            },
            period: {
                year: parseInt(year),
                month: parseInt(month)
            },
            uf: {
                date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
                value: finalUfValue,
                source: ufSource
            },
            summary: {
                totalPackages,
                ratePerPackageUf,
                totalCostUf: parseFloat(totalCostUf.toFixed(8)),
                totalCostClpNet: totalCostClp ? Math.round(totalCostClp) : null,
                ivaRate: 0.19,
                totalCostClpIva: totalCostClp ? Math.round(totalCostClp * 0.19) : null,
                totalCostClpGross: totalCostClp ? Math.round(totalCostClp * 1.19) : null
            },
            dailyDetails
        });

    } catch (err) {
        console.error('Error generating superadmin billing report:', err);
        res.status(500).json({ message: 'Error interno al generar el reporte.' });
    }
});

module.exports = router;
