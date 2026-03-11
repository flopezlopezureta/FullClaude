

import React, { useState, useEffect, useMemo } from 'react';
import { api, PackageCreationData } from '../../services/api';
import type { User, MeliOrder } from '../../types';
import { IconDownload, IconAlertTriangle, IconLoader, IconMercadoLibre, IconSearch, IconShopify, IconCheckCircle } from '../Icon';
import { PackageSource, ShippingType } from '../../constants';

const ImportOrdersPage: React.FC = () => {
    const [allClients, setAllClients] = useState<User[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [orders, setOrders] = useState<MeliOrder[]>([]);
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [source, setSource] = useState<PackageSource>(PackageSource.MercadoLibre);

    // Filter states
    const [textSearch, setTextSearch] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [communeFilter, setCommuneFilter] = useState('');

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const users = await api.getUsers();
                setAllClients(users.filter(u => u.role === 'CLIENT'));
            } catch (err) {
                setError('No se pudieron cargar los clientes.');
            }
        };
        fetchClients();
    }, []);

    const clientsForSource = useMemo(() => {
        if (source === PackageSource.MercadoLibre) {
            return allClients.filter(u => u.integrations?.meli);
        }
        // For Shopify (Global Integration), any client is eligible to have orders assigned to them
        return allClients;
    }, [allClients, source]);

    const handleFetchOrders = async () => {
        if (!selectedClientId) return;
        setIsLoading(true);
        setError(null);
        setOrders([]);
        setSelectedOrders(new Set());
        // Reset filters on new search
        setTextSearch('');
        setCityFilter('');
        setCommuneFilter('');
        
        try {
            let fetchedOrders = [];
            if (source === PackageSource.MercadoLibre) {
                fetchedOrders = await api.fetchMeliOrders(selectedClientId);
            } else if (source === PackageSource.Shopify) {
                fetchedOrders = await api.fetchShopifyOrders(selectedClientId);
            }
            setOrders(fetchedOrders);
        } catch (err: any) {
            setError(err.message || 'Error al cargar las órdenes.');
        } finally {
            setIsLoading(false);
        }
    };

    // Derived unique lists for dropdowns based on LOADED orders
    const uniqueCities = useMemo(() => {
        const cities = new Set(orders.map(o => o.city).filter(Boolean));
        return Array.from(cities).sort();
    }, [orders]);

    const communesForSelectedCity = useMemo(() => {
        const communes = new Set<string>();
        orders.forEach(order => {
            if (!cityFilter || order.city === cityFilter) {
                if (order.commune) communes.add(order.commune);
            }
        });
        return Array.from(communes).sort();
    }, [orders, cityFilter]);


    // Filter logic
    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const matchesCity = cityFilter === '' || order.city === cityFilter;
            const matchesCommune = communeFilter === '' || order.commune === communeFilter;
            const matchesText = textSearch === '' || 
                (order.recipientName && order.recipientName.toLowerCase().includes(textSearch.toLowerCase())) ||
                (order.address && order.address.toLowerCase().includes(textSearch.toLowerCase())) ||
                (order.id && order.id.toString().includes(textSearch));
            
            return matchesCity && matchesCommune && matchesText;
        });
    }, [orders, cityFilter, communeFilter, textSearch]);

    const handleSelectOrder = (orderId: string) => {
        setSelectedOrders(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(orderId)) {
                newSelection.delete(orderId);
            } else {
                newSelection.add(orderId);
            }
            return newSelection;
        });
    };
    
    const handleSelectAll = () => {
        // Select only currently visible/filtered orders
        const visibleOrderIds = filteredOrders.map(o => o.id);
        const allVisibleSelected = visibleOrderIds.every(id => selectedOrders.has(id));

        setSelectedOrders(prev => {
            const newSelection = new Set(prev);
            if (allVisibleSelected) {
                visibleOrderIds.forEach(id => newSelection.delete(id));
            } else {
                visibleOrderIds.forEach(id => newSelection.add(id));
            }
            return newSelection;
        });
    };

    const handleImport = async () => {
        if (selectedOrders.size === 0) return;
        setIsImporting(true);
        setError(null);
        try {
            if (source === PackageSource.MercadoLibre) {
                await api.importMeliOrders(selectedClientId, Array.from(selectedOrders));
            } else {
                // Generic import for Shopify
                const selectedOrdersList = orders.filter(o => selectedOrders.has(o.id));
                
                // Refetch user to get origin address
                const client = allClients.find(c => c.id === selectedClientId);
                const origin = client?.pickupAddress || client?.address || 'Shopify Import';

                const packagesToCreate: PackageCreationData[] = selectedOrdersList.map(order => ({
                    recipientName: order.recipientName,
                    recipientPhone: '', 
                    recipientAddress: order.address,
                    recipientCommune: order.commune,
                    recipientCity: order.city,
                    notes: order.notes,
                    estimatedDelivery: new Date(),
                    shippingType: ShippingType.SameDay,
                    source: source,
                    shopifyOrderId: source === PackageSource.Shopify ? order.id : undefined,
                    creatorId: selectedClientId,
                    origin: origin
                }));

                await api.createMultiplePackages(packagesToCreate);
            }

            // Refetch orders to show that the imported ones are gone
            await handleFetchOrders();
            alert('Importación exitosa');
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error durante la importación.');
        } finally {
            setIsImporting(false);
        }
    };
    
    const customCheckboxClass = "appearance-none h-4 w-4 border border-[var(--border-secondary)] rounded bg-[var(--background-secondary)] checked:bg-[var(--brand-primary)] checked:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)]";
    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";
    const selectClasses = "block w-full pl-3 pr-10 py-2 border border-[var(--border-secondary)] rounded-md leading-5 bg-[var(--background-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] sm:text-sm";

    const isAllFilteredSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedOrders.has(o.id));

    return (
        <div className="space-y-6">
            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Importar Envíos</h2>
                        <p className="text-sm text-[var(--text-muted)]">Selecciona la fuente y el cliente.</p>
                    </div>
                    <div className="flex bg-[var(--background-muted)] p-1 rounded-lg">
                        <button
                            onClick={() => { setSource(PackageSource.MercadoLibre); setOrders([]); setSelectedClientId(''); }}
                            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${source === PackageSource.MercadoLibre ? 'bg-white shadow text-yellow-600' : 'text-[var(--text-secondary)] hover:bg-[var(--background-hover)]'}`}
                        >
                            <IconMercadoLibre className="w-5 h-5 mr-2" />
                            Mercado Libre
                        </button>
                        <button
                            onClick={() => { setSource(PackageSource.Shopify); setOrders([]); setSelectedClientId(''); }}
                            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${source === PackageSource.Shopify ? 'bg-white shadow text-green-600' : 'text-[var(--text-secondary)] hover:bg-[var(--background-hover)]'}`}
                        >
                            <IconShopify className="w-5 h-5 mr-2" />
                            Shopify
                        </button>
                    </div>
                </div>

                <div className="flex items-end gap-4">
                    <div className="flex-grow">
                        <label htmlFor="client-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            {source === PackageSource.MercadoLibre ? 'Cliente con Integración ML' : 'Asignar a Cliente'}
                        </label>
                        <select
                            id="client-select"
                            value={selectedClientId}
                            onChange={e => setSelectedClientId(e.target.value)}
                            className={inputClasses}
                        >
                            <option value="">-- Seleccionar Cliente --</option>
                            {clientsForSource.map(client => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleFetchOrders}
                        disabled={!selectedClientId || isLoading}
                        className={`flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white disabled:bg-slate-400 ${source === PackageSource.MercadoLibre ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        {source === PackageSource.MercadoLibre ? <IconMercadoLibre className="w-5 h-5 mr-2"/> : <IconShopify className="w-5 h-5 mr-2"/>}
                        {isLoading ? 'Cargando...' : 'Buscar Envíos'}
                    </button>
                </div>
            </div>

            {error && (
                 <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md flex items-center gap-3">
                    <IconAlertTriangle className="w-5 h-5"/>
                    <span className="font-medium">{error}</span>
                </div>
            )}

            {orders.length > 0 && !isLoading && (
                 <div className="bg-[var(--background-secondary)] shadow-md rounded-lg flex flex-col h-[600px]">
                    <div className="p-4 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--background-muted)]">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                            {filteredOrders.length} Envíos Encontrados
                        </h3>
                        <button
                            onClick={handleImport}
                            disabled={isImporting || selectedOrders.size === 0}
                            className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] disabled:bg-slate-400"
                        >
                             {isImporting ? <IconLoader className="w-5 h-5 mr-2 animate-spin"/> : <IconDownload className="w-5 h-5 mr-2"/>}
                             {isImporting ? 'Importando...' : `Importar ${selectedOrders.size} Envío(s)`}
                        </button>
                    </div>

                    {/* FILTERS BAR */}
                    <div className="p-4 border-b border-[var(--border-primary)] grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <IconSearch className="h-4 w-4 text-[var(--text-muted)]" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={textSearch}
                                onChange={(e) => setTextSearch(e.target.value)}
                                className={`${inputClasses} pl-9`}
                            />
                        </div>
                        <select
                            value={cityFilter}
                            onChange={(e) => {
                                setCityFilter(e.target.value);
                                setCommuneFilter(''); // Reset commune filter when city changes
                            }}
                            className={selectClasses}
                        >
                            <option value="">Todas las Ciudades</option>
                            {uniqueCities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                        <select
                            value={communeFilter}
                            onChange={(e) => setCommuneFilter(e.target.value)}
                            className={selectClasses}
                        >
                            <option value="">Todas las Comunas</option>
                            {communesForSelectedCity
                                .map(commune => (
                                <option key={commune} value={commune}>{commune}</option>
                            ))}
                        </select>
                    </div>

                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="min-w-full text-sm">
                            <thead className="bg-[var(--background-muted)] sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 w-10 text-center border-b border-[var(--border-secondary)]">
                                        <input 
                                            type="checkbox" 
                                            className={customCheckboxClass} 
                                            checked={isAllFilteredSelected} 
                                            onChange={handleSelectAll} 
                                            title="Seleccionar visibles"
                                        />
                                    </th>
                                    <th className="p-3 text-left font-medium text-[var(--text-muted)] border-b border-[var(--border-secondary)]">Destinatario</th>
                                    <th className="p-3 text-left font-medium text-[var(--text-muted)] border-b border-[var(--border-secondary)]">Dirección</th>
                                    <th className="p-3 text-left font-medium text-[var(--text-muted)] border-b border-[var(--border-secondary)]">Ubicación</th>
                                    <th className="p-3 text-left font-medium text-[var(--text-muted)] border-b border-[var(--border-secondary)]">ID Orden</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)]">
                                {filteredOrders.length > 0 ? filteredOrders.map(order => (
                                    <tr key={order.id} className={`transition-colors hover:bg-[var(--background-hover)] ${selectedOrders.has(order.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`} onClick={() => handleSelectOrder(order.id)}>
                                        <td className="p-3 text-center cursor-pointer" onClick={e => {e.stopPropagation(); handleSelectOrder(order.id)}}>
                                            <input 
                                                type="checkbox" 
                                                className={customCheckboxClass} 
                                                checked={selectedOrders.has(order.id)} 
                                                readOnly
                                            />
                                        </td>
                                        <td className="p-3 font-medium text-[var(--text-primary)]">{order.recipientName}</td>
                                        <td className="p-3 text-[var(--text-secondary)]">{order.address}</td>
                                        <td className="p-3 text-[var(--text-secondary)]">
                                            <div className="font-bold">{order.commune}</div>
                                            <div className="text-xs">{order.city}</div>
                                        </td>
                                        <td className="p-3 text-[var(--text-muted)] font-mono">{order.id}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">
                                            No se encontraron envíos con los filtros actuales.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 bg-[var(--background-muted)] border-t border-[var(--border-primary)] text-right text-sm font-semibold text-[var(--text-secondary)]">
                        {selectedOrders.size} envío(s) seleccionado(s)
                    </div>
                </div>
            )}

            {!isLoading && !error && orders.length === 0 && selectedClientId && (
                <div className="text-center p-12 bg-[var(--background-secondary)] rounded-lg shadow-md">
                    <IconCheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500"/>
                    <h3 className="font-bold text-lg text-[var(--text-primary)]">¡Todo al día!</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">No se encontraron nuevos envíos para importar para este cliente.</p>
                </div>
            )}
        </div>
    );
};

export default ImportOrdersPage;