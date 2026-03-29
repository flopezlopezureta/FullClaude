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

    const renderHeader = (compact = false) => (
        <div className={`flex justify-between items-start border-b-2 border-black ${compact ? 'pb-1 mb-1' : 'pb-2 mb-2'}`}>
            <div className="min-w-0 flex-1">
                <h2 className={`${compact ? 'text-sm' : 'text-lg'} font-black truncate leading-tight`}>
                    {systemSettings.companyName.toUpperCase()}
                </h2>
                <p className={`${compact ? 'text-[8px]' : 'text-[10px]'} truncate mt-0.5`}>
                    Remitente: <span className="font-bold">{creatorName}</span>
                </p>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
                <p className={`${compact ? 'text-[8px]' : 'text-[10px]'} font-bold`}>{new Date().toLocaleDateString('es-CL')}</p>
                {isMeli && (
                    <span className="inline-block bg-yellow-400 text-black px-1 rounded-[2px] text-[10px] font-black mt-0.5 animate-pulse">
                        FLEX
                    </span>
                 )}
            </div>
        </div>
    );

    const renderDestination = (large = false) => (
        <div className="flex-1 flex flex-col">
            {/* DESTINATION COMMUNE - HIGHLIGHTED WITHOUT BLACK BLOCK */}
            <div className="bg-white text-black p-3 mb-3 text-center border-4 border-black rounded-lg">
                <p className={`${large ? 'text-sm' : 'text-[12px]'} font-black uppercase tracking-[0.3em] mb-1 opacity-60 underline`}>Comuna de Destino</p>
                <p className={`${large ? 'text-6xl' : 'text-4xl'} font-[1000] uppercase leading-none py-1`}>{pkg.recipientCommune}</p>
            </div>

            {/* RECIPIENT DATA - NO TRUNCATION */}
            <div className={`border-[3px] border-black ${large ? 'p-4' : 'p-3'} rounded-sm flex-1 flex flex-col space-y-3`}>
                <div>
                    <p className="text-[11px] font-black uppercase text-gray-500 mb-1 tracking-tighter">Destinatario:</p>
                    <p className={`${large ? 'text-2xl' : 'text-xl'} font-black leading-[1.1]`}>
                        {pkg.recipientName}
                    </p>
                    {pkg.recipientRut && (
                        <p className={`${large ? 'text-lg' : 'text-md'} font-bold text-gray-700 mt-1`}>RUT: {pkg.recipientRut}</p>
                    )}
                </div>

                <div className="pt-2 border-t-2 border-dashed border-gray-300">
                    <p className="text-[11px] font-black uppercase text-gray-500 mb-1 tracking-tighter">Dirección de Entrega:</p>
                    <p className={`${large ? 'text-xl' : 'text-lg'} font-bold leading-tight`}>{pkg.recipientAddress}</p>
                    <p className={`${large ? 'text-lg' : 'text-md'} font-medium mt-1 italic text-gray-600`}>{pkg.recipientCommune}, {pkg.recipientCity}</p>
                </div>

                <div className="pt-2 border-t-2 border-dashed border-gray-300">
                     <p className="text-[11px] font-black uppercase text-gray-500 mb-1 tracking-tighter">Contacto:</p>
                     <p className={`${large ? 'text-2xl' : 'text-xl'} font-black tracking-tight`}>📱 {pkg.recipientPhone}</p>
                </div>
            </div>
        </div>
    );

    const renderFooter = (large = false) => (
        <div className={`mt-auto pt-3 border-t-[3px] border-black flex items-center justify-between`}>
            <div className="flex flex-col items-center">
                {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="QR Code" className={large ? 'w-36 h-36' : 'w-28 h-28'} />
                ) : (
                    <div className={`${large ? 'w-36 h-36' : 'w-28 h-28'} bg-gray-100 animate-pulse`} />
                )}
                <p className="text-[10px] font-black mt-2 uppercase text-gray-800 tracking-wider">
                    {isMeli ? 'Escanear ML Flex' : 'Uso Logístico'}
                </p>
            </div>
            
            <div className="flex flex-col items-end flex-1 pl-4 text-right justify-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                    {isMeli ? 'Envío Mercado Libre' : 'ID de Seguimiento'}
                </p>
                <div className="bg-gray-100 p-2 rounded-sm border border-gray-200 w-full">
                    <p className={`${large ? 'text-xl' : 'text-lg'} font-mono font-black break-all leading-none`}>
                        {qrContent}
                    </p>
                </div>
                <div className="w-full h-3 bg-black mt-3"></div>
                <p className="text-[10px] font-black mt-1 tracking-widest">
                    {isMeli ? 'ORIGINAL ML FLEX' : 'SISTEMA PROPIO'}
                </p>
            </div>
        </div>
    );

    // --- RENDER PER FORMAT ---

    // 1. COMPACT THERMAL (100x150mm) - Data essential
    if (format === LabelFormat.CompactThermal) {
        return (
            <div className="bg-white p-4 font-sans text-black w-[100mm] h-[150mm] mx-auto border-2 border-black flex flex-col overflow-hidden">
                {renderHeader()}
                <div className="flex-1 flex flex-col py-2">
                    {renderDestination(true)}
                </div>
                {pkg.notes && (
                    <div className="my-2 border-t border-black pt-1">
                        <p className="text-[8px] font-black uppercase text-gray-500">Notas:</p>
                        <p className="text-[10px] font-bold italic line-clamp-2">{pkg.notes}</p>
                    </div>
                )}
                {renderFooter(true)}
            </div>
        );
    }

    // 2. FULL THERMAL (100x150mm) - All data
    if (format === LabelFormat.FullThermal) {
        return (
            <div className="bg-white p-6 font-sans text-black w-[100mm] h-[150mm] mx-auto border-4 border-black flex flex-col overflow-hidden">
                {renderHeader()}
                <div className="flex-1 flex flex-col py-2">
                    {renderDestination(true)}
                </div>
                <div className="my-2 p-2 border-2 border-dashed border-black rounded-sm">
                    <p className="text-[10px] font-black uppercase text-gray-500 mb-1">Notas e Instrucciones:</p>
                    <p className="text-sm font-bold italic leading-tight">{pkg.notes || 'Sin observaciones'}</p>
                </div>
                {renderFooter(true)}
            </div>
        );
    }

    // 3. A4 SINGLE (Entire page)
    if (format === LabelFormat.A4Single) {
        return (
            <div className="bg-white p-16 font-sans text-black w-full h-full min-h-[297mm] flex flex-col items-center justify-center">
                <div className="w-[150mm] min-h-[200mm] border-4 border-black p-10 flex flex-col">
                    {renderHeader()}
                    <div className="flex-1 flex flex-col space-y-8 py-10">
                         {renderDestination(true)}
                         <div className="border-2 border-black p-6 bg-gray-50">
                            <p className="text-xs font-black uppercase mb-2">Comentarios del Envío:</p>
                            <p className="text-lg font-bold">{pkg.notes || 'Ninguno'}</p>
                         </div>
                    </div>
                    {renderFooter(true)}
                </div>
            </div>
        );
    }

    // 4. A4 HALF (2 per page)
    if (format === LabelFormat.A4Half) {
        return (
            <div className="bg-white p-4 font-sans text-black w-full h-[148mm] border-2 border-black flex flex-col overflow-hidden m-2">
                {renderHeader(true)}
                <div className="flex-1 flex flex-col py-1">
                    {renderDestination(false)}
                </div>
                {pkg.notes && (
                    <div className="my-1 border-t border-black pt-1">
                        <p className="text-[7px] font-black uppercase text-gray-400">Notas:</p>
                        <p className="text-[9px] font-bold truncate">{pkg.notes}</p>
                    </div>
                )}
                {renderFooter(false)}
            </div>
        );
    }

    // 5. ZEBRA ZPL (4x6 optimized)
    if (format === LabelFormat.ZebraZpl) {
        return (
            <div className="bg-white p-4 font-sans text-black w-[101.6mm] h-[152.4mm] border-8 border-black flex flex-col overflow-hidden">
                <div className="border-b-4 border-black pb-2 mb-2 flex justify-between items-center">
                    <h1 className="text-2xl font-black tracking-tighter">{systemSettings.companyName.toUpperCase()}</h1>
                    <div className="bg-black text-white px-2 py-1 font-black text-xs">ZEBRA 4X6</div>
                </div>
                
                <div className="bg-white text-black p-4 text-center border-[10px] border-black rounded-xl mb-6">
                    <p className="text-xl font-bold uppercase tracking-[0.4em] mb-2 opacity-70 underline">DESTINO</p>
                    <p className="text-7xl font-[1000] uppercase breakout leading-none">{pkg.recipientCommune}</p>
                </div>

                <div className="flex-1 flex flex-col space-y-4">
                    <div className="border-l-8 border-black pl-4">
                        <p className="text-xs font-black uppercase text-gray-400">Destinatario:</p>
                        <p className="text-3xl font-black leading-tight">{pkg.recipientName}</p>
                        <p className="text-xl font-bold mt-1 text-gray-800">RUT: {pkg.recipientRut || 'S/N'}</p>
                    </div>

                    <div className="pt-2 border-t-2 border-dashed border-gray-400">
                        <p className="text-xs font-black uppercase text-gray-400">Dirección:</p>
                        <p className="text-2xl font-bold leading-tight">{pkg.recipientAddress}</p>
                        <p className="text-xl font-medium mt-1">{pkg.recipientCommune}, {pkg.recipientCity}</p>
                    </div>

                    <div className="pt-2 border-t-2 border-dashed border-gray-400">
                        <p className="text-3xl font-black">📱 {pkg.recipientPhone}</p>
                    </div>
                </div>

                <div className="mt-auto flex items-center justify-between border-t-4 border-black pt-4">
                    <div className="flex flex-col items-center">
                        {qrCodeUrl && <img src={qrCodeUrl} alt="QR" className="w-40 h-40" />}
                        <p className="text-xs font-black mt-1 uppercase">Escanear ML</p>
                    </div>
                    <div className="flex-1 pl-6 text-right">
                         <p className="text-xs font-bold text-gray-400 uppercase mb-1">Tracking ID:</p>
                         <p className="text-2xl font-mono font-black break-all leading-none">{qrContent}</p>
                         <div className="w-full h-4 bg-black mt-4"></div>
                         <p className="text-xs font-black mt-1 tracking-widest uppercase">Original ML Flex</p>
                    </div>
                </div>
            </div>
        );
    }

    // 6. CARTA CUÁDRUPLE (A4 x 4) - Repurposed from MinimalSticker
    if (format === LabelFormat.MinimalSticker) {
        return (
            <div className="bg-white p-2 font-sans text-black w-[105mm] h-[148mm] border-2 border-black flex flex-col overflow-hidden">
                <p className="text-[10px] font-black uppercase opacity-50 mb-1">{systemSettings.companyName}</p>
                <div className="bg-white text-black p-3 text-center border-4 border-black font-black text-3xl uppercase mb-3">
                    {pkg.recipientCommune}
                </div>
                <div className="flex-1 min-h-0 space-y-2">
                    <p className="text-xl font-black leading-tight italic">{pkg.recipientName}</p>
                    {pkg.recipientRut && <p className="text-sm font-bold">RUT: {pkg.recipientRut}</p>}
                    <p className="text-lg font-bold leading-tight">{pkg.recipientAddress}</p>
                    <p className="text-lg font-black leading-tight">📱 {pkg.recipientPhone}</p>
                </div>
                <div className="flex items-center space-x-4 mt-auto border-t-2 border-black pt-2">
                    {qrCodeUrl && <img src={qrCodeUrl} alt="QR" className="w-24 h-24 shrink-0" />}
                    <div className="min-w-0 flex-1">
                         <p className="text-[10px] font-black break-all">{qrContent}</p>
                         {isMeli && <p className="text-sm font-black bg-yellow-400 inline-block px-2 mt-2">FLEX</p>}
                    </div>
                </div>
            </div>
        );
    }

    // Default fallback
    return <div>Formato no soportado</div>;
};

export default ShippingLabel;