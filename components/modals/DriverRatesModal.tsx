import React, { useState } from 'react';
import { User, UserPricing } from '../../types';
import { UserUpdateData } from '../../services/api';
import { IconX } from '../Icon';

interface DriverRatesModalProps {
    driver: User;
    onClose: () => void;
    onSave: (userId: string, data: UserUpdateData) => void;
}

const DriverRatesModal: React.FC<DriverRatesModalProps> = ({ driver, onClose, onSave }) => {
    const [pricing, setPricing] = useState<UserPricing>(() => ({
        sameDay: Number(driver.pricing?.sameDay) || 0,
        express: Number(driver.pricing?.express) || 0,
        nextDay: Number(driver.pricing?.nextDay) || 0,
        pickup: Number(driver.pricing?.pickup) || 0,
    }));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numericString = value.replace(/\D/g, ''); // Remove all non-digit characters
        const numValue = parseInt(numericString, 10) || 0; // Convert to number, default to 0 if empty
        setPricing(prev => ({ ...prev, [name]: numValue }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(driver.id, { pricing });
        onClose();
    };
    
    const formatCurrency = (value: number) => {
        return value.toLocaleString('es-CL');
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
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Tarifas de Entrega y Retiros</h3>
                        <p className="text-sm text-[var(--text-muted)]">Para conductor: <span className="font-semibold">{driver.name}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
                        <IconX className="w-6 h-6" />
                    </button>
                </header>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <p className="text-sm text-[var(--text-secondary)]">Define los valores que se pagarán al conductor por cada tipo de servicio.</p>
                        
                        <div>
                            <label htmlFor="sameDay" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Valor Entrega en el Día
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    id="sameDay"
                                    name="sameDay"
                                    value={formatCurrency(pricing.sameDay || 0)}
                                    onChange={handleChange}
                                    className={`${inputClasses} pl-7`}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="express" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Valor Entrega Express
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    id="express"
                                    name="express"
                                    value={formatCurrency(pricing.express || 0)}
                                    onChange={handleChange}
                                    className={`${inputClasses} pl-7`}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="nextDay" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Valor Entrega Next Day
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    id="nextDay"
                                    name="nextDay"
                                    value={formatCurrency(pricing.nextDay || 0)}
                                    onChange={handleChange}
                                    className={`${inputClasses} pl-7`}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[var(--border-primary)]">
                            <label htmlFor="pickup" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Valor por Retiro
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    id="pickup"
                                    name="pickup"
                                    value={formatCurrency(pricing.pickup || 0)}
                                    onChange={handleChange}
                                    className={`${inputClasses} pl-7`}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                    </div>

                    <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">Guardar Tarifas</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default DriverRatesModal;