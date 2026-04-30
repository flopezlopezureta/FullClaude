import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { PackageStatus, MessagingPlan } from '../../constants';
import type { Package, User } from '../../types';
import { api, DeliveryConfirmationData } from '../../services/api';
import PackageList from '../PackageList';
import PackageDetailModal from '../PackageDetailModal';
import DeliveryConfirmationModal from './DeliveryConfirmationModal';
import UndeliveredModal from './UndeliveredModal';
import { AuthContext } from '../../contexts/AuthContext';
import { IconArchive, IconTruck, IconRoute, IconAlertTriangle, IconSearch, IconX, IconMapPin } from '../Icon';
import EndOfDayReportModal from '../modals/EndOfDayReportModal';


const DriverDashboard: React.FC = () => {
  const [myPackages, setMyPackages] = useState<Package[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [deliveringPackage, setDeliveringPackage] = useState<Package | null>(null);
  const [reportingProblemPackage, setReportingProblemPackage] = useState<Package | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEndOfDayModalOpen, setIsEndOfDayModalOpen] = useState(false);
  
  const auth = useContext(AuthContext);
  const isInitialLoad = useRef(true);
  const prevPackagesRef = useRef<Package[] | undefined>(undefined);

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
  
  const { pendingPackages, dailyHistoryPackages, unflexedCount, totalAssignedForToday } = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    // Base collections
    const allPending = myPackages.filter(p => 
        p.status !== PackageStatus.Delivered && p.status !== PackageStatus.Problem && p.status !== PackageStatus.Returned
    );

    const allHistory = myPackages.filter(p => {
        if (p.status !== PackageStatus.Delivered && p.status !== PackageStatus.Problem) return false;
        const closureEvent = p.history?.[0];
        if (!closureEvent) return false; 
        return new Date(closureEvent.timestamp).toDateString() === todayStr;
    });

    // Apply search filter
    const filterFn = (p: Package) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            p.id.toLowerCase().includes(term) ||
            p.recipientName.toLowerCase().includes(term) ||
            p.recipientAddress.toLowerCase().includes(term) ||
            (p.recipientCommune && p.recipientCommune.toLowerCase().includes(term))
        );
    };

    const pending = allPending.filter(filterFn);
    const history = allHistory.filter(filterFn);

    const unflexed = allPending.filter(p => !p.isFlexed).length; 
    
    // Solo contar asignados del día actual para el badge superior
    const assignedToday = myPackages.filter(p => {
        const dateToCheck = p.assignedAt || p.createdAt;
        if (!dateToCheck) return false;
        return new Date(dateToCheck).toDateString() === todayStr;
    }).length;

    return { 
        pendingPackages: pending, 
        dailyHistoryPackages: history, 
        unflexedCount: unflexed,
        totalAssignedForToday: assignedToday
    };
  }, [myPackages, searchTerm]);

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
              /* 
              } else if (auth.systemSettings.messagingPlan === MessagingPlan.Email && creator.email) {
                  const subject = `Paquete Entregado: ${updatedPackage.id}`;
                  const mailtoUrl = `mailto:${creator.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
                  window.location.href = mailtoUrl;
              */
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

  const handleRedelivery = async (pkg: Package) => {
    if (!window.confirm("¿Estás seguro de que deseas reintentar la entrega de este paquete? Se volverá a poner en tu lista de 'En Tránsito'.")) return;
    
    try {
        const updatedPackage = await api.updatePackage(pkg.id, { status: PackageStatus.InTransit });
        setMyPackages(prev => prev.map(p => p.id === pkg.id ? updatedPackage : p));
        setSelectedPackage(null); // Close modal
        
        // Add a success notification or toast if needed
        alert("Paquete devuelto a 'En Tránsito'.");
    } catch (error: any) {
        console.error("Failed to set redelivery", error);
        alert("Error al intentar reentrega: " + (error.message || "Error desconocido"));
    }
  };
  
  const handleExportRoute = async () => {
    if (!auth?.user || pendingPackages.length === 0 || isExporting) return;

    setIsExporting(true);
    try {
        const dateStr = getLocalDateString();
        const driverName = (auth?.user?.name || 'conductor').replace(/\s+/g, '_');

        // Export simplified CSV for Circuit with only Address and Name
        const escapeCsvField = (field: any) => {
            const str = String(field || '').replace(/"/g, '""');
            return `"${str}"`;
        };
        const circuitHeaders = ['Address'];
        
        const circuitRows = pendingPackages.map(p => [
            `${p.recipientAddress}, ${p.recipientCommune}`
        ].map(escapeCsvField).join(','));

        const csvContent = [circuitHeaders.join(','), ...circuitRows].join('\n');
        const filename = `Circuit_${driverName}_${dateStr}.csv`;
        const file = new File([`\uFEFF${csvContent}`], filename, { type: 'text/csv' });
        
        // Solo enviar direccion y comuna según solicitud
        const rawTextList = pendingPackages.map(p => `${p.recipientAddress}, ${p.recipientCommune}`).join('\n');

        // 1. INTEGRACION NATIVA ANDROID APP (Requiere App Actualizada)
        // @ts-ignore
        if (window.AndroidApp) {
            try {
                // @ts-ignore
                if (window.AndroidApp.downloadFile) {
                    // Generamos un CSV real para que Circuit lo abra como archivo
                    // @ts-ignore
                    window.AndroidApp.downloadFile(csvContent, filename);
                } else {
                    // Fallback para versiones que solo tienen shareText
                    // @ts-ignore
                    window.AndroidApp.shareText(rawTextList, "Ruta Circuit");
                }
                
                // Mostrar Toast elegante de 2 segundos para confirmación
                const toast = document.createElement("div");
                toast.textContent = "✅ rutas descargadas, importar en circuit";
                toast.style.position = "fixed";
                toast.style.bottom = "100px";
                toast.style.left = "50%";
                toast.style.transform = "translateX(-50%)";
                toast.style.backgroundColor = "var(--brand-primary, #4A90E2)";
                toast.style.color = "white";
                toast.style.padding = "14px 24px";
                toast.style.borderRadius = "50px";
                toast.style.boxShadow = "0 8px 16px rgba(0,0,0,0.15)";
                toast.style.zIndex = "9999";
                toast.style.fontWeight = "600";
                toast.style.fontSize = "15px";
                toast.style.whiteSpace = "nowrap";
                toast.style.transition = "opacity 0.4s ease-in-out";
                
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = "0";
                    setTimeout(() => document.body.removeChild(toast), 400);
                }, 2000);

                return; // Exito
            } catch (e) {
                console.error("Intento en App falló", e);
            }
        }

        // Fallback para Navegadores Web (PC o Chrome Mobile)
        const runFallback = async () => {
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

            // Toast de confirmación en Web
            const toast = document.createElement("div");
            toast.textContent = "✅ rutas descargadas, importar en circuit";
            toast.style.position = "fixed";
            toast.style.bottom = "100px";
            toast.style.left = "50%";
            toast.style.transform = "translateX(-50%)";
            toast.style.backgroundColor = "var(--brand-primary, #4A90E2)";
            toast.style.color = "white";
            toast.style.padding = "14px 24px";
            toast.style.borderRadius = "50px";
            toast.style.zIndex = "9999";
            
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = "0";
                setTimeout(() => document.body.removeChild(toast), 400);
            }, 2000);
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
      const otherPackages = myPackages.filter(p => !sortedPackages.find(sp => sp.id === p.id));
      setMyPackages([...sortedPackages, ...otherPackages]);
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
      <div className="flex items-center mb-4 px-4 gap-2">
        <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IconSearch className="h-4 w-4 text-[#007bff]" />
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-10 py-2 border border-[var(--border-primary)] rounded-xl bg-[var(--background-secondary)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#007bff]/50 focus:border-[#007bff] transition-all"
                placeholder="Buscar cliente, dirección..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
                <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#007bff] hover:text-[#0056b3] z-10"
                    type="button"
                >
                    <IconX className="h-5 w-5" />
                </button>
            )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
            {auth?.systemSettings.circuitExportEnabled && (
                <button
                    onClick={handleExportRoute}
                    disabled={pendingPackages.length === 0 || isExporting}
                    title={isExporting ? 'Enviando...' : 'Enviar a Circuit'}
                    className={`inline-flex items-center justify-center p-2 border border-transparent rounded-xl shadow-sm text-white bg-[#007bff] hover:bg-[#0056b3] disabled:bg-slate-400 disabled:cursor-not-allowed transition-all ${isExporting ? 'animate-pulse' : ''}`}
                >
                    {isExporting ? (
                        <IconRoute className="w-6 h-6 animate-spin" />
                    ) : (
                        <IconMapPin className="w-6 h-6" />
                    )}
                </button>
            )}
            
            <div className="bg-[var(--brand-primary)] text-[var(--text-on-brand)] text-[10px] font-bold px-2 py-2 rounded-xl whitespace-nowrap flex flex-col items-center justify-center leading-tight shadow-sm min-w-[65px]">
                <span className="opacity-80 text-[8px] uppercase tracking-tighter">Asignados</span>
                <span className="text-sm">{totalAssignedForToday}</span>
            </div>
        </div>
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
            onRedelivery={handleRedelivery}
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
    </div>
  );
};

export default DriverDashboard;