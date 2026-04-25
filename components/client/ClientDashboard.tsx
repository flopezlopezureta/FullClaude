
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { api, PackageCreationData } from '../../services/api';
import type { Package } from '../../types';
import { PackageSource, PackageStatus } from '../../constants';
import PackageList from '../PackageList';
import PackageDetailModal from '../PackageDetailModal';
import CreatePackageModal from '../modals/CreatePackageModal';
import ClientPackageFilters from './ClientPackageFilters';
import ShippingLabelModal from './ShippingLabelModal';
import BatchShippingLabelModal from './BatchShippingLabelModal';
import { IconPlus, IconChevronLeft, IconChevronRight, IconChevronDown, IconFileSpreadsheet, IconPrinter, IconTrash, IconDownload, IconFileText, IconShopify, IconMercadoLibre, IconJumpseller } from '../Icon';
import ImportPackagesModal from './ImportPackagesModal';
import ExternalImportModal from '../modals/ExternalImportModal';
import DeletePasswordModal from '../modals/DeletePasswordModal';
import ExportFormatModal from '../modals/ExportFormatModal';
import { exportToExcel, exportToCSV } from '../../services/exportService';
import ClientSettingsPage from './ClientSettingsPage';

const getISODate = (date: Date) => date.toISOString().split('T')[0];
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

const ClientDashboard: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [totalPackages, setTotalPackages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [importSource, setImportSource] = useState<PackageSource | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<Package | null>(null);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [printingPackages, setPrintingPackages] = useState<Package[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [isDeletePasswordModalOpen, setIsDeletePasswordModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'packages' | 'settings'>(() => {
    return (localStorage.getItem('clientActiveTab') as 'packages' | 'settings') || 'packages';
  });

  useEffect(() => {
    localStorage.setItem('clientActiveTab', activeTab);
  }, [activeTab]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PackageStatus[]>([]);
  const [flexFilter, setFlexFilter] = useState<'all' | 'flexed' | 'not_flexed'>('all');
  const [communeFilter, setCommuneFilter] = useState('');
  const [accountIdFilter, setAccountIdFilter] = useState('');
  
  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);
  const [startDate, setStartDate] = useState(getISODate(oneMonthAgo));
  const [endDate, setEndDate] = useState(getISODate(today));

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const auth = useContext(AuthContext);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = async () => {
    if (!auth?.user) return;
    setIsLoading(true);
    try {
        const params = {
            page: currentPage,
            limit: itemsPerPage,
            searchQuery,
            statusFilter,
            flexFilter,
            communeFilter,
            startDate,
            endDate,
            clientFilter: auth.user.id,
            accountId: accountIdFilter,
            sortOrder
        };
        const { packages: pkgs, total } = await api.getPackages(params);
        setPackages(pkgs);
        setTotalPackages(total);
    } catch (error: any) {
        console.error("Failed to fetch client packages", error);
        alert("Error al cargar los paquetes: " + (error.message || "Error desconocido"));
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedPackages(new Set()); // Reset selection on page or filter change
    if (activeTab === 'packages') {
        fetchData();
    }
  }, [auth?.user, currentPage, itemsPerPage, searchQuery, statusFilter, flexFilter, communeFilter, accountIdFilter, startDate, endDate, activeTab, sortOrder]);

  useEffect(() => {
    const fetchAccounts = async () => {
        if (!auth?.user) return;
        try {
            const accs = await api.getIntegrationAccounts();
            setAccounts(accs);
        } catch (error) {
            console.error("Failed to fetch integration accounts", error);
        }
    };
    fetchAccounts();
  }, [auth?.user]);

  const handleSelectAll = () => {
      setSelectedPackages(prev => {
          if (prev.size === packages.length) return new Set();
          return new Set(packages.map(p => p.id));
      });
  };

  const handleCreatePackage = async (data: Omit<PackageCreationData, 'origin'>) => {
    if (!auth?.user) return;
    try {
        const fullData: PackageCreationData = {
            ...data,
            creatorId: auth.user.id,
            origin: auth.user.pickupAddress || auth.user.address || 'Sin Origen',
        };
        const newPkg = await api.createPackage(fullData);
        setPrintingPackages([newPkg]);
        fetchData();
        setIsCreateModalOpen(false);
    } catch (error: any) {
        console.error("Failed to create package", error);
        alert(error.message || "Error al crear paquete");
    }
  };

  const handleUpdatePackage = async (id: string, data: Partial<PackageCreationData>) => {
    try {
        await api.updatePackage(id, data);
        fetchData();
        setEditingPackage(null);
    } catch (error: any) {
        console.error("Failed to update package", error);
        alert(error.message || "Error al actualizar paquete");
    }
  };

  const handleImportPackages = async (packagesToCreate: Omit<PackageCreationData, 'origin' | 'creatorId'>[]) => {
      if (!auth?.user) return;
      
      const fullPackagesData: PackageCreationData[] = packagesToCreate.map(p => ({
          ...p,
          origin: auth.user!.pickupAddress || auth.user!.address || 'Sin Origen',
          creatorId: auth.user!.id,
      }));

      try {
          const result = await api.createMultiplePackages(fullPackagesData);
          fetchData();
          return result;
      } catch (error: any) {
          console.error("Failed to import packages", error);
          throw error;
      }
  };

  const handleOpenExternalImport = (source: PackageSource) => {
      setImportSource(source);
      setIsImportMenuOpen(false);
  };

  const handleDeletePackages = async (enteredPassword?: string) => {
      if (!enteredPassword) {
          alert('Debes ingresar la contraseña para continuar.');
          return;
      }
      try {
          if (deletingPackage) {
              await api.deletePackage(deletingPackage.id, enteredPassword);
          } else {
              const idsToDelete = Array.from(selectedPackages);
              for (const id of idsToDelete) {
                  await api.deletePackage(id, enteredPassword);
              }
              setSelectedPackages(new Set());
          }
          setDeletingPackage(null);
          setIsDeletePasswordModalOpen(false);
          fetchData();
      } catch (error: any) {
          console.error("Failed to delete package(s)", error);
          if (error.status === 401 || error.status === 403) {
              alert('Contraseña incorrecta.');
          } else {
              alert("Error al eliminar: " + (error.message || "Error desconocido"));
          }
      }
  };

  const handleExportData = async (format: 'excel' | 'csv' = 'csv') => {
    if (!auth?.user || totalPackages === 0 || isExporting) return;
    
    setIsExporting(true);
    try {
        let packagesToExport: Package[] = [];

        if (selectedPackages.size > 0) {
            const { packages: allFiltered } = await api.getPackages({
                limit: 0,
                searchQuery, statusFilter, communeFilter, startDate, endDate,
                clientFilter: auth.user.id
            });
            packagesToExport = allFiltered.filter(p => selectedPackages.has(p.id));
        } else {
            const { packages: allFiltered } = await api.getPackages({
                limit: 0,
                searchQuery, statusFilter, communeFilter, startDate, endDate,
                clientFilter: auth.user.id
            });
            packagesToExport = allFiltered;
        }

        if (packagesToExport.length === 0) {
            alert("No hay datos para exportar.");
            setIsExporting(false);
            return;
        }

        const dateStr = new Date().toISOString().split('T')[0];

        if (format === 'excel') {
            await exportToExcel(packagesToExport, `Mis_Paquetes_${dateStr}.xlsx`);
        } else {
            exportToCSV(packagesToExport, `Mis_Paquetes_${dateStr}.csv`);
        }
        setIsExportModalOpen(false);
    } catch (error) {
        console.error("Export failed", error);
        alert("Error al exportar.");
    } finally {
        setIsExporting(false);
    }
  };

  const uniqueCommunes = useMemo(() => {
      const communes = new Set(packages.map(p => p.recipientCommune).filter(Boolean));
      return Array.from(communes).sort();
  }, [packages]);

  const handleSelectionChange = (pkg: Package) => {
      setSelectedPackages(prev => {
          const newSet = new Set(prev);
          if (newSet.has(pkg.id)) newSet.delete(pkg.id);
          else newSet.add(pkg.id);
          return newSet;
      });
  };

  const selectedPackageObjects = packages.filter(p => selectedPackages.has(p.id));

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">¡Bienvenido, {auth?.user?.name}!</h1>
                <div className="flex items-center gap-2">
                    <p className="text-sm text-[var(--text-muted)]">Gestiona tus envíos y seguimiento.</p>
                    {totalPackages > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                            📦 {totalPackages} paquetes históricos
                        </span>
                    )}
                </div>
            </div>
            
            {activeTab === 'packages' && (
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsExportModalOpen(true)} 
                        disabled={totalPackages === 0 || isExporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-emerald-600 text-emerald-700 font-bold rounded-lg shadow-sm hover:bg-emerald-50 transition-all disabled:opacity-50 uppercase text-xs tracking-widest"
                    >
                        <IconFileSpreadsheet className={`w-5 h-5 ${isExporting ? 'animate-spin' : ''}`}/>
                        {isExporting ? 'Exportando...' : 'Exportar Excel'}
                    </button>
                    
                    <div className="relative">
                        <button onClick={() => setIsImportMenuOpen(!isImportMenuOpen)} className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-indigo-600 text-indigo-700 font-bold rounded-lg shadow-sm hover:bg-indigo-50 transition-all uppercase text-xs tracking-widest">
                            <IconDownload className="w-5 h-5"/> Importar <IconChevronDown className="w-4 h-4"/>
                        </button>
                        {isImportMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl z-30 border border-gray-100 overflow-hidden animate-fade-in-up">
                                <div className="py-1">
                                    <button onClick={() => { setIsImportMenuOpen(false); setIsImportModalOpen(true); }} className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                                        <div className="p-1.5 bg-green-100 rounded-lg">
                                            <IconFileText className="w-4 h-4 text-green-600"/>
                                        </div>
                                        Excel / CSV
                                    </button>
                                    <div className="h-px bg-gray-100 mx-2 my-1"></div>
                                    <button onClick={() => handleOpenExternalImport(PackageSource.MercadoLibre)} className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                                        <div className="p-1.5 bg-yellow-100 rounded-lg">
                                            <IconMercadoLibre className="w-4 h-4 text-yellow-600"/>
                                        </div>
                                        Mercado Libre
                                    </button>
                                    <button onClick={() => handleOpenExternalImport(PackageSource.Shopify)} className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                                        <div className="p-1.5 bg-green-100 rounded-lg">
                                            <IconShopify className="w-4 h-4 text-green-600"/>
                                        </div>
                                        Shopify
                                    </button>
                                    <button onClick={() => handleOpenExternalImport(PackageSource.Jumpseller)} className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors">
                                        <div className="p-1.5 bg-sky-100 rounded-lg">
                                            <IconJumpseller className="w-4 h-4 text-sky-600"/>
                                        </div>
                                        Jumpseller
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-all uppercase text-xs tracking-widest">
                        <IconPlus className="w-5 h-5"/> Crear Paquete
                    </button>
                </div>
            )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border-primary)]">
            <button
                onClick={() => setActiveTab('packages')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'packages' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
                Mis Envíos
            </button>
            <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'settings' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
                Configuración
            </button>
        </div>

        {activeTab === 'settings' ? (
            <ClientSettingsPage />
        ) : (
            <>
                    <ClientPackageFilters 
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        startDate={startDate}
                        onStartDateChange={setStartDate}
                        endDate={endDate}
                        onEndDateChange={setEndDate}
                        communeFilter={communeFilter}
                        onCommuneChange={setCommuneFilter}
                        statusFilter={statusFilter}
                        onStatusChange={setStatusFilter}
                        flexFilter={flexFilter}
                        onFlexFilterChange={setFlexFilter}
                        communes={uniqueCommunes}
                        itemsPerPage={itemsPerPage}
                        onItemsPerPageChange={(val) => {
                            setItemsPerPage(val);
                            setCurrentPage(1);
                        }}
                        accountId={accountIdFilter}
                        onAccountIdChange={(id) => {
                            setAccountIdFilter(id);
                            setCurrentPage(1);
                        }}
                        accounts={accounts}
                    />

                {/* [NEW] Control Bar (Admin Style) */}
                <div className="bg-white border-x border-t border-gray-100 p-4 bg-opacity-50">
                    <div className="flex flex-wrap items-center justify-between w-full gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Filas por página</label>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                    className="bg-white border border-gray-300 text-gray-900 rounded-md py-1 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 shadow-sm"
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
                                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 hover:bg-white rounded disabled:opacity-30 transition-all">
                                        <IconChevronLeft className="w-4 h-4 text-gray-600" />
                                    </button>
                                    <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage * itemsPerPage >= totalPackages} className="p-1 hover:bg-white rounded disabled:opacity-30 transition-all">
                                        <IconChevronRight className="w-4 h-4 text-gray-600" />
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => { setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); setCurrentPage(1); }}
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

                        <div className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-lg border border-blue-200 text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2">
                             <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                             Total de paquetes en sistema: {totalPackages}
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
                    {selectedPackages.size > 0 && (
                        <div className="p-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between animate-fade-in-up">
                            <div className="flex items-center">
                                <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">
                                    {selectedPackages.size} seleccionados
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setPrintingPackages(selectedPackageObjects)} 
                                    className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md" 
                                    title="Imprimir Etiquetas"
                                >
                                    <IconPrinter className="w-6 h-6"/>
                                </button>
                                <button 
                                    onClick={() => { setDeletingPackage(null); setIsDeletePasswordModalOpen(true); }} 
                                    className="p-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-md" 
                                    title="Eliminar Seleccionados"
                                >
                                    <IconTrash className="w-6 h-6"/>
                                </button>
                                <button 
                                    onClick={() => setIsExportModalOpen(true)} 
                                    className="p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-md" 
                                    title="Exportar Seleccionados"
                                >
                                    <IconFileSpreadsheet className="w-6 h-6"/>
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <PackageList 
                        packages={packages} 
                        users={[]} 
                        isLoading={isLoading}
                        onSelectPackage={setSelectedPackage}
                        onEditPackage={setEditingPackage}
                        onDeletePackage={(pkg) => { setDeletingPackage(pkg); setIsDeletePasswordModalOpen(true); }}
                        onPrintLabel={(pkg) => setPrintingPackages([pkg])}
                        hideDriverName={true}
                        selectedPackages={selectedPackages}
                        onSelectionChange={handleSelectionChange}
                        onSelectAll={handleSelectAll}
                    />
                    
                    {totalPackages > 0 && (
                        <div className="p-4 border-t border-[var(--border-primary)] flex items-center justify-between">
                            <div className="text-sm text-[var(--text-muted)]">
                                Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalPackages)} - {Math.min(currentPage * itemsPerPage, totalPackages)} de {totalPackages}
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-md border border-[var(--border-secondary)] hover:bg-[var(--background-hover)] disabled:opacity-50"
                                >
                                    <IconChevronLeft className="w-4 h-4"/>
                                </button>
                                <button 
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                    disabled={currentPage * itemsPerPage >= totalPackages}
                                    className="p-2 rounded-md border border-[var(--border-secondary)] hover:bg-[var(--background-hover)] disabled:opacity-50"
                                >
                                    <IconChevronRight className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </>
        )}

        {/* Modals */}
        {isCreateModalOpen && (
            <CreatePackageModal 
                onClose={() => setIsCreateModalOpen(false)} 
                onCreate={handleCreatePackage}
                creatorId={auth?.user?.id}
            />
        )}
        {editingPackage && (
            <CreatePackageModal 
                onClose={() => setEditingPackage(null)} 
                onUpdate={handleUpdatePackage}
                initialData={editingPackage}
                creatorId={auth?.user?.id}
            />
        )}
        {isImportModalOpen && (
            <ImportPackagesModal 
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportPackages}
            />
        )}
        {importSource && auth?.user && (
            <ExternalImportModal
                client={auth.user}
                source={importSource}
                onClose={() => setImportSource(null)}
                onImport={handleImportPackages}
            />
        )}
        {selectedPackage && (
            <PackageDetailModal 
                pkg={selectedPackage} 
                onClose={() => setSelectedPackage(null)} 
            />
        )}
        
        {isDeletePasswordModalOpen && (
            <DeletePasswordModal
                onConfirm={(pass) => handleDeletePackages(pass)}
                onClose={() => {
                    setIsDeletePasswordModalOpen(false);
                    setDeletingPackage(null);
                }}
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
                    creatorName={auth.user.companyName || auth.user.name}
                    onClose={() => setPrintingPackages([])}
                />
            ) : (
                <BatchShippingLabelModal
                    packages={printingPackages}
                    creatorName={auth.user.companyName || auth.user.name}
                    onClose={() => setPrintingPackages([])}
                />
            )
        )}
    </div>
  );
};

export default ClientDashboard;
