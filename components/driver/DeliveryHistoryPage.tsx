

import React, { useState, useEffect, useContext, useMemo, ReactNode } from 'react';
import type { Package, User } from '../../types';
import { PackageStatus } from '../../constants';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import PackageList from '../PackageList';
import PackageDetailModal from '../PackageDetailModal';
import { IconPackage, IconCalendar, IconCheckCircle, IconArchive, IconArrowUturnLeft, IconWhatsapp, IconCube, IconRefresh } from '../Icon';

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
    
    const findClientName = (creatorId: string | null) => users.find(u => u.id === creatorId)?.name || 'N/A';
    
    const findEventTimestamp = (pkg: Package, status: PackageStatus) => {
        const event = pkg.history.find(e => e.status === status);
        return event ? new Date(event.timestamp) : null;
    };

    return (
        <div className="p-8 font-sans text-gray-800 bg-white" style={{ width: '8.5in', minHeight: '11in' }}>
            {/* Header */}
            <header className="flex justify-between items-start pb-4 border-b-2 border-gray-800">
                <div className="flex items-center gap-3">
                    <IconCube className="w-10 h-10 text-gray-800" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{companyName}</h1>
                        <h2 className="text-lg text-gray-600">Reporte de Actividad del Conductor</h2>
                    </div>
                </div>
                <div className="text-right text-sm text-gray-600">
                    <p><span className="font-semibold text-gray-800">Conductor:</span> {driver.name}</p>
                    <p><span className="font-semibold text-gray-800">Período:</span> {formattedStartDate} al {formattedEndDate}</p>
                </div>
            </header>

            {/* Summary */}
            <section className="my-8">
                <h3 className="text-xl font-semibold mb-4 border-b border-gray-300 pb-2 text-gray-800">Resumen del Período</h3>
                <table className="w-full text-left">
                    <tbody>
                        <tr>
                            <td className="py-1 pr-4 font-semibold">Total Paquetes Entregados:</td>
                            <td className="py-1 font-bold text-lg">{reportData.delivered.length}</td>
                        </tr>
                        <tr>
                            <td className="py-1 pr-4 font-semibold">Total Paquetes Retirados:</td>
                            <td className="py-1 font-bold text-lg">{reportData.pickedUp.length}</td>
                        </tr>
                        <tr>
                            <td className="py-1 pr-4 font-semibold">Total Clientes Visitados (para retiro):</td>
                            <td className="py-1 font-bold text-lg">{reportData.uniquePickupClients}</td>
                        </tr>
                        <tr>
                            <td className="py-1 pr-4 font-semibold">Total Paquetes Devueltos:</td>
                            <td className="py-1 font-bold text-lg">{reportData.returned.length}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* Delivered Packages Table */}
            <section className="my-8">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Entregados ({reportData.delivered.length})</h3>
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border-b-2 border-gray-300 p-2 text-left font-semibold text-gray-600">ID Paquete</th>
                            <th className="border-b-2 border-gray-300 p-2 text-left font-semibold text-gray-600">Destinatario</th>
                            <th className="border-b-2 border-gray-300 p-2 text-left font-semibold text-gray-600">Comuna</th>
                            <th className="border-b-2 border-gray-300 p-2 text-left font-semibold text-gray-600">Fecha Entrega</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.delivered.length > 0 ? reportData.delivered.map((pkg, index) => (
                            <tr key={pkg.id} className={index % 2 === 0 ? '' : 'bg-gray-50'}>
                                <td className="border-b border-gray-200 p-2 font-mono text-xs">{pkg.id}</td>
                                <td className="border-b border-gray-200 p-2">{pkg.recipientName}</td>
                                <td className="border-b border-gray-200 p-2">{pkg.recipientCommune}</td>
                                <td className="border-b border-gray-200 p-2">{findEventTimestamp(pkg, PackageStatus.Delivered)?.toLocaleString('es-CL') || 'N/A'}</td>
                            </tr>
                        )) : <tr><td colSpan={4} className="border-b border-gray-200 p-4 text-center text-gray-500">No hay paquetes entregados en este período.</td></tr>}
                    </tbody>
                </table>
            </section>
            
            {/* Picked Up Packages Table */}
            <section className="my-8" style={{ pageBreakBefore: 'always' }}>
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Retirados ({reportData.pickedUp.length} paquetes de {reportData.uniquePickupClients} clientes)</h3>
                <table className="w-full text-sm border-collapse">
                     <thead className="bg-gray-100">
                        <tr>
                            <th className="border-b-2 border-gray-300 p-2 text-left font-semibold text-gray-600">ID Paquete</th>
                            <th className="border-b-2 border-gray-300 p-2 text-left font-semibold text-gray-600">Cliente Remitente</th>
                            <th className="border-b-2 border-gray-300 p-2 text-left font-semibold text-gray-600">Fecha Retiro</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.pickedUp.length > 0 ? reportData.pickedUp.map((pkg, index) => (
                            <tr key={pkg.id} className={index % 2 === 0 ? '' : 'bg-gray-50'}>
                                <td className="border-b border-gray-200 p-2 font-mono text-xs">{pkg.id}</td>
                                <td className="border-b border-gray-200 p-2">{findClientName(pkg.creatorId)}</td>
                                <td className="border-b border-gray-200 p-2">{findEventTimestamp(pkg, PackageStatus.PickedUp)?.toLocaleString('es-CL') || 'N/A'}</td>
                            </tr>
                        )) : <tr><td colSpan={3} className="border-b border-gray-200 p-4 text-center text-gray-500">No hay paquetes retirados en este período.</td></tr>}
                    </tbody>
                </table>
            </section>

             <footer className="absolute bottom-8 left-8 right-8 text-xs text-gray-500 text-center border-t border-gray-300 pt-2">
                Reporte generado el {new Date().toLocaleString('es-CL')}
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyView, setHistoryView] = useState<HistoryView>('delivered');
  const auth = useContext(AuthContext);

  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);

  const [startDate, setStartDate] = useState(getISODate(oneWeekAgo));
  const [endDate, setEndDate] = useState(getISODate(today));

  const fetchData = async () => {
    if (!auth?.user) return;
    setIsLoading(true);
    try {
      const [{ packages: pkgs }, allUsers] = await Promise.all([
          api.getPackages({ driverFilter: auth.user.id, limit: 0 }),
          api.getUsers()
      ]);
      const driverPackages = pkgs
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      setAllDriverPackages(driverPackages);
      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to fetch history data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [auth?.user]);

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
  
  const handleShareReport = async () => {
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
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
        const pdfBlob = await html2pdf().from(reportElement).set(opt).output('blob');
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

        if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
                title: 'Reporte de Actividad',
                text: `Reporte de actividad para ${auth?.user?.name} (${startDate} al ${endDate}).`,
                files: [pdfFile],
            });
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(pdfBlob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }
    } catch (error) {
        console.error("Error generating or sharing PDF:", error);
        alert("Ocurrió un error al generar o compartir el PDF.");
    } finally {
        setIsGenerating(false);
    }
  };

  const hasDataToReport = deliveredInRange.length > 0 || pickedUpInRange.length > 0 || returnedInRange.length > 0;

  return (
    <div>
      <div className="print:hidden">
        <div className="bg-[var(--background-secondary)] p-4 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Historial de Actividad</h3>
              <button 
                onClick={fetchData} 
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
                <input type="date" id="end-date" max={getISODate(new Date())} onChange={e => setEndDate(e.target.value)} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" aria-label="Seleccionar fecha de fin" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-transparent mb-1">Acciones</label>
              <div className="flex flex-col items-stretch gap-2">
                <button onClick={handleShareReport} disabled={isGenerating || !hasDataToReport} className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed">
                  <IconWhatsapp className="w-5 h-5 mr-2 -ml-1"/>
                  {isGenerating ? 'Generando...' : 'Compartir Informe'}
                </button>
                <p className="text-xs text-center text-[var(--text-muted)] mt-1">En PC se descargará el archivo PDF.</p>
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
            driver={users.find(u => u.id === selectedPackage.driverId)}
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