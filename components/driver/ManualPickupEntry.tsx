import React, { useState, useContext } from 'react';
import type { User } from '../../types';
import { MessagingPlan } from '../../constants';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import { IconPackage, IconCheckCircle, IconAlertTriangle } from '../Icon';

interface ManualPickupEntryProps {
    client: User;
    onBack: () => void;
}

const ManualPickupEntry: React.FC<ManualPickupEntryProps> = ({ client, onBack }) => {
    const [packageCount, setPackageCount] = useState<number | ''>('');
    const [isFinishing, setIsFinishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const auth = useContext(AuthContext);

    const handleFinishPickup = async () => {
        const count = Number(packageCount);
        if (isNaN(count) || count < 0) {
            setError("Por favor, ingresa un número válido de paquetes.");
            return;
        }

        setIsFinishing(true);
        setError(null);

        try {
            await api.completeClientPickupAssignment(client.id, count);

            const message = `Hola ${client.name}, hemos retirado ${count} paquetes.\n\n¡Gracias!`;
            
            if (auth?.systemSettings.messagingPlan === MessagingPlan.WhatsApp && client.phone) {
                const clientPhone = client.phone.replace(/\D/g, '');
                const whatsappUrl = `https://wa.me/${clientPhone}?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
            } else if (auth?.systemSettings.messagingPlan === MessagingPlan.Email && client.email) {
                const subject = `Retiro de ${count} paquetes completado`;
                const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
                window.open(mailtoUrl, '_blank');
            }

            setTimeout(() => {
                onBack();
            }, 1500);
        } catch (err: any) {
            setError(err.message || "Hubo un error al finalizar el retiro.");
            setIsFinishing(false);
        }
    };

    return (
        <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] text-center mb-2">
                Retirando para: <span className="text-[var(--brand-primary)]">{client.name}</span>
            </h2>

            <div className="my-6">
                <label htmlFor="package-count" className="block text-sm font-medium text-center text-[var(--text-secondary)] mb-2">
                    Ingresa la cantidad de paquetes retirados
                </label>
                <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <IconPackage className="h-5 w-5 text-[var(--text-muted)]" />
                    </div>
                    <input
                        type="number"
                        id="package-count"
                        value={packageCount}
                        onChange={(e) => setPackageCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                        placeholder="0"
                        min="0"
                        className="block w-full text-center text-4xl font-bold py-4 pl-12 pr-4 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-[var(--background-muted)] text-[var(--text-primary)]"
                    />
                </div>
            </div>

            {error && (
                <div className="flex items-center p-3 mb-4 rounded-md text-red-700 bg-red-100">
                    <IconAlertTriangle className="w-5 w-5 mr-3" />
                    <span className="font-medium text-sm">{error}</span>
                </div>
            )}
            
            <div className="mt-6 flex flex-col gap-3">
                <button 
                    onClick={handleFinishPickup}
                    disabled={isFinishing || packageCount === ''}
                    className="w-full px-4 py-3 text-base font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    <IconCheckCircle className="w-5 h-5" />
                    {isFinishing ? 'Finalizando...' : 'Finalizar Retiro y Notificar'}
                </button>
                <button 
                    onClick={onBack}
                    className="w-full px-4 py-2 text-base font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-lg hover:bg-[var(--background-hover)]"
                >
                    Volver
                </button>
            </div>
        </div>
    );
};

export default ManualPickupEntry;