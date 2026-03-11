

import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { PackageStatus, MessagingPlan } from '../../constants';
import type { Package, User } from '../../types';
import { api, DeliveryConfirmationData } from '../../services/api';
import PackageList from '../PackageList';
import PackageDetailModal from '../PackageDetailModal';
import DeliveryConfirmationModal from './DeliveryConfirmationModal';
import UndeliveredModal from './UndeliveredModal';
import { AuthContext } from '../../contexts/AuthContext';
import { IconArchive, IconTruck, IconFileExport, IconRoute } from '../Icon';
import EndOfDayReportModal from '../modals/EndOfDayReportModal';
import RouteOptimizerModal from '../modals/RouteOptimizerModal';

declare const XLSX: any;

const DriverDashboard: React.FC = () => {
  const [myPackages, setMyPackages] = useState<Package[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [deliveringPackage, setDeliveringPackage] = useState<Package | null>(null);
  const [reportingProblemPackage, setReportingProblemPackage] = useState<Package | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [isEndOfDayModalOpen, setIsEndOfDayModalOpen] = useState(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  
  const auth = useContext(AuthContext);
  const isInitialLoad = useRef(true);
  const prevPackagesRef = useRef<Package[] | undefined>(undefined);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | undefined>(undefined);

  const fetchData = async () => {
      if (!auth?.user) return;
      if (isInitialLoad.current) {
        setIsLoading(true);
      }
      try {
          // Fetch all packages for the current driver, without pagination
          const { packages: pkgs } = await api.getPackages({ driverFilter: auth.user.id, limit: 0 });
          setMyPackages(pkgs); // The data from API is already filtered by driver
          const allUsers = await api.getUsers();
          setUsers(allUsers);
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
    fetchData();
    const intervalId = setInterval(fetchData, 10000);
    
    // Get current location for optimizer
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
    }

    return () => clearInterval(intervalId);
  }, [auth?.user]);

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
  
  const { pendingPackages, dailyHistoryPackages } = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    const pending = myPackages.filter(p => 
        p.status !== PackageStatus.Delivered && p.status !== PackageStatus.Problem && p.status !== PackageStatus.Returned
    );

    const history = myPackages.filter(p => {
        if (p.status !== PackageStatus.Delivered && p.status !== PackageStatus.Problem) return false;
        
        const closureEvent = p.history[0]; // Most recent event determines the date
        if (!closureEvent) return false; 
        
        return new Date(closureEvent.timestamp).toDateString() === todayStr;
    });

    return { pendingPackages: pending, dailyHistoryPackages: history };
  }, [myPackages]);

  const totalAssignedForDay = myPackages.length;

  const handleStartDelivery = (pkg: Package) => {
    setDeliveringPackage(pkg);
  };

  const handleReportProblem = (pkg: Package) => {
    setReportingProblemPackage(pkg);
  };

  const handleConfirmDelivery = async (pkgId: string, data: DeliveryConfirmationData) => {
    try {
      const updatedPackage = await api.confirmDelivery(pkgId, data);
      setMyPackages(prev => prev.map(p => p.id === pkgId ? updatedPackage : p));
      setDeliveringPackage(null);

      // --- NEW NOTIFICATION LOGIC ---
      if (auth?.systemSettings.messagingPlan && auth.systemSettings.messagingPlan !== MessagingPlan.None) {
          const creator = users.find(u => u.id === updatedPackage.creatorId);
          if (creator) {
              const message = `Hola ${creator.name}, te informamos que tu paquete con ID ${updatedPackage.id} para ${updatedPackage.recipientName} ha sido entregado exitosamente.`;
              if (auth.systemSettings.messagingPlan === MessagingPlan.WhatsApp && creator.phone) {
                  const whatsappUrl = `https://wa.me/${creator.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
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
  
  const handleExportRoute = () => {
    if (!auth?.user || pendingPackages.length === 0) return;

    const dateStr = new Date().toISOString().split('T')[0];
    const driverName = auth.user.name.replace(/\s+/g, '_');

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
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel compatibility
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Circuit_${driverName}_${dateStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                disabled={pendingPackages.length === 0}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-[var(--text-on-brand)] bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
                <IconFileExport className="w-5 h-5 mr-2 -ml-1"/>
                Exportar
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
            driver={users.find(u => u.id === selectedPackage.driverId)}
            creator={users.find(u => u.id === selectedPackage.creatorId)}
            companyName={auth?.systemSettings.companyName}
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
          pkg={deliveringPackage}
          onClose={() => setDeliveringPackage(null)}
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