

import React, { useState, useEffect } from 'react';
import { IconX } from '../Icon';
import { PackageStatus, ShippingType } from '../../constants';
import type { Package } from '../../types';
import { PackageUpdateData } from '../../services/api';

interface EditPackageModalProps {
  pkg: Package;
  onClose: () => void;
  onUpdate: (pkgId: string, data: PackageUpdateData) => void;
  isClientEditing?: boolean;
}

const EditPackageModal: React.FC<EditPackageModalProps> = ({ pkg, onClose, onUpdate, isClientEditing = false }) => {
  const [recipientName, setRecipientName] = useState(pkg.recipientName);
  const [recipientPhone, setRecipientPhone] = useState(pkg.recipientPhone);
  const [recipientAddress, setRecipientAddress] = useState(pkg.recipientAddress);
  const [recipientCommune, setRecipientCommune] = useState(pkg.recipientCommune);
  const [recipientCity, setRecipientCity] = useState(pkg.recipientCity);
  const [notes, setNotes] = useState(pkg.notes || '');
  const [origin, setOrigin] = useState(pkg.origin);
  const [status, setStatus] = useState(pkg.status);
  const [shippingType, setShippingType] = useState(pkg.shippingType);
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

  useEffect(() => {
    if (pkg.estimatedDelivery) {
        // Format date to YYYY-MM-DD for the input field
        const date = new Date(pkg.estimatedDelivery);
        const year = date.getFullYear();
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const day = ('0' + date.getDate()).slice(-2);
        setEstimatedDelivery(`${year}-${month}-${day}`);
    }
  }, [pkg.estimatedDelivery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(pkg.id, {
      recipientName,
      recipientPhone,
      recipientAddress,
      recipientCommune,
      recipientCity,
      notes,
      origin,
      status,
      shippingType,
      estimatedDelivery: new Date(estimatedDelivery),
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

  const inputClasses = "w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";
  const disabledInputClasses = `${inputClasses} disabled:bg-[var(--background-muted)]`;


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
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Editar Paquete <span className="text-[var(--brand-primary)]">{pkg.id}</span></h3>
          <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="edit-recipientName" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nombre Destinatario</label>
                    <input type="text" id="edit-recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required className={inputClasses} />
                </div>
                 <div>
                    <label htmlFor="edit-recipientPhone" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Teléfono</label>
                    <input type="tel" id="edit-recipientPhone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} onBlur={handlePhoneBlur} required className={inputClasses} />
                </div>
            </div>
             <div>
              <label htmlFor="edit-recipientAddress" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Dirección</label>
              <input type="text" id="edit-recipientAddress" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} required className={inputClasses} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="edit-recipientCommune" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Comuna</label>
                    <input type="text" id="edit-recipientCommune" value={recipientCommune} onChange={(e) => setRecipientCommune(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label htmlFor="edit-recipientCity" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Ciudad</label>
                    <input type="text" id="edit-recipientCity" value={recipientCity} onChange={(e) => setRecipientCity(e.target.value)} required className={inputClasses} />
                </div>
            </div>

            <div className="pt-2">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tipo de Envío</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(Object.values(ShippingType) as ShippingType[]).map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => setShippingType(type)}
                        className={`px-3 py-2 text-sm font-medium rounded-md border text-center transition-colors ${
                        shippingType === type
                            ? 'bg-[var(--brand-primary)] text-[var(--text-on-brand)] border-[var(--brand-primary)] ring-2 ring-[var(--brand-secondary)]'
                            : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border-secondary)] hover:bg-[var(--background-hover)]'
                        }`}
                    >
                        {type}
                    </button>
                    ))}
                </div>
            </div>

            <div>
              <label htmlFor="edit-origin" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Origen</label>
              <input type="text" id="edit-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} required className={disabledInputClasses} disabled={isClientEditing}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="edit-status" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Estado</label>
                    <select id="edit-status" value={status} onChange={(e) => setStatus(e.target.value as PackageStatus)} className={disabledInputClasses} disabled={isClientEditing}>
                        {Object.values(PackageStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="edit-estimatedDelivery" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Fecha de Entrega Estimada</label>
                    <input type="date" id="edit-estimatedDelivery" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} required className={inputClasses} />
                </div>
            </div>
            <div>
                <label htmlFor="edit-notes" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Notas</label>
                <textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClasses}></textarea>
            </div>
          </div>

          <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">Guardar Cambios</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default EditPackageModal;