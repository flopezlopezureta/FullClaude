
import React, { useState } from 'react';
import type { PickupRun, PickupShift } from '../../types';
import { IconX, IconCopy, IconLoader, IconCheckCircle, IconChevronLeft, IconChevronRight, IconTruck } from '../Icon';
import { parseDateString, getISODate } from '../../services/api';

const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface CopyDayModalProps {
    runs: PickupRun[]; // All runs for the day
    onClose: () => void;
    onCopy: (runId: string, dates: string[], assignmentIds: string[]) => Promise<void>;
}

const CopyDayModal: React.FC<CopyDayModalProps> = ({ runs, onClose, onCopy }) => {
    const runsByShift = runs.reduce((acc, run) => {
        if (!acc[run.shift]) {
            acc[run.shift] = [];
        }
        acc[run.shift].push(run);
        return acc;
    }, {} as Record<PickupShift, PickupRun[]>);
    
    const allAssignments = runs.flatMap(run => run.assignments);

    const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(() => new Set(allAssignments.map(a => a.id)));
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [displayDate, setDisplayDate] = useState(new Date());

    const today = new Date();
    today.setHours(0,0,0,0);

    const handlePrevMonth = () => {
        setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };
    const handleNextMonth = () => {
        setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const toggleDateSelection = (date: string) => {
        setSelectedDates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(date)) newSet.delete(date); else newSet.add(date);
            return newSet;
        });
    };
    
    const toggleAssignmentSelection = (assignmentId: string) => {
        setSelectedAssignments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(assignmentId)) newSet.delete(assignmentId); else newSet.add(assignmentId);
            return newSet;
        });
    };
    
    const toggleSelectAllAssignmentsForRun = (run: PickupRun) => {
        const runAssignmentIds = run.assignments.map(a => a.id);
        const allSelectedInRun = runAssignmentIds.every(id => selectedAssignments.has(id));

        setSelectedAssignments(prev => {
            const newSet = new Set(prev);
            if (allSelectedInRun) {
                runAssignmentIds.forEach(id => newSet.delete(id));
            } else {
                runAssignmentIds.forEach(id => newSet.add(id));
            }
            return newSet;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedDates.size === 0 || selectedAssignments.size === 0) return;

        setIsSaving(true);
        try {
            const assignmentsByRun = new Map<string, string[]>();

            for (const run of runs) {
                const selectedInRun = run.assignments
                    .filter(a => selectedAssignments.has(a.id))
                    .map(a => a.id);
                
                if (selectedInRun.length > 0) {
                    assignmentsByRun.set(run.id, selectedInRun);
                }
            }
            
            const copyPromises = [];
            for (const [runId, assignmentIds] of assignmentsByRun.entries()) {
                copyPromises.push(onCopy(runId, Array.from(selectedDates), assignmentIds));
            }

            await Promise.all(copyPromises);
            onClose();
        } catch (error) {
            console.error(error);
            alert("Ocurrió un error al copiar las rutas.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const renderCalendar = () => {
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const monthName = displayDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const calendarDays = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarDays.push(<div key={`empty-${i}`} className="p-1"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day);
            const dateString = getISODate(currentDayDate);
            
            const isPast = currentDayDate < today;
            const isSourceDay = runs.length > 0 && dateString === getISODate(parseDateString(runs[0].date));
            const isDisabled = isPast || isSourceDay;
            const isSelected = selectedDates.has(dateString);

            calendarDays.push(
                <button
                    key={day}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => toggleDateSelection(dateString)}
                    className={`relative w-full aspect-square text-sm border rounded-md text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                        ${isSelected ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] font-bold' : 'bg-[var(--background-secondary)] text-[var(--text-primary)] border-[var(--border-secondary)] hover:border-[var(--brand-secondary)]'}
                        ${isSourceDay ? 'bg-[var(--background-muted)] line-through' : ''}
                        ${isPast ? 'text-[var(--text-muted)]' : ''}
                    `}
                >
                    {day}
                </button>
            );
        }
        
        return (
            <div>
                <div className="flex justify-between items-center mb-2 px-2">
                    <button type="button" onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-[var(--background-hover)]"><IconChevronLeft className="w-5 h-5"/></button>
                    <span className="font-semibold text-center capitalize">{monthName}</span>
                    <button type="button" onClick={handleNextMonth} className="p-2 rounded-full hover:bg-[var(--background-hover)]"><IconChevronRight className="w-5 h-5"/></button>
                </div>
                <div className="grid grid-cols-7 text-center text-xs text-[var(--text-muted)] mb-1">
                    {dayNamesShort.map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-3xl animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Copiar Plan del Día a Futuro</h3>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]"><IconX className="w-6 h-6" /></button>
                </header>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">1. Selecciona los retiros a copiar:</label>
                            <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar p-1">
                                {(Object.entries(runsByShift) as [PickupShift, PickupRun[]][]).map(([shift, runsInShift]) => (
                                    <div key={shift}>
                                        <h4 className="font-semibold text-sm uppercase tracking-wider text-[var(--text-muted)] mb-2">{shift === 'MANANA' ? 'MAÑANA' : shift}</h4>
                                        <div className="space-y-3">
                                            {runsInShift.map(run => (
                                                <div key={run.id} className="border border-[var(--border-secondary)] rounded-lg">
                                                    <div className="p-2 bg-[var(--background-muted)] border-b border-[var(--border-secondary)]">
                                                        <label className="flex items-center text-sm font-medium">
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 rounded border-gray-300 text-[var(--brand-primary)] focus:ring-[var(--brand-secondary)]"
                                                                checked={run.assignments.every(a => selectedAssignments.has(a.id))}
                                                                onChange={() => toggleSelectAllAssignmentsForRun(run)}
                                                            />
                                                            <span className="ml-2 flex items-center gap-2"><IconTruck className="w-4 h-4" /> {run.driverName}</span>
                                                        </label>
                                                    </div>
                                                    <div className="space-y-1 p-2">
                                                        {run.assignments.map(assignment => (
                                                            <label key={assignment.id} className="flex items-center p-1.5 rounded-md hover:bg-[var(--background-hover)]">
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 rounded border-gray-300 text-[var(--brand-primary)] focus:ring-[var(--brand-secondary)]"
                                                                    checked={selectedAssignments.has(assignment.id)}
                                                                    onChange={() => toggleAssignmentSelection(assignment.id)}
                                                                />
                                                                <span className="ml-3 text-sm text-[var(--text-primary)]">{assignment.clientName}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">2. Selecciona los días de destino:</label>
                            {renderCalendar()}
                            <p className="text-xs text-[var(--text-muted)] mt-4">Nota: Se copiarán todos los retiros seleccionados al día de destino.</p>
                        </div>
                    </div>

                    <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end">
                        <button type="submit" disabled={isSaving || selectedDates.size === 0 || selectedAssignments.size === 0} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] disabled:bg-slate-400">
                            {isSaving ? <IconLoader className="w-5 h-5 mr-2 animate-spin" /> : <IconCopy className="w-5 h-5 mr-2" />}
                            {isSaving ? 'Copiando...' : `Copiar Plan a ${selectedDates.size} día(s)`}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default CopyDayModal;
