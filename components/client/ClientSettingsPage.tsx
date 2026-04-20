
import React, { useState, useEffect, useContext } from 'react';
import { api } from '../../services/api';
import { IconCheckCircle, IconLoader, IconAlertTriangle, IconPlugConnected, IconEye, IconEyeOff, IconShopify, IconWoocommerce, IconJumpseller, IconFalabella } from '../Icon';
import { AuthContext } from '../../contexts/AuthContext';

const ClientSettingsPage: React.FC = () => {
    const auth = useContext(AuthContext);
    const [settings, setSettings] = useState({
        shopifyShopUrl: '',
        shopifyAccessToken: '',
        shopifyAutoImport: false,
        shopifySyncInterval: 5,
        wooUrl: '',
        wooConsumerKey: '',
        wooConsumerSecret: '',
        wooAutoImport: false,
        wooSyncInterval: 30,
        jumpsellerLogin: '',
        jumpsellerToken: '',
        jumpsellerAutoImport: false,
        jumpsellerSyncInterval: 10,
        falabellaSellerId: '',
        falabellaApiKey: '',
    });
    const [passwordVisibility, setPasswordVisibility] = useState({
        shopifyAccessToken: false,
        wooConsumerSecret: false,
        jumpsellerToken: false,
        falabellaApiKey: false,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Test States
    const [isTestingShopify, setIsTestingShopify] = useState(false);
    const [shopifyTestResult, setShopifyTestResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [isTestingWoo, setIsTestingWoo] = useState(false);
    const [wooTestResult, setWooTestResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [isTestingJumpseller, setIsTestingJumpseller] = useState(false);
    const [jumpsellerTestResult, setJumpsellerTestResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [isTestingFalabella, setIsTestingFalabella] = useState(false);
    const [falabellaTestResult, setFalabellaTestResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [shopifyActiveTab, setShopifyActiveTab] = useState<'connect' | 'sync' | 'manual'>('connect');
    const [wooActiveTab, setWooActiveTab] = useState<'connect' | 'sync' | 'manual'>('connect');
    const [jumpsellerActiveTab, setJumpsellerActiveTab] = useState<'connect' | 'sync' | 'manual'>('connect');

    useEffect(() => {
        const fetchSettings = async () => {
            if (!auth?.user) return;
            setIsLoading(true);
            try {
                // Settings are stored in user.integrations
                const user = await api.getUserByToken();
                const integrations = user.integrations || {};
                setSettings({
                    shopifyShopUrl: integrations.shopify?.shopUrl || '',
                    shopifyAccessToken: integrations.shopify?.accessToken || '',
                    shopifyAutoImport: integrations.shopify?.autoImport || false,
                    shopifySyncInterval: integrations.shopify?.syncInterval || 5,
                    wooUrl: integrations.woocommerce?.storeUrl || integrations.woocommerce?.wooUrl || '',
                    wooConsumerKey: integrations.woocommerce?.consumerKey || integrations.woocommerce?.wooConsumerKey || '',
                    wooConsumerSecret: integrations.woocommerce?.consumerSecret || integrations.woocommerce?.wooConsumerSecret || '',
                    wooAutoImport: integrations.woocommerce?.autoImport || false,
                    wooSyncInterval: integrations.woocommerce?.syncInterval || 30,
                    jumpsellerLogin: integrations.jumpseller?.login || '',
                    jumpsellerToken: integrations.jumpseller?.token || '',
                    jumpsellerAutoImport: integrations.jumpseller?.autoImport || false,
                    jumpsellerSyncInterval: integrations.jumpseller?.syncInterval || 10,
                    falabellaSellerId: integrations.falabella?.sellerId || '',
                    falabellaApiKey: integrations.falabella?.apiKey || '',
                });
            } catch (err: any) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [auth?.user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setSettings(prev => ({ ...prev, [name]: finalValue }));
    };

    const togglePasswordVisibility = (key: keyof typeof passwordVisibility) => {
        setPasswordVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async (type: 'shopify' | 'woocommerce' | 'jumpseller' | 'falabella') => {
        if (!auth?.user) return;
        setIsSaving(true);
        try {
            const user = await api.getUserByToken();
            const currentIntegrations = user.integrations || {};
            
            let updatedIntegrations = { ...currentIntegrations };
            
            if (type === 'shopify') {
                updatedIntegrations.shopify = {
                    shopUrl: settings.shopifyShopUrl,
                    accessToken: settings.shopifyAccessToken,
                    autoImport: settings.shopifyAutoImport,
                    syncInterval: settings.shopifySyncInterval,
                };
            } else if (type === 'woocommerce') {
                updatedIntegrations.woocommerce = {
                    wooUrl: settings.wooUrl,
                    wooConsumerKey: settings.wooConsumerKey,
                    wooConsumerSecret: settings.wooConsumerSecret,
                    autoImport: settings.wooAutoImport,
                    syncInterval: settings.wooSyncInterval,
                };
            } else if (type === 'jumpseller') {
                updatedIntegrations.jumpseller = {
                    login: settings.jumpsellerLogin,
                    token: settings.jumpsellerToken,
                    autoImport: settings.jumpsellerAutoImport,
                    syncInterval: settings.jumpsellerSyncInterval,
                };
            } else if (type === 'falabella') {
                updatedIntegrations.falabella = {
                    sellerId: settings.falabellaSellerId,
                    apiKey: settings.falabellaApiKey,
                };
            }

            await api.updateUser(auth.user.id, { integrations: updatedIntegrations });
            await auth.refetchUser();
            alert(`Configuración de ${type.charAt(0).toUpperCase() + type.slice(1)} guardada con éxito.`);
        } catch (err: any) {
            alert(`Error al guardar configuración: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestShopify = async () => {
        setIsTestingShopify(true);
        setShopifyTestResult(null);
        try {
            const result = await api.testShopifyConnection({
                shopifyShopUrl: settings.shopifyShopUrl,
                shopifyAccessToken: settings.shopifyAccessToken
            });
            setShopifyTestResult({ 
                type: 'success', 
                message: result.shopName ? `${result.message} (Tienda: ${result.shopName})` : result.message 
            });
        } catch (err: any) {
            setShopifyTestResult({ type: 'error', message: err.message || 'Error de conexión' });
        } finally {
            setIsTestingShopify(false);
        }
    };

    const handleConnectShopify = async () => {
        if (!settings.shopifyShopUrl) {
            alert('Por favor, ingresa la URL de tu tienda primero.');
            return;
        }
        try {
            const response = await fetch(`/api/integrations/shopify/install?shop=${encodeURIComponent(settings.shopifyShopUrl)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (response.ok && data.redirectUrl) {
                // Redirigir al cliente a Shopify para aprobar los permisos
                window.location.href = data.redirectUrl;
            } else {
                alert(data.message || 'Error al iniciar la conexión con Shopify.');
            }
        } catch (err) {
            alert('Error de red al intentar conectar con Shopify.');
        }
    };

    const handleTestWoo = async () => {
        setIsTestingWoo(true);
        setWooTestResult(null);
        try {
            const result = await api.testWooCommerceConnection({
                wooUrl: settings.wooUrl,
                wooConsumerKey: settings.wooConsumerKey,
                wooConsumerSecret: settings.wooConsumerSecret
            });
            setWooTestResult({ type: 'success', message: result.message });
        } catch (err: any) {
            setWooTestResult({ type: 'error', message: err.message || 'Error de conexión' });
        } finally {
            setIsTestingWoo(false);
        }
    };

    const handleTestJumpseller = async () => {
        setIsTestingJumpseller(true);
        setJumpsellerTestResult(null);
        try {
            const result = await api.testJumpsellerConnection({
                login: settings.jumpsellerLogin,
                token: settings.jumpsellerToken
            });
            setJumpsellerTestResult({ type: 'success', message: result.message });
        } catch (err: any) {
            setJumpsellerTestResult({ type: 'error', message: err.message || 'Error de conexión' });
        } finally {
            setIsTestingJumpseller(false);
        }
    };

    const handleTestFalabella = async () => {
        setIsTestingFalabella(true);
        setFalabellaTestResult(null);
        try {
            const result = await api.testFalabellaConnection({
                falabellaSellerId: settings.falabellaSellerId,
                falabellaApiKey: settings.falabellaApiKey
            });
            setFalabellaTestResult({ type: 'success', message: result.message });
        } catch (err: any) {
            setFalabellaTestResult({ type: 'error', message: err.message || 'Error de conexión' });
        } finally {
            setIsTestingFalabella(false);
        }
    };

    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

    if (isLoading) {
        return <div className="text-center p-8 text-[var(--text-muted)]">Cargando configuración...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Configuración de Integraciones</h1>
                <p className="text-[var(--text-secondary)]">Configura tus tiendas para importar pedidos automáticamente.</p>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Shopify Card */}
                <div className="bg-[var(--background-secondary)] shadow-md rounded-lg border border-[var(--border-primary)] flex flex-col overflow-hidden">
                    <div className="bg-green-600 p-4 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <IconShopify className="w-8 h-8" />
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tighter leading-none">Shopify</h3>
                                <p className="text-[10px] text-green-100 font-bold uppercase tracking-widest mt-0.5">Integración Oficial</p>
                            </div>
                        </div>
                    </div>
                    {/* Tab Navigation */}
                    <div className="flex bg-[var(--background-muted)] border-b border-[var(--border-primary)]">
                        {[
                            { id: 'connect', label: 'Conexión', icon: <IconShopify className="w-4 h-4" /> },
                            { id: 'sync', label: 'Automatización', icon: <IconLoader className="w-4 h-4" /> },
                            { id: 'manual', label: 'Ayuda', icon: <IconPlugConnected className="w-4 h-4" /> }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setShopifyActiveTab(tab.id as any)}
                                className={`flex-1 py-3 px-2 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                                    shopifyActiveTab === tab.id 
                                    ? 'bg-[var(--background-secondary)] text-green-600 border-b-2 border-green-600' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)]/50'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 flex-1 flex flex-col min-h-[380px]">
                        {shopifyActiveTab === 'connect' && (
                            <div className="animate-fade-in-up space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">URL de la Tienda</label>
                                        <input
                                            type="text"
                                            name="shopifyShopUrl"
                                            value={settings.shopifyShopUrl}
                                            onChange={handleChange}
                                            className={inputClasses}
                                            placeholder="ejemplo.myshopify.com"
                                            autoComplete="off"
                                        />
                                    </div>
                                    
                                    {!settings.shopifyAccessToken && (
                                        <div className="p-5 bg-green-50 border border-green-100 rounded-xl flex flex-col gap-4">
                                            <p className="text-[12px] text-green-800 font-bold leading-relaxed">
                                                Autoriza nuestra aplicación para importar tus pedidos automáticamente.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleConnectShopify}
                                                disabled={!settings.shopifyShopUrl}
                                                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-black rounded-lg shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                            >
                                                <IconShopify className="w-5 h-5 text-white" />
                                                Conectar con Shopify
                                            </button>
                                        </div>
                                    )}
                                    
                                    {settings.shopifyAccessToken && (
                                        <div className="space-y-4">
                                            <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
                                                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                                                    <IconCheckCircle className="w-5 h-5"/>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-green-800">Tienda Conectada</p>
                                                    <p className="text-xs text-green-600">La conexión por OAuth está activa.</p>
                                                </div>
                                            </div>

                                            <div className="relative pt-4 border-t border-gray-100">
                                                <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-tighter">Token de Acceso (Backup)</label>
                                                <div className="relative">
                                                    <input
                                                        type={passwordVisibility.shopifyAccessToken ? 'text' : 'password'}
                                                        name="shopifyAccessToken"
                                                        value={settings.shopifyAccessToken || ''}
                                                        onChange={handleChange}
                                                        className={`${inputClasses} bg-gray-50 opacity-70`}
                                                        placeholder="shpat_xxxxxxxxxxxxxxxx"
                                                        readOnly
                                                    />
                                                    <button type="button" onClick={() => togglePasswordVisibility('shopifyAccessToken')} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                                        {passwordVisibility.shopifyAccessToken ? <IconEyeOff className="h-5 w-5 text-gray-400"/> : <IconEye className="h-5 w-5 text-gray-400"/>}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {shopifyActiveTab === 'sync' && (
                            <div className="animate-fade-in-up space-y-6">
                                <div className="flex items-center justify-between p-4 bg-green-50/50 border border-green-100 rounded-xl">
                                    <div>
                                        <h4 className="text-[14px] font-black text-green-900 uppercase tracking-tight">Importación Automática</h4>
                                        <p className="text-[12px] text-green-700 font-medium">Extraer pedidos nuevos cada ciclo.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="shopifyAutoImport"
                                            checked={settings.shopifyAutoImport}
                                            onChange={handleChange}
                                            className="sr-only peer"
                                        />
                                        <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 shadow-inner"></div>
                                    </label>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <label className="block text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest">Frecuencia de Sincronización</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[5, 15, 30, 60].map((interval) => (
                                            <button
                                                key={interval}
                                                type="button"
                                                onClick={() => setSettings(prev => ({ ...prev, shopifySyncInterval: interval }))}
                                                className={`py-2.5 text-[13px] font-black rounded-lg border transition-all ${
                                                    settings.shopifySyncInterval === interval 
                                                    ? 'bg-green-600 text-white border-green-600 shadow-md' 
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-green-300 hover:text-green-600'
                                                }`}
                                            >
                                                {interval}m
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                                    <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white font-black text-[10px]">!</div>
                                    <p className="text-[11px] text-amber-800 font-bold leading-tight uppercase opacity-80 tracking-tight">
                                        Solo se importan pedidos con estado <span className="underline decoration-2 decoration-amber-400">Pagado</span> y entregas en la <span className="text-amber-950 font-black">Región Metropolitana</span>.
                                    </p>
                                </div>
                            </div>
                        )}

                        {shopifyActiveTab === 'manual' && (
                            <div className="animate-fade-in-up space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                <a 
                                    href="/manuals/shopify_guide.html" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block p-4 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md transition-all transform hover:scale-[1.02] active:scale-95 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white/20 rounded-lg">
                                                <IconShopify className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-[14px] font-black uppercase tracking-tight">Descargar Guía Shopify</h4>
                                                <p className="text-[11px] text-green-100 font-medium">Manual paso a paso en PDF</p>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                            <span className="text-xl">↓</span>
                                        </div>
                                    </div>
                                </a>

                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <h4 className="text-[12px] font-black text-gray-800 uppercase mb-3 tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        Guía de Configuración
                                    </h4>
                                    <ol className="text-[12px] text-gray-600 space-y-3 font-medium">
                                        <li className="flex gap-2"><span className="text-green-600 font-black">1.</span> En Shopify, ve a <b>Apps &gt; Desarrollar apps</b>.</li>
                                        <li className="flex gap-2"><span className="text-green-600 font-black">2.</span> Crea una app y configura los <b>Admin API Scopes</b>.</li>
                                        <li className="flex gap-2"><span className="text-green-600 font-black">3.</span> Habilita <b>read_orders</b>, <b>read_products</b> y <b>read_inventory</b>.</li>
                                        <li className="flex gap-2"><span className="text-green-600 font-black">4.</span> Instala la app y obtén el <b>Admin API Token</b> (shpat_...).</li>
                                    </ol>
                                </div>
                                
                                <div className="p-4 border border-dashed border-gray-200 rounded-xl">
                                    <p className="text-[11px] text-gray-500 italic font-medium">
                                        ¿Necesitas una conexión manual avanzada? <br/>
                                        <span className="text-green-600 not-italic font-bold">Usa el token en la pestaña de Conexión.</span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-gray-50/50 border-t border-[var(--border-primary)] flex justify-between items-center">
                        <button
                            type="button"
                            onClick={handleTestShopify}
                            disabled={isTestingShopify || !settings.shopifyAccessToken}
                            className="px-4 py-2 border border-[var(--border-secondary)] bg-white text-[var(--target-text-muted)] hover:bg-[var(--background-muted)] text-[10px] font-black uppercase tracking-widest rounded-md shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all"
                        >
                            {isTestingShopify ? <IconLoader className="w-3 h-3 animate-spin" /> : <IconPlugConnected className="w-3 h-3 text-green-600" />}
                            Test
                        </button>
                        <button
                            onClick={() => handleSave('shopify')}
                            disabled={isSaving}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-black uppercase tracking-widest rounded-md shadow-lg disabled:opacity-50 transition-all transform active:scale-95 flex items-center gap-2"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>

                {/* WooCommerce Card */}
                <div className="bg-[var(--background-secondary)] shadow-md rounded-lg border border-[var(--border-primary)] flex flex-col overflow-hidden">
                    <div className="bg-purple-600 p-4 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <IconWoocommerce className="w-8 h-8" />
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tighter leading-none">WooCommerce</h3>
                                <p className="text-[10px] text-purple-100 font-bold uppercase tracking-widest mt-0.5">Tienda WordPress</p>
                            </div>
                        </div>
                    </div>
                    {/* Tab Navigation */}
                    <div className="flex bg-[var(--background-muted)] border-b border-[var(--border-primary)]">
                        {[
                            { id: 'connect', label: 'Conexión', icon: <IconWoocommerce className="w-4 h-4" /> },
                            { id: 'sync', label: 'Automatización', icon: <IconLoader className="w-4 h-4" /> },
                            { id: 'manual', label: 'Ayuda', icon: <IconPlugConnected className="w-4 h-4" /> }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setWooActiveTab(tab.id as any)}
                                className={`flex-1 py-3 px-2 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                                    wooActiveTab === tab.id 
                                    ? 'bg-[var(--background-secondary)] text-purple-600 border-b-2 border-purple-600' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)]/50'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 flex-1 flex flex-col min-h-[380px]">
                        {wooActiveTab === 'connect' && (
                            <div className="animate-fade-in-up space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">URL de la Tienda</label>
                                    <input
                                        type="text"
                                        name="wooUrl"
                                        value={settings.wooUrl}
                                        onChange={handleChange}
                                        className={inputClasses}
                                        placeholder="https://mitienda.com"
                                        autoComplete="off"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Consumer Key</label>
                                    <input
                                        type="text"
                                        name="wooConsumerKey"
                                        value={settings.wooConsumerKey}
                                        onChange={handleChange}
                                        className={inputClasses}
                                        placeholder="ck_xxxxxxxxxxxxxxxx"
                                        autoComplete="off"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Consumer Secret</label>
                                    <div className="relative">
                                        <input
                                            type={passwordVisibility.wooConsumerSecret ? 'text' : 'password'}
                                            name="wooConsumerSecret"
                                            value={settings.wooConsumerSecret}
                                            onChange={handleChange}
                                            className={inputClasses}
                                            placeholder="cs_xxxxxxxxxxxxxxxx"
                                            autoComplete="new-password"
                                        />
                                        <button type="button" onClick={() => togglePasswordVisibility('wooConsumerSecret')} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                            {passwordVisibility.wooConsumerSecret ? <IconEyeOff className="h-5 w-5 text-gray-400"/> : <IconEye className="h-5 w-5 text-gray-400"/>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {wooActiveTab === 'sync' && (
                            <div className="animate-fade-in-up space-y-6">
                                <div className="flex items-center justify-between p-4 bg-purple-50/50 border border-purple-100 rounded-xl">
                                    <div>
                                        <h4 className="text-[14px] font-black text-purple-900 uppercase tracking-tight">Importación Automática</h4>
                                        <p className="text-[12px] text-purple-700 font-medium">Sincronizar pedidos cada ciclo.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="wooAutoImport"
                                            checked={settings.wooAutoImport}
                                            onChange={handleChange}
                                            className="sr-only peer"
                                        />
                                        <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 shadow-inner"></div>
                                    </label>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <label className="block text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest">Frecuencia de Sincronización</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[5, 15, 30, 60].map((interval) => (
                                            <button
                                                key={interval}
                                                type="button"
                                                onClick={() => setSettings(prev => ({ ...prev, wooSyncInterval: interval }))}
                                                className={`py-2.5 text-[13px] font-black rounded-lg border transition-all ${
                                                    settings.wooSyncInterval === interval 
                                                    ? 'bg-purple-600 text-white border-purple-600 shadow-md' 
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300 hover:text-purple-600'
                                                }`}
                                            >
                                                {interval}m
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                                    <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white font-black text-[10px]">!</div>
                                    <p className="text-[11px] text-amber-800 font-bold leading-tight uppercase opacity-80 tracking-tight">
                                        La API REST de WooCommerce debe estar activa. Solo se importan pedidos con estado <span className="underline decoration-2 decoration-amber-400">Procesando</span>.
                                    </p>
                                </div>
                            </div>
                        )}

                        {wooActiveTab === 'manual' && (
                            <div className="animate-fade-in-up space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                <a 
                                    href="/manuals/woocommerce_guide.html" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md transition-all transform hover:scale-[1.02] active:scale-95 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white/20 rounded-lg">
                                                <IconWoocommerce className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-[14px] font-black uppercase tracking-tight">Descargar Guía Woo</h4>
                                                <p className="text-[11px] text-purple-100 font-medium">Manual de configuración REST API</p>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                            <span className="text-xl">↓</span>
                                        </div>
                                    </div>
                                </a>

                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <h4 className="text-[12px] font-black text-gray-800 uppercase mb-3 tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                        Guía WooCommerce
                                    </h4>
                                    <ol className="text-[12px] text-gray-600 space-y-3 font-medium">
                                        <li className="flex gap-2"><span className="text-purple-600 font-black">1.</span> Ve a <b>WooCommerce &gt; Ajustes &gt; Avanzado &gt; REST API</b>.</li>
                                        <li className="flex gap-2"><span className="text-purple-600 font-black">2.</span> Crea una clave con permisos de <b>Lectura/Escritura</b>.</li>
                                        <li className="flex gap-2"><span className="text-purple-600 font-black">3.</span> Copia el <b>Consumer Key</b> y el <b>Consumer Secret</b> aquí.</li>
                                        <li className="flex gap-2"><span className="text-purple-600 font-black">4.</span> **IMPORTANTE**: Ve a <b>Ajustes &gt; Enlaces permanentes</b> y no uses el modo "Simple".</li>
                                    </ol>
                                </div>
                                
                                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                                    <p className="text-[11px] text-purple-800 font-bold leading-tight uppercase tracking-tight">
                                        Requiere HTTPS Activo en tu tienda para una conexión segura.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-gray-50/50 border-t border-[var(--border-primary)] flex justify-between items-center">
                        <button
                            type="button"
                            onClick={handleTestWoo}
                            disabled={isTestingWoo || !settings.wooUrl || !settings.wooConsumerKey || !settings.wooConsumerSecret}
                            className="px-4 py-2 border border-[var(--border-secondary)] bg-white text-[var(--target-text-muted)] hover:bg-[var(--background-muted)] text-[10px] font-black uppercase tracking-widest rounded-md shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all"
                        >
                            {isTestingWoo ? <IconLoader className="w-3 h-3 animate-spin" /> : <IconPlugConnected className="w-3 h-3 text-purple-600" />}
                            Test
                        </button>
                        <button
                            onClick={() => handleSave('woocommerce')}
                            disabled={isSaving}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-widest rounded-md shadow-lg disabled:opacity-50 transition-all transform active:scale-95 flex items-center gap-2"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>

                    {wooTestResult && wooActiveTab === 'connect' && (
                        <div className={`mx-4 mb-4 p-2.5 rounded-lg text-[11px] font-black uppercase tracking-tight ${wooTestResult.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            <div className="flex items-center gap-2">
                                {wooTestResult.type === 'success' ? <IconCheckCircle className="w-3 h-3" /> : <IconAlertTriangle className="w-3 h-3" />}
                                {wooTestResult.message}
                            </div>
                        </div>
                    )}
                </div>

                    {/* Tab Navigation */}
                    <div className="flex bg-[var(--background-muted)] border-b border-[var(--border-primary)]">
                        {[
                            { id: 'connect', label: 'Conexión', icon: <IconPlugConnected className="w-4 h-4" /> },
                            { id: 'sync', label: 'Automatización', icon: <IconLoader className="w-4 h-4" /> },
                            { id: 'manual', label: 'Ayuda', icon: <IconAlertTriangle className="w-4 h-4" /> }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setJumpsellerActiveTab(tab.id as any)}
                                className={`flex-1 py-3 px-2 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                                    jumpsellerActiveTab === tab.id 
                                    ? 'bg-[var(--background-secondary)] text-sky-600 border-b-2 border-sky-600' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)]/50'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 flex-1 flex flex-col min-h-[380px]">
                        
                        {jumpsellerActiveTab === 'connect' && (
                            <div className="space-y-4 animate-fade-in-up">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Login (Email del Usuario)</label>
                                    <input
                                        type="text"
                                        name="jumpsellerLogin"
                                        value={settings.jumpsellerLogin}
                                        onChange={handleChange}
                                        className={inputClasses}
                                        placeholder="usuario@tu-tienda.com"
                                        autoComplete="off"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">API Token</label>
                                    <div className="relative">
                                        <input
                                            type={passwordVisibility.jumpsellerToken ? 'text' : 'password'}
                                            name="jumpsellerToken"
                                            value={settings.jumpsellerToken}
                                            onChange={handleChange}
                                            className={inputClasses}
                                            placeholder="Token de Jumpseller"
                                            autoComplete="new-password"
                                        />
                                        <button type="button" onClick={() => togglePasswordVisibility('jumpsellerToken')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-muted)]">
                                            {passwordVisibility.jumpsellerToken ? <IconEyeOff className="h-5 w-5"/> : <IconEye className="h-5 w-5"/>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {jumpsellerActiveTab === 'sync' && (
                            <div className="space-y-5 animate-fade-in-up">
                                <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h5 className="text-[11px] font-black text-sky-950 uppercase tracking-widest">SINCRO AUTOMÁTICA</h5>
                                            <p className="text-[12px] text-sky-800 font-bold opacity-80">Importar pedidos cada ciertos minutos.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer" 
                                                checked={settings.jumpsellerAutoImport}
                                                onChange={(e) => setSettings(prev => ({ ...prev, jumpsellerAutoImport: e.target.checked }))}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 shadow-sm">
                                    <label className="block text-[10px] font-black text-sky-900 mb-3 uppercase tracking-widest opacity-70">TIEMPO DE REVISIÓN</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[5, 10, 30, 60].map((interval) => (
                                            <button
                                                key={interval}
                                                type="button"
                                                onClick={() => setSettings(prev => ({ ...prev, jumpsellerSyncInterval: interval }))}
                                                className={`py-2 text-[13px] font-black rounded-lg border transition-all ${
                                                    settings.jumpsellerSyncInterval === interval 
                                                    ? 'bg-sky-600 text-white border-sky-600 shadow-md transform scale-[1.02]' 
                                                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                {interval} min
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-cyan-100/50 border border-cyan-200 rounded-xl flex gap-3 shadow-sm">
                                    <div className="flex-shrink-0">
                                        <div className="w-6 h-6 bg-sky-600 rounded-full flex items-center justify-center text-white font-black text-xs ring-4 ring-cyan-100">!</div>
                                    </div>
                                    <div>
                                        <h5 className="text-[11px] font-black text-cyan-950 uppercase tracking-widest mb-1 opacity-90">RESTRICCIÓN RM</h5>
                                        <p className="text-[12px] text-cyan-900 leading-relaxed font-bold opacity-80">
                                            Se importarán pedidos en <span className="text-cyan-950 underline decoration-2 decoration-cyan-400">Paid/Ready</span> solo en la <span className="text-cyan-950">Región Metropolitana</span>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {jumpsellerActiveTab === 'manual' && (
                            <div className="animate-fade-in-up max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="prose prose-sm prose-sky">
                                    <h4 className="text-[13px] font-black text-sky-900 uppercase mb-2">¿Cómo obtener el API Token?</h4>
                                    <ol className="text-xs text-gray-700 space-y-2 list-decimal pl-4">
                                        <li>Entra a tu Store de **Jumpseller**.</li>
                                        <li>Ve a **Configuración** &rarr; **General**.</li>
                                        <li>Baja hasta la sección **API**.</li>
                                        <li>Copia el **API Token** mostrado allí.</li>
                                        <li>El **Login** es el email del administrador.</li>
                                    </ol>
                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <p className="text-[11px] text-amber-900 font-bold italic">
                                            Tip: Para recibir pedidos al instante, configura un Webhook a:
                                            <code className="block mt-1 bg-white p-1 rounded border border-amber-300 text-[10px] break-all">
                                                https://api.fullenvios.cl/api/integrations/jumpseller/webhook
                                            </code>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {jumpsellerTestResult && jumpsellerActiveTab === 'connect' && (
                            <div className={`mt-4 p-3 rounded-md text-sm ${jumpsellerTestResult.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                <div className="flex items-center gap-2">
                                    {jumpsellerTestResult.type === 'success' ? <IconCheckCircle className="w-4 h-4" /> : <IconAlertTriangle className="w-4 h-4" />}
                                    {jumpsellerTestResult.message}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-[var(--background-muted)] border-t border-[var(--border-primary)] flex justify-between items-center bg-opacity-50">
                        {jumpsellerActiveTab === 'connect' ? (
                            <button
                                onClick={handleTestJumpseller}
                                disabled={isTestingJumpseller || !settings.jumpsellerLogin || !settings.jumpsellerToken}
                                className="px-4 py-2 border border-[var(--border-secondary)] bg-white text-[var(--text-primary)] hover:bg-[var(--background-muted)] text-sm font-bold rounded-md shadow-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
                            >
                                {isTestingJumpseller ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconPlugConnected className="w-4 h-4 text-sky-600" />}
                                Probar Conexión
                            </button>
                        ) : (
                            <div></div>
                        )}
                        <button
                            onClick={() => handleSave('jumpseller')}
                            disabled={isSaving}
                            className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-md shadow-lg disabled:opacity-50 transition-all transform active:scale-95 flex items-center gap-2"
                        >
                            {isSaving && <IconLoader className="w-4 h-4 animate-spin" />}
                            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>

                {/* Falabella Card */}
                <div className="bg-[var(--background-secondary)] shadow-md rounded-lg border border-[var(--border-primary)] flex flex-col">
                    <div className="p-6 flex-1">
                        <div className="flex items-center gap-2 mb-4">
                            <IconFalabella className="w-6 h-6 text-orange-600" />
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Falabella / Linio</h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Seller ID</label>
                                <input
                                    type="text"
                                    name="falabellaSellerId"
                                    value={settings.falabellaSellerId}
                                    onChange={handleChange}
                                    className={inputClasses}
                                    placeholder="ID de Vendedor en Falabella"
                                    autoComplete="off"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">API Key</label>
                                <div className="relative">
                                    <input
                                        type={passwordVisibility.falabellaApiKey ? 'text' : 'password'}
                                        name="falabellaApiKey"
                                        value={settings.falabellaApiKey}
                                        onChange={handleChange}
                                        className={inputClasses}
                                        placeholder="API Key de Falabella / Linio"
                                        autoComplete="new-password"
                                    />
                                    <button type="button" onClick={() => togglePasswordVisibility('falabellaApiKey')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-muted)]">
                                        {passwordVisibility.falabellaApiKey ? <IconEyeOff className="h-5 w-5"/> : <IconEye className="h-5 w-5"/>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {falabellaTestResult && (
                            <div className={`mt-4 p-3 rounded-md text-sm ${falabellaTestResult.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                <div className="flex items-center gap-2">
                                    {falabellaTestResult.type === 'success' ? <IconCheckCircle className="w-4 h-4" /> : <IconAlertTriangle className="w-4 h-4" />}
                                    {falabellaTestResult.message}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-[var(--background-muted)] border-t border-[var(--border-primary)] flex justify-between items-center bg-opacity-50">
                        <button
                            onClick={handleTestFalabella}
                            disabled={isTestingFalabella || !settings.falabellaSellerId || !settings.falabellaApiKey}
                            className="px-4 py-2 border border-[var(--border-secondary)] bg-white text-[var(--text-primary)] hover:bg-[var(--background-muted)] text-sm font-bold rounded-md shadow-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
                        >
                            {isTestingFalabella ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconPlugConnected className="w-4 h-4 text-orange-600" />}
                            Probar Conexión
                        </button>
                        <button
                            onClick={() => handleSave('falabella')}
                            disabled={isSaving}
                            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-md shadow-lg disabled:opacity-50 transition-all transform active:scale-95"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>

            </div>

        </div>
    );
};

export default ClientSettingsPage;
