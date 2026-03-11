import React, { useState } from 'react';
import { PickupAssignment, User } from '../../types';
import { IconX, IconTruck } from '../Icon';

interface ReassignAssignmentModalProps {
  assignment: PickupAssignment;
  drivers: User[];
  onClose: () => void;
  onSave: (assignmentId: string, newDriverId: string) => void;
}

const ReassignAssignmentModal: React.FC<ReassignAssignmentModalProps> = ({ assignment, drivers, onClose, onSave }) => {
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Filter out the current driver from the list of available drivers
    const availableDrivers = drivers.filter(d => d.id !== assignment.runId.split('-')[1]); // A bit of a hack to get driver id from runId if not directly available

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDriverId) return;
        setIsSaving(true);
        onSave(assignment.id, selectedDriverId);
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
                        <p className="text-sm">Reasignando el retiro para el cliente <strong>{assignment.clientName}</strong>.</p>
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
                    </div>

                    <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end">
                        <button type="submit" disabled={isSaving || !selectedDriverId} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] disabled:bg-slate-400">
                            <IconTruck className="w-5 h-5 mr-2" />
                            {isSaving ? 'Reasignando...' : 'Confirmar Reasignación'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default ReassignAssignmentModal;