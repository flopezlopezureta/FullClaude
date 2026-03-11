import React, { useState } from 'react';
import type { User, Package, PickupRun } from '../../types';
import { IconX, IconTruck, IconCheckCircle } from '../Icon';
import { PackageStatus } from '../../constants';

interface AddAssignmentsToRunModalProps {
    onClose: () => void;
    onAdd: (runId: string, assignments: { clientId: string; cost: number; packagesToPickup: number }[]) => void;
    run: PickupRun;
    availableClients: User[];
    packages: Package[];
}

const AddAssignmentsToRunModal: React.FC<AddAssignmentsToRunModalProps> = ({ onClose, onAdd, run, availableClients, packages }) => {
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    const toggleClientSelection = (clientId: string) => {
        setSelectedClients(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clientId)) newSet.delete(clientId);
            else newSet.add(clientId);
            return newSet;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedClients.size === 0) return;

        setIsSaving(true);
        
        const assignmentsToAdd = availableClients
            .filter(c => selectedClients.has(c.id))
            .map(client => ({
                clientId: client.id,
                cost: client.pickupCost || 0,
                packagesToPickup: packages.filter(p => p.creatorId === client.id && p.status === PackageStatus.Pending).length,
            }));

        onAdd(run.id, assignmentsToAdd);
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Agregar Retiros a Ruta</h3>
                        <p className="text-sm text-[var(--text-muted)]">Conductor: {run.driverName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]"><IconX className="w-6 h-6" /></button>
                </header>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <h4 className="text-md font-semibold text-[var(--text-secondary)] mb-2">Selecciona clientes para agregar:</h4>
                        <div className="space-y-2">
                             {availableClients.length > 0 ? availableClients.map(client => (
                                <div
                                    key={client.id}
                                    onClick={() => toggleClientSelection(client.id)}
                                    className={`p-3 border rounded-md cursor-pointer transition-colors flex items-center justify-between ${selectedClients.has(client.id) ? 'bg-[var(--brand-muted)] border-[var(--brand-secondary)]' : 'bg-[var(--background-muted)] border-[var(--border-primary)] hover:bg-[var(--background-hover)]'}`}
                                >
                                    <div>
                                        <p className="font-semibold text-sm text-[var(--text-primary)]">{client.name}</p>
                                        <p className="text-xs text-[var(--text-secondary)]">{packages.filter(p => p.creatorId === client.id && p.status === 'PENDIENTE').length} paquetes</p>
                                    </div>
                                     <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${selectedClients.has(client.id) ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' : 'border-gray-300'}`}>
                                        {selectedClients.has(client.id) && <IconCheckCircle className="w-3 h-3 text-white"/>}
                                    </div>
                                </div>
                            )) : <p className="text-sm text-center text-[var(--text-muted)] py-4">No hay más clientes con retiros pendientes.</p>}
                        </div>
                    </div>

                    <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end">
                        <button type="submit" disabled={isSaving || selectedClients.size === 0} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] disabled:bg-slate-400">
                            <IconTruck className="w-5 h-5 mr-2"/>
                            {isSaving ? 'Agregando...' : `Agregar ${selectedClients.size} Retiro(s)`}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default AddAssignmentsToRunModal;