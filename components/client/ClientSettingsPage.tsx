
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
        jumpsellerLogin: '',
        jumpsellerToken: '',
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
    const [shopifyActiveTab, setShopifyActiveTab] = useState<'connect' | 'manual' | 'sync'>('connect');

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
                    wooConsumerKey: integrations.woocommerce?.consumerKey || '',
                    wooConsumerSecret: integrations.woocommerce?.consumerSecret || '',
                    jumpsellerLogin: integrations.jumpseller?.login || '',
                    jumpsellerToken: integrations.jumpseller?.token || '',
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
                };
            } else if (type === 'jumpseller') {
                updatedIntegrations.jumpseller = {
                    login: settings.jumpsellerLogin,
                    token: settings.jumpsellerToken,
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
                    {/* Tab Navigation */}
                    <div className="flex bg-[var(--background-muted)] border-b border-[var(--border-primary)]">
                        {[
                            { id: 'connect', label: 'Conexión', icon: <IconShopify className="w-4 h-4" /> },
                            { id: 'manual', label: 'Modo Manual', icon: <IconPlugConnected className="w-4 h-4" /> },
                            { id: 'sync', label: 'Sincronización', icon: <IconLoader className="w-4 h-4" /> }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setShopifyActiveTab(tab.id as any)}
                                className={`flex-1 py-3 px-2 text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    shopifyActiveTab === tab.id 
                                    ? 'bg-[var(--background-secondary)] text-[var(--brand-primary)] border-b-2 border-[var(--brand-primary)]' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)]/50'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 flex-1 flex flex-col min-h-[350px]">
                        {shopifyActiveTab === 'connect' && (
                            <div className="animate-fade-in space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <IconShopify className="w-6 h-6 text-green-600" />
                                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Shopify</h3>
                                </div>
                                
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
                                    
                                    <div className="p-5 bg-sky-50/50 border border-sky-100 rounded-xl flex flex-col gap-4">
                                        <p className="text-[13px] text-sky-800 font-medium leading-relaxed">
                                            Para importar tus pedidos, necesitas darle permiso a nuestra aplicación en tu tienda Shopify.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleConnectShopify}
                                            disabled={!settings.shopifyShopUrl}
                                            className="w-full py-2.5 bg-[#b5d691] hover:bg-[#a5c681] text-white text-sm font-black rounded-lg shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                        >
                                            <IconShopify className="w-5 h-5 text-white" />
                                            Conectar automáticamente
                                        </button>
                                    </div>
                                    
                                    {settings.shopifyAccessToken && (
                                        <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
                                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                                                <IconCheckCircle className="w-5 h-5"/>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-green-800">Tienda Conectada</p>
                                                <p className="text-xs text-green-600">Conexión establecida correctamente.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {shopifyActiveTab === 'manual' && (
                            <div className="animate-fade-in space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-white text-[10px]">💡</div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Conexión Manual / Token Avanzado</h3>
                                </div>
                                
                                <div className="space-y-4">
                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
                                        Si el botón verde falla, o si tu tienda usa una App Privada, puedes pegar tu token (shpat_) aquí. Borra este cuadro si quieres desconectar la tienda.
                                    </p>
                                    
                                    <div className="relative">
                                        <input
                                            type={passwordVisibility.shopifyAccessToken ? 'text' : 'password'}
                                            name="shopifyAccessToken"
                                            value={settings.shopifyAccessToken || ''}
                                            onChange={handleChange}
                                            className={inputClasses}
                                            placeholder="shpat_xxxxxxxxxxxxxxxx"
                                            autoComplete="new-password"
                                        />
                                        <button type="button" onClick={() => togglePasswordVisibility('shopifyAccessToken')} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                            {passwordVisibility.shopifyAccessToken ? <IconEyeOff className="h-5 w-5 text-gray-400"/> : <IconEye className="h-5 w-5 text-gray-400"/>}
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleTestShopify}
                                        disabled={isTestingShopify || !settings.shopifyAccessToken}
                                        className="w-full py-2.5 bg-white border border-[var(--border-secondary)] hover:bg-[var(--background-muted)] text-[var(--text-primary)] text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        {isTestingShopify ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconPlugConnected className="w-4 h-4 text-green-600" />}
                                        Probar Conexión Manual
                                    </button>

                                    {shopifyTestResult && (
                                        <div className={`mt-2 p-3 rounded-lg text-sm font-medium border ${shopifyTestResult.type === 'success' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                                            <div className="flex items-center gap-2">
                                                {shopifyTestResult.type === 'success' ? <IconCheckCircle className="w-4 h-4" /> : <IconAlertTriangle className="w-4 h-4" />}
                                                {shopifyTestResult.message}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {shopifyActiveTab === 'sync' && (
                            <div className="animate-fade-in space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-[15px] font-black text-sky-900">Sincronización Automática</h4>
                                        <p className="text-[12px] text-sky-700 font-medium">
                                            Importa tus pedidos pagados automáticamente.
                                        </p>
                                    </div>
                                    <div className="relative">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                name="shopifyAutoImport"
                                                checked={settings.shopifyAutoImport}
                                                onChange={handleChange}
                                                className="sr-only peer"
                                            />
                                            <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 shadow-inner"></div>
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 shadow-sm">
                                    <label className="block text-[10px] font-black text-sky-900 mb-3 uppercase tracking-widest opacity-70">TIEMPO DE REVISIÓN</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[5, 15, 30, 60].map((interval) => (
                                            <button
                                                key={interval}
                                                type="button"
                                                onClick={() => setSettings(prev => ({ ...prev, shopifySyncInterval: interval }))}
                                                className={`py-2 text-[13px] font-black rounded-lg border transition-all ${
                                                    settings.shopifySyncInterval === interval 
                                                    ? 'bg-[#008ba3] text-white border-[#008ba3] shadow-md transform scale-[1.02]' 
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
                                        <div className="w-6 h-6 bg-[#008ba3] rounded-full flex items-center justify-center text-white font-black text-xs ring-4 ring-cyan-100">!</div>
                                    </div>
                                    <div>
                                        <h5 className="text-[11px] font-black text-cyan-950 uppercase tracking-widest mb-1 opacity-90">RESTRICCIÓN DE IMPORTACIÓN</h5>
                                        <p className="text-[12px] text-cyan-900 leading-relaxed font-bold opacity-80">
                                            La sincronización automática está <span className="text-cyan-950 underline decoration-2 decoration-cyan-400">limitada exclusivamente</span> a la <span className="text-cyan-950">Región Metropolitana (Santiago)</span>. 
                                            Los pedidos a otras regiones deben ingresarse de forma manual.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-[var(--background-muted)]/50 border-t border-[var(--border-primary)] flex justify-end items-center">
                        <button
                            onClick={() => handleSave('shopify')}
                            disabled={isSaving}
                            className="px-8 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-black rounded-lg shadow-lg disabled:opacity-50 transition-all transform active:scale-95 flex items-center gap-2"
                        >
                            {isSaving && <IconLoader className="w-4 h-4 animate-spin" />}
                            Guardar Configuración
                        </button>
                    </div>
                </div>

                {/* WooCommerce Card */}
                <div className="bg-[var(--background-secondary)] shadow-md rounded-lg border border-[var(--border-primary)] flex flex-col">
                    <div className="p-6 flex-1">
                        <div className="flex items-center gap-2 mb-4">
                            <IconWoocommerce className="w-6 h-6 text-purple-600" />
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">WooCommerce</h3>
                        </div>
                        
                        <div className="space-y-4">
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

                        {wooTestResult && (
                            <div className={`mt-4 p-3 rounded-md text-sm ${wooTestResult.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                <div className="flex items-center gap-2">
                                    {wooTestResult.type === 'success' ? <IconCheckCircle className="w-4 h-4" /> : <IconAlertTriangle className="w-4 h-4" />}
                                    {wooTestResult.message}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-[var(--background-muted)] border-t border-[var(--border-primary)] flex justify-between items-center bg-opacity-50">
                        <button
                            onClick={handleTestWoo}
                            disabled={isTestingWoo || !settings.wooUrl || !settings.wooConsumerKey || !settings.wooConsumerSecret}
                            className="px-4 py-2 border border-[var(--border-secondary)] bg-white text-[var(--text-primary)] hover:bg-[var(--background-muted)] text-sm font-bold rounded-md shadow-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
                        >
                            {isTestingWoo ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconPlugConnected className="w-4 h-4 text-purple-600" />}
                            Probar Conexión
                        </button>
                        <button
                            onClick={() => handleSave('woocommerce')}
                            disabled={isSaving}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-md shadow-lg disabled:opacity-50 transition-all transform active:scale-95"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>

                {/* Jumpseller Card */}
                <div className="bg-[var(--background-secondary)] shadow-md rounded-lg border border-[var(--border-primary)] flex flex-col">
                    <div className="p-6 flex-1">
                        <div className="flex items-center gap-2 mb-4">
                            <IconJumpseller className="w-6 h-6 text-sky-600" />
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Jumpseller</h3>
                        </div>
                        
                        <div className="space-y-4">
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

                        {jumpsellerTestResult && (
                            <div className={`mt-4 p-3 rounded-md text-sm ${jumpsellerTestResult.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                <div className="flex items-center gap-2">
                                    {jumpsellerTestResult.type === 'success' ? <IconCheckCircle className="w-4 h-4" /> : <IconAlertTriangle className="w-4 h-4" />}
                                    {jumpsellerTestResult.message}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-[var(--background-muted)] border-t border-[var(--border-primary)] flex justify-between items-center bg-opacity-50">
                        <button
                            onClick={handleTestJumpseller}
                            disabled={isTestingJumpseller || !settings.jumpsellerLogin || !settings.jumpsellerToken}
                            className="px-4 py-2 border border-[var(--border-secondary)] bg-white text-[var(--text-primary)] hover:bg-[var(--background-muted)] text-sm font-bold rounded-md shadow-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
                        >
                            {isTestingJumpseller ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconPlugConnected className="w-4 h-4 text-sky-600" />}
                            Probar Conexión
                        </button>
                        <button
                            onClick={() => handleSave('jumpseller')}
                            disabled={isSaving}
                            className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-md shadow-lg disabled:opacity-50 transition-all transform active:scale-95"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
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
