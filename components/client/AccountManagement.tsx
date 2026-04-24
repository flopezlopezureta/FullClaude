
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
    IconMercadoLibre, 
    IconShopify, 
    IconWoocommerce, 
    IconJumpseller, 
    IconPlugConnected, 
    IconTrash, 
    IconPencil, 
    IconCheckCircle, 
    IconAlertTriangle, 
    IconLoader, 
    IconPlus, 
    IconRefresh,
    IconX,
    IconCheck
} from '../Icon';

const AccountManagement: React.FC = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editingAccount, setEditingAccount] = useState<string | null>(null);
    const [newName, setNewName] = useState('');

    const fetchAccounts = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api.getIntegrationAccounts();
            setAccounts(data);
        } catch (err: any) {
            setError('Error al cargar las cuentas: ' + (err.message || 'Error desconocido'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleRename = async (accountId: string) => {
        if (!newName.trim()) return;
        setIsSaving(accountId);
        try {
            await api.updateIntegrationAccount(accountId, { nickname: newName });
            setEditingAccount(null);
            fetchAccounts();
        } catch (err: any) {
            alert('Error al renombrar cuenta: ' + (err.message || 'Error desconocido'));
        } finally {
            setIsSaving(null);
        }
    };

    const handleDelete = async (accountId: string) => {
        if (!confirm('¿Estás seguro de que deseas desconectar esta cuenta?')) return;
        setIsSaving(accountId);
        try {
            await api.deleteIntegrationAccount(accountId);
            fetchAccounts();
        } catch (err: any) {
            alert('Error al eliminar cuenta: ' + (err.message || 'Error desconocido'));
        } finally {
            setIsSaving(null);
        }
    };

    const toggleAutoImport = async (accountId: string, current: boolean) => {
        setIsSaving(accountId);
        try {
            await api.updateIntegrationAccount(accountId, { settings: { autoImport: !current } });
            fetchAccounts();
        } catch (err: any) {
            alert('Error al actualizar configuración: ' + (err.message || 'Error desconocido'));
        } finally {
            setIsSaving(null);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'MERCADO_LIBRE': return <IconMercadoLibre className="w-6 h-6 text-yellow-500" />;
            case 'SHOPIFY': return <IconShopify className="w-6 h-6 text-green-500" />;
            case 'WOOCOMMERCE': return <IconWoocommerce className="w-6 h-6 text-purple-600" />;
            case 'JUMPSELLER': return <IconJumpseller className="w-6 h-6 text-sky-600" />;
            default: return <IconPlugConnected className="w-6 h-6 text-gray-500" />;
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted)]">
                <IconLoader className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                <p className="font-bold">Cargando tus cuentas vinculadas...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Cuentas Vinculadas</h2>
                    <p className="text-sm text-[var(--text-muted)]">Gestiona tus múltiples tiendas e integraciones en un solo lugar.</p>
                </div>
                <button 
                    onClick={fetchAccounts}
                    className="p-2 rounded-full hover:bg-[var(--background-hover)] transition-colors text-[var(--text-muted)]"
                    title="Actualizar"
                >
                    <IconRefresh className="w-5 h-5" />
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-3">
                    <IconAlertTriangle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map(acc => (
                    <div key={acc.id} className="bg-white border border-[var(--border-primary)] rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                        <div className="p-5 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                                        {getIcon(acc.type)}
                                    </div>
                                    <div>
                                        {editingAccount === acc.id ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="text" 
                                                    value={newName} 
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    className="text-sm font-bold border border-blue-500 rounded px-2 py-1 outline-none"
                                                    autoFocus
                                                />
                                                <button onClick={() => handleRename(acc.id)} className="text-green-600 hover:text-green-700">
                                                    <IconCheck className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => setEditingAccount(null)} className="text-red-600 hover:text-red-700">
                                                    <IconX className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group">
                                                <h3 className="font-bold text-[var(--text-primary)]">{acc.nickname || acc.name || 'Sin nombre'}</h3>
                                                <button 
                                                    onClick={() => { setEditingAccount(acc.id); setNewName(acc.nickname || acc.name || ''); }}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-500"
                                                >
                                                    <IconPencil className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{acc.type.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${acc.status === 'CONNECTED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${acc.status === 'CONNECTED' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                        {acc.status === 'CONNECTED' ? 'Conectado' : 'Error'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-gray-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-700">Sincronización Automática</span>
                                        <span className="text-[10px] text-gray-400">Importar pedidos cada {acc.settings?.syncInterval || 30} min</span>
                                    </div>
                                    <button 
                                        onClick={() => toggleAutoImport(acc.id, acc.settings?.autoImport)}
                                        disabled={isSaving === acc.id}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${acc.settings?.autoImport ? 'bg-blue-600' : 'bg-gray-200'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${acc.settings?.autoImport ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                {acc.settings?.lastSync && (
                                    <div className="text-[10px] text-gray-400 italic">
                                        Última sincronización: {new Date(acc.settings.lastSync).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-[10px] text-gray-400 font-medium">Vinculado el {new Date(acc.connectedAt).toLocaleDateString()}</span>
                            <button 
                                onClick={() => handleDelete(acc.id)}
                                disabled={isSaving === acc.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100 rounded-md transition-colors"
                            >
                                {isSaving === acc.id ? <IconLoader className="w-3 h-3 animate-spin" /> : <IconTrash className="w-3 h-3" />}
                                Desconectar
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Account Card */}
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center group hover:border-blue-400 transition-all bg-gray-50/50">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <IconPlus className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-gray-700 mb-1">Vincular Nueva Cuenta</h3>
                    <p className="text-xs text-gray-500 mb-6 max-w-[200px]">Conecta otra tienda de Mercado Libre, Shopify o Jumpseller.</p>
                    
                    <div className="flex flex-wrap justify-center gap-2">
                        <button 
                            onClick={() => window.location.href = '/api/integrations/meli/auth'}
                            className="p-2 bg-white border border-gray-200 rounded-lg hover:border-yellow-400 hover:shadow-sm transition-all"
                            title="Añadir Mercado Libre"
                        >
                            <IconMercadoLibre className="w-5 h-5 text-yellow-500" />
                        </button>
                        <button 
                            onClick={() => {/* Trigger Shopify modal or flow */}}
                            className="p-2 bg-white border border-gray-200 rounded-lg hover:border-green-400 hover:shadow-sm transition-all"
                            title="Añadir Shopify"
                        >
                            <IconShopify className="w-5 h-5 text-green-500" />
                        </button>
                        <button 
                            onClick={() => {/* Trigger Jumpseller modal or flow */}}
                            className="p-2 bg-white border border-gray-200 rounded-lg hover:border-sky-400 hover:shadow-sm transition-all"
                            title="Añadir Jumpseller"
                        >
                            <IconJumpseller className="w-5 h-5 text-sky-600" />
                        </button>
                    </div>
                </div>
            </div>

            {accounts.length === 0 && !isLoading && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-10 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <IconPlugConnected className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-blue-900 mb-2">No tienes cuentas vinculadas</h3>
                    <p className="text-sm text-blue-700 max-w-md">Conecta tus cuentas de ventas para que Full Envíos pueda importar automáticamente tus pedidos y generar etiquetas de despacho.</p>
                </div>
            )}
        </div>
    );
};

export default AccountManagement;
