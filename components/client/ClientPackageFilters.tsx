import React, { useState, useRef, useEffect } from 'react';
import { PackageStatus } from '../../constants';
import { IconSearch, IconCalendar, IconChevronDown } from '../Icon';

interface ClientPackageFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  communeFilter: string;
  onCommuneChange: (commune: string) => void;
  statusFilter: PackageStatus[];
  onStatusChange: (status: PackageStatus[]) => void;
  flexFilter: 'all' | 'flexed' | 'not_flexed';
  onFlexFilterChange: (filter: 'all' | 'flexed' | 'not_flexed') => void;
  communes: string[];
  itemsPerPage: number;
  onItemsPerPageChange: (limit: number) => void;
}

const statusOptions: { label: string; value: PackageStatus | null }[] = [
    { label: 'Cerrados', value: PackageStatus.Delivered }, // Mapping 'closed' conceptually
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
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsStatusDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const customCheckboxClass = "w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800 focus:ring-2 cursor-pointer";

  const inputClasses = "w-full border border-[var(--border-secondary)] rounded-lg py-2.5 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white shadow-sm";
  const selectClasses = "block w-full pl-3 pr-10 py-2.5 border border-[var(--border-secondary)] rounded-lg leading-5 bg-white text-[var(--text-primary)] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all sm:text-sm shadow-sm cursor-pointer border-gray-200";
  const labelClasses = "text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5 block";

  return (
    <div className="bg-[var(--background-secondary)] shadow-sm rounded-lg p-5 mb-6 border border-[var(--border-primary)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-5 items-end">
        {/* Search */}
        <div className="relative lg:col-span-2">
          <label className={labelClasses}>Búsqueda</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <IconSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="ID, Nombre, Dirección..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`${inputClasses} pl-11`}
            />
          </div>
        </div>
        
        {/* Status Dropdown */}
        <div className="relative lg:col-span-2" ref={dropdownRef}>
          <label className={labelClasses}>Estado</label>
          <div className="relative">
            <button
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className={selectClasses}
                aria-label="Filtrar por estado"
            >
                <span className="truncate block pr-6">
                    {statusFilter.length === 0 ? 'Todos' : `${statusFilter.length} sel.`}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <IconChevronDown className="w-5 h-5 text-gray-400" />
                </span>
            </button>
            {isStatusDropdownOpen && (
                <ul className="absolute z-20 mt-1 w-full bg-[var(--background-secondary)] shadow-xl rounded-md py-1 ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm max-h-60 overflow-auto border border-[var(--border-primary)]">
                    <li
                        onClick={() => onStatusChange([])}
                        className={`cursor-pointer select-none relative py-2.5 pl-3 pr-4 transition-colors flex items-center gap-3 ${
                            statusFilter.length === 0 
                            ? 'bg-[var(--brand-muted)] text-[var(--brand-text)] font-bold' 
                            : 'hover:bg-[var(--background-hover)] text-[var(--text-primary)]'
                        }`}
                    >
                        <input 
                            type="checkbox" 
                            checked={statusFilter.length === 0} 
                            readOnly 
                            className={customCheckboxClass}
                        />
                        <span className="font-bold text-[11px] uppercase tracking-wider">Todos</span>
                    </li>
                    {statusOptions.map(({ label, value }) => (
                        <li
                            key={label}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!value) return;
                                const newFilter = statusFilter.includes(value)
                                    ? statusFilter.filter(s => s !== value)
                                    : [...statusFilter, value];
                                onStatusChange(newFilter);
                            }}
                            className={`cursor-pointer select-none relative py-2.5 pl-3 pr-4 transition-colors flex items-center gap-3 ${
                                value && statusFilter.includes(value) 
                                ? 'bg-[var(--brand-muted)] text-[var(--brand-text)]' 
                                : 'hover:bg-[var(--background-hover)] text-[var(--text-primary)]'
                            }`}
                        >
                            <input 
                                type="checkbox" 
                                checked={!!value && statusFilter.includes(value)} 
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

        {/* Flex */}
        <div className="lg:col-span-2">
          <label className={labelClasses}>Flex</label>
          <select
            value={flexFilter}
            onChange={(e) => onFlexFilterChange(e.target.value as any)}
            className={`${selectClasses} text-xs uppercase tracking-wide`}
          >
            <option value="all">TODOS</option>
            <option value="flexed">FLEXEADOS</option>
            <option value="not_flexed">NO FLEXEADOS</option>
          </select>
        </div>

        {/* Comuna */}
        <div className="lg:col-span-2">
            <label className={labelClasses}>Comuna</label>
             <select
                value={communeFilter}
                onChange={(e) => onCommuneChange(e.target.value)}
                className={selectClasses}
            >
                <option value="">Todas</option>
                {communes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
        </div>

        {/* Fechas */}
        <div className="lg:col-span-2">
            <label className={labelClasses}>Desde</label>
            <div className="relative">
                <div className="flex items-center justify-between w-full px-3 py-2.5 border border-gray-200 rounded-lg shadow-sm bg-white text-left cursor-pointer sm:text-sm font-bold">
                    <span className={startDate ? "text-gray-900" : "text-gray-400 text-xs"}>
                        {startDate ? new Date(startDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : 'Inicio'}
                    </span>
                    <IconCalendar className="h-4 w-4 text-gray-400" />
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
        <div className="lg:col-span-2">
            <label className={labelClasses}>Hasta</label>
            <div className="relative">
                 <div className="flex items-center justify-between w-full px-3 py-2.5 border border-gray-200 rounded-lg shadow-sm bg-white text-left cursor-pointer sm:text-sm font-bold">
                    <span className={endDate ? "text-gray-900" : "text-gray-400 text-xs"}>
                        {endDate ? new Date(endDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : 'Fin'}
                    </span>
                    <IconCalendar className="h-4 w-4 text-gray-400" />
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

      </div>
      
      {/* Items per Page - Separate row or integrated if space */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
          <div className="flex items-center gap-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filas:</label>
              <select
                  value={itemsPerPage}
                  onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                  className="bg-white border border-gray-200 text-gray-900 font-bold rounded-lg py-1 px-3 text-xs focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
              >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
              </select>
          </div>
      </div>
    </div>
  );
};

export default ClientPackageFilters;
