
import React from 'react';
import { User } from '../../types';
import { IconSearch, IconPackage, IconCalendar, IconFileSpreadsheet, IconRefresh } from '../Icon';

interface PackageFiltersProps {
  onOpenCreateModal: () => void;
  onOpenImportModal: () => void;
  onRefresh: () => void;
  isSyncing?: boolean;
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
  flexFilter: 'all' | 'flexed' | 'not_flexed';
  onFlexFilterChange: (filter: 'all' | 'flexed' | 'not_flexed') => void;
  quickFilter: 'all' | 'closed' | 'cancelled' | 'rescheduled';
  onQuickFilterChange: (filter: 'all' | 'closed' | 'cancelled' | 'rescheduled') => void;
  clients: User[];
  clientFilter: string;
  onClientChange: (clientId: string) => void;
  onOpenQuickStatus: () => void;
}

const PackageFilters: React.FC<PackageFiltersProps> = ({
  onOpenCreateModal,
  onOpenImportModal,
  onRefresh,
  isSyncing = false,
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
  flexFilter,
  onFlexFilterChange,
  quickFilter,
  onQuickFilterChange,
  clients,
  clientFilter,
  onClientChange,
  onOpenQuickStatus,
}) => {
  const selectClasses = "block w-full pl-3 pr-10 py-2 border border-[var(--border-secondary)] rounded-md leading-5 bg-[var(--background-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] sm:text-sm";
  
  return (
    <div className="p-4 sm:px-6 border-b border-[var(--border-primary)]">
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
        <div className="relative flex-grow sm:flex-grow-0 sm:w-64 min-w-[200px]">
          <input
            type="text"
            placeholder="Buscar por ID, destinatario, dirección o FLEX..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-[var(--border-secondary)] rounded-md leading-5 bg-[var(--background-secondary)] placeholder-[var(--text-muted)] focus:outline-none focus:placeholder-[var(--text-secondary)] focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] sm:text-sm"
          />
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IconSearch className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
        </div>
        <div className="flex-shrink-0">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Desde</label>
            <div className="relative">
                <div className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-left cursor-pointer text-xs font-bold">
                    <span className={startDate ? "text-gray-900" : "text-gray-400"}>
                        {startDate ? new Date(startDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'DD/MM/AAAA'}
                    </span>
                    <IconCalendar className="h-4 w-4 text-gray-400" />
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
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Hasta</label>
            <div className="relative">
                <div className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-left cursor-pointer text-xs font-bold">
                    <span className={endDate ? "text-gray-900" : "text-gray-400"}>
                        {endDate ? new Date(endDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'DD/MM/AAAA'}
                    </span>
                    <IconCalendar className="h-4 w-4 text-gray-400" />
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
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Conductor</label>
          <select id="driver-filter" value={driverFilter} onChange={(e) => onDriverChange(e.target.value)} className={`${selectClasses} font-bold text-xs !py-1.5`} aria-label="Filtrar por conductor">
            <option value="">TODOS LOS CONDUCTORES</option>
            {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex-shrink-0">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Cliente</label>
          <select id="client-filter" value={clientFilter} onChange={(e) => onClientChange(e.target.value)} className={`${selectClasses} font-bold text-xs !py-1.5`} aria-label="Filtrar por cliente">
            <option value="">TODOS LOS CLIENTES</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.name.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex-shrink-0 w-32">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Flex</label>
          <select id="flex-filter" value={flexFilter} onChange={(e) => onFlexFilterChange(e.target.value as any)} className={`${selectClasses} font-bold text-xs !py-1.5`} aria-label="Filtrar por Flex">
            <option value="all">TODOS</option>
            <option value="flexed">FLEXEADOS</option>
            <option value="not_flexed">NO FLEXEADOS</option>
          </select>
        </div>
        <div className="flex-shrink-0 w-40">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Filtro Rápido</label>
          <select id="quick-filter" value={quickFilter} onChange={(e) => onQuickFilterChange(e.target.value as any)} className={`${selectClasses} font-bold text-xs !py-1.5`} aria-label="Filtro rápido">
            <option value="all">TODOS</option>
            <option value="closed">CERRADOS</option>
            <option value="cancelled">CANCELADOS</option>
            <option value="rescheduled">REPROGRAMADOS</option>
          </select>
        </div>
        <div className="flex-shrink-0">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Región</label>
          <select id="city-filter" value={cityFilter} onChange={(e) => onCityChange(e.target.value)} className={`${selectClasses} font-bold text-xs !py-1.5`} aria-label="Filtrar por ciudad">
            <option value="">TODAS LAS REGIONES</option>
            {!cities.includes('Región Metropolitana') && <option value="Región Metropolitana">REGIÓN METROPOLITANA</option>}
            {!cities.includes('Metropolitana') && <option value="Metropolitana">METROPOLITANA</option>}
            {!cities.includes('Santiago') && <option value="Santiago">SANTIAGO</option>}
            {cities.map(city => {
              if (['Región Metropolitana', 'Metropolitana', 'Santiago'].includes(city)) return null;
              return <option key={city} value={city}>{city.toUpperCase()}</option>;
            })}
          </select>
        </div>
        <div className="flex-shrink-0">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 block">Comuna</label>
          <select id="commune-filter" value={communeFilter} onChange={(e) => onCommuneChange(e.target.value)} className={`${selectClasses} font-bold text-xs !py-1.5`} aria-label="Filtrar por comuna">
            <option value="">TODAS LAS COMUNAS</option>
            {communes.map(commune => <option key={commune} value={commune}>{commune.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <button
                onClick={onRefresh}
                disabled={isSyncing}
                className={`flex-shrink-0 inline-flex items-center justify-center p-2.5 border border-blue-200 text-blue-600 bg-white rounded-lg hover:bg-blue-50 transition-all shadow-sm ${isSyncing ? 'animate-pulse' : ''}`}
                title="Refrescar Datos"
            >
                <IconRefresh className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            <button
                onClick={onOpenQuickStatus}
                className="flex-shrink-0 inline-flex items-center justify-center px-5 py-2.5 border border-blue-600 text-sm font-black rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 hover:shadow-md transition-all uppercase tracking-wider"
            >
                <IconSearch className="w-5 h-5 mr-3 -ml-1"/>
                Consultar ID
            </button>
            <button
                onClick={onOpenImportModal}
                className="flex-shrink-0 inline-flex items-center justify-center px-5 py-2.5 border border-gray-300 text-sm font-bold rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all uppercase tracking-tight"
            >
                <IconFileSpreadsheet className="w-5 h-5 mr-3 -ml-1 text-emerald-600"/>
                Importar Excel
            </button>
            <button
                onClick={onOpenCreateModal}
                className="flex-shrink-0 inline-flex items-center justify-center px-5 py-2.5 border-2 border-transparent text-sm font-black rounded-lg shadow-sm text-white bg-[#005fb8] hover:bg-[#004a8f] hover:shadow-lg focus:outline-none transition-all uppercase tracking-widest"
            >
                <IconPackage className="w-5 h-5 mr-3 -ml-1"/>
                Crear Paquete
            </button>
        </div>
      </div>
    </div>
  );
};

export default PackageFilters;
