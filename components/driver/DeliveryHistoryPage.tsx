

import React, { useState, useEffect, useContext, useMemo, ReactNode } from 'react';
import type { Package, User } from '../../types';
import { PackageStatus } from '../../constants';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import PackageList from '../PackageList';
import PackageDetailModal from '../PackageDetailModal';
import { IconCalendar, IconCheckCircle, IconArchive, IconArrowUturnLeft, IconWhatsapp, IconCube, IconRefresh } from '../Icon';

declare const html2pdf: any;

const getISODate = (date: Date) => date.toISOString().split('T')[0];

type HistoryView = 'delivered' | 'picked-up' | 'returned';

interface ReportData {
    delivered: Package[];
    pickedUp: Package[];
    returned: Package[];
    uniquePickupClients: number;
}

const ReportContent: React.FC<{
    reportData: ReportData;
    driver: User;
    users: User[];
    startDate: string;
    endDate: string;
    companyName: string;
}> = ({ reportData, driver, users, startDate, endDate, companyName }) => {
    const formattedStartDate = new Date(startDate.replace(/-/g, '/')).toLocaleDateString('es-CL');
    const formattedEndDate = new Date(endDate.replace(/-/g, '/')).toLocaleDateString('es-CL');
    
    const findClientName = (creatorId: string | null) => users.find(u => u.id === creatorId)?.name || 'Cliente Particular';
    
    const findEventTimestamp = (pkg: Package, status: PackageStatus) => {
        const event = pkg.history.find(e => e.status === status);
        return event ? new Date(event.timestamp) : null;
    };

    const dailySummary = useMemo(() => {
        const summary: Record<string, { dateObj: Date, dateStr: string, delivered: number, pickedUp: number, returned: number }> = {};
        
        const addToSummary = (date: Date, type: 'delivered' | 'pickedUp' | 'returned') => {
            const pad = (n: number) => n.toString().padStart(2, '0');
            const dateKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
            const dateStr = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
            
            if (!summary[dateKey]) summary[dateKey] = { dateObj: date, dateStr, delivered: 0, pickedUp: 0, returned: 0 };
            summary[dateKey][type]++;
        };

        reportData.delivered.forEach(pkg => {
            const date = findEventTimestamp(pkg, PackageStatus.Delivered);
            if (date) addToSummary(date, 'delivered');
        });

        reportData.pickedUp.forEach(pkg => {
            const date = findEventTimestamp(pkg, PackageStatus.PickedUp);
            if (date) addToSummary(date, 'pickedUp');
        });

        reportData.returned.forEach(pkg => {
            const date = findEventTimestamp(pkg, PackageStatus.Returned);
            if (date) addToSummary(date, 'returned');
        });

        return Object.values(summary).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    }, [reportData]);

    return (
        <div className="p-10 font-sans text-slate-800 bg-white" style={{ width: '210mm', minHeight: '297mm', position: 'relative' }}>
            {/* Professional Header */}
            <header className="flex justify-between items-center pb-6 border-b-4 border-slate-900">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center">
                        <IconCube className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">{companyName}</h1>
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <IconArchive className="w-4 h-4" />
                            <span>Reporte de Operaciones Logísticas</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Documento Oficial</p>
                    <div className="bg-slate-100 px-4 py-2 rounded-md">
                        <p className="text-sm font-bold text-slate-800">{formattedStartDate} — {formattedEndDate}</p>
                    </div>
                </div>
            </header>

            {/* Information Grid */}
            <div className="grid grid-cols-2 gap-8 my-8">
                <div className="space-y-1">
                    <p className="text-xs uppercase text-slate-400 font-bold">Información del Conductor</p>
                    <p className="text-lg font-bold text-slate-900">{driver.name}</p>
                    <p className="text-sm text-slate-500">{driver.email}</p>
                </div>
                <div className="space-y-1 text-right">
                    <p className="text-xs uppercase text-slate-400 font-bold">Fecha de Emisión</p>
                    <p className="text-sm font-medium">{new Date().toLocaleString('es-CL')}</p>
                </div>
            </div>

            {/* Premium Summary Cards */}
            <section className="grid grid-cols-4 gap-4 my-8">
                {[
                    { label: 'Entregados', value: reportData.delivered.length, color: 'bg-green-50 text-green-700 border-green-200' },
                    { label: 'Retiros', value: reportData.pickedUp.length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                    { label: 'Clientes', value: reportData.uniquePickupClients, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                    { label: 'Devueltos', value: reportData.returned.length, color: 'bg-amber-50 text-amber-700 border-amber-200' }
                ].map((card, i) => (
                    <div key={i} className={`p-4 rounded-xl border-2 ${card.color} text-center`}>
                        <p className="text-[10px] uppercase font-black tracking-wider mb-1 opacity-70">{card.label}</p>
                        <p className="text-3xl font-black">{card.value}</p>
                    </div>
                ))}
            </section>

            {/* Daily Summary Table */}
            <div className="mt-8 mb-16">
                <div className="flex items-center gap-2 mb-4 border-l-4 border-slate-900 pl-3">
                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Resumen por Día</h3>
                </div>
                <table className="w-full text-sm border-collapse border border-slate-200">
                    <thead>
                        <tr className="bg-slate-100 text-slate-800">
                            <th className="p-3 text-left font-bold border-b border-slate-300">Fecha</th>
                            <th className="p-3 text-center font-bold border-b border-slate-300">Entregas</th>
                            <th className="p-3 text-center font-bold border-b border-slate-300">Retiros (Paquetes)</th>
                            <th className="p-3 text-center font-bold border-b border-slate-300">Devoluciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailySummary.length > 0 ? dailySummary.map((day, index) => (
                            <tr key={day.dateStr} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="p-3 border-b border-slate-200 font-bold text-slate-700">{day.dateStr}</td>
                                <td className="p-3 border-b border-slate-200 text-center font-medium text-green-700">{day.delivered > 0 ? day.delivered : '-'}</td>
                                <td className="p-3 border-b border-slate-200 text-center font-medium text-blue-700">{day.pickedUp > 0 ? day.pickedUp : '-'}</td>
                                <td className="p-3 border-b border-slate-200 text-center font-medium text-amber-700">{day.returned > 0 ? day.returned : '-'}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic bg-slate-50 border-b border-slate-200">No hay actividad en este período.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Signature Section */}
            <div className="mt-20 grid grid-cols-2 gap-20">
                <div className="text-center">
                    <div className="border-t-2 border-slate-300 pt-3">
                        <p className="text-sm font-bold text-slate-900">{driver.name}</p>
                        <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Firma del Conductor</p>
                    </div>
                </div>
                <div className="text-center">
                    <div className="border-t-2 border-slate-300 pt-3">
                        <p className="text-sm font-bold text-slate-900">Operaciones {companyName}</p>
                        <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Firma Responsable</p>
                    </div>
                </div>
            </div>

            {/* Professional Footer */}
            <footer className="absolute bottom-10 left-10 right-10 text-[9px] text-slate-400 flex justify-between border-t border-slate-100 pt-4">
                <p>Este documento es una representación digital de la actividad logística de {companyName}.</p>
                <p>Página 1 de 1</p>
            </footer>
        </div>
    );
};


const TabButton: React.FC<{ label: string; count: string | number; active: boolean; onClick: () => void; icon: ReactNode }> = ({ label, count, active, onClick, icon }) => {
    const baseClasses = "flex flex-col items-center justify-center flex-1 text-center p-3 rounded-lg transition-colors duration-200";
    const activeClasses = "bg-[var(--brand-muted)] text-[var(--brand-text)] shadow-inner";
    const inactiveClasses = "bg-[var(--background-muted)] hover:bg-[var(--background-hover)]";
    const countIsString = typeof count === 'string';

    return (
        <button onClick={onClick} className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}>
            <div className="flex items-center gap-2">
                {icon}
                <span className={`block font-bold ${countIsString ? 'text-xl' : 'text-2xl'}`}>{count}</span>
            </div>
            <span className="block text-xs font-semibold mt-1">{label}</span>
        </button>
    );
};

const DeliveryHistoryPage: React.FC = () => {
  const [allDriverPackages, setAllDriverPackages] = useState<Package[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [pdfCache, setPdfCache] = useState<{ blob: Blob, fileName: string } | null>(null);
  const [historyView, setHistoryView] = useState<HistoryView>('delivered');
  const auth = useContext(AuthContext);

  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);

  const [startDate, setStartDate] = useState(getISODate(oneWeekAgo));
  const [endDate, setEndDate] = useState(getISODate(today));

  // Load from cache on mount
  useEffect(() => {
    if (!auth?.user) return;
    const cachedHistory = localStorage.getItem(`driver_history_${auth.user.id}`);
    const cachedUsers = localStorage.getItem(`driver_users`);
    
    if (cachedHistory) {
      try {
        const parsed = JSON.parse(cachedHistory);
        setAllDriverPackages(parsed);
        setIsLoading(false);
      } catch (e) {
        console.error("Error parsing cached history", e);
      }
    }
    
    if (cachedUsers) {
      try {
        const parsed = JSON.parse(cachedUsers);
        setUsers(parsed);
      } catch (e) {
        console.error("Error parsing cached users", e);
      }
    }
  }, [auth?.user?.id]);

  const fetchData = async (silent = false) => {
    if (!auth?.user) return;
    if (!silent) setIsLoading(true);
    try {
      // Fetch packages and users separately to prevent one failure from blocking the other
      // Now including dates to bypass the backend's "today-only" default for drivers
      const packagesPromise = api.getPackages({ 
        driverFilter: auth.user.id, 
        limit: 0,
        startDate,
        endDate
      });
      const usersPromise = api.getUsers().catch(err => {
        console.warn("[Auth] Could not fetch users list, using cache if available.", err);
        const cachedUsers = localStorage.getItem(`driver_users`);
        return cachedUsers ? JSON.parse(cachedUsers) : [];
      });

      const [{ packages: pkgs }, allUsers] = await Promise.all([
          packagesPromise,
          usersPromise
      ]);

      const driverPackages = pkgs
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      setAllDriverPackages(driverPackages);
      setUsers(allUsers);
      
      localStorage.setItem(`driver_history_${auth.user.id}`, JSON.stringify(driverPackages));
      if (allUsers.length > 0) {
        localStorage.setItem(`driver_users`, JSON.stringify(allUsers));
      }
    } catch (error) {
      console.error("Failed to fetch history data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true); // Re-fetch when dates change or user changes
  }, [auth?.user, startDate, endDate]);

  const { deliveredInRange, pickedUpInRange, returnedInRange, uniquePickupClientsCount } = useMemo(() => {
    const start = new Date(startDate.replace(/-/g, '/'));
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate.replace(/-/g, '/'));
    end.setHours(23, 59, 59, 999);

    const delivered: Package[] = [];
    const pickedUp: Package[] = [];
    const returned: Package[] = [];
    const pickupClients = new Set<string>();

    allDriverPackages.forEach(pkg => {
        if (pkg.status === PackageStatus.Delivered) {
            const deliveryEvent = pkg.history.find(e => e.status === PackageStatus.Delivered);
            if (deliveryEvent) {
                const deliveryDate = new Date(deliveryEvent.timestamp);
                if (deliveryDate >= start && deliveryDate <= end) {
                    delivered.push(pkg);
                }
            }
        }
        
        if (pkg.status === PackageStatus.Returned) {
            const returnEvent = pkg.history.find(e => e.status === PackageStatus.Returned);
            if (returnEvent) {
                const returnDate = new Date(returnEvent.timestamp);
                if (returnDate >= start && returnDate <= end) {
                    returned.push(pkg);
                }
            }
        }

        const pickupEvent = pkg.history.find(e => e.status === PackageStatus.PickedUp);
        if (pickupEvent) {
            const pickupDate = new Date(pickupEvent.timestamp);
            if (pickupDate >= start && pickupDate <= end) {
                pickedUp.push(pkg);
                if (pkg.creatorId) {
                    pickupClients.add(pkg.creatorId);
                }
            }
        }
    });

    return { deliveredInRange: delivered, pickedUpInRange: pickedUp, returnedInRange: returned, uniquePickupClientsCount: pickupClients.size };
  }, [allDriverPackages, startDate, endDate]);

  const packagesToShow = useMemo(() => {
    switch (historyView) {
        case 'picked-up': return pickedUpInRange;
        case 'returned': return returnedInRange;
        case 'delivered':
        default:
            return deliveredInRange;
    }
  }, [historyView, deliveredInRange, pickedUpInRange, returnedInRange]);

  // Pre-generate PDF silently in the background as soon as data is ready.
  // This way, when the conductor taps "Compartir", the blob is already in memory
  // and navigator.share() fires in < 1ms — Chrome cannot block it.
  useEffect(() => {
    setPdfCache(null);
    const hasData = deliveredInRange.length > 0 || pickedUpInRange.length > 0 || returnedInRange.length > 0;
    if (!hasData || !auth?.user) return;

    const generate = async () => {
      const reportElement = document.getElementById('report-content-for-pdf');
      if (!reportElement) return;
      setIsPreparing(true);
      try {
        const driverName = auth.user!.name.replace(/\s+/g, '_');
        const fileName = `Reporte_${driverName}_${startDate}_to_${endDate}.pdf`;
        const opt = {
          margin: 0.5,
          filename: fileName,
          image: { type: 'jpeg', quality: 0.80 },
          html2canvas: { scale: 1, useCORS: true, logging: false },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        const blob = await html2pdf().from(reportElement).set(opt).output('blob');
        setPdfCache({ blob, fileName });
      } catch (e) {
        console.error('PDF pre-generation failed:', e);
      } finally {
        setIsPreparing(false);
      }
    };

    // Wait 600ms for React to finish rendering the hidden report DOM before capturing it
    const timer = setTimeout(generate, 600);
    return () => clearTimeout(timer);
  }, [deliveredInRange, pickedUpInRange, returnedInRange]);

  const handleShareReport = async () => {
    if (!pdfCache) return;
    const fallbackDownload = () => {
      const url = URL.createObjectURL(pdfCache.blob);
      const a = document.createElement('a');
      a.href = url; a.download = pdfCache.fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    try {
      const file = new File([pdfCache.blob], pdfCache.fileName, { type: 'application/pdf' });
      if (navigator.share) {
        await navigator.share({
          title: 'Reporte de Actividad',
          text: `Reporte del conductor ${auth?.user?.name} (${startDate} al ${endDate}).`,
          files: [file]
        });
      } else {
        fallbackDownload();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Share failed:', err);
      fallbackDownload();
    }
  };
  const hasDataToReport = deliveredInRange.length > 0 || pickedUpInRange.length > 0 || returnedInRange.length > 0;
  const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad/i.test(navigator.userAgent);

  return (
    <div>
      <div className="print:hidden">
        <div className="bg-[var(--background-secondary)] p-4 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Historial de Actividad</h3>
              <button 
                onClick={() => fetchData()} 
                disabled={isLoading}
                className="p-2 bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-full shadow-sm active:bg-[var(--background-hover)] transition-colors disabled:opacity-50"
                title="Actualizar datos"
              >
                <IconRefresh className={`w-5 h-5 text-[var(--brand-primary)] ${isLoading ? 'animate-spin' : ''}`}/>
              </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 items-end gap-2 sm:gap-4 mb-4">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Desde</label>
              <div className="relative">
                <div className="flex items-center justify-between w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm bg-[var(--background-secondary)] text-left cursor-pointer sm:text-sm">
                  <span className={startDate ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
                    {startDate ? new Date(startDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/aaaa'}
                  </span>
                  <IconCalendar className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" aria-label="Seleccionar fecha de inicio" />
              </div>
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Hasta</label>
              <div className="relative">
                <div className="flex items-center justify-between w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm bg-[var(--background-secondary)] text-left cursor-pointer sm:text-sm">
                  <span className={endDate ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
                    {endDate ? new Date(endDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/aaaa'}
                  </span>
                  <IconCalendar className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <input type="date" id="end-date" value={endDate} max={getISODate(new Date())} onChange={e => setEndDate(e.target.value)} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" aria-label="Seleccionar fecha de fin" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-transparent mb-1">Acciones</label>
              <div className="flex flex-col items-stretch gap-2">
                {isPreparing ? (
                  <button disabled className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-slate-400 cursor-not-allowed">
                    <IconRefresh className="w-5 h-5 mr-2 -ml-1 animate-spin"/>
                    Preparando informe...
                  </button>
                ) : pdfCache ? (
                  <button onClick={handleShareReport} className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 active:bg-green-800">
                    <IconWhatsapp className="w-5 h-5 mr-2 -ml-1"/>
                    {isMobile ? 'Compartir Informe' : 'Descargar Informe PDF'}
                  </button>
                ) : (
                  <button disabled className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-slate-400 cursor-not-allowed">
                    <IconArchive className="w-5 h-5 mr-2 -ml-1"/>
                    Sin datos para reportar
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--border-primary)] mt-4 pt-4">
            <div className="flex space-x-2">
              <TabButton label="Entregados" count={deliveredInRange.length} active={historyView === 'delivered'} onClick={() => setHistoryView('delivered')} icon={<IconCheckCircle className="w-5 h-5"/>} />
              <TabButton label="Retiros (Clientes / Paquetes)" count={`${uniquePickupClientsCount} / ${pickedUpInRange.length}`} active={historyView === 'picked-up'} onClick={() => setHistoryView('picked-up')} icon={<IconArchive className="w-5 h-5"/>} />
              <TabButton label="Devueltos" count={returnedInRange.length} active={historyView === 'returned'} onClick={() => setHistoryView('returned')} icon={<IconArrowUturnLeft className="w-5 h-5"/>} />
            </div>
          </div>
        </div>
        <div className="bg-[var(--background-secondary)] shadow-md rounded-lg overflow-hidden">
          <PackageList packages={packagesToShow} users={users} isLoading={isLoading} onSelectPackage={setSelectedPackage} isDateFiltering={true} />
        </div>
        {selectedPackage && (
          <PackageDetailModal 
            isFullScreen={true} 
            pkg={selectedPackage} 
            onClose={() => setSelectedPackage(null)} 
            creator={users.find(u => u.id === selectedPackage.creatorId)}
          />
        )}
      </div>
      
      {/* Hidden container for PDF generation */}
      <div className="hidden print:block print-container">
        <div id="report-content-for-pdf" className="relative">
          {auth?.user && (
            <ReportContent 
              reportData={{
                delivered: deliveredInRange,
                pickedUp: pickedUpInRange,
                returned: returnedInRange,
                uniquePickupClients: uniquePickupClientsCount,
              }}
              driver={auth.user}
              users={users}
              startDate={startDate}
              endDate={endDate}
              companyName={auth.systemSettings.companyName}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryHistoryPage;