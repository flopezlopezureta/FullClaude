import React, { useState, useEffect, useContext } from 'react';
import { PackageStatus } from '../../constants';
import type { Package, User } from '../../types';
import { api, DeliveryConfirmationData } from '../../services/api';
import PackageList from '../PackageList';
import PackageDetailModal from '../PackageDetailModal';
import ReturnConfirmationModal from './ReturnConfirmationModal';
import { AuthContext } from '../../contexts/AuthContext';

const ReturnsDashboard: React.FC = () => {
  const [returnPackages, setReturnPackages] = useState<Package[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [returningPackage, setReturningPackage] = useState<Package | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const auth = useContext(AuthContext);

  // Load from cache on mount
  useEffect(() => {
    if (!auth?.user) return;
    const cachedReturns = localStorage.getItem(`driver_returns_${auth.user.id}`);
    const cachedUsers = localStorage.getItem(`driver_users`);
    
    if (cachedReturns) {
      try {
        const parsed = JSON.parse(cachedReturns);
        setReturnPackages(parsed);
        setIsLoading(false);
      } catch (e) {
        console.error("Error parsing cached returns", e);
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
        const [{ packages: pkgs }, allUsers] = await Promise.all([
            api.getPackages({ driverFilter: auth.user.id, statusFilter: PackageStatus.ReturnPending, limit: 0 }),
            api.getUsers()
        ]);
        setReturnPackages(pkgs);
        setUsers(allUsers);
        
        localStorage.setItem(`driver_returns_${auth.user.id}`, JSON.stringify(pkgs));
        localStorage.setItem(`driver_users`, JSON.stringify(allUsers));
    } catch (error) {
        console.error("Failed to fetch driver return data", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true); // Initial background fetch
    const intervalId = setInterval(() => fetchData(true), 20000); // Poll every 20 seconds
    return () => clearInterval(intervalId);
  }, [auth?.user]);

  const handleStartReturn = (pkg: Package) => {
    setReturningPackage(pkg);
  };

  const handleConfirmReturn = async (pkgId: string, data: DeliveryConfirmationData) => {
    try {
      await api.confirmReturn(pkgId, data);
      setReturnPackages(prev => prev.filter(p => p.id !== pkgId));
      setReturningPackage(null);
    } catch (error: any) {
        console.error("Failed to confirm return", error);
        throw error;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 px-4">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Mis Devoluciones
        </h1>
        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
            Pendientes: {returnPackages.length}
        </span>
      </div>

      <div className="bg-[var(--background-secondary)] shadow-md rounded-lg">
        <PackageList 
            packages={returnPackages} 
            users={users}
            isLoading={isLoading}
            onSelectPackage={setSelectedPackage}
            hideDriverName={true}
        />
      </div>

      {selectedPackage && (
        <PackageDetailModal 
            isFullScreen={true}
            pkg={selectedPackage} 
            onClose={() => setSelectedPackage(null)}
            creatorForReturn={users.find(u => u.id === selectedPackage.creatorId)}
            onStartReturn={(pkg) => {
                setSelectedPackage(null);
                handleStartReturn(pkg);
            }}
        />
      )}

      {returningPackage && (
        <ReturnConfirmationModal
          pkg={returningPackage}
          onClose={() => setReturningPackage(null)}
          onConfirm={handleConfirmReturn}
        />
      )}
    </div>
  );
};

export default ReturnsDashboard;