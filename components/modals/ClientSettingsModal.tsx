import React, { useState } from 'react';
import { User, UserPricing } from '../../types';
import { UserUpdateData } from '../../services/api';
import { IconX } from '../Icon';

interface ClientSettingsModalProps {
    client: User;
    onClose: () => void;
    onSave: (userId: string, data: UserUpdateData) => void;
}

const ClientSettingsModal: React.FC<ClientSettingsModalProps> = ({ client, onClose, onSave }) => {
    const [pricing, setPricing] = useState<UserPricing>(() => ({
        sameDay: Number(client.pricing?.sameDay) || 0,
        express: Number(client.pricing?.express) || 0,
        nextDay: Number(client.pricing?.nextDay) || 0,
    }));


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // Ensure value is not negative
        const numValue = Number(value);
        setPricing(prev => ({ ...prev, [name]: numValue >= 0 ? numValue : 0 }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(client.id, { pricing });
        onClose();
    };

    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Tarifas de Envío</h3>
                        <p className="text-sm text-[var(--text-muted)]">Para cliente: <span className="font-semibold">{client.name}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
                        <IconX className="w-6 h-6" />
                    </button>
                </header>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <p className="text-sm text-[var(--text-secondary)]">Define los valores que se cobrarán por cada tipo de envío para este cliente.</p>
                        
                        <div>
                            <label htmlFor="sameDay" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Valor Envío en el Día
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                <input
                                    type="number"
                                    id="sameDay"
                                    name="sameDay"
                                    value={pricing.sameDay || 0}
                                    onChange={handleChange}
                                    min="0"
                                    className={`${inputClasses} pl-7`}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="express" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Valor Envío Express
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                <input
                                    type="number"
                                    id="express"
                                    name="express"
                                    value={pricing.express || 0}
                                    onChange={handleChange}
                                    min="0"
                                    className={`${inputClasses} pl-7`}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="nextDay" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Valor Envío Next Day
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                <input
                                    type="number"
                                    id="nextDay"
                                    name="nextDay"
                                    value={pricing.nextDay || 0}
                                    onChange={handleChange}
                                    min="0"
                                    className={`${inputClasses} pl-7`}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                    </div>

                    <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-[var(--text-on-brand)] bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">Guardar Tarifas</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default ClientSettingsModal;