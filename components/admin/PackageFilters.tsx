
import React from 'react';
import { PackageStatus, User } from '../../types';
import { IconSearch, IconPackage, IconCalendar, IconFileExport, IconFileSpreadsheet } from '../Icon';

interface PackageFiltersProps {
  onOpenCreateModal: () => void;
  onOpenImportModal: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  drivers: User[];
  driverFilter: string;
  onDriverChange: (driverId: string) => void;
  communes: string[];
  communeFilter: string;
  onCommuneChange: (commune: string) => void;
  cities: string[];
  cityFilter: string;
  onCityChange: (city: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  onExportRoute: () => void;
}

const PackageFilters: React.FC<PackageFiltersProps> = ({
  onOpenCreateModal,
  onOpenImportModal,
  searchQuery,
  onSearchChange,
  drivers,
  driverFilter,
  onDriverChange,
  communes,
  communeFilter,
  onCommuneChange,
  cities,
  cityFilter,
  onCityChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onExportRoute,
}) => {
  const selectClasses = "block w-full pl-3 pr-10 py-2 border border-[var(--border-secondary)] rounded-md leading-5 bg-[var(--background-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] sm:text-sm";
  
  return (
    <div className="p-4 sm:px-6 border-b border-[var(--border-primary)]">
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
        <div className="relative flex-grow sm:flex-grow-0 sm:w-64 min-w-[200px]">
          <input
            type="text"
            placeholder="Buscar por ID o destinatario..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-[var(--border-secondary)] rounded-md leading-5 bg-[var(--background-secondary)] placeholder-[var(--text-muted)] focus:outline-none focus:placeholder-[var(--text-secondary)] focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] sm:text-sm"
          />
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IconSearch className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
        </div>
        <div className="flex-shrink-0">
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
                    onChange={e => onStartDateChange(e.target.value)} 
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Seleccionar fecha de inicio"
                />
            </div>
        </div>
        <div className="flex-shrink-0">
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
                    onChange={e => onEndDateChange(e.target.value)} 
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Seleccionar fecha de fin"
                />
            </div>
        </div>
        <div className="flex-shrink-0">
          <select id="driver-filter" value={driverFilter} onChange={(e) => onDriverChange(e.target.value)} className={selectClasses} aria-label="Filtrar por conductor">
            <option value="">Todos los Conductores</option>
            {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
          </select>
        </div>
        <div className="flex-shrink-0">
          <select id="city-filter" value={cityFilter} onChange={(e) => onCityChange(e.target.value)} className={selectClasses} aria-label="Filtrar por ciudad">
            <option value="">Todas las Ciudades</option>
            {cities.map(city => <option key={city} value={city}>{city}</option>)}
          </select>
        </div>
        <div className="flex-shrink-0">
          <select id="commune-filter" value={communeFilter} onChange={(e) => onCommuneChange(e.target.value)} className={selectClasses} aria-label="Filtrar por comuna">
            <option value="">Todas las Comunas</option>
            {communes.map(commune => <option key={commune} value={commune}>{commune}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {driverFilter && (
                <button
                    onClick={onExportRoute}
                    className="flex-shrink-0 inline-flex items-center justify-center px-4 py-2 border border-green-600 text-sm font-medium rounded-md shadow-sm text-green-700 bg-green-50 hover:bg-green-100"
                >
                    <IconFileExport className="w-5 h-5 mr-2 -ml-1"/>
                    Exportar Ruta
                </button>
            )}
             <button
                onClick={onOpenImportModal}
                className="flex-shrink-0 inline-flex items-center justify-center px-4 py-2 border border-[var(--border-secondary)] text-sm font-medium rounded-md shadow-sm text-[var(--text-primary)] bg-[var(--background-secondary)] hover:bg-[var(--background-hover)]"
            >
                <IconFileSpreadsheet className="w-5 h-5 mr-2 -ml-1"/>
                Importar Excel
            </button>
            <button
                onClick={onOpenCreateModal}
                className="flex-shrink-0 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-secondary)]"
            >
                <IconPackage className="w-5 h-5 mr-2 -ml-1"/>
                Crear Paquete
            </button>
        </div>
      </div>
    </div>
  );
};

export default PackageFilters;
