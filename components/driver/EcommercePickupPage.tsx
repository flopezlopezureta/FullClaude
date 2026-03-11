import React, { useState, useEffect } from 'react';
import type { User } from '../../types';
import { Role } from '../../constants';
import { api } from '../../services/api';
import OrderScanner from './OrderScanner';
import { IconChevronRight, IconBuildingStore } from '../Icon';

const EcommercePickupPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [selectedClient, setSelectedClient] = useState<User | null>(null);
    const [integratedClients, setIntegratedClients] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoading(true);
            try {
                const allUsers = await api.getUsers();
                const clientsWithMeli = allUsers.filter(u => u.role === Role.Client && u.integrations?.meli);
                setIntegratedClients(clientsWithMeli);
            } catch (error) {
                console.error("Failed to fetch integrated clients", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClients();
    }, []);

    if (selectedClient) {
        return <OrderScanner client={selectedClient} onBack={() => setSelectedClient(null)} />;
    }

    if (isLoading) {
        return <p className="p-6 text-center text-[var(--text-muted)]">Buscando clientes integrados...</p>;
    }

    return (
        <div className="bg-[var(--background-secondary)] shadow-md rounded-lg max-w-2xl mx-auto">
            <div className="p-6 border-b border-[var(--border-primary)]">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">Retiro E-commerce</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">Selecciona el cliente para escanear sus paquetes de Mercado Libre.</p>
            </div>
            <div className="divide-y divide-[var(--border-primary)]">
                {integratedClients.length > 0 ? (
                    integratedClients.map(client => (
                        <button
                            key={client.id}
                            onClick={() => setSelectedClient(client)}
                            className="w-full text-left p-4 flex items-center justify-between hover:bg-[var(--background-hover)] transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="bg-[var(--background-muted)] p-2 rounded-full">
                                    <IconBuildingStore className="w-6 h-6 text-[var(--text-muted)]" />
                                </div>
                                <div>
                                    <p className="font-semibold text-[var(--text-primary)]">{client.name}</p>
                                </div>
                            </div>
                            <IconChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                        </button>
                    ))
                ) : (
                    <p className="p-6 text-center text-[var(--text-muted)]">No hay clientes con la integración de Mercado Libre activa.</p>
                )}
            </div>
        </div>
    );
};

export default EcommercePickupPage;