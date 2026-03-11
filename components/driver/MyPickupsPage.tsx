
import React, { useState, useEffect, useCallback, useContext } from 'react';
import type { PickupRun, PickupAssignment, PickupShift as PickupShiftType } from '../../types';
import { PickupStatus, PickupShift } from '../../constants';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import { IconUser, IconPackage, IconMapPin, IconPhone, IconCheckCircle, IconTruck, IconLoader, IconRefresh, IconCalendar } from '../Icon';
import ConfirmPickupModal from './ConfirmPickupModal';

const MyPickupsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [runs, setRuns] = useState<PickupRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [confirmingPickup, setConfirmingPickup] = useState<PickupAssignment | null>(null);
    const { user } = useContext(AuthContext)!;

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const driverRuns = await api.getDriverPickupRun();
            setRuns(driverRuns);
        } catch (error) {
            console.error("Failed to fetch driver's pickup run", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleStartPickupConfirmation = (assignment: PickupAssignment) => {
        setConfirmingPickup(assignment);
    };

    const handleConfirmPickup = async (assignmentId: string, packagesPickedUp: number) => {
        setUpdatingId(assignmentId);
        try {
            await api.updatePickupAssignmentStatus(assignmentId, PickupStatus.RETIRADO, packagesPickedUp);
            // Optimistically update UI
            setRuns(prevRuns => {
                if (!prevRuns) return [];
                return prevRuns.map(run => ({
                    ...run,
                    assignments: run.assignments.map(a =>
                        a.id === assignmentId
                        ? { ...a, status: PickupStatus.RETIRADO, packagesPickedUp }
                        : a
                    )
                }));
            });
        } catch (error) {
            console.error("Failed to update status", error);
            // Optionally revert optimistic update here
        } finally {
            setUpdatingId(null);
            setConfirmingPickup(null);
        }
    };

    if (isLoading) {
        return <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted)]"><IconLoader className="w-8 h-8 animate-spin mb-2"/>Cargando tu ruta de retiros...</div>;
    }
    
    const openInMaps = (address: string) => {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        window.open(url, '_blank');
    };

    const orderedRuns = [...runs].sort((a, b) => {
        const order: Record<PickupShiftType, number> = {
            [PickupShift.MANANA]: 1,
            [PickupShift.TARDE]: 2,
            [PickupShift.NOCHE]: 3,
        };
        return (order[a.shift] || 99) - (order[b.shift] || 99);
    });
    
    const todayDate = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center px-1">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">Mis Retiros</h1>
                    <p className="text-xs text-[var(--text-muted)] capitalize flex items-center gap-1"><IconCalendar className="w-3 h-3"/> {todayDate}</p>
                </div>
                <button 
                    onClick={fetchData} 
                    className="p-2 bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-full shadow-sm active:bg-[var(--background-hover)] transition-colors"
                    aria-label="Actualizar lista"
                >
                    <IconRefresh className="w-5 h-5 text-[var(--brand-primary)]"/>
                </button>
            </div>

            {(!runs || runs.length === 0 || runs.every(r => r.assignments.length === 0)) ? (
                <div className="text-center p-10 bg-[var(--background-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] mt-4">
                    <IconTruck className="w-16 h-16 mx-auto text-[var(--text-muted)] opacity-20 mb-4" />
                    <h3 className="font-bold text-lg text-[var(--text-primary)]">Sin ruta asignada</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-2">
                        No se encontraron retiros para hoy ({todayDate}).
                        <br/>
                        Si crees que es un error, pulsa el botón de actualizar arriba.
                    </p>
                </div>
            ) : (
                orderedRuns.map(run => (
                    <div key={run.id} className="animate-fade-in-up">
                        <div className="flex items-center justify-between mb-3 pb-1 border-b border-[var(--border-secondary)]">
                            <h3 className="text-lg font-bold text-[var(--brand-primary)]">
                                Turno {run.shift === 'MANANA' ? 'MAÑANA' : run.shift}
                            </h3>
                            <span className="text-xs bg-[var(--background-muted)] px-2 py-1 rounded-full text-[var(--text-secondary)] font-medium">
                                {run.assignments.length} paradas
                            </span>
                        </div>
                        <div className="space-y-4">
                            {run.assignments.map(assignment => {
                                const isCompleted = assignment.status === PickupStatus.RETIRADO;
                                return (
                                    <div key={assignment.id} className={`bg-[var(--background-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] overflow-hidden transition-all ${isCompleted ? 'opacity-60 bg-gray-50' : ''}`}>
                                        <div className="p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="font-bold text-lg text-[var(--text-primary)] leading-tight">{assignment.clientName}</h4>
                                                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mt-1">
                                                        <IconPackage className="w-4 h-4"/>
                                                        <span>{assignment.packagesToPickup} paquetes estimados</span>
                                                    </div>
                                                </div>
                                                {isCompleted && <div className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full"><IconCheckCircle className="w-3 h-3"/> LISTO</div>}
                                            </div>
                                            
                                            <div className="space-y-3 text-sm">
                                                <div className="flex items-start gap-3 p-2 bg-[var(--background-muted)] rounded-lg">
                                                    <IconMapPin className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
                                                    <button onClick={() => openInMaps(assignment.clientAddress)} className="text-left text-blue-600 font-medium hover:underline break-words w-full">
                                                        {assignment.clientAddress}
                                                    </button>
                                                </div>
                                                {assignment.clientPhone && (
                                                    <div className="flex items-start gap-3 pl-2">
                                                        <IconPhone className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5"/>
                                                        <a href={`tel:${assignment.clientPhone}`} className="text-[var(--text-secondary)] hover:text-[var(--brand-primary)]">
                                                            {assignment.clientPhone}
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {!isCompleted && (
                                            <button
                                                onClick={() => handleStartPickupConfirmation(assignment)}
                                                disabled={updatingId === assignment.id}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-4 text-sm font-bold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] active:bg-[var(--brand-secondary)] transition-colors disabled:bg-slate-400"
                                            >
                                                {updatingId === assignment.id ? <IconLoader className="w-5 h-5 animate-spin"/> : <IconCheckCircle className="w-5 h-5"/>}
                                                {updatingId === assignment.id ? 'Procesando...' : 'CONFIRMAR RETIRO'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
            
            {confirmingPickup && (
                <ConfirmPickupModal
                    assignment={confirmingPickup}
                    onClose={() => setConfirmingPickup(null)}
                    onConfirm={handleConfirmPickup}
                />
            )}
        </div>
    );
};

export default MyPickupsPage;
