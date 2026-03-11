import React, { useState } from 'react';
import { PickupAssignment } from '../../types';
import { IconX, IconDollarSign } from '../Icon';

interface EditAssignmentCostModalProps {
  assignment: PickupAssignment;
  onClose: () => void;
  onSave: (assignmentId: string, cost: number) => void;
}

const EditAssignmentCostModal: React.FC<EditAssignmentCostModalProps> = ({ assignment, onClose, onSave }) => {
  const [cost, setCost] = useState<string>(assignment.cost.toString() || '0');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const numericCost = parseInt(cost, 10);
    if (!isNaN(numericCost) && numericCost >= 0) {
      onSave(assignment.id, numericCost);
    } else {
        setIsSaving(false);
    }
  };

  const inputClasses = "w-full pl-10 pr-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Editar Pago de Retiro</h3>
          <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]"><IconX className="w-6 h-6" /></button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="text-sm">
                <p><span className="font-semibold">Cliente:</span> {assignment.clientName}</p>
                <p><span className="font-semibold">Paquetes a retirar:</span> {assignment.packagesToPickup}</p>
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

export default EditAssignmentCostModal;