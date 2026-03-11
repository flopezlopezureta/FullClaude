import React, { useState } from 'react';
import { PickupAssignment } from '../../types';
import { IconX, IconPackage, IconCheckCircle, IconPlus, IconTrash } from '../Icon';

interface ConfirmPickupModalProps {
    assignment: PickupAssignment;
    onClose: () => void;
    onConfirm: (assignmentId: string, packageCount: number) => void;
}

const ConfirmPickupModal: React.FC<ConfirmPickupModalProps> = ({ assignment, onClose, onConfirm }) => {
    const [packageCount, setPackageCount] = useState<number | ''>(assignment.packagesToPickup);
    const [error, setError] = useState('');

    const handleCountChange = (value: string) => {
        if (value === '') {
            setPackageCount('');
            setError('');
        } else {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 0) {
                setPackageCount(num);
                setError('');
            }
        }
    };

    const increment = () => {
        setPackageCount(prev => (prev === '' ? 1 : prev + 1));
        setError('');
    };

    const decrement = () => {
        setPackageCount(prev => (prev === '' ? 0 : Math.max(0, prev - 1)));
        setError('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const count = Number(packageCount);
        if (isNaN(count) || count < 0) {
            setError('Ingresa un número válido de paquetes.');
            return;
        }
        onConfirm(assignment.id, count);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Confirmar Retiro</h3>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]"><IconX className="w-6 h-6" /></button>
                </header>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-center">Confirma la cantidad de paquetes retirados para <strong>{assignment.clientName}</strong>.</p>
                        <div>
                            <label htmlFor="package-count" className="block text-sm font-medium text-center text-[var(--text-secondary)] mb-4">
                                Cantidad de paquetes
                            </label>
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    type="button"
                                    onClick={decrement}
                                    className="w-16 h-16 bg-[var(--background-secondary)] border-2 border-[var(--brand-primary)] text-[var(--brand-primary)] text-4xl font-bold rounded-full flex items-center justify-center active:bg-[var(--brand-muted)] transition-colors"
                                    aria-label="Disminuir cantidad"
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    id="package-count"
                                    value={packageCount}
                                    onChange={(e) => handleCountChange(e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    required
                                    className="w-24 text-center text-5xl font-bold py-2 border-0 focus:ring-0 bg-transparent text-[var(--text-primary)] appearance-none [-moz-appearance:textfield]"
                                />
                                <button
                                    type="button"
                                    onClick={increment}
                                    className="w-16 h-16 bg-[var(--brand-primary)] border-2 border-[var(--brand-primary)] text-white text-4xl font-bold rounded-full flex items-center justify-center active:bg-[var(--brand-secondary)] transition-colors"
                                    aria-label="Aumentar cantidad"
                                >
                                    +
                                </button>
                            </div>
                            {error && <p className="text-xs text-red-600 mt-2 text-center">{error}</p>}
                        </div>
                    </div>
                    <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end">
                        <button type="submit" disabled={packageCount === ''} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-slate-400">
                            <IconCheckCircle className="w-5 h-5" />
                            Confirmar Retiro
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default ConfirmPickupModal;