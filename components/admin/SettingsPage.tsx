
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import { IconEye, IconEyeOff, IconCheckCircle, IconMail, IconWhatsapp, IconQrcode, IconPencil, IconInfo, IconChecklist, IconTrash, IconSettings, IconAlertTriangle, IconTruck } from '../Icon';
import { useTheme } from '../../contexts/ThemeContext';
import DeleteDatabaseModal from '../modals/DeleteDatabaseModal';
import { MessagingPlan, PickupMode } from '../../constants';

const messagingPlanConfig = {
    [MessagingPlan.None]: { name: 'Sin Mensajería', description: 'No se envían notificaciones automáticas a clientes.' },
    [MessagingPlan.Email]: { name: 'Mensajería por Email', description: 'Notificaciones automáticas por correo electrónico.' },
    [MessagingPlan.WhatsApp]: { name: 'Mensajería por WhatsApp', description: 'Notificaciones automáticas vía WhatsApp.' },
};

const pickupModeConfig = {
    [PickupMode.Scan]: { name: 'Solo Escaneo', description: 'El retiro se cierra automáticamente con la cantidad de paquetes escaneados.', icon: <IconQrcode className="w-6 h-6 mx-auto mb-2 text-purple-500" /> },
    [PickupMode.Manual]: { name: 'Solo Ingreso Manual', description: 'El conductor ingresa manualmente la cantidad total. No se usa escáner.', icon: <IconPencil className="w-6 h-6 mx-auto mb-2 text-blue-500" /> },
    [PickupMode.ScanWithCount]: { name: 'Escaneo + Conteo', description: 'El conductor escanea, pero DEBE ingresar la cantidad final manualmente para cerrar.', icon: <IconChecklist className="w-6 h-6 mx-auto mb-2 text-orange-500" /> },
    [PickupMode.Colecta]: { name: 'Modo Colecta', description: 'Los conductores eligen qué retiros realizar de una lista global de clientes.', icon: <IconTruck className="w-6 h-6 mx-auto mb-2 text-emerald-500" /> },
};

interface SettingsState {
    companyName: string;
    isAppEnabled: boolean;
    requiredPhotos: number;
    messagingPlan: MessagingPlan;
    pickupMode: PickupMode;
    meliFlexValidation: boolean;
}

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<SettingsState>({ 
        companyName: '', 
        isAppEnabled: true, 
        requiredPhotos: 1,
        messagingPlan: MessagingPlan.None,
        pickupMode: PickupMode.Scan,
        meliFlexValidation: true,
    });
    const [originalSettings, setOriginalSettings] = useState<SettingsState | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isDeleteDbModalOpen, setIsDeleteDbModalOpen] = useState(false);
    const auth = useContext(AuthContext);
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (auth?.systemSettings) {
            const loadedSettings: SettingsState = {
                companyName: auth.systemSettings.companyName,
                isAppEnabled: auth.systemSettings.isAppEnabled,
                requiredPhotos: auth.systemSettings.requiredPhotos || 1,
                messagingPlan: auth.systemSettings.messagingPlan || MessagingPlan.None,
                pickupMode: auth.systemSettings.pickupMode || PickupMode.Scan,
                meliFlexValidation: auth.systemSettings.meliFlexValidation ?? true,
            };
            setSettings(loadedSettings);
            setOriginalSettings(loadedSettings);
        }
    }, [auth?.systemSettings]);
    
    const showSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const showError = (message: string) => {
        setErrorMessage(message);
        setTimeout(() => setErrorMessage(''), 3000);
    };
    
    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox') {
             setSettings(prev => ({ ...prev, [name]: checked }));
        } else if (type === 'number') {
            const numValue = parseInt(value, 10);
            setSettings(prev => ({ ...prev, [name]: isNaN(numValue) ? '' : numValue }));
        } else {
            setSettings(prev => ({ ...prev, [name]: value }));
        }
    };

    const handlePlanChange = (plan: MessagingPlan) => {
        setSettings(prev => ({ ...prev, messagingPlan: plan }));
    };

    const handlePickupModeChange = (mode: PickupMode) => {
        setSettings(prev => ({ ...prev, pickupMode: mode }));
    };

    const handleGeneralSettingsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth) return;
        try {
            await auth.updateSystemSettings({ 
                companyName: settings.companyName,
                requiredPhotos: Number(settings.requiredPhotos),
                messagingPlan: settings.messagingPlan,
                pickupMode: settings.pickupMode,
                meliFlexValidation: settings.meliFlexValidation,
            });
            setOriginalSettings(settings); 
            showSuccess('Configuración general y de plan actualizada con éxito.');
        } catch (error) {
            showError('Error al actualizar la configuración.');
        }
    };
    
    const handleAppStatusToggle = async () => {
        if (!auth) return;
        try {
            const newStatus = !settings.isAppEnabled;
            await auth.updateSystemSettings({ isAppEnabled: newStatus });
            const updatedSettings = { ...settings, isAppEnabled: newStatus };
            setSettings(updatedSettings);
            setOriginalSettings(prev => prev ? ({ ...prev, isAppEnabled: newStatus }) : null);
            showSuccess(`Aplicación ${newStatus ? 'habilitada' : 'deshabilitada'} con éxito.`);
        } catch (error) {
            showError('Error al cambiar el estado de la aplicación.');
        }
    };


    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            showError('Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 6) {
            showError('La nueva contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (!auth?.user) {
            showError('Usuario no autenticado.');
            return;
        }

        try {
            await api.updateUser(auth.user.id, { password });
            showSuccess('Contraseña actualizada con éxito.');
            setPassword('');
            setConfirmPassword('');
        } catch (error) {
            showError('Error al actualizar la contraseña.');
        }
    };
    
    const handleResetDatabase = async (password: string) => {
        try {
            await api.resetDatabase(password);
            setIsDeleteDbModalOpen(false);
            auth?.logout();
        } catch (error) {
            showError('Hubo un error al borrar la base de datos.');
            console.error("Database reset failed", error);
        }
    };

    const hasChanges = useMemo(() => {
        if (!originalSettings) return false;
        return (
            settings.companyName !== originalSettings.companyName ||
            settings.requiredPhotos !== originalSettings.requiredPhotos ||
            settings.messagingPlan !== originalSettings.messagingPlan ||
            settings.pickupMode !== originalSettings.pickupMode ||
            settings.meliFlexValidation !== originalSettings.meliFlexValidation
        );
    }, [settings, originalSettings]);

    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)]";
    
    const ThemeButton: React.FC<{ name: 'default' | 'light' | 'dark' | 'corporate' | 'ocean' | 'nature' | 'midnight', label: string, colors: string[] }> = ({ name, label, colors }) => (
        <button
            onClick={() => setTheme(name)}
            className={`w-full p-4 border rounded-lg text-left relative transition-all ${theme === name ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]' : 'border-[var(--border-secondary)] hover:border-[var(--brand-secondary)]'}`}
        >
            <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text-primary)]">{label}</span>
                {theme === name && <IconCheckCircle className="w-5 h-5 text-[var(--brand-primary)]" />}
            </div>
            <div className="flex gap-2 mt-2">
                {colors.map((color, i) => <div key={i} className="w-6 h-6 rounded-full" style={{ backgroundColor: color }}></div>)}
            </div>
        </button>
    );

    return (
        <div className="space-y-8 max-w-4xl">
            {successMessage && <div className="bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success-text)] px-4 py-3 rounded relative mb-4" role="alert">{successMessage}</div>}
            {errorMessage && <div className="bg-[var(--error-bg)] border border-[var(--error-border)] text-[var(--error-text)] px-4 py-3 rounded relative mb-4" role="alert">{errorMessage}</div>}

            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4 border-b border-[var(--border-primary)] pb-3">Configuración General</h2>
                <form onSubmit={handleGeneralSettingsSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="companyName" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nombre de la Empresa</label>
                            <input type="text" id="companyName" name="companyName" value={settings.companyName} onChange={handleSettingsChange} required className={`${inputClasses} text-[var(--text-primary)]`}/>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Versión del Sistema</label>
                             <div className="relative">
                                <input 
                                    type="text" 
                                    disabled 
                                    value={`v${(import.meta as any).env.VITE_APP_VERSION}`} 
                                    className={`${inputClasses} bg-[var(--background-muted)] text-[var(--text-muted)] cursor-not-allowed`} 
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <IconInfo className="h-5 w-5 text-[var(--text-muted)]" />
                                </div>
                             </div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="requiredPhotos" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Fotos requeridas por Entrega</label>
                        <input type="number" id="requiredPhotos" name="requiredPhotos" value={settings.requiredPhotos} onChange={handleSettingsChange} min="1" max="5" required className={`${inputClasses} text-[var(--text-primary)]`}/>
                    </div>

                    <div className="pt-4 border-t border-[var(--border-primary)]">
                        <label className="flex items-center justify-between cursor-pointer">
                            <div>
                                <h3 className="text-lg font-semibold text-[var(--text-secondary)]">Forzar Cierre en App Flex</h3>
                                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md">Si está activado, un conductor no podrá marcar como "Entregado" un paquete de Mercado Libre si no lo ha cerrado primero en la app de Flex.</p>
                            </div>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    name="meliFlexValidation"
                                    checked={settings.meliFlexValidation}
                                    onChange={handleSettingsChange}
                                    className="sr-only peer"
                                />
                                <div className="w-14 h-8 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-[var(--brand-secondary)] dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--brand-primary)]"></div>
                            </div>
                        </label>
                    </div>

                     <div className="pt-4 border-t border-[var(--border-primary)]">
                        <h3 className="text-lg font-semibold text-[var(--text-secondary)]">Modo de Retiro</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">Define el procedimiento que deben seguir los conductores al retirar.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                           {(Object.values(PickupMode) as PickupMode[]).map(mode => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => handlePickupModeChange(mode)}
                                    className={`p-4 border rounded-lg text-center relative transition-all ${settings.pickupMode === mode ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)] bg-[var(--brand-muted)]' : 'border-[var(--border-secondary)] hover:border-[var(--brand-secondary)]'}`}
                                >
                                    {pickupModeConfig[mode].icon}
                                    <span className="font-semibold text-sm text-[var(--text-primary)]">{pickupModeConfig[mode].name}</span>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">{pickupModeConfig[mode].description}</p>
                                    {settings.pickupMode === mode && (
                                        <div className="absolute -top-2 -right-2 bg-[var(--brand-primary)] text-white rounded-full p-0.5">
                                            <IconCheckCircle className="w-4 h-4" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                     <div className="pt-4 border-t border-[var(--border-primary)]">
                        <h3 className="text-lg font-semibold text-[var(--text-secondary)]">Plan de Mensajería</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">Selecciona el plan de notificaciones que regirá para toda la operación.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {(Object.values(MessagingPlan) as MessagingPlan[]).map(plan => (
                                <button
                                    key={plan}
                                    type="button"
                                    onClick={() => handlePlanChange(plan)}
                                    className={`p-4 border rounded-lg text-center relative transition-all ${settings.messagingPlan === plan ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)] bg-[var(--brand-muted)]' : 'border-[var(--border-secondary)] hover:border-[var(--brand-secondary)]'}`}
                                >
                                    {plan === MessagingPlan.Email && <IconMail className="w-6 h-6 mx-auto mb-2 text-blue-500" />}
                                    {plan === MessagingPlan.WhatsApp && <IconWhatsapp className="w-6 h-6 mx-auto mb-2 text-green-500" />}
                                    {plan === MessagingPlan.None && <div className="w-6 h-6 mx-auto mb-2 border-2 border-dashed border-gray-300 rounded-full"></div>}
                                    <span className="font-semibold text-sm text-[var(--text-primary)]">{messagingPlanConfig[plan].name}</span>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">{messagingPlanConfig[plan].description}</p>
                                    {settings.messagingPlan === plan && (
                                        <div className="absolute -top-2 -right-2 bg-[var(--brand-primary)] text-white rounded-full p-0.5">
                                            <IconCheckCircle className="w-4 h-4" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-[var(--border-primary)]">
                        <button 
                            type="submit" 
                            disabled={!hasChanges}
                            title={!hasChanges ? "No hay cambios pendientes" : "Guardar configuración"}
                            className="px-6 py-2 text-sm font-bold text-[var(--text-on-brand)] bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {hasChanges ? 'Guardar Cambios' : 'Sin Cambios'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4 border-b border-[var(--border-primary)] pb-3">Estado de la Aplicación</h2>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-[var(--text-primary)]">Mantenimiento de la Aplicación</p>
                        <p className="text-sm text-[var(--text-muted)]">
                            {settings.isAppEnabled
                                ? 'La aplicación está actualmente en línea y operativa.'
                                : 'La aplicación está en modo mantenimiento. Solo el superusuario puede iniciar sesión.'}
                        </p>
                    </div>
                    <button
                        onClick={handleAppStatusToggle}
                        className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white ${
                            settings.isAppEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                        {settings.isAppEnabled ? 'Deshabilitar Aplicación' : 'Habilitar Aplicación'}
                    </button>
                </div>
            </div>

             <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6">
                 <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4 border-b border-[var(--border-primary)] pb-3">Apariencia</h2>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ThemeButton name="default" label="Default" colors={['#f8fafc', '#4f46e5', '#16a34a']} />
                    <ThemeButton name="light" label="Claro" colors={['#f8fafc', '#2563eb', '#166534']} />
                    <ThemeButton name="dark" label="Oscuro" colors={['#0f172a', '#60a5fa', '#bbf7d0']} />
                    <ThemeButton name="corporate" label="Corporativo" colors={['#f4f6f9', '#007bff', '#155724']} />
                    <ThemeButton name="ocean" label="Océano" colors={['#f0f9ff', '#0891b2', '#134e63']} />
                    <ThemeButton name="nature" label="Naturaleza" colors={['#fefce8', '#65a30d', '#166534']} />
                    <ThemeButton name="midnight" label="Medianoche" colors={['#111827', '#8b5cf6', '#6ee7b7']} />
                 </div>
            </div>

            <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4 border-b border-[var(--border-primary)] pb-3">Seguridad (Superusuario)</h2>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                     <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nueva Contraseña</label>
                         <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="newPassword"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className={`${inputClasses} pr-10 text-[var(--text-primary)]`}
                                placeholder="Mínimo 6 caracteres"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                                {showPassword ? <IconEyeOff className="h-5 w-5 text-[var(--text-muted)]" /> : <IconEye className="h-5 w-5 text-[var(--text-muted)]" />}
                            </button>
                         </div>
                    </div>
                     <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Confirmar Nueva Contraseña</label>
                        <div className="relative">
                         <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className={`${inputClasses} pr-10 text-[var(--text-primary)]`}
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center" aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                            {showConfirmPassword ? <IconEyeOff className="h-5 w-5 text-[var(--text-muted)]" /> : <IconEye className="h-5 w-5 text-[var(--text-muted)]" />}
                        </button>
                        </div>
                    </div>
                     <div className="flex justify-end">
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-[var(--text-on-brand)] bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">
                            Cambiar Contraseña
                        </button>
                    </div>
                </form>
            </div>

            {auth?.user?.email === 'admin' && (
                <>
                    <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6 border-2 border-red-500">
                        <h2 className="text-xl font-bold text-red-600 mb-2 flex items-center gap-2">
                            <IconTrash className="w-6 h-6"/>
                            Zona de Peligro
                        </h2>
                        <div className="bg-red-50 p-4 rounded-md mb-4 border border-red-100">
                            <div className="flex items-start">
                                <IconAlertTriangle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">
                                    Esta acción es <strong>irreversible</strong>. Restablecerá la aplicación a su estado inicial para producción, eliminando todos los datos transaccionales (paquetes, historiales, rutas, facturas) y usuarios (excepto el administrador).
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={() => setIsDeleteDbModalOpen(true)}
                                className="px-4 py-2 text-sm font-bold text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 transition-colors"
                            >
                                Borrar Base de Datos
                            </button>
                        </div>
                    </div>
                </>
            )}
            
            {isDeleteDbModalOpen && (
                <DeleteDatabaseModal
                    onClose={() => setIsDeleteDbModalOpen(false)}
                    onConfirm={handleResetDatabase}
                />
            )}
        </div>
    );
};

export default SettingsPage;