
import React from 'react';
import { PackageStatus, ShippingType } from '../constants';
import type { Package, User } from '../types';
import PackageListItem from './PackageListItem';
import { IconPackage } from './Icon';

interface PackageListProps {
  packages: Package[];
  users: User[];
  isLoading: boolean;
  onSelectPackage: (pkg: Package) => void;
  onAssignPackage?: (pkg: Package) => void;
  onEditPackage?: (pkg: Package) => void;
  onDeletePackage?: (pkg: Package) => void;
  onPrintLabel?: (pkg: Package) => void;
  onMarkForReturn?: (pkg: Package) => void;
  isFiltering?: boolean;
  isDateFiltering?: boolean;
  hideDriverName?: boolean;
  selectedPackages?: Set<string>;
  onSelectionChange?: (pkg: Package) => void;
}

const statusPriority: { [key in PackageStatus]: number } = {
  [PackageStatus.Problem]: 1,
  [PackageStatus.ReturnPending]: 2,
  [PackageStatus.Pending]: 3, // Moved up priority to ensure new packages are seen
  [PackageStatus.Delayed]: 4,
  [PackageStatus.PickedUp]: 5,
  [PackageStatus.InTransit]: 6,
  [PackageStatus.Delivered]: 7,
  [PackageStatus.Returned]: 8,
};

const PackageList: React.FC<PackageListProps> = ({ packages, users, isLoading, onSelectPackage, onAssignPackage, onEditPackage, onDeletePackage, onPrintLabel, onMarkForReturn, isFiltering, isDateFiltering, hideDriverName, selectedPackages, onSelectionChange }) => {
  if (isLoading) {
    return <p className="p-6 text-center text-[var(--text-muted)]">Cargando paquetes...</p>;
  }
  
  if (packages.length === 0) {
    let message = 'No hay paquetes para mostrar.';
    if (isDateFiltering) {
        message = 'No existen envíos en el rango de fechas seleccionado.';
    } else if (isFiltering) {
        message = 'No se encontraron paquetes que coincidan con los filtros.';
    }
    return (
        <div className="p-12 text-center">
            <IconPackage className="mx-auto h-12 w-12 text-[var(--text-muted)] opacity-50" />
            <h3 className="mt-2 text-sm font-medium text-[var(--text-primary)]">No se encontraron paquetes</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{message}</p>
        </div>
    );
  }

  const sortedPackages = [...packages].sort((a, b) => {
    // Urgent packages (SameDay/Express pending assignment) always float to top
    const isAUrgent = (a.shippingType === ShippingType.Express || a.shippingType === ShippingType.SameDay) && a.status === PackageStatus.Pending && !a.driverId;
    const isBUrgent = (b.shippingType === ShippingType.Express || b.shippingType === ShippingType.SameDay) && b.status === PackageStatus.Pending && !b.driverId;

    if (isAUrgent && !isBUrgent) return -1;
    if (!isAUrgent && isBUrgent) return 1;

    const priorityA = statusPriority[a.status];
    const priorityB = statusPriority[b.status];

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Secondary sort by update time (newest first)
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="divide-y divide-[var(--border-primary)]">
      {sortedPackages.map((pkg, index) => {
        const driver = users.find(u => u.id === pkg.driverId);
        const creator = users.find(u => u.id === pkg.creatorId);
        return (
            <PackageListItem 
                key={pkg.id} 
                index={index}
                pkg={pkg} 
                driverName={driver?.name}
                creatorName={creator?.name}
                onSelect={onSelectPackage}
                onAssign={onAssignPackage}
                onEdit={onEditPackage}
                onDelete={onDeletePackage}
                onPrint={onPrintLabel}
                onMarkForReturn={onMarkForReturn}
                hideDriverName={hideDriverName}
                isSelected={selectedPackages?.has(pkg.id)}
                onSelectionChange={onSelectionChange}
            />
        );
      })}
    </div>
  );
};

export default PackageList;
