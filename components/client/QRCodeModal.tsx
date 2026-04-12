import React, { useEffect, useState, useContext, useMemo } from 'react';
import QRCode from 'qrcode';
import { IconX, IconCube, IconAlertTriangle, IconWhatsapp, IconDownload, IconLoader, IconCheckCircle } from '../Icon';
import { Package, User } from '../../types';
import { AuthContext } from '../../contexts/AuthContext';
import { MessagingPlan } from '../../constants';
import { api } from '../../services/api';

interface QRCodeModalProps {
  pkg: Package;
  onClose: () => void;
  creator?: User | null;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ pkg: initialPkg, onClose, creator }) => {
    const [pkg, setPkg] = useState<Package>(initialPkg);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [error, setError] = useState(false);
    const [loadingTracking, setLoadingTracking] = useState(false);
    const { systemSettings } = useContext(AuthContext)!;

    const isMeli = pkg.source === 'MERCADO_LIBRE';
    
    // If we have an authentic tracking ID, use it directly (no SCA00 prefix needed as it's already the full code)
    // If not, reconstruct it as a fallback.
    const qrContent = useMemo(() => {
        if (isMeli) {
            return pkg.trackingId || `SCA00-${pkg.meliFlexCode || pkg.meliOrderId || pkg.id}`;
        }
        return pkg.trackingId || pkg.id;
    }, [isMeli, pkg]);

    const whatsappUrl = useMemo(() => {
        if (!isMeli || !creator?.phone) return '';
        const phone = creator.phone.replace(/\D/g, '');
        const message = `Hola, somos unidad de soporte de Fullenvios a conductores, uno de los conductores necesita la siguiente etiqueta para realizar la entrega:\n\n*Destinatario:* ${pkg.recipientName}\n*Dirección:* ${pkg.recipientAddress}, ${pkg.recipientCommune}\n*ID de Envío (ML):* ${pkg.meliOrderId}\n\nGracias.`;
        return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    }, [isMeli, creator, pkg]);

    // Fetch authentic ML tracking tracking if missing
    useEffect(() => {
        const fetchMeliTracking = async () => {
            if (isMeli && !pkg.trackingId) {
                setLoadingTracking(true);
                try {
                    const result = await api.getMeliTracking(pkg.id);
                    if (result.trackingId) {
                        setPkg(prev => ({ ...prev, trackingId: result.trackingId }));
                    }
                } catch (err: any) {
                    console.error('Error fetching ML tracking:', err);
                } finally {
                    setLoadingTracking(false);
                }
            }
        };
        fetchMeliTracking();
    }, [isMeli, pkg.id, pkg.trackingId]);

    useEffect(() => {
        const generateQR = async () => {
            try {
                const url = await QRCode.toDataURL(qrContent || '', {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    width: 600,
                    margin: 2,
                    color: { dark: '#000000', light: '#ffffff' }
                });
                setQrCodeUrl(url);
                setError(false);
            } catch (err) {
                console.error('Failed to generate QR code', err);
                setError(true);
            }
        };
        if (qrContent) {
            generateQR();
        }
    }, [qrContent]);

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col justify-center items-center p-4 animate-fade-in-up"
            onClick={onClose}
            style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-50"
                aria-label="Cerrar"
            >
                <IconX className="w-8 h-8" />
            </button>

            <div 
                className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col items-center max-w-lg w-full relative max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {isMeli ? (
                    <>
                        <div className="flex items-center gap-3 mb-6">
                            <img src="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.18.9/mercadolibre/logo__small.png" alt="ML" className="h-8" />
                            <h3 className="text-2xl font-black text-slate-900 text-center">Información de Entrega Flex</h3>
                        </div>
                        
                        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-left">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">
                                Datos del Destinatario
                            </h4>
                            <div className="space-y-2 text-sm text-slate-700">
                                <p><strong>Destinatario:</strong> <span className="font-bold text-slate-900">{pkg.recipientName}</span></p>
                                <p><strong>Dirección:</strong> <span className="font-medium text-slate-900">{pkg.recipientAddress}, {pkg.recipientCommune}</span></p>
                                <p><strong>ID Envío (ML):</strong> <span className="font-mono font-bold text-slate-900">{pkg.meliFlexCode || pkg.meliOrderId}</span></p>
                            </div>
                        </div>

                        <div className="relative group mb-6">
                            <div className={`bg-white p-4 border-4 ${pkg.trackingId ? 'border-green-500' : 'border-slate-900'} rounded-2xl shadow-xl transition-all duration-500 overflow-hidden`}>
                                {qrCodeUrl && !error ? (
                                    <div className="relative">
                                        <img src={qrCodeUrl} alt={`QR Code ${qrContent}`} className={`w-56 h-56 object-contain ${loadingTracking ? 'opacity-20 grayscale brightness-50' : 'opacity-100'}`} />
                                        {loadingTracking && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-900">
                                                <IconLoader className="w-10 h-10 animate-spin mb-2" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter">Autenticando QR...</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-56 h-56 flex items-center justify-center bg-slate-100 text-slate-400 font-bold">
                                        {error ? 'Error QR' : 'Generando...'}
                                    </div>
                                )}
                            </div>
                            
                            <div className={`mt-3 text-center transition-all duration-500 ${pkg.trackingId ? 'text-green-600' : 'text-slate-400'}`}>
                                {pkg.trackingId ? (
                                    <div className="flex items-center justify-center gap-1.5 animate-bounce-slow">
                                        <IconCheckCircle className="w-4 h-4" />
                                        <span className="text-[11px] font-black uppercase tracking-widest leading-none">Código Original Validado</span>
                                    </div>
                                ) : (
                                    <span className="text-[11px] font-bold uppercase tracking-widest">Código de Respaldo (Reconstruido)</span>
                                )}
                            </div>
                        </div>

                        <div className="w-full space-y-3">
                            {/* Botón Etiqueta Oficial */}
                            <button 
                                onClick={() => {
                                    const labelUrl = `${window.location.origin}${api.getMeliLabelUrl(pkg.id)}`;
                                    if ((window as any).AndroidApp?.openUrl) {
                                        (window as any).AndroidApp.openUrl(labelUrl);
                                    } else {
                                        window.open(labelUrl, '_blank');
                                    }
                                }}
                                className="flex items-center justify-center w-full bg-slate-900 hover:bg-black text-white p-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] group"
                            >
                                <IconDownload className="w-6 h-6 mr-3 group-hover:animate-bounce" />
                                <span className="text-lg font-black uppercase tracking-tight">Etiqueta Oficial ML (PDF)</span>
                            </button>

                            {/* Botón WhatsApp (Fallback) */}
                            {creator?.phone && systemSettings.messagingPlan === MessagingPlan.WhatsApp && (
                                <a 
                                    href={whatsappUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center w-full bg-green-500/10 hover:bg-green-500/20 text-green-700 p-3 rounded-xl transition-colors border border-green-200"
                                >
                                    <IconWhatsapp className="w-5 h-5 mr-2" />
                                    <span className="text-sm font-bold">Solicitar al Vendedor</span>
                                </a>
                            )}
                        </div>

                        {!creator?.phone && (
                            <p className="text-[10px] text-slate-400 mt-4 text-center italic">
                                * Si el código no funciona, recuerda que puedes descargar la etiqueta oficial arriba.
                            </p>
                        )}
                        
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-3 mb-6">
                            <IconCube className="w-12 h-12 text-blue-600"/>
                            <h3 className="text-4xl font-bold text-slate-900">{systemSettings.companyName}</h3>
                        </div>
                         <div className="w-full bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 mb-6 rounded-r-lg">
                            <div className="flex">
                                <div className="py-1">
                                    <IconAlertTriangle className="h-6 w-6 text-yellow-500 mr-4"/>
                                </div>
                                <div className="text-left">
                                    <p className="font-bold">Código para Uso Interno</p>
                                    <p className="text-sm mt-1">
                                        Escanea <strong>solo</strong> con nuestra aplicación.
                                        La app de Mercado Libre Flex no reconocerá este código.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-4 border-8 border-slate-900 rounded-2xl shadow-inner mb-6">
                            {qrCodeUrl && !error ? (
                                <img src={qrCodeUrl} alt={`QR Code ${qrContent}`} className="w-96 h-96 object-contain rendering-pixelated" />
                            ) : (
                                <div className="w-96 h-96 flex items-center justify-center bg-slate-100 text-slate-400">
                                    {error ? 'Error' : 'Generando...'}
                                </div>
                            )}
                        </div>
                        <div className="text-center w-full bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="text-sm text-slate-500 uppercase font-bold mb-2 tracking-wider">ID INTERNO</p>
                            <div className="font-mono text-5xl font-black text-slate-900 tracking-widest select-all">
                                {pkg.id}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default QRCodeModal;