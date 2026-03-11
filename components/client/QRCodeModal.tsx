

import React, { useEffect, useState, useContext, useMemo } from 'react';
import QRCode from 'qrcode';
import { IconX, IconCube, IconMercadoLibre, IconAlertTriangle, IconPhone, IconUser, IconWhatsapp } from '../Icon';
import { Package, User } from '../../types';
import { AuthContext } from '../../contexts/AuthContext';

interface QRCodeModalProps {
  pkg: Package;
  onClose: () => void;
  creator?: User | null;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ pkg, onClose, creator }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [error, setError] = useState(false);
    const { systemSettings } = useContext(AuthContext)!;

    const isMeli = !!pkg.meliOrderId;
    const qrContent = isMeli ? `https://mercadoenvios.com/flex/shipping/${String(pkg.meliOrderId).trim()}` : pkg.id;

    const whatsappUrl = useMemo(() => {
        if (!isMeli || !creator?.phone) return '';
        const phone = creator.phone.replace(/\D/g, '');
        const message = `Hola, somos unidad de soporte de Fullenvios a conductores, uno de los conductores necesita la siguiente etiqueta para realizar la entrega:\n\n*Destinatario:* ${pkg.recipientName}\n*Dirección:* ${pkg.recipientAddress}, ${pkg.recipientCommune}\n*ID de Envío (ML):* ${pkg.meliOrderId}\n\nGracias.`;
        return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    }, [isMeli, creator, pkg]);

    useEffect(() => {
        if (isMeli) return; // Do not generate QR for Mercado Libre packages
        
        const generateQR = async () => {
            try {
                const url = await QRCode.toDataURL(qrContent || '', {
                    errorCorrectionLevel: 'L',
                    type: 'image/png',
                    width: 600,
                    margin: 2,
                    color: { dark: '#000000', light: '#ffffff' }
                });
                setQrCodeUrl(url);
            } catch (err) {
                console.error('Failed to generate QR code', err);
                setError(true);
            }
        };
        if (qrContent) {
            generateQR();
        }
    }, [qrContent, isMeli]);

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
                            <IconWhatsapp className="w-10 h-10 sm:w-12 sm:h-12 text-green-500"/>
                            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center">Solicitar QR al Vendedor</h3>
                        </div>
                        
                        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-left">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                                Detalles del Envío
                            </h4>
                            <div className="space-y-2 text-sm text-slate-700">
                                <p><strong>Destinatario:</strong> <span className="font-medium text-slate-900">{pkg.recipientName}</span></p>
                                <p><strong>Dirección:</strong> <span className="font-medium text-slate-900">{pkg.recipientAddress}, {pkg.recipientCommune}</span></p>
                                <p><strong>ID Envío (ML):</strong> <span className="font-mono font-bold text-slate-900">{pkg.meliOrderId}</span></p>
                            </div>
                        </div>

                        {creator?.phone ? (
                            <a 
                                href={whatsappUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-center w-full bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg shadow-md transition-colors group"
                            >
                                <IconWhatsapp className="w-6 h-6 mr-3" />
                                <span className="text-lg font-bold">Enviar WhatsApp al Vendedor</span>
                            </a>
                        ) : (
                            <div className="w-full bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-r-lg">
                                <div className="flex">
                                    <div className="py-1">
                                        <IconAlertTriangle className="h-6 w-6 text-yellow-500 mr-4"/>
                                    </div>
                                    <div>
                                        <p className="font-bold">Vendedor sin teléfono</p>
                                        <p className="text-sm mt-1">
                                            No se puede enviar WhatsApp porque el vendedor no tiene un número de teléfono registrado.
                                        </p>
                                    </div>
                                </div>
                            </div>
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
                                <div>
                                    <p className="font-bold">Código para Uso Interno Solamente</p>
                                    <p className="text-sm mt-1">
                                        Este código QR debe ser escaneado <strong>únicamente por los conductores de {systemSettings.companyName}</strong> con nuestra aplicación.
                                        La aplicación de Mercado Libre Flex no lo reconocerá.
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
                            <p className="text-sm text-slate-500 mt-3">
                                Apunta la cámara <b>solo</b> al código cuadrado de arriba.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default QRCodeModal;