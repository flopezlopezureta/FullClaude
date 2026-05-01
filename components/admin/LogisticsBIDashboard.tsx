import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { 
  IconRefresh, 
  IconTrendingUp, 
  IconClock, 
  IconAward, 
  IconCalendar,
  IconChevronDown,
  IconChevronUp,
  IconZap,
  IconCheckCircle,
  IconAlertTriangle,
  IconLoader,
  IconUser,
  IconBarChart,
  IconTruck
} from '../Icon';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell
} from 'recharts';
import OperationalTimer from '../OperationalTimer';

interface FleetDriverStatus {
  driver_id: number;
  driver_name: string;
  total_packages: number;
  delivered_packages: number;
  pending_packages: number;
  is_completed: boolean;
  last_update: string;
}

interface AnalyticsData {
  hourly_flow: Array<{ hour: string; count: number }>;
  driver_efficiency: Array<{ 
    name: string; 
    delivered: number; 
    avg_minutes: number;
    efficiency_score: number;
  }>;
  summary: {
    total_delivered: number;
    avg_delivery_time: number;
    top_driver: string;
    efficiency_trend: string;
  };
}

const LogisticsBIDashboard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAutoDate, setIsAutoDate] = useState(true);
  const [fleet, setFleet] = useState<FleetDriverStatus[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Intelligent Date logic: Check if there's activity today
  useEffect(() => {
    const checkTodayActivity = async () => {
      if (!isAutoDate) return;
      
      try {
        const today = new Date().toISOString().split('T')[0];
        const fleetData = await api.getFleetStatus(today);
        
        // If no one is in route and no deliveries made today, switch to yesterday
        const totalDeliveriesToday = fleetData.reduce((sum: number, d: any) => sum + d.delivered_packages, 0);
        
        if (totalDeliveriesToday === 0 && fleetData.length === 0) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          if (selectedDate !== yesterdayStr) {
            setSelectedDate(yesterdayStr);
          }
        } else {
          if (selectedDate !== today) {
            setSelectedDate(today);
          }
        }
      } catch (error) {
        console.error("Error checking today's activity:", error);
      }
    };

    checkTodayActivity();
    
    // Periodically check if today's operation started (every 2 mins)
    const interval = setInterval(checkTodayActivity, 120000);
    return () => clearInterval(interval);
  }, [isAutoDate, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fleetData, analyticsData] = await Promise.all([
        api.getFleetStatus(selectedDate),
        api.getAnalytics(selectedDate)
      ]);
      setFleet(fleetData);
      setAnalytics(analyticsData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching BI data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30s if viewing today
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    let interval: any;
    if (isToday) {
      interval = setInterval(fetchData, 30000);
    }
    return () => clearInterval(interval);
  }, [selectedDate]);

  const stats = useMemo(() => {
    const inRoute = fleet.filter(d => !d.is_completed).length;
    const finished = fleet.filter(d => d.is_completed).length;
    const totalPending = fleet.reduce((sum, d) => sum + d.pending_packages, 0);
    return { inRoute, finished, totalPending };
  }, [fleet]);

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <IconBarChart className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Análisis Logístico BI</h2>
            <p className="text-xs text-gray-500">Inteligencia de flota en tiempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <IconCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setIsAutoDate(false);
              }}
              className="pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button 
            onClick={fetchData}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refrescar datos"
          >
            <IconRefresh className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Operational Pulse & Clock */}
      <OperationalTimer />

      {/* Real-time Fleet Monitor Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fleet Summary Cards */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 dark:text-white">Estado de Flota</h3>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full animate-pulse">EN VIVO</span>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <IconTruck className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium">En Ruta</span>
                </div>
                <span className="text-xl font-bold text-blue-700">{stats.inRoute}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <IconCheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium">Finalizados</span>
                </div>
                <span className="text-xl font-bold text-emerald-700">{stats.finished}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <IconAlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium">Paquetes Pendientes</span>
                </div>
                <span className="text-xl font-bold text-amber-700">{stats.totalPending}</span>
              </div>
            </div>
          </div>

          {/* Efficiency Pulse */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
            <div className="flex items-center justify-between mb-6">
              <IconZap className="w-8 h-8 text-yellow-300" />
              <div className="text-right">
                <p className="text-xs opacity-80 uppercase font-bold tracking-wider">Pulso de Operación</p>
                <p className="text-xl font-black">ÓPTIMO</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Eficiencia de Entrega</span>
                <span>94%</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400" style={{ width: '94%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Detail List */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 dark:text-white">Detalle por Conductor</h3>
            <div className="flex gap-2">
               <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div> En Ruta
               </div>
               <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Finalizado
               </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50/50 dark:bg-gray-900/50">
                  <th className="px-6 py-3 font-bold">Conductor</th>
                  <th className="px-6 py-3 font-bold">Progreso</th>
                  <th className="px-6 py-3 font-bold">Entregados</th>
                  <th className="px-6 py-3 font-bold text-amber-600">Pendientes</th>
                  <th className="px-6 py-3 font-bold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {fleet.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                      No hay actividad registrada para esta fecha
                    </td>
                  </tr>
                ) : fleet.map((driver) => {
                  const progress = (driver.delivered_packages / driver.total_packages) * 100 || 0;
                  return (
                    <tr key={driver.driver_id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            <IconUser className="w-4 h-4 text-gray-500" />
                          </div>
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{driver.driver_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-32">
                          <div className="flex justify-between text-[10px] mb-1">
                            <span>{Math.round(progress)}%</span>
                            <span>{driver.total_packages} pqts</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ${driver.is_completed ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">
                        {driver.delivered_packages}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-amber-600">
                        {driver.pending_packages}
                      </td>
                      <td className="px-6 py-4">
                        {driver.is_completed ? (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">FINALIZADO</span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md">EN RUTA</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Advanced Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Flow Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white text-lg">Flujo de Entregas por Hora</h3>
              <p className="text-xs text-gray-400">Volumen de paquetes procesados</p>
            </div>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <IconTrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.hourly_flow || []}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="hour" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                  name="Paquetes"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Driver Efficiency Ranking */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white text-lg">Ranking de Eficiencia</h3>
              <p className="text-xs text-gray-400">Promedio de tiempo entre entregas</p>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <IconAward className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.driver_efficiency || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 'bold' }} 
                  width={100}
                />
                <Tooltip 
                   cursor={{ fill: '#f8fafc' }}
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="efficiency_score" radius={[0, 4, 4, 0]} name="Puntaje de Eficiencia">
                  {(analytics?.driver_efficiency || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-4">
             <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <p className="text-[10px] text-gray-400 uppercase font-bold">Mejor Promedio</p>
                <p className="text-sm font-black text-emerald-600">{analytics?.summary.top_driver || '-'}</p>
             </div>
             <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <p className="text-[10px] text-gray-400 uppercase font-bold">Tiempo Global</p>
                <p className="text-sm font-black text-indigo-600">{analytics?.summary.avg_delivery_time || 0} min/paquete</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsBIDashboard;
