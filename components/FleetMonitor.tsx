
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { IconLoader, IconRefresh, IconUser, IconCheckCircle, IconAlertTriangle, IconChevronDown, IconChevronUp } from './Icon';

interface FleetDriverStatus {
  id: string;
  name: string;
  phone?: string;
  totalToday: number;
  deliveredToday: number;
  pendingToday: number;
  failedToday: number;
  hasClosedToday: boolean;
  closureTime?: string;
}

const FleetMonitor: React.FC = () => {
  const [fleet, setFleet] = useState<FleetDriverStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchData = async () => {
    try {
      const data = await api.getFleetStatus();
      setFleet(data);
    } catch (err) {
      console.error('Error fetching fleet status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const onRoute = fleet.filter(d => !d.hasClosedToday && d.totalToday > 0);
  const finished = fleet.filter(d => d.hasClosedToday);
  const totalPending = fleet.reduce((acc, d) => acc + d.pendingToday, 0);

  if (isLoading && fleet.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        <IconLoader className="w-6 h-6 animate-spin text-blue-600 mr-3" />
        <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Cargando monitor de flota...</span>
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-hidden bg-white border border-gray-200 rounded-2xl shadow-sm transition-all hover:shadow-md">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 bg-white/10 rounded-xl backdrop-blur-sm">
            <IconUser className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Monitor de Flota en Tiempo Real</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-300 uppercase">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                {onRoute.length} EN RUTA
              </span>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase">
                <IconCheckCircle className="w-3 h-3" />
                {finished.length} FINALIZADOS
              </span>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase">
                <IconAlertTriangle className="w-3 h-3" />
                {totalPending} PENDIENTES
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); fetchData(); }}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <IconRefresh className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isExpanded ? <IconChevronUp className="w-5 h-5 text-white/40" /> : <IconChevronDown className="w-5 h-5 text-white/40" />}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-6">
          {fleet.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm font-bold text-gray-400 uppercase">No hay actividad de conductores registrada hoy</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {fleet.map(driver => {
                const progress = driver.totalToday > 0 ? (driver.deliveredToday / driver.totalToday) * 100 : 0;
                const isFinished = driver.hasClosedToday;
                const isLate = !isFinished && driver.pendingToday > 0;

                return (
                  <div 
                    key={driver.id}
                    className={`relative p-4 border rounded-xl transition-all hover:scale-[1.02] ${
                      isFinished 
                        ? 'bg-emerald-50/30 border-emerald-100 opacity-80' 
                        : isLate && driver.pendingToday > 10 
                          ? 'bg-red-50/30 border-red-100 shadow-sm ring-1 ring-red-100'
                          : 'bg-white border-gray-100 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-900 truncate max-w-[150px] uppercase tracking-tight">
                          {driver.name}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400">
                          {driver.phone || 'Sin teléfono'}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-[8px] font-black rounded-md uppercase tracking-wider ${
                        isFinished 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : isLate 
                            ? 'bg-blue-100 text-blue-700 animate-pulse' 
                            : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isFinished ? 'Finalizado' : 'En Ruta'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-black text-gray-500 uppercase">Progreso</span>
                        <span className="text-[9px] font-black text-gray-900">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${
                            isFinished ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-[8px] font-bold text-gray-400 uppercase">Asig.</span>
                        <span className="text-xs font-black text-gray-900">{driver.totalToday}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                        <span className="text-[8px] font-bold text-emerald-400 uppercase">Ent.</span>
                        <span className="text-xs font-black text-emerald-900">{driver.deliveredToday}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="text-[8px] font-bold text-amber-400 uppercase">Pend.</span>
                        <span className="text-xs font-black text-amber-900">{driver.pendingToday}</span>
                      </div>
                    </div>

                    {isFinished && driver.closureTime && (
                      <div className="mt-3 pt-3 border-t border-emerald-100/50 flex items-center justify-between">
                        <span className="text-[8px] font-bold text-emerald-600 uppercase">Hora de cierre:</span>
                        <span className="text-[10px] font-black text-emerald-700">
                          {new Date(driver.closureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FleetMonitor;
