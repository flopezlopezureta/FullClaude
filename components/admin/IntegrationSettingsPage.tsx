
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { IntegrationSettings } from '../../types';
import { IconCheckCircle, IconLoader, IconAlertTriangle, IconPlugConnected, IconEye, IconEyeOff, IconShopify, IconMercadoLibre } from '../Icon';

const IntegrationSettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<Partial<IntegrationSettings>>({
        meliAppId: '',
        meliClientSecret: '',
        shopifyShopUrl: '',
        shopifyAccessToken: '',
    });
    const [passwordVisibility, setPasswordVisibility] = useState({
        meliClientSecret: false,
        shopifyAccessToken: false,
    });
    const [isLoading, setIsLoading] = useState(true);
    
    // Independent Loading States
    const [isSavingMeli, setIsSavingMeli] = useState(false);
    const [isSavingShopify, setIsSavingShopify] = useState(false);
    
    // Meli Test State
    const [isTestingMeli, setIsTestingMeli] = useState(false);
    const [meliTestResult, setMeliTestResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [meliDebugLog, setMeliDebugLog] = useState<string[]>([]);

    // Shopify Test State
    const [isTestingShopify, setIsTestingShopify] = useState(false);
    const [shopifyTestResult, setShopifyTestResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const fetchedSettings = await api.getIntegrationSettings();
                setSettings(prev => ({
                    ...prev,
                    ...fetchedSettings
                }));
            } catch (err: any) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const togglePasswordVisibility = (key: keyof typeof passwordVisibility) => {
        setPasswordVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSaveMeli = async () => {
        setIsSavingMeli(true);
        setMeliTestResult(null);
        try {
            await api.updateIntegrationSettings({
                meliAppId: settings.meliAppId,
                meliClientSecret: settings.meliClientSecret
            });
            alert('Configuración de Mercado Libre guardada con éxito.');
        } catch (err: any) {
            alert('Error al guardar configuración de Mercado Libre.');
        } finally {
            setIsSavingMeli(false);
        }
    };

    const handleSaveShopify = async () => {
        setIsSavingShopify(true);
        setShopifyTestResult(null);
        try {
            await api.updateIntegrationSettings({
                shopifyShopUrl: settings.shopifyShopUrl,
                shopifyAccessToken: settings.shopifyAccessToken
            });
            alert('Configuración de Shopify guardada con éxito.');
        } catch (err: any) {
            alert('Error al guardar configuración de Shopify.');
        } finally {
            setIsSavingShopify(false);
        }
    };

    const handleTestMeliConnection = async () => {
        setIsTestingMeli(true);
        setMeliTestResult(null);
        setMeliDebugLog(['[1/4] Iniciando prueba de conexión...']);

        try {
            const appId = settings.meliAppId || '';
            const clientSecret = settings.meliClientSecret || '';

            await new Promise(resolve => setTimeout(resolve, 300));
            setMeliDebugLog(prev => [...prev, `[2/4] Credenciales enviadas...`]);
            
            await new Promise(resolve => setTimeout(resolve, 500));
            setMeliDebugLog(prev => [...prev, '[3/4] Contactando a la API de Mercado Libre...']);

            const result = await api.testMeliConnection({ 
                meliAppId: appId, 
                meliClientSecret: clientSecret 
            });
            
            await new Promise(resolve => setTimeout(resolve, 300));
            setMeliDebugLog(prev => [...prev, '[4/4] ✅ Conexión exitosa.']);
            setMeliTestResult({ type: 'success', message: result.message });

        } catch (err: any) {
            const errorMessage = err.message || 'Error de conexión desconocido.';
            await new Promise(resolve => setTimeout(resolve, 300));
            setMeliDebugLog(prev => [...prev, `[4/4] ❌ Error: ${errorMessage}`]);
            setMeliTestResult({ type: 'error', message: errorMessage });
        } finally {
            setIsTestingMeli(false);
        }
    };

    const handleTestShopifyConnection = async () => {
        setIsTestingShopify(true);
        setShopifyTestResult(null);

        try {
            const response = await fetch('/api/integrations/test/shopify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    shopifyShopUrl: settings.shopifyShopUrl,
                    shopifyAccessToken: settings.shopifyAccessToken
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                setShopifyTestResult({ type: 'success', message: result.message });
            } else {
                throw new Error(result.message || 'Error de conexión');
            }

        } catch (err: any) {
            setShopifyTestResult({ type: 'error', message: err.message });
        } finally {
            setIsTestingShopify(false);
        }
    };
    
    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

    if (isLoading) {
        return <div className="text-center p-8 text-[var(--text-muted)]">Cargando configuración...</div>;
    }

    return (
        <div className="max-w-3xl space-y-8 pb-12">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Configuración de Integraciones</h1>

            {/* Mercado Libre Card */}
            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg border border-[var(--border-primary)]">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <IconMercadoLibre className="w-6 h-6 text-yellow-500" />
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Mercado Libre</h3>
                        </div>
                        <button
                            onClick={handleSaveMeli}
                            disabled={isSavingMeli}
                            className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-500 hover:bg-yellow-600 disabled:bg-slate-400 transition-colors"
                        >
                            {isSavingMeli ? <IconLoader className="w-4 h-4 mr-2 animate-spin"/> : <IconCheckCircle className="w-4 h-4 mr-2"/>}
                            Guardar ML
                        </button>
                    </div>
                    
                    <p className="text-sm text-[var(--text-muted)] mb-4">Credenciales globales para la API de Mercado Libre.</p>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="meliAppId" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">App ID</label>
                            <input
                                type="text"
                                id="meliAppId"
                                name="meliAppId"
                                value={settings.meliAppId || ''}
                                onChange={handleChange}
                                className={inputClasses}
                                placeholder="Ej: 1234567890123456"
                            />
                        </div>
                        <div>
                            <label htmlFor="meliClientSecret" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Client Secret</label>
                            <div className="relative">
                                <input
                                    type={passwordVisibility.meliClientSecret ? 'text' : 'password'}
                                    id="meliClientSecret"
                                    name="meliClientSecret"
                                    value={settings.meliClientSecret || ''}
                                    onChange={handleChange}
                                    className={`${inputClasses} pr-10`}
                                    placeholder="************************"
                                />
                                <button type="button" onClick={() => togglePasswordVisibility('meliClientSecret')} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    {passwordVisibility.meliClientSecret ? <IconEyeOff className="h-5 w-5 text-[var(--text-muted)]"/> : <IconEye className="h-5 w-5 text-[var(--text-muted)]"/>}
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-end pt-2 border-t border-[var(--border-secondary)] mt-4">
                             <button
                                type="button"
                                onClick={handleTestMeliConnection}
                                disabled={isTestingMeli}
                                className="flex items-center px-4 py-2 border border-[var(--border-secondary)] text-sm font-medium rounded-md text-[var(--text-secondary)] bg-[var(--background-secondary)] hover:bg-[var(--background-hover)] disabled:opacity-50 transition-colors"
                            >
                                {isTestingMeli ? <IconLoader className="w-4 h-4 mr-2 animate-spin"/> : <IconPlugConnected className="w-4 h-4 mr-2"/>}
                                Probar Conexión ML
                            </button>
                        </div>

                        {meliTestResult && (
                            <div className={`p-3 rounded-md flex items-center text-sm font-medium ${meliTestResult.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {meliTestResult.type === 'success' ? <IconCheckCircle className="w-5 h-5 mr-2"/> : <IconAlertTriangle className="w-5 h-5 mr-2"/>}
                                {meliTestResult.message}
                            </div>
                        )}
                        {meliDebugLog.length > 0 && (
                            <div className="p-4 bg-slate-800 rounded-md font-mono text-xs text-white max-h-40 overflow-y-auto">
                                <div className="space-y-1">
                                    {meliDebugLog.map((log, index) => (
                                        <p key={index} className={`${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-slate-300'}`}>
                                            {log}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Shopify Card */}
            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg border border-[var(--border-primary)]">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <IconShopify className="w-6 h-6 text-green-600" />
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Shopify</h3>
                        </div>
                        <button
                            onClick={handleSaveShopify}
                            disabled={isSavingShopify}
                            className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-400 transition-colors"
                        >
                            {isSavingShopify ? <IconLoader className="w-4 h-4 mr-2 animate-spin"/> : <IconCheckCircle className="w-4 h-4 mr-2"/>}
                            Guardar Shopify
                        </button>
                    </div>

                    <p className="text-sm text-[var(--text-muted)] mb-4">Configuración global para Custom App en Shopify.</p>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="shopifyShopUrl" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">URL de la Tienda</label>
                            <input
                                type="text"
                                id="shopifyShopUrl"
                                name="shopifyShopUrl"
                                value={settings.shopifyShopUrl || ''}
                                onChange={handleChange}
                                className={inputClasses}
                                placeholder="ejemplo.myshopify.com"
                            />
                            <p className="text-xs text-[var(--text-muted)] mt-1">Ingresa la URL base de tu tienda (sin https://).</p>
                        </div>
                        <div>
                            <label htmlFor="shopifyAccessToken" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Admin API Access Token</label>
                            <div className="relative">
                                <input
                                    type={passwordVisibility.shopifyAccessToken ? 'text' : 'password'}
                                    id="shopifyAccessToken"
                                    name="shopifyAccessToken"
                                    value={settings.shopifyAccessToken || ''}
                                    onChange={handleChange}
                                    className={`${inputClasses} pr-10`}
                                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                                />
                                <button type="button" onClick={() => togglePasswordVisibility('shopifyAccessToken')} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    {passwordVisibility.shopifyAccessToken ? <IconEyeOff className="h-5 w-5 text-[var(--text-muted)]"/> : <IconEye className="h-5 w-5 text-[var(--text-muted)]"/>}
                                </button>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-1">Este token comienza usualmente con 'shpat_'.</p>
                        </div>

                        <div className="flex items-center justify-end pt-2 border-t border-[var(--border-secondary)] mt-4">
                             <button
                                type="button"
                                onClick={handleTestShopifyConnection}
                                disabled={isTestingShopify}
                                className="flex items-center px-4 py-2 border border-[var(--border-secondary)] text-sm font-medium rounded-md text-[var(--text-secondary)] bg-[var(--background-secondary)] hover:bg-[var(--background-hover)] disabled:opacity-50 transition-colors"
                            >
                                {isTestingShopify ? <IconLoader className="w-4 h-4 mr-2 animate-spin"/> : <IconPlugConnected className="w-4 h-4 mr-2"/>}
                                Probar Conexión Shopify
                            </button>
                        </div>

                        {shopifyTestResult && (
                            <div className={`p-3 rounded-md flex items-center text-sm font-medium ${shopifyTestResult.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {shopifyTestResult.type === 'success' ? <IconCheckCircle className="w-5 h-5 mr-2"/> : <IconAlertTriangle className="w-5 h-5 mr-2"/>}
                                {shopifyTestResult.message}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntegrationSettingsPage;
