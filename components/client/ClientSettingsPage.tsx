
import React, { useState, useEffect, useContext } from 'react';
import { api } from '../../services/api';
import { IconCheckCircle, IconLoader, IconAlertTriangle, IconPlugConnected, IconEye, IconEyeOff, IconShopify, IconWoocommerce } from '../Icon';
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
    });
    const [passwordVisibility, setPasswordVisibility] = useState({
        shopifyAccessToken: false,
        wooConsumerSecret: false,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Test States
    const [isTestingShopify, setIsTestingShopify] = useState(false);
    const [shopifyTestResult, setShopifyTestResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [isTestingWoo, setIsTestingWoo] = useState(false);
    const [wooTestResult, setWooTestResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);

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

    const handleSave = async (type: 'shopify' | 'woocommerce') => {
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
            } else {
                updatedIntegrations.woocommerce = {
                    wooUrl: settings.wooUrl,
                    wooConsumerKey: settings.wooConsumerKey,
                    wooConsumerSecret: settings.wooConsumerSecret,
                };
            }

            await api.updateUser(auth.user.id, { integrations: updatedIntegrations });
            await auth.refetchUser();
            alert(`Configuración de ${type === 'shopify' ? 'Shopify' : 'WooCommerce'} guardada con éxito.`);
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
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Admin API Access Token</label>
                                <div className="relative">
                                    <input
                                        type={passwordVisibility.shopifyAccessToken ? 'text' : 'password'}
                                        name="shopifyAccessToken"
                                        value={settings.shopifyAccessToken}
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
                                        <h4 className="text-sm font-semibold text-[var(--text-secondary)]">Importación Automática</h4>
                                        <p className="text-[10px] text-[var(--text-muted)] mt-1 max-w-[200px]">
                                            Sincroniza tus pedidos pagados automáticamente cada 5 minutos.
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
                                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-[var(--brand-secondary)] dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--brand-primary)]"></div>
                                    </div>
                                </label>
                            </div>

                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                                <div className="flex gap-2">
                                    <IconAlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-amber-800 dark:text-amber-300">
                                        <strong>Nota:</strong> Solo se importarán automáticamente los paquetes con destino en la <strong>Región Metropolitana</strong> (Santiago). Los pedidos a otras regiones deben ingresarse manualmente.
                                    </p>
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
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-[var(--border-primary)] flex justify-between items-center">
                        <button
                            onClick={handleTestShopify}
                            disabled={isTestingShopify || !settings.shopifyShopUrl || !settings.shopifyAccessToken}
                            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--brand-primary)] disabled:opacity-50 flex items-center gap-2"
                        >
                            {isTestingShopify ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconPlugConnected className="w-4 h-4" />}
                            Probar
                        </button>
                        <button
                            onClick={() => handleSave('shopify')}
                            disabled={isSaving}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md shadow-sm disabled:opacity-50"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar Shopify'}
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
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-[var(--border-primary)] flex justify-between items-center">
                        <button
                            onClick={handleTestWoo}
                            disabled={isTestingWoo || !settings.wooUrl || !settings.wooConsumerKey || !settings.wooConsumerSecret}
                            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--brand-primary)] disabled:opacity-50 flex items-center gap-2"
                        >
                            {isTestingWoo ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconPlugConnected className="w-4 h-4" />}
                            Probar
                        </button>
                        <button
                            onClick={() => handleSave('woocommerce')}
                            disabled={isSaving}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md shadow-sm disabled:opacity-50"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar WooCommerce'}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ClientSettingsPage;
