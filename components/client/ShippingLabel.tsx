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
        <div className="flex-1 flex flex-col justify-center">
            <div className="bg-black text-white p-2 mb-2 text-center rounded-sm">
                <p className={`${large ? 'text-xs' : 'text-[10px]'} font-bold uppercase tracking-widest mb-0.5`}>Comuna de Destino</p>
                <p className={`${large ? 'text-3xl' : 'text-xl'} font-black truncate uppercase`}>{pkg.recipientCommune}</p>
            </div>

            <div className={`border-2 border-black ${large ? 'p-3' : 'p-2'} rounded-sm flex-1 flex flex-col justify-center`}>
                <p className="text-[10px] font-black uppercase text-gray-500 mb-1">Destinatario:</p>
                <p className={`${large ? 'text-xl' : 'text-lg'} font-black leading-tight mb-1 line-clamp-2`}>{pkg.recipientName}</p>
                <p className={`${large ? 'text-lg' : 'text-md'} font-bold mb-2`}>Tel: {pkg.recipientPhone}</p>
                <div className="space-y-0.5">
                    <p className={`${large ? 'text-lg' : 'text-md'} font-bold leading-tight line-clamp-3`}>{pkg.recipientAddress}</p>
                    <p className={`${large ? 'text-md' : 'text-sm'} font-medium`}>{pkg.recipientCommune}, {pkg.recipientCity}</p>
                </div>
            </div>
        </div>
    );

    const renderFooter = (large = false) => (
        <div className={`mt-auto pt-2 border-t-2 border-black flex items-center justify-between`}>
            <div className="flex flex-col items-center">
                {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="QR Code" className={large ? 'w-32 h-32' : 'w-24 h-24'} />
                ) : (
                    <div className={`${large ? 'w-32 h-32' : 'w-24 h-24'} bg-gray-100 animate-pulse`} />
                )}
                <p className="text-[8px] font-black mt-1 uppercase text-gray-600">
                    {isMeli ? 'Escanear Flex' : 'Uso Conductor'}
                </p>
            </div>
            
            <div className="flex flex-col items-end flex-1 pl-4 text-right">
                <p className="text-[8px] font-bold text-gray-500 uppercase mb-1">
                    {isMeli ? 'Envío Mercado Libre' : 'ID Interno'}
                </p>
                <p className={`${large ? 'text-xl' : 'text-lg'} font-mono font-black break-all leading-none mb-1`}>
                    {qrContent}
                </p>
                <div className="w-full h-2 bg-black mt-1"></div>
                <p className="text-[8px] font-bold mt-1">
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
            <div className="bg-white p-2 font-sans text-black w-[101.6mm] h-[152.4mm] border-[6px] border-black flex flex-col overflow-hidden font-mono">
                <div className="border-b-[4px] border-black pb-1 mb-1 text-center">
                    <h1 className="text-3xl font-black">{systemSettings.companyName.toUpperCase()}</h1>
                </div>
                <div className="bg-black text-white p-2 text-center text-4xl font-black uppercase mb-2">
                    {pkg.recipientCommune}
                </div>
                <div className="border-b-2 border-black pb-2 mb-2">
                    <p className="text-xs uppercase font-bold">Destinatario:</p>
                    <p className="text-2xl font-black">{pkg.recipientName}</p>
                    <p className="text-xl font-bold">TEL: {pkg.recipientPhone}</p>
                    <p className="text-2xl font-black mt-2 leading-tight">{pkg.recipientAddress}</p>
                </div>
                <div className="flex-1 flex items-center justify-center py-4">
                    {qrCodeUrl && <img src={qrCodeUrl} alt="QR" className="w-56 h-56" />}
                </div>
                <div className="text-center font-black text-2xl border-t-2 border-black pt-2">
                    {qrContent}
                </div>
            </div>
        );
    }

    // 6. MINIMAL STICKER (62x100mm)
    if (format === LabelFormat.MinimalSticker) {
        return (
            <div className="bg-white p-2 font-sans text-black w-[62mm] h-[100mm] border-2 border-black flex flex-col overflow-hidden">
                <p className="text-[8px] font-black uppercase opacity-50 mb-1">{systemSettings.companyName}</p>
                <div className="bg-black text-white p-1 text-center font-black text-lg uppercase mb-1">
                    {pkg.recipientCommune}
                </div>
                <div className="flex-1 min-h-0">
                    <p className="text-[10px] font-bold truncate">{pkg.recipientName}</p>
                    <p className="text-[10px] font-black leading-tight line-clamp-2">{pkg.recipientAddress}</p>
                </div>
                <div className="flex items-center space-x-2 mt-auto border-t border-black pt-1">
                    {qrCodeUrl && <img src={qrCodeUrl} alt="QR" className="w-16 h-16" />}
                    <div className="min-w-0 flex-1">
                         <p className="text-[6px] font-black break-all">{qrContent}</p>
                         {isMeli && <p className="text-[8px] font-black bg-yellow-400 inline-block px-1 mt-1">FLEX</p>}
                    </div>
                </div>
            </div>
        );
    }

    // Default fallback
    return <div>Formato no soportado</div>;
};

export default ShippingLabel;