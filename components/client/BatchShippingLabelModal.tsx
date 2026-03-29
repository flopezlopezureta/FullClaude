import React, { useEffect, useState, useContext } from 'react';
import { IconX, IconPrinter } from '../Icon';
import { Package } from '../../types';
import ShippingLabel from './ShippingLabel';
import { LabelFormat, PackageSource } from '../../constants';
import { AuthContext } from '../../contexts/AuthContext';
import { api } from '../../services/api';

interface BatchShippingLabelModalProps {
  packages: Package[];
  creatorName: string;
  onClose: () => void;
}

const formatOptions = [
    { id: LabelFormat.CompactThermal, name: 'Térmica Económica', size: '100x150mm' },
    { id: LabelFormat.FullThermal, name: 'Térmica Completa', size: '100x150mm' },
    { id: LabelFormat.ZebraZpl, name: 'Zebra (ZPL Layout)', size: '4"x6"' },
    { id: LabelFormat.A4Single, name: 'Hoja Completa A4', size: '210x297mm' },
    { id: LabelFormat.A4Half, name: 'Mitad de Hoja A4', size: '210x148mm' },
    { id: LabelFormat.MinimalSticker, name: 'Sticker Pequeño', size: '62x100mm' },
];

const BatchShippingLabelModal: React.FC<BatchShippingLabelModalProps> = ({ packages: initialPackages, creatorName, onClose }) => {
    const { systemSettings } = useContext(AuthContext)!;
    const [packages, setPackages] = useState<Package[]>(initialPackages);
    const [format, setFormat] = useState<LabelFormat>(systemSettings.labelFormat || LabelFormat.CompactThermal);
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const [progress, setProgress] = useState(0);

    // Effect to fetch authentic ML tracking IDs for all packages in batch
    useEffect(() => {
        const fetchAllMeliTrackings = async () => {
             const mlPackages = initialPackages.filter(p => p.source === PackageSource.MercadoLibre && !p.trackingId);
             if (mlPackages.length === 0) return;

             setLoadingIds(new Set(mlPackages.map(p => p.id)));
             
             for (let i = 0; i < mlPackages.length; i++) {
                 const pkg = mlPackages[i];
                 try {
                     const result = await api.getMeliTracking(pkg.id);
                     if (result.trackingId) {
                         setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, trackingId: result.trackingId } : p));
                     }
                 } catch (err) {
                     console.error(`Error fetching ML tracking for ${pkg.id}:`, err);
                 } finally {
                     setLoadingIds(prev => {
                         const next = new Set(prev);
                         next.delete(pkg.id);
                         return next;
                     });
                     setProgress(Math.round(((i + 1) / mlPackages.length) * 100));
                 }
             }
        };
        fetchAllMeliTrackings();
    }, [initialPackages]);

    const handlePrint = () => {
        window.print();
    };

    const isScaleFormat = format === LabelFormat.CompactThermal || format === LabelFormat.FullThermal || format === LabelFormat.ZebraZpl || format === LabelFormat.MinimalSticker;

    return (
        <>
        <div
            className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4 print:hidden backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-[var(--background-secondary)] rounded-2xl shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col animate-fade-in-up border border-[var(--border-primary)]"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-5 border-b border-[var(--border-primary)]">
                    <div className="flex items-center space-x-3">
                         <div className="p-2.5 bg-indigo-100 rounded-lg">
                            <IconPrinter className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">Impresión Masiva</h3>
                            <p className="text-xs text-[var(--text-muted)] font-medium">Imprimiendo {packages.length} etiquetas</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 bg-[var(--background-muted)] px-3 py-1.5 rounded-xl border border-[var(--border-primary)]">
                         <span className="text-xs font-bold text-[var(--text-muted)]">Formato:</span>
                         <select 
                            value={format} 
                            onChange={(e) => setFormat(e.target.value as LabelFormat)}
                            className="bg-transparent border-none text-sm font-black text-[var(--text-primary)] focus:ring-0 cursor-pointer"
                         >
                            {formatOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name} ({opt.size})</option>)}
                         </select>
                    </div>

                    <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)] transition-all">
                        <IconX className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-10 bg-[var(--background-muted)] custom-scrollbar">
                    {loadingIds.size > 0 && (
                        <div className="mb-6 bg-[var(--background-secondary)] p-4 rounded-xl border border-[var(--brand-primary)] shadow-sm animate-pulse">
                             <div className="flex justify-between items-center mb-2">
                                <p className="text-sm font-bold text-[var(--brand-primary)]">Obteniendo códigos auténticos de Mercado Libre...</p>
                                <p className="text-xs font-black">{progress}%</p>
                             </div>
                             <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                <div className="bg-[var(--brand-primary)] h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                             </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start justify-items-center">
                        {packages.map((pkg) => (
                            <div key={pkg.id} className={`bg-white shadow-lg relative ${isScaleFormat ? 'scale-75 origin-top' : 'w-full'}`}>
                                <div className="absolute top-2 right-2 flex space-x-1 print:hidden">
                                     {loadingIds.has(pkg.id) && <div className="w-4 h-4 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>}
                                     {pkg.source === PackageSource.MercadoLibre && !loadingIds.has(pkg.id) && pkg.trackingId && <div className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">QR ML OK</div>}
                                </div>
                                <ShippingLabel pkg={pkg} creatorName={creatorName} format={format} />
                            </div>
                        ))}
                    </div>
                </div>

                <footer className="px-8 py-5 bg-[var(--background-secondary)] rounded-b-2xl flex justify-between items-center border-t border-[var(--border-primary)]">
                    <p className="text-xs font-bold text-[var(--text-muted)] italic">CONSEJO: Ajusta las pestañas de tu impresora para el tamaño {formatOptions.find(o => o.id === format)?.size}</p>
                    <div className="flex space-x-3">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-[var(--text-secondary)] bg-[var(--background-secondary)] border-2 border-[var(--border-secondary)] rounded-xl hover:bg-[var(--background-hover)]">Cancelar</button>
                        <button 
                            type="button" 
                            disabled={loadingIds.size > 0}
                            onClick={handlePrint} 
                            className="px-8 py-2.5 text-sm font-black text-white bg-[var(--brand-primary)] rounded-xl shadow-lg hover:translate-y-[-2px] transition-all disabled:opacity-50"
                        >
                            Imprimir {packages.length} Etiquetas
                        </button>
                    </div>
                </footer>
            </div>
        </div>
        
        {/* Printable Area */}
        <div className={`hidden print:block batch-print-container format-${format}`}>
            {packages.map((pkg, idx) => (
                <div key={pkg.id} className={`print-page-break label-wrapper ${idx === packages.length - 1 ? 'last-label' : ''}`}>
                    <ShippingLabel pkg={pkg} creatorName={creatorName} format={format} />
                </div>
            ))}
        </div>

        <style>{`
            @media print {
              @page {
                margin: 0;
                padding: 0;
                ${format === LabelFormat.CompactThermal || format === LabelFormat.FullThermal || format === LabelFormat.ZebraZpl ? 'size: 100mm 150mm;' : ''}
                ${format === LabelFormat.A4Single ? 'size: 210mm 297mm;' : ''}
                ${format === LabelFormat.A4Half ? 'size: 210mm 148.5mm;' : ''}
                ${format === LabelFormat.MinimalSticker ? 'size: 62mm 100mm;' : ''}
              }
              body * {
                visibility: hidden;
              }
              .batch-print-container, .batch-print-container * {
                visibility: visible !important;
              }
              .batch-print-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              .print-page-break {
                page-break-after: always;
                display: flex !important;
                align-items: center;
                justify-content: center;
              }
              .label-wrapper {
                 width: 100%;
                 height: 100vh;
              }
              .last-label {
                page-break-after: avoid;
              }
            }
        `}</style>
        </>
    );
};

export default BatchShippingLabelModal;
