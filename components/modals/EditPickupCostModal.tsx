import React, { useState } from 'react';
import { AssignmentEvent } from '../../types';
import { IconX, IconDollarSign } from '../Icon';

interface EditPickupCostModalProps {
  event: AssignmentEvent;
  onClose: () => void;
  onSave: (eventId: string, cost: number) => Promise<void>;
}

const EditPickupCostModal: React.FC<EditPickupCostModalProps> = ({ event, onClose, onSave }) => {
  const [cost, setCost] = useState<string>(event.pickupCost?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const numericCost = Number(cost);
    if (!isNaN(numericCost) && numericCost >= 0) {
      try {
        await onSave(event.id, numericCost);
        onClose();
      } catch (error) {
        // Parent shows alert, just re-enable button
        setIsSaving(false);
      }
    } else {
        setIsSaving(false);
    }
  };
  
  const inputClasses = "w-full pl-10 pr-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Registrar Pago de Retiro</h3>
          <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]"><IconX className="w-6 h-6" /></button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="text-sm">
                <p><span className="font-semibold">Cliente:</span> {event.clientName}</p>
                <p><span className="font-semibold">Conductor:</span> {event.driverName}</p>
                <p><span className="font-semibold">Fecha:</span> {new Date(event.completedAt || event.assignedAt).toLocaleDateString('es-CL')}</p>
                <p><span className="font-semibold">Paquetes:</span> {event.packagesPickedUp || 'N/A'}</p>
            </div>
            <div>
              <label htmlFor="pickupCost" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Costo Acordado</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><IconDollarSign className="h-5 w-5 text-[var(--text-muted)]" /></div>
                <input
                  type="number"
                  id="pickupCost"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  required
                  min="0"
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end">
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] disabled:bg-slate-400">
              {isSaving ? 'Guardando...' : 'Guardar Costo'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default EditPickupCostModal;