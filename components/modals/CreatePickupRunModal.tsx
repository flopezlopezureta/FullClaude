import React, { useState } from 'react';
import type { User, Package, PickupShift } from '../../types';
import { IconX, IconTruck } from '../Icon';

interface CreatePickupRunModalProps {
    onClose: () => void;
    onCreate: (data: { driverId: string; shift: PickupShift; date: string; assignments: { clientId: string; cost: number; packagesToPickup: number }[] }) => void;
    clients: User[];
    drivers: User[];
    packages: Package[];
    shift: PickupShift;
    date: string;
}

const CreatePickupRunModal: React.FC<CreatePickupRunModalProps> = ({ onClose, onCreate, clients, drivers, packages, shift, date }) => {
    const [driverId, setDriverId] = useState<string>('');
    const [assignments, setAssignments] = useState(() => 
        clients.map(c => ({
            clientId: c.id,
            clientName: c.name,
            cost: (c.pickupCost || 0).toString(), // Store cost as string for easier input handling
            packagesToPickup: packages.filter(p => p.creatorId === c.id && p.status === 'PENDIENTE').length,
        }))
    );
    const [isSaving, setIsSaving] = useState(false);

    const handleCostChange = (clientId: string, newCost: string) => {
        // Allow only numeric values (and empty string for clearing the input)
        if (/^\d*$/.test(newCost)) {
            setAssignments(prev => prev.map(a => a.clientId === clientId ? { ...a, cost: newCost } : a));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!driverId) return;
        setIsSaving(true);
        onCreate({
            driverId,
            shift,
            date,
            assignments: assignments.map(({ clientId, cost, packagesToPickup }) => ({
                clientId,
                cost: Number(cost) || 0, // Convert back to number on submit
                packagesToPickup
            }))
        });
    };
    
    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-2xl animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Crear Ruta de Retiro</h3>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]"><IconX className="w-6 h-6" /></button>
                </header>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <div>
                            <label htmlFor="driver-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Asignar a Conductor</label>
                            <select id="driver-select" value={driverId} onChange={(e) => setDriverId(e.target.value)} required className={inputClasses}>
                                <option value="" disabled>Selecciona un conductor...</option>
                                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="pt-4 border-t border-[var(--border-primary)]">
                            <h4 className="text-md font-semibold text-[var(--text-secondary)] mb-2">Clientes a Visitar ({assignments.length})</h4>
                            <div className="space-y-3">
                                {assignments.map(a => (
                                    <div key={a.clientId} className="grid grid-cols-3 gap-4 items-center p-2 bg-[var(--background-muted)] rounded-md">
                                        <div className="col-span-2">
                                            <p className="font-semibold text-sm text-[var(--text-primary)]">{a.clientName}</p>
                                            <p className="text-xs text-[var(--text-muted)]">{a.packagesToPickup} paquetes</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--text-muted)]">Costo Retiro</label>
                                             <div className="relative">
                                                <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                                <input
                                                    type="number"
                                                    value={a.cost}
                                                    onChange={(e) => handleCostChange(a.clientId, e.target.value)}
                                                    className="w-full text-sm py-1 pl-6 pr-2 border border-[var(--border-secondary)] rounded-md"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end">
                        <button type="submit" disabled={isSaving || !driverId} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] disabled:bg-slate-400">
                            <IconTruck className="w-5 h-5 mr-2"/>
                            {isSaving ? 'Creando...' : 'Confirmar y Crear Ruta'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default CreatePickupRunModal;