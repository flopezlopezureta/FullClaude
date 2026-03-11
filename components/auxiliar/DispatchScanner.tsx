import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import jsQR from 'jsqr';
import { api } from '../../services/api';
import { IconCheckCircle, IconAlertTriangle, IconUser, IconChevronRight, IconSearch, IconTruck, IconChevronDown } from '../Icon';
import type { User } from '../../types';
import { Role } from '../../constants';

const playBeep = () => {
    if (window.AudioContext || (window as any).webkitAudioContext) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        oscillator.connect(gainNode);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    }
};

interface ScannerViewProps {
    initialDriver: User;
    allDrivers: User[];
    onBack: () => void;
}

const ScannerView: React.FC<ScannerViewProps> = ({ initialDriver, allDrivers, onBack }) => {
    const [currentDriverId, setCurrentDriverId] = useState(initialDriver.id);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scannedCount, setScannedCount] = useState(0);
    const scannedInSession = useRef(new Set<string>());

    const currentDriver = allDrivers.find(d => d.id === currentDriverId) || initialDriver;

    const handleScan = useCallback(async (rawCode: string) => {
        const cleanRawCode = rawCode.trim();
        
        let extractedId: string | null = null;

        // Priority 1: Check for Alphanumeric 'SCA...' format
        const scaMatch = cleanRawCode.match(/[A-Z]{3}\d{2}-[A-Z0-9]{12}/);
        if (scaMatch && scaMatch[0]) {
            extractedId = scaMatch[0];
        } 
        // Priority 2: Check for long numeric string (typical tracking ID)
        else {
            const numericMatches = cleanRawCode.match(/\d+/g);
            if (numericMatches) {
                const longestNumber = numericMatches.sort((a, b) => b.length - a.length)[0];
                if (longestNumber && longestNumber.length >= 10) {
                    extractedId = longestNumber;
                }
            }
        }
        
        const codeToUse = extractedId || cleanRawCode;

        if (!isScanning || scannedInSession.current.has(codeToUse) || scannedInSession.current.has(rawCode)) return;

        setIsScanning(false);
        scannedInSession.current.add(codeToUse);
        scannedInSession.current.add(rawCode);

        try {
          await api.scanPackageForDispatch(codeToUse, currentDriverId);
          playBeep();
          setScannedCount(prev => prev + 1);
          setScanResult({ type: 'success', message: `Paquete #${scannedCount + 1} asignado a ${currentDriver.name}` });
          setTimeout(() => {
              setScanResult(null);
              setIsScanning(true);
          }, 1500);
        } catch (error: any) {
          scannedInSession.current.delete(codeToUse);
          scannedInSession.current.delete(rawCode);
          setScanResult({ type: 'error', message: error.message || 'Error al procesar el paquete.' });
          setTimeout(() => {
            setScanResult(null);
            setIsScanning(true);
          }, 4000);
        }
    }, [isScanning, currentDriverId, scannedCount, currentDriver.name]);
    
    const scanLoop = useCallback(() => {
        if (!isScanning) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
            const context = canvas.getContext('2d');
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            context?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
            if (imageData) {
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
                if (code) handleScan(code.data);
            }
        }
        requestRef.current = requestAnimationFrame(scanLoop);
    }, [isScanning, handleScan]);
    
    useEffect(() => {
        let mediaStream: MediaStream | null = null;
        const startCamera = async () => {
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                setStream(mediaStream);
                if (videoRef.current) videoRef.current.srcObject = mediaStream;
            } catch (err) {
                setCameraError("No se pudo acceder a la cámara. Revisa los permisos.");
            }
        };
        startCamera();
        return () => mediaStream?.getTracks().forEach(track => track.stop());
    }, []);

    useEffect(() => {
        if (isScanning && stream) {
            requestRef.current = requestAnimationFrame(scanLoop);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isScanning, stream, scanLoop]);

    return (
        <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-4 max-w-2xl mx-auto">
            <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1 text-center">Asignando paquetes a:</label>
                <div className="relative">
                    <select 
                        value={currentDriverId} 
                        onChange={(e) => setCurrentDriverId(e.target.value)}
                        className="block w-full pl-10 pr-10 py-3 text-base font-bold border-2 border-[var(--brand-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-muted)] text-[var(--text-primary)] appearance-none text-center"
                    >
                        {allDrivers.map(driver => (
                            <option key={driver.id} value={driver.id}>{driver.name}</option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <IconTruck className="h-6 w-6 text-[var(--brand-primary)]" />
                    </div>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <IconChevronDown className="h-5 w-5 text-[var(--text-muted)]" />
                    </div>
                </div>
            </div>

            <div className="relative bg-black rounded-md overflow-hidden aspect-video mb-4 border-4 border-[var(--border-primary)]">
                {cameraError ? <div className="flex items-center justify-center h-full text-white p-4 text-center">{cameraError}</div> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />}
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center p-8 pointer-events-none"><div className="w-full h-full border-4 border-dashed border-white/50 rounded-lg"/></div>
            </div>
            
            <div className="text-center my-4 p-3 bg-[var(--background-muted)] rounded-lg flex justify-between items-center px-6">
                <span className="text-lg font-bold text-[var(--text-primary)]">Sesión Actual:</span>
                <span className="text-3xl font-extrabold text-[var(--brand-primary)]">{scannedCount}</span>
            </div>
            
            <div className="h-16 mt-2 flex items-center justify-center">
                {scanResult ? (
                    <div className={`flex items-center p-4 rounded-md text-white shadow-lg transition-all transform scale-105 ${scanResult.type === 'success' ? 'bg-green-600' : 'bg-red-500'}`}>
                        {scanResult.type === 'success' ? <IconCheckCircle className="w-6 h-6 mr-3" /> : <IconAlertTriangle className="w-6 h-6 mr-3" />}
                        <span className="font-medium text-lg">{scanResult.message}</span>
                    </div>
                ) : (
                    <p className="text-center text-[var(--text-muted)] text-sm animate-pulse">Escanea el código QR del paquete...</p>
                )}
            </div>
            
            <button 
                onClick={onBack} 
                className="mt-4 w-full px-4 py-3 text-base font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-lg hover:bg-[var(--background-hover)]"
            >
                Volver a la lista
            </button>
        </div>
    );
};

const DispatchScanner: React.FC = () => {
    const [drivers, setDrivers] = useState<User[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchDrivers = async () => {
            setIsLoading(true);
            try {
                const allUsers = await api.getUsers();
                setDrivers(allUsers.filter(u => u.role === Role.Driver && u.status === 'APROBADO'));
            } catch (error) {
                console.error("Failed to fetch drivers", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDrivers();
    }, []);

    const filteredDrivers = useMemo(() => 
        drivers.filter(driver => 
            driver.name.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a,b) => a.name.localeCompare(b.name)),
        [drivers, searchQuery]
    );

    if (selectedDriver) {
        return <ScannerView initialDriver={selectedDriver} allDrivers={drivers} onBack={() => setSelectedDriver(null)} />;
    }

    if (isLoading) {
        return <p className="p-6 text-center text-[var(--text-muted)]">Cargando conductores...</p>;
    }

    return (
        <div className="bg-[var(--background-secondary)] shadow-md rounded-lg max-w-2xl mx-auto">
            <div className="p-6 border-b border-[var(--border-primary)]">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">Seleccionar Conductor</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">Elige un conductor para comenzar el despacho. Podrás cambiarlo luego dentro del escáner.</p>
                <div className="relative mt-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><IconSearch className="h-5 w-5 text-[var(--text-muted)]"/></div>
                    <input type="text" placeholder="Buscar conductor..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-[var(--border-secondary)] rounded-md bg-[var(--background-secondary)] text-[var(--text-primary)]"/>
                </div>
            </div>
            <div className="divide-y divide-[var(--border-primary)] max-h-[60vh] overflow-y-auto custom-scrollbar">
                {filteredDrivers.length > 0 ? (
                    filteredDrivers.map(driver => (
                        <button key={driver.id} onClick={() => setSelectedDriver(driver)} className="w-full text-left p-4 flex items-center justify-between hover:bg-[var(--background-hover)] transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className="bg-[var(--background-muted)] p-2 rounded-full group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors"><IconTruck className="w-6 h-6 text-[var(--text-muted)]" /></div>
                                <p className="font-semibold text-[var(--text-primary)]">{driver.name}</p>
                            </div>
                            <IconChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                        </button>
                    ))
                ) : (
                    <p className="p-6 text-center text-[var(--text-muted)]">No se encontraron conductores.</p>
                )}
            </div>
        </div>
    );
};

export default DispatchScanner;
