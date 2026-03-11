
// Force refresh for UI updates v2
import React, { useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { Role, PackageStatus, PickupStatus, PickupShift } from '../../constants';
import type { User, Package, PickupRun, PickupAssignment } from '../../types';
import { api, parseDateString, getISODate } from '../../services/api';
import { IconUser, IconTruck, IconPackage, IconPlus, IconWhatsapp, IconPencil, IconRefresh, IconClock, IconCheckCircle, IconTrash, IconCalendar, IconHistory, IconEye, IconCopy, IconX, IconLoader, IconChevronRight, IconSearch } from '../Icon';
import CreatePickupRunModal from '../modals/CreatePickupRunModal';
import EditAssignmentCostModal from '../modals/EditAssignmentCostModal';
import ReassignAssignmentModal from '../modals/ReassignAssignmentModal';
import ConfirmationModal from '../modals/ConfirmationModal';
import AddAssignmentsToRunModal from '../modals/AddAssignmentsToRunModal';
import CopyRunModal from '../modals/CopyRunModal';
import ReassignRunModal from '../modals/ReassignRunModal';
import CopyDayModal from '../modals/CopyDayModal';

const getStatusStyles = (status: PickupStatus): { bg: string; text: string; border: string; } => {
    switch (status) {
        case PickupStatus.ASIGNADO: return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500' };
        case PickupStatus.EN_RUTA: return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500' };
        case PickupStatus.RETIRADO: return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500' };
        case PickupStatus.EN_BODEGA: return { bg: 'bg-gray-200', text: 'text-gray-800', border: 'border-gray-500' };
        case PickupStatus.NO_RETIRADO: return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' };
        default: return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-400' };
    }
};

type DriverRuns = {
    driverName: string;
    runsByShift: { [key in PickupShift]?: PickupAssignment[] };
};

type GroupedByDriver = {
    [key: string]: DriverRuns;
};

type TotalsByDriver = {
    [key: string]: {
        total: number;
        completed: number;
        cost: number;
        packagesPickedUp: number;
    };
};

const HistoryView: React.FC<{ runs: PickupRun[] }> = ({ runs }) => {
    if (runs.length === 0) {
        return <div className="p-8 text-center text-[var(--text-muted)] bg-[var(--background-secondary)] rounded-lg shadow-md">No hay retiros registrados para esta fecha.</div>;
    }

    const groupedByDriver: GroupedByDriver = useMemo(() => {
        return runs.reduce((acc: GroupedByDriver, run) => {
            if (!acc[run.driverId]) {
                acc[run.driverId] = { driverName: run.driverName, runsByShift: {} };
            }
            if (!acc[run.driverId].runsByShift[run.shift]) {
                acc[run.driverId].runsByShift[run.shift] = [];
            }
            acc[run.driverId].runsByShift[run.shift]!.push(...run.assignments);
            return acc;
        }, {} as GroupedByDriver);
    }, [runs]);

    const totalsByDriver: TotalsByDriver = useMemo(() => {
        return (Object.entries(groupedByDriver) as [string, DriverRuns][]).reduce((acc: TotalsByDriver, [driverId, data]) => {
            const allAssignments = Object.values(data.runsByShift).flat().filter(Boolean);
            acc[driverId] = {
                total: allAssignments.length,
                completed: allAssignments.filter(a => a?.status === PickupStatus.RETIRADO).length,
                cost: allAssignments.reduce((sum, a) => sum + (a?.cost || 0), 0),
                packagesPickedUp: allAssignments.reduce((sum, a) => sum + (a?.packagesPickedUp || 0), 0)
            };
            return acc;
        }, {} as TotalsByDriver);
    }, [groupedByDriver]);
    
    const grandTotalPackages = useMemo(() => {
        return runs.flatMap(r => r.assignments).reduce((sum, a) => sum + (a.packagesPickedUp || 0), 0);
    }, [runs]);

    const formatCurrency = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

    return (
        <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-200">Total de Paquetes Retirados en el Día</p>
                <p className="text-4xl font-extrabold text-blue-800 dark:text-blue-100 mt-1">{grandTotalPackages}</p>
            </div>
            {(Object.entries(groupedByDriver) as [string, DriverRuns][]).map(([driverId, data]) => (
                <div key={driverId} className="bg-[var(--background-secondary)] shadow-md rounded-lg overflow-hidden border border-[var(--border-primary)]">
                    <div className="p-4 bg-[var(--background-muted)] border-b border-[var(--border-primary)] flex justify-between items-center">
                        <h4 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2"><IconTruck className="w-6 h-6"/> {data.driverName}</h4>
                        <div className="text-right">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{totalsByDriver[driverId].completed} / {totalsByDriver[driverId].total} <span className="font-normal text-[var(--text-secondary)]">retirados</span></p>
                            <p className="text-xs font-semibold text-purple-600">{totalsByDriver[driverId].packagesPickedUp} paquetes</p>
                            <p className="text-xs font-bold text-green-600">{formatCurrency(totalsByDriver[driverId].cost)}</p>
                        </div>
                    </div>
                    <div className="p-4 space-y-4">
                        {(Object.entries(data.runsByShift) as [PickupShift, PickupAssignment[]][]).map(([shift, assignments]) => (
                            <div key={shift}>
                                <h5 className="font-semibold text-sm text-[var(--text-secondary)] mb-2 uppercase tracking-wider">{shift === 'MANANA' ? 'MAÑANA' : shift}</h5>
                                <div className="space-y-2">
                                    {assignments && assignments.map(a => (
                                        <div key={a.id} className={`p-3 rounded-md flex items-center justify-between text-sm ${getStatusStyles(a.status).bg} ${getStatusStyles(a.status).text}`}>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{a.clientName}</span>
                                                {a.packagesPickedUp !== undefined && a.status === PickupStatus.RETIRADO && (
                                                    <span className="text-xs font-semibold mt-1">{a.packagesPickedUp} paquetes retirados</span>
                                                )}
                                            </div>
                                            <span className="font-bold">{a.status.replace('_', ' ')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

interface PlanningViewProps {
    users: User[];
    packages: Package[];
    runs: PickupRun[];
    allRuns: PickupRun[]; // All runs for the day across all shifts
    shift: PickupShift;
    date: string;
    onDataUpdate: () => void;
    onInformDriver: (run: PickupRun) => void;
    informingRunId: string | null;
    onCopyRunMessage: (run: PickupRun) => void;
    copiedRunIdForW: string | null;
}


const PlanningView: React.FC<PlanningViewProps> = ({ users, packages, runs, allRuns, shift, date, onDataUpdate, onInformDriver, informingRunId, onCopyRunMessage, copiedRunIdForW }) => {
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState<PickupAssignment | null>(null);
    const [reassigningAssignment, setReassigningAssignment] = useState<{ assignment: PickupAssignment, run: PickupRun } | null>(null);
    const [deletingAssignment, setDeletingAssignment] = useState<PickupAssignment | null>(null);
    const [deletingRun, setDeletingRun] = useState<PickupRun | null>(null);
    const [addingToRun, setAddingToRun] = useState<PickupRun | null>(null);
    const [copyingRun, setCopyingRun] = useState<PickupRun | null>(null);
    const [reassigningRun, setReassigningRun] = useState<PickupRun | null>(null);
    const [editingRunId, setEditingRunId] = useState<string | null>(null);
    const [copiedAssignmentId, setCopiedAssignmentId] = useState<string | null>(null);
    const [clientSearchQuery, setClientSearchQuery] = useState('');

    const drivers = useMemo(() => users.filter(u => u.role === Role.Driver && u.status === 'APROBADO'), [users]);
    const clients = useMemo(() => users.filter(u => u.role === Role.Client && u.status === 'APROBADO'), [users]);

    const packagesByClient = useMemo(() => {
        return packages.reduce((acc, pkg) => {
            if (pkg.creatorId && pkg.status === PackageStatus.Pending) {
                if (!acc[pkg.creatorId]) acc[pkg.creatorId] = 0;
                acc[pkg.creatorId]++;
            }
            return acc;
        }, {} as Record<string, number>);
    }, [packages]);

    const alreadyAssignedClientIds = useMemo(() => {
        return new Set(allRuns.flatMap(run => run.assignments.filter(a => a.status !== 'NO_RETIRADO').map(a => a.clientId)));
    }, [allRuns]);

    const clientsAvailableForAssignment = useMemo(() => {
        return clients
            .filter(c => !alreadyAssignedClientIds.has(c.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [clients, alreadyAssignedClientIds]);

    const filteredClients = useMemo(() => {
        return clientsAvailableForAssignment.filter(c => 
            c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
        );
    }, [clientsAvailableForAssignment, clientSearchQuery]);

    const toggleClientSelection = (clientId: string) => {
        setSelectedClients(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clientId)) newSet.delete(clientId);
            else newSet.add(clientId);
            return newSet;
        });
    };

    const handleOpenCreateModal = () => {
        // Check if any selected client has 0 packages
        const zeroPackageClients = clients.filter(c => selectedClients.has(c.id) && (packagesByClient[c.id] || 0) === 0);

        if (zeroPackageClients.length > 0) {
            const names = zeroPackageClients.map(c => c.name).join(', ');
            if (!window.confirm(`⚠️ ADVERTENCIA DE SISTEMA\n\nLos siguientes clientes no tienen paquetes creados en el sistema:\n\n${names}\n\n¿Estás seguro de que deseas generar un retiro para ellos de todas formas?`)) {
                return;
            }
        }
        setIsModalOpen(true);
    };

    const handleCreateRun = async (data: { driverId: string; shift: PickupShift; date: string; assignments: { clientId: string; cost: number; packagesToPickup: number }[] }) => {
        try {
            await api.createPickupRun(data);
            onDataUpdate();
            setIsModalOpen(false);
            setSelectedClients(new Set());
        } catch (error: any) {
            alert(error.message || "Error al crear la ruta.");
        }
    };
    
    const handleAddAssignments = async (runId: string, assignments: { clientId: string; cost: number; packagesToPickup: number }[]) => {
        const zeroPackageAssignments = assignments.filter(a => a.packagesToPickup === 0);
        
        if (zeroPackageAssignments.length > 0) {
            const clientNames = zeroPackageAssignments.map(a => {
                const client = clients.find(c => c.id === a.clientId);
                return client?.name || 'Desconocido';
            }).join(', ');

            if (!window.confirm(`⚠️ ADVERTENCIA DE SISTEMA\n\nLos siguientes clientes no tienen paquetes creados:\n\n${clientNames}\n\n¿Estás seguro de que deseas agregarlos a la ruta de todas formas?`)) {
                return;
            }
        }

        try {
            await api.addAssignmentsToRun(runId, assignments);
            onDataUpdate();
            setAddingToRun(null);
        } catch (error: any) {
            alert(error.message || "Error al agregar retiros.");
        }
    };

    const handleCopyRun = async (runId: string, dates: string[], assignmentIds: string[]) => {
        await api.copyPickupRun(runId, dates, assignmentIds);
        onDataUpdate(); // This will only show today's runs, maybe we want to alert user?
        alert(`${dates.length} ruta(s) copiada(s) con éxito. Cambia la fecha para ver las nuevas rutas.`);
    };
    
    const handleReassignRun = async (runId: string, newDriverId: string) => {
        await api.reassignPickupRun(runId, newDriverId);
        onDataUpdate();
        setReassigningRun(null);
    };

    const handleSaveCost = async (assignmentId: string, cost: number) => {
        await api.updatePickupAssignment(assignmentId, { cost });
        onDataUpdate();
        setEditingAssignment(null);
    };

    const handleReassign = async (assignmentId: string, newDriverId: string) => {
        await api.updatePickupAssignment(assignmentId, { driverId: newDriverId });
        onDataUpdate();
        setReassigningAssignment(null);
    };

    const handleDelete = async () => {
        if (!deletingAssignment) return;
        await api.deletePickupAssignment(deletingAssignment.id);
        onDataUpdate();
        setDeletingAssignment(null);
    };
    
    const handleDeleteRun = async () => {
        if (!deletingRun) return;
        await api.deletePickupRun(deletingRun.id);
        onDataUpdate();
        setDeletingRun(null);
    };

    const formatCurrency = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    
    const handleCopyAssignmentDetails = (assignment: PickupAssignment, run: PickupRun) => {
        const driver = users.find(u => u.id === run.driverId);
        if (!driver) return;

        const runDate = parseDateString(run.date);
        const runDateFormatted = runDate.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

        let message = `Hola ${driver.name}, te comparto el detalle de un retiro:\n\n`;
        message += `*FECHA:* ${runDateFormatted}\n`;
        message += `*TURNO:* ${run.shift === 'MANANA' ? 'MAÑANA' : run.shift}\n\n`;
        message += `*CLIENTE:* ${assignment.clientName}\n`;
        message += `*DIRECCIÓN:* ${assignment.clientAddress}\n`;
        message += `*CONTACTO:* ${assignment.clientPhone || 'No disponible'}\n`;
        message += `*VALOR:* ${formatCurrency(assignment.cost)}`;

        navigator.clipboard.writeText(message).then(() => {
            setCopiedAssignmentId(assignment.id);
            setTimeout(() => setCopiedAssignmentId(null), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('No se pudo copiar el texto.');
        });
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pending Clients Column */}
            <div className="lg:col-span-1 bg-[var(--background-secondary)] shadow-md rounded-lg p-4">
                <h3 className="font-bold text-[var(--text-primary)] mb-3">Pendientes para Turno {shift === 'MANANA' ? 'MAÑANA' : shift}</h3>
                
                <button
                    onClick={handleOpenCreateModal}
                    disabled={selectedClients.size === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] disabled:bg-slate-400 disabled:cursor-not-allowed mb-3"
                >
                    <IconPlus className="w-5 h-5"/> Crear Ruta de Retiro ({selectedClients.size})
                </button>

                <div className="relative mb-3">
                    <input 
                        type="text" 
                        placeholder="Buscar cliente..." 
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--border-secondary)] rounded-md bg-[var(--background-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    />
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                </div>

                <div className="space-y-2 max-h-[55vh] overflow-y-auto custom-scrollbar">
                    {filteredClients.map(client => {
                        const packageCount = packagesByClient[client.id] || 0;
                        const isZero = packageCount === 0;
                        return (
                            <div
                                key={client.id}
                                onClick={() => toggleClientSelection(client.id)}
                                className={`p-3 border rounded-md cursor-pointer transition-colors flex items-center justify-between ${
                                    selectedClients.has(client.id) 
                                        ? 'bg-[var(--brand-muted)] border-[var(--brand-secondary)] ring-2 ring-[var(--brand-secondary)]' 
                                        : 'bg-[var(--background-muted)] border-[var(--border-primary)] hover:bg-[var(--background-hover)]'
                                }`}
                            >
                                <div>
                                    <p className={`font-semibold text-sm ${isZero ? 'text-red-600 dark:text-red-400' : 'text-[var(--text-primary)]'}`}>{client.name}</p>
                                    <p className={`text-xs ${isZero ? 'text-red-600 dark:text-red-400 font-medium' : 'text-[var(--text-secondary)]'}`}>{packageCount} paquetes</p>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${selectedClients.has(client.id) ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' : 'border-gray-300'}`}>
                                    {selectedClients.has(client.id) && <IconCheckCircle className="w-3 h-3 text-white"/>}
                                </div>
                            </div>
                        );
                    })}
                    {filteredClients.length === 0 && <p className="text-center text-sm text-[var(--text-muted)] py-4">No se encontraron clientes.</p>}
                </div>
            </div>

            {/* Assigned Routes Column */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-lg text-[var(--text-primary)]">Rutas Asignadas - Turno {shift === 'MANANA' ? 'MAÑANA' : shift}</h3>
                {runs.length === 0 ? <p className="text-[var(--text-muted)]">No hay rutas creadas para este turno.</p> : runs.map(run => {
                    const isEditingThisRun = editingRunId === run.id;
                    return (
                     <div key={run.id} className="bg-[var(--background-secondary)] shadow-md rounded-lg overflow-hidden border border-[var(--border-primary)]">
                        <div className={`p-4 border-b flex justify-between items-center ${run.informed ? (isEditingThisRun ? 'bg-blue-50' : 'bg-green-50') : 'bg-yellow-50'}`}>
                            <div className="flex items-center gap-3">
                                <IconTruck className="w-8 h-8 text-[var(--text-secondary)]"/>
                                <div>
                                    <h4 className="font-bold text-lg text-[var(--text-primary)]">{run.driverName}</h4>
                                    <p className="text-xs text-[var(--text-muted)]">{run.assignments.length} retiros | Total: {formatCurrency(run.assignments.reduce((sum, a) => sum + a.cost, 0))}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onCopyRunMessage(run)}
                                    title="Copiar ruta completa para WhatsApp"
                                    className="p-2 w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold bg-green-100 text-green-700 hover:bg-green-200"
                                >
                                    {copiedRunIdForW === run.id ? (
                                        <IconCheckCircle className="w-4 h-4 text-green-500"/>
                                    ) : (
                                        'W'
                                    )}
                                </button>
                                {run.informed && !isEditingThisRun && (
                                    <>
                                        <span className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                            <IconCheckCircle className="w-4 h-4"/> Notificado
                                        </span>
                                        <button onClick={() => setEditingRunId(run.id)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200">
                                            <IconPencil className="w-4 h-4"/> Editar
                                        </button>
                                    </>
                                )}
                                {isEditingThisRun && (
                                    <button onClick={() => setEditingRunId(null)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-100 rounded-full hover:bg-red-200">
                                        <IconX className="w-4 h-4" />
                                        Cerrar Edición
                                    </button>
                                )}
                                {!run.informed && (
                                     <button onClick={() => onInformDriver(run)} disabled={informingRunId === run.id} className={'flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 hover:bg-yellow-200'}>
                                        {informingRunId === run.id ? <IconClock className="w-4 h-4 animate-spin"/> : <IconWhatsapp className="w-4 h-4"/>}
                                        Notificar
                                    </button>
                                )}
                                {(!run.informed || isEditingThisRun) && (
                                    <>
                                        <button onClick={() => setAddingToRun(run)} title="Agregar Retiros a esta Ruta" className="p-2 text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200"><IconPlus className="w-4 h-4" /></button>
                                        <button onClick={() => setCopyingRun(run)} title="Copiar Ruta a otros días" className="p-2 text-indigo-600 bg-indigo-100 rounded-full hover:bg-indigo-200"><IconCopy className="w-4 h-4" /></button>
                                        <button onClick={() => setReassigningRun(run)} title="Reasignar Ruta Completa" className="w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold bg-orange-100 text-orange-700 hover:bg-orange-200">R</button>
                                        <button onClick={() => setDeletingRun(run)} title="Eliminar Ruta Completa" className="p-2 text-red-600 bg-red-100 rounded-full hover:bg-red-200"><IconTrash className="w-4 h-4" /></button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="divide-y divide-[var(--border-primary)]">
                            {run.assignments.map(a => (
                                <div key={a.id} className="p-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-sm text-[var(--text-primary)]">{a.clientName}</p>
                                        <p className="text-xs text-[var(--text-secondary)]">{a.packagesToPickup} paquetes - {formatCurrency(a.cost)}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => handleCopyAssignmentDetails(a, run)}
                                            title="Copiar detalles para WhatsApp"
                                            className="p-2 rounded-full hover:bg-[var(--background-hover)]"
                                        >
                                            {copiedAssignmentId === a.id ? (
                                                <IconCheckCircle className="w-4 h-4 text-green-500"/>
                                            ) : (
                                                <IconCopy className="w-4 h-4 text-[var(--text-muted)]"/>
                                            )}
                                        </button>
                                        <button onClick={() => setEditingAssignment(a)} className="p-2 rounded-full hover:bg-[var(--background-hover)]"><IconPencil className="w-4 h-4 text-[var(--text-muted)]"/></button>
                                        <button onClick={() => setReassigningAssignment({ assignment: a, run })} className="p-2 rounded-full hover:bg-[var(--background-hover)]"><IconRefresh className="w-4 h-4 text-[var(--text-muted)]"/></button>
                                        <button onClick={() => setDeletingAssignment(a)} className="p-2 rounded-full hover:bg-red-100"><IconTrash className="w-4 h-4 text-red-600"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )})}
            </div>

            {/* Modals */}
            {isModalOpen && (
                <CreatePickupRunModal
                    onClose={() => setIsModalOpen(false)}
                    onCreate={handleCreateRun}
                    clients={clients.filter(c => selectedClients.has(c.id))}
                    drivers={drivers}
                    packages={packages}
                    shift={shift}
                    date={date}
                />
            )}
            {addingToRun && (
                <AddAssignmentsToRunModal
                    run={addingToRun}
                    onClose={() => setAddingToRun(null)}
                    onAdd={handleAddAssignments}
                    availableClients={clientsAvailableForAssignment}
                    packages={packages}
                />
            )}
            {copyingRun && (
                <CopyRunModal
                    run={copyingRun}
                    onClose={() => setCopyingRun(null)}
                    onCopy={handleCopyRun}
                />
            )}
            {reassigningRun && (
                <ReassignRunModal
                    run={reassigningRun}
                    drivers={drivers}
                    onClose={() => setReassigningRun(null)}
                    onSave={handleReassignRun}
                />
            )}
            {editingAssignment && (
                <EditAssignmentCostModal
                    assignment={editingAssignment}
                    onClose={() => setEditingAssignment(null)}
                    onSave={handleSaveCost}
                />
            )}
            {reassigningAssignment && (
                <ReassignAssignmentModal
                    assignment={reassigningAssignment.assignment}
                    drivers={drivers.filter(d => d.id !== reassigningAssignment.run.driverId)}
                    onClose={() => setReassigningAssignment(null)}
                    onSave={handleReassign}
                />
            )}
             {deletingAssignment && (
                <ConfirmationModal
                    title="Eliminar Retiro"
                    message={`¿Estás seguro de que quieres eliminar el retiro de "${deletingAssignment.clientName}" de esta ruta?`}
                    confirmText="Sí, Eliminar"
                    onClose={() => setDeletingAssignment(null)}
                    onConfirm={handleDelete}
                />
            )}
             {deletingRun && (
                <ConfirmationModal
                    title="Eliminar Ruta Completa"
                    message={`¿Estás seguro de que quieres eliminar toda la ruta para "${deletingRun.driverName}"? Esta acción no se puede deshacer.`}
                    confirmText="Sí, Eliminar Ruta"
                    onClose={() => setDeletingRun(null)}
                    onConfirm={handleDeleteRun}
                />
            )}
        </div>
    );
};

export const PickupDashboard: React.FC = () => {
    const [viewMode, setViewMode] = useState<'PLANNING' | 'HISTORY'>('PLANNING');
    const [selectedDate, setSelectedDate] = useState(getISODate(new Date()));
    const [activeShift, setActiveShift] = useState<PickupShift>(PickupShift.MANANA);
    
    const [users, setUsers] = useState<User[]>([]);
    const [packages, setPackages] = useState<Package[]>([]);
    const [runs, setRuns] = useState<PickupRun[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isCopyDayModalOpen, setIsCopyDayModalOpen] = useState(false);
    const [isDeleteDayModalOpen, setIsDeleteDayModalOpen] = useState(false);
    const [informingRunId, setInformingRunId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [copiedRunIdForW, setCopiedRunIdForW] = useState<string | null>(null);
    
    const formatCurrency = (value: number) => value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

    const generateWhatsAppMessage = (run: PickupRun, driver: User): string => {
        const runDate = parseDateString(run.date);
        const runDateFormatted = runDate.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

        let message = `*Nuevas Rutas de Retiro Asignadas*\n`;
        message += `Hola ${driver.name}, tienes las siguientes rutas nuevas:\n`;
        message += `--------------------------------------\n`;
        message += `*FECHA: ${runDateFormatted}* *TURNO: ${run.shift === 'MANANA' ? 'MAÑANA' : run.shift}*\n`;
        message += `--------------------------------------\n\n`;
        
        run.assignments.forEach((a, index) => {
            message += `${index + 1}. *${a.clientName}* - Dir: ${a.clientAddress}\n`;
            message += `   - Contacto: ${a.clientPhone || 'No disponible'}\n`;
            message += `   - Valor: ${formatCurrency(a.cost)}\n\n`;
        });

        const totalCost = run.assignments.reduce((sum, a) => sum + a.cost, 0);
        message += `*Total a Pagar por esta Ruta: ${formatCurrency(totalCost)}*\n\n`;
        message += `Por favor, revisa la app para más detalles.\n`;
        const notificationTimestamp = new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
        message += `_(Mensaje enviado: ${notificationTimestamp})_`;
        
        return message;
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [allUsers, packagesResponse, pickupRuns] = await Promise.all([
                api.getUsers(),
                api.getPackages({ limit: 0, statusFilter: PackageStatus.Pending }),
                api.getPickupRuns({ startDate: selectedDate, endDate: selectedDate }),
            ]);
            setUsers(allUsers);
            setPackages(packagesResponse.packages);
            setRuns(pickupRuns);
        } catch (error) {
            console.error("Failed to fetch pickup dashboard data", error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleInformDriver = async (run: PickupRun) => {
        setInformingRunId(run.id);
        const driver = users.find(d => d.id === run.driverId);
        if (!driver || !driver.phone) {
            alert("El conductor no tiene un número de teléfono registrado.");
            setInformingRunId(null);
            return;
        }

        const message = generateWhatsAppMessage(run, driver);

        const phone = driver.phone.replace(/\D/g, '');
        const whatsappUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
        await api.markPickupRunAsInformed(run.id);
        fetchData();
        setInformingRunId(null);
    };

    const handleCopyRunMessage = (run: PickupRun) => {
        const driver = users.find(d => d.id === run.driverId);
        if (!driver) {
            alert("No se encontró el conductor para esta ruta.");
            return;
        }
        const message = generateWhatsAppMessage(run, driver);
        navigator.clipboard.writeText(message).then(() => {
            setCopiedRunIdForW(run.id);
            setTimeout(() => setCopiedRunIdForW(null), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Error al copiar el mensaje.');
        });
    };
    
    const handleDeleteDay = async () => {
        setIsLoading(true);
        try {
            const runIdsToDelete = runs.map(run => run.id);
            if (runIdsToDelete.length > 0) {
                await Promise.all(runIdsToDelete.map(id => api.deletePickupRun(id)));
                setSuccessMessage('El plan del día ha sido eliminado exitosamente.');
                setTimeout(() => setSuccessMessage(''), 5000);
            }
            fetchData(); // Refetch data to show the empty state
        } catch (error) {
            console.error("Failed to delete day's plan", error);
            alert("Error al eliminar el plan del día.");
        } finally {
            setIsDeleteDayModalOpen(false);
            setIsLoading(false);
        }
    };

    const filteredRuns = useMemo(() => {
        if (viewMode === 'PLANNING') {
            return runs.filter(run => run.shift === activeShift);
        }
        return runs;
    }, [runs, activeShift, viewMode]);
    
    return (
        <div className="space-y-6">
            {successMessage && (
                <div className="bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success-text)] px-4 py-3 rounded-md flex items-center justify-between" role="alert">
                    <span className="block sm:inline">{successMessage}</span>
                    <button onClick={() => setSuccessMessage('')} className="p-1 rounded-full text-[var(--success-text)] hover:opacity-75">
                        <IconX className="w-4 h-4" />
                    </button>
                </div>
            )}
            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-[var(--background-muted)] border border-[var(--border-primary)] rounded-md py-2 pl-10 pr-4 font-semibold text-[var(--text-primary)]"
                        />
                        <IconCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]"/>
                    </div>
                     {viewMode === 'PLANNING' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsCopyDayModalOpen(true)}
                                disabled={runs.length === 0}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <IconCopy className="w-4 h-4" />
                                Copiar Plan del Día
                            </button>
                            <button
                                onClick={() => setIsDeleteDayModalOpen(true)}
                                disabled={runs.length === 0}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-700 bg-red-100 rounded-md hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <IconTrash className="w-4 h-4" />
                                Borrar Plan del Día
                            </button>
                        </div>
                    )}
                </div>
                 <div className="flex items-center p-1 bg-[var(--background-muted)] rounded-lg">
                    <button onClick={() => setViewMode('PLANNING')} className={`px-3 py-1 text-sm font-semibold rounded-md ${viewMode === 'PLANNING' ? 'bg-[var(--background-secondary)] shadow' : 'text-[var(--text-secondary)]'}`}>Planificación</button>
                    <button onClick={() => setViewMode('HISTORY')} className={`px-3 py-1 text-sm font-semibold rounded-md ${viewMode === 'HISTORY' ? 'bg-[var(--background-secondary)] shadow' : 'text-[var(--text-secondary)]'}`}>Historial</button>
                </div>
                {viewMode === 'PLANNING' && (
                    <div className="flex items-center p-1 bg-[var(--background-muted)] rounded-lg">
                        {Object.values(PickupShift).map(shift => (
                            <button
                                key={shift}
                                onClick={() => setActiveShift(shift)}
                                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeShift === shift ? 'bg-[var(--background-secondary)] shadow text-[var(--brand-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--background-hover)]'}`}
                            >
                                {shift === 'MANANA' ? 'MAÑANA' : shift}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {isLoading ? <div className="text-center p-8">Cargando...</div> : (
                viewMode === 'PLANNING' ? (
                    <PlanningView
                        users={users}
                        packages={packages}
                        runs={filteredRuns}
                        allRuns={runs} // Pass all runs for the day to handle cross-shift conflict detection in UI
                        shift={activeShift}
                        date={selectedDate}
                        onDataUpdate={fetchData}
                        onInformDriver={handleInformDriver}
                        informingRunId={informingRunId}
                        onCopyRunMessage={handleCopyRunMessage}
                        copiedRunIdForW={copiedRunIdForW}
                    />
                ) : (
                    <HistoryView runs={runs} />
                )
            )}

            {isCopyDayModalOpen && (
                <CopyDayModal
                    runs={runs}
                    onClose={() => setIsCopyDayModalOpen(false)}
                    onCopy={async (runId, dates, assignmentIds) => {
                        await api.copyPickupRun(runId, dates, assignmentIds);
                        setSuccessMessage(`${dates.length} día(s) copiado(s) con éxito. Cambia la fecha para ver las nuevas rutas.`);
                        setTimeout(() => setSuccessMessage(''), 5000);
                    }}
                />
            )}
             {isDeleteDayModalOpen && (
                <ConfirmationModal
                    title="Eliminar Plan del Día Completo"
                    message={`¿Estás seguro de que quieres eliminar todas las rutas y retiros para el día ${new Date(selectedDate.replace(/-/g, '/')).toLocaleDateString('es-CL')}? Esta acción es permanente.`}
                    confirmText="Sí, Eliminar Todo"
                    onClose={() => setIsDeleteDayModalOpen(false)}
                    onConfirm={handleDeleteDay}
                />
            )}
        </div>
    );
};
