import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { IconChevronLeft, IconChevronRight, IconFileSpreadsheet, IconRefresh, IconPackage, IconCheck, IconTruck, IconAlertTriangle } from '../Icon';
import { getLocalDateString } from '../../utils/dateUtils';

interface BillingSummaryRow {
    clientId: string;
    clientName: string;
    companyName?: string;
    statuses: { [status: string]: number };
    total: number;
}

const AdminBillingSummary: React.FC = () => {
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [endDate, setEndDate] = useState(getLocalDateString());
    const [summary, setSummary] = useState<BillingSummaryRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const fetchSummary = async () => {
        setIsLoading(true);
        try {
            // Using a new endpoint we'll define in the backend
            const response = await fetch(`/api/billing/summary?startDate=${startDate}&endDate=${endDate}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                setSummary(data);
            } else {
                alert(data.message || 'Error al cargar el resumen.');
            }
        } catch (error) {
            console.error('Error fetching billing summary:', error);
            alert('Error de conexión con el servidor.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, []);

    const handleExportCSV = () => {
        if (summary.length === 0 || isExporting) return;
        setIsExporting(true);
        
        try {
            const escapeCSV = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
            let csv = '\uFEFF'; // BOM
            csv += `${escapeCSV('Cliente')},${escapeCSV('Empresa')},${escapeCSV('Total')},${escapeCSV('Entregados')},${escapeCSV('En Tránsito/Retirados')},${escapeCSV('Pendientes')},${escapeCSV('Problemas/Devueltos')}\n`;
            
            summary.forEach(row => {
                const delivered = row.statuses['ENTREGADO'] || 0;
                const transit = (row.statuses['RETIRADO'] || 0) + (row.statuses['EN_TRANSITO'] || 0);
                const pending = row.statuses['PENDIENTE'] || 0;
                const problems = (row.statuses['PROBLEMA'] || 0) + (row.statuses['DEVUELTO'] || 0);
                
                csv += `${escapeCSV(row.clientName)},${escapeCSV(row.companyName)},${row.total},${delivered},${transit},${pending},${problems}\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Resumen_Operativo_${startDate}_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setIsExporting(false);
        }
    };

    const totals = summary.reduce((acc, row) => {
        acc.total += row.total;
        acc.delivered += row.statuses['ENTREGADO'] || 0;
        acc.dispatched += (row.statuses['RETIRADO'] || 0) + (row.statuses['EN_TRANSITO'] || 0) + (row.statuses['ENTREGADO'] || 0) + (row.statuses['PROBLEMA'] || 0);
        return acc;
    }, { total: 0, delivered: 0, dispatched: 0 });

    return (
        <div className="space-y-6">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><IconPackage className="w-6 h-6"/></div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Ingresados</p>
                            <p className="text-2xl font-bold text-gray-900">{totals.total}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg"><IconCheck className="w-6 h-6"/></div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Entregados</p>
                            <p className="text-2xl font-bold text-gray-900">{totals.delivered}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><IconTruck className="w-6 h-6"/></div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Despachados</p>
                            <p className="text-2xl font-bold text-gray-900">{totals.dispatched}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Desde</label>
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Hasta</label>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={fetchSummary}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <IconRefresh className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}/>
                        Consultar
                    </button>
                    <button 
                        onClick={handleExportCSV}
                        disabled={summary.length === 0 || isExporting}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                        <IconFileSpreadsheet className="w-4 h-4"/>
                        Exportar
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider text-green-600">Entregados</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider text-blue-600">En Ruta</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider text-amber-600">Pendientes</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider text-red-600">Problemas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {summary.length === 0 && !isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No hay datos para el rango seleccionado.</td>
                                </tr>
                            ) : summary.map((row) => (
                                <tr key={row.clientId} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">{row.clientName}</div>
                                        {row.companyName && <div className="text-[10px] text-gray-400 uppercase tracking-tighter">{row.companyName}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex px-2 py-1 bg-gray-100 text-gray-700 text-xs font-black rounded-md">{row.total}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex px-2 py-1 bg-green-50 text-green-700 text-xs font-black rounded-md">{row.statuses['ENTREGADO'] || 0}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex px-2 py-1 bg-blue-50 text-blue-700 text-xs font-black rounded-md">
                                            {(row.statuses['RETIRADO'] || 0) + (row.statuses['EN_TRANSITO'] || 0)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex px-2 py-1 bg-amber-50 text-amber-700 text-xs font-black rounded-md">{row.statuses['PENDIENTE'] || 0}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex px-2 py-1 bg-red-50 text-red-700 text-xs font-black rounded-md">
                                            {(row.statuses['PROBLEMA'] || 0) + (row.statuses['DEVUELTO'] || 0)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminBillingSummary;
