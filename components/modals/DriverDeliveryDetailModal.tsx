
import React, { useState } from 'react';
import { Package } from '../../types';
import { PackageStatus } from '../../constants';
import { IconX, IconSearch, IconEye, IconFileText, IconClock, IconHistory } from '../Icon';

interface DriverDeliveryDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    packages: Package[];
    driverName: string;
    startDate: string;
    endDate: string;
}

const DriverDeliveryDetailModal: React.FC<DriverDeliveryDetailModalProps> = ({
    isOpen,
    onClose,
    packages,
    driverName,
    startDate,
    endDate
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
    const [viewingHistory, setViewingHistory] = useState<Package | null>(null);

    if (!isOpen) return null;

    const filtered = packages.filter(pkg => 
        pkg.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getDeliveryDate = (pkg: Package) => {
        const deliveryEvent = pkg.history.find(e => e.status === PackageStatus.Delivered) || pkg.history[0];
        if (!deliveryEvent) return 'N/A';
        return new Date(deliveryEvent.timestamp).toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <>
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[var(--background-primary)] w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[var(--border-primary)] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Detalle Profesional de Entregas</h2>
                        <p className="text-blue-100 text-[10px] font-bold mt-0.5 uppercase tracking-wider">
                            Conductor: {driverName} • Periodo: {startDate} al {endDate}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                        <IconX className="w-6 h-6" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-[var(--border-primary)] bg-[var(--background-secondary)] flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full sm:w-96">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text"
                            placeholder="Buscar por nombre o ID de paquete..."
                            className="w-full pl-10 pr-4 py-2 border border-[var(--border-secondary)] rounded-xl text-sm font-bold bg-[var(--background-primary)] focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                            <span className="text-[10px] font-black text-blue-600 uppercase">Total:</span>
                            <span className="text-sm font-black text-blue-800">{filtered.length}</span>
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-[var(--background-primary)]">
                    <div className="border border-[var(--border-primary)] rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[var(--background-muted)] sticky top-0 z-10 border-b border-[var(--border-primary)]">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">ID Paquete</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Destinatario</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Comuna</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha/Hora Entrega</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo Envío</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Evidencia</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Historial</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)] bg-white">
                                {filtered.map(pkg => (
                                    <tr key={pkg.id} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-4 py-4">
                                            <span className="text-[11px] font-bold font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                {pkg.id}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="text-sm font-black text-gray-900 leading-none">{pkg.recipientName}</p>
                                            <p className="text-[10px] text-gray-400 mt-1.5 font-medium truncate max-w-[200px]">{pkg.recipientAddress}</p>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="px-2 py-0.5 bg-gray-900 text-white rounded text-[9px] font-black uppercase tracking-wider">
                                                {pkg.recipientCommune}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <IconClock className="w-3.5 h-3.5 text-blue-500" />
                                                <span className="text-xs font-bold text-gray-700">{getDeliveryDate(pkg)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${
                                                pkg.shippingType === 'SAME_DAY' ? 'bg-orange-100 text-orange-700' :
                                                pkg.shippingType === 'EXPRESS' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                                            }`}>
                                                {pkg.shippingType === 'SAME_DAY' ? 'En el día' : pkg.shippingType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {pkg.deliveryPhotosBase64 && pkg.deliveryPhotosBase64.length > 0 ? (
                                                <button 
                                                    onClick={() => setViewingPhoto(pkg.deliveryPhotosBase64![0])}
                                                    className="p-1.5 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all border border-blue-200 shadow-sm"
                                                    title="Ver Foto de Entrega"
                                                >
                                                    <IconEye className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <div className="flex items-center justify-center gap-1 text-gray-300">
                                                    <span className="text-[9px] font-black uppercase">Sin Foto</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button 
                                                onClick={() => setViewingHistory(pkg)}
                                                className="p-1.5 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all border border-indigo-200 shadow-sm"
                                                title="Ver Historial Completo"
                                            >
                                                <IconHistory className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filtered.length === 0 && (
                            <div className="py-24 text-center flex flex-col items-center bg-white">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <IconFileText className="w-8 h-8 text-gray-200" />
                                </div>
                                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No se encontraron entregas</p>
                                <p className="text-xs text-gray-300 mt-1">Prueba con otro término de búsqueda</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-[var(--background-muted)] border-t border-[var(--border-primary)] flex justify-between items-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Full Envios Logistics System v2.5
                    </p>
                    <button 
                        onClick={onClose}
                        className="px-8 py-2.5 bg-gray-900 text-white text-xs font-black rounded-xl hover:bg-gray-800 transition-all shadow-md active:scale-95 uppercase tracking-widest"
                    >
                        Cerrar Detalle
                    </button>
                </div>
            </div>
        </div>

        {/* Photo Overlay */}
        {viewingPhoto && (
            <div 
                className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-300"
                onClick={() => setViewingPhoto(null)}
            >
                <button
                    onClick={() => setViewingPhoto(null)}
                    className="absolute top-6 right-6 p-3 rounded-full text-white bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all shadow-xl"
                >
                    <IconX className="w-8 h-8" />
                </button>
                <img 
                    src={viewingPhoto} 
                    alt="Evidencia en tamaño completo" 
                    className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border-4 border-white/20 animate-in zoom-in duration-300"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        )}
        {/* History Overlay */}
        {viewingHistory && (
            <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                    <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white flex justify-between items-center">
                        <div>
                            <h3 className="font-black uppercase tracking-tight text-sm">Historial de Envío</h3>
                            <p className="text-indigo-200 text-[10px] font-bold uppercase">{viewingHistory.id}</p>
                        </div>
                        <button 
                            onClick={() => setViewingHistory(null)}
                            className="p-1.5 hover:bg-white/10 rounded-full transition-all"
                        >
                            <IconX className="w-5 h-5"/>
                        </button>
                    </div>
                    <div className="p-6 overflow-auto custom-scrollbar flex-1 bg-gray-50">
                        <div className="space-y-4">
                            {(() => {
                                const fullHistory = [...viewingHistory.history];
                                // Add virtual creation event if missing
                                const hasCreationEvent = fullHistory.some(e => 
                                    e.status.toUpperCase() === 'CREADO' || 
                                    e.status.toUpperCase() === 'PENDIENTE'
                                );
                                
                                if (!hasCreationEvent && viewingHistory.createdAt) {
                                    fullHistory.push({
                                        status: 'Creado',
                                        timestamp: viewingHistory.createdAt,
                                        details: 'Paquete registrado en el sistema.',
                                        location: viewingHistory.origin,
                                        packageId: viewingHistory.id
                                    } as any);
                                }

                                // Sort chronological (ASC)
                                const sortedHistory = fullHistory.sort((a, b) => 
                                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                                );

                                if (sortedHistory.length > 0) {
                                    return sortedHistory.map((event, i) => (
                                        <div key={i} className="flex gap-4 relative">
                                            {/* Line indicator */}
                                            {i !== sortedHistory.length - 1 && (
                                                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-indigo-100"></div>
                                            )}
                                            
                                            <div className={`z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0 ${
                                                i === sortedHistory.length - 1 ? 'bg-indigo-600 text-white animate-pulse' : 'bg-indigo-100 text-indigo-400'
                                            }`}>
                                                <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                                            </div>
                                            
                                            <div className="flex-1 pb-4">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className={`text-[11px] font-black uppercase tracking-tighter ${i === sortedHistory.length - 1 ? 'text-indigo-600' : 'text-gray-600'}`}>
                                                        {event.status}
                                                    </p>
                                                    <p className="text-[9px] text-gray-400 font-bold bg-white px-1.5 py-0.5 rounded border border-gray-100">
                                                        {new Date(event.timestamp).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-gray-700 font-medium leading-relaxed bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                    {event.details}
                                                </p>
                                                {event.location && (
                                                    <p className="text-[9px] text-gray-400 font-black mt-1 uppercase flex items-center gap-1">
                                                        📍 {event.location}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ));
                                } else {
                                    return (
                                        <div className="text-center py-10">
                                            <p className="text-xs font-bold text-gray-400 uppercase">Sin eventos registrados</p>
                                        </div>
                                    );
                                }
                            })()}
                        </div>
                    </div>
                    <div className="p-4 bg-white border-t border-gray-100 text-center">
                        <button 
                            onClick={() => setViewingHistory(null)}
                            className="w-full py-2.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-800 transition-all"
                        >
                            Volver al Listado
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default DriverDeliveryDetailModal;
