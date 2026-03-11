
import React, { useState } from 'react';
import { Package, User } from '../../types';
import { IconX, IconCalendar } from '../Icon';
import { getISODate } from '../../services/api';

interface AssignDriverModalProps {
  pkg: Package;
  drivers: User[];
  onClose: () => void;
  onAssign: (pkgId: string, driverId: string | null, newDeliveryDate: Date) => void;
}

const AssignDriverModal: React.FC<AssignDriverModalProps> = ({ pkg, drivers, onClose, onAssign }) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(pkg.driverId || '');
  const [deliveryDate, setDeliveryDate] = useState<string>(getISODate(pkg.estimatedDelivery));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const [year, month, day] = deliveryDate.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    onAssign(pkg.id, selectedDriverId || null, localDate);
  };

  const today = getISODate(new Date());

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Asignar/Reasignar Paquete</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Cerrar modal"
          >
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="driver-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Conductor
              </label>
              <select
                id="driver-select"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-[var(--border-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] sm:text-sm rounded-md bg-[var(--background-secondary)] text-[var(--text-primary)]"
              >
                <option value="">-- Sin Asignar --</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="delivery-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Nueva Fecha de Entrega
              </label>
              <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <IconCalendar className="h-5 w-5 text-[var(--text-muted)]" />
                 </div>
                 <input
                    type="date"
                    id="delivery-date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    min={today}
                    required
                    className="mt-1 block w-full pl-10 pr-3 py-2 text-base border-[var(--border-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] sm:text-sm rounded-md bg-[var(--background-secondary)] text-[var(--text-primary)]"
                />
              </div>
            </div>
          </div>

          <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-secondary)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-secondary)]"
            >
              Guardar Cambios
            </button>
          </footer>
        </form>
      </div>
       <style>{`
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default AssignDriverModal;
