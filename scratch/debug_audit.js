require('dotenv').config();
const db = require('../db');

async function debugAudit() {
    try {
        const query = `
            SELECT 
                status, 
                count(*) as total_count,
                count(*) FILTER (WHERE status = 'ENTREGADO') as delivered,
                count(*) FILTER (WHERE status IN ('PROBLEMA', 'REPROGRAMADO', 'DEVUELTO')) as failed
            FROM packages 
            WHERE ("createdAt" >= '2026-05-01' AND "createdAt" <= '2026-05-03 23:59:59') 
               OR ("updatedAt" >= '2026-05-01' AND "updatedAt" <= '2026-05-03 23:59:59') 
            GROUP BY status;
        `;
        const result = await db.query(query);
        console.log('--- DIAGNÓSTICO DE ESTADOS ---');
        console.table(result.rows);
        
        const summaryQuery = `
            SELECT 
                COUNT(*) as total_procesados,
                COUNT(*) FILTER (WHERE status = 'ENTREGADO') as total_exitosos,
                COUNT(*) FILTER (WHERE status IN ('PROBLEMA', 'REPROGRAMADO', 'DEVUELTO')) as total_fallidos,
                COUNT(*) FILTER (WHERE status IN ('ASIGNADO', 'RETIRADO', 'EN_TRANSITO')) as total_en_ruta,
                COUNT(*) FILTER (WHERE status = 'PENDIENTE') as total_pendientes
            FROM packages
            WHERE ("createdAt" >= '2026-05-01' AND "createdAt" <= '2026-05-03 23:59:59') 
               OR ("updatedAt" >= '2026-05-01' AND "updatedAt" <= '2026-05-03 23:59:59');
        `;
        const summary = await db.query(summaryQuery);
        console.log('--- RESUMEN GLOBAL ---');
        console.table(summary.rows);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

debugAudit();
