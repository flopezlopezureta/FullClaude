import React, { useEffect, useState, useContext } from 'react';
import QRCode from 'qrcode';
import { Package } from '../../types';
import { AuthContext } from '../../contexts/AuthContext';
import { LabelFormat, PackageSource } from '../../constants';

interface ShippingLabelProps {
  pkg: Package;
  creatorName: string;
  format?: LabelFormat;
}

const ShippingLabel: React.FC<ShippingLabelProps> = ({ pkg, creatorName, format = LabelFormat.CompactThermal }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const { systemSettings } = useContext(AuthContext)!;

    const isMeli = pkg.source === PackageSource.MercadoLibre;
    
    // Version: 2.3.3
    // Determine QR content for Driver (Flexeo)
    // For ML, we use ONLY the trackingId (which is the SCA authentic code)
    // For manual/others, we use the internal ID or trackingId if available.
    let qrContent = pkg.id;
    if (isMeli) {
        qrContent = pkg.trackingId || pkg.meliFlexCode || pkg.meliOrderId || pkg.id;
    } else {
        qrContent = pkg.trackingId || pkg.id;
    }

    useEffect(() => {
        const generateQR = async () => {
            try {
                const qrUrl = await QRCode.toDataURL(qrContent, {
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    width: 600,
                    margin: 1,
                    color: { dark: '#000000', light: '#ffffff' }
                });
                setQrCodeUrl(qrUrl);
            } catch (err) {
                console.error('Failed to generate QR code', err);
            }
        };
        generateQR();
    }, [qrContent]);

    // --- 6 DISEÑOS DE INFORMACIÓN ---
    
    // DISEÑO 1: ENFOQUE LOGÍSTICO (COMUNA XL)
    if (format === LabelFormat.CompactThermal) {
        return (
            <div className="bg-white p-5 font-sans text-black w-[100mm] h-[150mm] border-4 border-black flex flex-col overflow-hidden">
                <div className="text-center mb-4">
                    <h2 className="text-lg font-black tracking-tight">{systemSettings.companyName.toUpperCase()}</h2>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Hoja de Ruta Logística</p>
                </div>
                <div className="bg-white text-black p-3 text-center border-4 border-black rounded-xl mb-4 shadow-[3px_3px_0px_#000]">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-1 opacity-50">Destino Prioritario</p>
                    <p className={`font-[1000] uppercase leading-none ${pkg.recipientCommune.length > 12 ? 'text-4xl' : 'text-5xl'}`}>{pkg.recipientCommune}</p>
                </div>
                <div className="flex-1 space-y-3">
                    <div className="border-l-4 border-black pl-3">
                        <p className="text-[10px] font-black uppercase text-gray-400">Entrega para:</p>
                        <p className="text-2xl font-black leading-none">{pkg.recipientName}</p>
                        {pkg.recipientRut && <p className="text-md font-bold mt-1">RUT: {pkg.recipientRut}</p>}
                    </div>
                    <div className="pt-2 border-t-2 border-dashed border-gray-300">
                        <p className="text-[10px] font-black uppercase text-gray-400">Dirección:</p>
                        <p className="text-xl font-bold leading-tight">{pkg.recipientAddress}</p>
                        <p className="text-sm font-medium mt-1 italic text-gray-600">{pkg.recipientCommune}, {pkg.recipientCity}</p>
                    </div>
                </div>
                <div className="mt-auto border-t-2 border-black pt-3 flex items-center justify-between">
                    <div className="flex flex-col items-center">
                        {qrCodeUrl && <img src={qrCodeUrl} alt="QR" className="w-32 h-32" style={{ imageRendering: 'pixelated' }} />}
                    </div>
                    <div className="flex-1 pl-4 text-right">
                         <p className="text-[9px] font-bold text-gray-400 uppercase">ID Operativo:</p>
                         <p className="text-lg font-mono font-black break-all leading-tight">{qrContent}</p>
                         <div className="w-full h-3 bg-black mt-2"></div>
                    </div>
                </div>
            </div>
        );
    }

    // DISEÑO 2: ENFOQUE IDENTIDAD (NOMBRE & RUT)
    if (format === LabelFormat.FullThermal) {
        return (
            <div className="bg-white p-4 font-sans text-black w-[100mm] h-[150mm] border-2 border-black flex flex-col overflow-hidden">
                <div className="bg-black text-white p-2 text-center mb-4">
                    <p className="text-xl font-black tracking-tighter">IDENTIFICACIÓN DE ENTREGA</p>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-full border-b-2 border-black pb-4">
                         <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Titular de la Orden:</p>
                         <p className={`font-black leading-none break-words underline decoration-2 underline-offset-4 ${pkg.recipientName.length > 20 ? 'text-3xl' : 'text-4xl'}`}>{pkg.recipientName}</p>
                    </div>
                    <div className="flex justify-between w-full px-2">
                        <div className="text-left">
                            <p className="text-[9px] font-black text-gray-400 uppercase">Documento (RUT):</p>
                            <p className="text-xl font-black">{pkg.recipientRut || 'NO REGISTRADO'}</p>
                        </div>
                        <div className="text-right">
                             <p className="text-[9px] font-black text-gray-400 uppercase">Comuna:</p>
                             <p className="text-xl font-black">{pkg.recipientCommune}</p>
                        </div>
                    </div>
                    <div className="w-full bg-gray-50 border border-black p-3 rounded-lg">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Punto de Entrega:</p>
                        <p className="text-lg font-bold leading-tight">{pkg.recipientAddress}</p>
                    </div>
                </div>
                <div className="mt-auto grid grid-cols-2 gap-4 border-t border-black pt-4">
                    <div className="flex flex-col justify-center">
                        <p className="text-[9px] font-black tracking-widest text-blue-600">DISEÑO 2</p>
                        <p className="text-[9px] font-bold mt-1 italic">{systemSettings.companyName}</p>
                    </div>
                    <div className="flex justify-end">
                         {qrCodeUrl && <img src={qrCodeUrl} alt="QR" className="w-28 h-28" style={{ imageRendering: 'pixelated' }} />}
                    </div>
                </div>
            </div>
        );
    }

    // DISEÑO 3: ENFOQUE INDUSTRIAL (SIDEBAR QR)
    if (format === LabelFormat.ZebraZpl) {
        return (
            <div className="bg-white font-sans text-black w-[101.6mm] h-[152.4mm] border border-black flex overflow-hidden">
                <div className="w-1/4 bg-white text-black p-2 flex flex-col items-center justify-between border-r border-black border-dashed">
                    <div className="rotate-90 origin-center whitespace-nowrap mt-16 max-h-[80mm] flex items-center justify-center">
                         <p className={`font-black tracking-widest leading-none ${pkg.recipientCommune.length > 12 ? 'text-lg' : 'text-xl'}`}>{pkg.recipientCommune.toUpperCase()}</p>
                    </div>
                    {qrCodeUrl && <img src={qrCodeUrl} alt="QR" className="w-full p-1" style={{ imageRendering: 'pixelated' }} />}
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-30">DISEÑO 3</p>
                </div>
                <div className="flex-1 p-4 flex flex-col">
                    <div className="border-b border-black pb-2 mb-3">
                        <h2 className="text-md font-black tracking-tighter">{systemSettings.companyName}</h2>
                    </div>
                    <div className="mb-3">
                        <p className="text-[9px] font-black uppercase text-gray-500 mb-1">Destinatario:</p>
                        <p className="text-xl font-black leading-tight mb-1">{pkg.recipientName}</p>
                        <p className="text-lg font-bold tracking-tighter">📞 {pkg.recipientPhone}</p>
                    </div>
                    <div className="flex-1 bg-yellow-50/30 border-b-2 border-yellow-400 p-2">
                        <p className="text-[9px] font-black uppercase text-gray-400 mb-0.5">Dirección / Instrucciones:</p>
                        <p className="text-lg font-black leading-tight">{pkg.recipientAddress}</p>
                        <p className="text-md font-bold mt-1 italic text-gray-500">{pkg.recipientCommune}, {pkg.recipientCity}</p>
                    </div>
                    <div className="mt-3">
                         <p className="text-[8px] font-black text-gray-300 uppercase">Track ID:</p>
                         <p className="text-[10px] font-mono font-black break-all leading-none">{qrContent}</p>
                    </div>
                </div>
            </div>
        );
    }

    // DISEÑO 4: ENFOQUE INSTRUCCIONES (NOTAS XL)
    if (format === LabelFormat.A4Single) {
        return (
            <div className="bg-white p-8 font-sans text-black w-full h-full min-h-[297mm] flex flex-col border-4 border-gray-100">
                <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                    <h1 className="text-3xl font-black tracking-tighter">{systemSettings.companyName.toUpperCase()}</h1>
                    <div className="bg-black text-white px-3 py-1 font-black text-sm">DISEÑO 4</div>
                </div>
                <div className="grid grid-cols-2 gap-8 flex-1">
                    <div className="space-y-6">
                         <div className="bg-gray-50 p-6 rounded-2xl border border-black shadow-sm">
                            <p className="text-sm font-black uppercase text-gray-400 mb-2 tracking-widest">Importante / Notas:</p>
                            <p className="text-3xl font-black italic leading-tight text-blue-900 break-words">
                                {pkg.notes || 'SIN OBSERVACIONES'}
                            </p>
                         </div>
                         <div className="p-3 border-l-4 border-black">
                            <p className="text-sm font-black uppercase text-gray-400">Dirección Completa:</p>
                            <p className="text-2xl font-bold">{pkg.recipientAddress}</p>
                            <p className="text-xl font-medium mt-1">{pkg.recipientCommune}, {pkg.recipientCity}</p>
                         </div>
                    </div>
                    <div className="flex flex-col items-center justify-start space-y-6">
                        <div className="p-4 bg-white shadow-xl border border-black rounded-lg">
                            {qrCodeUrl && <img src={qrCodeUrl} alt="QR" className="w-64 h-64" style={{ imageRendering: 'pixelated' }} />}
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-black uppercase text-gray-400 mb-1">Nombre Destinatario:</p>
                            <p className="text-3xl font-black">{pkg.recipientName}</p>
                        </div>
                    </div>
                </div>
                <div className="mt-auto border-t-4 border-black pt-6 flex justify-between items-end">
                    <div>
                         <p className="text-lg font-mono font-black tracking-widest">{qrContent}</p>
                    </div>
                    <div className="w-48 h-12 bg-black"></div>
                </div>
            </div>
        );
    }

    // DISEÑO 5: ENFOQUE DESPACHO (TRACKING ID PRO)
    if (format === LabelFormat.A4Half) {
        return (
            <div className="bg-white p-5 font-sans text-black w-full h-[148mm] border-2 border-black flex flex-col overflow-hidden relative">
                <div className="absolute top-0 right-0 bg-black text-white p-1.5 font-black text-[7px] uppercase tracking-widest leading-none">DISEÑO 5</div>
                <div className="border-b border-black pb-2 mb-3">
                    <p className="text-[9px] font-black uppercase text-gray-400">Clave de Envío:</p>
                    <p className="text-3xl font-mono font-[1000] tracking-tighter break-all leading-none">{qrContent}</p>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="border-r border-black pr-4 space-y-3">
                         <div>
                            <p className="text-[9px] font-black uppercase text-gray-400">Destinatario:</p>
                            <p className="text-xl font-black leading-none">{pkg.recipientName}</p>
                         </div>
                         <div>
                            <p className="text-[9px] font-black uppercase text-gray-400">Teléfono:</p>
                            <p className="text-lg font-bold">{pkg.recipientPhone}</p>
                         </div>
                    </div>
                    <div className="space-y-3">
                         <div>
                            <p className="text-[9px] font-black uppercase text-gray-400">Comuna:</p>
                            <p className="text-xl font-black bg-black text-white px-1.5 inline-block rounded-sm">{pkg.recipientCommune}</p>
                         </div>
                         <div>
                            <p className="text-[9px] font-black uppercase text-gray-400">Ubicación:</p>
                            <p className="text-sm font-bold leading-tight">{pkg.recipientAddress}</p>
                         </div>
                    </div>
                </div>
                <div className="mt-3 pt-3 border-t border-dashed border-gray-300 flex items-center justify-between">
                    <div className="flex flex-col">
                        <p className="text-[7px] font-black uppercase opacity-30 tracking-[0.4em] mb-2">SCAN AREA</p>
                        {qrCodeUrl && <img src={qrCodeUrl} alt="QR" className="w-20 h-20" style={{ imageRendering: 'pixelated' }} />}
                    </div>
                    <div className="text-right">
                         <p className="text-[8px] font-black italic">{systemSettings.companyName}</p>
                    </div>
                </div>
            </div>
        );
    }

    // DISEÑO 6: ENFOQUE COMPACTO (FULL INFO)
    if (format === LabelFormat.MinimalSticker) {
        return (
            <div className="bg-white p-2 font-sans text-black w-[105mm] h-[148mm] border-2 border-slate-300 flex flex-col overflow-hidden leading-tight">
                <div className="bg-slate-100 px-3 py-1 border-b border-black flex justify-between items-center mb-1">
                    <p className="text-[8px] font-black uppercase">{systemSettings.companyName}</p>
                    <p className="text-[8px] font-black text-slate-400">DISEÑO 6</p>
                </div>
                <div className="grid grid-cols-2 gap-1 mb-2">
                    <div className="border border-black p-1">
                         <p className="text-[7px] font-black uppercase text-gray-400 leading-none">Destinatario:</p>
                         <p className="text-[11px] font-black truncate">{pkg.recipientName}</p>
                    </div>
                    <div className="border border-black p-1 text-right">
                         <p className="text-[7px] font-black uppercase text-gray-400 leading-none">RUT:</p>
                         <p className="text-[10px] font-bold">{pkg.recipientRut || 'S/N'}</p>
                    </div>
                </div>
                <div className="border-4 border-black p-2 text-center mb-2">
                    <p className="text-[8px] font-black uppercase opacity-50 mb-0.5 tracking-widest">Sector de Entrega</p>
                    <p className="text-3xl font-black uppercase tracking-tighter leading-none">{pkg.recipientCommune}</p>
                </div>
                <div className="border border-black p-2 flex-1 mb-2 space-y-1">
                     <p className="text-[7px] font-black uppercase text-gray-400 leading-none">Dirección / Instrucciones:</p>
                     <p className="text-[11px] font-bold leading-tight">{pkg.recipientAddress}</p>
                </div>
                <div className="bg-black text-white p-2 text-center flex items-center justify-between">
                     <div className="text-left">
                        <p className="text-[7px] font-bold text-gray-400 uppercase leading-none">Contacto:</p>
                        <p className="text-[12px] font-black tracking-tight leading-none">{pkg.recipientPhone}</p>
                     </div>
                </div>
                <div className="mt-auto flex items-center justify-center py-2">
                     {qrCodeUrl && <img src={qrCodeUrl} alt="QR" className="w-20 h-20" style={{ imageRendering: 'pixelated' }} />}
                </div>
            </div>
        );
    }

    // Default fallback
    return <div>Formato de diseño no soportado</div>;
};

export default ShippingLabel;