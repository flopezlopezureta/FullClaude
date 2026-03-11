
import React, { useState, ReactNode } from 'react';
import { api, PackageCreationData } from '../../services/api';
import { User } from '../../types';
import { PackageSource, ShippingType } from '../../constants';
import { IconX, IconCheckCircle, IconAlertTriangle, IconMercadoLibre, IconWoocommerce, IconInfo, IconFalabella, IconSearch, IconShopify, IconDownload, IconLoader } from '../Icon';

interface ExternalImportModalProps {
    client: User;
    source: PackageSource;
    onClose: () => void;
    onImport: (packages: Omit<PackageCreationData, 'creatorId' | 'origin'>[]) => Promise<void>;
}

const sourceConfig: { [key in Exclude<PackageSource, 'MANUAL'>]: { title: string; icon: ReactNode; fetchFn: (clientId: string) => Promise<any[]>; orderIdField: 'meliOrderId' | 'wooOrderId' | 'shopifyOrderId' } } = {
    'MERCADO_LIBRE': {
        title: 'Mercado Libre',
        icon: <IconMercadoLibre className="w-8 h-8 text-yellow-500" />,
        fetchFn: api.fetchMeliOrders,
        orderIdField: 'meliOrderId',
    },
    'SHOPIFY': {
        title: 'Shopify',
        icon: <IconShopify className="w-8 h-8 text-green-500" />,
        fetchFn: api.fetchShopifyOrders,
        orderIdField: 'shopifyOrderId',
    },
    'WOOCOMMERCE': {
        title: 'WooCommerce',
        icon: <IconWoocommerce className="w-8 h-8 text-purple-600" />,
        fetchFn: api.fetchWooCommerceOrders,
        orderIdField: 'wooOrderId',
    },
    'FALABELLA': {
        title: 'Falabella',
        icon: <IconFalabella className="w-8 h-8 text-green-700" />,
        fetchFn: api.fetchFalabellaOrders,
        orderIdField: 'meliOrderId', // Using meliOrderId as generic external ID field for now
    }
}

const ExternalImportModal: React.FC<ExternalImportModalProps> = ({ client, source, onClose, onImport }) => {
    const config = sourceConfig[source as Exclude<PackageSource, 'MANUAL'>];
    const [orders, setOrders] = useState<any[]>([]);
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchOrders = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await config.fetchFn(client.id);
            setOrders(data);
        } catch (err: any) {
            setError(err.message || 'Error al obtener las órdenes.');
        } finally {
            setIsLoading(false);
        }
    };

    // Initial fetch
    React.useEffect(() => {
        fetchOrders();
    }, [client.id, source]);

    const filteredOrders = orders.filter(order => 
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.address && order.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleSelectOrder = (id: string) => {
        setSelectedOrderIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedOrderIds.size === filteredOrders.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
        }
    };

    const handleImport = async () => {
        if (selectedOrderIds.size === 0) return;
        setIsImporting(true);
        
        try {
            const selectedOrdersList = orders.filter(o => selectedOrderIds.has(o.id));
            const packagesToCreate: Omit<PackageCreationData, 'creatorId' | 'origin'>[] = selectedOrdersList.map(order => ({
                recipientName: order.recipientName,
                recipientPhone: order.recipientPhone || '',
                recipientAddress: order.address,
                recipientCommune: order.commune,
                recipientCity: order.city,
                notes: order.notes,
                estimatedDelivery: new Date(), // Today by default
                shippingType: ShippingType.SameDay, // Default
                source: source,
                [config.orderIdField]: order.id
            }));

            await onImport(packagesToCreate);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al importar las órdenes.');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <div className="flex items-center gap-3">
                        {config.icon}
                        <div>
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Importar desde {config.title}</h3>
                            <p className="text-sm text-[var(--text-muted)]">Cliente: {client.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]"><IconX className="w-6 h-6" /></button>
                </header>

                <div className="p-4 border-b border-[var(--border-primary)] flex gap-4">
                    <div className="relative flex-1">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                        <input 
                            type="text" 
                            placeholder="Buscar por ID, nombre o dirección..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-[var(--background-muted)] border border-[var(--border-secondary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                        />
                    </div>
                    <button onClick={fetchOrders} className="px-4 py-2 bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]" title="Recargar">
                        <IconLoader className={`w-5 h-5 text-[var(--text-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {error && (
                        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md flex items-center gap-2">
                            <IconAlertTriangle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)]">
                            <IconLoader className="w-8 h-8 animate-spin mb-2" />
                            Cargando órdenes...
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)]">
                            <IconInfo className="w-12 h-12 mb-2 opacity-50" />
                            No se encontraron órdenes pendientes.
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-[var(--background-muted)] text-[var(--text-secondary)] font-semibold sticky top-0">
                                <tr>
                                    <th className="p-3 w-10">
                                        <input type="checkbox" checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0} onChange={handleSelectAll} className="rounded border-gray-300 text-[var(--brand-primary)] focus:ring-[var(--brand-secondary)]" />
                                    </th>
                                    <th className="p-3">ID Orden</th>
                                    <th className="p-3">Destinatario</th>
                                    <th className="p-3">Dirección</th>
                                    <th className="p-3">Comuna</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)]">
                                {filteredOrders.map(order => (
                                    <tr key={order.id} className={`hover:bg-[var(--background-hover)] cursor-pointer ${selectedOrderIds.has(order.id) ? 'bg-[var(--brand-muted)]' : ''}`} onClick={() => handleSelectOrder(order.id)}>
                                        <td className="p-3" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectOrder(order.id)} className="rounded border-gray-300 text-[var(--brand-primary)] focus:ring-[var(--brand-secondary)]" />
                                        </td>
                                        <td className="p-3 font-mono">{order.id}</td>
                                        <td className="p-3 font-medium">{order.recipientName}</td>
                                        <td className="p-3">{order.address}</td>
                                        <td className="p-3">{order.commune}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <footer className="p-4 border-t border-[var(--border-primary)] bg-[var(--background-muted)] rounded-b-xl flex justify-between items-center">
                    <span className="text-sm text-[var(--text-secondary)]">{selectedOrderIds.size} seleccionados</span>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
                        <button 
                            onClick={handleImport} 
                            disabled={isImporting || selectedOrderIds.size === 0}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] disabled:bg-slate-400 disabled:cursor-not-allowed"
                        >
                            {isImporting ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconDownload className="w-4 h-4" />}
                            {isImporting ? 'Importando...' : 'Importar Seleccionados'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default ExternalImportModal;
