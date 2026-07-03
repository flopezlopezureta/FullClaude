import React, { useState, useEffect, useMemo, useContext } from 'react';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import { IconPrinter, IconCalendar, IconPackage, IconDollarSign, IconFileSpreadsheet, IconTrendingUp, IconLock, IconCube } from '../Icon';
import { exportSuperAdminBillingToExcel } from '../../services/exportService';

const KpiCard: React.FC<{ icon: React.ReactNode, title: string, value: string | number, subtext?: string, colorClass: string }> = ({ icon, title, value, subtext, colorClass }) => (
    <div className="bg-[var(--background-secondary)] rounded-lg p-4 shadow-sm border border-[var(--border-primary)] flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-full ${colorClass}`}>
            {icon}
        </div>
        <div className="ml-4">
            <p className="text-sm font-medium text-[var(--text-muted)]">{title}</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
            {subtext && <p className="text-xs text-[var(--text-muted)] opacity-70">{subtext}</p>}
        </div>
    </div>
);

const SuperAdminBillingReportPage: React.FC = () => {
    const { token } = useContext(AuthContext)!;
    const [users, setUsers] = useState<any[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
    
    const today = new Date();
    const [year, setYear] = useState<string>(String(today.getFullYear()));
    const [month, setMonth] = useState<string>(String(today.getMonth() + 1)); // 1-indexed
    const [ufOverride, setUfOverride] = useState<string>('');
    
    const [reportData, setReportData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Fetch clients list and auto-select Go Delivery Interno
    useEffect(() => {
        const fetchClients = async () => {
            try {
                const allUsers = await api.getUsers();
                setUsers(allUsers);
                
                // Auto-select Go Delivery Interno if present
                const goDelivery = allUsers.find((u: any) => 
                    u.role === 'CLIENT' && u.name.toLowerCase().includes('go delivery')
                );
                if (goDelivery) {
                    setSelectedClientId(goDelivery.id);
                }
            } catch (error) {
                console.error("Failed to fetch clients", error);
            }
        };
        fetchClients();
    }, []);

    const clients = useMemo(() => 
        users.filter(u => u.role === 'CLIENT').sort((a, b) => a.name.localeCompare(b.name)),
        [users]
    );

    const filteredClients = useMemo(() => 
        clients.filter(c => 
            c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
        ), 
        [clients, clientSearchQuery]
    );

    const fetchReport = async () => {
        if (!selectedClientId || !year || !month) return;
        setIsLoading(true);
        try {
            let url = `/api/billing/superadmin-monthly-report?clientId=${selectedClientId}&year=${year}&month=${month}`;
            if (ufOverride) {
                url += `&ufValue=${ufOverride}`;
            }
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            
            if (response.ok) {
                setReportData(data);
                // Pre-populate manual override input with fetched value if not overridden yet
                if (!ufOverride && data.uf?.value) {
                    setUfOverride(String(data.uf.value));
                }
            } else {
                alert(data.message || "Error al obtener el reporte.");
                setReportData(null);
            }
        } catch (error) {
            console.error("Failed to fetch monthly report", error);
            setReportData(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [selectedClientId, year, month]);

    const handleApplyUfOverride = () => {
        fetchReport();
    };

    const handleExportExcel = async () => {
        if (!reportData || isExporting) return;
        
        setIsExporting(true);
        try {
            const dateStr = `${String(month).padStart(2, '0')}_${year}`;
            const clientNameClean = reportData.client.name.replace(/\s+/g, '_');
            const filename = `Reporte_Cobro_UF_${clientNameClean}_${dateStr}.xlsx`;
            await exportSuperAdminBillingToExcel(reportData, filename);
        } catch (error) {
            console.error("Export to Excel failed:", error);
            alert("Error al exportar a Excel.");
        } finally {
            setIsExporting(false);
        }
    };

    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";
    const formatCLP = (val: number | null) => val !== null ? val.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }) : '-';

    return (
        <>
        <style dangerouslySetInnerHTML={{__html: `
            @media print {
                @page {
                    margin: 0 !important;
                }
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                }
                .print-container {
                    display: block !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                    padding: 2cm !important;
                    margin: 0 !important;
                    background: white !important;
                    min-height: auto !important;
                }
            }
        `}} />
        <div className="space-y-6 print:hidden">
            {/* Access Disclaimer Header */}
            <div className="bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900 rounded-lg p-4 flex items-center gap-3">
                <IconLock className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="text-sm font-semibold text-rose-800 dark:text-rose-400">
                    MÓDULO DE SEGURIDAD EXCLUSIVO: Esta vista es visible únicamente para la cuenta de Superadministrador del sistema.
                </span>
            </div>

            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Reporte Mensual de Cobro UF (0,00099667 UF/envío)</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label htmlFor="super-client-search" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Buscar Cliente</label>
                        <input 
                            type="text" 
                            id="super-client-search"
                            value={clientSearchQuery}
                            onChange={e => setClientSearchQuery(e.target.value)}
                            placeholder="Ej: Go Delivery..."
                            className={inputClasses}
                        />
                    </div>
                    <div>
                        <label htmlFor="super-client-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Cliente</label>
                        <select id="super-client-select" value={selectedClientId} onChange={e => { setSelectedClientId(e.target.value); setReportData(null); }} className={inputClasses}>
                            <option value="">-- Seleccionar Cliente --</option>
                            {filteredClients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="super-year-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Año</label>
                        <select id="super-year-select" value={year} onChange={e => { setYear(e.target.value); setReportData(null); }} className={inputClasses}>
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="super-month-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Mes</label>
                        <select id="super-month-select" value={month} onChange={e => { setMonth(e.target.value); setReportData(null); }} className={inputClasses}>
                            <option value="1">Enero</option>
                            <option value="2">Febrero</option>
                            <option value="3">Marzo</option>
                            <option value="4">Abril</option>
                            <option value="5">Mayo</option>
                            <option value="6">Junio</option>
                            <option value="7">Julio</option>
                            <option value="8">Agosto</option>
                            <option value="9">Septiembre</option>
                            <option value="10">Octubre</option>
                            <option value="11">Noviembre</option>
                            <option value="12">Diciembre</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="super-uf-override" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Valor UF del 1º del mes sig.</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                id="super-uf-override"
                                step="0.01"
                                value={ufOverride}
                                onChange={e => setUfOverride(e.target.value)}
                                className={inputClasses}
                                placeholder="Valor UF..."
                            />
                            <button 
                                onClick={handleApplyUfOverride}
                                className="px-3 py-2 text-sm font-medium bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] text-[var(--text-on-brand)] rounded-md"
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading && <p className="text-center text-[var(--text-muted)] mt-6">Calculando reporte y consultando UF en mindicador.cl...</p>}

            {reportData && !isLoading && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KpiCard 
                            icon={<IconPackage className="w-6 h-6 text-blue-800"/>} 
                            title="Despachos Cobrados" 
                            value={reportData.summary.totalPackages} 
                            subtext={`Creados: ${reportData.summary.totalCreated} / Sin Procesar: ${reportData.summary.totalAssignedToBodega}`}
                            colorClass="bg-blue-100" 
                        />
                        <KpiCard 
                            icon={<IconTrendingUp className="w-6 h-6 text-indigo-800"/>} 
                            title="Total UF Acumulado" 
                            value={`${reportData.summary.totalCostUf.toFixed(5)} UF`} 
                            colorClass="bg-indigo-100" 
                        />
                        <KpiCard 
                            icon={<IconCalendar className="w-6 h-6 text-purple-800"/>} 
                            title={`UF al 01/${String(reportData.period.month === 12 ? 1 : reportData.period.month + 1).padStart(2, '0')}/${reportData.period.month === 12 ? reportData.period.year + 1 : reportData.period.year}`} 
                            value={reportData.uf.value ? `$${reportData.uf.value.toLocaleString('es-CL')}` : 'No especificado'} 
                            subtext={`Origen: ${reportData.uf.source}`}
                            colorClass="bg-purple-100" 
                        />
                        <KpiCard 
                            icon={<IconDollarSign className="w-6 h-6 text-emerald-800"/>} 
                            title="Monto Bruto CLP (+IVA)" 
                            value={formatCLP(reportData.summary.totalCostClpGross)} 
                            subtext={`Neto: ${formatCLP(reportData.summary.totalCostClpNet)}`}
                            colorClass="bg-emerald-100" 
                        />
                    </div>

                    <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Detalle de Cobro Diario</h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleExportExcel} 
                                    disabled={isExporting}
                                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md shadow-sm hover:bg-[var(--background-hover)] disabled:opacity-50"
                                >
                                    <IconFileSpreadsheet className={`w-4 h-4 mr-2 ${isExporting ? 'animate-spin' : ''}`}/>
                                    {isExporting ? 'Exportando...' : 'Exportar Excel'}
                                </button>
                                <button 
                                    onClick={() => window.print()} 
                                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--text-on-brand)] bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]"
                                >
                                    <IconPrinter className="w-4 h-4 mr-2"/> Imprimir Reporte
                                </button>
                            </div>
                        </div>

                        <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-[var(--border-primary)]">
                                <thead className="bg-[var(--background-muted)]">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Fecha</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Ingresados</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Sin Procesar</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Despachados (Facturar)</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Costo UF</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Neto CLP</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-[var(--background-secondary)] divide-y divide-[var(--border-primary)]">
                                    {reportData.dailyDetails.length === 0 ? (
                                        <tr><td colSpan={6} className="px-6 py-4 text-center text-[var(--text-muted)]">No se registraron despachos en el período seleccionado.</td></tr>
                                    ) : (
                                        reportData.dailyDetails.map((day: any) => (
                                            <tr key={day.date}>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-[var(--text-primary)] font-medium">
                                                    {new Date(day.date + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-[var(--text-secondary)]">{day.totalCreated}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-rose-500 font-semibold">{day.assignedToBodega}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-emerald-600 font-bold">{day.packagesCount}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-[var(--text-secondary)] font-mono">{day.costUf.toFixed(6)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-[var(--text-primary)] font-semibold">{formatCLP(day.costClp)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-[var(--background-muted)] font-semibold text-sm">
                                    <tr className="border-t-2 border-[var(--border-primary)]">
                                        <td className="px-6 py-3 text-right text-[var(--text-primary)] font-bold">TOTALES</td>
                                        <td className="px-6 py-3 text-center text-[var(--text-secondary)] font-bold">{reportData.summary.totalCreated}</td>
                                        <td className="px-6 py-3 text-center text-rose-500 font-bold">{reportData.summary.totalAssignedToBodega}</td>
                                        <td className="px-6 py-3 text-center text-emerald-600 font-bold">{reportData.summary.totalPackages}</td>
                                        <td className="px-6 py-3 text-right text-[var(--text-primary)] font-mono font-bold">{reportData.summary.totalCostUf.toFixed(5)} UF</td>
                                        <td className="px-6 py-3 text-right text-[var(--text-primary)] font-bold">{formatCLP(reportData.summary.totalCostClpNet)}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={5} className="px-6 py-2 text-right text-xs text-[var(--text-muted)]">IVA (19.0%)</td>
                                        <td className="px-6 py-2 text-right text-xs text-[var(--text-muted)] font-semibold">{formatCLP(reportData.summary.totalCostClpIva)}</td>
                                    </tr>
                                    <tr className="border-t border-[var(--border-primary)] bg-[var(--brand-muted)]">
                                        <td colSpan={5} className="px-6 py-4 text-right font-bold text-base text-[var(--brand-text)]">TOTAL BRUTO A COBRAR (+IVA)</td>
                                        <td className="px-6 py-4 text-right font-bold text-base text-[var(--brand-text)]">{formatCLP(reportData.summary.totalCostClpGross)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* --- Printable PDF Layout --- */}
        {reportData && (
            <div className="hidden print:block print-container font-sans bg-white text-gray-800">
                <header className="flex justify-between items-start pb-4 border-b-2 border-gray-800">
                    <div className="flex items-center gap-4">
                        <IconCube className="w-10 h-10 text-gray-800"/>
                        <h1 className="text-2xl font-bold text-gray-900">REPORTE DE COBRO MENSUAL UF</h1>
                    </div>
                    <div className="text-right">
                        <h2 className="text-lg font-bold text-gray-800">{reportData.client.name.toUpperCase()}</h2>
                    </div>
                </header>

                <section className="my-6 grid grid-cols-2 gap-x-8 text-sm">
                    <div>
                        <h3 className="font-bold text-gray-500 uppercase tracking-wider text-xs mb-1">Cliente Facturado</h3>
                        <p className="font-bold text-gray-900 text-base">{reportData.client.name}</p>
                        {reportData.client.companyName && <p className="text-gray-700">{reportData.client.companyName}</p>}
                    </div>
                    <div className="text-right bg-gray-50 p-3 rounded-lg">
                        <p className="text-gray-500 text-xs">Período de Facturación:</p>
                        <p className="font-semibold text-gray-800">{month}/{year}</p>
                        <p className="text-gray-500 text-xs mt-2">UF al 1º del mes siguiente ({reportData.uf.date}):</p>
                        <p className="font-semibold text-gray-800">${reportData.uf.value?.toLocaleString('es-CL')} CLP</p>
                    </div>
                </section>

                <div className="bg-gray-100 p-4 rounded-lg mb-6 grid grid-cols-4 gap-4 text-center">
                    <div>
                        <span className="block text-gray-500 text-xs">Ingresados</span>
                        <span className="text-lg font-bold text-gray-900">{reportData.summary.totalCreated}</span>
                    </div>
                    <div>
                        <span className="block text-rose-600 text-xs font-semibold">Sin Procesar</span>
                        <span className="text-lg font-bold text-rose-600">{reportData.summary.totalAssignedToBodega}</span>
                    </div>
                    <div>
                        <span className="block text-emerald-700 text-xs font-semibold">Neto Despachados</span>
                        <span className="text-lg font-bold text-emerald-700">{reportData.summary.totalPackages}</span>
                    </div>
                    <div>
                        <span className="block text-gray-500 text-xs">Total Bruto CLP (+IVA)</span>
                        <span className="text-lg font-bold text-gray-900">{formatCLP(reportData.summary.totalCostClpGross)}</span>
                    </div>
                </div>

                <div className="border border-gray-300 rounded-lg p-4 mb-6 bg-gray-50 text-sm">
                    <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs mb-3 border-b pb-2">Detalle de Facturación (Formato Factura)</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p><span className="text-gray-500">Servicio:</span> <span className="font-semibold text-gray-800">Despacho de Envíos Mensuales</span></p>
                            <p><span className="text-gray-500">Tarifa Unitaria:</span> <span className="font-semibold text-gray-800">{reportData.summary.ratePerPackageUf} UF / envío</span></p>
                            <p><span className="text-gray-500">Envíos Cobrados:</span> <span className="font-semibold text-gray-800">{reportData.summary.totalPackages} despachos</span></p>
                            <p><span className="text-gray-500">Total UF Acumulado:</span> <span className="font-semibold text-gray-800">{reportData.summary.totalCostUf.toFixed(5)} UF</span></p>
                        </div>
                        <div className="space-y-1 text-right border-l pl-4">
                            <p><span className="text-gray-500">UF de Referencia:</span> <span className="font-semibold text-gray-800">${reportData.uf.value?.toLocaleString('es-CL')} CLP</span></p>
                            <p><span className="text-gray-500">Subtotal Neto:</span> <span className="font-semibold text-gray-800">{formatCLP(reportData.summary.totalCostClpNet)}</span></p>
                            <p><span className="text-gray-500">IVA (19%):</span> <span className="font-semibold text-gray-800">{formatCLP(reportData.summary.totalCostClpIva)}</span></p>
                            <div className="border-t pt-1 mt-2 text-base font-bold text-emerald-800">
                                <span>TOTAL FACTURA: {formatCLP(reportData.summary.totalCostClpGross)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <h3 className="font-bold text-gray-700 text-sm mb-2">Desglose Diario de Envíos</h3>
                <table className="w-full text-xs mb-6">
                    <thead className="bg-gray-200">
                        <tr>
                            <th className="p-2 text-left">Fecha</th>
                            <th className="p-2 text-center">Ingresados</th>
                            <th className="p-2 text-center">Sin Procesar / Excluidos</th>
                            <th className="p-2 text-center">Despachados (Facturables)</th>
                            <th className="p-2 text-right">Costo UF</th>
                            <th className="p-2 text-right">Costo Neto CLP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.dailyDetails.map((day: any) => (
                            <tr key={day.date} className="border-b border-gray-200">
                                <td className="p-2">{day.date}</td>
                                <td className="p-2 text-center">{day.totalCreated}</td>
                                <td className="p-2 text-center text-rose-600 font-semibold">{day.assignedToBodega}</td>
                                <td className="p-2 text-center text-emerald-700 font-bold">{day.packagesCount}</td>
                                <td className="p-2 text-right font-mono">{day.costUf.toFixed(6)}</td>
                                <td className="p-2 text-right">{formatCLP(day.costClp)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold text-xs">
                        <tr className="border-t-2 border-gray-400">
                            <td className="p-2 text-right">TOTALES</td>
                            <td className="p-2 text-center">{reportData.summary.totalCreated}</td>
                            <td className="p-2 text-center text-rose-600">{reportData.summary.totalAssignedToBodega}</td>
                            <td className="p-2 text-center text-emerald-700">{reportData.summary.totalPackages}</td>
                            <td className="p-2 text-right font-mono">{reportData.summary.totalCostUf.toFixed(5)} UF</td>
                            <td className="p-2 text-right">{formatCLP(reportData.summary.totalCostClpNet)}</td>
                        </tr>
                        <tr>
                            <td colSpan={5} className="p-2 text-right text-gray-500 font-medium">IVA (19.0%)</td>
                            <td className="p-2 text-right text-gray-500 font-medium">{formatCLP(reportData.summary.totalCostClpIva)}</td>
                        </tr>
                        <tr className="border-t-2 border-gray-500 bg-gray-100 text-sm">
                            <td colSpan={5} className="p-3 text-right font-bold text-gray-900">TOTAL BRUTO FACTURA (+IVA)</td>
                            <td className="p-3 text-right font-bold text-gray-900">{formatCLP(reportData.summary.totalCostClpGross)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        )}
        </>
    );
};

export default SuperAdminBillingReportPage;
