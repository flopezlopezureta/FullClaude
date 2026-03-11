import React from 'react';
import { AssignmentEvent, User } from '../../types';
import { IconX, IconWhatsapp, IconPackage, IconUserCheck, IconUser } from '../Icon';

interface PickupSummaryModalProps {
    events: AssignmentEvent[];
    driver: User;
    onClose: () => void;
}

const PickupSummaryModal: React.FC<PickupSummaryModalProps> = ({ events, driver, onClose }) => {
    const totalPackages = events.reduce((sum, e) => sum + (e.packagesPickedUp || 0), 0);

    const handleSendWhatsApp = () => {
        let message = `*Resumen de Retiros - ${new Date().toLocaleDateString('es-CL')}*\n\n`;
        events.forEach(event => {
            message += `*Cliente:* ${event.clientName}\n`;
            message += `*Paquetes Retirados:* ${event.packagesPickedUp || 0}\n\n`;
        });
        message += `--------------------\n`;
        message += `*Total Paquetes Retirados Hoy: ${totalPackages}*`;

        const phone = driver.phone?.replace(/\D/g, '');
        if (phone) {
            const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank');
        } else {
            alert('No tienes un número de teléfono configurado para enviar el resumen.');
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg h-[90vh] flex flex-col animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Resumen de Retiros del Día</h3>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
                        <IconX className="w-6 h-6" />
                    </button>
                </header>
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-4 bg-[var(--background-muted)] rounded-lg text-center mb-6">
                        <p className="text-sm font-medium text-[var(--text-muted)]">Total Paquetes Retirados Hoy</p>
                        <p className="text-5xl font-extrabold text-[var(--brand-primary)] mt-1">{totalPackages}</p>
                    </div>
                    
                    <div className="space-y-3">
                        {events.map(event => (
                            <div key={event.id} className="bg-[var(--background-muted)] p-3 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <IconUser className="w-8 h-8 p-1.5 bg-[var(--background-secondary)] text-[var(--text-secondary)] rounded-full flex-shrink-0"/>
                                    <div>
                                        <p className="font-semibold text-sm text-[var(--text-primary)]">{event.clientName}</p>
                                        <p className="text-xs text-[var(--text-muted)]">
                                            Completado a las {new Date(event.completedAt!).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg text-green-600 flex items-center gap-1.5">
                                        <IconPackage className="w-4 h-4" />
                                        {event.packagesPickedUp || 0}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex flex-col sm:flex-row justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">
                        Cerrar
                    </button>
                    <button 
                        onClick={handleSendWhatsApp}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                    >
                        <IconWhatsapp className="w-5 h-5 mr-2"/>
                        Enviar a mi WhatsApp
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default PickupSummaryModal;
