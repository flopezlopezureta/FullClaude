
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
import { IconPrinter, IconTrash, IconChevronLeft, IconChevronRight, IconChevronDown, IconFileSpreadsheet, IconUserPlus, IconLoader, IconMercadoLibre } from './Icon';
import DeletePasswordModal from './admin/DeletePasswordModal';
import ImportPackagesModal from './client/ImportPackagesModal';
import BulkAssignDriverModal from './modals/BulkAssignDriverModal';
import ExportFormatModal from './modals/ExportFormatModal';
import { exportToExcel, exportToCSV } from '../services/exportService';

// Fix: declare Chart.js if needed

const customCheckboxClass = "appearance-none h-4 w-4 border border-[var(--border-secondary)] rounded bg-[var(--background-secondary)] checked:bg-[var(--brand-primary)] checked:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] checked:bg-[url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")]";

const statusOptions: { label: string; value: PackageStatus | null }[] = [
    { label: 'Todos', value: null },
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

const getStatusSelectStyles = (status: PackageStatus | null): string => {
    if (status === null) return 'bg-[var(--background-secondary)] border-[var(--border-secondary)] text-[var(--text-primary)]';
    const slug = status.toLowerCase().replace('_', '');
    return `bg-[var(--status-${slug}-bg)] border-[var(--status-${slug}-border)] text-[var(--status-${slug}-text)] font-medium`;
}

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
  const [printingPackages, setPrintingPackages] = useState<Package[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<{ nextPollTime: number; isPolling: boolean; intervalMs: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Selection and Pagination states
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Filter and View states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<PackageStatus[]>([]);
  const [flexFilter, setFlexFilter] = useState<'all' | 'flexed' | 'not_flexed' | 'closed' | 'cancelled' | 'rescheduled'>('all');
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [communeFilter, setCommuneFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const auth = useContext(AuthContext);

  useEffect(() => {
    const fetchPollingStatus = async () => {
      if (auth?.user?.role !== Role.Admin) return;
      try {
        const status = await api.getMeliPollingStatus();
        setPollingStatus(status);
      } catch (err) {
        console.error('Error fetching polling status:', err);
      }
    };

    fetchPollingStatus();
    const interval = setInterval(fetchPollingStatus, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [auth?.user?.role]);

  useEffect(() => {
    if (!pollingStatus) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((pollingStatus.nextPollTime - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [pollingStatus]);

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
        };
        const [{ packages: pkgs, total }, allUsers] = await Promise.all([
            api.getPackages(params),
            api.getUsers()
        ]);
        
        // Client-side filtering for Flex status
        let filtered = pkgs;
        if (flexFilter === 'flexed') {
            filtered = pkgs.filter(p => p.isFlexed === true);
        } else if (flexFilter === 'not_flexed') {
            filtered = pkgs.filter(p => p.isFlexed !== true);
        } else if (flexFilter === 'closed') {
            filtered = pkgs.filter(p => p.status === PackageStatus.Delivered || p.status === PackageStatus.Returned);
        } else if (flexFilter === 'cancelled') {
            filtered = pkgs.filter(p => p.status === PackageStatus.Cancelled);
        } else if (flexFilter === 'rescheduled') {
            filtered = pkgs.filter(p => p.status === PackageStatus.Rescheduled);
        }

        setPackages(filtered);
        setTotalPackages(total);
        setUsers(allUsers);
    } catch (error) {
        console.error("Failed to fetch data", error);
    } finally {
        setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchQuery, statusFilter, driverFilter, clientFilter, communeFilter, cityFilter, startDate, endDate, flexFilter]);

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
    await api.updatePackage(pkgId, data);
    fetchData(); // Refetch to see the changes
    setEditingPackage(null);
  };
  
  const handleAssignDriver = async (pkgId: string, driverId: string | null, newDeliveryDate: Date) => {
    await api.assignDriverToPackage(pkgId, driverId, newDeliveryDate);
    fetchData(); // Refetch to see the changes
    setAssigningPackage(null);
  };

  const handleBulkAssignDriver = async (driverId: string, newDeliveryDate: Date) => {
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

  const drivers = users.filter(u => u.role === Role.Driver && u.status === UserStatus.Approved);
  const clients = users.filter(u => u.role === Role.Client && u.status === UserStatus.Approved);

  const uniqueCommunes = useMemo(() => {
    const communes = new Set(packages.map(p => p.recipientCommune));
    return Array.from(communes).sort((a: string, b: string) => a.localeCompare(b));
  }, [packages]);
  
  const uniqueCities = useMemo(() => {
    const cities = new Set(packages.map(p => p.recipientCity));
    return Array.from(cities).sort((a: string, b: string) => a.localeCompare(b));
  }, [packages]);

  const handleExportRoute = async () => {
    if (!driverFilter || totalPackages === 0 || isExporting) return;
    const driver = drivers.find(d => d.id === driverFilter);
    if (!driver) return;

    setIsExporting(true);
    try {
            const { packages: allFilteredPackages } = await api.getPackages({ 
                limit: 0, 
                searchQuery, 
                statusFilter: statusFilter.length > 0 ? statusFilter.join(',') : null, 
                driverFilter, 
                clientFilter, 
                communeFilter, 
                cityFilter, 
                startDate, 
                endDate
            });

        const dateStr = new Date().toISOString().split('T')[0];
        const driverName = driver.name.replace(/\s+/g, '_');
        const escapeCsvField = (field: any) => `"${String(field || '').replace(/"/g, '""')}"`;
        const circuitHeaders = ['Address', 'Name'];
        const circuitRows = allFilteredPackages.map(p => [
            `${p.recipientAddress}, ${p.recipientCommune}, ${p.recipientCity}`,
            p.recipientName
        ].map(escapeCsvField).join(','));
        
        const csvContent = [circuitHeaders.join(','), ...circuitRows].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Circuit_${driverName}_${dateStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Failed to export route data", error);
        alert("Error al exportar la ruta.");
    } finally {
        setIsExporting(false);
    }
  };
    
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
            endDate
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
  }, [searchQuery, statusFilter, driverFilter, communeFilter, cityFilter, clientFilter, itemsPerPage, startDate, endDate, flexFilter]);

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
    return packages.filter(p => selectedPackages.has(p.id));
  }, [packages, selectedPackages]);

  const canDeleteSelected = useMemo(() => {
      if (selectedPackageObjects.length === 0) return false;
      return selectedPackageObjects.every(p => p.status === PackageStatus.Pending);
  }, [selectedPackageObjects]);

  const handleDeleteSelected = async () => {
    const idsToDelete = [...selectedPackages].filter(id => {
        const pkg = packages.find(p => p.id === id);
        return pkg && pkg.status === PackageStatus.Pending;
    });

    await Promise.all(idsToDelete.map(id => api.deletePackage(id)));
    
    setSelectedPackages(new Set());
    setIsDeletePasswordModalOpen(false);
    fetchData(); // Refetch data
  };

  const isDateFiltering = startDate !== '' || endDate !== '';

  return (
    <div>
      <div className="bg-[var(--background-secondary)] shadow-md rounded-lg">
        <PackageFilters 
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onRefresh={fetchData}
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
            onExportRoute={handleExportRoute}
            isExporting={isExporting}
            flexFilter={flexFilter}
            onFlexFilterChange={setFlexFilter}
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-3 border-b border-[var(--border-primary)]">
            <div className="flex flex-wrap items-center gap-4">
                <input
                    type="checkbox"
                    ref={checkboxRef}
                    className={customCheckboxClass}
                    checked={isAllOnPageSelected}
                    onChange={handleSelectAllOnPageClick}
                    disabled={packages.length === 0}
                />
                <div className="h-6 w-px bg-[var(--border-primary)]"></div>
                <div className="flex items-center gap-2">
                    {selectedPackages.size > 0 && (
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{selectedPackages.size} seleccionados</span>
                    )}
                    <button 
                        onClick={() => setIsBulkAssignModalOpen(true)}
                        disabled={selectedPackages.size === 0}
                        title="Asignar Conductor" 
                        className="p-2 rounded-full hover:bg-[var(--background-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <IconUserPlus className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                    <button 
                        onClick={() => setPrintingPackages(selectedPackageObjects)} 
                        title="Imprimir Etiquetas" 
                        className="p-2 rounded-full hover:bg-[var(--background-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selectedPackages.size === 0}>
                        <IconPrinter className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                    <button 
                        onClick={() => setIsDeletePasswordModalOpen(true)} 
                        disabled={!canDeleteSelected} 
                        title="Eliminar Seleccionados" 
                        className="p-2 rounded-full hover:bg-[var(--background-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <IconTrash className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                    <button 
                        onClick={() => setIsExportModalOpen(true)} 
                        title={selectedPackages.size > 0 ? "Exportar Seleccionados" : "Exportar Vista"} 
                        className={`p-2 rounded-full hover:bg-[var(--background-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isExporting ? 'animate-pulse bg-blue-50' : ''}`}
                        disabled={totalPackages === 0 || isExporting}>
                        {isExporting ? (
                            <IconLoader className="w-5 h-5 text-blue-600 animate-spin" />
                        ) : (
                            <IconFileSpreadsheet className="w-5 h-5 text-[var(--text-secondary)]" />
                        )}
                    </button>
                </div>

                {/* ML Polling Status */}
                {auth?.user?.role === Role.Admin && auth?.systemSettings?.meliAutoImport && pollingStatus && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-medium shadow-sm">
                        <IconMercadoLibre className="w-3.5 h-3.5" />
                        <span className="whitespace-nowrap">Próxima revisión ML: {timeLeft}s</span>
                        {pollingStatus.isPolling && <IconLoader className="w-3 h-3 animate-spin" />}
                    </div>
                )}
            </div>
            
            <div className="flex items-center justify-start flex-wrap gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-[var(--text-secondary)] whitespace-nowrap">Ver:</label>
                    <div className="relative w-48" ref={statusDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                            className="w-full border rounded-md py-1.5 pl-3 pr-8 text-sm text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-secondary)] transition-colors bg-[var(--background-secondary)] border-[var(--border-secondary)] text-[var(--text-primary)]"
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
                                        className={`cursor-pointer select-none relative py-2 pl-3 pr-4 hover:bg-[var(--background-hover)] transition-colors flex items-center gap-2 ${statusFilter.includes(value as PackageStatus) ? 'bg-[var(--background-hover)] font-bold' : ''}`}
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={statusFilter.includes(value as PackageStatus)} 
                                            readOnly 
                                            className={customCheckboxClass}
                                        />
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusSelectStyles(value as PackageStatus)}`}>
                                            {label}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <label htmlFor="client-filter-select" className="text-sm font-medium text-[var(--text-secondary)] whitespace-nowrap">Cliente:</label>
                    <select
                        id="client-filter-select"
                        value={clientFilter}
                        onChange={(e) => setClientFilter(e.target.value)}
                        className="w-48 border rounded-md py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-secondary)] transition-colors bg-[var(--background-secondary)] border-[var(--border-secondary)] text-[var(--text-primary)]"
                        aria-label="Filtrar por cliente"
                    >
                        <option value="">Todos los Clientes</option>
                        {clients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex-1 text-center">
                <span className="text-sm font-bold text-[var(--brand-primary)]">Total de paquetes en sistema: {totalPackages}</span>
            </div>

            {totalPackages > 0 && (
                <div className="text-sm text-[var(--text-secondary)]">
                    <div className="flex flex-wrap items-center justify-end gap-4">
                        <div className="flex items-center gap-2">
                            <label htmlFor="items-per-page-admin" className="text-[var(--text-secondary)] whitespace-nowrap">Filas por página:</label>
                            <select
                                id="items-per-page-admin"
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="bg-[var(--background-secondary)] border border-[var(--border-secondary)] text-[var(--text-primary)] rounded-md py-1 pl-2 pr-7 text-sm focus:ring-[var(--brand-secondary)] focus:border-[var(--brand-secondary)]"
                                aria-label="Filas por página"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        
                        <span className="whitespace-nowrap">
                            {Math.min((currentPage - 1) * itemsPerPage + 1, totalPackages)}-{Math.min(currentPage * itemsPerPage, totalPackages)} de {totalPackages}
                        </span>
                        <div className="flex items-center">
                            <button onClick={() => setCurrentPage(prev => prev - 1)} disabled={currentPage === 1} className="p-2 disabled:opacity-50" aria-label="Página anterior">
                                <IconChevronLeft className="w-5 h-5" />
                            </button>
                            <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage * itemsPerPage >= totalPackages} className="p-2 disabled:opacity-50" aria-label="Página siguiente">
                                <IconChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
          isFiltering={searchQuery !== '' || statusFilter.length > 0 || driverFilter !== '' || communeFilter !== '' || cityFilter !== '' || startDate !== '' || endDate !== '' || flexFilter !== 'all'}
          isDateFiltering={isDateFiltering}
          selectedPackages={selectedPackages}
          onSelectionChange={handleSelectPackage}
        />
      </div>

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
            onConfirm={handleDeleteSelected}
        />
      )}
      {isExportModalOpen && (
        <ExportFormatModal
            onClose={() => setIsExportModalOpen(false)}
            onSelect={handleExportData}
            isExporting={isExporting}
        />
      )}
      {printingPackages.length > 0 && auth?.user && (
          printingPackages.length === 1 ? (
              <ShippingLabelModal
                pkg={printingPackages[0]}
                creatorName={users.find(u => u.id === printingPackages[0].creatorId)?.name || 'Cliente Desconocido'}
                onClose={() => setPrintingPackages([])}
              />
          ) : (
              <BatchShippingLabelModal
                packages={printingPackages}
                creatorName={users.find(u => u.id === printingPackages[0].creatorId)?.name || 'Cliente Desconocido'}
                onClose={() => setPrintingPackages([])}
              />
          )
      )}
    </div>
  );
};

export default Dashboard;
