
import React from 'react';
import { PackageStatus } from '../../constants';
import { IconSearch, IconCalendar } from '../Icon';

interface ClientPackageFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  communeFilter: string;
  onCommuneChange: (commune: string) => void;
  statusFilter: string | null;
  onStatusChange: (status: string | null) => void;
  flexFilter: 'all' | 'flexed' | 'not_flexed';
  onFlexFilterChange: (filter: 'all' | 'flexed' | 'not_flexed') => void;
  communes: string[];
  itemsPerPage: number;
  onItemsPerPageChange: (limit: number) => void;
}

const statusOptions: { label: string; value: string | null }[] = [
    { label: 'Todos los Estados', value: null },
    { label: 'Cerrados', value: 'closed' },
    { label: 'Pendiente', value: PackageStatus.Pending },
    { label: 'Retirado', value: PackageStatus.PickedUp },
    { label: 'En Tránsito', value: PackageStatus.InTransit },
    { label: 'Entregado', value: PackageStatus.Delivered },
    { label: 'Con Problema', value: PackageStatus.Problem },
    { label: 'Retrasado', value: PackageStatus.Delayed },
    { label: 'Pend. Devolución', value: PackageStatus.ReturnPending },
    { label: 'Devuelto', value: PackageStatus.Returned },
];

const ClientPackageFilters: React.FC<ClientPackageFiltersProps> = ({
  searchQuery,
  onSearchChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  communeFilter,
  onCommuneChange,
  statusFilter,
  onStatusChange,
  flexFilter,
  onFlexFilterChange,
  communes,
  itemsPerPage,
  onItemsPerPageChange,
}) => {
  const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] sm:text-sm";
  const selectClasses = "block w-full pl-3 pr-10 py-2 border border-[var(--border-secondary)] rounded-md leading-5 bg-[var(--background-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] sm:text-sm";

  return (
    <div className="bg-[var(--background-secondary)] shadow-sm rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
        <div className="relative lg:col-span-2">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IconSearch className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, dirección o ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`${inputClasses} pl-10`}
          />
        </div>
        
        <div>
          <label className="text-xs text-[var(--text-muted)]">Estado</label>
          <select
            value={statusFilter || ''}
            onChange={(e) => onStatusChange(e.target.value || null)}
            className={selectClasses}
          >
            {statusOptions.map((option) => (
                <option key={option.label} value={option.value || ''}>
                    {option.label}
                </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-[var(--text-muted)]">Flex</label>
          <select
            value={flexFilter}
            onChange={(e) => onFlexFilterChange(e.target.value as any)}
            className={selectClasses}
          >
            <option value="all">Todos</option>
            <option value="flexed">Flexeados</option>
            <option value="not_flexed">No Flexeados</option>
          </select>
        </div>

        <div>
            <label className="text-xs text-[var(--text-muted)]">Comuna</label>
             <select
                value={communeFilter}
                onChange={(e) => onCommuneChange(e.target.value)}
                className={selectClasses}
            >
                <option value="">Todas las Comunas</option>
                {communes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
        </div>

        <div>
            <label className="text-xs text-[var(--text-muted)]">Desde</label>
            <div className="relative">
                <div className="flex items-center justify-between w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm bg-[var(--background-secondary)] text-left cursor-pointer sm:text-sm">
                    <span className={startDate ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
                        {startDate ? new Date(startDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/aaaa'}
                    </span>
                    <IconCalendar className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Seleccionar fecha de inicio"
                />
            </div>
        </div>
        <div>
            <label className="text-xs text-[var(--text-muted)]">Hasta</label>
            <div className="relative">
                 <div className="flex items-center justify-between w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm bg-[var(--background-secondary)] text-left cursor-pointer sm:text-sm">
                    <span className={endDate ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
                        {endDate ? new Date(endDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/aaaa'}
                    </span>
                    <IconCalendar className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Seleccionar fecha de fin"
                />
            </div>
        </div>

        <div>
            <label className="text-xs text-[var(--text-muted)]">Ver por pantalla</label>
            <select
                value={itemsPerPage}
                onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                className={selectClasses}
            >
                <option value={10}>10 registros</option>
                <option value={25}>25 registros</option>
                <option value={50}>50 registros</option>
                <option value={100}>100 registros</option>
            </select>
        </div>
      </div>
    </div>
  );
};

export default ClientPackageFilters;
