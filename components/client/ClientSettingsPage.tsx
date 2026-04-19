
import React, { useState, useEffect, useContext } from 'react';
import { api } from '../../services/api';
import { IconCheckCircle, IconLoader, IconAlertTriangle, IconPlugConnected, IconEye, IconEyeOff, IconShopify, IconWoocommerce, IconJumpseller } from '../Icon';
import { AuthContext } from '../../contexts/AuthContext';

const ClientSettingsPage: React.FC = () => {
    const auth = useContext(AuthContext);
    const [settings, setSettings] = useState({
        shopifyShopUrl: '',
        shopifyAccessToken: '',
        shopifyAutoImport: false,
        wooUrl: '',
        wooConsumerKey: '',
        wooConsumerSecret: '',
        jumpsellerLogin: '',
        jumpsellerToken: '',
    });
    const [passwordVisibility, setPasswordVisibility] = useState({
        shopifyAccessToken: false,
        wooConsumerSecret: false,
        jumpsellerToken: false,
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
                    wooUrl: integrations.woocommerce?.storeUrl || integrations.woocommerce?.wooUrl || '',
                    wooConsumerKey: integrations.woocommerce?.consumerKey || '',
                    wooConsumerSecret: integrations.woocommerce?.consumerSecret || '',
                    jumpsellerLogin: integrations.jumpseller?.login || '',
                    jumpsellerToken: integrations.jumpseller?.token || '',
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

    const handleSave = async (type: 'shopify' | 'woocommerce' | 'jumpseller') => {
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
                <div className="bg-[var(--background-secondary)] shadow-md rounded-lg border border-[var(--border-primary)] flex flex-col">
                    <div className="p-6 flex-1">
                        <div className="flex items-center gap-2 mb-4">
                            <IconShopify className="w-6 h-6 text-green-600" />
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Shopify</h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">URL de la Tienda</label>
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
                            
                            {settings.shopifyAccessToken ? (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-green-700">
                                        <IconCheckCircle className="w-5 h-5"/>
                                        <span className="font-semibold">Tienda Conectada Correctamente</span>
                                    </div>
                                    <p className="text-xs text-green-600">
                                        Tu tienda está autorizada. Puedes probar la conexión o activar la sincronización automática.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col gap-3">
                                    <p className="text-sm text-blue-800">
                                        Para importar tus pedidos, necesitas darle permiso a nuestra aplicación en tu tienda Shopify.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleConnectShopify}
                                        disabled={!settings.shopifyShopUrl}
                                        className="w-full py-2 bg-[#95bf47] hover:bg-[#86ac40] text-white text-sm font-bold rounded-md shadow-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <IconShopify className="w-5 h-5 text-white" />
                                        Conectar automáticamente
                                    </button>
                                </div>
                            )}

                            <div className="pt-4 border-t border-[var(--border-primary)]">
                                <label className="block text-sm font-bold text-[var(--text-primary)] mb-1">💡 Conexión Manual / Token Avanzado</label>
                                <p className="text-xs text-[var(--text-secondary)] mb-2">
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
                            </div>


                            <div className="pt-4 border-t border-[var(--border-primary)]">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <h4 className="text-sm font-bold text-[var(--text-primary)]">Sincronización Automática</h4>
                                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                            Importa tus pedidos pagados cada 5 minutos.
                                        </p>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            name="shopifyAutoImport"
                                            checked={settings.shopifyAutoImport}
                                            onChange={handleChange}
                                            className="sr-only peer"
                                        />
                                        <div className="w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-green-500 transition-all duration-300 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-6"></div>
                                    </div>
                                </label>
                            </div>

                            <div className="p-4 bg-[var(--brand-muted)] border border-[var(--brand-secondary)] rounded-lg shadow-sm">
                                <div className="flex gap-3">
                                    <div className="bg-[var(--brand-primary)] p-1.5 rounded-full flex-shrink-0 h-fit mt-0.5">
                                        <IconAlertTriangle className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[var(--brand-text)] mb-1 uppercase tracking-wider">Restricción de Importación</p>
                                        <p className="text-xs text-[var(--brand-text)] opacity-90 leading-relaxed font-medium">
                                            La sincronización automática está <strong>limitada exclusivamente</strong> a la <strong>Región Metropolitana</strong> (Santiago). Los pedidos a otras regiones deben ingresarse de forma manual.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {shopifyTestResult && (
                            <div className={`mt-4 p-3 rounded-md text-sm ${shopifyTestResult.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                <div className="flex items-center gap-2">
                                    {shopifyTestResult.type === 'success' ? <IconCheckCircle className="w-4 h-4" /> : <IconAlertTriangle className="w-4 h-4" />}
                                    {shopifyTestResult.message}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-[var(--background-muted)] border-t border-[var(--border-primary)] flex justify-between items-center bg-opacity-50">
                        <button
                            onClick={handleTestShopify}
                            disabled={isTestingShopify || !settings.shopifyShopUrl || !settings.shopifyAccessToken}
                            className="px-4 py-2 border border-[var(--border-secondary)] bg-white text-[var(--text-primary)] hover:bg-[var(--background-muted)] text-sm font-bold rounded-md shadow-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
                        >
                            {isTestingShopify ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconPlugConnected className="w-4 h-4 text-[var(--brand-primary)]" />}
                            Probar Conexión
                        </button>
                        <button
                            onClick={() => handleSave('shopify')}
                            disabled={isSaving}
                            className="px-6 py-2 bg-[var(--success-text)] hover:opacity-90 text-white text-sm font-bold rounded-md shadow-lg disabled:opacity-50 transition-all transform active:scale-95"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
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

            </div>

        </div>
    );
};

export default ClientSettingsPage;
