import React, { useState, useEffect, useContext } from 'react';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import { IconCheckCircle, IconXCircle, IconSearch, IconFilter, IconMapPin } from '../Icon';

interface Commune {
    id: number;
    name: string;
    region: string;
    isActive: boolean;
}

const CommuneManagement: React.FC = () => {
    const auth = useContext(AuthContext);
    const [communes, setCommunes] = useState<Commune[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        fetchCommunes();
    }, []);

    const fetchCommunes = async () => {
        try {
            setLoading(true);
            const data = await api.getCommunes();
            setCommunes(data);
        } catch (error) {
            console.error('Error fetching communes:', error);
            setErrorMessage('No se pudieron cargar las comunas.');
        } finally {
            setLoading(false);
        }
    };

    const toggleCommune = (name: string) => {
        setCommunes(prev => prev.map(c => 
            c.name === name ? { ...c, isActive: !c.isActive } : c
        ));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setSuccessMessage('');
            setErrorMessage('');
            
            await api.updateCommunes(communes.map(c => ({ name: c.name, isActive: c.isActive })));
            
            if (auth?.refetchCommunes) {
                await auth.refetchCommunes();
            }

            setSuccessMessage('Configuración de comunas guardada con éxito.');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error saving communes:', error);
            setErrorMessage('Error al guardar la configuración.');
        } finally {
            setSaving(false);
        }
    };

    const filteredCommunes = communes.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeCount = communes.filter(c => c.isActive).length;

    return (
        <div className="bg-[var(--background-secondary)] shadow-lg rounded-xl overflow-hidden border border-[var(--border-primary)]">
            <div className="p-6 border-b border-[var(--border-primary)] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--brand-muted)] bg-opacity-30">
                <div>
                    <h2 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
                        <IconMapPin className="text-[var(--brand-primary)]" />
                        Gestión de Comunas de Reparto
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Selecciona las comunas donde el servicio de logística está operativo.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-slate-800 border border-[var(--border-secondary)] rounded-full px-4 py-1 flex items-center gap-2 text-sm font-bold shadow-sm">
                        <span className="text-[var(--brand-primary)]">{activeCount}</span>
                        <span className="text-[var(--text-muted)]">ACTIVAS</span>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg shadow-md hover:bg-[var(--brand-secondary)] disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <div className="p-4 border-b border-[var(--border-primary)] flex gap-4">
                <div className="relative flex-1">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar comuna..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[var(--background-primary)] border border-[var(--border-secondary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] text-[var(--text-primary)]"
                    />
                </div>
                <div className="flex border border-[var(--border-secondary)] rounded-lg overflow-hidden">
                    <button 
                        onClick={() => setCommunes(prev => prev.map(c => ({...c, isActive: true})))}
                        className="px-4 py-2 text-xs font-bold bg-[var(--background-secondary)] text-[var(--text-secondary)] hover:bg-[var(--brand-muted)] border-r border-[var(--border-secondary)]"
                    >
                        ACTIVAR TODAS
                    </button>
                    <button 
                        onClick={() => setCommunes(prev => prev.map(c => ({...c, isActive: false})))}
                        className="px-4 py-2 text-xs font-bold bg-[var(--background-secondary)] text-[var(--text-secondary)] hover:bg-[var(--brand-muted)]"
                    >
                        DESACTIVAR TODAS
                    </button>
                </div>
            </div>

            {successMessage && <div className="mx-6 mt-4 p-3 bg-green-100 border border-green-200 text-green-700 rounded-lg text-sm font-bold animate-fade-in">{successMessage}</div>}
            {errorMessage && <div className="mx-6 mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm font-bold">{errorMessage}</div>}

            <div className="p-6">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredCommunes.map((commune) => (
                            <div 
                                key={commune.name}
                                onClick={() => toggleCommune(commune.name)}
                                className={`
                                    cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center justify-between group
                                    ${commune.isActive 
                                        ? 'border-[var(--brand-primary)] bg-[var(--brand-muted)] bg-opacity-20 shadow-sm' 
                                        : 'border-[var(--border-secondary)] bg-[var(--background-primary)] hover:border-[var(--text-muted)]'}
                                `}
                            >
                                <div className="flex flex-col">
                                    <span className={`text-sm font-black uppercase tracking-tight ${commune.isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]'}`}>
                                        {commune.name}
                                    </span>
                                    <span className="text-[10px] text-[var(--text-muted)] font-bold">{commune.region}</span>
                                </div>
                                <div className={`
                                    w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all
                                    ${commune.isActive 
                                        ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white' 
                                        : 'border-[var(--border-secondary)] group-hover:border-[var(--text-muted)] bg-white dark:bg-slate-700'}
                                `}>
                                    {commune.isActive && <IconCheckCircle className="w-5 h-5" />}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {!loading && filteredCommunes.length === 0 && (
                    <div className="text-center py-12 bg-[var(--background-primary)] rounded-xl border-2 border-dashed border-[var(--border-secondary)]">
                        <p className="text-[var(--text-muted)] font-bold">No se encontraron comunas que coincidan con la búsqueda.</p>
                    </div>
                ) }
            </div>
            
            <div className="p-6 bg-[var(--background-primary)] border-t border-[var(--border-primary)]">
                <div className="flex items-start gap-3 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800">
                    <IconFilter className="w-6 h-6 shrink-0" />
                    <div>
                        <p className="text-sm font-black uppercase tracking-widest">Impacto en el Sistema</p>
                        <p className="text-xs font-bold leading-relaxed mt-1">
                            Las comunas desactivadas dejarán de aparecer en los formularios de creación de paquetes, filtros de búsqueda e importaciones automáticas. Los paquetes ya creados en estas comunas seguirán siendo visibles pero marcados como "Zona no preferente".
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommuneManagement;
