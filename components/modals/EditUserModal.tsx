
import React, { useState, useEffect } from 'react';
import { IconX, IconEye, IconEyeOff, IconTruck, IconPencil, IconTrash, IconPlus, IconBuildingStore, IconPlugConnected, IconMercadoLibre, IconWoocommerce, IconLoader, IconCheckCircle, IconAlertTriangle, IconShopify } from '../Icon';
import type { User, Vehicle, UserPricing, IntegrationSettings } from '../../types';
import { Role } from '../../constants';
import { UserUpdateData, api } from '../../services/api';

interface EditUserModalProps {
  user: User;
  onClose: () => void;
  onUpdate: (userId: string, data: UserUpdateData) => void;
  currentUserRole?: Role;
}

const validateRut = (rutCompleto: string): boolean => {
    if (!rutCompleto) return true; // Allow empty
    rutCompleto = rutCompleto.replace(/\./g, '').replace('-', '');
    if (!/^[0-9]+[0-9kK]{1}$/.test(rutCompleto)) return false;
    const rut = rutCompleto.slice(0, -1);
    const dv = rutCompleto.slice(-1).toUpperCase();
    let suma = 0;
    let multiplo = 2;
    for (let i = rut.length - 1; i >= 0; i--) {
        suma += parseInt(rut.charAt(i), 10) * multiplo;
        multiplo = multiplo < 7 ? multiplo + 1 : 2;
    }
    const dvEsperado = 11 - (suma % 11);
    const dvCalculado = (dvEsperado === 11) ? '0' : (dvEsperado === 10) ? 'K' : dvEsperado.toString();
    return dv === dvCalculado;
};

const formatRut = (value: string): string => {
  if (!value) return '';
  const cleanRut = value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleanRut.length < 2) return cleanRut;

  const dv = cleanRut.slice(-1);
  const body = cleanRut.slice(0, -1);
  
  const bodyFormatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  return `${bodyFormatted}-${dv}`;
};

const VehicleForm: React.FC<{
    vehicle: Partial<Vehicle>;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
    onCancel: () => void;
}> = ({ vehicle, onChange, onSave, onCancel }) => {
    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";
    return (
      <div className="p-4 bg-[var(--background-muted)] rounded-lg mt-4 space-y-4">
        <h5 className="font-semibold text-[var(--text-primary)]">{vehicle.id ? 'Editando Vehículo' : 'Nuevo Vehículo'}</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input name="plate" value={vehicle.plate || ''} onChange={onChange} placeholder="Patente (Ej: ABCD12)" required className={`${inputClasses} uppercase`}/>
            <input name="brand" value={vehicle.brand || ''} onChange={onChange} placeholder="Marca" required className={inputClasses}/>
            <input name="model" value={vehicle.model || ''} onChange={onChange} placeholder="Modelo" required className={inputClasses}/>
            <input name="year" value={vehicle.year || ''} onChange={onChange} type="number" placeholder="Año" required className={inputClasses}/>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label className="text-xs text-[var(--text-muted)]">Venc. Revisión Técnica</label>
                <input name="technicalReviewExpiry" value={vehicle.technicalReviewExpiry || ''} onChange={onChange} type="date" className={inputClasses}/>
            </div>
            <div>
                <label className="text-xs text-[var(--text-muted)]">Venc. Permiso Circulación</label>
                <input name="circulationPermitExpiry" value={vehicle.circulationPermitExpiry || ''} onChange={onChange} type="date" className={inputClasses}/>
            </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1 text-sm bg-[var(--background-secondary)] border rounded-md">Cancelar</button>
          <button type="button" onClick={onSave} className="px-3 py-1 text-sm bg-[var(--brand-primary)] text-white rounded-md">Guardar Vehículo</button>
        </div>
      </div>
    );
};

type ConnectionSource = 'meli' | 'woocommerce';

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onUpdate, currentUserRole }) => {
    const [formData, setFormData] = useState<Partial<User>>({});
    const [integrationSettings, setIntegrationSettings] = useState<Partial<IntegrationSettings>>({});
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    
    // Client specific shopify fields
    const [clientShopifyUrl, setClientShopifyUrl] = useState('');
    const [clientShopifyToken, setClientShopifyToken] = useState('');
    const [showShopifyToken, setShowShopifyToken] = useState(false);
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [useSameAddress, setUseSameAddress] = useState(true);
    const [editingVehicle, setEditingVehicle] = useState<(Partial<Vehicle> & { index?: number }) | null>(null);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                personalRut: user.personalRut || '',
                hasCompany: user.hasCompany || false,
                companyName: user.companyName || '',
                companyRut: user.companyRut || '',
                companyAddress: user.companyAddress || '',
                licenseExpiry: user.licenseExpiry || '',
                licenseType: user.licenseType || '',
                backgroundCheckNotes: user.backgroundCheckNotes || '',
                vehicles: user.vehicles || [],
                rut: user.rut || '',
                address: user.address || '',
                pickupAddress: user.pickupAddress || '',
                storesInfo: user.storesInfo || '',
                billingName: user.billingName || user.name || '',
                billingRut: user.billingRut || user.rut || '',
                billingAddress: user.billingAddress || user.address || '',
                billingCommune: user.billingCommune || '',
                billingGiro: user.billingGiro || '',
                pickupCost: user.pickupCost || 0,
                integrations: user.integrations,
                pricing: user.pricing || { sameDay: 0, express: 0, nextDay: 0 },
            });
            setUseSameAddress(!user.pickupAddress || user.address === user.pickupAddress);
            
            if (user.integrations?.shopify) {
                setClientShopifyUrl(user.integrations.shopify.shopUrl || '');
                setClientShopifyToken(user.integrations.shopify.accessToken || '');
            }
        }
        
        const fetchSettings = async () => {
            if (user.role === Role.Client) {
                setIsLoadingSettings(true);
                try {
                    const settings = await api.getIntegrationSettings();
                    setIntegrationSettings(settings);
                } catch (err) {
                    console.error("Failed to load integration settings", err);
                    setError("No se pudo cargar la configuración de integración.");
                } finally {
                    setIsLoadingSettings(false);
                }
            }
        };
        fetchSettings();

    }, [user]);

    useEffect(() => {
        if (useSameAddress) {
            setFormData(prev => ({...prev, pickupAddress: prev.address}));
        }
    }, [formData.address, useSameAddress]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
             const { checked } = e.target as HTMLInputElement;
             setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const formatCurrency = (value: number) => {
        if (isNaN(value)) return '0';
        return value.toLocaleString('es-CL');
    };

    const handlePricingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numericString = value.replace(/\D/g, '');
        const numValue = parseInt(numericString, 10) || 0;

        if (name === 'pickupCost') {
            setFormData(prev => ({ ...prev, pickupCost: numValue }));
        } else if (name === 'sameDay' || name === 'express' || name === 'nextDay') {
            setFormData(prev => ({
                ...prev,
                pricing: {
                    ...(prev.pricing as UserPricing),
                    [name]: numValue,
                },
            }));
        }
    };
    
    const handleRutBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: formatRut(value) }));
    };

    const handleConnectIntegration = (type: ConnectionSource) => {
        if (isLoadingSettings) return;

        if (type === 'meli') {
            if (!integrationSettings.meliAppId) {
                alert("El App ID de Mercado Libre no está configurado. Por favor, configúrelo en la sección de Integraciones.");
                return;
            }
            const redirectUri = `${window.location.origin}/api/integrations/meli/callback`;
            const authUrl = `https://auth.mercadolibre.com/authorization?response_type=code&client_id=${integrationSettings.meliAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${user.id}`;
            window.location.href = authUrl;
        } else {
            alert(`La conexión con ${type} aún no está implementada.`);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
         if (!formData.name || !formData.email || !formData.phone) {
            setError("Nombre, correo y teléfono son obligatorios.");
            return;
        }
        if (password && password !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }
        if (password && password.length < 6) {
            setError("La nueva contraseña debe tener al menos 6 caracteres.");
            return;
        }
        if (!validateRut(formData.personalRut || '') || !validateRut(formData.companyRut || '') || !validateRut(formData.billingRut || '')) {
            setError("Uno de los RUT ingresados no es válido.");
            return;
        }
        setError('');
        
        const updateData: UserUpdateData = { ...formData };
        if (password) {
            updateData.password = password;
        }
        
        if (user.role === Role.Driver && !formData.hasCompany) {
            updateData.companyName = '';
            updateData.companyRut = '';
            updateData.companyAddress = '';
        }
        
        if(user.role === Role.Client && useSameAddress) {
            updateData.pickupAddress = formData.address;
        }
        
        // Update integrations with shopify data
        if (user.role === Role.Client) {
            updateData.integrations = {
                ...formData.integrations,
                shopify: (clientShopifyUrl && clientShopifyToken) ? {
                    shopUrl: clientShopifyUrl,
                    accessToken: clientShopifyToken
                } : undefined
            };
        }

        onUpdate(user.id, updateData);
    };

    const handlePhoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        let phoneNumber = e.target.value.replace(/\s+/g, '');
        if (phoneNumber.length === 9 && phoneNumber.startsWith('9')) {
            phoneNumber = `+56${phoneNumber}`;
        } else if (phoneNumber.length === 8 && /^\d+$/.test(phoneNumber)) {
            phoneNumber = `+569${phoneNumber}`;
        }
        setFormData(prev => ({...prev, phone: phoneNumber}));
    };
  
    const handleStartAddVehicle = () => setEditingVehicle({});
    const handleStartEditVehicle = (vehicle: Vehicle, index: number) => setEditingVehicle({ ...vehicle, index });
    const handleCancelEditVehicle = () => setEditingVehicle(null);
  
    const handleSaveVehicle = () => {
        if (!editingVehicle || !editingVehicle.plate) return;
        const vehicleToSave = { ...editingVehicle };
        delete vehicleToSave.index;

        const finalizedVehicle: Vehicle = {
            id: vehicleToSave.id || `vehicle-${Date.now()}`,
            plate: vehicleToSave.plate || '',
            brand: vehicleToSave.brand || '',
            model: vehicleToSave.model || '',
            year: vehicleToSave.year || new Date().getFullYear(),
            technicalReviewExpiry: vehicleToSave.technicalReviewExpiry || '',
            circulationPermitExpiry: vehicleToSave.circulationPermitExpiry || '',
        };
        
        const currentVehicles = formData.vehicles || [];
        if (editingVehicle.index !== undefined) {
            const updatedVehicles = [...currentVehicles];
            updatedVehicles[editingVehicle.index] = finalizedVehicle;
            setFormData(prev => ({ ...prev, vehicles: updatedVehicles }));
        } else {
            setFormData(prev => ({ ...prev, vehicles: [...currentVehicles, finalizedVehicle] }));
        }
        setEditingVehicle(null);
    };

    const handleDeleteVehicle = (index: number) => {
        if(window.confirm('¿Estás seguro?')) {
            const currentVehicles = formData.vehicles || [];
            setFormData(prev => ({ ...prev, vehicles: currentVehicles.filter((_, i) => i !== index) }));
        }
    };

    const handleVehicleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setEditingVehicle(prev => ({
            ...prev,
            [name]: type === 'number' ? (value ? parseInt(value, 10) : '') : value.toUpperCase()
        }));
    };

    const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-2xl animate-fade-in-up relative" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Editar Usuario</h3>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal"><IconX className="w-6 h-6" /></button>
                </header>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {error && <p className="text-sm text-[var(--error-text)] bg-[var(--error-bg)] p-3 rounded-md">{error}</p>}
                        <div><label htmlFor="name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nombre Completo</label><input type="text" id="name" name="name" value={formData.name || ''} onChange={handleChange} required className={inputClasses} /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Correo Electrónico</label><input type="email" id="email" name="email" value={formData.email || ''} onChange={handleChange} required className={inputClasses} /></div>
                            <div><label htmlFor="phone" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Teléfono</label><input type="tel" id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} onBlur={handlePhoneBlur} required className={inputClasses} /></div>
                        </div>
                        {user.role === Role.Client && (
                            <>
                                <div className="pt-4 mt-4 border-t border-[var(--border-primary)] space-y-4">
                                    <h4 className="text-md font-semibold text-[var(--text-secondary)]">Información Principal del Cliente</h4>
                                    <div><label htmlFor="rut" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">RUT</label><input id="rut" type="text" name="rut" value={formData.rut || ''} onChange={handleChange} onBlur={handleRutBlur} required className={inputClasses} placeholder="12.345.678-9"/></div>
                                    <div><label htmlFor="address" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Dirección Principal</label><input id="address" type="text" name="address" value={formData.address || ''} onChange={handleChange} required className={inputClasses} placeholder="Calle Falsa 123, Comuna"/></div>
                                    <div><label className="flex items-center"><input type="checkbox" checked={useSameAddress} onChange={(e) => setUseSameAddress(e.target.checked)} className="h-4 w-4 rounded border-[var(--border-secondary)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]" /><span className="ml-2 text-sm text-[var(--text-secondary)]">Usar misma dirección para retiro de paquetes</span></label></div>
                                    {!useSameAddress && (<div><label htmlFor="pickupAddress" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Dirección de Retiro</label><input id="pickupAddress" type="text" name="pickupAddress" value={formData.pickupAddress || ''} onChange={handleChange} required={!useSameAddress} className={inputClasses} placeholder="Bodega Central, etc."/></div>)}
                                    <div><label htmlFor="storesInfo" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Locales / Sucursales (Opcional)</label><textarea id="storesInfo" name="storesInfo" value={formData.storesInfo || ''} onChange={handleChange} className={inputClasses} rows={2} placeholder="Ej: Tienda Costanera Center, Local 123..."/></div>
                                </div>
                                <div className="pt-4 mt-4 border-t border-[var(--border-primary)] space-y-4">
                                    <h4 className="text-md font-semibold text-[var(--text-secondary)]">Información de Facturación</h4>
                                    <input name="billingName" value={formData.billingName || ''} onChange={handleChange} placeholder="Razón Social" className={inputClasses} />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <input name="billingRut" value={formData.billingRut || ''} onChange={handleChange} onBlur={handleRutBlur} placeholder="RUT Empresa" className={inputClasses} />
                                        <input name="billingGiro" value={formData.billingGiro || ''} onChange={handleChange} placeholder="Giro" className={inputClasses} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <input name="billingAddress" value={formData.billingAddress || ''} onChange={handleChange} placeholder="Dirección de Facturación" className={inputClasses} />
                                        <input name="billingCommune" value={formData.billingCommune || ''} onChange={handleChange} placeholder="Comuna" className={inputClasses} />
                                    </div>
                                </div>
                                <div className="pt-4 mt-4 border-t border-[var(--border-primary)] space-y-4">
                                    <h4 className="text-md font-semibold text-[var(--text-secondary)]">Tarifas Personalizadas de Envío y Retiro</h4>
                                    <p className="text-xs text-[var(--text-muted)] -mt-2">
                                        Define valores específicos para este cliente. Si dejas en 0, se usarán las tarifas de la zona.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="sameDay" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Valor Envío en el Día</label>
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                                <input type="text" inputMode="numeric" id="sameDay" name="sameDay" value={formatCurrency((formData.pricing as UserPricing)?.sameDay || 0)} onChange={handlePricingChange} className={`${inputClasses} pl-7`} />
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="express" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Valor Envío Express</label>
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                                <input type="text" inputMode="numeric" id="express" name="express" value={formatCurrency((formData.pricing as UserPricing)?.express || 0)} onChange={handlePricingChange} className={`${inputClasses} pl-7`} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="nextDay" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Valor Envío Next Day</label>
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                                <input type="text" inputMode="numeric" id="nextDay" name="nextDay" value={formatCurrency((formData.pricing as UserPricing)?.nextDay || 0)} onChange={handlePricingChange} className={`${inputClasses} pl-7`} />
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="pickupCost" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Valor por Retiro</label>
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                                <input type="text" inputMode="numeric" id="pickupCost" name="pickupCost" value={formatCurrency(formData.pickupCost || 0)} onChange={handlePricingChange} className={`${inputClasses} pl-7`} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 mt-4 border-t border-[var(--border-primary)]">
                                    <h4 className="text-md font-semibold text-[var(--text-secondary)] mb-3">Integraciones de E-commerce</h4>
                                    
                                    {/* --- Mercado Libre --- */}
                                    <div className="mb-4">
                                        <div className="flex items-center mb-2">
                                            <IconMercadoLibre className="w-5 h-5 text-yellow-500 mr-2" />
                                            <h5 className="font-medium text-[var(--text-primary)]">Mercado Libre</h5>
                                        </div>
                                        {formData.integrations?.meli && (
                                            <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-md flex items-center text-green-700 text-xs">
                                                <IconCheckCircle className="w-4 h-4 mr-1.5"/>
                                                Cuenta Conectada
                                            </div>
                                        )}
                                        <button type="button" onClick={() => handleConnectIntegration('meli')} disabled={!!formData.integrations?.meli || isLoadingSettings} className={`w-full flex items-center justify-center p-2 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed ${formData.integrations?.meli ? 'bg-gray-100 text-gray-500 border-gray-300' : 'border-yellow-400 hover:bg-yellow-50 text-slate-700'}`}>
                                            {isLoadingSettings ? <IconLoader className="w-4 h-4 animate-spin"/> : null}
                                            {formData.integrations?.meli ? 'Ya Conectado' : 'Conectar Mercado Libre'}
                                        </button>
                                    </div>

                                    {/* --- Shopify --- */}
                                    <div className="pt-4 border-t border-[var(--border-secondary)]">
                                        <div className="flex items-center mb-3">
                                            <IconShopify className="w-5 h-5 text-green-600 mr-2" />
                                            <h5 className="font-medium text-[var(--text-primary)]">Shopify (App Personalizada)</h5>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">URL de la Tienda (ej: mitienda.myshopify.com)</label>
                                                <input 
                                                    type="text" 
                                                    value={clientShopifyUrl} 
                                                    onChange={(e) => setClientShopifyUrl(e.target.value)} 
                                                    className={inputClasses}
                                                    placeholder="tutienda.myshopify.com"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Admin API Access Token (shpat_...)</label>
                                                <div className="relative">
                                                    <input 
                                                        type={showShopifyToken ? "text" : "password"} 
                                                        value={clientShopifyToken} 
                                                        onChange={(e) => setClientShopifyToken(e.target.value)} 
                                                        className={`${inputClasses} pr-10`}
                                                        placeholder="shpat_xxxxxxxxxxxx"
                                                    />
                                                    <button type="button" onClick={() => setShowShopifyToken(!showShopifyToken)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-muted)]">
                                                        {showShopifyToken ? <IconEyeOff className="w-4 h-4"/> : <IconEye className="w-4 h-4"/>}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-xs text-[var(--text-muted)] italic">
                                                Estos datos se guardarán al hacer clic en "Guardar Cambios" abajo.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        {user.role === Role.Driver && (
                            <div className="pt-4 mt-4 border-t border-[var(--border-primary)] space-y-4">
                                <h4 className="text-md font-semibold text-[var(--text-secondary)]">Información Conductor</h4>
                                <div><label htmlFor="personalRut" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">RUT Personal</label><input type="text" id="personalRut" name="personalRut" value={formData.personalRut || ''} onChange={handleChange} onBlur={handleRutBlur} required className={inputClasses} /></div>
                                <div className="flex items-center"><input type="checkbox" id="hasCompany" name="hasCompany" checked={formData.hasCompany || false} onChange={handleChange} className="h-4 w-4 rounded border-[var(--border-secondary)] text-[var(--brand-primary)]" /><label htmlFor="hasCompany" className="ml-2 block text-sm text-[var(--text-primary)]">Emite factura (tiene empresa)</label></div>
                                {formData.hasCompany && (<div className="p-4 bg-[var(--background-muted)] rounded-lg space-y-4 border"><input name="companyName" value={formData.companyName || ''} onChange={handleChange} placeholder="Razón Social" className={inputClasses} /><input name="companyRut" value={formData.companyRut || ''} onChange={handleChange} onBlur={handleRutBlur} placeholder="RUT Empresa" className={inputClasses} /><input name="companyAddress" value={formData.companyAddress || ''} onChange={handleChange} placeholder="Dirección Empresa" className={inputClasses} /></div>)}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><input name="licenseType" value={formData.licenseType || ''} onChange={handleChange} placeholder="Tipo de Licencia (Ej: Clase B)" className={inputClasses} /><div><label className="text-xs text-[var(--text-muted)]">Vencimiento Licencia</label><input name="licenseExpiry" value={formData.licenseExpiry || ''} onChange={handleChange} type="date" className={inputClasses} /></div></div>
                                <textarea name="backgroundCheckNotes" value={formData.backgroundCheckNotes || ''} onChange={handleChange} placeholder="Notas de antecedentes (opcional)" className={inputClasses} rows={2}></textarea>
                                <div className="pt-4 mt-4 border-t"><h4 className="text-md font-semibold text-[var(--text-secondary)]">Vehículos</h4>{ (formData.vehicles || []).length > 0 && (<div className="space-y-2 mt-2">{ (formData.vehicles || []).map((v, i) => (<div key={v.id} className="flex items-center justify-between p-2 bg-[var(--background-muted)] border rounded-md"><div className="flex items-center gap-3"><IconTruck className="w-5 h-5 text-[var(--text-muted)]"/><div><p className="font-semibold">{v.plate} <span className="font-normal text-sm">{v.brand} {v.model} ({v.year})</span></p><p className="text-xs text-[var(--text-muted)]">Rev. Téc: {v.technicalReviewExpiry} / P. Circ: {v.circulationPermitExpiry}</p></div></div><div><button type="button" onClick={() => handleStartEditVehicle(v, i)} className="p-1.5"><IconPencil className="w-4 h-4"/></button><button type="button" onClick={() => handleDeleteVehicle(i)} className="p-1.5"><IconTrash className="w-4 h-4"/></button></div></div>))}</div>)}{editingVehicle ? (<VehicleForm vehicle={editingVehicle} onChange={handleVehicleFormChange} onSave={handleSaveVehicle} onCancel={handleCancelEditVehicle} />) : (<button type="button" onClick={handleStartAddVehicle} className="mt-2 text-sm font-semibold flex items-center gap-1"><IconPlus className="w-4 h-4"/> Agregar Vehículo</button>)}</div>
                            </div>
                        )}
                        {currentUserRole === Role.Admin && (
                            <div className="pt-4 mt-4 border-t border-[var(--border-primary)]">
                                <h4 className="text-md font-semibold text-[var(--text-secondary)]">Cambiar Contraseña (Opcional)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div><div className="relative"><input type={showPassword ? 'text' : 'password'} placeholder="Nueva Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClasses} pr-10`} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">{showPassword ? <IconEyeOff className="h-5 w-5 text-[var(--text-muted)]" /> : <IconEye className="h-5 w-5 text-[var(--text-muted)]" />}</button></div></div>
                                    <div><div className="relative"><input type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirmar" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${inputClasses} pr-10`} /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">{showConfirmPassword ? <IconEyeOff className="h-5 w-5 text-[var(--text-muted)]" /> : <IconEye className="h-5 w-5 text-[var(--text-muted)]" />}</button></div></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] border rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">Guardar Cambios</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default EditUserModal;
