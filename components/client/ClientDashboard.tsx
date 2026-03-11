
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { api, PackageCreationData } from '../../services/api';
import type { Package } from '../../types';
import { PackageStatus, PackageSource } from '../../constants';
import PackageList from '../PackageList';
import PackageDetailModal from '../PackageDetailModal';
import CreatePackageModal from '../modals/CreatePackageModal';
import ClientPackageFilters from './ClientPackageFilters';
import ShippingLabelModal from './ShippingLabelModal';
import BatchShippingLabelModal from './BatchShippingLabelModal';
import { IconPlus, IconRefresh, IconChevronLeft, IconChevronRight, IconChevronDown, IconFileSpreadsheet, IconPrinter, IconTrash, IconMercadoLibre, IconCheckCircle, IconDownload, IconWoocommerce, IconFalabella, IconFileText, IconShopify } from '../Icon';
import ImportPackagesModal from './ImportPackagesModal';
import ConfirmationModal from '../modals/ConfirmationModal';
import ExternalImportModal from '../modals/ExternalImportModal';

const getISODate = (date: Date) => date.toISOString().split('T')[0];

const ClientDashboard: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [totalPackages, setTotalPackages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [importSource, setImportSource] = useState<PackageSource | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<Package | null>(null);
  const [printingPackages, setPrintingPackages] = useState<Package[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PackageStatus | null>(null);
  const [communeFilter, setCommuneFilter] = useState('');
  
  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);
  const [startDate, setStartDate] = useState(getISODate(oneMonthAgo));
  const [endDate, setEndDate] = useState(getISODate(today));

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const auth = useContext(AuthContext);

  const fetchData = async () => {
    if (!auth?.user) return;
    setIsLoading(true);
    try {
        const params = {
            page: currentPage,
            limit: itemsPerPage,
            searchQuery,
            statusFilter,
            communeFilter,
            startDate,
            endDate,
            clientFilter: auth.user.id
        };
        const { packages: pkgs, total } = await api.getPackages(params);
        setPackages(pkgs);
        setTotalPackages(total);
    } catch (error) {
        console.error("Failed to fetch client packages", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [auth?.user, currentPage, itemsPerPage, searchQuery, statusFilter, communeFilter, startDate, endDate]);

  const handleCreatePackage = async (data: Omit<PackageCreationData, 'origin'>) => {
    if (!auth?.user) return;
    try {
        const fullData: PackageCreationData = {
            ...data,
            creatorId: auth.user.id,
            origin: auth.user.pickupAddress || auth.user.address || 'Sin Origen',
        };
        const newPkg = await api.createPackage(fullData);
        // Add to printing queue immediately for convenience
        setPrintingPackages([newPkg]);
        fetchData();
        setIsCreateModalOpen(false);
    } catch (error: any) {
        console.error("Failed to create package", error);
        alert(error.message || "Error al crear paquete");
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
          const createdPackages = await api.createMultiplePackages(fullPackagesData);
          fetchData();
          setIsImportModalOpen(false);
          setImportSource(null);
          alert(`${createdPackages.length} paquetes importados correctamente.`);
      } catch (error: any) {
          console.error("Failed to import packages", error);
          alert(error.message || "Error al importar paquetes");
      }
  };

  const handleOpenExternalImport = (source: PackageSource) => {
      setImportSource(source);
      setIsImportMenuOpen(false);
  };

  const handleDeletePackage = async () => {
      if (!deletingPackage) return;
      try {
          await api.deletePackage(deletingPackage.id);
          setDeletingPackage(null);
          fetchData();
      } catch (error) {
          console.error("Failed to delete package", error);
          alert("Error al eliminar el paquete.");
      }
  };

  const uniqueCommunes = useMemo(() => {
      // In a real app with pagination, we might want to fetch all communes from the API
      // For now, we collect from current page + maybe a separate API endpoint for filter options
      // Simplification: just use what's loaded or a static list if possible
      // Let's assume we extract from loaded packages for now, but ideally this comes from backend stats
      const communes = new Set(packages.map(p => p.recipientCommune));
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
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mis Paquetes</h1>
                <p className="text-sm text-[var(--text-muted)]">Gestiona tus envíos y seguimiento.</p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] text-white rounded-md shadow hover:bg-[var(--brand-secondary)] transition-colors">
                    <IconPlus className="w-5 h-5"/> Crear Paquete
                </button>
                <div className="relative">
                    <button onClick={() => setIsImportMenuOpen(!isImportMenuOpen)} className="flex items-center gap-2 px-4 py-2 bg-[var(--background-secondary)] border border-[var(--border-secondary)] text-[var(--text-primary)] rounded-md shadow hover:bg-[var(--background-hover)] transition-colors">
                        <IconDownload className="w-5 h-5"/> Importar <IconChevronDown className="w-4 h-4"/>
                    </button>
                    {isImportMenuOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-[var(--background-secondary)] rounded-md shadow-lg z-20 border border-[var(--border-primary)] animate-fade-in-up">
                            <div className="py-1">
                                <button onClick={() => { setIsImportMenuOpen(false); setIsImportModalOpen(true); }} className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--background-hover)] flex items-center gap-2">
                                    <IconFileText className="w-4 h-4 text-green-600"/> Excel / CSV
                                </button>
                                <button onClick={() => handleOpenExternalImport(PackageSource.MercadoLibre)} className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--background-hover)] flex items-center gap-2 border-t border-[var(--border-primary)]">
                                    <IconMercadoLibre className="w-4 h-4 text-yellow-500"/> Mercado Libre
                                </button>
                                <button onClick={() => handleOpenExternalImport(PackageSource.Shopify)} className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--background-hover)] flex items-center gap-2">
                                    <IconShopify className="w-4 h-4 text-green-500"/> Shopify
                                </button>
                                <button onClick={() => handleOpenExternalImport(PackageSource.WooCommerce)} className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--background-hover)] flex items-center gap-2">
                                    <IconWoocommerce className="w-4 h-4 text-purple-500"/> WooCommerce
                                </button>
                                <button onClick={() => handleOpenExternalImport(PackageSource.Falabella)} className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--background-hover)] flex items-center gap-2">
                                    <IconFalabella className="w-4 h-4 text-green-700"/> Falabella
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

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
            communes={uniqueCommunes}
            packageCount={totalPackages}
        />

        <div className="bg-[var(--background-secondary)] shadow-md rounded-lg overflow-hidden">
            {selectedPackages.size > 0 && (
                <div className="p-3 bg-[var(--brand-muted)] border-b border-[var(--brand-secondary)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--brand-primary)]">{selectedPackages.size} seleccionados</span>
                    <div className="flex gap-2">
                        <button onClick={() => setPrintingPackages(selectedPackageObjects)} className="p-2 text-gray-600 hover:bg-white/50 rounded-full" title="Imprimir Etiquetas">
                            <IconPrinter className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            )}
            
            <PackageList 
                packages={packages} 
                users={[]} 
                isLoading={isLoading}
                onSelectPackage={setSelectedPackage}
                onDeletePackage={setDeletingPackage}
                onPrintLabel={(pkg) => setPrintingPackages([pkg])}
                hideDriverName={true}
                selectedPackages={selectedPackages}
                onSelectionChange={handleSelectionChange}
            />
            
            {/* Pagination Controls */}
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

        {/* Modals */}
        {isCreateModalOpen && (
            <CreatePackageModal 
                onClose={() => setIsCreateModalOpen(false)} 
                onCreate={handleCreatePackage}
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
                isFullScreen={true}
            />
        )}
        {deletingPackage && (
            <ConfirmationModal
                title="Eliminar Paquete"
                message={`¿Estás seguro que deseas eliminar el paquete para ${deletingPackage.recipientName}? Esta acción no se puede deshacer.`}
                confirmText="Sí, eliminar"
                onClose={() => setDeletingPackage(null)}
                onConfirm={handleDeletePackage}
            />
        )}
        {printingPackages.length > 0 && auth?.user && (
            printingPackages.length === 1 ? (
                <ShippingLabelModal
                    pkg={printingPackages[0]}
                    creatorName={auth.user.name}
                    onClose={() => setPrintingPackages([])}
                />
            ) : (
                <BatchShippingLabelModal
                    packages={printingPackages}
                    creatorName={auth.user.name}
                    onClose={() => setPrintingPackages([])}
                />
            )
        )}
    </div>
  );
};

export default ClientDashboard;
