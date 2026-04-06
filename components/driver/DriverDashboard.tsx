

import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { PackageStatus, MessagingPlan } from '../../constants';
import type { Package, User } from '../../types';
import { api, DeliveryConfirmationData } from '../../services/api';
import PackageList from '../PackageList';
import PackageDetailModal from '../PackageDetailModal';
import DeliveryConfirmationModal from './DeliveryConfirmationModal';
import UndeliveredModal from './UndeliveredModal';
import { AuthContext } from '../../contexts/AuthContext';
import { IconArchive, IconTruck, IconRoute, IconAlertTriangle } from '../Icon';
import EndOfDayReportModal from '../modals/EndOfDayReportModal';
import RouteOptimizerModal from '../modals/RouteOptimizerModal';


const DriverDashboard: React.FC = () => {
  const [myPackages, setMyPackages] = useState<Package[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [deliveringPackage, setDeliveringPackage] = useState<Package | null>(null);
  const [reportingProblemPackage, setReportingProblemPackage] = useState<Package | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [isEndOfDayModalOpen, setIsEndOfDayModalOpen] = useState(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  
  const auth = useContext(AuthContext);
  const isInitialLoad = useRef(true);
  const prevPackagesRef = useRef<Package[] | undefined>(undefined);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | undefined>(undefined);

  // Load from cache on mount
  useEffect(() => {
    if (!auth?.user) return;
    
    const cachedPackages = localStorage.getItem(`driver_packages_${auth.user.id}`);
    const cachedUsers = localStorage.getItem(`driver_users`);
    
    if (cachedPackages) {
      try {
        const parsed = JSON.parse(cachedPackages);
        setMyPackages(parsed);
        setIsLoading(false);
        isInitialLoad.current = false;
      } catch (e) {
        console.error("Error parsing cached packages", e);
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

  // Restore delivering package if it was interrupted
  useEffect(() => {
    if (myPackages.length > 0 && !deliveringPackage) {
        const pendingId = localStorage.getItem(`pending_delivering_id_${auth?.user?.id}`);
        if (pendingId) {
            const pkg = myPackages.find(p => p.id === pendingId);
            if (pkg && pkg.status !== PackageStatus.Delivered && pkg.status !== PackageStatus.Problem) {
                setDeliveringPackage(pkg);
            } else {
                localStorage.removeItem(`pending_delivering_id_${auth?.user?.id}`);
            }
        }
    }
  }, [myPackages, auth?.user?.id]);

  const fetchData = async (silent = false) => {
      if (!auth?.user) return;
      if (isInitialLoad.current && !silent) {
        setIsLoading(true);
      }
      try {
          // Fetch all packages for the current driver, without pagination
          const { packages: pkgs } = await api.getPackages({ driverFilter: auth.user.id, limit: 0 });
          setMyPackages(pkgs); 
          localStorage.setItem(`driver_packages_${auth.user.id}`, JSON.stringify(pkgs));
          
          // Only fetch users if we don't have them or if it's the initial load
          // Users don't change that often for a driver's view
          if (users.length === 0 || isInitialLoad.current) {
            const allUsers = await api.getUsers();
            setUsers(allUsers);
            localStorage.setItem(`driver_users`, JSON.stringify(allUsers));
          }
      } catch (error) {
          console.error("Failed to fetch driver data", error);
      } finally {
          if (isInitialLoad.current) {
            setIsLoading(false);
            isInitialLoad.current = false;
          }
      }
  };

  useEffect(() => {
    // Solo iniciamos el intervalo si NO estamos en proceso de entrega o reporte
    // Esto evita que refrescos accidentales en segundo plano cierren los modales
    if (deliveringPackage || reportingProblemPackage) return;

    fetchData(true); // Initial background fetch
    const intervalId = setInterval(() => fetchData(true), 15000); // Poll every 15 seconds instead of 10
    
    // Get current location for optimizer
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
    }

    return () => clearInterval(intervalId);
  }, [auth?.user, deliveringPackage, reportingProblemPackage]);

  // Effect to detect when all packages are processed
  useEffect(() => {
    if (prevPackagesRef.current === undefined) {
      prevPackagesRef.current = myPackages;
      return;
    }

    const allProcessedNow = myPackages.length > 0 && myPackages.every(
      p => p.status === PackageStatus.Delivered || p.status === PackageStatus.Problem
    );

    const allProcessedBefore = prevPackagesRef.current.length > 0 && prevPackagesRef.current.every(
      p => p.status === PackageStatus.Delivered || p.status === PackageStatus.Problem
    );

    if (allProcessedNow && !allProcessedBefore) {
      setIsEndOfDayModalOpen(true);
    }
    
    prevPackagesRef.current = myPackages;
  }, [myPackages]);
  
  const { pendingPackages, dailyHistoryPackages, unflexedCount } = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    const pending = myPackages.filter(p => 
        p.status !== PackageStatus.Delivered && p.status !== PackageStatus.Problem && p.status !== PackageStatus.Returned
    );

    const history = myPackages.filter(p => {
        if (p.status !== PackageStatus.Delivered && p.status !== PackageStatus.Problem) return false;
        
        const closureEvent = p.history?.[0]; // Most recent event determines the date
        if (!closureEvent) return false; 
        
        return new Date(closureEvent.timestamp).toDateString() === todayStr;
    });

    const unflexed = pending.filter(p => !p.isFlexed).length;
    return { pendingPackages: pending, dailyHistoryPackages: history, unflexedCount: unflexed };
  }, [myPackages]);

  const totalAssignedForDay = myPackages.length;

  const handleStartDelivery = (pkg: Package) => {
    setDeliveringPackage(pkg);
    if (auth?.user) {
        localStorage.setItem(`pending_delivering_id_${auth.user.id}`, pkg.id);
    }
  };

  const handleReportProblem = (pkg: Package) => {
    setReportingProblemPackage(pkg);
  };

  const handleConfirmDelivery = async (pkgId: string, data: DeliveryConfirmationData) => {
    try {
      const updatedPackage = await api.confirmDelivery(pkgId, data);
      if (!updatedPackage || !updatedPackage.id) {
          throw new Error("La respuesta del servidor no es válida.");
      }
      setMyPackages(prev => prev.map(p => p.id === pkgId ? updatedPackage : p));
      setDeliveringPackage(null);
      if (auth?.user) {
          localStorage.removeItem(`pending_delivering_id_${auth.user.id}`);
      }

      // --- NEW NOTIFICATION LOGIC ---
      if (auth?.systemSettings.messagingPlan && auth.systemSettings.messagingPlan !== MessagingPlan.None) {
          const creator = users.find(u => u.id === updatedPackage.creatorId);
          if (creator) {
              const message = `Hola ${creator.name}, te informamos que tu paquete con ID ${updatedPackage.id} para ${updatedPackage.recipientName} ha sido entregado exitosamente.`;
              if (auth.systemSettings.messagingPlan === MessagingPlan.WhatsApp && creator.phone) {
                  const whatsappUrl = `https://wa.me/${(creator.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
                  window.open(whatsappUrl, '_blank');
              } else if (auth.systemSettings.messagingPlan === MessagingPlan.Email && creator.email) {
                  const subject = `Paquete Entregado: ${updatedPackage.id}`;
                  const mailtoUrl = `mailto:${creator.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
                  window.open(mailtoUrl, '_blank');
              }
          }
      }
      // --- END NEW LOGIC ---

    } catch (error: any) {
        console.error("Failed to confirm delivery", error);
        throw error;
    }
  };

  const handleConfirmProblem = async (pkgId: string, reason: string, photos: string[]) => {
    try {
        const updatedPackage = await api.markPackageAsProblem(pkgId, reason, photos);
        setMyPackages(prev => prev.map(p => p.id === pkgId ? updatedPackage : p));
        setReportingProblemPackage(null);
    } catch (error: any) {
        console.error("Failed to report problem", error);
        throw error;
    }
  };
  
  const handleExportRoute = async () => {
    if (!auth?.user || pendingPackages.length === 0 || isExporting) return;

    setIsExporting(true);
    try {
        const dateStr = new Date().toISOString().split('T')[0];
        const driverName = (auth?.user?.name || 'conductor').replace(/\s+/g, '_');

        // Export simplified CSV for Circuit with only Address and Name
        const escapeCsvField = (field: any) => {
            const str = String(field || '').replace(/"/g, '""');
            return `"${str}"`;
        };
        const circuitHeaders = ['Address', 'Name'];
        
        const circuitRows = pendingPackages.map(p => [
            `${p.recipientAddress}, ${p.recipientCommune}, ${p.recipientCity}`,
            p.recipientName
        ].map(escapeCsvField).join(','));

        const csvContent = [circuitHeaders.join(','), ...circuitRows].join('\n');
        const filename = `Circuit_${driverName}_${dateStr}.csv`;
        const file = new File([`\uFEFF${csvContent}`], filename, { type: 'text/csv' });
        const rawTextList = pendingPackages.map(p => `${p.recipientAddress}, ${p.recipientCommune}, ${p.recipientCity} (${p.recipientName})`).join('\n');

        // 1. INTEGRACION NATIVA ANDROID APP (Requiere App Actualizada)
        // @ts-ignore
        if (window.AndroidApp && window.AndroidApp.shareText) {
            try {
                // @ts-ignore
                window.AndroidApp.shareText(rawTextList, "Ruta Circuit");
                return; // Exito compartiendo nativamente
            } catch (e) {
                console.error("Intento nativo falló", e);
            }
        }

        // Fallback: Si Falla el Share API o no está disponible (ejemplo: Android WebView antiguo)
        const runFallback = async () => {
            const isAndroidWebView = /wv/i.test(navigator.userAgent) || (/Android/i.test(navigator.userAgent) && !/Chrome\/[.0-9]* Mobile/i.test(navigator.userAgent));
            
            if (isAndroidWebView) {
                // En la APP Android (WebView antiguo), copiamos al portapapeles.
                try {
                    await navigator.clipboard.writeText(rawTextList);
                    alert("✅ Direcciones COPIADAS al portapapeles.\n\nAbre la app Circuit y elige 'Pegar lista'.");
                } catch (e) {
                    console.error(e);
                    alert("No se pudo copiar al portapapeles.");
                }
                return;
            }

            // Descarga regular para PC o navegadores móviles completos
            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        };

        // 2. Intentar compartir de forma nativa a la app Circuit (funciona en Mobile Web Moderno)
        // Se añade typeof check para evitar crash 'navigator.canShare is not a function' en WebViews
        if (navigator.share && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Ruta Circuit',
                    text: 'Abrir ruta con Circuit Route Planner'
                });
                return; // Exito compartiendo
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.log("Share API falló, intentando fallback local", err);
                await runFallback();
            }
        } else {
             // El navegador no soporta share file
             await runFallback();
        }

    } catch (error) {
        console.error("Export failed", error);
        alert("Error al exportar. Por favor intente de nuevo.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleApplyOptimizedRoute = (sortedPackages: Package[]) => {
      // Create a new array for all packages, preserving non-pending ones in their original place (roughly)
      // and replacing the pending ones with the sorted version.
      
      // For simplicity in UI, we just update the local state `myPackages` to reflect the order
      // of the sorted pending packages at the top or replacing the current pending segment.
      
      const otherPackages = myPackages.filter(p => !sortedPackages.find(sp => sp.id === p.id));
      setMyPackages([...sortedPackages, ...otherPackages]);
      setIsOptimizerOpen(false);
  };


  const packagesToShow = activeTab === 'pending' ? pendingPackages : dailyHistoryPackages;

  const tabStyles = "flex items-center justify-center w-full px-4 py-2 font-medium text-sm transition-colors duration-200 focus:outline-none";
  const activeTabStyles = "text-[var(--brand-primary)] border-b-2 border-[var(--brand-primary)] bg-[var(--brand-muted)]";
  const inactiveTabStyles = "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-hover)] border-b-2 border-transparent";

  return (
    <div>
      {unflexedCount > 0 && auth?.systemSettings?.flexDiscrepancyReportEnabled && (
        <div className="mb-6 mx-4 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl shadow-sm animate-pulse-subtle">
          <div className="flex items-start">
            <div className="p-2 bg-orange-100 rounded-lg text-orange-600 mr-4">
              <IconAlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-orange-900">Discrepancias en Carga</h3>
              <p className="text-orange-800 text-sm mt-1">
                Tienes <strong>{unflexedCount}</strong> {unflexedCount === 1 ? 'paquete' : 'paquetes'} pendientes de escanear en bodega antes de salir a ruta.
              </p>
              <div className="mt-2 text-xs font-medium text-orange-700 uppercase tracking-wider">
                Debe pasar por control de bodega
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-end items-center mb-4 px-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeTab === 'pending' && (
                <button
                    onClick={() => setIsOptimizerOpen(true)}
                    disabled={pendingPackages.length < 2}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    <IconRoute className="w-5 h-5 mr-2 -ml-1"/>
                    Optimizar Ruta
                </button>
            )}
            <button
                onClick={handleExportRoute}
                disabled={pendingPackages.length === 0 || isExporting}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[var(--text-on-brand)] bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] disabled:bg-slate-400 disabled:cursor-not-allowed ${isExporting ? 'animate-pulse' : ''}`}
            >
                <IconRoute className={`w-5 h-5 mr-2 -ml-1 ${isExporting ? 'animate-spin' : ''}`}/>
                {isExporting ? 'Enviando...' : 'Enviar a Circuit'}
            </button>
        </div>
        <span className="ml-auto bg-[var(--brand-primary)] text-[var(--text-on-brand)] text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
            Asignados Hoy: {totalAssignedForDay}
        </span>
      </div>

      <div className="bg-[var(--background-secondary)] shadow-md rounded-lg">
        <div className="border-b border-[var(--border-primary)]">
          <nav className="flex" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('pending')}
              className={`${tabStyles} ${activeTab === 'pending' ? activeTabStyles : inactiveTabStyles} rounded-tl-lg`}
            >
              <IconTruck className="w-5 h-5 mr-2" />
              <span>Pendientes ({pendingPackages.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`${tabStyles} ${activeTab === 'history' ? activeTabStyles : inactiveTabStyles} rounded-tr-lg`}
            >
              <IconArchive className="w-5 h-5 mr-2" />
              <span>Cerrados ({dailyHistoryPackages.length})</span>
            </button>
          </nav>
        </div>
        <PackageList 
            packages={packagesToShow} 
            users={users}
            isLoading={isLoading}
            onSelectPackage={setSelectedPackage}
            hideDriverName={true}
            isFiltering={activeTab === 'history'}
        />
      </div>

      {selectedPackage && (
        <PackageDetailModal 
            isFullScreen={true}
            pkg={selectedPackage} 
            onClose={() => setSelectedPackage(null)}
            creator={users.find(u => u.id === selectedPackage.creatorId)}
            companyName={auth?.systemSettings.companyName}
            onUpdatePackage={(updatedPkg) => {
                setMyPackages(prev => prev.map(p => p.id === updatedPkg.id ? updatedPkg : p));
                setSelectedPackage(updatedPkg);
            }}
            onStartDelivery={(pkg) => {
                setSelectedPackage(null);
                handleStartDelivery(pkg);
            }}
            onReportProblem={(pkg) => {
                setSelectedPackage(null);
                handleReportProblem(pkg);
            }}
        />
      )}

      {deliveringPackage && (
        <DeliveryConfirmationModal
          key={deliveringPackage.id}
          pkg={deliveringPackage}
          onClose={() => {
              setDeliveringPackage(null);
              if (auth?.user) {
                  localStorage.removeItem(`pending_delivering_id_${auth.user.id}`);
              }
          }}
          onConfirm={handleConfirmDelivery}
        />
      )}

      {reportingProblemPackage && (
        <UndeliveredModal
          pkg={reportingProblemPackage}
          onClose={() => setReportingProblemPackage(null)}
          onConfirm={handleConfirmProblem}
        />
      )}

      {isEndOfDayModalOpen && auth?.user && (
        <EndOfDayReportModal
            onClose={() => setIsEndOfDayModalOpen(false)}
            packages={myPackages}
            driverName={auth.user.name}
            users={users}
        />
      )}
      
      {isOptimizerOpen && (
          <RouteOptimizerModal
            packages={pendingPackages}
            onClose={() => setIsOptimizerOpen(false)}
            onApplyRoute={handleApplyOptimizedRoute}
            userLocation={currentLocation}
          />
      )}
    </div>
  );
};

export default DriverDashboard;