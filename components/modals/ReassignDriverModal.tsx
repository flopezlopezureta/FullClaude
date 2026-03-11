import React, { useState } from 'react';
import { AssignmentEvent, User } from '../../types';
import { IconX, IconTruck } from '../Icon';

interface ReassignDriverModalProps {
  event: AssignmentEvent;
  drivers: User[];
  onClose: () => void;
  onReassign: (eventId: string, newDriverId: string, reason: string) => Promise<void>;
}

const ReassignDriverModal: React.FC<ReassignDriverModalProps> = ({ event, drivers, onClose, onReassign }) => {
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const availableDrivers = drivers.filter(d => d.id !== event.driverId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId || !reason) return;
    setIsSaving(true);
    try {
      await onReassign(event.id, selectedDriverId, reason);
      onClose();
    } catch (error) {
        // Error is handled by parent, just re-enable the button
    } finally {
        setIsSaving(false);
    }
  };

  const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Reasignar Retiro</h3>
          <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]"><IconX className="w-6 h-6" /></button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="text-sm">
                <p><span className="font-semibold">Cliente:</span> {event.clientName}</p>
                <p><span className="font-semibold">Conductor Actual:</span> {event.driverName}</p>
            </div>
            <div>
              <label htmlFor="new-driver-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nuevo Conductor</label>
              <select
                id="new-driver-select"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                required
                className={inputClasses}
              >
                <option value="" disabled>Selecciona un nuevo conductor...</option>
                {availableDrivers.map(driver => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reassign-reason" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Motivo de Reasignación</label>
              <textarea
                id="reassign-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                className={inputClasses}
                placeholder="Ej: Vehículo del conductor actual con desperfecto."
              />
            </div>
          </div>

          <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end">
            <button type="submit" disabled={isSaving || !selectedDriverId || !reason} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] disabled:bg-slate-400">
                <IconTruck className="w-5 h-5 mr-2"/>
              {isSaving ? 'Reasignando...' : 'Confirmar Reasignación'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ReassignDriverModal;