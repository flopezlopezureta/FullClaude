
import React, { useState, useEffect, useMemo, ReactNode, useRef } from 'react';
import { api } from '../../services/api';
import { Role, PackageStatus, ShippingType } from '../../constants';
import type { User, Package, AssignmentEvent, PickupRun } from '../../types';
import { IconPrinter, IconWhatsapp, IconMail, IconChecklist, IconClock, IconRoute, IconAlertTriangle, IconCalendar, IconFileSpreadsheet, IconRefresh } from '../Icon';

// Declare Chart.js and SheetJS (XLSX) in the global scope to avoid TypeScript errors
declare const Chart: any;
declare const XLSX: any;

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

export const DriverPerformanceReportPage: React.FC = () => {
    const [packages, setPackages] = useState<Package[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [assignmentEvents, setAssignmentEvents] = useState<AssignmentEvent[]>([]);
    const [pickupRuns, setPickupRuns] = useState<PickupRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');
    const [driverSearchQuery, setDriverSearchQuery] = useState<string>('');
    
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState(getISODate(firstDayOfMonth));
    const [endDate, setEndDate] = useState(getISODate(today));
    
    const dailyDeliveriesChartRef = useRef<HTMLCanvasElement>(null);
    const deliveryTypeChartRef = useRef<HTMLCanvasElement>(null);
    const chartInstances = useRef<{ daily?: any; type?: any }>({});
    
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [packagesResponse, allUsers, allEvents, runs] = await Promise.all([
                api.getPackages({ limit: 0 }),
                api.getUsers(),
                api.getAssignmentHistory(),
                api.getPickupRuns({ startDate, endDate })
            ]);
            setPackages(packagesResponse.packages);
            setUsers(allUsers);
            setAssignmentEvents(allEvents);
            setPickupRuns(runs);
        } catch (error) {
            console.error("Failed to fetch report data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [startDate, endDate]);

    const drivers = useMemo(() => 
        users.filter(u => u.role === Role.Driver && u.status === 'APROBADO').sort((a, b) => a.name.localeCompare(b.name)),
        [users]
    );

    const filteredDrivers = useMemo(() => 
        drivers.filter(d => 
            d.name.toLowerCase().includes(driverSearchQuery.toLowerCase())
        ), 
        [drivers, driverSearchQuery]
    );

    const selectedDriver = drivers.find(c => c.id === selectedDriverId);

    const filteredPackages = useMemo(() => {
        if (!selectedDriverId) return [];
        
        return packages.filter(pkg => {
            if (pkg.driverId !== selectedDriverId) return false;
            
            const finalEvent = pkg.history[0]; // Most recent event
            if (!finalEvent) return false;
            
            const eventDate = new Date(finalEvent.timestamp);
            const start = new Date(startDate.replace(/-/g, '/'));
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate.replace(/-/g, '/'));
            end.setHours(23, 59, 59, 999);
            
            return eventDate >= start && eventDate <= end;
        });
    }, [packages, selectedDriverId, startDate, endDate]);

    const reportStats = useMemo(() => {
        const delivered = filteredPackages.filter(p => p.status === PackageStatus.Delivered);
        const problems = filteredPackages.filter(p => p.status === PackageStatus.Problem);
        const onTime = delivered.filter(p => new Date(p.history[0].timestamp) <= new Date(p.estimatedDelivery));

        const totalDelivered = delivered.length;
        const onTimeRate = totalDelivered > 0 ? ((onTime.length / totalDelivered) * 100).toFixed(0) : '0';
        
        const totalDeliveryMillis = delivered.reduce((sum, pkg) => {
            const creationEvent = pkg.history.find(e => e.status === 'Creado') || pkg.history[pkg.history.length - 1];
            const deliveryEvent = pkg.history.find(e => e.status === PackageStatus.Delivered);
            if (creationEvent && deliveryEvent) {
                return sum + (new Date(deliveryEvent.timestamp).getTime() - new Date(creationEvent.timestamp).getTime());
            }
            return sum;
        }, 0);
        
        const avgDeliveryHours = totalDelivered > 0 ? Math.round(totalDeliveryMillis / totalDelivered / (1000 * 60 * 60)) : 0;

        return { totalDelivered, onTimeRate: `${onTimeRate}%`, avgDeliveryHours: `${avgDeliveryHours}h`, totalProblems: problems.length };
    }, [filteredPackages]);
    
    const paymentStats = useMemo(() => {
        const emptyStats = { deliveryBreakdown: [], totalDeliveryCost: 0, pickupCount: 0, totalPackagesPickedUp: 0, pickupRate: 0, totalPickupCost: 0, grandTotal: 0 };
        if (!selectedDriver?.pricing) return emptyStats;

        const rates = selectedDriver.pricing;
        const deliveredPackages = filteredPackages.filter(p => p.status === PackageStatus.Delivered);

        const deliveryCounts = deliveredPackages.reduce((acc, pkg) => {
            acc[pkg.shippingType] = (acc[pkg.shippingType] || 0) + 1;
            return acc;
        }, {} as { [key in ShippingType]?: number });
    
        const deliveryBreakdown = [
            { type: ShippingType.SameDay, label: 'En el Día', count: deliveryCounts[ShippingType.SameDay] || 0, rate: rates.sameDay || 0, total: (deliveryCounts[ShippingType.SameDay] || 0) * (rates.sameDay || 0) },
            { type: ShippingType.Express, label: 'Express', count: deliveryCounts[ShippingType.Express] || 0, rate: rates.express || 0, total: (deliveryCounts[ShippingType.Express] || 0) * (rates.express || 0) },
            { type: ShippingType.NextDay, label: 'Next Day', count: deliveryCounts[ShippingType.NextDay] || 0, rate: rates.nextDay || 0, total: (deliveryCounts[ShippingType.NextDay] || 0) * (rates.nextDay || 0) },
        ];
        const totalDeliveryCost = deliveryBreakdown.reduce((sum, item) => sum + item.total, 0);
        
        const start = new Date(startDate.replace(/-/g, '/'));
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate.replace(/-/g, '/'));
        end.setHours(23, 59, 59, 999);
    
        // 1. Calculate from Legacy Assignment Events
        const relevantLegacyEvents = assignmentEvents.filter(event => 
            event.driverId === selectedDriverId &&
            event.status === 'COMPLETADO' &&
            event.completedAt &&
            new Date(event.completedAt) >= start &&
            new Date(event.completedAt) <= end
        );

        // 2. Calculate from New Pickup System
        const relevantNewPickups = pickupRuns
            .filter(run => run.driverId === selectedDriverId)
            .flatMap(run => run.assignments)
            .filter(a => a.status === 'RETIRADO'); // Status RETIRADO means completed

        const legacyPickupCount = relevantLegacyEvents.length;
        const legacyPackagesCount = relevantLegacyEvents.reduce((sum, event) => sum + (event.packagesPickedUp || 0), 0);
        const legacyCost = relevantLegacyEvents.reduce((sum, event) => {
            const cost = event.pickupCost !== undefined && event.pickupCost !== null ? event.pickupCost : (rates.pickup || 0);
            return sum + cost;
        }, 0);

        const newPickupCount = relevantNewPickups.length;
        const newPackagesCount = relevantNewPickups.reduce((sum, a) => sum + (a.packagesPickedUp || 0), 0);
        const newCost = relevantNewPickups.reduce((sum, a) => sum + a.cost, 0);

        const pickupCount = legacyPickupCount + newPickupCount;
        const totalPackagesPickedUp = legacyPackagesCount + newPackagesCount;
        const totalPickupCost = legacyCost + newCost;
        const pickupRate = rates.pickup || 0; // Just for display reference

        return { deliveryBreakdown, totalDeliveryCost, pickupCount, totalPackagesPickedUp, pickupRate, totalPickupCost, grandTotal: totalDeliveryCost + totalPickupCost };
    }, [filteredPackages, selectedDriver, startDate, endDate, assignmentEvents, pickupRuns, selectedDriverId]);

    const dailyBreakdown = useMemo(() => {
        if (!selectedDriver) return [];

        const breakdown: { [date: string]: { deliveries: number, pickups: number, deliveryPay: number, pickupPay: number } } = {};
        const rates = selectedDriver.pricing || { sameDay: 0, express: 0, nextDay: 0, pickup: 0 };
        
        const start = new Date(startDate.replace(/-/g, '/'));
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate.replace(/-/g, '/'));
        end.setHours(23, 59, 59, 999);

        const initializeDate = (date: string) => {
             if (!breakdown[date]) {
                breakdown[date] = { deliveries: 0, pickups: 0, deliveryPay: 0, pickupPay: 0 };
            }
        }

        // Calculate deliveries per day
        const deliveredPackages = filteredPackages.filter(p => p.status === PackageStatus.Delivered);
        deliveredPackages.forEach(pkg => {
            const deliveryDateStr = new Date(pkg.history[0].timestamp).toISOString().split('T')[0];
            initializeDate(deliveryDateStr);
            breakdown[deliveryDateStr].deliveries++;
            const payRate = pkg.shippingType === ShippingType.SameDay ? rates.sameDay : pkg.shippingType === ShippingType.Express ? rates.express : rates.nextDay;
            breakdown[deliveryDateStr].deliveryPay += payRate || 0;
        });

        // Legacy Pickups
        const relevantLegacyEvents = assignmentEvents.filter(event => 
            event.driverId === selectedDriverId &&
            event.status === 'COMPLETADO' &&
            event.completedAt &&
            new Date(event.completedAt) >= start &&
            new Date(event.completedAt) <= end
        );

        relevantLegacyEvents.forEach(event => {
            const dateStr = new Date(event.completedAt!).toISOString().split('T')[0];
            initializeDate(dateStr);
            breakdown[dateStr].pickups++;
            const cost = event.pickupCost !== undefined && event.pickupCost !== null ? event.pickupCost : (rates.pickup || 0);
            breakdown[dateStr].pickupPay += cost;
        });

        // New System Pickups
        const relevantNewRunPickups = pickupRuns
            .filter(run => run.driverId === selectedDriverId)
            .flatMap(run => {
                // Map assignments to include the run date
                return run.assignments.map(a => ({ ...a, runDate: run.date }));
            })
            .filter(a => a.status === 'RETIRADO');

        relevantNewRunPickups.forEach(a => {
            // Use the run date for the breakdown, assuming date string YYYY-MM-DD from API
            const dateStr = new Date(a.runDate).toISOString().split('T')[0];
            // Filter again by date range just in case run.date is outside but was fetched
            const d = new Date(a.runDate);
            if (d >= start && d <= end) {
                initializeDate(dateStr);
                breakdown[dateStr].pickups++;
                breakdown[dateStr].pickupPay += a.cost;
            }
        });

        return Object.entries(breakdown)
            .map(([date, data]) => ({
                date,
                deliveries: data.deliveries,
                pickups: data.pickups,
                deliveryPay: data.deliveryPay,
                pickupPay: data.pickupPay,
                totalPay: data.deliveryPay + data.pickupPay
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filteredPackages, selectedDriver, startDate, endDate, assignmentEvents, pickupRuns, selectedDriverId]);


    // Chart logic
    useEffect(() => {
        const dailyCtx = dailyDeliveriesChartRef.current?.getContext('2d');
        const typeCtx = deliveryTypeChartRef.current?.getContext('2d');

        if (chartInstances.current.daily) chartInstances.current.daily.destroy();
        if (chartInstances.current.type) chartInstances.current.type.destroy();

        if (dailyCtx && filteredPackages.length > 0) {
            const deliveriesByDay: { [key: string]: number } = {};
            filteredPackages.forEach(p => {
                if (p.status === PackageStatus.Delivered) {
                    const date = new Date(p.history[0].timestamp).toISOString().split('T')[0];
                    deliveriesByDay[date] = (deliveriesByDay[date] || 0) + 1;
                }
            });
            const sortedDates = Object.keys(deliveriesByDay).sort();
            const labels = sortedDates.map(date => new Date(date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }));
            const data = sortedDates.map(date => deliveriesByDay[date]);
            
            chartInstances.current.daily = new Chart(dailyCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{ label: 'Entregas por Día', data, backgroundColor: 'rgba(59, 130, 246, 0.5)', borderColor: 'rgba(59, 130, 246, 1)', borderWidth: 1 }]
                },
                options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }
        
        if (typeCtx && filteredPackages.length > 0) {
            const delivered = filteredPackages.filter(p => p.status === PackageStatus.Delivered);
            const typeCounts = delivered.reduce((acc, pkg) => {
                acc[pkg.shippingType] = (acc[pkg.shippingType] || 0) + 1;
                return acc;
            }, {} as { [key in ShippingType]?: number });

            chartInstances.current.type = new Chart(typeCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(typeCounts),
                    datasets: [{
                        label: 'Tipo de Entrega',
                        data: Object.values(typeCounts),
                        backgroundColor: ['#f97316', '#ef4444', '#4f46e5'],
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }, [filteredPackages]);
    
    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

    const formatForCurrency = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

    const whatsappMessage = `Hola ${selectedDriver?.name},\n\nAquí está el resumen de tu pago para el período del ${new Date(startDate + 'T00:00:00').toLocaleDateString('es-CL')} al ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-CL')}:\n\n*Total a Pagar: ${formatForCurrency(paymentStats.grandTotal)}*\n\n*Detalles:*\n- Entregas: ${formatForCurrency(paymentStats.totalDeliveryCost)}\n- Retiros: ${formatForCurrency(paymentStats.totalPickupCost)}\n\nSaludos,\nEl equipo de administración.`;
    const emailSubject = `Resumen de Pago - ${selectedDriver?.name} - ${new Date(startDate + 'T00:00:00').toLocaleDateString('es-CL')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-CL')}`;
    const emailBody = `Hola ${selectedDriver?.name},\n\nAdjunto encontrarás el resumen de tu pago para el período del ${new Date(startDate + 'T00:00:00').toLocaleDateString('es-CL')} al ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-CL')}.\n\n*Resumen General:*\n*Total a Pagar:* ${formatForCurrency(paymentStats.grandTotal)}\n\n*Desglose:*\n- Total por Entregas: ${formatForCurrency(paymentStats.totalDeliveryCost)}\n- Total por Retiros: ${formatForCurrency(paymentStats.totalPickupCost)}\n\nSi tienes alguna pregunta, no dudes en contactarnos.\n\nSaludos cordiales,\nEl equipo de administración.`;
    
    const handleExcelExport = () => {
        if (!selectedDriver) return;
        const rates = selectedDriver.pricing || { sameDay: 0, express: 0, nextDay: 0 };
    
        const summaryData = [
            ["Informe de Rendimiento y Pago"],
            ["Conductor:", selectedDriver.name],
            ["Período:", `${new Date(startDate + 'T00:00:00').toLocaleDateString('es-CL')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-CL')}`],
            [],
            ["Métricas de Rendimiento (KPIs)"],
            ["Métrica", "Valor"],
            ["Total Entregados", reportStats.totalDelivered],
            ["Tasa de Entregas a Tiempo", reportStats.onTimeRate],
            ["Tiempo Promedio de Entrega", reportStats.avgDeliveryHours],
            ["Total Paquetes con Problema", reportStats.totalProblems],
            [],
            ["Liquidación de Pagos"],
            ["Concepto", "Cantidad", "Tarifa", "Subtotal"],
            ...paymentStats.deliveryBreakdown.map(item => [`Entregas ${item.label}`, item.count, item.rate, item.total]),
            ["Retiros Realizados", paymentStats.pickupCount, paymentStats.pickupRate, paymentStats.totalPickupCost],
            [],
            ["TOTAL A PAGAR", "", "", paymentStats.grandTotal]
        ];
        const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
    
        const dailyDataForExport = [
            ["Detalle Diario"],
            ["Fecha", "N° Entregas", "Pago Entregas", "N° Retiros", "Pago Retiros", "Total Día"],
            ...dailyBreakdown.map(day => [new Date(day.date + 'T00:00:00').toLocaleDateString('es-CL'), day.deliveries, day.deliveryPay, day.pickups, day.pickupPay, day.totalPay])
        ];
        const ws_daily = XLSX.utils.aoa_to_sheet(dailyDataForExport);
    
        const deliveredPackages = filteredPackages.filter(p => p.status === PackageStatus.Delivered);
        const getPayRate = (pkg: Package) => {
            if (!rates) return 0;
            switch(pkg.shippingType) {
                case ShippingType.SameDay: return rates.sameDay;
                case ShippingType.Express: return rates.express;
                case ShippingType.NextDay: return rates.nextDay;
                default: return 0;
            }
        };
        const packageListData = [
            ["Listado de Paquetes Entregados"],
            ["ID Paquete", "Destinatario", "Comuna", "Fecha Entrega", "Tipo Envío", "Pago Conductor"],
            ...deliveredPackages.map(pkg => [
                pkg.id,
                pkg.recipientName,
                pkg.recipientCommune,
                new Date(pkg.history[0].timestamp).toLocaleDateString('es-CL'),
                pkg.shippingType,
                getPayRate(pkg)
            ])
        ];
        const ws_packages = XLSX.utils.aoa_to_sheet(packageListData);
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws_summary, "Resumen");
        XLSX.utils.book_append_sheet(wb, ws_daily, "Detalle Diario");
        XLSX.utils.book_append_sheet(wb, ws_packages, "Listado Paquetes");
    
        XLSX.writeFile(wb, `Liquidacion_${selectedDriver.name.replace(' ', '_')}_${startDate}_${endDate}.xlsx`);
    };

    return (
        <>
        <div id="report-container" className="space-y-6">
            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label htmlFor="driver-search" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Buscar Conductor</label>
                        <input
                            id="driver-search"
                            type="text"
                            value={driverSearchQuery}
                            onChange={(e) => setDriverSearchQuery(e.target.value)}
                            placeholder="Escribe para filtrar..."
                            className={inputClasses}
                        />
                    </div>
                    <div>
                        <label htmlFor="driver-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Conductor</label>
                        <select id="driver-select" value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)} className={inputClasses}>
                            <option value="">-- Seleccionar Conductor --</option>
                            {filteredDrivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Desde</label>
                        <div className="relative"><div className="flex items-center justify-between w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm bg-[var(--background-secondary)] text-left cursor-pointer sm:text-sm"><span className={startDate ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{startDate ? new Date(startDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/aaaa'}</span><IconCalendar className="h-5 w-5 text-[var(--text-muted)]" /></div><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" aria-label="Seleccionar fecha de inicio" /></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Hasta</label>
                        <div className="relative"><div className="flex items-center justify-between w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm bg-[var(--background-secondary)] text-left cursor-pointer sm:text-sm"><span className={endDate ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{endDate ? new Date(endDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/aaaa'}</span><IconCalendar className="h-5 w-5 text-[var(--text-muted)]" /></div><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" aria-label="Seleccionar fecha de fin" /></div>
                    </div>
                </div>
                <div className="flex justify-end mt-4">
                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md shadow-sm hover:bg-[var(--background-hover)] transition-colors text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"
                    >
                        <IconRefresh className={`w-4 h-4 text-[var(--brand-primary)] ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Actualizando...' : 'Actualizar Datos'}
                    </button>
                </div>
            </div>
            
            {selectedDriver && !isLoading && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KpiCard icon={<IconChecklist className="w-6 h-6 text-blue-600"/>} title="Entregados" value={reportStats.totalDelivered} color="bg-blue-100"/>
                        <KpiCard icon={<IconClock className="w-6 h-6 text-green-600"/>} title="Puntualidad" value={reportStats.onTimeRate} color="bg-green-100"/>
                        <KpiCard icon={<IconRoute className="w-6 h-6 text-purple-600"/>} title="Tiempo Promedio" value={reportStats.avgDeliveryHours} subtext="Creación a entrega" color="bg-purple-100"/>
                        <KpiCard icon={<IconAlertTriangle className="w-6 h-6 text-red-600"/>} title="Problemas" value={reportStats.totalProblems} color="bg-red-100"/>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-[var(--background-secondary)] p-4 rounded-lg border border-[var(--border-primary)] shadow-sm">
                            <h4 className="text-md font-semibold text-[var(--text-primary)] mb-4 text-center">Entregas Diarias</h4>
                            <canvas ref={dailyDeliveriesChartRef}></canvas>
                        </div>
                        <div className="lg:col-span-1 bg-[var(--background-secondary)] p-4 rounded-lg border border-[var(--border-primary)] shadow-sm">
                            <h4 className="text-md font-semibold text-[var(--text-primary)] mb-4 text-center">Tipos de Envío</h4>
                            <div className="h-64"><canvas ref={deliveryTypeChartRef}></canvas></div>
                        </div>
                    </div>

                    {/* Payment Section */}
                    <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6 border border-[var(--border-primary)]">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Resumen de Pago Estimado</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-[var(--border-primary)] mb-6">
                                <thead className="bg-[var(--background-muted)]">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Concepto</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Cantidad</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Tarifa</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-primary)]">
                                    {paymentStats.deliveryBreakdown.map((item) => (
                                        <tr key={item.type}>
                                            <td className="px-6 py-3 text-sm text-[var(--text-primary)]">Entregas {item.label}</td>
                                            <td className="px-6 py-3 text-sm text-center text-[var(--text-secondary)]">{item.count}</td>
                                            <td className="px-6 py-3 text-sm text-right text-[var(--text-secondary)]">{formatForCurrency(item.rate)}</td>
                                            <td className="px-6 py-3 text-sm text-right font-medium text-[var(--text-primary)]">{formatForCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-[var(--background-muted)]/50">
                                        <td className="px-6 py-3 text-sm font-semibold text-[var(--text-primary)]">Retiros Realizados</td>
                                        <td className="px-6 py-3 text-sm text-center font-semibold text-[var(--text-primary)]">{paymentStats.pickupCount} <span className="text-xs font-normal text-[var(--text-muted)]">({paymentStats.totalPackagesPickedUp} paq.)</span></td>
                                        <td className="px-6 py-3 text-sm text-right text-[var(--text-secondary)]">{paymentStats.pickupRate > 0 ? formatForCurrency(paymentStats.pickupRate) : 'Var'}</td>
                                        <td className="px-6 py-3 text-sm text-right font-medium text-[var(--text-primary)]">{formatForCurrency(paymentStats.totalPickupCost)}</td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-[var(--background-muted)]">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-right font-bold text-lg text-[var(--text-primary)]">TOTAL A PAGAR</td>
                                        <td className="px-6 py-4 text-right font-bold text-lg text-[var(--brand-primary)]">{formatForCurrency(paymentStats.grandTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        <div className="flex flex-wrap justify-end gap-3 print:hidden">
                            <button onClick={handleExcelExport} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm">
                                <IconFileSpreadsheet className="w-5 h-5 mr-2"/> Exportar Excel
                            </button>
                            <a href={`https://wa.me/${selectedDriver.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer" className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#25D366] rounded-md hover:bg-[#128C7E] shadow-sm">
                                <IconWhatsapp className="w-5 h-5 mr-2"/> Enviar Resumen WhatsApp
                            </a>
                            <a href={`mailto:${selectedDriver.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm">
                                <IconMail className="w-5 h-5 mr-2"/> Enviar Correo
                            </a>
                            <button onClick={() => window.print()} className="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)] shadow-sm">
                                <IconPrinter className="w-5 h-5 mr-2"/> Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
};

export default DriverPerformanceReportPage;
