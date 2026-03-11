
import React, { useState, useEffect, useMemo, useRef, ReactNode, useContext } from 'react';
import { api, parseDateString, getISODate } from '../../services/api';
import { Role, PickupStatus } from '../../constants';
import type { User, PickupRun, PickupAssignment, PickupShift } from '../../types';
import { IconCalendar, IconPrinter, IconFileSpreadsheet, IconWhatsapp, IconPackage, IconTruck, IconUsers, IconDollarSign, IconCube } from '../Icon';
import { AuthContext } from '../../contexts/AuthContext';
import PickupReportPDF from './PickupReportPDF';

// Declare external libraries
declare const XLSX: any;

const KpiCard: React.FC<{ icon: ReactNode, title: string, value: string | number, subtext?: string }> = ({ icon, title, value, subtext }) => (
    <div className="bg-[var(--background-secondary)] p-4 rounded-lg shadow-sm border border-[var(--border-primary)] flex items-center print:border-gray-200 print:shadow-none">
        <div className="p-3 bg-[var(--background-muted)] rounded-full mr-4 print:bg-gray-100">{icon}</div>
        <div>
            <p className="text-sm font-medium text-[var(--text-muted)] print:text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] print:text-black">{value}</p>
            {subtext && <p className="text-xs text-[var(--text-muted)] print:text-gray-500">{subtext}</p>}
        </div>
    </div>
);

const PickupReportPage: React.FC = () => {
    const [runs, setRuns] = useState<PickupRun[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const auth = useContext(AuthContext);
    const [copySuccess, setCopySuccess] = useState(false);
    
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState(getISODate(firstDayOfMonth));
    const [endDate, setEndDate] = useState(getISODate(today));
    const [driverFilter, setDriverFilter] = useState<string>('ALL');
    const [clientFilter, setClientFilter] = useState<string>('ALL');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [allUsers, pickupRuns] = await Promise.all([
                api.getUsers(),
                api.getPickupRuns({ startDate, endDate }),
            ]);
            setUsers(allUsers);
            setRuns(pickupRuns);
        } catch (error) {
            console.error("Failed to fetch pickup report data", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, [startDate, endDate]);

    const drivers = useMemo(() => users.filter(u => u.role === Role.Driver), [users]);
    const clients = useMemo(() => users.filter(u => u.role === Role.Client), [users]);

    const filteredAssignments = useMemo(() => {
        let allAssignments: (PickupAssignment & { driverName: string; date: string; shift: PickupShift })[] = [];
        runs.forEach(run => {
            run.assignments.forEach(assignment => {
                allAssignments.push({
                    ...assignment,
                    driverName: run.driverName,
                    date: run.date,
                    shift: run.shift
                });
            });
        });

        if (driverFilter !== 'ALL') {
            const driver = drivers.find(d => d.id === driverFilter);
            allAssignments = allAssignments.filter(a => a.driverName === driver?.name);
        }
        if (clientFilter !== 'ALL') {
            allAssignments = allAssignments.filter(a => a.clientId === clientFilter);
        }
        return allAssignments.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [runs, driverFilter, clientFilter, drivers]);
    
    const kpis = useMemo(() => {
        const totalPickups = filteredAssignments.length;
        const totalPackages = filteredAssignments.reduce((sum, a) => sum + (a.packagesPickedUp || 0), 0);
        const uniqueClients = new Set(filteredAssignments.map(a => a.clientId)).size;
        const totalPaid = filteredAssignments.reduce((sum, a) => sum + a.cost, 0);

        return { totalPickups, totalPackages, uniqueClients, totalPaid };
    }, [filteredAssignments]);

    const formatCurrency = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    const handleExportPdf = () => window.print();

    const handleExportExcel = () => {
        const dataToExport = filteredAssignments.map(a => ({
            'Fecha': parseDateString(a.date).toLocaleDateString('es-CL'),
            'Turno': a.shift,
            'Conductor': a.driverName,
            'Cliente': a.clientName,
            'Estado': a.status.replace('_', ' '),
            'Costo': a.cost,
            'Paquetes Retirados': a.packagesPickedUp || 0,
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Retiros");
        XLSX.writeFile(workbook, `Reporte_Retiros_${startDate}_${endDate}.xlsx`);
    };

    const handleShareWhatsApp = () => {
        let message = `*Resumen de Retiros (${parseDateString(startDate).toLocaleDateString('es-CL')} a ${parseDateString(endDate).toLocaleDateString('es-CL')})*\n\n`;
        message += `📋 *Total Retiros:* ${kpis.totalPickups}\n`;
        message += `📦 *Total Paquetes:* ${kpis.totalPackages}\n`;
        message += `💰 *Total Pagado a Conductores:* ${formatCurrency(kpis.totalPaid)}\n\n`;
        message += `*Detalles:* \n`;
        
        filteredAssignments.slice(0, 20).forEach(a => { // Limit to avoid very long messages
            message += `- ${a.clientName} por ${a.driverName} (${a.packagesPickedUp || 0} p.)\n`;
        });
        if (filteredAssignments.length > 20) {
            message += `...y ${filteredAssignments.length - 20} más.\n`;
        }

        navigator.clipboard.writeText(message).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }, (err) => {
            console.error('Could not copy text: ', err);
            alert('Error al copiar el reporte.');
        });
    };

    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";
    
    return (
        <>
        <div id="report-page-container" className="print:hidden space-y-6">
            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {/* Filters */}
                    <div>
                        <label className="text-xs text-[var(--text-muted)]">Desde</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClasses}/>
                    </div>
                     <div>
                        <label className="text-xs text-[var(--text-muted)]">Hasta</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClasses}/>
                    </div>
                     <div>
                        <label className="text-xs text-[var(--text-muted)]">Conductor</label>
                        <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)} className={inputClasses}>
                            <option value="ALL">Todos</option>
                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="text-xs text-[var(--text-muted)]">Cliente</label>
                        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className={inputClasses}>
                            <option value="ALL">Todos</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-primary)] pt-4">
                    <button onClick={handleExportPdf} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-red-700 bg-red-100 rounded-md hover:bg-red-200"><IconPrinter className="w-4 h-4"/> PDF</button>
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-green-700 bg-green-100 rounded-md hover:bg-green-200"><IconFileSpreadsheet className="w-4 h-4"/> Excel</button>
                    <button onClick={handleShareWhatsApp} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${copySuccess ? 'bg-green-600 text-white' : 'bg-teal-100 text-teal-700 hover:bg-teal-200'}`}>
                        <IconWhatsapp className="w-4 h-4"/> {copySuccess ? '¡Copiado!' : 'Copiar para WA'}
                    </button>
                </div>
            </div>
            {isLoading ? <p className="text-center p-8 text-[var(--text-muted)]">Cargando reporte...</p> : 
            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-4 space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon={<IconTruck className="w-6 h-6 text-blue-600"/>} title="Total Retiros" value={kpis.totalPickups} />
                    <KpiCard icon={<IconPackage className="w-6 h-6 text-purple-600"/>} title="Total Paquetes" value={kpis.totalPackages} />
                    <KpiCard icon={<IconUsers className="w-6 h-6 text-orange-600"/>} title="Clientes Visitados" value={kpis.uniqueClients} />
                    <KpiCard icon={<IconDollarSign className="w-6 h-6 text-green-600"/>} title="Total Pagado" value={formatCurrency(kpis.totalPaid)} />
                </div>
                
                 <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-[var(--border-primary)] text-sm">
                        <thead className="bg-[var(--background-muted)]">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-[var(--text-muted)]">Fecha/Turno</th>
                                <th className="px-4 py-2 text-left font-medium text-[var(--text-muted)]">Conductor</th>
                                <th className="px-4 py-2 text-left font-medium text-[var(--text-muted)]">Cliente</th>
                                <th className="px-4 py-2 text-left font-medium text-[var(--text-muted)]">Estado</th>
                                <th className="px-4 py-2 text-right font-medium text-[var(--text-muted)]">Costo</th>
                                <th className="px-4 py-2 text-right font-medium text-[var(--text-muted)]">Paquetes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-primary)]">
                            {filteredAssignments.map(a => {
                                const parsedDate = parseDateString(a.date);
                                return (
                                <tr key={a.id}>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        {isNaN(parsedDate.getTime()) ? 'Fecha Inválida' : parsedDate.toLocaleDateString('es-CL')}
                                        <span className="text-xs text-[var(--text-muted)] ml-1">{a.shift}</span>
                                    </td>
                                    <td className="px-4 py-2">{a.driverName}</td>
                                    <td className="px-4 py-2 font-medium">{a.clientName}</td>
                                    <td className="px-4 py-2"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${a.status === PickupStatus.RETIRADO ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{a.status.replace('_', ' ')}</span></td>
                                    <td className="px-4 py-2 text-right font-mono">{formatCurrency(a.cost)}</td>
                                    <td className="px-4 py-2 text-right font-mono">{a.packagesPickedUp || 0}</td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>}
        </div>

        <div className="hidden print:block print-container">
            <PickupReportPDF
                reportData={filteredAssignments}
                kpis={kpis}
                startDate={startDate}
                endDate={endDate}
                companyName={auth?.systemSettings.companyName || 'FULL ENVIOS'}
                driverName={driverFilter !== 'ALL' ? drivers.find(d => d.id === driverFilter)?.name : undefined}
                clientName={clientFilter !== 'ALL' ? clients.find(c => c.id === clientFilter)?.name : undefined}
            />
        </div>
        </>
    );
};

export default PickupReportPage;
