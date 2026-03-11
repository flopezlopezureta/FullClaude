import React, { useState, useEffect, useMemo, useContext, ReactNode, useRef } from 'react';
import { api } from '../../services/api';
import type { Package } from '../../types';
import { PackageStatus, PackageSource } from '../../constants';
import { AuthContext } from '../../contexts/AuthContext';
import { IconPrinter, IconMail, IconChecklist, IconClock, IconRoute, IconAlertTriangle, IconPackage, IconCalendar, IconCube } from '../Icon';

declare const Chart: any;

const getISODate = (date: Date) => date.toISOString().split('T')[0];

const KpiCard: React.FC<{ icon: ReactNode, title: string, value: string | number, subtext?: string, color: string }> = ({ icon, title, value, subtext, color }) => (
    <div className="bg-[var(--background-secondary)] rounded-lg p-4 shadow-sm border border-[var(--border-primary)] flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div className="ml-4">
            <p className="text-sm font-medium text-[var(--text-muted)]">{title}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            {subtext && <p className="text-xs text-[var(--text-muted)] opacity-70">{subtext}</p>}
        </div>
    </div>
);

const sourceLabels: Record<string, string> = {
    'MANUAL': 'Manual / Excel',
    'MERCADO_LIBRE': 'Mercado Libre',
    'SHOPIFY': 'Shopify',
    'WOOCOMMERCE': 'WooCommerce',
    'FALABELLA': 'Falabella',
};

const ClientPerformanceReportPage: React.FC = () => {
    const [packages, setPackages] = useState<Package[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const auth = useContext(AuthContext);

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState(getISODate(firstDayOfMonth));
    const [endDate, setEndDate] = useState(getISODate(today));
    const [communeFilter, setCommuneFilter] = useState<string>('ALL');
    const [sourceFilter, setSourceFilter] = useState<string>('ALL');
    
    const statusChartRef = useRef<HTMLCanvasElement>(null);
    const trendChartRef = useRef<HTMLCanvasElement>(null);
    const chartInstances = useRef<{ status?: any; trend?: any }>({});

    useEffect(() => {
        const fetchData = async () => {
            if (!auth?.user) return;
            setIsLoading(true);
            try {
                const { packages: allPackages } = await api.getPackages({ creatorId: auth.user.id, limit: 0 });
                setPackages(allPackages);
            } catch (error) {
                console.error("Failed to fetch client packages for report", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [auth?.user]);

    const uniqueCommunes = useMemo(() => {
        const communes = new Set(packages.map(p => p.recipientCommune));
        return Array.from(communes).sort();
    }, [packages]);

    const filteredPackages = useMemo(() => {
        return packages.filter(pkg => {
            const creationEvent = pkg.history[pkg.history.length - 1];
            if (!creationEvent) return false;
            const creationDate = new Date(creationEvent.timestamp);
            
            let dateMatch = true;
            if (startDate) {
                const start = new Date(startDate.replace(/-/g, '/'));
                start.setHours(0, 0, 0, 0);
                if(creationDate < start) dateMatch = false;
            }
            if (endDate) {
                const end = new Date(endDate.replace(/-/g, '/'));
                end.setHours(23, 59, 59, 999);
                if(creationDate > end) dateMatch = false;
            }

            const communeMatch = communeFilter === 'ALL' || pkg.recipientCommune === communeFilter;
            const sourceMatch = sourceFilter === 'ALL' || pkg.source === sourceFilter;

            return dateMatch && communeMatch && sourceMatch;
        });
    }, [packages, startDate, endDate, communeFilter, sourceFilter]);

    const reportStats = useMemo(() => {
        const total = filteredPackages.length;
        const delivered = filteredPackages.filter(p => p.status === PackageStatus.Delivered);
        const onTime = delivered.filter(p => {
            const deliveryEvent = p.history.find(e => e.status === PackageStatus.Delivered);
            return deliveryEvent && new Date(deliveryEvent.timestamp) <= new Date(p.estimatedDelivery);
        });

        const successRate = total > 0 ? ((delivered.length / total) * 100).toFixed(0) : '0';
        const onTimeRate = delivered.length > 0 ? ((onTime.length / delivered.length) * 100).toFixed(0) : '0';
        
        const totalDeliveryMillis = delivered.reduce((sum, pkg) => {
            const creationEvent = pkg.history.find(e => e.status === 'Creado') || pkg.history[pkg.history.length - 1];
            const deliveryEvent = pkg.history.find(e => e.status === PackageStatus.Delivered);
            if (creationEvent && deliveryEvent) {
                return sum + (new Date(deliveryEvent.timestamp).getTime() - new Date(creationEvent.timestamp).getTime());
            }
            return sum;
        }, 0);
        
        const avgDeliveryHours = delivered.length > 0 ? Math.round(totalDeliveryMillis / delivered.length / (1000 * 60 * 60)) : 0;
        
        const statusCounts = filteredPackages.reduce((acc, pkg) => {
            const statusKey = pkg.status.replace('_', ' ');
            acc[statusKey] = (acc[statusKey] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });


        return {
            total,
            successRate: `${successRate}%`,
            onTimeRate: `${onTimeRate}%`,
            avgDeliveryTime: `${avgDeliveryHours}h`,
            statusCounts
        };
    }, [filteredPackages]);

    useEffect(() => {
        const statusCtx = statusChartRef.current?.getContext('2d');
        const trendCtx = trendChartRef.current?.getContext('2d');

        if (chartInstances.current.status) chartInstances.current.status.destroy();
        if (chartInstances.current.trend) chartInstances.current.trend.destroy();

        if (statusCtx && filteredPackages.length > 0) {
            chartInstances.current.status = new Chart(statusCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(reportStats.statusCounts),
                    datasets: [{
                        label: 'Desglose por Estado',
                        data: Object.values(reportStats.statusCounts),
                        backgroundColor: ['#64748b', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'],
                    }]
                },
                options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } }
            });
        }
        
        if (trendCtx && filteredPackages.length > 0) {
            const shipmentsByDay: { [key: string]: number } = {};
            filteredPackages.forEach(p => {
                const date = new Date(p.history[p.history.length-1].timestamp).toISOString().split('T')[0];
                shipmentsByDay[date] = (shipmentsByDay[date] || 0) + 1;
            });
            const sortedDates = Object.keys(shipmentsByDay).sort();
            const labels = sortedDates.map(date => new Date(date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }));
            const data = sortedDates.map(date => shipmentsByDay[date]);
            
            chartInstances.current.trend = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Envíos por Día',
                        data,
                        fill: true,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        tension: 0.1
                    }]
                },
            });
        }
    }, [filteredPackages, reportStats.statusCounts]);

    const handlePrint = () => window.print();
    const handleEmail = () => alert('El informe de rendimiento ha sido enviado a tu correo (simulación).');

    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

    return (
        <>
        <div id="report-container" className="space-y-6 print:hidden">
            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
                    <div>
                        <p className="text-sm text-[var(--text-muted)]">Analiza las métricas de tus paquetes.</p>
                    </div>
                    <div className="flex items-center gap-2 mt-3 sm:mt-0">
                        <button onClick={handleEmail} className="inline-flex items-center px-3 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]"><IconMail className="w-4 h-4 mr-2"/> Correo</button>
                        <button onClick={handlePrint} className="inline-flex items-center px-3 py-2 text-sm font-medium text-[var(--text-on-brand)] bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]"><IconPrinter className="w-4 h-4 mr-2"/> Imprimir</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t pt-4 border-[var(--border-primary)]">
                    <div>
                        <label htmlFor="source-filter" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Fuente de Origen</label>
                        <select id="source-filter" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className={inputClasses}>
                            <option value="ALL">Todas las Fuentes</option>
                            {Object.values(PackageSource).map(s => (
                                <option key={s} value={s}>{sourceLabels[s] || s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="commune-filter" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Comuna de Destino</label>
                        <select id="commune-filter" value={communeFilter} onChange={e => setCommuneFilter(e.target.value)} className={inputClasses}>
                            <option value="ALL">Todas las Comunas</option>
                            {uniqueCommunes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Desde</label>
                        <div className="relative">
                            <div className="flex items-center justify-between w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm bg-[var(--background-secondary)] text-left cursor-pointer sm:text-sm">
                                <span className={startDate ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
                                    {startDate ? new Date(startDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/aaaa'}
                                </span>
                                <IconCalendar className="h-5 w-5 text-[var(--text-muted)]" />
                            </div>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" aria-label="Seleccionar fecha de inicio" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Hasta</label>
                        <div className="relative">
                            <div className="flex items-center justify-between w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm bg-[var(--background-secondary)] text-left cursor-pointer sm:text-sm">
                                <span className={endDate ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
                                    {endDate ? new Date(endDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/aaaa'}
                                </span>
                                <IconCalendar className="h-5 w-5 text-[var(--text-muted)]" />
                            </div>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" aria-label="Seleccionar fecha de fin" />
                        </div>
                    </div>
                </div>
            </div>

            {isLoading && <p className="text-center text-[var(--text-muted)] py-8">Cargando datos del informe...</p>}

            {!isLoading && (
                <div id="charts-container">
                    {filteredPackages.length === 0 ? (
                         <p className="text-center text-[var(--text-muted)] py-12 bg-[var(--background-secondary)] rounded-lg shadow-md">No se encontraron envíos para los filtros seleccionados.</p>
                    ) : (
                    <div className="space-y-6">
                        <section>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <KpiCard icon={<IconPackage className="w-6 h-6 text-gray-800"/>} title="Total Envíos" value={reportStats.total} color="bg-gray-100" />
                                <KpiCard icon={<IconChecklist className="w-6 h-6 text-green-800"/>} title="Tasa de Éxito" value={reportStats.successRate} subtext="Paquetes entregados" color="bg-green-100" />
                                <KpiCard icon={<IconClock className="w-6 h-6 text-blue-800"/>} title="Puntualidad" value={reportStats.onTimeRate} subtext="Sobre entregas exitosas" color="bg-blue-100" />
                                <KpiCard icon={<IconRoute className="w-6 h-6 text-purple-800"/>} title="Tiempo Promedio" value={reportStats.avgDeliveryTime} subtext="Creación a entrega" color="bg-purple-100" />
                            </div>
                        </section>
                        
                        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1 bg-[var(--background-secondary)] p-4 rounded-lg border border-[var(--border-primary)] shadow-sm"><canvas ref={statusChartRef}></canvas></div>
                            <div className="lg:col-span-2 bg-[var(--background-secondary)] p-4 rounded-lg border border-[var(--border-primary)] shadow-sm"><canvas ref={trendChartRef}></canvas></div>
                        </section>
                    </div>
                    )}
                </div>
            )}
        </div>
        
        {/* Printable Report */}
        <div className="hidden print:block print-container font-sans bg-white text-gray-800">
             <div className="p-8" style={{ width: '8.5in', minHeight: '11in' }}>
                <header className="flex justify-between items-start pb-4 border-b-2 border-gray-800">
                    <div className="flex items-center gap-3">
                        <IconCube className="w-10 h-10 text-gray-800" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{auth?.systemSettings.companyName}</h1>
                            <h2 className="text-lg text-gray-600">Informe de Rendimiento de Envíos</h2>
                        </div>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                        <p><span className="font-semibold text-gray-800">Cliente:</span> {auth?.user?.name}</p>
                        <p><span className="font-semibold text-gray-800">Período:</span> {new Date(startDate.replace(/-/g, '/')).toLocaleDateString('es-CL')} al {new Date(endDate.replace(/-/g, '/')).toLocaleDateString('es-CL')}</p>
                        <p><span className="font-semibold text-gray-800">Fuente:</span> {sourceFilter === 'ALL' ? 'Todas' : sourceLabels[sourceFilter] || sourceFilter}</p>
                    </div>
                </header>

                <section className="my-8">
                    <h3 className="text-xl font-semibold mb-4 border-b border-gray-300 pb-2 text-gray-800">Resumen del Período</h3>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="p-3 border border-gray-200 rounded text-center">
                            <p className="text-xs font-bold text-gray-500">TOTAL ENVÍOS</p>
                            <p className="text-3xl font-extrabold">{reportStats.total}</p>
                        </div>
                        <div className="p-3 border border-gray-200 rounded text-center">
                            <p className="text-xs font-bold text-gray-500">TASA DE ÉXITO</p>
                            <p className="text-3xl font-extrabold">{reportStats.successRate}</p>
                        </div>
                        <div className="p-3 border border-gray-200 rounded text-center">
                            <p className="text-xs font-bold text-gray-500">PUNTUALIDAD</p>
                            <p className="text-3xl font-extrabold">{reportStats.onTimeRate}</p>
                        </div>
                        <div className="p-3 border border-gray-200 rounded text-center">
                            <p className="text-xs font-bold text-gray-500">TIEMPO PROMEDIO</p>
                            <p className="text-3xl font-extrabold">{reportStats.avgDeliveryTime}</p>
                        </div>
                    </div>
                </section>
                
                 <section className="my-8">
                    <h3 className="text-xl font-semibold mb-4 text-gray-800">Desglose por Estado</h3>
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border-b-2 border-gray-300 p-2 text-left font-semibold text-gray-600">Estado</th>
                                <th className="border-b-2 border-gray-300 p-2 text-right font-semibold text-gray-600">Cantidad de Paquetes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(reportStats.statusCounts).map(([status, count], index) => (
                                <tr key={status} className={index % 2 === 0 ? '' : 'bg-gray-50'}>
                                    <td className="border-b border-gray-200 p-2 font-medium">{status}</td>
                                    <td className="border-b border-gray-200 p-2 text-right font-mono">{count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </section>

                 <footer className="absolute bottom-8 left-8 right-8 text-xs text-gray-500 text-center border-t border-gray-300 pt-2">
                    Reporte generado el {new Date().toLocaleString('es-CL')}
                </footer>
             </div>
        </div>
        </>
    );
};

export default ClientPerformanceReportPage;
