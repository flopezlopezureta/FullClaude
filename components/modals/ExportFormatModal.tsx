
import React from 'react';
import { IconFileSpreadsheet, IconX } from '../Icon';

interface ExportFormatModalProps {
    onClose: () => void;
    onSelect: (format: 'excel' | 'csv') => void;
    isExporting: boolean;
}

const ExportFormatModal: React.FC<ExportFormatModalProps> = ({ onClose, onSelect, isExporting }) => {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--background-secondary)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--brand-primary-subtle)] rounded-lg">
                            <IconFileSpreadsheet className="w-6 h-6 text-[var(--brand-primary)]" />
                        </div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)]">Exportar Información</h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--background-hover)] rounded-full transition-colors"
                        disabled={isExporting}
                    >
                        <IconX className="w-6 h-6 text-[var(--text-secondary)]" />
                    </button>
                </div>

                <div className="p-8">
                    <p className="text-[var(--text-secondary)] mb-8 text-center">
                        Selecciona el formato en el que deseas descargar la información de los paquetes.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => onSelect('excel')}
                            disabled={isExporting}
                            className="flex flex-col items-center justify-center p-6 border-2 border-[var(--border-secondary)] rounded-xl hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-subtle)] transition-all group disabled:opacity-50"
                        >
                            <div className="w-12 h-12 mb-3 flex items-center justify-center bg-green-100 text-green-600 rounded-full group-hover:scale-110 transition-transform">
                                <IconFileSpreadsheet className="w-8 h-8" />
                            </div>
                            <span className="font-bold text-[var(--text-primary)]">Excel (.xlsx)</span>
                        </button>

                        <button
                            onClick={() => onSelect('csv')}
                            disabled={isExporting}
                            className="flex flex-col items-center justify-center p-6 border-2 border-[var(--border-secondary)] rounded-xl hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-subtle)] transition-all group disabled:opacity-50"
                        >
                            <div className="w-12 h-12 mb-3 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full group-hover:scale-110 transition-transform">
                                <IconFileSpreadsheet className="w-8 h-8" />
                            </div>
                            <span className="font-bold text-[var(--text-primary)]">CSV (.csv)</span>
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-[var(--background-hover)] flex justify-end">
                    <button
                        onClick={onClose}
                        disabled={isExporting}
                        className="px-6 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportFormatModal;
