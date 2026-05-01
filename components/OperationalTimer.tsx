
import React, { useState, useEffect } from 'react';
import { IconClock, IconAlertTriangle, IconCheckCircle, IconZap } from './Icon';

const OperationalTimer: React.FC = () => {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Set target to 21:00 of today
  const target = new Date();
  target.setHours(21, 0, 0, 0);

  const diff = target.getTime() - now.getTime();
  const isOvertime = diff < 0;
  const absDiff = Math.abs(diff);

  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      
      {/* Target Clock Card */}
      <div className={`relative overflow-hidden p-6 rounded-2xl border transition-all shadow-lg ${
        isOvertime 
          ? 'bg-gradient-to-br from-red-600 to-red-800 border-red-500 shadow-red-200' 
          : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-slate-200'
      }`}>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em] mb-1">
              {isOvertime ? 'Exceso de Jornada' : 'Tiempo para Cierre (21:00)'}
            </p>
            <h2 className="text-4xl font-black text-white tracking-tighter font-mono">
              {timeStr}
            </h2>
          </div>
          <div className={`p-3 rounded-xl bg-white/10 backdrop-blur-md ${isOvertime ? 'animate-pulse' : ''}`}>
            <IconClock className="w-8 h-8 text-white" />
          </div>
        </div>
        {/* Background Decoration */}
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
      </div>

      {/* Operation Health Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5">
        <div className="flex-shrink-0 w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100">
           <IconZap className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pulso de Operación</p>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-gray-900 uppercase">Estable</h3>
            <div className="flex gap-1">
               <div className="w-1.5 h-4 bg-green-500 rounded-full"></div>
               <div className="w-1.5 h-4 bg-green-500 rounded-full"></div>
               <div className="w-1.5 h-4 bg-gray-200 rounded-full"></div>
            </div>
          </div>
          <p className="text-[10px] font-bold text-gray-500 mt-1">Entregas fluyendo a ritmo normal</p>
        </div>
      </div>

      {/* Goal of the Day Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5">
        <div className="flex-shrink-0 w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
           <IconCheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Meta Diaria</p>
          <h3 className="text-xl font-black text-gray-900 uppercase">98.5% Éxito</h3>
          <p className="text-[10px] font-bold text-emerald-600 mt-1">Superando el promedio semanal</p>
        </div>
      </div>

    </div>
  );
};

export default OperationalTimer;
