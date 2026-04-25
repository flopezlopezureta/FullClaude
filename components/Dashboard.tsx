
import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import type { Package, User } from '../types';
import { PackageStatus, Role, UserStatus } from '../constants';
import { api, PackageCreationData, PackageUpdateData } from '../services/api';
import PackageList from './PackageList';
import PackageDetailModal from './PackageDetailModal';
import AssignDriverModal from './AssignDriverModal';
import CreatePackageModal from './modals/CreatePackageModal';
import EditPackageModal from './modals/EditPackageModal';
import { AuthContext } from '../contexts/AuthContext';
import PackageFilters from './admin/PackageFilters';
import ShippingLabelModal from './client/ShippingLabelModal';
import BatchShippingLabelModal from './client/BatchShippingLabelModal';
import { IconPrinter, IconTrash, IconChevronLeft, IconChevronRight, IconChevronDown, IconFileSpreadsheet, IconUserPlus, IconLoader, IconMercadoLibre, IconShopify, IconArchive, IconCheckCircle, IconRefresh } from './Icon';

// Sort direction icon inline components
const IconSortAsc = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m10 4l-4-4m0 0l-4 4m4-4v12" />
  </svg>
);
const IconSortDesc = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m10-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);
import DeletePasswordModal from './admin/DeletePasswordModal';
import ImportPackagesModal from './client/ImportPackagesModal';
import BulkAssignDriverModal from './modals/BulkAssignDriverModal';
import ExportFormatModal from './modals/ExportFormatModal';
import QuickStatusModal from './modals/QuickStatusModal';
import { exportToExcel, exportToCSV } from '../services/exportService';

// Fix: declare Chart.js if needed

const customCheckboxClass = "appearance-none h-4 w-4 border border-[var(--border-secondary)] rounded bg-[var(--background-secondary)] checked:bg-[var(--brand-primary)] checked:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] checked:bg-[url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")]";

const statusOptions: { label: string; value: string | null }[] = [
    { label: 'Todos', value: null },
    { label: 'Cerrados', value: 'closed' },
    { label: 'Pendiente', value: PackageStatus.Pending },
    { label: 'Retirado', value: PackageStatus.PickedUp },
    { label: 'En Tránsito', value: PackageStatus.InTransit },
    { label: 'Entregado', value: PackageStatus.Delivered },
    { label: 'Retrasado', value: PackageStatus.Delayed },
    { label: 'Problema', value: PackageStatus.Problem },
    { label: 'Pend. Devolución', value: PackageStatus.ReturnPending },
    { label: 'Devuelto', value: PackageStatus.Returned },
    { label: 'Cancelado', value: PackageStatus.Cancelled },
    { label: 'Reprogramado', value: PackageStatus.Rescheduled },
];


const Dashboard: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [totalPackages, setTotalPackages] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [assigningPackage, setAssigningPackage] = useState<Package | null>(null);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [isDeletePasswordModalOpen, setIsDeletePasswordModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isQuickStatusModalOpen, setIsQuickStatusModalOpen] = useState(false);
  const [printingPackages, setPrintingPackages] = useState<Package[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncingMeli, setIsSyncingMeli] = useState(false);
  const [isSyncingShopify, setIsSyncingShopify] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<{ 
    nextPollTime: number; 
    isPolling: boolean; 
    intervalMs: number; 
    pollingStartTime?: number | null;
    totalPackages?: number;
    processedPackages?: number;
  } | null>(null);
  const [shopifyPollingStatus, setShopifyPollingStatus] = useState<{ 
    nextPollTime: number; 
    isPolling: boolean; 
    intervalMs: number; 
    pollingStartTime?: number | null;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [shopifyTimeLeft, setShopifyTimeLeft] = useState<number>(0);

  // Selection and Pagination states
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // desc = más nuevo primero (default)
  const [isForcingClose, setIsForcingClose] = useState(false);

  // Filter and View states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [flexFilter, setFlexFilter] = useState<'all' | 'flexed' | 'not_flexed'>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'closed' | 'cancelled' | 'rescheduled'>('all');
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [communeFilter, setCommuneFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  

  const handleForceCloseOld = async () => {
    const cutoffDays = 30;
    if (!window.confirm(`¿Estás seguro de cerrar forzosamente todos los envíos con más de ${cutoffDays} días sin actualización? Esta acción no se puede deshacer.`)) return;
    setIsForcingClose(true);
    try {
        const res = await api.forceCloseOldPackages(cutoffDays);
        alert(`Cierre forzoso completado. ${res.updatedCount ?? 0} envíos cerrados.`);
        fetchData();
    } catch (err: any) {
        alert(err.message || 'Error al forzar el cierre de envíos antiguos.');
    } finally {
        setIsForcingClose(false);
    }
  };

  const handleBulkMarkDelivered = async () => {
      if (selectedPackages.size === 0) return;
      if (!window.confirm(`¿Estás seguro de marcar ${selectedPackages.size} paquetes como ENTREGADOS? Esto también los marcará como facturados.`)) return;
      
      try {
          const packageIds = Array.from(selectedPackages);
          await api.bulkUpdatePackageStatus(packageIds, PackageStatus.Delivered);
          alert('Paquetes actualizados con éxito.');
          setSelectedPackages(new Set());
          fetchData();
      } catch (err: any) {
          alert(err.message || 'Error al actualizar paquetes masivamente.');
      }
  };

  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const auth = useContext(AuthContext);

  useEffect(() => {
    const fetchPollingStatus = async () => {
      if (auth?.user?.role !== Role.Admin) return;
      try {
        const [meliStatus, shopifyStatus] = await Promise.all([
            api.getMeliPollingStatus(),
            api.getShopifyPollingStatus()
        ]);
        setPollingStatus(meliStatus);
        setShopifyPollingStatus(shopifyStatus);
      } catch (err) {
        console.error('Error fetching polling status:', err);
      }
    };

    fetchPollingStatus();
    const interval = setInterval(fetchPollingStatus, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [auth?.user?.role]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (pollingStatus) {
        const remaining = Math.max(0, Math.ceil((pollingStatus.nextPollTime - Date.now()) / 1000));
        setTimeLeft(remaining);
      } else {
        setTimeLeft(0);
      }
      if (shopifyPollingStatus) {
        const remainingShopify = Math.max(0, Math.ceil((shopifyPollingStatus.nextPollTime - Date.now()) / 1000));
        setShopifyTimeLeft(remainingShopify);
      } else {
        setShopifyTimeLeft(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [pollingStatus, shopifyPollingStatus]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const params = {
            page: currentPage,
            limit: itemsPerPage,
            searchQuery,
            statusFilter: statusFilter.length > 0 ? statusFilter.join(',') : null,
            driverFilter,
            clientFilter,
            communeFilter,
            cityFilter,
            startDate,
            endDate,
            flexFilter,
            quickFilter,
            sortOrder,
        };
        const [packagesResult, allUsers] = await Promise.all([
            api.getPackages(params),
            api.getUsers()
        ]);
        
        const pkgs = packagesResult?.packages || [];
        const total = packagesResult?.total || 0;
        
        setPackages(Array.isArray(pkgs) ? pkgs : []);
        setTotalPackages(total);
        setUsers(Array.isArray(allUsers) ? allUsers : []);
    } catch (error: any) {
        console.error("Failed to fetch data", error);
        alert("Error al cargar los datos: " + (error.message || "Error desconocido"));
    } finally {
        setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchQuery, statusFilter, driverFilter, clientFilter, communeFilter, cityFilter, startDate, endDate, flexFilter, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
            setIsStatusDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetFiltersForNewData = () => {
      setSearchQuery('');
      setStatusFilter([]);
      setFlexFilter('all');
      setQuickFilter('all');
      setDriverFilter('');
      setClientFilter('');
      setCommuneFilter('');
      setCityFilter('');
      setStartDate('');
      setEndDate('');
      setCurrentPage(1);
  };

  const handleCreatePackage = async (data: Omit<PackageCreationData, 'origin'>) => {
    if (!auth?.user) {
      console.error("Cannot create package: user not authenticated.");
      return;
    }
    try {
        await api.createPackage({
          ...data,
          origin: 'Centro de Distribución', // Admins create from a central location
        });
        
        resetFiltersForNewData();
        fetchData();
        
        setIsCreateModalOpen(false);
    } catch (error: any) {
        console.error("Failed to create package", error);
        alert("Error al crear el paquete: " + (error.message || "Error desconocido"));
    }
  };

  const handleImportPackages = async (packagesToCreate: Omit<PackageCreationData, 'origin' | 'creatorId'>[], selectedClientId?: string) => {
      if (!selectedClientId) return;
      
      const client = users.find(u => u.id === selectedClientId);
      const origin = client?.pickupAddress || client?.address || 'Centro de Distribución';

      const fullPackagesData: PackageCreationData[] = packagesToCreate.map(p => ({
          ...p,
          origin,
          creatorId: selectedClientId,
      }));

      try {
          const result = await api.createMultiplePackages(fullPackagesData);
          resetFiltersForNewData();
          fetchData();
          // We don't close the modal here anymore, we let the modal handle the result
          return result;
      } catch (error) {
          console.error("Failed to import packages", error);
          throw error;
      }
  };

  const handleUpdatePackage = async (pkgId: string, data: PackageUpdateData) => {
    try {
      await api.updatePackage(pkgId, data);
      await fetchData(); // Refetch to see the changes
      setEditingPackage(null);
    } catch (error: any) {
      console.error("Failed to update package", error);
      alert("Error al actualizar el paquete: " + (error.message || "Error desconocido"));
    }
  };
  
  const handleAssignDriver = async (pkgId: string, driverId: string | null, newDeliveryDate: Date) => {
    try {
      await api.assignDriverToPackage(pkgId, driverId, newDeliveryDate);
      await fetchData(); // Refetch to see the changes
      setAssigningPackage(null);
    } catch (error: any) {
      console.error("Failed to assign driver", error);
      alert("Error al asignar conductor: " + (error.message || "Error desconocido"));
    }
  };

  const handleBulkAssignDriver = async (driverId: string | null, newDeliveryDate: Date) => {
    const idsToAssign: string[] = Array.from(selectedPackages);
    if (idsToAssign.length === 0) return;

    try {
        await api.batchAssignDriverToPackages(idsToAssign, driverId, newDeliveryDate);
        fetchData(); // Refetch data to show changes
        setSelectedPackages(new Set()); // Clear selection
        setIsBulkAssignModalOpen(false); // Close modal
    } catch (error) {
        console.error("Failed to bulk assign driver", error);
        alert("Ocurrió un error al asignar los paquetes.");
    }
  };

  const handleMarkForReturn = async (pkg: Package) => {
    try {
        await api.markPackageForReturn(pkg.id);
        fetchData(); // Refetch to see the changes
    } catch (error) {
        console.error("Failed to mark package for return", error);
        alert("Error al marcar el paquete para devolución.");
    }
  };

  const handleRefreshAll = async () => {
    try {
        await fetchData();
    } catch (error: any) {
        console.error("Failed to refresh all data", error);
        alert("Error al refrescar los datos: " + (error.message || "Error desconocido"));
    }
  };

  const handleTriggerMeliSync = async () => {
    if (isSyncingMeli) return;
    setIsSyncingMeli(true);
    try {
      await api.syncMeliPackages();
      // Status will be updated via the interval polling
    } catch (error: any) {
      console.error("Failed to trigger ML sync", error);
      alert("Error al iniciar sincronización ML: " + (error.message || "Error desconocido"));
    } finally {
      setIsSyncingMeli(false);
    }
  };

  const handleTriggerShopifySync = async () => {
    if (isSyncingShopify) return;
    setIsSyncingShopify(true);
    try {
      await api.syncShopifyPackages();
      // Status will be updated via the interval polling
    } catch (error: any) {
      console.error("Failed to trigger Shopify sync", error);
      alert("Error al iniciar sincronización Shopify: " + (error.message || "Error desconocido"));
    } finally {
      setIsSyncingShopify(false);
    }
  };

  const drivers = users.filter(u => u.role === Role.Driver && u.status === UserStatus.Approved);
  const clients = users.filter(u => u.role === Role.Client && u.status === UserStatus.Approved);

  const uniqueCommunes = useMemo(() => {
    if (!Array.isArray(packages)) return [];
    const communes = new Set(packages.map(p => p.recipientCommune).filter(Boolean));
    return Array.from(communes).sort((a: string, b: string) => a.localeCompare(b));
  }, [packages]);
  
  const uniqueCities = useMemo(() => {
    if (!Array.isArray(packages)) return [];
    const cities = new Set(packages.map(p => p.recipientCity).filter(Boolean));
    return Array.from(cities).sort((a: string, b: string) => a.localeCompare(b));
  }, [packages]);

    
  const handleExportData = async (format: 'excel' | 'csv' = 'csv') => {
    if (totalPackages === 0 || isExporting) return;
    
    setIsExporting(true);
    try {
        const { packages: allFiltered } = await api.getPackages({
            limit: 0,
            searchQuery, 
            statusFilter: statusFilter.length > 0 ? statusFilter.join(',') : null, 
            driverFilter, 
            clientFilter, 
            communeFilter, 
            cityFilter, 
            startDate, 
            endDate,
            flexFilter,
            quickFilter
        });

        let packagesToExport: Package[] = [];
        if (selectedPackages.size > 0) {
            packagesToExport = allFiltered.filter(p => selectedPackages.has(p.id));
        } else {
            packagesToExport = allFiltered;
        }

        if (packagesToExport.length === 0) {
            alert("No hay datos para exportar.");
            setIsExporting(false);
            return;
        }

        const dateStr = new Date().toISOString().split('T')[0];

        if (format === 'excel') {
            await exportToExcel(packagesToExport, `Reporte_Paquetes_${dateStr}.xlsx`, users);
        } else {
            exportToCSV(packagesToExport, `Reporte_Paquetes_${dateStr}.csv`, users);
        }

        setIsExportModalOpen(false);
    } catch(error) {
        console.error("Failed to export data", error);
        alert("Error al exportar los datos.");
    } finally {
        setIsExporting(false);
    }
  };


  useEffect(() => {
    setCurrentPage(1);
    setSelectedPackages(new Set());
  }, [searchQuery, statusFilter, driverFilter, communeFilter, cityFilter, clientFilter, itemsPerPage, startDate, endDate, flexFilter, quickFilter]);

  const handleSelectPackage = (pkg: Package) => {
    setSelectedPackages(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(pkg.id)) {
            newSelection.delete(pkg.id);
        } else {
            newSelection.add(pkg.id);
        }
        return newSelection;
    });
  };

  const isAllOnPageSelected = useMemo(() => {
    if (packages.length === 0) return false;
    return packages.every(p => selectedPackages.has(p.id));
  }, [packages, selectedPackages]);

  const handleSelectAllOnPageClick = () => {
    const pageIds = new Set(packages.map(p => p.id));
    if (isAllOnPageSelected) {
        setSelectedPackages(prev => {
            const newSelection = new Set(prev);
            pageIds.forEach(id => newSelection.delete(id));
            return newSelection;
        });
    } else {
        setSelectedPackages(prev => new Set([...prev, ...pageIds]));
    }
  };

  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) {
        const someSelectedOnPage = packages.some(p => selectedPackages.has(p.id));
        checkboxRef.current.indeterminate = someSelectedOnPage && !isAllOnPageSelected;
    }
  }, [selectedPackages, packages, isAllOnPageSelected]);

  const selectedPackageObjects = useMemo(() => {
    if (!Array.isArray(packages)) return [];
    return packages.filter(p => selectedPackages.has(p.id));
  }, [packages, selectedPackages]);

  const canDeleteSelected = useMemo(() => {
      if (selectedPackageObjects.length === 0) return false;
      return selectedPackageObjects.every(p => p.status === PackageStatus.Pending);
  }, [selectedPackageObjects]);

  const handleDeleteSelected = async (enteredPassword?: string) => {
    if (!enteredPassword) {
        alert('Debes ingresar la contraseña para continuar.');
        return;
    }
    try {
      const idsToDelete = [...selectedPackages].filter(id => {
          const pkg = packages.find(p => p.id === id);
          return pkg && pkg.status === PackageStatus.Pending;
      });

      if (idsToDelete.length === 0) {
        setIsDeletePasswordModalOpen(false);
        return;
      }

      for (const id of idsToDelete) {
          await api.deletePackage(id, enteredPassword);
      }
      
      setSelectedPackages(new Set());
      setIsDeletePasswordModalOpen(false);
      await fetchData(); // Refetch data
    } catch (error: any) {
      console.error("Failed to delete selected packages", error);
      if (error.status === 401 || error.status === 403) {
          alert('Contraseña incorrecta.');
      } else {
          alert("Error al eliminar los paquetes: " + (error.message || "Error desconocido"));
      }
    }
  };

  const isDateFiltering = startDate !== '' || endDate !== '';

  return (
    <div>
      <div className="bg-[var(--background-secondary)] shadow-md rounded-lg">
        <PackageFilters
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onRefresh={handleRefreshAll}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            drivers={drivers}
            driverFilter={driverFilter}
            onDriverChange={setDriverFilter}
            communes={uniqueCommunes}
            communeFilter={communeFilter}
            onCommuneChange={setCommuneFilter}
            cities={uniqueCities}
            cityFilter={cityFilter}
            onCityChange={setCityFilter}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            flexFilter={flexFilter}
            onFlexFilterChange={setFlexFilter}
            quickFilter={quickFilter}
            onQuickFilterChange={setQuickFilter}
            isSyncing={isLoading}
            clients={clients}
            clientFilter={clientFilter}
            onClientChange={setClientFilter}
            onOpenQuickStatus={() => setIsQuickStatusModalOpen(true)}
        />
      </div>

        <div className="flex flex-col gap-3 p-3 border-b border-[var(--border-primary)]">
            <div className="flex flex-wrap items-center justify-between w-full">
                <div className="flex items-center gap-4">
                    <input
                        type="checkbox"
                        ref={checkboxRef}
                        className={customCheckboxClass}
                        checked={isAllOnPageSelected}
                        onChange={handleSelectAllOnPageClick}
                        disabled={packages.length === 0}
                    />
                    <div className="h-6 w-px bg-[var(--border-primary)]"></div>
                    {auth?.user?.role === Role.Admin && pollingStatus && (
                        <div 
                            title={pollingStatus.isPolling && pollingStatus.pollingStartTime ? `Iniciado hace ${Math.floor((Date.now() - pollingStatus.pollingStartTime)/1000)}s` : "Mercado Libre Status - Click para sincronizar ahora"}
                            className={`flex items-center gap-2 px-3 py-1 bg-white border ${auth?.systemSettings?.meliAutoImport ? 'border-blue-400 text-blue-700' : 'border-gray-300 text-gray-500'} rounded-full text-[10px] font-black shadow-sm cursor-pointer hover:bg-blue-50 transition-all uppercase tracking-tighter ${auth?.systemSettings?.meliAutoImport && pollingStatus.isPolling ? 'animate-pulse-glow-blue' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleTriggerMeliSync(); }}
                        >
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${auth?.systemSettings?.meliAutoImport ? 'text-blue-600' : 'text-gray-400'}`}>
                                <IconMercadoLibre className="w-full h-full" />
                            </div>
                            <span className="whitespace-nowrap">
                                {auth?.systemSettings?.meliAutoImport 
                                    ? (pollingStatus.isPolling 
                                        ? (pollingStatus.totalPackages && pollingStatus.totalPackages > 0 
                                            ? `ML: ${pollingStatus.processedPackages}/${pollingStatus.totalPackages}` 
                                            : 'ML: Sincronizando...') 
                                        : `ML: ${timeLeft}s`) 
                                    : 'ML: Inactivo'}
                            </span>
                            {(pollingStatus.isPolling || isSyncingMeli) && <IconLoader className="w-3 h-3 animate-spin" />}
                             <div className={`ml-1 w-1.5 h-1.5 rounded-full ${auth?.systemSettings?.meliAutoImport ? 'bg-blue-400 animate-pulse' : 'bg-gray-300'}`}></div>
                        </div>
                    )}

                    {auth?.user?.role === Role.Admin && pollingStatus && shopifyPollingStatus && (
                        <div className="h-6 w-px bg-[var(--border-primary)] opacity-30"></div>
                    )}

                    {/* Shopify Polling Status */}
                    {auth?.user?.role === Role.Admin && shopifyPollingStatus && (
                        <div 
                            title={shopifyPollingStatus.isPolling && shopifyPollingStatus.pollingStartTime ? `Iniciado hace ${Math.floor((Date.now() - shopifyPollingStatus.pollingStartTime)/1000)}s` : "Shopify Status - Click para sincronizar ahora"}
                            className={`flex items-center gap-2 px-3 py-1 bg-white border ${auth?.systemSettings?.shopifyAutoImport ? 'border-emerald-400 text-emerald-700' : 'border-gray-300 text-gray-500'} rounded-full text-[10px] font-black shadow-sm cursor-pointer hover:bg-emerald-50 transition-all uppercase tracking-tighter ${auth?.systemSettings?.shopifyAutoImport && shopifyPollingStatus.isPolling ? 'animate-pulse-glow-emerald' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleTriggerShopifySync(); }}
                        >
                            <IconShopify className={`w-4 h-4 ${auth?.systemSettings?.shopifyAutoImport ? 'text-emerald-600' : 'text-gray-400'}`} />
                            <span className="whitespace-nowrap">
                                {auth?.systemSettings?.shopifyAutoImport 
                                    ? (shopifyPollingStatus.isPolling ? 'Shopify: Sincronizando' : `Shopify: ${shopifyTimeLeft}s`) 
                                    : 'Shopify: Inactivo'}
                            </span>
                            {(shopifyPollingStatus.isPolling || isSyncingShopify) && <IconLoader className="w-3 h-3 animate-spin" />}
                             <div className={`ml-1 w-1.5 h-1.5 rounded-full ${auth?.systemSettings?.shopifyAutoImport ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`}></div>
                        </div>
                    )}
                    <div className="h-6 w-px bg-[var(--border-primary)] opacity-50"></div>
                    <div className="flex items-center gap-2">
                        {selectedPackages.size > 0 && (
                            <span className="text-xs font-bold text-blue-600 mr-2 tracking-tight uppercase">{selectedPackages.size} seleccionados</span>
                        )}
                        <button 
                            onClick={() => setIsBulkAssignModalOpen(true)}
                            disabled={selectedPackages.size > 0 ? false : true}
                            title="Asignar Conductor" 
                            className={`p-2.5 rounded-lg transition-all ${selectedPackages.size > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-200 opacity-50 cursor-not-allowed'}`}
                        >
                            <IconUserPlus className={`w-6 h-6 ${selectedPackages.size > 0 ? 'text-white' : 'text-gray-500'}`} />
                        </button>
                        <button 
                            onClick={() => setPrintingPackages(selectedPackageObjects)} 
                            title="Imprimir Etiquetas" 
                            className={`p-2.5 rounded-lg transition-all ${selectedPackages.size > 0 ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-200 opacity-50 cursor-not-allowed'}`}
                            disabled={selectedPackages.size > 0 ? false : true}>
                            <IconPrinter className={`w-6 h-6 ${selectedPackages.size > 0 ? 'text-white' : 'text-gray-500'}`} />
                        </button>
                        <button 
                            onClick={() => setIsDeletePasswordModalOpen(true)} 
                            disabled={!canDeleteSelected} 
                            title="Eliminar Seleccionados" 
                            className={`p-2.5 rounded-lg transition-all ${canDeleteSelected ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-200 opacity-50 cursor-not-allowed'}`}>
                            <IconTrash className={`w-6 h-6 ${canDeleteSelected ? 'text-white' : 'text-gray-500'}`} />
                        </button>
                        <button 
                            onClick={() => setIsExportModalOpen(true)} 
                            title={selectedPackages.size > 0 ? "Exportar Seleccionados" : "Exportar Vista"} 
                            className={`p-2.5 rounded-lg transition-all ${totalPackages > 0 && !isExporting ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-200 opacity-50 cursor-not-allowed'} ${isExporting ? 'animate-pulse' : ''}`}
                            disabled={totalPackages === 0 || isExporting}>
                            {isExporting ? (
                                <IconLoader className="w-6 h-6 text-white animate-spin" />
                            ) : (
                                <IconFileSpreadsheet className={`w-6 h-6 ${totalPackages > 0 ? 'text-white' : 'text-gray-500'}`} />
                            )}
                        </button>

                        {/* Nueva acción masiva: Marcar como Entregado */}
                        {auth?.user?.role === Role.Admin && (
                            <button 
                                onClick={handleBulkMarkDelivered}
                                disabled={selectedPackages.size === 0}
                                title="Entrega Masiva (Marcar Seleccionados)"
                                className={`p-2.5 rounded-lg transition-all ${selectedPackages.size > 0 ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-gray-200 opacity-50 cursor-not-allowed'} shadow-sm border border-cyan-700/20`}
                            >
                                <IconCheckCircle className={`w-6 h-6 ${selectedPackages.size > 0 ? 'text-white' : 'text-gray-400'}`} />
                            </button>
                        )}

                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Ver:</label>
                        <div className="relative w-44" ref={statusDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                            className="w-full border border-gray-300 rounded-lg py-1.5 pl-3 pr-8 text-xs font-bold text-left focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white shadow-sm"
                            aria-haspopup="listbox"
                            aria-expanded={isStatusDropdownOpen}
                        >
                            <span className="block truncate">
                                {statusFilter.length === 0 
                                    ? 'Todos los estados' 
                                    : statusFilter.length === 1 
                                        ? statusOptions.find(o => o.value === statusFilter[0])?.label 
                                        : `${statusFilter.length} estados`}
                            </span>
                            <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                <IconChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                            </span>
                        </button>
                        {isStatusDropdownOpen && (
                            <ul className="absolute z-20 mt-1 w-full bg-[var(--background-secondary)] shadow-xl rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm text-[var(--text-primary)] max-h-60 overflow-auto">
                                <li
                                    onClick={() => setStatusFilter([])}
                                    className={`cursor-pointer select-none relative py-2 pl-3 pr-4 hover:bg-[var(--background-hover)] transition-colors flex items-center gap-2 ${statusFilter.length === 0 ? 'bg-[var(--background-hover)] font-bold' : ''}`}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={statusFilter.length === 0} 
                                        readOnly 
                                        className={customCheckboxClass}
                                    />
                                    Todos
                                </li>
                                {statusOptions.filter(o => o.value !== null).map(({ label, value }) => (
                                    <li
                                        key={label}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setStatusFilter(prev => {
                                                if (prev.includes(value as PackageStatus)) {
                                                    return prev.filter(s => s !== value);
                                                } else {
                                                    return [...prev, value as PackageStatus];
                                                }
                                            });
                                        }}
                                        className={`cursor-pointer select-none relative py-2.5 pl-3 pr-4 transition-colors flex items-center gap-3 ${
                                            statusFilter.includes(value as PackageStatus) 
                                            ? 'bg-[var(--brand-muted)] text-[var(--brand-text)]' 
                                            : 'hover:bg-[var(--background-hover)] text-[var(--text-primary)]'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={statusFilter.includes(value as PackageStatus)} 
                                            readOnly 
                                            className={customCheckboxClass}
                                        />
                                        <span className="font-bold text-[11px] uppercase tracking-wider">
                                            {label}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

            </div>

            </div>
        </div>

        {/* Separator / Decoration Line */}
        <div className="px-3">
             <div className="h-px w-full bg-gray-100"></div>
        </div>

        <div className="p-3 bg-gray-50 bg-opacity-30">
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <label htmlFor="items-per-page-admin" className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Filas por página</label>
                        <select
                            id="items-per-page-admin"
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className="bg-white border border-gray-300 text-gray-900 rounded-md py-1 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                            aria-label="Filas por página"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 font-bold whitespace-nowrap">
                            {Math.min((currentPage - 1) * itemsPerPage + 1, totalPackages)}-{Math.min(currentPage * itemsPerPage, totalPackages)} de {totalPackages}
                        </span>
                        <div className="flex items-center bg-gray-100 rounded-md p-1 border border-gray-200">
                            <button onClick={() => setCurrentPage(prev => prev - 1)} disabled={currentPage === 1} className="p-1 hover:bg-white rounded disabled:opacity-30 transition-all" aria-label="Página anterior">
                                <IconChevronLeft className="w-4 h-4" />
                            </button>
                            <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage * itemsPerPage >= totalPackages} className="p-1 hover:bg-white rounded disabled:opacity-30 transition-all" aria-label="Página siguiente">
                                <IconChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Sort Order Toggle */}
                    <button
                        id="sort-order-toggle"
                        onClick={() => { setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); setCurrentPage(1); }}
                        title={sortOrder === 'desc' ? 'Mostrando más nuevos primero. Click para ver más antiguos primero.' : 'Mostrando más antiguos primero. Click para ver más nuevos primero.'}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-sm transition-all ${
                            sortOrder === 'asc'
                                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        {sortOrder === 'desc' ? (
                            <><IconSortDesc className="w-3.5 h-3.5" /> Más nuevos</>  
                        ) : (
                            <><IconSortAsc className="w-3.5 h-3.5" /> Más antiguos</>
                        )}
                    </button>

                </div>

                <div className="flex items-center">
                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em] bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 shadow-sm">
                        TOTAL DE PAQUETES EN SISTEMA: {totalPackages}
                    </span>
                </div>
            </div>
        </div>

        <PackageList 
          packages={packages} 
          users={users}
          isLoading={isLoading}
          onSelectPackage={setSelectedPackage}
          onAssignPackage={auth?.user?.role === 'ADMIN' ? setAssigningPackage : undefined}
          onEditPackage={auth?.user?.role === 'ADMIN' ? setEditingPackage : undefined}
          onDeletePackage={(pkg) => { setSelectedPackages(new Set([pkg.id])); setIsDeletePasswordModalOpen(true); }}
          onPrintLabel={(pkg) => setPrintingPackages([pkg])}
          onMarkForReturn={auth?.user?.role === 'ADMIN' ? handleMarkForReturn : undefined}
          isFiltering={searchQuery !== '' || statusFilter.length > 0 || driverFilter !== '' || communeFilter !== '' || cityFilter !== '' || startDate !== '' || endDate !== '' || flexFilter !== 'all' || quickFilter !== 'all'}
          isDateFiltering={isDateFiltering}
          selectedPackages={selectedPackages}
          onSelectionChange={handleSelectPackage}
        />

      {/* --- Modals --- */}
      {selectedPackage && (
        <PackageDetailModal 
            pkg={selectedPackage} 
            onClose={() => setSelectedPackage(null)} 
            creator={users.find(u => u.id === selectedPackage.creatorId)}
            companyName={auth?.systemSettings.companyName}
            onUpdatePackage={(updatedPkg) => {
                setPackages(prev => prev.map(p => p.id === updatedPkg.id ? updatedPkg : p));
                setSelectedPackage(updatedPkg);
            }}
        />
      )}
      {assigningPackage && (
        <AssignDriverModal
            pkg={assigningPackage}
            drivers={drivers}
            onClose={() => setAssigningPackage(null)}
            onAssign={handleAssignDriver}
        />
      )}
      {isBulkAssignModalOpen && (
        <BulkAssignDriverModal
            packageCount={selectedPackages.size}
            drivers={drivers}
            onClose={() => setIsBulkAssignModalOpen(false)}
            onAssign={handleBulkAssignDriver}
        />
      )}
      {isCreateModalOpen && (
        <CreatePackageModal
            onClose={() => setIsCreateModalOpen(false)}
            onCreate={handleCreatePackage}
            clients={clients}
        />
      )}
      {isImportModalOpen && (
        <ImportPackagesModal
            onClose={() => setIsImportModalOpen(false)}
            onImport={handleImportPackages}
            clients={clients}
        />
      )}
      {editingPackage && (
        <EditPackageModal
            pkg={editingPackage}
            onClose={() => setEditingPackage(null)}
            onUpdate={handleUpdatePackage}
        />
      )}
      {isDeletePasswordModalOpen && (
        <DeletePasswordModal
            onClose={() => setIsDeletePasswordModalOpen(false)}
            onConfirm={(pass) => handleDeleteSelected(pass)}
        />
      )}
      {isExportModalOpen && (
        <ExportFormatModal
            onClose={() => setIsExportModalOpen(false)}
            onSelect={handleExportData}
            isExporting={isExporting}
        />
      )}
      {isQuickStatusModalOpen && (
        <QuickStatusModal
            onClose={() => setIsQuickStatusModalOpen(false)}
            onViewDetails={(pkg) => {
                setSelectedPackage(pkg);
                setIsQuickStatusModalOpen(false);
            }}
        />
      )}
      {printingPackages.length > 0 && auth?.user && (
          printingPackages.length === 1 ? (
              <ShippingLabelModal
                pkg={printingPackages[0]}
                creatorName={(() => {
                  const user = users.find(u => u.id === printingPackages[0].creatorId);
                  return user?.companyName || user?.name || 'Cliente Desconocido';
                })()}
                onClose={() => setPrintingPackages([])}
              />
          ) : (
              <BatchShippingLabelModal
                packages={printingPackages}
                creatorName={(() => {
                  const user = users.find(u => u.id === printingPackages[0].creatorId);
                  return user?.companyName || user?.name || 'Cliente Desconocido';
                })()}
                onClose={() => setPrintingPackages([])}
              />
          )
      )}

    </div>
  );
};

export default Dashboard;
