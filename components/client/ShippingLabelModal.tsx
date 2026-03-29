import React, { useEffect, useState, useContext } from 'react';
import { IconX, IconCheck, IconSettings } from '../Icon';
import { Package } from '../../types';
import ShippingLabel from './ShippingLabel';
import { LabelFormat, PackageSource } from '../../constants';
import { AuthContext } from '../../contexts/AuthContext';
import { api } from '../../services/api';

interface ShippingLabelModalProps {
  pkg: Package;
  creatorName: string;
  onClose: () => void;
}

const formatOptions = [
    { id: LabelFormat.CompactThermal, name: 'Zebra Económica', size: '100x150mm', desc: 'Datos esenciales, bajo consumo' },
    { id: LabelFormat.FullThermal, name: 'Zebra Pro (Notas)', size: '100x150mm', desc: 'Incluye todas las notas y RUT' },
    { id: LabelFormat.ZebraZpl, name: 'Zebra Logística XL', size: '4"x6"', desc: 'Comuna extra grande para bodega' },
    { id: LabelFormat.A4Single, name: 'Carta Individual', size: 'Carta / A4', desc: '1 etiqueta centrada' },
    { id: LabelFormat.A4Half, name: 'Carta Dúplex (2x)', size: 'Carta / A4x2', desc: '2 etiquetas por hoja' },
    { id: LabelFormat.MinimalSticker, name: 'Carta Cuádruple (4x)', size: 'Carta / A4x4', desc: '4 etiquetas por hoja' },
];

const ShippingLabelModal: React.FC<ShippingLabelModalProps> = ({ pkg: initialPkg, creatorName, onClose }) => {
    const { systemSettings } = useContext(AuthContext)!;
    const [pkg, setPkg] = useState<Package>(initialPkg);
    const [format, setFormat] = useState<LabelFormat>(systemSettings.labelFormat || LabelFormat.CompactThermal);
    const [loadingTracking, setLoadingTracking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Effect to fetch authentic ML tracking ID if missing
    useEffect(() => {
        const fetchMeliTracking = async () => {
            if (initialPkg.source === PackageSource.MercadoLibre && !initialPkg.trackingId) {
                setLoadingTracking(true);
                try {
                    const result = await api.getMeliTracking(initialPkg.id);
                    if (result.trackingId) {
                        setPkg(prev => ({ ...prev, trackingId: result.trackingId }));
                    }
                } catch (err: any) {
                    console.error('Error fetching ML tracking:', err);
                    setError('No se pudo obtener el QR original de Mercado Libre. Se usará el ID de respaldo.');
                } finally {
                    setLoadingTracking(false);
                }
            }
        };
        fetchMeliTracking();
    }, [initialPkg]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
        <div
            className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4 print:hidden backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-[var(--background-secondary)] rounded-2xl shadow-2xl w-full max-w-4xl h-[95vh] flex flex-col animate-fade-in-up border border-[var(--border-primary)]"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-5 border-b border-[var(--border-primary)]">
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-[var(--brand-muted)] rounded-lg">
                            <IconSettings className="w-6 h-6 text-[var(--brand-text)]" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">Formato de Datos de Envío</h3>
                            <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">
                                {loadingTracking ? 'Obteniendo QR auténtico de ML...' : 'Selecciona el diseño de información'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)] transition-colors">
                        <IconX className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex flex-1 min-h-0 bg-[var(--background-muted)] overflow-hidden">
                    {/* Format Selector Sidebar */}
                    <div className="w-72 bg-[var(--background-secondary)] border-r border-[var(--border-primary)] p-4 overflow-y-auto space-y-2">
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-2 mb-2 italic">Formatos Disponibles</p>
                        {formatOptions.map((opt) => (
                            <button 
                                key={opt.id}
                                onClick={() => setFormat(opt.id)}
                                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex flex-col relative ${
                                    format === opt.id 
                                    ? 'border-[var(--brand-primary)] bg-[var(--brand-muted)]' 
                                    : 'border-transparent hover:bg-[var(--background-hover)]'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`text-sm font-bold ${format === opt.id ? 'text-[var(--brand-text)]' : 'text-[var(--text-primary)]'}`}>
                                        {opt.name}
                                    </span>
                                    {format === opt.id && <IconCheck className="w-4 h-4 text-[var(--brand-primary)]" />}
                                </div>
                                <span className="text-[10px] font-medium text-[var(--text-muted)] mt-1">{opt.size} • {opt.desc}</span>
                            </button>
                        ))}

                        {error && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-[10px] text-red-600 font-bold leading-tight">{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 overflow-auto p-12 flex flex-col items-center justify-start custom-scrollbar">
                        <div className="bg-white shadow-2xl ring-8 ring-white ring-opacity-10 scale-90 origin-top transform transition-transform duration-300">
                             <ShippingLabel pkg={pkg} creatorName={creatorName} format={format} />
                        </div>
                    </div>
                </div>

                <footer className="px-8 py-5 bg-[var(--background-secondary)] rounded-b-2xl flex justify-between items-center border-t border-[var(--border-primary)]">
                    <div className="flex items-center space-x-2 text-[var(--text-muted)]">
                       {loadingTracking ? (
                           <>
                               <div className="w-4 h-4 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
                               <span className="text-xs font-bold">Autenticando QR...</span>
                           </>
                       ) : (
                           <span className="text-xs font-bold text-[var(--text-primary)]">LISTO PARA IMPRIMIR</span>
                       )}
                    </div>
                    <div className="flex space-x-3">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-[var(--text-secondary)] bg-[var(--background-secondary)] border-2 border-[var(--border-secondary)] rounded-xl hover:bg-[var(--background-hover)] transition-all">Cerrar</button>
                        <button 
                            type="button" 
                            onClick={handlePrint} 
                            disabled={loadingTracking}
                            className={`px-8 py-2.5 text-sm font-black text-white bg-[var(--brand-primary)] rounded-xl shadow-[0_4px_12px_rgba(var(--brand-primary-rgb),0.3)] hover:translate-y-[-2px] active:translate-y-[0] transition-all disabled:opacity-50 disabled:grayscale`}
                        >
                            Imprimir Formato {format.split('_').join(' ').toUpperCase()}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
        
        {/* Printable Area */}
        <div className={`hidden print:block label-print-container format-${format}`}>
            <ShippingLabel pkg={pkg} creatorName={creatorName} format={format} />
        </div>

        <style>{`
            @media print {
              @page {
                margin: 0;
                padding: 0;
                ${format === LabelFormat.CompactThermal || format === LabelFormat.FullThermal || format === LabelFormat.ZebraZpl ? 'size: 100mm 150mm; margin: 0;' : ''}
                ${format === LabelFormat.A4Single ? 'size: 210mm 297mm; margin: 10mm;' : ''}
                ${format === LabelFormat.A4Half ? 'size: 210mm 297mm; margin: 0;' : ''}
                ${format === LabelFormat.MinimalSticker ? 'size: 62mm 100mm; margin: 0;' : ''}
              }
              body * {
                visibility: hidden;
              }
              .label-print-container, .label-print-container * {
                visibility: visible !important;
              }
              .label-print-container {
                position: fixed;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                display: flex !important;
                align-items: center;
                justify-content: center;
                margin: 0 !important;
                padding: 0 !important;
              }
            }
        `}</style>
        </>
    );
};

export default ShippingLabelModal;
