
import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import type { User, PickupRun, AssignmentEvent } from '../../types';
import { Role, PickupMode, PickupStatus, AssignmentStatus } from '../../constants';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import QRScanner from './QRScanner';
import ManualPickupEntry from './ManualPickupEntry';
import PickupSummaryModal from './PickupSummaryModal';
import { IconUser, IconChevronRight, IconCheckCircle, IconLoader } from '../Icon';

const ScanPickupPage: React.FC = () => {
    const [selectedClient, setSelectedClient] = useState<User | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [runs, setRuns] = useState<PickupRun[]>([]);
    const [currentDriver, setCurrentDriver] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showSummary, setShowSummary] = useState(false);
    const [processingBulkId, setProcessingBulkId] = useState<string | null>(null);
    const auth = useContext(AuthContext);
    const isInitialLoad = useRef(true);

    const fetchData = useCallback(async () => {
        if (!auth?.user) return;
        if (isInitialLoad.current) {
            setIsLoading(true);
        }
        try {
            const [users, driverRuns, freshDriverData] = await Promise.all([
                api.getUsers(),
                api.getDriverPickupRun(),
                api.getUserByToken(), 
            ]);
            
            setAllUsers(users);
            setRuns(driverRuns);
            setCurrentDriver(freshDriverData);

        } catch (error) {
            console.error("Failed to fetch assigned clients", error);
        } finally {
            if (isInitialLoad.current) {
                setIsLoading(false);
                isInitialLoad.current = false;
            }
        }
    }, [auth?.user]);

    useEffect(() => {
        fetchData();
        const intervalId = setInterval(fetchData, 8000); // Poll for updates
        return () => clearInterval(intervalId);
    }, [fetchData]);

    const assignedClients = useMemo(() => {
        const clientIdsFromRuns = new Set<string>();
        runs.forEach(run => {
            run.assignments.forEach(a => clientIdsFromRuns.add(a.clientId));
        });
        return allUsers.filter(u => u.role === Role.Client && clientIdsFromRuns.has(u.id));
    }, [runs, allUsers]);


    const { pendingClients, completedClients } = useMemo(() => {
        if (!auth?.user) return { pendingClients: [], completedClients: [] };
    
        const completedClientIds = new Set(
            runs.flatMap(run => run.assignments)
                .filter(a => a.status === PickupStatus.RETIRADO)
                .map(a => a.clientId)
        );
        
        const pending: User[] = [];
        const completed: User[] = [];
    
        assignedClients.forEach(client => {
            if (completedClientIds.has(client.id)) {
                completed.push(client);
            } else {
                const hasPendingAssignment = runs.some(run => 
                    run.assignments.some(a => a.clientId === client.id && a.status !== PickupStatus.NO_RETIRADO && a.status !== PickupStatus.RETIRADO)
                );
                if (hasPendingAssignment) {
                    pending.push(client);
                }
            }
        });
    
        return { 
            pendingClients: pending.sort((a,b) => a.name.localeCompare(b.name)), 
            completedClients: completed.sort((a,b) => a.name.localeCompare(b.name)) 
        };
    }, [assignedClients, runs, auth?.user]);

    const completedTodayEvents: AssignmentEvent[] = useMemo(() => {
        const user = auth?.user;
        if (!user) return [];

        return runs.flatMap(run => run.assignments)
            .filter(a => a.status === PickupStatus.RETIRADO)
            .map((a): AssignmentEvent => ({
                id: a.id,
                clientId: a.clientId,
                clientName: a.clientName,
                driverId: user.id,
                driverName: user.name,
                completedAt: new Date(a.updatedAt),
                packagesPickedUp: a.packagesPickedUp,
                assignedAt: new Date(a.createdAt),
                status: AssignmentStatus.Completed,
                pickupCost: a.cost
            }));
    }, [runs, auth?.user]);

    const handleBulkPickup = async (client: User, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm(`¿Confirmas que has retirado TODOS los paquetes pendientes de ${client.name}? Esto marcará todo lo pendiente como retirado por ti.`)) {
            return;
        }

        setProcessingBulkId(client.id);
        try {
            const result = await api.confirmBulkPickup(client.id);
            if (result.count > 0) {
                alert(`¡Éxito! Se marcaron ${result.count} paquetes como retirados.`);
            } else {
                alert(result.message);
            }
            await fetchData();
        } catch (error: any) {
            console.error("Bulk pickup error", error);
            alert("Error al procesar retiro masivo: " + (error.message || "Intente nuevamente."));
        } finally {
            setProcessingBulkId(null);
        }
    };

    if (selectedClient) {
        const handleBack = () => {
            setSelectedClient(null);
            fetchData(); // Force a refetch after completing a pickup
        };

        if (auth?.systemSettings.pickupMode === PickupMode.Manual) {
            return <ManualPickupEntry client={selectedClient} onBack={handleBack} />;
        }
        
        return <QRScanner client={selectedClient} onBack={handleBack} driverPermissions={currentDriver?.driverPermissions} />;
    }

    if (isLoading) {
        return <p className="p-6 text-center text-[var(--text-muted)]">Buscando clientes asignados...</p>;
    }

    return (
        <div className="space-y-6">
            {/* PENDING SECTION */}
            <div className="bg-[var(--background-secondary)] rounded-lg shadow-md">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 font-semibold text-sm border-b border-blue-200">PENDIENTES ({pendingClients.length})</div>
                <div className="divide-y divide-[var(--border-primary)]">
                    {pendingClients.length > 0 ? (
                        pendingClients.map(client => (
                            <div
                                key={client.id}
                                className="w-full text-left p-4 flex flex-col gap-3 hover:bg-[var(--background-hover)] transition-colors border-l-4 border-transparent hover:border-l-[var(--brand-primary)]"
                            >
                                <div className="flex items-center justify-between cursor-pointer" onClick={() => setSelectedClient(client)}>
                                    <div className="flex items-center gap-4">
                                        <div className="bg-[var(--background-muted)] p-2 rounded-full">
                                            <IconUser className="w-6 h-6 text-[var(--text-muted)]" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-[var(--text-primary)]">{client.name}</p>
                                            <p className="text-sm text-[var(--text-muted)]">{client.pickupAddress || client.address}</p>
                                        </div>
                                    </div>
                                    <IconChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                                </div>
                                {currentDriver?.driverPermissions?.canBulkPickup && (
                                    <div className="pl-12">
                                        <button 
                                            onClick={(e) => handleBulkPickup(client, e)}
                                            disabled={!!processingBulkId}
                                            className="w-full py-2 px-3 bg-green-50 text-green-700 text-sm font-semibold rounded-md border border-green-200 hover:bg-green-100 flex items-center justify-center gap-2"
                                        >
                                            {processingBulkId === client.id ? <IconLoader className="w-4 h-4 animate-spin"/> : <IconCheckCircle className="w-4 h-4"/>}
                                            {processingBulkId === client.id ? 'Procesando...' : 'Confirmar Retiro Masivo (Sin Escanear)'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="p-6 text-center text-sm text-[var(--text-muted)]">No tienes retiros pendientes.</p>
                    )}
                </div>
            </div>

            {/* COMPLETED SECTION */}
            {completedClients.length > 0 && (
                <div className="bg-[var(--background-secondary)] rounded-lg shadow-md">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 font-semibold text-sm border-b border-green-200">RETIRADOS HOY ({completedClients.length})</div>
                    <div className="divide-y divide-[var(--border-primary)]">
                        {completedClients.map(client => (
                            <div
                                key={client.id}
                                className="w-full text-left p-4 flex items-center justify-between opacity-80"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="bg-green-100 p-2 rounded-full">
                                        <IconCheckCircle className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-green-800">{client.name}</p>
                                        <p className="text-sm text-green-700">{client.pickupAddress || client.address}</p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-green-600 bg-green-200 px-2 py-1 rounded-full">EJECUTADO</span>
                            </div>
                        ))}
                    </div>
                     <div className="p-3 border-t border-[var(--border-primary)] text-center">
                        <button onClick={() => setShowSummary(true)} className="text-sm font-semibold text-blue-600 hover:underline">
                            Ver Resumen del Día
                        </button>
                    </div>
                </div>
            )}
            
            {showSummary && auth?.user && (
                <PickupSummaryModal
                    events={completedTodayEvents}
                    driver={auth.user}
                    onClose={() => setShowSummary(false)}
                />
            )}
        </div>
    );
};

export default ScanPickupPage;