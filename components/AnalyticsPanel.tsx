
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, Cell 
} from 'recharts';
import { IconRefresh, IconTrendingUp, IconClock, IconAward, IconChevronDown, IconChevronUp } from './Icon';

const AnalyticsPanel: React.FC = () => {
  const [data, setData] = useState<{ hourly: any[], ranking: any[] }>({ hourly: [], ranking: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const result = await api.getAnalytics();
      setData(result);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Process hourly data for Chart (Fill missing hours)
  const chartData = Array.from({ length: 14 }, (_, i) => {
    const hour = i + 8; // From 8 AM to 9 PM
    const hourStr = `${hour}:00`;
    const hourData = data.hourly.filter(d => parseInt(d.hour) === hour);
    const total = hourData.reduce((acc, curr) => acc + curr.count, 0);
    return { hour: hourStr, entregas: total };
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="mb-6 overflow-hidden bg-white border border-gray-200 rounded-2xl shadow-sm transition-all hover:shadow-md">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-xl backdrop-blur-md">
            <IconTrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Centro de Estadísticas Avanzadas</h2>
            <p className="text-[10px] font-bold text-blue-100 uppercase mt-0.5">Rendimiento y Productividad Diaria</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); fetchAnalytics(); }}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <IconRefresh className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isExpanded ? <IconChevronUp className="w-5 h-5 text-white/40" /> : <IconChevronDown className="w-5 h-5 text-white/40" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 bg-gray-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Hourly Productivity Chart */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <IconClock className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Entregas por Hora (Hoy)</h3>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorEntregas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="hour" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} 
                    />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px'}}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="entregas" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorEntregas)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Drivers Ranking */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <IconAward className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Ranking de Productividad</h3>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ranking.slice(0, 6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="driverName" 
                      type="category" 
                      width={100} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 9, fontWeight: 'bold', fill: '#475569'}}
                    />
                    <Tooltip 
                       cursor={{fill: '#f8fafc'}}
                       contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px'}}
                    />
                    <Bar dataKey="deliveredCount" radius={[0, 4, 4, 0]} barSize={20}>
                      {data.ranking.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Detailed Table (Average Times) */}
          <div className="mt-8 bg-white overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
             <table className="w-full text-left">
                <thead className="bg-gray-50">
                   <tr>
                      <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Conductor</th>
                      <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Entregas</th>
                      <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Tiempo Prom. por Paquete</th>
                      <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Eficiencia</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                   {data.ranking.map((driver, index) => (
                      <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                         <td className="px-6 py-4">
                            <span className="text-xs font-black text-gray-700 uppercase">{driver.driverName}</span>
                         </td>
                         <td className="px-6 py-4 text-center">
                            <span className="px-2.5 py-1 text-[10px] font-black bg-blue-100 text-blue-700 rounded-lg">{driver.deliveredCount}</span>
                         </td>
                         <td className="px-6 py-4 text-center">
                            <span className="text-xs font-bold text-gray-600">{driver.avgDeliveryTimeMinutes} min</span>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                               <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${parseFloat(driver.avgDeliveryTimeMinutes) < 15 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                    style={{ width: `${Math.min(100, (60 / parseFloat(driver.avgDeliveryTimeMinutes)) * 10)}%` }}
                                  ></div>
                               </div>
                            </div>
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

export default AnalyticsPanel;
