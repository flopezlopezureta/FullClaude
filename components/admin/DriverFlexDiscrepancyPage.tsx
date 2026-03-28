
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { IconRefresh, IconAlertTriangle, IconTruck, IconCheckCircle, IconSearch, IconX, IconPackage } from '../Icon';

interface DiscrepancyData {
    driverId: string;
    driverName: string;
    totalAssigned: string | number;
    totalFlexed: string | number;
    totalUnflexed: string | number;
}

interface PackageDetail {
    id: string;
    recipientName: string;
    recipientAddress: string;
    recipientCommune: string;
    status: string;
    meliOrderId?: string;
    trackingId?: string;
}

const DriverFlexDiscrepancyPage: React.FC = () => {
    const [data, setData] = useState<DiscrepancyData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDriver, setSelectedDriver] = useState<DiscrepancyData | null>(null);
    const [details, setDetails] = useState<PackageDetail[]>([]);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => {
            fetchData(true); // silent fetch
        }, 30000); // 30 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const reportData = await api.getFlexDiscrepancies();
            setData(reportData);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Failed to fetch discrepancy data", error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const handleDriverClick = async (driver: DiscrepancyData) => {
        if (Number(driver.totalUnflexed) === 0) return;
        setSelectedDriver(driver);
        setIsDetailsLoading(true);
        try {
            const detailData = await api.getDriverFlexDiscrepancyDetails(driver.driverId);
            setDetails(detailData);
        } catch (error) {
            console.error("Failed to fetch driver discrepancy details", error);
        } finally {
            setIsDetailsLoading(false);
        }
    };

    const filteredData = data.filter(item => 
        item.driverName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalUnflexed = data.reduce((sum, item) => sum + Number(item.totalUnflexed), 0);

    return (
        <div className="space-y-6">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[var(--background-secondary)] p-6 rounded-xl border border-[var(--border-primary)] shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--text-muted)]">Paquetes sin Flexear Hoy</p>
                            <p className={`text-3xl font-bold ${totalUnflexed > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {totalUnflexed}
                            </p>
                        </div>
                        <div className={`p-3 rounded-lg ${totalUnflexed > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {totalUnflexed > 0 ? <IconAlertTriangle className="w-6 h-6" /> : <IconCheckCircle className="w-6 h-6" />}
                        </div>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">Paquetes asignados que no han pasado por el escáner de bodega.</p>
                </div>

                <div className="bg-[var(--background-secondary)] p-6 rounded-xl border border-[var(--border-primary)] shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--text-muted)]">Conductores con Carga</p>
                            <p className="text-3xl font-bold text-[var(--text-primary)]">
                                {data.length}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                            <IconTruck className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--background-secondary)] p-6 rounded-xl border border-[var(--border-primary)] shadow-sm flex flex-col justify-center">
                    <button 
                        onClick={() => fetchData()}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-secondary)] transition-colors disabled:opacity-50"
                    >
                        <IconRefresh className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Actualizando...' : 'Actualizar Reporte'}
                    </button>
                    <p className="mt-2 text-[10px] text-center text-[var(--text-muted)] italic">
                        Última actualización: {lastUpdated.toLocaleTimeString()} (Auto-refresh 30s)
                    </p>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-[var(--background-secondary)] rounded-xl border border-[var(--border-primary)] shadow-sm overflow-hidden">
                <div className="p-4 border-b border-[var(--border-primary)] flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Discrepancias por Conductor</h2>
                    <div className="relative w-full sm:w-64">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                            <IconSearch className="w-4 h-4" />
                        </span>
                        <input 
                            type="text" 
                            placeholder="Buscar conductor..."
                            className="w-full pl-10 pr-4 py-2 bg-[var(--background-primary)] border border-[var(--border-secondary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--background-muted)] text-[var(--text-muted)] text-xs uppercase tracking-wider font-semibold">
                            <tr>
                                <th className="px-6 py-4">Conductor</th>
                                <th className="px-6 py-4 text-center">Asignados</th>
                                <th className="px-6 py-4 text-center">Flexeados</th>
                                <th className="px-6 py-4 text-center">Pendientes de Flex</th>
                                <th className="px-6 py-4 text-right">Estado Crítico</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-primary)]">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-4 h-16 bg-[var(--background-primary)] opacity-50"></td>
                                    </tr>
                                ))
                            ) : filteredData.length > 0 ? (
                                filteredData.map((item) => {
                                    const unflexed = Number(item.totalUnflexed);
                                    const isCritical = unflexed > 0;
                                    const progress = (Number(item.totalFlexed) / Number(item.totalAssigned)) * 100 || 0;

                                    return (
                                        <tr 
                                            key={item.driverId} 
                                            className={`${unflexed > 0 ? 'cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10' : 'hover:bg-[var(--background-hover)]'} transition-colors`}
                                            onClick={() => handleDriverClick(item)}
                                        >
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-[var(--text-primary)]">{item.driverName}</p>
                                                <div className="mt-1 w-32 h-1.5 bg-[var(--background-muted)] rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-[var(--text-primary)] font-medium">
                                                {item.totalAssigned}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                                    {item.totalFlexed}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${unflexed > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {unflexed}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isCritical ? (
                                                    <span className="inline-flex items-center text-red-600 text-sm font-bold animate-pulse">
                                                        <IconAlertTriangle className="w-4 h-4 mr-1" />
                                                        FUGA DETECTADA
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center text-green-600 text-sm font-medium">
                                                        <IconCheckCircle className="w-4 h-4 mr-1" />
                                                        Listo
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-[var(--text-muted)]">
                                        No se encontraron conductores con carga para hoy.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <IconAlertTriangle className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-blue-700">
                            <strong>Nota Técnica:</strong> Este reporte compara paquetes con estado <code>ASIGNADO</code> cuya fecha de entrega estimada es <strong>HOY</strong> contra aquellos que ya tienen la marca <code>isFlexed = true</code>. Los paquetes en "Fuga" son aquellos que el conductor lleva en su hoja de ruta pero no escaneó individualmente en bodega. Haz clic en un conductor para ver el detalle de los paquetes pendientes.
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal de Detalle */}
            {selectedDriver && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all">
                    <div className="bg-[var(--background-secondary)] rounded-2xl shadow-2xl border border-[var(--border-primary)] w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--brand-primary)] text-white rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <IconTruck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Detalle de Discrepancias</h3>
                                    <p className="text-blue-100 text-sm">{selectedDriver.driverName} — {selectedDriver.totalUnflexed} paquetes fugados</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedDriver(null)}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <IconX className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[var(--border-secondary)]">
                            {isDetailsLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                    <IconRefresh className="w-10 h-10 text-[var(--brand-primary)] animate-spin" />
                                    <p className="text-[var(--text-muted)] animate-pulse">Cargando lista de paquetes...</p>
                                </div>
                            ) : details.length > 0 ? (
                                <div className="space-y-4">
                                    {details.map((pkg) => (
                                        <div key={pkg.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[var(--background-primary)] border border-[var(--border-secondary)] rounded-xl hover:border-[var(--brand-primary)] transition-all group">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 p-2 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">
                                                    <IconPackage className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">{pkg.recipientName}</p>
                                                    <p className="text-sm text-[var(--text-muted)] mt-0.5">{pkg.recipientAddress}, {pkg.recipientCommune}</p>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {pkg.meliOrderId && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-mono">MeLi: {pkg.meliOrderId}</span>}
                                                        {pkg.trackingId && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">Track: {pkg.trackingId}</span>}
                                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">ID: {pkg.id}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4 sm:mt-0 flex flex-col items-end gap-2">
                                                <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 uppercase tracking-tighter">No Escaneado</span>
                                                <p className="text-[10px] text-[var(--text-muted)] italic">Estado: {pkg.status}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20">
                                    <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <IconCheckCircle className="w-10 h-10" />
                                    </div>
                                    <h4 className="text-lg font-bold text-[var(--text-primary)]">¡Todo listo!</h4>
                                    <p className="text-[var(--text-muted)] mt-1">No hay paquetes pendientes de flexear para este conductor.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--background-muted)] flex justify-end rounded-b-2xl">
                            <button 
                                onClick={() => setSelectedDriver(null)}
                                className="px-6 py-2 bg-white border border-[var(--border-primary)] text-[var(--text-primary)] font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverFlexDiscrepancyPage;
