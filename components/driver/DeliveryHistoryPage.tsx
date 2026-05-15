

import React, { useState, useEffect, useContext, useMemo, ReactNode } from 'react';
import type { Package, User } from '../../types';
import { PackageStatus } from '../../constants';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import PackageList from '../PackageList';
import PackageDetailModal from '../PackageDetailModal';
import { IconCalendar, IconCheckCircle, IconArchive, IconArrowUturnLeft, IconWhatsapp, IconCube, IconRefresh } from '../Icon';

declare const html2pdf: any;
declare const html2canvas: any;

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
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [historyView, setHistoryView] = useState<HistoryView>('delivered');
  const [filteredData, setFilteredData] = useState({ delivered: [] as Package[], pickedUp: [] as Package[], returned: [] as Package[], clients: 0 });
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

  useEffect(() => {
    setIsFiltering(true);
    // Use timeout to allow UI to render the loading spinner before heavy calculation
    const timeoutId = setTimeout(() => {
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);

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

      setFilteredData({
          delivered,
          pickedUp,
          returned,
          clients: pickupClients.size
      });
      setIsFiltering(false);
    }, 10);

    return () => clearTimeout(timeoutId);
  }, [allDriverPackages, startDate, endDate]);

  const packagesToShow = useMemo(() => {
    switch (historyView) {
        case 'picked-up': return filteredData.pickedUp;
        case 'returned': return filteredData.returned;
        case 'delivered':
        default:
            return filteredData.delivered;
    }
  }, [historyView, filteredData]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    const reportElement = document.getElementById('report-content-for-pdf');
    if (!reportElement) {
        console.error("Report element not found");
        setIsGenerating(false);
        return;
    }
    
    const driverName = auth?.user?.name.replace(/\s+/g, '_') || 'conductor';
    const dateRange = `${startDate}_to_${endDate}`;
    const fileName = `Reporte_${driverName}_${dateRange}.pdf`;

    const opt = {
        margin: 0.5,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.80 },
        html2canvas: { scale: 1, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
        const pdfBlob = await html2pdf().from(reportElement).set(opt).output('blob');
        setPreviewBlob(pdfBlob);
        setShowPreviewModal(true);
    } catch (error: any) {
        console.error("Error generating PDF:", error);
        alert("Ocurrió un error al generar el PDF.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleFinalShare = async () => {
    if (!previewBlob) return;
    const driverName = auth?.user?.name.replace(/\s+/g, '_') || 'conductor';
    const dateRange = `${startDate}_to_${endDate}`;
    const fileName = `Reporte_${driverName}_${dateRange}.pdf`;
    
    const pdfFile = new File([previewBlob], fileName, { type: 'application/pdf' });

    try {
        if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
                title: 'Reporte de Actividad',
                text: `Reporte de actividad para ${auth?.user?.name} (${startDate} al ${endDate}).`,
                files: [pdfFile],
            });
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(previewBlob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }
    } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error("Share error:", error);
        alert(`No se pudo enviar automáticamente. Se descargará el archivo para enviarlo manualmente.`);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(previewBlob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }
  };

  const hasDataToReport = filteredData.delivered.length > 0 || filteredData.pickedUp.length > 0 || filteredData.returned.length > 0;

  return (
    <div>
      <div className="print:hidden">
        <div className="bg-[var(--background-secondary)] p-4 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Historial de Actividad</h3>
              <button 
                onClick={() => fetchData()} 
                disabled={isLoading || isFiltering}
                className="p-2 bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-full shadow-sm active:bg-[var(--background-hover)] transition-colors disabled:opacity-50"
                title="Actualizar datos"
              >
                <IconRefresh className={`w-5 h-5 text-[var(--brand-primary)] ${isLoading || isFiltering ? 'animate-spin' : ''}`}/>
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
                <button onClick={handleGenerateReport} disabled={isGenerating || isFiltering || !hasDataToReport} className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed">
                  {isGenerating ? <IconRefresh className="w-5 h-5 mr-2 -ml-1 animate-spin"/> : <IconArchive className="w-5 h-5 mr-2 -ml-1"/>}
                  {isGenerating ? 'Generando PDF...' : 'Generar Vista Previa'}
                </button>
                <p className="text-xs text-center text-[var(--text-muted)] mt-1">Revisa el informe antes de enviarlo.</p>
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--border-primary)] mt-4 pt-4">
            <div className="flex space-x-2">
              <TabButton label="Entregados" count={filteredData.delivered.length} active={historyView === 'delivered'} onClick={() => setHistoryView('delivered')} icon={<IconCheckCircle className="w-5 h-5"/>} />
              <TabButton label="Retiros (Clientes / Paquetes)" count={`${filteredData.clients} / ${filteredData.pickedUp.length}`} active={historyView === 'picked-up'} onClick={() => setHistoryView('picked-up')} icon={<IconArchive className="w-5 h-5"/>} />
              <TabButton label="Devueltos" count={filteredData.returned.length} active={historyView === 'returned'} onClick={() => setHistoryView('returned')} icon={<IconArrowUturnLeft className="w-5 h-5"/>} />
            </div>
          </div>
        </div>
        <div className="bg-[var(--background-secondary)] shadow-md rounded-lg overflow-hidden opacity-100 transition-opacity duration-300" style={{ opacity: isFiltering ? 0.5 : 1 }}>
          <PackageList packages={packagesToShow} users={users} isLoading={isLoading || isFiltering} onSelectPackage={setSelectedPackage} isDateFiltering={true} />
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
                delivered: filteredData.delivered,
                pickedUp: filteredData.pickedUp,
                returned: filteredData.returned,
                uniquePickupClients: filteredData.clients,
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

      {/* PDF Preview Modal */}
      {showPreviewModal && previewBlob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <IconArchive className="w-6 h-6 text-blue-600"/>
                Vista Previa del Informe
              </h2>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex justify-center">
                {/* Visual indicator that PDF is ready to be shared */}
                <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full my-auto border border-slate-200">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IconCheckCircle className="w-10 h-10"/>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">¡PDF Generado con Éxito!</h3>
                    <p className="text-slate-500 mb-6">
                        El informe de {auth?.user?.name} desde el {startDate} al {endDate} está listo para ser enviado.
                    </p>
                    <button 
                        onClick={handleFinalShare}
                        className="w-full py-4 px-6 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 flex items-center justify-center text-lg transition-transform transform active:scale-95"
                    >
                        <IconWhatsapp className="w-6 h-6 mr-3"/>
                        Compartir por WhatsApp
                    </button>
                    <p className="text-xs text-slate-400 mt-4 text-center px-4">
                        Al presionar este botón, el menú para compartir se abrirá instantáneamente.
                    </p>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryHistoryPage;