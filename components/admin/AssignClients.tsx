import React, { useState, useEffect, useMemo, useRef, ReactNode, useCallback } from 'react';
import { Role, AssignmentStatus, PackageStatus } from '../../constants';
import type { User, AssignmentEvent, Package } from '../../types';
import { api } from '../../services/api';
import { IconUser, IconTruck, IconCalendar, IconHistory, IconPackage, IconUserCheck, IconClock, IconMapPin, IconX, IconPhone, IconWhatsapp, IconSearch, IconPencil, IconLoader } from '../Icon';
import EditPickupCostModal from '../modals/EditPickupCostModal';
import ReassignDriverModal from '../modals/ReassignDriverModal';

const getISODate = (date: Date) => date.toISOString().split('T')[0];

interface ClientDetailModalProps {
    client: User;
    drivers: User[];
    onClose: () => void;
    onAssign: (clientId: string, driverId: string | null) => void;
}

const KpiCard: React.FC<{ icon: ReactNode, title: string, value: string | number, color: string }> = ({ icon, title, value, color }) => (
    <div className="bg-[var(--background-secondary)] rounded-lg p-4 shadow-sm border border-[var(--border-primary)] flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div className="ml-4">
            <p className="text-sm font-medium text-[var(--text-muted)]">{title}</p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
    </div>
);


const ClientDetailModal: React.FC<ClientDetailModalProps> = ({ client, drivers, onClose, onAssign }) => {
    const [selectedDriverId, setSelectedDriverId] = useState(client.assignedDriverId || '');

    const handleAssign = () => {
        onAssign(client.id, selectedDriverId || null);
    };

    return (
         <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-start justify-between p-4 border-b border-[var(--border-primary)]">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{client.name}</h3>
                        <p className="text-sm text-[var(--text-muted)] flex items-center gap-2 mt-1">
                            <IconMapPin className="w-4 h-4" />
                            <span>{client.address || 'Dirección no disponible'}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 -mt-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar">
                        <IconX className="w-6 h-6" />
                    </button>
                </header>
                <div className="p-6 space-y-4">
                    <div>
                        <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Contacto</h4>
                        <div className="flex justify-between items-center bg-[var(--background-muted)] p-3 rounded-md">
                            <p className="text-sm text-[var(--text-primary)] font-medium">{client.phone || 'No disponible'}</p>
                            {client.phone && (
                                <div className="flex items-center gap-2">
                                    <a href={`https://wa.me/${client.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full hover:bg-green-200">
                                        <IconWhatsapp className="w-4 h-4"/> WhatsApp
                                    </a>
                                    <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200">
                                        <IconPhone className="w-4 h-4"/> Llamar
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="driver-select-modal" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Asignar Conductor de Retiro</label>
                        <select
                            id="driver-select-modal"
                            value={selectedDriverId}
                            onChange={(e) => setSelectedDriverId(e.target.value)}
                            className="block w-full pl-3 pr-10 py-2 text-base border-[var(--border-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] sm:text-sm rounded-md bg-[var(--background-secondary)] text-[var(--text-primary)]"
                        >
                            <option value="">Sin Retiros Asignados</option>
                            {drivers.map(driver => (
                                <option key={driver.id} value={driver.id}>{driver.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end">
                    <button onClick={handleAssign} className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">
                        Guardar Asignación
                    </button>
                </footer>
            </div>
        </div>
    );
};


export const AssignClients: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [packages, setPackages] = useState<Package[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const loadingRef = useRef(false);
    const intervalRef = useRef<number | null>(null);

    const [activeTab, setActiveTab] = useState<'assignments' | 'history'>('assignments');
    const [selectedClientForModal, setSelectedClientForModal] = useState<User | null>(null);
    const [clientSearchQuery, setClientSearchQuery] = useState('');

    const [historyEvents, setHistoryEvents] = useState<AssignmentEvent[]>([]);
    const [editingCostEvent, setEditingCostEvent] = useState<AssignmentEvent | null>(null);
    const [reassigningEvent, setReassigningEvent] = useState<AssignmentEvent | null>(null);

    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    const [startDate, setStartDate] = useState(getISODate(oneWeekAgo));
    const [endDate, setEndDate] = useState(getISODate(today));
    const [historyDriverFilter, setHistoryDriverFilter] = useState<string>('');
    const [sendingEventId, setSendingEventId] = useState<string | null>(null);

    const formatCurrency = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

    const stopAutoRefresh = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const fetchData = useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setIsLoading(true);
        try {
            const [allUsers, allPackagesResponse, allEvents] = await Promise.all([
                api.getUsers(),
                api.getPackages({ limit: 0 }),
                api.getAssignmentHistory()
            ]);
            setUsers(allUsers);
            setPackages(allPackagesResponse.packages);
            setHistoryEvents(allEvents.sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()));
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
            loadingRef.current = false;
        }
    }, []);

    const startAutoRefresh = useCallback(() => {
        stopAutoRefresh();
        intervalRef.current = window.setInterval(fetchData, 10000);
    }, [fetchData, stopAutoRefresh]);

    useEffect(() => {
        fetchData();
        startAutoRefresh();
        return () => stopAutoRefresh();
    }, [fetchData, startAutoRefresh]);

    const handleAssignDriver = async (clientId: string, driverId: string | null) => {
        stopAutoRefresh();
        try {
            await api.assignDriverToClient(clientId, driverId);
            await fetchData();
            setSelectedClientForModal(null);
        } catch (error) {
            console.error("Failed to assign driver to client", error);
            alert('Error al asignar conductor: ' + (error as Error).message);
        } finally {
            startAutoRefresh();
        }
    };

    const handleReassignDriver = async (eventId: string, newDriverId: string, reason: string) => {
        stopAutoRefresh();
        try {
            await api.reassignPickup(eventId, newDriverId, reason);
            await fetchData();
            setReassigningEvent(null);
        } catch (error) {
            console.error("Failed to reassign driver", error);
            alert('Error al reasignar conductor: ' + (error as Error).message);
            throw error; // Propagate error to modal
        } finally {
            startAutoRefresh();
        }
    };

    const handleSavePickupCost = async (eventId: string, cost: number) => {
        stopAutoRefresh();
        try {
            await api.updateAssignmentCost(eventId, cost);
            await fetchData(); // Refetch all data to ensure UI consistency
            setEditingCostEvent(null);
        } catch (error) {
            console.error("Failed to save pickup cost", error);
            alert("Error al guardar el costo del retiro.");
            throw error; // Propagate error to modal to prevent it from closing
        } finally {
            startAutoRefresh();
        }
    };

    const handleSendToDriver = async (eventId: string) => {
        stopAutoRefresh();
        setSendingEventId(eventId);
        try {
            await api.dispatchPickupAssignment(eventId);
            await fetchData();
        } catch (error) {
            console.error("Failed to send assignment to driver", error);
            alert('Error al enviar el retiro: ' + (error as Error).message);
        } finally {
            setSendingEventId(null);
            startAutoRefresh();
        }
    }

    const drivers = useMemo(() => 
        users.filter(u => u.role === Role.Driver && u.status === 'APROBADO'),
        [users]
    );
    
    const clientsWithPendingPackages = useMemo(() => {
        const clients = new Map<string, number>();
        packages.forEach(pkg => {
            if (pkg.status === PackageStatus.Pending && pkg.creatorId) {
                clients.set(pkg.creatorId, (clients.get(pkg.creatorId) || 0) + 1);
            }
        });
        return clients;
    }, [packages]);
    
    const assignmentsToday = useMemo(() => {
        const todayStr = new Date().toDateString();
        return historyEvents.filter(e => new Date(e.assignedAt).toDateString() === todayStr);
    }, [historyEvents]);

    const clientsNeedingAssignment = useMemo(() => {
        return users.filter(u => 
            u.role === Role.Client &&
            clientsWithPendingPackages.has(u.id) &&
            !assignmentsToday.some(a => a.clientId === u.id) &&
            u.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
        ).sort((a,b) => a.name.localeCompare(b.name));
    }, [users, clientsWithPendingPackages, clientSearchQuery, assignmentsToday]);
    
    const preAssignedAssignments = useMemo(() => {
        return assignmentsToday.filter(a => a.status === AssignmentStatus.PreAssigned && a.clientName.toLowerCase().includes(clientSearchQuery.toLowerCase()));
    }, [assignmentsToday, clientSearchQuery]);

    const assignmentsInProgress = useMemo(() => {
        return assignmentsToday.filter(a => a.status === AssignmentStatus.Pending && a.clientName.toLowerCase().includes(clientSearchQuery.toLowerCase()));
    }, [assignmentsToday, clientSearchQuery]);
    
    const completedTodayAssignments = useMemo(() => {
        return assignmentsToday.filter(a => a.status === AssignmentStatus.Completed && a.clientName.toLowerCase().includes(clientSearchQuery.toLowerCase()));
    }, [assignmentsToday, clientSearchQuery]);
    
    const kpiStats = useMemo(() => {
        return {
            needsPreAssignment: clientsNeedingAssignment.length,
            pendingSend: preAssignedAssignments.length,
            inProgress: assignmentsInProgress.length,
            completed: completedTodayAssignments.length,
        }
    }, [clientsNeedingAssignment, preAssignedAssignments, assignmentsInProgress, completedTodayAssignments]);
    
    const filteredHistoryEvents = useMemo(() => {
        if (activeTab !== 'history') return [];
        let events = [...historyEvents];
        if (startDate) {
            const start = new Date(startDate.replace(/-/g, '/'));
            start.setHours(0, 0, 0, 0);
            events = events.filter(e => new Date(e.assignedAt) >= start);
        }
        if (endDate) {
            const end = new Date(endDate.replace(/-/g, '/'));
            end.setHours(23, 59, 59, 999);
            events = events.filter(e => new Date(e.assignedAt) <= end);
        }
        if (historyDriverFilter) {
            events = events.filter(e => e.driverId === historyDriverFilter);
        }
        return events;
    }, [activeTab, historyEvents, startDate, endDate, historyDriverFilter]);

    const tabStyles = "flex items-center px-4 py-3 font-medium text-sm transition-colors duration-200";
    const activeTabStyles = "text-[var(--brand-primary)] border-b-2 border-[var(--brand-primary)]";
    const inactiveTabStyles = "text-[var(--text-muted)] hover:text-[var(--text-primary)]";

  return (
    <div className="bg-[var(--background-secondary)] shadow-md rounded-lg">
        <div className="border-b border-[var(--border-primary)] flex justify-between items-center">
            <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
                <button
                    onClick={() => setActiveTab('assignments')}
                    className={`${tabStyles} ${activeTab === 'assignments' ? activeTabStyles : inactiveTabStyles}`}
                >
                    <IconUserCheck className="w-5 h-5 mr-2" />
                    <span>Dashboard de Retiros</span>
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`${tabStyles} ${activeTab === 'history' ? activeTabStyles : inactiveTabStyles}`}
                >
                    <IconHistory className="w-5 h-5 mr-2" />
                    <span>Historial de Retiros</span>
                </button>
            </nav>
        </div>

        {activeTab === 'assignments' && (
            <div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 border-b border-[var(--border-primary)]">
                    <KpiCard icon={<IconUser className="w-6 h-6 text-orange-800"/>} title="Requiere Asignación" value={kpiStats.needsPreAssignment} color="bg-orange-100"/>
                    <KpiCard icon={<IconClock className="w-6 h-6 text-yellow-800"/>} title="Pendiente de Envío" value={kpiStats.pendingSend} color="bg-yellow-100"/>
                    <KpiCard icon={<IconTruck className="w-6 h-6 text-blue-800"/>} title="En Progreso" value={kpiStats.inProgress} color="bg-blue-100"/>
                    <KpiCard icon={<IconUserCheck className="w-6 h-6 text-green-800"/>} title="Completados Hoy" value={kpiStats.completed} color="bg-green-100"/>
                </div>
                 <div className="p-4 border-b border-[var(--border-primary)]">
                     <div className="relative max-w-sm">
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={clientSearchQuery}
                            onChange={(e) => setClientSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-[var(--border-secondary)] rounded-md leading-5 bg-[var(--background-secondary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] sm:text-sm"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <IconSearch className="h-5 w-5 text-[var(--text-muted)]" />
                        </div>
                    </div>
                 </div>

                {isLoading ? <p className="p-6 text-center text-[var(--text-muted)]">Cargando datos...</p> : (
                    <div className="divide-y divide-[var(--border-primary)] max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/10"><h3 className="font-semibold text-orange-800 dark:text-orange-200">Requiere Asignación ({clientsNeedingAssignment.length})</h3></div>
                        {clientsNeedingAssignment.length > 0 ? clientsNeedingAssignment.map(client => (
                            <div key={client.id} className="p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1 min-w-0"><IconUser className="w-8 h-8 p-1.5 bg-[var(--background-muted)] rounded-full text-[var(--text-secondary)]"/><div><p className="font-semibold text-[var(--text-primary)]">{client.name}</p><p className="text-sm text-[var(--text-muted)] flex items-center gap-1"><IconPackage className="w-4 h-4"/> {clientsWithPendingPackages.get(client.id)} paquetes pendientes</p></div></div>
                                <button onClick={() => setSelectedClientForModal(client)} className="px-3 py-1.5 text-sm font-semibold text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)]">Asignar Conductor</button>
                            </div>
                        )) : <div className="p-4 text-sm text-[var(--text-muted)]">No hay clientes con paquetes pendientes que necesiten asignación.</div>}
                        
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10"><h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Pre-Asignados (Pendientes de Envío) ({preAssignedAssignments.length})</h3></div>
                        {preAssignedAssignments.length > 0 ? preAssignedAssignments.map(event => (
                            <div key={event.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1 min-w-0"><IconUser className="w-8 h-8 p-1.5 bg-[var(--background-muted)] rounded-full text-[var(--text-secondary)]"/><div><p className="font-semibold text-[var(--text-primary)]">{event.clientName}</p><div className="text-sm text-[var(--text-muted)] flex items-center gap-2"><div className="flex items-center gap-1"><IconTruck className="w-4 h-4"/> {event.driverName}</div><div className="flex items-center gap-1"><IconPackage className="w-4 h-4"/> {clientsWithPendingPackages.get(event.clientId)} paquetes</div></div></div></div>
                                <div className="flex items-center gap-3">
                                     <button onClick={() => setEditingCostEvent(event)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200">{event.pickupCost != null ? formatCurrency(event.pickupCost) : 'Definir Pago'} <IconPencil className="w-4 h-4"/></button>
                                     <button onClick={() => handleSendToDriver(event.id)} disabled={event.pickupCost == null || sendingEventId === event.id} className="px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-slate-400">{sendingEventId === event.id ? <IconLoader className="w-5 h-5 animate-spin"/> : 'Enviar a Conductor'}</button>
                                </div>
                            </div>
                        )) : <div className="p-4 text-sm text-[var(--text-muted)]">No hay retiros pre-asignados.</div>}

                         <div className="p-4 bg-blue-50 dark:bg-blue-900/10"><h3 className="font-semibold text-blue-800 dark:text-blue-200">Retiros en Progreso ({assignmentsInProgress.length})</h3></div>
                        {assignmentsInProgress.length > 0 ? assignmentsInProgress.map(event => (
                             <div key={event.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <IconUser className="w-8 h-8 p-1.5 bg-[var(--background-muted)] rounded-full text-[var(--text-secondary)]"/>
                                    <div>
                                        <p className="font-semibold text-[var(--text-primary)]">{event.clientName}</p>
                                        <div className="text-sm text-[var(--text-muted)] flex items-center gap-2">
                                            <IconTruck className="w-4 h-4"/> {event.driverName}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setReassigningEvent(event)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-orange-700 bg-orange-100 rounded-md hover:bg-orange-200">
                                        <IconTruck className="w-4 h-4"/> Reasignar
                                    </button>
                                     <button onClick={() => setEditingCostEvent(event)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200">
                                        {formatCurrency(event.pickupCost || 0)} <IconPencil className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        )) : <div className="p-4 text-sm text-[var(--text-muted)]">No hay retiros en progreso.</div>}

                        <div className="p-4 bg-green-50 dark:bg-green-900/10"><h3 className="font-semibold text-green-800 dark:text-green-200">Completados Hoy ({completedTodayAssignments.length})</h3></div>
                        {completedTodayAssignments.length > 0 ? completedTodayAssignments.map(event => (
                            <div key={event.id} className="p-4 flex items-center justify-between gap-4 opacity-70">
                               <div className="flex items-center gap-4 flex-1 min-w-0"><IconUser className="w-8 h-8 p-1.5 bg-[var(--background-muted)] rounded-full text-[var(--text-secondary)]"/><div><p className="font-semibold text-[var(--text-primary)]">{event.clientName}</p><p className="text-sm text-[var(--text-muted)] flex items-center gap-1"><IconTruck className="w-4 h-4"/> {event.driverName}</p></div></div>
                               <div className="text-sm font-semibold text-green-700 flex items-center gap-2"><IconUserCheck className="w-5 h-5"/> Completado ({event.packagesPickedUp} paquetes)</div>
                           </div>
                       )) : <div className="p-4 text-sm text-[var(--text-muted)]">No se han completado retiros hoy.</div>}
                    </div>
                )}
            </div>
        )}

        {activeTab === 'history' && (
            <div>
                 <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-[var(--border-primary)]">
                    <div className="relative"><label className="text-xs text-[var(--text-muted)]">Desde</label><div className="flex items-center justify-between w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm bg-[var(--background-secondary)] text-left cursor-pointer sm:text-sm"><span>{startDate ? new Date(startDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/aaaa'}</span><IconCalendar className="h-5 w-5 text-[var(--text-muted)]" /></div><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" aria-label="Seleccionar fecha de inicio" /></div>
                    <div className="relative"><label className="text-xs text-[var(--text-muted)]">Hasta</label><div className="flex items-center justify-between w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm bg-[var(--background-secondary)] text-left cursor-pointer sm:text-sm"><span>{endDate ? new Date(endDate.replace(/-/g, '/')).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/aaaa'}</span><IconCalendar className="h-5 w-5 text-[var(--text-muted)]" /></div><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" aria-label="Seleccionar fecha de fin" /></div>
                    <div><label className="text-xs text-[var(--text-muted)]">Conductor</label><select value={historyDriverFilter} onChange={e => setHistoryDriverFilter(e.target.value)} className="w-full mt-1.5 block pl-3 pr-10 py-2 border border-[var(--border-secondary)] rounded-md bg-[var(--background-secondary)]"><option value="">Todos los Conductores</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                 </div>
                 <div className="divide-y divide-[var(--border-primary)] max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-4 bg-[var(--background-muted)] font-semibold text-xs text-[var(--text-muted)] uppercase sticky top-0">
                        <div className="sm:col-span-1">Cliente</div>
                        <div className="sm:col-span-1">Detalles Asignación</div>
                        <div className="sm:col-span-1">Fecha</div>
                        <div className="sm:col-span-1">Estado</div>
                        <div className="sm:col-span-1">Pago Conductor</div>
                    </div>
                    {filteredHistoryEvents.length > 0 ? filteredHistoryEvents.map(event => (
                        <div key={event.id} className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-4 items-center hover:bg-[var(--background-hover)]">
                            <div>
                                <p className="font-semibold text-sm text-[var(--text-primary)]">{event.clientName}</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <IconTruck className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0"/> 
                                <span>{event.driverName}</span>
                            </div>
                            <div className="text-sm text-[var(--text-muted)]">
                                {new Date(event.assignedAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="font-semibold text-sm">
                                {event.status} {event.status === 'COMPLETADO' && `(${event.packagesPickedUp || 0} p.)`}
                            </div>
                            <div className="text-sm">
                                {event.status === 'COMPLETADO' ? (
                                    <span className="font-bold text-[var(--text-primary)]">{event.pickupCost != null ? formatCurrency(event.pickupCost) : 'N/A'}</span>
                                ) : (
                                    <button
                                        onClick={() => setEditingCostEvent(event)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200"
                                    >
                                        {event.pickupCost != null ? formatCurrency(event.pickupCost) : 'Definir Pago'}
                                        <IconPencil className="w-3 h-3"/>
                                    </button>
                                )}
                            </div>
                        </div>
                    )) : <p className="p-6 text-center text-[var(--text-muted)]">No hay eventos en el rango de fechas seleccionado.</p>}
                 </div>
            </div>
        )}

        {selectedClientForModal && (
            <ClientDetailModal 
                client={selectedClientForModal}
                drivers={drivers}
                onClose={() => setSelectedClientForModal(null)}
                onAssign={handleAssignDriver}
            />
        )}
        {editingCostEvent && (
            <EditPickupCostModal
                event={editingCostEvent}
                onClose={() => setEditingCostEvent(null)}
                onSave={handleSavePickupCost}
            />
        )}
        {reassigningEvent && (
            <ReassignDriverModal
                event={reassigningEvent}
                drivers={drivers}
                onClose={() => setReassigningEvent(null)}
                onReassign={handleReassignDriver}
            />
        )}
    </div>
  );
};