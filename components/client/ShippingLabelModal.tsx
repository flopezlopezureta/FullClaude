
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
    const [format, setFormat] = React.useState<'standard' | 'thermal_4x6'>('standard');

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
                className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                    <div className="flex flex-col">
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Etiqueta de Envío</h3>
                        <p className="text-xs text-[var(--text-muted)]">Configura el formato antes de imprimir</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
                        <IconX className="w-6 h-6" />
                    </button>
                </header>

                <div className="p-4 bg-[var(--background-muted)] border-b border-[var(--border-primary)] flex items-center justify-center space-x-4">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">Formato:</span>
                    <div className="flex bg-[var(--background-secondary)] p-1 rounded-lg border border-[var(--border-secondary)]">
                        <button 
                            onClick={() => setFormat('standard')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${format === 'standard' ? 'bg-[var(--brand-primary)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                            Estándar (A4/Carta)
                        </button>
                        <button 
                            onClick={() => setFormat('thermal_4x6')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${format === 'thermal_4x6' ? 'bg-[var(--brand-primary)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                            Térmica 4x6 (Zebra)
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-[var(--background-muted)] flex items-center justify-center">
                    <div className={format === 'thermal_4x6' ? 'scale-75 origin-center' : 'w-full'}>
                         <ShippingLabel pkg={pkg} creatorName={creatorName} format={format} />
                    </div>
                </div>

                <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3 border-t border-[var(--border-primary)]">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cerrar</button>
                    <button type="button" onClick={handlePrint} className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-primary)] border border-transparent rounded-md shadow-sm hover:bg-[var(--brand-secondary)]">Imprimir Etiqueta</button>
                </footer>
            </div>
        </div>
        
        {/* Printable Area */}
        <div className={`hidden print:block ${format === 'thermal_4x6' ? 'print-thermal-4x6' : ''}`}>
            <ShippingLabel pkg={pkg} creatorName={creatorName} format={format} />
        </div>
        <style>{`
            @media print {
              @page {
                margin: 0;
                size: ${format === 'thermal_4x6' ? '100mm 150mm' : 'auto'};
              }
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
                height: 100%;
                display: flex !important;
                align-items: center;
                justify-content: center;
              }
              .print-thermal-4x6 {
                width: 100mm !important;
                height: 150mm !important;
              }
            }
        `}</style>
        </>
    );
};

export default ShippingLabelModal;
