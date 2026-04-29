import React, { useState, useEffect, useMemo } from 'react';
import { IconX, IconPackage, IconUser, IconMapPin, IconPlus, IconCheck } from '../Icon';
import { PackageCreationData } from '../../services/api';
import { ShippingType, RM_COMMUNES } from '../../constants';
import type { User, Package } from '../../types';
import SearchableSelect from '../SearchableSelect';

interface CreatePackageModalProps {
  onClose: () => void;
  onCreate?: (data: Omit<PackageCreationData, 'origin'>) => void;
  onUpdate?: (id: string, data: Partial<PackageCreationData>) => void;
  initialData?: Package;
  clients?: User[];
  creatorId?: string;
}

const chileanCities = [
    'Santiago', 'Arica', 'Iquique', 'Antofagasta', 'Calama', 'Copiapó', 
    'La Serena', 'Coquimbo', 'Valparaíso', 'Viña del Mar', 'Rancagua', 
    'Talca', 'Concepción', 'Talcahuano', 'Temuco', 'Valdivia', 
    'Puerto Montt', 'Coyhaique', 'Punta Arenas'
];

const CreatePackageModal: React.FC<CreatePackageModalProps> = ({ onClose, onCreate, onUpdate, initialData, clients, creatorId }) => {
  const [selectedClientId, setSelectedClientId] = useState(initialData?.creatorId || '');
  const [recipientName, setRecipientName] = useState(initialData?.recipientName || '');
  const [recipientPhone, setRecipientPhone] = useState(initialData?.recipientPhone || '');
  const [recipientEmail, setRecipientEmail] = useState(initialData?.recipientEmail || '');
  const [recipientAddress, setRecipientAddress] = useState(initialData?.recipientAddress || '');
  const [recipientCommune, setRecipientCommune] = useState(initialData?.recipientCommune || '');
  const [recipientCity, setRecipientCity] = useState(initialData?.recipientCity || 'Santiago');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [trackingId, setTrackingId] = useState(initialData?.trackingId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreatedName, setLastCreatedName] = useState<string | null>(null);

  const getLocalDateString = (dateObj: Date = new Date()) => {
      return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  };

  const [estimatedDelivery, setEstimatedDelivery] = useState(
    initialData?.estimatedDelivery 
      ? new Date(initialData.estimatedDelivery).toISOString().split('T')[0] 
      : getLocalDateString()
  );
  const [shippingType, setShippingType] = useState<ShippingType>(initialData?.shippingType || ShippingType.SameDay);

  useEffect(() => {
    if (clients && clients.length > 0 && !selectedClientId && !initialData) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId, initialData]);

  const searchableClients = useMemo(() => {
    return clients?.map(c => ({ id: c.id, name: c.name })) || [];
  }, [clients]);

  const searchableCommunes = useMemo(() => {
    return RM_COMMUNES.map(c => ({ id: c, name: c }));
  }, []);

  const resetRecipientFields = () => {
    setRecipientName('');
    setRecipientPhone('');
    setRecipientEmail('');
    setRecipientAddress('');
    setRecipientCommune('');
    setTrackingId('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent, createAnother = false) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    const finalCreatorId = clients ? selectedClientId : creatorId;
    if (!finalCreatorId && !initialData) {
        console.error("Creator ID is missing.");
        return;
    }

    setIsSubmitting(true);

    const packageData = {
      creatorId: (finalCreatorId || initialData?.creatorId) as string,
      recipientName,
      recipientPhone,
      recipientAddress,
      recipientCommune,
      recipientCity,
      recipientEmail,
      notes,
      trackingId,
      estimatedDelivery: new Date(estimatedDelivery),
      shippingType,
      source: initialData?.source || 'MANUAL',
    };

    try {
        if (initialData && onUpdate) {
            await onUpdate(initialData.id, packageData);
            onClose();
        } else if (onCreate) {
            await onCreate(packageData as Omit<PackageCreationData, 'origin'>);
            
            if (createAnother) {
                setLastCreatedName(recipientName);
                resetRecipientFields();
                setTimeout(() => setLastCreatedName(null), 3000);
            } else {
                onClose();
            }
        }
    } catch (error) {
        console.error("Error submitting package:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePhoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const phoneNumber = e.target.value.replace(/\s+/g, '');
    if (phoneNumber.length === 9 && phoneNumber.startsWith('9')) {
      setRecipientPhone(`+56${phoneNumber}`);
    } else if (phoneNumber.length === 8 && /^\d+$/.test(phoneNumber)) {
      setRecipientPhone(`+569${phoneNumber}`);
    }
  };
  
  const today = getLocalDateString();
  const inputClasses = "w-full px-4 py-2.5 border border-[var(--border-secondary)] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-[var(--background-secondary)] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-muted)]";
  const labelClasses = "block text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 ml-1";

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background-secondary)] rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in-up overflow-hidden border border-[var(--border-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-5 border-b border-[var(--border-primary)] bg-[var(--background-muted)]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)] flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/20">
                <IconPackage className="w-6 h-6 text-white" />
             </div>
             <div>
                <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                    {initialData ? 'Editar Envío' : 'Nuevo Envío Manual'}
                </h3>
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tighter">Gestión de Logística Directa</p>
             </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600 transition-all"
            aria-label="Cerrar modal"
          >
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={(e) => handleSubmit(e, false)}>
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar bg-gradient-to-b from-[var(--background-secondary)] to-[var(--background-muted)]">
            
            {lastCreatedName && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-bounce">
                    <IconCheck className="w-5 h-5" />
                    <span className="text-sm font-bold">¡Paquete para <strong>{lastCreatedName}</strong> creado con éxito!</span>
                </div>
            )}

            {/* SELLER SELECTION */}
            <div className="bg-white p-5 rounded-2xl border border-[var(--border-secondary)] shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <IconUser className="w-4 h-4 text-[var(--brand-primary)]" />
                    <h4 className="text-xs font-black text-[var(--brand-primary)] uppercase tracking-widest">Información del Seller</h4>
                </div>
                {clients ? (
                    <div>
                        <label className={labelClasses}>Buscador de Clientes / Sellers</label>
                        <SearchableSelect 
                            items={searchableClients}
                            selectedId={selectedClientId}
                            onSelect={setSelectedClientId}
                            placeholder="Buscar cliente..."
                            searchPlaceholder="Escribe el nombre del cliente..."
                            showNoneOption={false}
                        />
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold bg-[var(--background-muted)] p-3 rounded-xl border border-[var(--border-primary)]">
                        <IconCheck className="w-5 h-5 text-emerald-500" />
                        <span>Creando como: <span className="text-[var(--brand-primary)]">Administrador</span></span>
                    </div>
                )}
            </div>

            {/* RECIPIENT INFORMATION */}
            <div className="bg-white p-5 rounded-2xl border border-[var(--border-secondary)] shadow-sm space-y-5">
                <div className="flex items-center gap-2 mb-2">
                    <IconMapPin className="w-4 h-4 text-[var(--brand-primary)]" />
                    <h4 className="text-xs font-black text-[var(--brand-primary)] uppercase tracking-widest">Datos del Destinatario</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="trackingId" className={labelClasses}>Tracking ID (Opcional)</label>
                        <input type="text" id="trackingId" value={trackingId} onChange={(e) => setTrackingId(e.target.value.toUpperCase())} className={`${inputClasses} uppercase font-black text-sm`} placeholder="PKG-XXXXXX" />
                    </div>
                    <div>
                        <label htmlFor="recipientName" className={labelClasses}>Nombre Completo</label>
                        <input type="text" id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value.toUpperCase())} required className={`${inputClasses} uppercase font-bold`} placeholder="JUAN PÉREZ" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="recipientPhone" className={labelClasses}>Teléfono</label>
                        <input type="tel" id="recipientPhone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} onBlur={handlePhoneBlur} required className={`${inputClasses} font-bold`} placeholder="+569XXXXXXXX" />
                    </div>
                    <div>
                        <label htmlFor="recipientEmail" className={labelClasses}>Correo Electrónico</label>
                        <input type="email" id="recipientEmail" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value.toLowerCase())} className={inputClasses} placeholder="cliente@correo.com" />
                    </div>
                </div>

                <div>
                    <label htmlFor="recipientAddress" className={labelClasses}>Dirección de Entrega</label>
                    <input type="text" id="recipientAddress" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value.toUpperCase())} required className={`${inputClasses} uppercase font-bold`} placeholder="CALLE, NÚMERO, DEPTO/OF" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClasses}>Comuna</label>
                        <SearchableSelect 
                            items={searchableCommunes}
                            selectedId={recipientCommune}
                            onSelect={setRecipientCommune}
                            placeholder="Seleccionar comuna..."
                            searchPlaceholder="Buscar comuna..."
                            showNoneOption={false}
                        />
                    </div>
                    <div>
                        <label htmlFor="recipientCity" className={labelClasses}>Región / Ciudad</label>
                        <select id="recipientCity" value={recipientCity} onChange={(e) => setRecipientCity(e.target.value)} required className={inputClasses}>
                            {chileanCities.sort().map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* SHIPPING DETAILS */}
            <div className="bg-white p-5 rounded-2xl border border-[var(--border-secondary)] shadow-sm space-y-5">
                <div className="flex items-center gap-2 mb-2">
                    <IconPackage className="w-4 h-4 text-[var(--brand-primary)]" />
                    <h4 className="text-xs font-black text-[var(--brand-primary)] uppercase tracking-widest">Detalles del Envío</h4>
                </div>

                <div>
                    <label className={labelClasses}>Prioridad de Entrega</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {(Object.values(ShippingType) as ShippingType[]).map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setShippingType(type)}
                            className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                            shippingType === type
                                ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-lg shadow-[var(--brand-primary)]/20 scale-[1.02]'
                                : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border-secondary)] hover:bg-[var(--background-hover)]'
                            }`}
                        >
                            {type}
                        </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="estimatedDelivery" className={labelClasses}>Fecha Programada</label>
                        <input type="date" id="estimatedDelivery" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} required min={today} className={inputClasses} />
                    </div>
                    <div>
                        <label htmlFor="notes" className={labelClasses}>Observaciones Adicionales</label>
                        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} className={`${inputClasses} resize-none`} placeholder="Ej: Portería, dejar en conserje..."></textarea>
                    </div>
                </div>
            </div>
          </div>

          <footer className="px-6 py-5 bg-[var(--background-muted)] border-t border-[var(--border-primary)] flex flex-col sm:flex-row justify-between gap-4">
            <button 
                type="button" 
                onClick={onClose} 
                className="px-6 py-3 text-sm font-black uppercase tracking-widest text-[var(--text-secondary)] bg-white border border-[var(--border-secondary)] rounded-xl hover:bg-gray-50 transition-all order-2 sm:order-1"
            >
                Cancelar
            </button>
            <div className="flex flex-col sm:flex-row gap-3 order-1 sm:order-2">
                {!initialData && (
                    <button 
                        type="button"
                        onClick={(e) => handleSubmit(e, true)}
                        disabled={isSubmitting}
                        className="px-6 py-3 text-sm font-black uppercase tracking-widest text-[var(--brand-primary)] bg-[var(--brand-muted)] border border-[var(--brand-primary)] rounded-xl hover:bg-[var(--brand-primary)] hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? '...' : (
                            <>
                                <IconPlus className="w-4 h-4" />
                                Crear y Añadir Otro
                            </>
                        )}
                    </button>
                )}
                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-8 py-3 text-sm font-black uppercase tracking-widest text-white bg-[var(--brand-primary)] border border-transparent rounded-xl shadow-lg shadow-[var(--brand-primary)]/20 hover:bg-[var(--brand-secondary)] hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        initialData ? 'Guardar Cambios' : 'Crear y Cerrar'
                    )}
                </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CreatePackageModal;