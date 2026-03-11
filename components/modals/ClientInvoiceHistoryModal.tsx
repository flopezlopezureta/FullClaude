
import React, { useState } from 'react';
import { User, Invoice } from '../../types';
import { IconX, IconFileInvoice, IconChevronDown } from '../Icon';

interface ClientInvoiceHistoryModalProps {
  client: User;
  onClose: () => void;
}

const InvoiceItem: React.FC<{ invoice: Invoice }> = ({ invoice }) => {
    const [isOpen, setIsOpen] = useState(false);
    const totalAmount = invoice.amount + (invoice.pickupCostTotal || 0);
    const subtext = `${invoice.packageIds.length} paquetes` + (invoice.pickupCount ? ` y ${invoice.pickupCount} ${invoice.pickupCount > 1 ? 'retiros' : 'retiro'}` : '');

    return (
        <div className="border border-[var(--border-primary)] rounded-md">
            <button 
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--background-hover)]"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex-1">
                    <p className="font-semibold text-[var(--text-primary)]">Factura #{invoice.id.split('-')[1]}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                        {new Date(invoice.date).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-[var(--brand-primary)] text-lg">
                        {totalAmount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{subtext}</p>
                </div>
                <IconChevronDown className={`w-5 h-5 text-[var(--text-muted)] ml-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--background-muted)]">
                    <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Desglose:</h4>
                    <div className="text-sm space-y-1 mb-3">
                        <div className="flex justify-between"><span>Subtotal Entregas:</span> <span className="font-medium">{invoice.amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span></div>
                        {invoice.pickupCount && (
                             <div className="flex justify-between"><span>Subtotal Retiros:</span> <span className="font-medium">{(invoice.pickupCostTotal || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span></div>
                        )}
                    </div>

                    <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Paquetes Incluidos:</h4>
                    <ul className="text-xs text-[var(--text-muted)] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                        {invoice.packageIds.map(id => <li key={id} className="font-mono bg-[var(--background-secondary)] p-1 rounded border border-[var(--border-primary)]">{id}</li>)}
                    </ul>
                </div>
            )}
        </div>
    )
}

const ClientInvoiceHistoryModal: React.FC<ClientInvoiceHistoryModalProps> = ({ client, onClose }) => {
  const invoices = client.invoices || [];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Historial de Facturación</h3>
            <p className="text-sm text-[var(--text-muted)]">Cliente: <span className="font-semibold">{client.name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
            {invoices.length === 0 ? (
                <div className="text-center py-12">
                    <IconFileInvoice className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
                    <h3 className="mt-2 text-sm font-medium text-[var(--text-primary)]">Sin Facturas</h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">Este cliente aún no tiene facturas registradas.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {invoices.map(invoice => (
                        <InvoiceItem key={invoice.id} invoice={invoice} />
                    ))}
                </div>
            )}
        </div>

        <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ClientInvoiceHistoryModal;
