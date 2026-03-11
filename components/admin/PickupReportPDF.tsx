
import React from 'react';
import type { PickupAssignment, PickupShift } from '../../types';
import { IconCube } from '../Icon';
import { parseDateString } from '../../services/api';

// This component now receives date strings in 'YYYY-MM-DD' format
interface PickupReportPDFProps {
    reportData: (PickupAssignment & { driverName: string; date: string; shift: PickupShift })[];
    kpis: {
        totalPickups: number;
        totalPackages: number;
        uniqueClients: number;
        totalPaid: number;
    };
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    companyName: string;
    driverName?: string;
    clientName?: string;
}

const PickupReportPDF: React.FC<PickupReportPDFProps> = ({ reportData, kpis, startDate, endDate, companyName, driverName, clientName }) => {
    
    const formatCurrency = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    
    const formatDateForDisplay = (dateStr: string) => {
        const date = parseDateString(dateStr);
        if (isNaN(date.getTime())) return "Fecha Inválida";
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const totalCost = reportData.reduce((sum, a) => sum + a.cost, 0);
    const totalPackages = reportData.reduce((sum, a) => sum + (a.packagesPickedUp || 0), 0);

    return (
        <div className="p-8 font-sans bg-white text-gray-800" style={{ width: '8.5in', minHeight: '11in' }}>
            {/* Header */}
            <header className="flex justify-between items-start pb-4 mb-6 border-b-2 border-gray-800">
                <div className="flex items-center gap-4">
                    <IconCube className="w-10 h-10 text-gray-800" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{companyName}</h1>
                        <h2 className="text-lg text-gray-600">Reporte de Retiros</h2>
                    </div>
                </div>
                <div className="text-right text-sm text-gray-600">
                    <p><span className="font-semibold text-gray-800">Período:</span> {formatDateForDisplay(startDate)} al {formatDateForDisplay(endDate)}</p>
                    {driverName && <p><span className="font-semibold text-gray-800">Conductor:</span> {driverName}</p>}
                    {clientName && <p><span className="font-semibold text-gray-800">Cliente:</span> {clientName}</p>}
                </div>
            </header>

            {/* KPIs */}
            <section className="my-8">
                <h3 className="text-xl font-semibold mb-4 border-b border-gray-300 pb-2 text-gray-800">Resumen del Período</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="p-3 border border-gray-200 rounded-md">
                        <p className="text-xs font-bold text-gray-500 uppercase">Total Retiros</p>
                        <p className="text-3xl font-extrabold text-gray-800">{kpis.totalPickups}</p>
                    </div>
                     <div className="p-3 border border-gray-200 rounded-md">
                        <p className="text-xs font-bold text-gray-500 uppercase">Total Paquetes</p>
                        <p className="text-3xl font-extrabold text-gray-800">{kpis.totalPackages}</p>
                    </div>
                     <div className="p-3 border border-gray-200 rounded-md">
                        <p className="text-xs font-bold text-gray-500 uppercase">Clientes Visitados</p>
                        <p className="text-3xl font-extrabold text-gray-800">{kpis.uniqueClients}</p>
                    </div>
                     <div className="p-3 border border-green-300 bg-green-50 rounded-md">
                        <p className="text-xs font-bold text-green-700 uppercase">Total Pagado</p>
                        <p className="text-3xl font-extrabold text-green-700">{formatCurrency(kpis.totalPaid)}</p>
                    </div>
                </div>
            </section>

            {/* Details Table */}
            <section className="my-8">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Detalle de Retiros</h3>
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border-b-2 border-gray-300 text-left font-semibold text-gray-600">Fecha/Turno</th>
                            <th className="p-2 border-b-2 border-gray-300 text-left font-semibold text-gray-600">Conductor</th>
                            <th className="p-2 border-b-2 border-gray-300 text-left font-semibold text-gray-600">Cliente</th>
                            <th className="p-2 border-b-2 border-gray-300 text-left font-semibold text-gray-600">Estado</th>
                            <th className="p-2 border-b-2 border-gray-300 text-right font-semibold text-gray-600">Costo</th>
                            <th className="p-2 border-b-2 border-gray-300 text-right font-semibold text-gray-600">Paquetes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.length > 0 ? reportData.map((a, index) => (
                            <tr key={a.id} className={index % 2 === 0 ? '' : 'bg-gray-50'}>
                                <td className="p-2 border-b border-gray-200">{formatDateForDisplay(a.date)} <span className="text-gray-500 text-xs">{a.shift}</span></td>
                                <td className="p-2 border-b border-gray-200">{a.driverName}</td>
                                <td className="p-2 border-b border-gray-200 font-semibold">{a.clientName}</td>
                                <td className="p-2 border-b border-gray-200">{a.status.replace('_', ' ')}</td>
                                <td className="p-2 border-b border-gray-200 text-right font-mono">{formatCurrency(a.cost)}</td>
                                <td className="p-2 border-b border-gray-200 text-right font-mono font-semibold">{a.packagesPickedUp || 0}</td>
                            </tr>
                        )) : <tr><td colSpan={6} className="p-4 text-center text-gray-500 border-b">No hay datos para mostrar.</td></tr>}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                        <tr>
                            <td colSpan={4} className="p-2 text-right border-t-2 border-gray-400">TOTALES</td>
                            <td className="p-2 text-right border-t-2 border-gray-400">{formatCurrency(totalCost)}</td>
                            <td className="p-2 text-right font-mono border-t-2 border-gray-400">{totalPackages}</td>
                        </tr>
                    </tfoot>
                </table>
            </section>
            
            <footer className="absolute bottom-8 left-8 right-8 text-xs text-gray-500 text-center border-t border-gray-300 pt-2">
                Reporte generado el {new Date().toLocaleString('es-CL')}
            </footer>
        </div>
    );
};

export default PickupReportPDF;
