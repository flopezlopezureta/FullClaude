
import React from 'react';
import { IconX } from '../Icon';
import { Package } from '../../types';
import ShippingLabel from './ShippingLabel';

interface ShippingLabelModalProps {
  pkg: Package;
  creatorName: string;
  onClose: () => void;
}

const ShippingLabelModal: React.FC<ShippingLabelModalProps> = ({ pkg, creatorName, onClose }) => {
    const handlePrint = () => {
        window.print();
    };

    return (
        <>
        <div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 print:hidden"
            onClick={onClose}
        >
            <div
                className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg h-[90vh] flex flex-col animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Etiqueta de Envío</h3>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
                        <IconX className="w-6 h-6" />
                    </button>
                </header>

                <div className="p-6 overflow-y-auto flex-1 bg-[var(--background-muted)] flex items-center justify-center">
                    <div className="w-full">
                         <ShippingLabel pkg={pkg} creatorName={creatorName} />
                    </div>
                </div>

                <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3 border-t border-[var(--border-primary)]">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cerrar</button>
                    <button type="button" onClick={handlePrint} className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">Imprimir</button>
                </footer>
            </div>
        </div>
        
        {/* Printable Area */}
        <div className="hidden print:block">
            <ShippingLabel pkg={pkg} creatorName={creatorName} />
        </div>
        <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .print\\:block, .print\\:block * {
                visibility: visible;
              }
              .print\\:block {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
            }
        `}</style>
        </>
    );
};

export default ShippingLabelModal;
