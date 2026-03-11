import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { Role, PackageStatus, ShippingType } from '../../constants';
import type { User, Package, DeliveryZone } from '../../types';
import { IconDollarSign, IconFileInvoice, IconChevronLeft, IconChevronRight, IconPackage, IconCheckCircle, IconRefresh } from '../Icon';
import ConfirmationModal from '../modals/ConfirmationModal';
import ClientInvoiceHistoryModal from '../modals/ClientInvoiceHistoryModal';

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

type BillingStatus = 'PENDIENTE' | 'FACTURADO' | 'REFACTURAR' | 'SIN_MOVIMIENTO';

interface ClientBillingData {
    clientId: string;
    clientName: string;
    status: BillingStatus;
    amountToBill: number;
    theoreticalTotalCost: number;
    lastBilledAmount: number;
    deliveredPackagesInPeriod: Package[];
    pickupCount: number;
    theoreticalDeliveryCost: number;
    theoreticalPickupCost: number;
}


const GlobalBillingPage: React.FC = () => {
    const [packages, setPackages] = useState<Package[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isConfirming, setIsConfirming] = useState(false);
    const [isBilling, setIsBilling] = useState(false);
    const [viewingInvoicesClient, setViewingInvoicesClient] = useState<User | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [packagesResponse, allUsers, deliveryZones] = await Promise.all([
                api.getPackages({ limit: 0 }),
                api.getUsers(),
                api.getDeliveryZones()
            ]);
            setPackages(packagesResponse.packages);
            setUsers(allUsers);
            setZones(deliveryZones);
        } catch (error) {
            console.error("Failed to fetch billing data", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, []);
    
    const handlePrevMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

    const clients = useMemo(() => 
        users.filter(u => u.role === Role.Client).sort((a, b) => a.name.localeCompare(b.name)),
        [users]
    );

    const communeToZoneMap = useMemo(() => {
        const map = new Map<string, DeliveryZone>();
        zones.forEach(zone => {
            zone.communes.forEach(commune => {
                map.set(commune.toLowerCase().trim(), zone);
            });
        });
        return map;
    }, [zones]);

    const getPackageCost = (pkg: Package, client: User): number => {
        if (client.pricing) {
            switch (pkg.shippingType) {
                case ShippingType.SameDay: if (client.pricing.sameDay > 0) return client.pricing.sameDay; break;
                case ShippingType.Express: if (client.pricing.express > 0) return client.pricing.express; break;
                case ShippingType.NextDay: if (client.pricing.nextDay > 0) return client.pricing.nextDay; break;
            }
        }
        const zone = communeToZoneMap.get(pkg.recipientCommune.toLowerCase().trim());
        if (!zone) return 0;
        switch (pkg.shippingType) {
            case ShippingType.SameDay: return zone.pricing.sameDay;
            case ShippingType.Express: return zone.pricing.express;
            case ShippingType.NextDay: return zone.pricing.nextDay;
            default: return 0;
        }
    };

    const billingData: ClientBillingData[] = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

        return clients.map(client => {
            const clientPackagesInPeriod = packages.filter(pkg => {
                if (pkg.creatorId !== client.id) return false;
                const creationDate = new Date(pkg.createdAt);
                return creationDate >= startDate && creationDate <= endDate;
            });
            
            const deliveredPackagesInPeriod = clientPackagesInPeriod.filter(pkg => pkg.status === PackageStatus.Delivered);
            const theoreticalDeliveryCost = deliveredPackagesInPeriod.reduce((sum, pkg) => sum + getPackageCost(pkg, client), 0);

            const pickupDates = new Set<string>();
            clientPackagesInPeriod.forEach(pkg => {
                const pickupEvent = pkg.history.find(e => e.status === PackageStatus.PickedUp);
                if (pickupEvent) {
                    const pickupDate = new Date(pickupEvent.timestamp);
                     if (pickupDate >= startDate && pickupDate <= endDate) {
                        pickupDates.add(pickupDate.toISOString().split('T')[0]);
                    }
                }
            });
            const pickupCount = pickupDates.size;
            const theoreticalPickupCost = pickupCount * (client.pickupCost || 0);
            
            const theoreticalTotalCost = theoreticalDeliveryCost + theoreticalPickupCost;

            const lastInvoiceForPeriod = (client.invoices || [])
                .filter(inv => {
                    const invDate = new Date(inv.date);
                    return invDate.getFullYear() === year && invDate.getMonth() === month;
                })
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            const lastBilledAmount = lastInvoiceForPeriod ? (lastInvoiceForPeriod.amount + (lastInvoiceForPeriod.pickupCostTotal || 0)) : 0;
            
            let status: BillingStatus = 'SIN_MOVIMIENTO';
            let amountToBill = 0;

            if (theoreticalTotalCost > 0.01) {
                if (lastBilledAmount === 0) {
                    status = 'PENDIENTE';
                    amountToBill = theoreticalTotalCost;
                } else if (Math.abs(theoreticalTotalCost - lastBilledAmount) < 0.01) {
                    status = 'FACTURADO';
                    amountToBill = 0;
                } else {
                    status = 'REFACTURAR';
                    amountToBill = theoreticalTotalCost - lastBilledAmount;
                }
            } else if (lastBilledAmount > 0) {
                status = 'REFACTURAR';
                amountToBill = -lastBilledAmount;
            }

            return {
                clientId: client.id,
                clientName: client.name,
                status,
                amountToBill,
                theoreticalTotalCost,
                lastBilledAmount,
                deliveredPackagesInPeriod,
                pickupCount,
                theoreticalDeliveryCost,
                theoreticalPickupCost
            };
        });

    }, [currentDate, packages, clients, zones]);

    const globalTotals = useMemo(() => {
        return billingData.reduce((acc, clientData) => {
            if (clientData.status === 'PENDIENTE' || clientData.status === 'REFACTURAR') {
                 acc.grandTotal += clientData.amountToBill;
            }
            return acc;
        }, { grandTotal: 0 });
    }, [billingData]);
    
    const handleBill = async (clientsToBill: ClientBillingData[]) => {
        if (clientsToBill.length === 0) return;
        setIsBilling(true);
        try {
            const invoicePromises = clientsToBill.map(clientData => 
                api.createInvoice(
                    clientData.clientId, 
                    clientData.deliveredPackagesInPeriod.map(p => p.id),
                    clientData.theoreticalDeliveryCost,
                    clientData.pickupCount,
                    clientData.theoreticalPickupCost
                )
            );
            await Promise.all(invoicePromises);

            const allPackageIdsToMarkAsBilled = clientsToBill.flatMap(d => d.deliveredPackagesInPeriod.map(p => p.id));
            if (allPackageIdsToMarkAsBilled.length > 0) {
                await api.markPackagesAsBilled(allPackageIdsToMarkAsBilled);
            }
            
            await fetchData();
        } catch (error) {
            console.error("Billing failed:", error);
            alert("Ocurrió un error durante la facturación.");
        } finally {
            setIsBilling(false);
            setIsConfirming(false);
        }
    }

    const handleBatchBillClick = () => {
        if (clientsToBillForConfirmation.length > 0) {
            setIsConfirming(true);
        }
    }
    
    const handleSingleBillClick = (clientData: ClientBillingData) => {
        handleBill([clientData]);
    }
    
    const clientsToBillForConfirmation = billingData.filter(d => d.status === 'PENDIENTE' || d.status === 'REFACTURAR');

    const formatCurrency = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    
    const getStatusComponent = (status: BillingStatus, amount: number) => {
        switch (status) {
            case 'PENDIENTE':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Pendiente</span>;
            case 'FACTURADO':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Facturado</span>;
            case 'REFACTURAR':
                const diffText = amount > 0 ? `+${formatCurrency(amount)}` : formatCurrency(amount);
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Refacturar ({diffText})</span>;
            case 'SIN_MOVIMIENTO':
                return <span className="text-xs text-[var(--text-muted)]">-</span>;
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-[var(--background-hover)]"><IconChevronLeft className="w-6 h-6"/></button>
                        <h2 className="text-xl font-bold text-[var(--text-primary)] text-center w-48">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </h2>
                        <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-[var(--background-hover)]"><IconChevronRight className="w-6 h-6"/></button>
                    </div>
                    <div className="flex-1 text-center sm:text-right">
                        <p className="text-sm text-[var(--text-muted)]">Total Pendiente/Ajuste en Período</p>
                        <p className="text-4xl font-extrabold text-[var(--brand-primary)]">
                            {formatCurrency(globalTotals.grandTotal)}
                        </p>
                    </div>
                </div>
            </div>
            
             <div className="bg-[var(--background-secondary)] shadow-md rounded-lg">
                <div className="p-4 flex justify-between items-center border-b border-[var(--border-primary)]">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Resumen por Cliente</h3>
                     <button 
                        onClick={handleBatchBillClick}
                        disabled={clientsToBillForConfirmation.length === 0 || isBilling}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:bg-slate-400"
                    >
                        <IconCheckCircle className="w-5 h-5 mr-2 -ml-1"/>
                        {isBilling ? 'Facturando...' : 'Facturar Pendientes'}
                    </button>
                </div>
                
                {isLoading ? <p className="text-center p-8 text-[var(--text-muted)]">Calculando...</p> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[var(--border-primary)]">
                        <thead className="bg-[var(--background-muted)]">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Total Teórico Período</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Última Factura</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="bg-[var(--background-secondary)] divide-y divide-[var(--border-primary)]">
                            {clients.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-12 text-[var(--text-muted)]">No hay clientes para mostrar.</td></tr>
                            ) : billingData.map(data => (
                                <tr key={data.clientId}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text-primary)]">{data.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusComponent(data.status, data.amountToBill)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)] text-right">{formatCurrency(data.theoreticalTotalCost)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)] text-right">{formatCurrency(data.lastBilledAmount)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {(data.status === 'PENDIENTE' || data.status === 'REFACTURAR') && (
                                                <button 
                                                    onClick={() => handleSingleBillClick(data)}
                                                    disabled={isBilling}
                                                    className="px-3 py-1 text-xs font-semibold text-white bg-[var(--brand-primary)] rounded-full hover:bg-[var(--brand-secondary)] disabled:bg-slate-400"
                                                >
                                                    {data.status === 'PENDIENTE' ? 'Facturar' : 'Refacturar'}
                                                </button>
                                            )}
                                            {data.status === 'FACTURADO' && (
                                                <div className="inline-flex items-center text-green-600"><IconCheckCircle className="w-5 h-5"/></div>
                                            )}
                                            <button
                                                onClick={() => {
                                                    const clientToView = clients.find(c => c.id === data.clientId);
                                                    if (clientToView) {
                                                        setViewingInvoicesClient(clientToView);
                                                    }
                                                }}
                                                className="p-2 text-[var(--text-muted)] hover:text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
                                                title="Ver Historial de Facturas"
                                            >
                                                <IconFileInvoice className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                )}
            </div>

            {isConfirming && (
                <ConfirmationModal
                    title="Confirmar Facturación Masiva"
                    message={`Se procesarán ${clientsToBillForConfirmation.length} facturas/ajustes para los clientes listados. Los paquetes involucrados se marcarán como facturados. Esta acción es irreversible. ¿Deseas continuar?`}
                    confirmText="Sí, Facturar Todo"
                    onClose={() => setIsConfirming(false)}
                    onConfirm={() => handleBill(clientsToBillForConfirmation)}
                />
            )}
            
            {viewingInvoicesClient && (
                <ClientInvoiceHistoryModal
                    client={viewingInvoicesClient}
                    onClose={() => setViewingInvoicesClient(null)}
                />
            )}
        </div>
    );
};

export default GlobalBillingPage;