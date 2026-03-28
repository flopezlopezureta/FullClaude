import React, { useEffect, useState, useContext } from 'react';
import QRCode from 'qrcode';
import { Package } from '../../types';
import { AuthContext } from '../../contexts/AuthContext';

interface ShippingLabelProps {
  pkg: Package;
  creatorName: string;
  format?: 'standard' | 'thermal_4x6';
}

const ShippingLabel: React.FC<ShippingLabelProps> = ({ pkg, creatorName, format = 'standard' }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [trackingQrUrl, setTrackingQrUrl] = useState('');
    const { systemSettings } = useContext(AuthContext)!;

    const isMeli = pkg.source === 'MERCADO_LIBRE';
    const hasCapturedFlex = !!pkg.meliFlexCode;
    
    // Determine QR content for Driver (Flexeo)
    let qrContent = pkg.id;
    if (isMeli) {
        const code = pkg.trackingId || pkg.meliFlexCode || pkg.meliOrderId || pkg.id;
        qrContent = `SCA00-${String(code).trim()}`;
    } else {
        qrContent = pkg.trackingId || pkg.id;
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
                        width: format === 'thermal_4x6' ? 800 : 600,
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
                    width: format === 'thermal_4x6' ? 600 : 400,
                    margin: 2,
                    color: { dark: '#000000', light: '#ffffff' }
                });
                setTrackingQrUrl(tQrUrl);
            } catch (err) {
                console.error('Failed to generate tracking QR code', err);
            }
        };
        generateQRs();
    }, [qrContent, trackingUrl, isMeli, hasCapturedFlex, pkg.meliOrderId, format]);

    if (format === 'thermal_4x6') {
        return (
            <div className="bg-white p-8 font-sans text-black relative overflow-hidden w-[100mm] h-[150mm] mx-auto border-2 border-black flex flex-col">
                {/* Header */}
                <div className="border-b-4 border-black pb-4 mb-4 flex justify-between items-start">
                    <div>
                        <h2 className="font-black text-2xl leading-tight">{systemSettings.companyName.toUpperCase()}</h2>
                        <p className="text-sm mt-1">Remitente: <span className="font-bold">{creatorName}</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold">{new Date().toLocaleDateString('es-CL')}</p>
                        <p className="text-xs font-mono mt-1">{isMeli ? 'MERCADO LIBRE' : 'INTERNO'}</p>
                    </div>
                </div>

                {/* Destination */}
                <div className="flex-1 flex flex-col">
                    <div className="bg-black text-white p-4 mb-4 text-center rounded-sm">
                        <p className="text-xs font-bold uppercase tracking-widest mb-1">Comuna de Destino</p>
                        <p className="text-4xl font-black tracking-tighter uppercase">{pkg.recipientCommune}</p>
                    </div>

                    <div className="border-2 border-black p-4 rounded-sm flex-1">
                        <p className="text-xs font-black uppercase text-gray-500 mb-2">Destinatario:</p>
                        <p className="font-black text-2xl leading-none mb-2">{pkg.recipientName}</p>
                        <p className="text-lg font-bold mb-3">Tel: {pkg.recipientPhone}</p>
                        <div className="space-y-1">
                            <p className="text-xl font-bold leading-tight">{pkg.recipientAddress}</p>
                            <p className="text-lg font-medium">{pkg.recipientCommune}, {pkg.recipientCity}</p>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {pkg.notes && (
                    <div className="mt-4 border-t-2 border-black pt-2">
                        <p className="text-xs font-black uppercase text-gray-500">Notas / Instrucciones:</p>
                        <p className="text-sm font-bold italic leading-tight">{pkg.notes}</p>
                    </div>
                )}

                {/* Footer / QRs */}
                <div className="mt-auto pt-6 border-t-4 border-black flex items-end justify-between">
                    <div className="flex flex-col items-center">
                        {qrCodeUrl ? <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32" /> : <div className="w-32 h-32 bg-slate-200" />}
                        <p className="text-[10px] font-black mt-1 uppercase">Uso Conductor</p>
                    </div>
                    
                    <div className="flex flex-col items-center flex-1 px-4">
                        <p className="font-mono font-black text-2xl mb-2">
                            {isMeli ? (pkg.trackingId || pkg.meliFlexCode || pkg.meliOrderId || pkg.id) : (pkg.trackingId || pkg.id)}
                        </p>
                        <div className="w-full h-4 bg-black mb-2"></div>
                        <p className="text-[10px] font-bold text-center">
                            {hasCapturedFlex ? 'ETIQUETA REIMPRESA' : (isMeli ? 'SOLO CONDUCTOR' : 'USO INTERNO')}
                        </p>
                    </div>

                    <div className="flex flex-col items-center">
                        {trackingQrUrl ? <img src={trackingQrUrl} alt="Tracking QR" className="w-24 h-24" /> : <div className="w-24 h-24 bg-slate-200" />}
                        <p className="text-[10px] font-black mt-1 uppercase text-blue-700">Tracking</p>
                    </div>
                </div>
            </div>
        );
    }

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
                        {isMeli ? (pkg.trackingId || pkg.meliFlexCode || pkg.meliOrderId || pkg.id) : (pkg.trackingId || pkg.id)}
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