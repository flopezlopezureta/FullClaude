import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User } from '../types';
import { IconSearch, IconX, IconChevronDown } from './Icon';

interface SearchableDriverSelectProps {
  drivers: User[];
  selectedDriverId: string;
  onSelect: (driverId: string) => void;
  placeholder?: string;
  showNoneOption?: boolean;
}

const SearchableDriverSelect: React.FC<SearchableDriverSelectProps> = ({
  drivers,
  selectedDriverId,
  onSelect,
  placeholder = '-- Seleccionar Conductor --',
  showNoneOption = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDriver = useMemo(() => {
    if (selectedDriverId === 'none' || !selectedDriverId) return null;
    return drivers.find(d => d.id === selectedDriverId);
  }, [drivers, selectedDriverId]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter(driver =>
      driver.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [drivers, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between pl-3 pr-10 py-2 text-base border border-[var(--border-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] sm:text-sm rounded-md bg-[var(--background-secondary)] text-[var(--text-primary)] text-left transition-all hover:bg-[var(--background-hover)]"
      >
        <span className="block truncate">
          {selectedDriverId === 'none' ? '-- Sin Asignar (Disponible) --' : (selectedDriver ? selectedDriver.name : placeholder)}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <IconChevronDown className={`h-5 w-5 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full bg-[var(--background-secondary)] shadow-2xl max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm animate-fade-in-up">
          <div className="sticky top-0 bg-[var(--background-secondary)] z-10 px-2 py-2 border-b border-[var(--border-primary)]">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IconSearch className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <input
                type="text"
                autoFocus
                className="block w-full pl-9 pr-3 py-1.5 border border-[var(--border-secondary)] rounded-md focus:ring-[var(--brand-secondary)] focus:border-[var(--brand-secondary)] bg-[var(--background-muted)] text-[var(--text-primary)] text-sm"
                placeholder="Buscar conductor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSearchTerm(''); }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <IconX className="h-4 w-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]" />
                </button>
              )}
            </div>
          </div>

          <ul className="pt-1">
            {showNoneOption && (
              <li
                className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-[var(--brand-primary)] hover:text-white transition-colors ${selectedDriverId === 'none' ? 'bg-[var(--brand-muted)] text-[var(--brand-primary)] font-semibold' : 'text-[var(--text-primary)]'}`}
                onClick={() => handleSelect('none')}
              >
                <span className="block truncate">-- Sin Asignar (Disponible) --</span>
              </li>
            )}
            
            {filteredDrivers.length > 0 ? (
              filteredDrivers.map((driver) => (
                <li
                  key={driver.id}
                  className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-[var(--brand-primary)] hover:text-white transition-colors ${selectedDriverId === driver.id ? 'bg-[var(--brand-muted)] text-[var(--brand-primary)] font-semibold' : 'text-[var(--text-primary)]'}`}
                  onClick={() => handleSelect(driver.id)}
                >
                  <span className="block truncate">{driver.name}</span>
                </li>
              ))
            ) : (
              <li className="py-4 text-center text-[var(--text-muted)] italic">
                No se encontraron conductores
              </li>
            )}
          </ul>
        </div>
      )}

      <style>{`
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default SearchableDriverSelect;
