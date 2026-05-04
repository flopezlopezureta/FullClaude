const db = require('../db');

async function verifyLogic() {
    try {
        console.log('--- DIAGNÓSTICO DE MONITOR BI ---');
        
        // 1. Verificar Zona Horaria Configurada
        const { rows: settings } = await db.query('SELECT timezone FROM system_settings WHERE id = 1');
        const systemTZ = settings[0]?.timezone || 'No configurada';
        console.log(`ZONA HORARIA EN CONFIGURACIÓN: ${systemTZ}`);

        // 2. Fecha de hoy según esa zona
        const targetDate = new Date().toLocaleDateString('en-CA', { timeZone: systemTZ });
        console.log(`FECHA "HOY" PARA EL SISTEMA: ${targetDate}`);

        // 3. Buscar actividad del Conductor Pruebas hoy con esa zona
        const query = `
            SELECT 
                u.name,
                COUNT(p.id) as paquetes_detectados,
                MAX(p."updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE $2) as ultima_actividad_local
            FROM users u
            LEFT JOIN packages p ON u.id = p."driverId"
            WHERE (p."updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE $2)::date = $1::date
            AND u.name ILIKE '%Pruebas%'
            GROUP BY u.name
        `;
        
        const { rows: activity } = await db.query(query, [targetDate, systemTZ]);
        
        if (activity.length > 0) {
            console.log('✅ RESULTADO: SE ENCONTRÓ ACTIVIDAD');
            console.table(activity);
        } else {
            console.log('❌ RESULTADO: NO SE ENCONTRÓ ACTIVIDAD CON ESTA LÓGICA');
            
            // Ver qué hay en la DB sin filtro para comparar
            const { rows: raw } = await db.query('SELECT name, "updatedAt" FROM packages p JOIN users u ON p."driverId" = u.id WHERE u.name ILIKE \'%Pruebas%\' LIMIT 1');
            console.log('Dato crudo en DB para comparar:', raw[0]);
        }
        
    } catch (err) {
        console.error('Error en diagnóstico:', err);
    } finally {
        process.exit();
    }
}

verifyLogic();
