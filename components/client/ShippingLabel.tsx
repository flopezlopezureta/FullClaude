import React, { useEffect, useState, useContext } from 'react';
import QRCode from 'qrcode';
import { Package } from '../../types';
import { AuthContext } from '../../contexts/AuthContext';
import { IconMercadoLibre, IconCube, IconAlertTriangle } from '../Icon';

interface ShippingLabelProps {
  pkg: Package;
  creatorName: string;
}

const ShippingLabel: React.FC<ShippingLabelProps> = ({ pkg, creatorName }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const { systemSettings } = useContext(AuthContext)!;

    const isMeli = !!pkg.meliOrderId;
    const qrContent = isMeli ? `https://mercadoenvios.com/flex/shipping/${String(pkg.meliOrderId).trim()}` : pkg.id;

    useEffect(() => {
        if (isMeli) return; // Do not generate QR for ML packages
        
        const generateQR = async () => {
            if (!qrContent) return;
            try {
                const qrUrl = await QRCode.toDataURL(qrContent, {
                    errorCorrectionLevel: 'L',
                    type: 'image/png',
                    width: 400,
                    margin: 1,
                    color: { dark: '#000000', light: '#ffffff' }
                });
                setQrCodeUrl(qrUrl);
            } catch (err) {
                console.error('Failed to generate QR code', err);
            }
        };
        generateQR();
    }, [qrContent, isMeli]);

    if (isMeli) {
        return (
             <div className="bg-white p-4 border-2 border-dashed border-red-400 font-sans text-black w-full max-w-[380px] mx-auto overflow-hidden flex flex-col items-center text-center">
                <IconMercadoLibre className="w-10 h-10 text-yellow-500 mb-2"/>
                <h3 className="font-bold text-lg text-red-600">PAQUETE MERCADO LIBRE</h3>
                <div className="my-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center gap-2">
                         <IconAlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0"/>
                         <p className="text-sm font-semibold text-red-800">
                             Para que la app de FLEX pueda escanear este envío, DEBES usar la etiqueta original generada por Mercado Libre.
                         </p>
                    </div>
                </div>
                <div className="w-full border-t border-dashed border-slate-300 pt-3 mt-3 text-left">
                     <p className="text-xs font-bold uppercase text-slate-500">Destinatario (Referencia):</p>
                    <p className="font-bold text-sm leading-tight">{pkg.recipientName}</p>
                    <p className="text-xs leading-tight mt-1">{pkg.recipientAddress}</p>
                    <p className="text-xs font-mono text-slate-500 mt-2">ID: {pkg.meliOrderId}</p>
                </div>
            </div>
        );
    }

    // --- DISEÑO ESTÁNDAR (Para envíos manuales / internos) ---
    return (
        <div className="bg-white p-4 border border-slate-300 rounded-md font-sans text-black relative overflow-hidden w-full max-w-[380px] mx-auto">
             <div 
                className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none"
                style={{ transform: 'rotate(-20deg)' }}
            >
                <span className="text-7xl font-black text-gray-200 opacity-50 select-none">
                    USO INTERNO
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
                </div>
                <div className="text-right flex flex-col justify-end">
                    <p className="font-mono text-[10px] text-slate-500">ID Interno</p>
                    <p className="font-mono font-bold text-lg leading-none">{pkg.id}</p>
                    <div className="mt-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-[10px] font-bold self-end">
                        PARA USO INTERNO DEL CONDUCTOR
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShippingLabel;