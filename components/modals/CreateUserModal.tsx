import React, { useState } from 'react';
import { IconX, IconEye, IconEyeOff } from '../Icon';
import { UserCreationData } from '../../services/api';
import { Role } from '../../constants';
import type { UserPricing } from '../../types';

interface CreateUserModalProps {
  onClose: () => void;
  onCreate: (data: UserCreationData) => void;
  defaultRole: Role;
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


const CreateUserModal: React.FC<CreateUserModalProps> = ({ onClose, onCreate, defaultRole }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [personalRut, setPersonalRut] = useState('');

  // Client billing fields
  const [billingName, setBillingName] = useState('');
  const [billingRut, setBillingRut] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCommune, setBillingCommune] = useState('');
  const [billingGiro, setBillingGiro] = useState('');
  const [pickupCost, setPickupCost] = useState<number>(0);
  const [pricing, setPricing] = useState<UserPricing>({ sameDay: 0, express: 0, nextDay: 0 });
  
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return '0';
    return value.toLocaleString('es-CL');
  };

  const handlePricingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericString = value.replace(/\D/g, '');
    const numValue = parseInt(numericString, 10) || 0;

    if (name === 'pickupCost') {
        setPickupCost(numValue);
    } else {
        setPricing(prev => ({ ...prev, [name]: numValue }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Base validation
    if (!name || !email || !password || !phone) {
        setError("Nombre, correo, teléfono y contraseña son obligatorios.");
        return;
    }

    // Role-specific validation
    if (defaultRole === Role.Driver) {
        if (!personalRut) {
            setError("El RUT personal es obligatorio para los conductores.");
            return;
        }
        if (personalRut && !validateRut(personalRut)) {
            setError("El RUT personal ingresado no es válido.");
            return;
        }
    } else if (defaultRole === Role.Client) {
        if (!billingName || !billingRut || !billingAddress || !billingCommune || !billingGiro) {
            setError("Todos los campos de facturación son obligatorios para clientes.");
            return;
        }
        if (billingRut && !validateRut(billingRut)) {
            setError("El RUT de facturación ingresado no es válido.");
            return;
        }
    }

    const creationData: UserCreationData = { 
        name, 
        email, 
        phone, 
        password, 
        role: defaultRole, 
        personalRut,
        driverPermissions: defaultRole === Role.Driver ? {
            canDeliver: true,
            canPickup: true,
            canDispatch: true,
            canReturn: true,
            canViewHistory: true,
            canBulkPickup: false,
            canColecta: false
        } : undefined
    };
    if (defaultRole === Role.Client) {
        creationData.billingName = billingName;
        creationData.billingRut = billingRut;
        creationData.billingAddress = billingAddress;
        creationData.billingCommune = billingCommune;
        creationData.billingGiro = billingGiro;
        creationData.pickupCost = Number(pickupCost) || 0;
        creationData.pricing = pricing;
    }

    onCreate(creationData);
  };

  const handlePhoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const phoneNumber = e.target.value.replace(/\s+/g, '');
    if (phoneNumber.length === 9 && phoneNumber.startsWith('9')) {
      setPhone(`+56${phoneNumber}`);
    } else if (phoneNumber.length === 8 && /^\d+$/.test(phoneNumber)) {
      setPhone(`+569${phoneNumber}`);
    }
  };

  const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Crear Nuevo Usuario ({defaultRole})</h3>
          <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {error && <p className="text-sm text-[var(--error-text)] bg-[var(--error-bg)] p-3 rounded-md">{error}</p>}
            <div>
              <label htmlFor="userName" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nombre Completo</label>
              <input type="text" id="userName" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} required className={`${inputClasses} uppercase`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="userEmail" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Correo Electrónico</label>
                    <input type="email" id="userEmail" value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} required className={inputClasses} />
                </div>
                <div>
                    <label htmlFor="userPhone" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Teléfono</label>
                    <input type="tel" id="userPhone" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={handlePhoneBlur} required className={inputClasses} placeholder="+56912345678" />
                </div>
            </div>
             {defaultRole === Role.Driver && (
              <div>
                <label htmlFor="personalRut" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">RUT Personal</label>
                <input 
                  type="text" 
                  id="personalRut" 
                  value={personalRut} 
                  onChange={(e) => setPersonalRut(e.target.value)} 
                  onBlur={(e) => setPersonalRut(formatRut(e.target.value))}
                  required 
                  className={inputClasses}
                  placeholder="12.345.678-9"
                />
              </div>
            )}
             {defaultRole === Role.Client && (
                <>
                <div className="pt-4 mt-4 border-t border-[var(--border-primary)] space-y-4">
                    <h4 className="text-md font-semibold text-[var(--text-secondary)]">Información de Facturación</h4>
                    <input value={billingName} onChange={e => setBillingName(e.target.value)} placeholder="Razón Social" required className={inputClasses} />
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input value={billingRut} onChange={e => setBillingRut(e.target.value)} onBlur={e => setBillingRut(formatRut(e.target.value))} placeholder="RUT Empresa" required className={inputClasses} />
                        <input value={billingGiro} onChange={e => setBillingGiro(e.target.value)} placeholder="Giro" required className={inputClasses} />
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="Dirección de Facturación" required className={inputClasses} />
                        <input value={billingCommune} onChange={e => setBillingCommune(e.target.value)} placeholder="Comuna" required className={inputClasses} />
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
                                <input type="text" inputMode="numeric" id="sameDay" name="sameDay" value={formatCurrency(pricing.sameDay)} onChange={handlePricingChange} className={`${inputClasses} pl-7`} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="express" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Valor Envío Express</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                <input type="text" inputMode="numeric" id="express" name="express" value={formatCurrency(pricing.express)} onChange={handlePricingChange} className={`${inputClasses} pl-7`} />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="nextDay" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Valor Envío Next Day</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                <input type="text" inputMode="numeric" id="nextDay" name="nextDay" value={formatCurrency(pricing.nextDay)} onChange={handlePricingChange} className={`${inputClasses} pl-7`} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="pickupCost" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Valor por Retiro</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--text-muted)] pointer-events-none">$</span>
                                <input type="text" inputMode="numeric" id="pickupCost" name="pickupCost" value={formatCurrency(pickupCost)} onChange={handlePricingChange} className={`${inputClasses} pl-7`} />
                            </div>
                        </div>
                    </div>
                </div>
                </>
            )}
            <div className="pt-4 mt-4 border-t border-[var(--border-primary)]">
                 <h4 className="text-md font-semibold text-[var(--text-secondary)]">Credenciales de Acceso</h4>
                 <div className="relative mt-2">
                    <label htmlFor="userPassword" className="sr-only">Contraseña</label>
                    <input type={showPassword ? 'text' : 'password'} id="userPassword" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required className={`${inputClasses} pr-10`} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        {showPassword ? <IconEyeOff className="h-5 w-5 text-[var(--text-muted)]" /> : <IconEye className="h-5 w-5 text-[var(--text-muted)]" />}
                    </button>
                 </div>
            </div>
          </div>
          <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">Crear Usuario</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;