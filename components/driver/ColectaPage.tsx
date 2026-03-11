
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { IconPackage, IconMapPin, IconPhone, IconCheckCircle, IconLoader, IconRefresh, IconCalendar, IconTruck } from '../Icon';
import { PickupShift } from '../../constants';

const ColectaPage: React.FC<{ onBack: () => void }> = () => {
    const [availableColectas, setAvailableColectas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [selectedShift, setSelectedShift] = useState<string>('MANANA');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const colectas = await api.getAvailableColectas();
            setAvailableColectas(colectas);
        } catch (error) {
            console.error("Failed to fetch available colectas", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleClaimColecta = async (clientId: string) => {
        if (!window.confirm('¿Estás seguro de que quieres tomar este retiro?')) return;
        
        setClaimingId(clientId);
        try {
            await api.claimColecta(clientId, selectedShift);
            alert('Retiro tomado con éxito. Ahora aparecerá en tu sección de "Mis Retiros".');
            // Remove from available list
            setAvailableColectas(prev => prev.filter(c => c.id !== clientId));
        } catch (error: any) {
            console.error("Failed to claim colecta", error);
            alert(error.message || "Error al tomar el retiro.");
        } finally {
            setClaimingId(null);
        }
    };

    if (isLoading) {
        return <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted)]"><IconLoader className="w-8 h-8 animate-spin mb-2"/>Buscando colectas disponibles...</div>;
    }

    const openInMaps = (address: string) => {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        window.open(url, '_blank');
    };

    const todayDate = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center px-1">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">Colectas Disponibles</h1>
                    <p className="text-xs text-[var(--text-muted)] capitalize flex items-center gap-1"><IconCalendar className="w-3 h-3"/> {todayDate}</p>
                </div>
                <button 
                    onClick={fetchData} 
                    className="p-2 bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-full shadow-sm active:bg-[var(--background-hover)] transition-colors"
                >
                    <IconRefresh className="w-5 h-5 text-[var(--brand-primary)]"/>
                </button>
            </div>

            <div className="bg-[var(--background-secondary)] p-4 rounded-xl border border-[var(--border-primary)] shadow-sm">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Selecciona tu turno de trabajo:</label>
                <div className="grid grid-cols-3 gap-2">
                    {Object.values(PickupShift).map(shift => (
                        <button
                            key={shift}
                            onClick={() => setSelectedShift(shift)}
                            className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${selectedShift === shift ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]' : 'bg-[var(--background-muted)] text-[var(--text-secondary)] border-[var(--border-secondary)]'}`}
                        >
                            {shift === 'MANANA' ? 'MAÑANA' : shift}
                        </button>
                    ))}
                </div>
            </div>

            {availableColectas.length === 0 ? (
                <div className="text-center p-10 bg-[var(--background-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] mt-4">
                    <IconTruck className="w-16 h-16 mx-auto text-[var(--text-muted)] opacity-20 mb-4" />
                    <h3 className="font-bold text-lg text-[var(--text-primary)]">No hay colectas libres</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-2">
                        Todos los retiros ya han sido asignados o no hay paquetes pendientes.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {availableColectas.map(colecta => (
                        <div key={colecta.id} className="bg-[var(--background-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] overflow-hidden">
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-bold text-lg text-[var(--text-primary)] leading-tight">{colecta.name}</h4>
                                        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mt-1">
                                            <IconPackage className="w-4 h-4"/>
                                            <span>{colecta.pendingCount} paquetes pendientes</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-start gap-3 p-2 bg-[var(--background-muted)] rounded-lg">
                                        <IconMapPin className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
                                        <button onClick={() => openInMaps(colecta.address)} className="text-left text-blue-600 font-medium hover:underline break-words w-full">
                                            {colecta.address}
                                        </button>
                                    </div>
                                    {colecta.phone && (
                                        <div className="flex items-start gap-3 pl-2">
                                            <IconPhone className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5"/>
                                            <span className="text-[var(--text-secondary)]">{colecta.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => handleClaimColecta(colecta.id)}
                                disabled={claimingId === colecta.id}
                                className="w-full flex items-center justify-center gap-2 px-4 py-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors disabled:bg-slate-400"
                            >
                                {claimingId === colecta.id ? <IconLoader className="w-5 h-5 animate-spin"/> : <IconCheckCircle className="w-5 h-5"/>}
                                {claimingId === colecta.id ? 'Procesando...' : 'TOMAR ESTE RETIRO'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ColectaPage;
