import React, { useState, useEffect } from 'react';
import { IconX } from '../Icon';
import { PackageCreationData } from '../../services/api';
import { ShippingType } from '../../constants';
import type { User } from '../../types';

interface CreatePackageModalProps {
  onClose: () => void;
  onCreate: (data: Omit<PackageCreationData, 'origin'>) => void;
  clients?: User[];
  creatorId?: string;
}

const chileanCities = [
    'Santiago', 'Arica', 'Iquique', 'Antofagasta', 'Calama', 'Copiapó', 
    'La Serena', 'Coquimbo', 'Valparaíso', 'Viña del Mar', 'Rancagua', 
    'Talca', 'Concepción', 'Talcahuano', 'Temuco', 'Valdivia', 
    'Puerto Montt', 'Coyhaique', 'Punta Arenas'
];

const CreatePackageModal: React.FC<CreatePackageModalProps> = ({ onClose, onCreate, clients, creatorId }) => {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCommune, setRecipientCommune] = useState('');
  const [recipientCity, setRecipientCity] = useState('Santiago');
  const [notes, setNotes] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState(new Date().toISOString().split('T')[0]);
  const [shippingType, setShippingType] = useState<ShippingType>(ShippingType.SameDay);

  useEffect(() => {
    if (clients && clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalCreatorId = clients ? selectedClientId : creatorId;
    if (!finalCreatorId) {
        console.error("Creator ID is missing.");
        return;
    }

    onCreate({
      creatorId: finalCreatorId,
      recipientName,
      recipientPhone,
      recipientAddress,
      recipientCommune,
      recipientCity,
      notes,
      estimatedDelivery: new Date(estimatedDelivery),
      shippingType,
      source: 'MANUAL',
    });
  };

  const handlePhoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const phoneNumber = e.target.value.replace(/\s+/g, '');
    if (phoneNumber.length === 9 && phoneNumber.startsWith('9')) {
      setRecipientPhone(`+56${phoneNumber}`);
    } else if (phoneNumber.length === 8 && /^\d+$/.test(phoneNumber)) {
      setRecipientPhone(`+569${phoneNumber}`);
    }
  };
  
  const today = new Date().toISOString().split('T')[0];
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
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Crear Nuevo Paquete</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Cerrar modal"
          >
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {clients && (
                <div className="mb-4">
                    <label htmlFor="client-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Asignar a Cliente</label>
                    <select
                        id="client-select"
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        required
                        className={inputClasses}
                    >
                        {clients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                    </select>
                </div>
            )}
            <h4 className="text-md font-semibold text-[var(--text-secondary)] border-b border-[var(--border-primary)] pb-2">Información del Destinatario</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="recipientName" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nombre Completo</label>
                <input type="text" id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value.toUpperCase())} required className={`${inputClasses} uppercase font-bold`} placeholder="Ej: Juan Pérez" />
              </div>
              <div>
                <label htmlFor="recipientPhone" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Teléfono de Contacto</label>
                <input type="tel" id="recipientPhone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} onBlur={handlePhoneBlur} required className={`${inputClasses} font-bold`} placeholder="Ej: +56912345678" />
              </div>
            </div>
             <div>
              <label htmlFor="recipientAddress" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Dirección</label>
              <input type="text" id="recipientAddress" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value.toUpperCase())} required className={`${inputClasses} uppercase font-bold`} placeholder="Ej: Av. Siempreviva 742" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="recipientCommune" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Comuna</label>
                    <input type="text" id="recipientCommune" value={recipientCommune} onChange={(e) => setRecipientCommune(e.target.value)} required className={inputClasses} placeholder="Ej: Providencia" />
                </div>
                <div>
                    <label htmlFor="recipientCity" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Ciudad</label>
                    <select id="recipientCity" value={recipientCity} onChange={(e) => setRecipientCity(e.target.value)} required className={inputClasses}>
                        {chileanCities.sort().map(city => (
                            <option key={city} value={city}>{city}</option>
                        ))}
                    </select>
                </div>
            </div>

            <h4 className="text-md font-semibold text-[var(--text-secondary)] border-b border-[var(--border-primary)] pb-2 pt-2">Detalles del Envío</h4>
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tipo de Envío</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(Object.values(ShippingType) as ShippingType[]).map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => setShippingType(type)}
                        className={`px-3 py-2 text-sm font-medium rounded-md border text-center transition-colors ${
                        shippingType === type
                            ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] ring-2 ring-[var(--brand-secondary)]'
                            : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border-secondary)] hover:bg-[var(--background-hover)]'
                        }`}
                    >
                        {type}
                    </button>
                    ))}
                </div>
            </div>
            <div>
              <label htmlFor="estimatedDelivery" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Fecha de Entrega Estimada</label>
              <input type="date" id="estimatedDelivery" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} required min={today} className={inputClasses} />
            </div>
             <div>
              <label htmlFor="notes" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Notas (Opcional)</label>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClasses} placeholder="Ej: Dejar en conserjería, paquete frágil..."></textarea>
            </div>
          </div>

          <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">Crear y Generar Etiqueta</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CreatePackageModal;