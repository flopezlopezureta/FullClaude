import React, { useState, useEffect, useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { IconRefresh, IconAlertTriangle, IconTruck, IconMapPin, IconClock, IconUser, IconCheck } from '../Icon';
import { getLocalDateString } from '../../utils/dateUtils';

interface LateDelivery {
    driver_name: string;
    seller_name: string;
    recipientCommune: string;
    delivery_day: string;
    delivery_hour: number;
    total_packages_day: number;
    first_delivery_hour: number;
    last_delivery_hour: number;
    meli_delivered_hour: number | null;
}

const formatDecimalHour = (decimalHour: number | string | null) => {
    if (decimalHour === null) return '--:--';
    const num = Number(decimalHour);
    if (isNaN(num)) return '--:--';
    const hours = Math.floor(num);
    const minutes = Math.round((num - hours) * 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

const LateDeliveriesAnalysis: React.FC = () => {
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [endDate, setEndDate] = useState(getLocalDateString());
    const [data, setData] = useState<LateDelivery[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'logistics' | 'sellers'>('logistics');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/packages/analytics/late-deliveries?startDate=${startDate}&endDate=${endDate}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const result = await response.json();
            if (response.ok) {
                setData(result);
            }
        } catch (error) {
            console.error('Error fetching late deliveries:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const analysis = useMemo(() => {
        const communeMap: { [key: string]: number } = {};
        const driverMap: { [key: string]: { lateCount: number, maxLoad: number, totalHours: number, firstHour: number, lastHour: number, maxGap: number, meliHour: number | null } } = {};
        const sellerMap: { [key: string]: { lateCount: number, topCommune: string, communes: {[key: string]: number}, topDriver: string, drivers: {[key: string]: number} } } = {};
        
        const loadRanges: { [key: string]: { totalHour: number, count: number } } = {
            '0-20 pqts': { totalHour: 0, count: 0 },
            '21-30 pqts': { totalHour: 0, count: 0 },
            '31-40 pqts': { totalHour: 0, count: 0 },
            '41-50 pqts': { totalHour: 0, count: 0 },
            '50+ pqts': { totalHour: 0, count: 0 },
        };
        
        data.forEach(item => {
            const normalizedCommune = (item.recipientCommune || 'SIN COMUNA').trim().toUpperCase();
            communeMap[normalizedCommune] = (communeMap[normalizedCommune] || 0) + 1;
            
            if (!driverMap[item.driver_name]) {
                driverMap[item.driver_name] = { 
                    lateCount: 0, 
                    maxLoad: item.total_packages_day, 
                    totalHours: 0,
                    firstHour: item.first_delivery_hour,
                    lastHour: item.last_delivery_hour,
                    maxGap: 0,
                    meliHour: null
                };
            }
            driverMap[item.driver_name].lateCount++;
            driverMap[item.driver_name].totalHours += Number(item.delivery_hour);

            // Calculate Gap (Fraud Detection)
            if (item.meli_delivered_hour) {
                const gap = (Number(item.delivery_hour) - Number(item.meli_delivered_hour)) * 60; // in minutes
                if (gap > driverMap[item.driver_name].maxGap) {
                    driverMap[item.driver_name].maxGap = gap;
                    driverMap[item.driver_name].meliHour = item.meli_delivered_hour;
                }
            }

            // Sellers mapping
            const sName = item.seller_name || 'Sin Seller';
            if (!sellerMap[sName]) {
                sellerMap[sName] = { lateCount: 0, topCommune: '', communes: {}, topDriver: '', drivers: {} };
            }
            sellerMap[sName].lateCount++;
            sellerMap[sName].communes[normalizedCommune] = (sellerMap[sName].communes[normalizedCommune] || 0) + 1;
            sellerMap[sName].drivers[item.driver_name] = (sellerMap[sName].drivers[item.driver_name] || 0) + 1;

            let range = '50+ pqts';
            if (item.total_packages_day <= 20) range = '0-20 pqts';
            else if (item.total_packages_day <= 30) range = '21-30 pqts';
            else if (item.total_packages_day <= 40) range = '31-40 pqts';
            else if (item.total_packages_day <= 50) range = '41-50 pqts';

            loadRanges[range].totalHour += Number(item.delivery_hour);
            loadRanges[range].count++;
        });

        const communeData = Object.entries(communeMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        const driverData = Object.entries(driverMap)
            .map(([name, stats]) => ({ 
                name, 
                lateCount: stats.lateCount, 
                load: stats.maxLoad,
                avgHour: (stats.totalHours / stats.lateCount).toFixed(1),
                firstHour: stats.firstHour,
                lastHour: stats.lastHour,
                maxGap: Math.round(stats.maxGap),
                meliHour: stats.meliHour
            }))
            .sort((a, b) => b.lateCount - a.lateCount);

        const sellerData = Object.entries(sellerMap)
            .map(([name, stats]) => {
                const topCommune = Object.entries(stats.communes).sort((a,b) => b[1]-a[1])[0][0];
                const topDriver = Object.entries(stats.drivers).sort((a,b) => b[1]-a[1])[0][0];
                return { name, lateCount: stats.lateCount, topCommune, topDriver };
            })
            .sort((a, b) => b.lateCount - a.lateCount);

        const rangeData = Object.entries(loadRanges)
            .map(([name, stats]) => ({
                name,
                avgHour: stats.count > 0 ? (stats.totalHour / stats.count).toFixed(1) : 0
            }));

        return { communeData, driverData, rangeData, sellerData };
    }, [data]);

    return (
        <div className="space-y-6">
            {/* Warning Banner */}
            <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-2xl flex items-center gap-4">
                <div className="p-3 bg-red-100 text-red-600 rounded-full">
                    <IconAlertTriangle className="w-8 h-8"/>
                </div>
                <div>
                    <h3 className="text-lg font-black text-red-900">Alerta de Cumplimiento Logístico</h3>
                    <p className="text-sm text-red-700 font-medium">
                        Se han detectado <span className="font-black">{data.length} entregas</span> después de las 21:00. Riesgo crítico para la reputación de los Sellers.
                    </p>
                </div>
            </div>

            {/* Filters & Tabs */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('logistics')} className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${activeTab === 'logistics' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Auditoría Logística
                    </button>
                    <button onClick={() => setActiveTab('sellers')} className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${activeTab === 'sellers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        Impacto en Sellers
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold" />
                        <span className="text-gray-300">→</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold" />
                    </div>
                    <button onClick={fetchData} disabled={isLoading} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold text-xs hover:bg-gray-800 flex items-center gap-2 transition-all">
                        <IconRefresh className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`}/>
                        Actualizar
                    </button>
                </div>
            </div>

            {activeTab === 'logistics' ? (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                                <IconMapPin className="w-5 h-5 text-red-500"/>
                                Top 10 Comunas con Entregas Tardías
                            </h3>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analysis.communeData} layout="vertical" margin={{ left: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} width={100} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                        <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                                <IconClock className="w-5 h-5 text-amber-500"/>
                                Hora Promedio de Término según Carga
                            </h3>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analysis.rangeData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                        <YAxis domain={[21, 24]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                        <Bar dataKey="avgHour" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} label={{ position: 'top', fontSize: 10, fontWeight: 900, fill: '#b45309', formatter: (val: any) => formatDecimalHour(val) }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <IconTruck className="w-5 h-5 text-indigo-500"/>
                                Auditoría por Conductor (Carga Crítica)
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Conductor</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Carga Máx.</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Cant. Tarde</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Primera Entrega</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Última (App)</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Cierre ML</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Brecha (Min)</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {analysis.driverData.map((driver, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors text-sm">
                                            <td className="px-6 py-4 font-bold text-gray-900">{driver.name}</td>
                                            <td className="px-6 py-4 text-center font-bold text-blue-600">{driver.load}</td>
                                            <td className="px-6 py-4 text-center text-red-600 font-black">{driver.lateCount}</td>
                                            <td className="px-6 py-4 text-center text-gray-400">{formatDecimalHour(driver.firstHour)}</td>
                                            <td className="px-6 py-4 text-center font-black text-gray-900">{formatDecimalHour(driver.lastHour)}</td>
                                            <td className="px-6 py-4 text-center text-emerald-600 font-bold">{formatDecimalHour(driver.meliHour)}</td>
                                            <td className="px-6 py-4 text-center">
                                                {driver.maxGap > 30 ? (
                                                    <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-[10px] font-black">
                                                        +{driver.maxGap} min
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 font-bold">{driver.maxGap || 0}m</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${driver.maxGap > 60 ? 'bg-purple-100 text-purple-600' : (driver.load > 40 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')}`}>
                                                    {driver.maxGap > 60 ? 'Posible Maquillaje' : (driver.load > 40 ? 'Crítico' : 'Revisión')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <IconUser className="w-5 h-5 text-emerald-500"/>
                            Ranking de Sellers Afectados por Retrasos
                        </h3>
                        <p className="text-xs text-gray-400 mt-1 font-medium">Identifica qué clientes están perdiendo reputación debido a entregas fuera de horario.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Seller (Vendedor)</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Paquetes con Retraso</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Comuna con más Problemas</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Conductor Responsable Principal</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Acción Sugerida</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {analysis.sellerData.map((seller, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors text-sm">
                                        <td className="px-6 py-4 font-black text-gray-900">{seller.name}</td>
                                        <td className="px-6 py-4 text-center text-red-600 font-black">{seller.lateCount}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-[10px] font-black rounded-lg uppercase">
                                                {seller.topCommune}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-gray-500">{seller.topDriver}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Ver Detalle</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LateDeliveriesAnalysis;
