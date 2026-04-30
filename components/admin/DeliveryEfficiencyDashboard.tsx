import React, { useState, useEffect, useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { IconRefresh, IconClock, IconTrendingUp, IconTarget, IconBarChart, IconPieChart } from '../Icon';
import { getLocalDateString } from '../../utils/dateUtils';

interface HourlyData {
    hour: number;
    count: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const DeliveryEfficiencyDashboard: React.FC = () => {
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [endDate, setEndDate] = useState(getLocalDateString());
    const [data, setData] = useState<HourlyData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/packages/analytics/delivery-hours?startDate=${startDate}&endDate=${endDate}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const result = await response.json();
            if (response.ok) {
                setData(result);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const stats = useMemo(() => {
        const total = data.reduce((acc, curr) => acc + curr.count, 0);
        const peakHour = [...data].sort((a, b) => b.count - a.count)[0];
        
        // Distribution (Morning: 6-12, Afternoon: 12-18, Night: 18-00)
        const morning = data.filter(d => d.hour >= 6 && d.hour < 12).reduce((acc, curr) => acc + curr.count, 0);
        const afternoon = data.filter(d => d.hour >= 12 && d.hour < 18).reduce((acc, curr) => acc + curr.count, 0);
        const evening = data.filter(d => d.hour >= 18 || d.hour < 6).reduce((acc, curr) => acc + curr.count, 0);

        const pieData = [
            { name: 'Mañana (6-12h)', value: morning },
            { name: 'Tarde (12-18h)', value: afternoon },
            { name: 'Noche (18-6h)', value: evening }
        ].filter(d => d.value > 0);

        return { total, peakHour, pieData };
    }, [data]);

    const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`;

    return (
        <div className="space-y-6">
            {/* Header / KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all hover:shadow-md">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><IconTarget className="w-8 h-8"/></div>
                    <div>
                        <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total Entregados</p>
                        <p className="text-3xl font-black text-gray-900">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all hover:shadow-md">
                    <div className="p-4 bg-amber-50 text-amber-600 rounded-xl"><IconClock className="w-8 h-8"/></div>
                    <div>
                        <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Hora de Mayor Actividad</p>
                        <p className="text-3xl font-black text-gray-900">{stats.peakHour ? formatHour(stats.peakHour.hour) : '--:--'}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all hover:shadow-md">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><IconTrendingUp className="w-8 h-8"/></div>
                    <div>
                        <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Eficiencia Promedio</p>
                        <p className="text-3xl font-black text-gray-900">{(stats.total / (data.filter(d => d.count > 0).length || 1)).toFixed(1)} <span className="text-xs font-normal">pqts/hr</span></p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rango de Análisis</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-gray-300">→</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>
                <button 
                    onClick={fetchData}
                    disabled={isLoading}
                    className="px-8 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all flex items-center gap-2 shadow-lg shadow-gray-200"
                >
                    <IconRefresh className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}/>
                    Actualizar Reporte
                </button>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Bar Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <IconBarChart className="w-5 h-5 text-blue-600"/>
                            Volumen de Entregas por Hora
                        </h3>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="hour" 
                                    tickFormatter={formatHour}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                />
                                <YAxis 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                    labelFormatter={formatHour}
                                />
                                <Bar 
                                    dataKey="count" 
                                    fill="#3b82f6" 
                                    radius={[4, 4, 0, 0]} 
                                    barSize={20}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Chart / Distribution */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <IconPieChart className="w-5 h-5 text-emerald-600"/>
                            Distribución de Carga por Jornada
                        </h3>
                    </div>
                    <div className="h-[350px] w-full flex flex-col items-center justify-center">
                        {stats.pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={5}
                                        dataKey="value"
                                        animationDuration={1500}
                                    >
                                        {stats.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-gray-300 font-bold">Sin datos para graficar</div>
                        )}
                        <div className="flex gap-4 mt-4">
                            {stats.pieData.map((d, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                                    <span className="text-xs font-bold text-gray-500">{d.name} ({d.value})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Insights Section */}
            <div className="bg-gray-900 p-8 rounded-3xl text-white overflow-hidden relative">
                <div className="relative z-10">
                    <h3 className="text-xl font-black mb-4">Análisis de Eficiencia Logística</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-gray-400">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center shrink-0 mt-1">1</div>
                                <p className="text-sm">Tu ventana de mayor éxito es a las <span className="text-white font-bold">{stats.peakHour ? formatHour(stats.peakHour.hour) : '--:--'}</span>. Considera programar más rutas para que los conductores estén en la calle 1 hora antes de este pico.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shrink-0 mt-1">2</div>
                                <p className="text-sm">Se han procesado <span className="text-white font-bold">{stats.total} entregas</span> en el periodo seleccionado con un promedio constante de <span className="text-white font-bold">{(stats.total / (data.filter(d => d.count > 0).length || 1)).toFixed(1)} paquetes</span> por hora activa.</p>
                            </div>
                        </div>
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                            <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-widest">Recomendación Estratégica</h4>
                            <p className="text-xs leading-relaxed italic">
                                "Para mejorar la rentabilidad, observa los baches en el gráfico de barras. Si hay horas con 0 entregas entre las 10:00 y las 14:00, indica un retraso en el despacho matutino o una mala planificación de rutas en esa zona."
                            </p>
                        </div>
                    </div>
                </div>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/10 blur-[100px] -ml-32 -mb-32"></div>
            </div>
        </div>
    );
};

export default DeliveryEfficiencyDashboard;
