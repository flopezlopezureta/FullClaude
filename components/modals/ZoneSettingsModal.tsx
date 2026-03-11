import React, { useState, useEffect } from 'react';
import { DeliveryZone, ZonePricing } from '../../types';
import { IconX } from '../Icon';

interface ZoneSettingsModalProps {
    zone: DeliveryZone | null;
    onClose: () => void;
    onSave: (data: Omit<DeliveryZone, 'id' | 'communes'>, id?: string) => void;
    selectedCommunes: string[];
    onCommunesChange: (communes: string[]) => void;
}

const ZoneSettingsModal: React.FC<ZoneSettingsModalProps> = ({ zone, onClose, onSave, selectedCommunes, onCommunesChange }) => {
    const [name, setName] = useState('');
    const [pricing, setPricing] = useState<ZonePricing>({
        sameDay: 0,
        express: 0,
        nextDay: 0
    });

    useEffect(() => {
        if (zone) {
            setName(zone.name);
            setPricing(prev => ({ ...prev, ...zone.pricing }));
        } else {
            setName('');
            setPricing({ sameDay: 0, express: 0, nextDay: 0 });
        }
    }, [zone]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const saveData = { name, pricing };
        onSave(saveData, zone?.id);
    };

    const handleCommunesTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const communesArray = e.target.value.split('\n').map(c => c.trim()).filter(Boolean);
        onCommunesChange(communesArray);
    }

    const handlePricingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numericString = value.replace(/\D/g, '');
        const numValue = parseInt(numericString, 10) || 0;
        setPricing(prev => ({ ...prev, [name]: numValue }));
    };
    
    const formatCurrency = (value: number) => {
        return value.toLocaleString('es-CL');
    };
    
    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{zone ? 'Editar Zona' : 'Crear Nueva Zona'}</h3>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
                        <IconX className="w-6 h-6" />
                    </button>
                </header>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <div>
                            <label htmlFor="zoneName" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nombre de la Zona</label>
                            <input
                                type="text"
                                id="zoneName"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className={inputClasses}
                                placeholder="Ej: Santiago Periferia"
                            />
                        </div>
                        <div>
                            <label htmlFor="communes" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Comunas</label>
                            <p className="text-xs text-[var(--text-muted)] mb-2">Selecciónalas en el mapa o ingrésalas aquí (una por línea).</p>
                            <textarea
                                id="communes"
                                value={selectedCommunes.join('\n')}
                                onChange={handleCommunesTextChange}
                                required
                                rows={5}
                                className={inputClasses}
                                placeholder="Puente Alto\nLa Florida\nMaipú..."
                            />
                        </div>
                        
                        <h4 className="text-md font-semibold text-[var(--text-secondary)] border-b border-[var(--border-primary)] pb-2 pt-2">Tarifas para esta Zona</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="sameDay" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">En el Día</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)]">$</span>
                                    <input 
                                        type="text"
                                        inputMode="numeric"
                                        id="sameDay" 
                                        name="sameDay" 
                                        value={formatCurrency(pricing.sameDay || 0)} 
                                        onChange={handlePricingChange} 
                                        className={`${inputClasses} pl-7`} 
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="express" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Express</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)]">$</span>
                                     <input 
                                        type="text"
                                        inputMode="numeric"
                                        id="express" 
                                        name="express" 
                                        value={formatCurrency(pricing.express || 0)} 
                                        onChange={handlePricingChange} 
                                        className={`${inputClasses} pl-7`} 
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="nextDay" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Next Day</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)]">$</span>
                                    <input 
                                        type="text"
                                        inputMode="numeric"
                                        id="nextDay" 
                                        name="nextDay" 
                                        value={formatCurrency(pricing.nextDay || 0)} 
                                        onChange={handlePricingChange} 
                                        className={`${inputClasses} pl-7`} 
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                    <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-[var(--text-on-brand)] bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">Guardar Zona</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default ZoneSettingsModal;