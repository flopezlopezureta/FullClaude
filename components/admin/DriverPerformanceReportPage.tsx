
import React, { useState, useEffect, useMemo, ReactNode, useRef } from 'react';
import { api } from '../../services/api';
import { Role, PackageStatus, ShippingType } from '../../constants';
import type { User, Package, AssignmentEvent, PickupRun } from '../../types';
import { IconPrinter, IconWhatsapp, IconMail, IconChecklist, IconClock, IconRoute, IconAlertTriangle, IconCalendar, IconFileSpreadsheet, IconRefresh, IconSearch } from '../Icon';
import { useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';

// Declare Chart.js in the global scope to avoid TypeScript errors
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

export const DriverPerformanceReportPage: React.FC = () => {
    const auth = useContext(AuthContext);
    const systemSettings = auth?.systemSettings;
    const [packages, setPackages] = useState<Package[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [assignmentEvents, setAssignmentEvents] = useState<AssignmentEvent[]>([]);
    const [pickupRuns, setPickupRuns] = useState<PickupRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');
    
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState(getISODate(firstDayOfMonth));
    const [endDate, setEndDate] = useState(getISODate(today));
    
    const dailyDeliveriesChartRef = useRef<HTMLCanvasElement>(null);
    const deliveryTypeChartRef = useRef<HTMLCanvasElement>(null);
    const chartInstances = useRef<{ daily?: any; type?: any }>({});
    
    const [isDriverSearchOpen, setIsDriverSearchOpen] = useState(false);
    const [driverSearchTerm, setDriverSearchTerm] = useState('');
    const driverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (driverRef.current && !driverRef.current.contains(event.target as Node)) {
                setIsDriverSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Always fetch users to populate the dropdown
            const allUsers = await api.getUsers();
            setUsers(allUsers);

            // 2. Only fetch performance data if a driver is selected
            if (selectedDriverId) {
                const [packagesResponse, allEvents, runs] = await Promise.all([
                    api.getPackages({ 
                        limit: 0, 
                        driverFilter: selectedDriverId,
                        startDate,
                        endDate,
                        statusFilter: [PackageStatus.Delivered, PackageStatus.Problem, PackageStatus.Returned].join(',')
                    }),
                    api.getAssignmentHistory(),
                    api.getPickupRuns({ startDate, endDate })
                ]);
                setPackages(packagesResponse.packages);
                setAssignmentEvents(allEvents);
                setPickupRuns(runs);
            } else {
                setPackages([]);
            }
        } catch (error) {
            console.error("Failed to fetch report data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [startDate, endDate, selectedDriverId]);

    const drivers = useMemo(() => {
        return users
            .filter(u => String(u.role).toUpperCase() === 'DRIVER')
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [users]);

    const filteredDrivers = useMemo(() => 
        drivers.filter(d => 
            d.name.toLowerCase().includes(driverSearchTerm.toLowerCase())
        ), 
        [drivers, driverSearchTerm]
    );

    const selectedDriver = drivers.find(c => c.id === selectedDriverId);

    const filteredPackages = useMemo(() => {
        if (!selectedDriverId) return [];
        
        // Since we now fetch filtered packages from API, we just need to double check
        // but we'll use a more robust date logic: use the timestamp of the actual Delivery/Problem event
        return packages.filter(pkg => {
            if (pkg.driverId !== selectedDriverId) return false;
            
            // Find the delivery or problem event to get the relevant date for the report
            const relevantEvent = pkg.history.find(e => 
                e.status === PackageStatus.Delivered || 
                e.status === PackageStatus.Problem || 
                e.status === PackageStatus.Returned
            ) || pkg.history[0];

            if (!relevantEvent) return false;
            
            const eventDate = new Date(new Date(relevantEvent.timestamp).toLocaleString('en-US', { timeZone: systemSettings?.timezone || 'America/Santiago' }));
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
            // Find the delivery event to get the actual date
            const deliveryEvent = pkg.history.find(e => e.status === PackageStatus.Delivered) || pkg.history[0];
            const deliveryDateStr = new Date(deliveryEvent.timestamp).toLocaleDateString('en-CA', { timeZone: systemSettings?.timezone || 'America/Santiago' }); // YYYY-MM-DD
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
            const dateStr = new Date(event.completedAt!).toLocaleDateString('en-CA', { timeZone: systemSettings?.timezone || 'America/Santiago' }); // YYYY-MM-DD
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
            // Use the run date for the breakdown
            const dateStr = new Date(a.runDate).toLocaleDateString('en-CA', { timeZone: systemSettings?.timezone || 'America/Santiago' }); // YYYY-MM-DD
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
    
    const handleExportCSV = async () => {
        if (!selectedDriver || isExporting) return;
        
        setIsExporting(true);
        try {
            // Small delay to allow UI to show loading state
            await new Promise(resolve => setTimeout(resolve, 100));

            const rates = selectedDriver.pricing || { sameDay: 0, express: 0, nextDay: 0 };
            
            const escapeCSV = (val: any) => {
                const str = String(val || '').replace(/"/g, '""');
                return `"${str}"`;
            };

            let csvContent = '\uFEFF'; // BOM for Excel

            // Section 1: Summary
            csvContent += escapeCSV("Informe de Rendimiento y Pago") + '\n';
            csvContent += escapeCSV("Conductor:") + ',' + escapeCSV(selectedDriver.name) + '\n';
            csvContent += escapeCSV("Período:") + ',' + escapeCSV(`${new Date(startDate + 'T00:00:00').toLocaleDateString('es-CL')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('es-CL')}`) + '\n\n';

            csvContent += escapeCSV("Métricas de Rendimiento (KPIs)") + '\n';
            csvContent += escapeCSV("Métrica") + ',' + escapeCSV("Valor") + '\n';
            csvContent += escapeCSV("Total Entregados") + ',' + escapeCSV(reportStats.totalDelivered) + '\n';
            csvContent += escapeCSV("Tasa de Entregas a Tiempo") + ',' + escapeCSV(reportStats.onTimeRate) + '\n';
            csvContent += escapeCSV("Tiempo Promedio de Entrega") + ',' + escapeCSV(reportStats.avgDeliveryHours) + '\n';
            csvContent += escapeCSV("Total Paquetes con Problema") + ',' + escapeCSV(reportStats.totalProblems) + '\n\n';

            csvContent += escapeCSV("Liquidación de Pagos") + '\n';
            csvContent += escapeCSV("Concepto") + ',' + escapeCSV("Cantidad") + ',' + escapeCSV("Tarifa") + ',' + escapeCSV("Subtotal") + '\n';
            paymentStats.deliveryBreakdown.forEach(item => {
                csvContent += escapeCSV(`Entregas ${item.label}`) + ',' + escapeCSV(item.count) + ',' + escapeCSV(item.rate) + ',' + escapeCSV(item.total) + '\n';
            });
            csvContent += escapeCSV("Retiros Realizados") + ',' + escapeCSV(paymentStats.pickupCount) + ',' + escapeCSV(paymentStats.pickupRate) + ',' + escapeCSV(paymentStats.totalPickupCost) + '\n';
            csvContent += escapeCSV("TOTAL A PAGAR") + ',,,' + escapeCSV(paymentStats.grandTotal) + '\n\n';

            // Section 2: Daily Breakdown
            csvContent += escapeCSV("Detalle Diario") + '\n';
            csvContent += escapeCSV("Fecha") + ',' + escapeCSV("N° Entregas") + ',' + escapeCSV("Pago Entregas") + ',' + escapeCSV("N° Retiros") + ',' + escapeCSV("Pago Retiros") + ',' + escapeCSV("Total Día") + '\n';
            dailyBreakdown.forEach(day => {
                csvContent += escapeCSV(new Date(day.date + 'T00:00:00').toLocaleDateString('es-CL')) + ',' + 
                              escapeCSV(day.deliveries) + ',' + 
                              escapeCSV(day.deliveryPay) + ',' + 
                              escapeCSV(day.pickups) + ',' + 
                              escapeCSV(day.pickupPay) + ',' + 
                              escapeCSV(day.totalPay) + '\n';
            });
            csvContent += '\n';

            // Section 3: Package List
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

            csvContent += escapeCSV("Listado de Paquetes Entregados") + '\n';
            csvContent += escapeCSV("ID Paquete") + ',' + escapeCSV("Destinatario") + ',' + escapeCSV("Comuna") + ',' + escapeCSV("Fecha Entrega") + ',' + escapeCSV("Tipo Envío") + ',' + escapeCSV("Pago Conductor") + '\n';
            
            // Chunked processing for the package list
            const CHUNK_SIZE = 500;
            for (let i = 0; i < deliveredPackages.length; i += CHUNK_SIZE) {
                const chunk = deliveredPackages.slice(i, i + CHUNK_SIZE);
                chunk.forEach(pkg => {
                    csvContent += escapeCSV(pkg.id) + ',' + 
                                  escapeCSV(pkg.recipientName) + ',' + 
                                  escapeCSV(pkg.recipientCommune) + ',' + 
                                  escapeCSV(new Date(pkg.history[0].timestamp).toLocaleDateString('es-CL')) + ',' + 
                                  escapeCSV(pkg.shippingType) + ',' + 
                                  escapeCSV(getPayRate(pkg)) + '\n';
                });
                // Yield to main thread
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            
            link.setAttribute("href", url);
            link.setAttribute("download", `Liquidacion_${selectedDriver.name.replace(/\s+/g, '_')}_${startDate}_${endDate}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("CSV export failed", error);
            alert("Error al exportar los datos.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
        <div id="report-container" className="space-y-6">
            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6 print:hidden">
            <div className="bg-[var(--background-secondary)] shadow-sm rounded-xl p-5 border border-[var(--border-primary)] print:hidden">
                <div className="flex flex-col md:flex-row items-end gap-4 lg:gap-6">
                    {/* Searchable Driver Dropdown */}
                    <div className="flex-1 relative min-w-[280px]" ref={driverRef}>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5 block">Conductor</label>
                        <div 
                            className="w-full pl-4 pr-10 py-2 border border-[var(--border-secondary)] rounded-lg shadow-sm bg-[var(--background-primary)] text-left cursor-pointer text-sm font-bold flex justify-between items-center transition-all hover:border-[var(--brand-primary)] h-[42px]"
                            onClick={() => setIsDriverSearchOpen(!isDriverSearchOpen)}
                        >
                            <span className="truncate text-[var(--text-primary)]">
                                {selectedDriver ? selectedDriver.name.toUpperCase() : '-- SELECCIONAR CONDUCTOR --'}
                            </span>
                            <span className="text-[var(--text-muted)] ml-2 text-[10px]">{isDriverSearchOpen ? '▲' : '▼'}</span>
                        </div>
                        
                        {isDriverSearchOpen && (
                            <div className="absolute z-50 mt-1 w-full bg-[var(--background-secondary)] border border-[var(--border-primary)] rounded-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-2 border-b border-[var(--border-primary)] bg-[var(--background-muted)]">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Escribe para buscar..."
                                            className="w-full pl-9 pr-3 py-2 text-sm font-bold border border-[var(--border-secondary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-[var(--background-primary)] text-[var(--text-primary)] shadow-inner"
                                            value={driverSearchTerm}
                                            onChange={(e) => setDriverSearchTerm(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                        />
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                            <IconSearch className="w-4 h-4 text-[var(--text-muted)]" />
                                        </div>
                                    </div>
                                </div>
                                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                    {filteredDrivers.map(driver => (
                                        <div 
                                            key={driver.id}
                                            className={`px-4 py-3 text-sm font-bold cursor-pointer transition-colors border-b border-[var(--border-primary)] last:border-0 ${selectedDriverId === driver.id ? 'bg-[var(--brand-muted)] text-[var(--brand-text)]' : 'hover:bg-[var(--background-hover)] text-[var(--text-primary)]'}`}
                                            onClick={() => { setSelectedDriverId(driver.id); setIsDriverSearchOpen(false); setDriverSearchTerm(''); }}
                                        >
                                            {driver.name.toUpperCase()}
                                        </div>
                                    ))}
                                    {filteredDrivers.length === 0 && (
                                        <div className="px-4 py-6 text-sm font-bold text-[var(--text-muted)] text-center">No se encontraron conductores</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-shrink-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5 block">Desde</label>
                        <div className="relative">
                            <div className="flex items-center justify-between w-36 px-4 py-2 border border-[var(--border-secondary)] rounded-lg shadow-sm bg-[var(--background-primary)] text-left cursor-pointer text-sm font-bold transition-all hover:border-[var(--brand-primary)] h-[42px]">
                                <span className="text-[var(--text-primary)]">
                                    {new Date(startDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                                <IconCalendar className="h-5 w-5 text-[var(--text-muted)]" />
                            </div>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                                aria-label="Fecha inicio"
                            />
                        </div>
                    </div>

                    <div className="flex-shrink-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5 block">Hasta</label>
                        <div className="relative">
                            <div className="flex items-center justify-between w-36 px-4 py-2 border border-[var(--border-secondary)] rounded-lg shadow-sm bg-[var(--background-primary)] text-left cursor-pointer text-sm font-bold transition-all hover:border-[var(--brand-primary)] h-[42px]">
                                <span className="text-[var(--text-primary)]">
                                    {new Date(endDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                                <IconCalendar className="h-5 w-5 text-[var(--text-muted)]" />
                            </div>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                                aria-label="Fecha fin"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={fetchData}
                        disabled={isLoading}
                        className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-2 bg-[var(--brand-primary)] text-white text-sm font-black rounded-lg hover:bg-[var(--brand-hover)] transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider h-[42px]"
                    >
                        <IconRefresh className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? '...' : 'Actualizar'}
                    </button>
                </div>
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
                            <button 
                                onClick={handleExportCSV} 
                                disabled={isExporting}
                                className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm disabled:opacity-50 ${isExporting ? 'animate-pulse' : ''}`}
                            >
                                <IconFileSpreadsheet className={`w-5 h-5 mr-2 ${isExporting ? 'animate-spin' : ''}`}/> 
                                {isExporting ? 'Exportando...' : 'Exportar CSV'}
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
