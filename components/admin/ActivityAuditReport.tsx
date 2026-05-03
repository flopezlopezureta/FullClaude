import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
    IconFileText, 
    IconRefresh, 
    IconFileSpreadsheet, 
    IconPackage, 
    IconCheckCircle, 
    IconAlertTriangle, 
    IconTruck, 
    IconTrendingUp,
    IconCalendar,
    IconClock
} from '../Icon';
import { getLocalDateString } from '../../utils/dateUtils';

interface AuditReportRow {
    clientId: string;
    clientName: string;
    companyName?: string;
    totalProcessed: number;
    successTotal: number;
    successFirstAttempt: number;
    successSecondAttempt: number;
    successMultipleAttempts: number;
    failedCurrently: number;
    returnedTotal: number;
    inTransit: number;
    pending: number;
    dispatched: number;
    total: number;
}

const ActivityAuditReport: React.FC = () => {
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(1); // First day of current month
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(getLocalDateString());
    const [data, setData] = useState<AuditReportRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/reports/activity-audit?startDate=${startDate}&endDate=${endDate}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const result = await response.json();
            if (response.ok) {
                setData(result);
            } else {
                console.error('Error fetching report:', result.message);
            }
        } catch (error) {
            console.error('Error fetching activity audit report:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleExportCSV = () => {
        if (data.length === 0 || isExporting) return;
        setIsExporting(true);
        
        try {
            const escapeCSV = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
            let csv = '\uFEFF'; // BOM
            const headers = [
                'Cliente', 'Empresa', 'Total Procesados', 'Entregas Exitosas', 
                '1er Intento', '2do Intento', '3+ Intentos', 
                'Problemas Actuales', 'Devueltos', 'En Ruta'
            ];
            csv += headers.map(escapeCSV).join(',') + '\n';
            
            data.forEach(row => {
                const values = [
                    row.clientName,
                    row.companyName,
                    row.dispatched,
                    row.successTotal,
                    row.successFirstAttempt,
                    row.successSecondAttempt,
                    row.successMultipleAttempts,
                    row.failedCurrently,
                    row.returnedTotal,
                    row.inTransit
                ];
                csv += values.map(val => escapeCSV(val)).join(',') + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Auditoria_Operativa_${startDate}_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setIsExporting(false);
        }
    };

    const globalTotals = data.reduce((acc, row) => ({
        totalIngresados: acc.totalIngresados + Number(row.total),
        dispatched: acc.dispatched + Number(row.dispatched),
        success: acc.success + Number(row.successTotal),
        first: acc.first + Number(row.successFirstAttempt),
        failed: acc.failed + (Number(row.failedCurrently) + Number(row.returnedTotal)),
        transit: acc.transit + Number(row.inTransit),
        pending: acc.pending + Number(row.pending)
    }), { totalIngresados: 0, dispatched: 0, success: 0, first: 0, failed: 0, transit: 0, pending: 0 });

    const firstAttemptRate = globalTotals.success > 0 
        ? Math.round((globalTotals.first / globalTotals.success) * 100) 
        : 0;

    return (
        <div className="space-y-6">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center shadow-inner">
                        <IconPackage className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Ingresados</p>
                        <p className="text-2xl font-black text-slate-800">{globalTotals.totalIngresados}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-indigo-500">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                        <IconTruck className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Despachados</p>
                        <p className="text-2xl font-black text-slate-800">{globalTotals.dispatched}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-amber-500">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shadow-inner">
                        <IconClock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pendientes</p>
                        <p className="text-2xl font-black text-slate-800">{globalTotals.pending}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-emerald-500">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
                        <IconCheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Exitosos</p>
                        <p className="text-2xl font-black text-emerald-700">{globalTotals.success}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-orange-500">
                    <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shadow-inner">
                        <IconTrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">% 1er Intento</p>
                        <p className="text-2xl font-black text-orange-700">{firstAttemptRate}%</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-rose-500">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shadow-inner">
                        <IconAlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fallidos</p>
                        <p className="text-2xl font-black text-rose-700">{globalTotals.failed}</p>
                    </div>
                </div>
            </div>

            {/* Informational Note for Open Packages */}
            {(globalTotals.transit > 0) && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                        <IconAlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-amber-800">Atención: Paquetes sin gestionar</p>
                        <p className="text-xs font-bold text-amber-600">
                            Existen <span className="text-sm underline">{globalTotals.transit}</span> paquetes que salieron a terreno en este periodo pero aún no han sido completados (permanecen En Ruta o sin estado de cierre).
                        </p>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-end gap-6">
                <div className="flex-1 min-w-[240px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <IconCalendar className="w-3 h-3" /> Fecha Inicio
                    </label>
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                </div>
                <div className="flex-1 min-w-[240px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <IconCalendar className="w-3 h-3" /> Fecha Fin
                    </label>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={fetchData}
                        disabled={isLoading}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        <IconRefresh className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Cargando...' : 'Consultar'}
                    </button>
                    <button 
                        onClick={handleExportCSV}
                        disabled={data.length === 0 || isExporting}
                        className="px-6 py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        <IconFileSpreadsheet className="w-4 h-4" />
                        Excel
                    </button>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-3">
                        <IconFileText className="w-5 h-5 text-indigo-500" />
                        Desglose Detallado por Cliente
                    </h2>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-tighter">
                        {data.length} Clientes con actividad
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Cliente</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Despachados</th>
                                <th className="px-6 py-4 text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b border-slate-100 text-center">Total Entregados</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">1er Intento</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">2do Intento</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">3+ Intentos</th>
                                <th className="px-6 py-4 text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-slate-100 text-center">Fallas/Dev</th>
                                <th className="px-6 py-4 text-[10px] font-black text-amber-500 uppercase tracking-widest border-b border-slate-100 text-center">En Ruta</th>
                                <th className="px-6 py-4 text-[10px] font-black text-indigo-500 uppercase tracking-widest border-b border-slate-100 text-center">Pendientes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data.length === 0 && !isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <IconFileText className="w-12 h-12" />
                                            <p className="font-bold">No hay registros para este periodo</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : data.map((row) => (
                                <tr key={row.clientId} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-800 leading-tight">{row.clientName}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{row.companyName || 'Persona Natural'}</p>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 font-black text-xs rounded-lg">{row.dispatched}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-black text-emerald-600">{row.successTotal}</span>
                                            <span className="text-[9px] font-bold text-emerald-400 uppercase">{Math.round((row.successTotal / row.dispatched) * 100) || 0}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-bold text-slate-600">{row.successFirstAttempt}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-bold text-slate-600">{row.successSecondAttempt}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-bold text-slate-600">{row.successMultipleAttempts}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-black text-rose-600">{Number(row.failedCurrently) + Number(row.returnedTotal)}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-black text-amber-600">{row.inTransit}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-black text-indigo-600">{row.pending}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white">
                            <tr className="font-black">
                                <td className="px-6 py-5 text-xs uppercase tracking-widest">TOTALES GENERALES</td>
                                <td className="px-6 py-5 text-center text-lg">{globalTotals.dispatched}</td>
                                <td className="px-6 py-5 text-center text-lg text-emerald-400">{globalTotals.success}</td>
                                <td className="px-6 py-5 text-center" colSpan={3}>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest mr-3">Tasa Éxito 1er Intento:</span>
                                    {firstAttemptRate}%
                                </td>
                                <td className="px-6 py-5 text-center text-lg text-rose-400">{globalTotals.failed}</td>
                                <td className="px-6 py-5 text-center text-lg text-amber-400">{globalTotals.transit}</td>
                                <td className="px-6 py-5 text-center text-lg text-indigo-400">{globalTotals.pending}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ActivityAuditReport;
