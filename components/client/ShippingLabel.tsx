import React, { useEffect, useState, useContext } from 'react';
import QRCode from 'qrcode';
import { Package } from '../../types';
import { AuthContext } from '../../contexts/AuthContext';

interface ShippingLabelProps {
  pkg: Package;
  creatorName: string;
}

const ShippingLabel: React.FC<ShippingLabelProps> = ({ pkg, creatorName }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [trackingQrUrl, setTrackingQrUrl] = useState('');
    const { systemSettings } = useContext(AuthContext)!;

    const isMeli = !!pkg.meliOrderId;
    const hasCapturedFlex = !!pkg.meliFlexCode;
    
    // Determine QR content for Driver (Flexeo)
    let qrContent = pkg.id;
    if (isMeli) {
        const code = pkg.meliFlexCode || pkg.meliOrderId;
        if (code) {
            const codeStr = String(code).trim();
            if (codeStr.startsWith('http')) {
                qrContent = codeStr;
            } else {
                qrContent = `https://www.mercadolibre.cl/envios/flex/shipments/${codeStr}/label`;
            }
        }
    }

    // Determine QR content for Customer (Tracking)
    const trackingUrl = `${window.location.origin}/track/${pkg.id}`;

    useEffect(() => {
        const generateQRs = async () => {
            // Generate Driver QR
            if (!isMeli || hasCapturedFlex || pkg.meliOrderId) {
                try {
                    const qrUrl = await QRCode.toDataURL(qrContent, {
                        errorCorrectionLevel: 'M',
                        type: 'image/png',
                        width: 600,
                        margin: 2,
                        color: { dark: '#000000', light: '#ffffff' }
                    });
                    setQrCodeUrl(qrUrl);
                } catch (err) {
                    console.error('Failed to generate driver QR code', err);
                }
            }

            // Generate Tracking QR
            try {
                const tQrUrl = await QRCode.toDataURL(trackingUrl, {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    width: 400,
                    margin: 2,
                    color: { dark: '#000000', light: '#ffffff' }
                });
                setTrackingQrUrl(tQrUrl);
            } catch (err) {
                console.error('Failed to generate tracking QR code', err);
            }
        };
        generateQRs();
    }, [qrContent, trackingUrl, isMeli, hasCapturedFlex, pkg.meliOrderId]);

    // --- DISEÑO ESTÁNDAR (Para todos los envíos) ---
    return (
        <div className="bg-white p-4 border border-slate-300 rounded-md font-sans text-black relative overflow-hidden w-full max-w-[380px] mx-auto">
            <div 
                className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none"
                style={{ transform: 'rotate(-20deg)' }}
            >
                <span className="text-6xl font-black text-gray-200 opacity-50 select-none text-center uppercase">
                    {hasCapturedFlex ? 'Etiqueta\nReimpresa' : 'Uso Interno'}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-4 border-b-2 border-black pb-2 relative z-10">
                <div className="col-span-2">
                    <h2 className="font-bold text-lg leading-tight">{systemSettings.companyName.toUpperCase()}</h2>
                    <p className="text-xs mt-1">Remitente: <span className="font-semibold">{creatorName}</span></p>
                </div>
                <div className="text-right">
                    <p className="text-xs">Fecha:</p>
                    <p className="text-xs font-semibold">{new Date().toLocaleDateString('es-CL')}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-2 relative z-10">
                <div className="border-r pr-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Destinatario:</p>
                    <p className="font-bold text-sm leading-tight">{pkg.recipientName}</p>
                    <p className="text-xs mt-1">Tel: {pkg.recipientPhone}</p>
                    <p className="text-xs leading-tight mt-1">{pkg.recipientAddress}</p>
                    <p className="text-xs">{pkg.recipientCommune}, {pkg.recipientCity}</p>
                </div>
                <div className="text-center bg-slate-100 p-2 rounded-md flex flex-col justify-center">
                    <p className="text-xs font-bold uppercase text-slate-500">Destino</p>
                    <p className="text-xl font-extrabold tracking-wider leading-none break-words">{pkg.recipientCommune.toUpperCase()}</p>
                </div>
            </div>

            {pkg.notes && (
                    <div className="border-t pt-1 mt-1 relative z-10">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Notas:</p>
                    <p className="text-xs italic leading-tight">{pkg.notes}</p>
                </div>
            )}

            <div className="border-t-2 border-black mt-2 pt-2 flex items-center justify-between relative z-10">
                <div className="flex flex-col items-center">
                    {qrCodeUrl ? <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24" /> : <div className="w-24 h-24 bg-slate-200 animate-pulse" />}
                    <p className="text-[8px] font-bold mt-1 uppercase text-slate-500">Uso Conductor</p>
                </div>
                <div className="flex flex-col items-center border-l border-slate-300 pl-4">
                    {trackingQrUrl ? <img src={trackingQrUrl} alt="Tracking QR" className="w-16 h-16" /> : <div className="w-16 h-16 bg-slate-200 animate-pulse" />}
                    <p className="text-[8px] font-bold mt-1 uppercase text-blue-600">Sigue tu pedido</p>
                </div>
                <div className="text-right flex flex-col justify-end flex-grow ml-4">
                    <p className="font-mono text-[10px] text-slate-500">
                        {isMeli ? 'Envío Mercado Libre' : 'ID Interno'}
                    </p>
                    <p className="font-mono font-bold text-lg leading-none">
                        {isMeli ? (pkg.meliFlexCode?.match(/\d+/)?.[0] || pkg.meliOrderId || pkg.id) : pkg.id}
                    </p>
                    <div className="mt-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-[10px] font-bold self-end text-center max-w-[160px]">
                        {isMeli && !hasCapturedFlex 
                            ? 'SOLO CONDUCTOR - NO FLEXEO' 
                            : (hasCapturedFlex ? 'ETIQUETA REIMPRESA' : 'USO INTERNO')
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShippingLabel;