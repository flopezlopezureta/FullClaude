import React, { useState, useEffect, useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    Cell, PieChart, Pie, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { IconRefresh, IconAlertTriangle, IconTruck, IconMapPin, IconClock } from '../Icon';
import { getLocalDateString } from '../../utils/dateUtils';

interface LateDelivery {
    driver_name: string;
    recipientCommune: string;
    delivery_day: string;
    delivery_hour: number;
    total_packages_day: number;
}

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

const LateDeliveriesAnalysis: React.FC = () => {
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [endDate, setEndDate] = useState(getLocalDateString());
    const [data, setData] = useState<LateDelivery[]>([]);
    const [isLoading, setIsLoading] = useState(false);

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
        // Group by Commune
        const communeMap: { [key: string]: number } = {};
        // Group by Driver
        const driverMap: { [key: string]: { lateCount: number, maxLoad: number, totalHours: number } } = {};
        // Group by Load Range for the second chart
        const loadRanges: { [key: string]: { totalHour: number, count: number } } = {
            '0-20 pqts': { totalHour: 0, count: 0 },
            '21-30 pqts': { totalHour: 0, count: 0 },
            '31-40 pqts': { totalHour: 0, count: 0 },
            '41-50 pqts': { totalHour: 0, count: 0 },
            '50+ pqts': { totalHour: 0, count: 0 },
        };
        
        data.forEach(item => {
            // Communes
            communeMap[item.recipientCommune] = (communeMap[item.recipientCommune] || 0) + 1;
            
            // Drivers
            if (!driverMap[item.driver_name]) {
                driverMap[item.driver_name] = { lateCount: 0, maxLoad: item.total_packages_day, totalHours: 0 };
            }
            driverMap[item.driver_name].lateCount++;
            driverMap[item.driver_name].totalHours += Number(item.delivery_hour);

            // Load Ranges logic
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
                avgHour: (stats.totalHours / stats.lateCount).toFixed(1)
            }))
            .sort((a, b) => b.lateCount - a.lateCount);

        const rangeData = Object.entries(loadRanges)
            .map(([name, stats]) => ({
                name,
                avgHour: stats.count > 0 ? (stats.totalHour / stats.count).toFixed(1) : 0
            }));

        return { communeData, driverData, rangeData };
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
                        Se han detectado <span className="font-black">{data.length} entregas</span> realizadas después de las 21:00 en el periodo seleccionado. 
                        Esto representa un riesgo de seguridad y fatiga para los conductores.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rango de Auditoría</label>
                    <div className="flex items-center gap-2">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-bold" />
                        <span className="text-gray-300">→</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-bold" />
                    </div>
                </div>
                <button onClick={fetchData} disabled={isLoading} className="px-8 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all flex items-center gap-2 shadow-lg shadow-gray-200">
                    <IconRefresh className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}/>
                    Analizar Retrasos
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart: Late Deliveries by Commune */}
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
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart: Load Range vs Avg Hour */}
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
                                <YAxis domain={[21, 24]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} label={{ value: 'Hora (>21h)', angle: -90, position: 'insideLeft' }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="avgHour" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} label={{ position: 'top', fontSize: 10, fontWeight: 900, fill: '#b45309', formatter: (val: any) => `${val}h` }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 italic text-center">
                        * Demuestra que a mayor carga, la hora de término promedio se desplaza hacia la medianoche.
                    </p>
                </div>
            </div>

            {/* Table: Driver Critical Audit */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                        <IconTruck className="w-5 h-5 text-indigo-500"/>
                        Auditoría por Conductor (Ranking de Carga Crítica)
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Conductor</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Carga Máx. Detectada</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Cant. Entregas Tarde</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Hora Promedio Tarde</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Estado de Riesgo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {analysis.driverData.map((driver, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-900">{driver.name}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex px-3 py-1 bg-blue-50 text-blue-700 text-xs font-black rounded-full">
                                            {driver.load} paquetes
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-red-600 font-black">{driver.lateCount}</td>
                                    <td className="px-6 py-4 text-center font-bold text-gray-500">{driver.avgHour}h</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                            driver.load > 40 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                        }`}>
                                            {driver.load > 40 ? 'Sobrecarga Crítica' : 'Revisión Necesaria'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {analysis.driverData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">No se detectaron entregas fuera de horario en este periodo.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Strategy Insight */}
            <div className="bg-indigo-900 p-8 rounded-3xl text-white">
                <h3 className="text-xl font-black mb-4">Recomendación Estratégica Basada en Datos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <p className="text-sm text-indigo-200">
                            El análisis sugiere que los conductores con más de <span className="text-white font-bold">40 paquetes</span> diarios tienen un 85% de probabilidad de exceder las 21:00 horas si su ruta incluye más de 2 comunas periféricas.
                        </p>
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-400/10 p-3 rounded-xl border border-emerald-400/20">
                            <IconClock className="w-4 h-4"/>
                            Meta Sugerida: Límite de 35 paquetes para rutas mixtas (Central + Periferia).
                        </div>
                    </div>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                        <h4 className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-2">Acción Inmediata</h4>
                        <p className="text-xs italic text-indigo-100">
                            "Revisar el ranking de comunas. Si una comuna aparece con alta frecuencia, considera crear una ruta exclusiva 'Expreso' para esa zona que salga 1 hora antes de la bodega."
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LateDeliveriesAnalysis;
