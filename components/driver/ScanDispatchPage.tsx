import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import jsQR from 'jsqr';
import { api } from '../../services/api';
import { IconCheckCircle, IconAlertTriangle } from '../Icon';
import { AuthContext } from '../../contexts/AuthContext';

const playBeep = () => {
    if (window.AudioContext || (window as any).webkitAudioContext) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        oscillator.connect(gainNode);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A4 pitch
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    }
};

interface ScanDispatchPageProps {
  onBack: () => void;
}

export const ScanDispatchPage: React.FC<ScanDispatchPageProps> = ({ onBack }) => {
  const { user } = useContext(AuthContext)!;
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [scannedInSession, setScannedInSession] = useState<Set<string>>(new Set());

  const handleScan = useCallback(async (packageId: string) => {
    if (!isScanning || !user || scannedInSession.has(packageId)) return;
    setIsScanning(false);
    
    setScannedInSession(prev => new Set(prev).add(packageId));

    try {
      const result = await api.scanPackageForDispatch(packageId, user.id);
      playBeep();
      setScannedCount(prev => prev + 1);
      setScanResult({ type: 'success', message: `¡Paquete #${scannedCount + 1} despachado!` });
      setTimeout(() => {
          setScanResult(null);
          setIsScanning(true);
      }, 1500);
    } catch (error: any) {
      setScannedInSession(prev => {
          const newSet = new Set(prev);
          newSet.delete(packageId);
          return newSet;
      });
      setScanResult({ type: 'error', message: error.message || 'Error al procesar el paquete.' });
      setTimeout(() => {
        setScanResult(null);
        setIsScanning(true);
      }, 4000);
    }
  }, [isScanning, user, scannedInSession, scannedCount]);

  const scanLoop = useCallback(() => {
    if (!isScanning) return;
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData) {
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
            if (code) {
                handleScan(code.data);
            }
        }
    }
    requestRef.current = requestAnimationFrame(scanLoop);
  }, [isScanning, handleScan]);

  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    const startCamera = async () => {
        try {
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            } catch (err) {
                console.warn("Could not get environment camera, falling back to default.", err);
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            setStream(mediaStream);
            const video = videoRef.current;
            if (video) {
                video.srcObject = mediaStream;
                video.onloadedmetadata = () => {
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(err => {
                            console.error("Video play failed:", err);
                            setCameraError("No se pudo iniciar la reproducción de la cámara.");
                        });
                    }
                };
            }
        } catch (err: any) {
            console.error("Camera Error:", err.name, err.message);
            let message = "No se pudo acceder a la cámara. Revisa los permisos.";
            if (err.name === "NotAllowedError") {
                message = "Permiso de cámara denegado. Habilítalo en la configuración del navegador.";
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                message = "No se encontró una cámara en este dispositivo.";
            } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
                message = "La cámara está ocupada o no se puede leer. Cierra otras apps que la usen.";
            }
            setCameraError(message);
        }
    };
    startCamera();

    return () => {
      mediaStream?.getTracks().forEach(track => track.stop());
    };
  }, []);


  useEffect(() => {
    if (isScanning && stream) {
      requestRef.current = requestAnimationFrame(scanLoop);
    } else if(requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
        if(requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [isScanning, stream, scanLoop]);
  
  return (
    <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2 text-center">Escanear Paquetes para Despacho</h2>
      <p className="text-center text-[var(--text-muted)] mb-4 -mt-1 text-sm">Escanea los paquetes que salen a reparto. Se asignarán a tu cuenta y se marcarán como "En Tránsito".</p>
      
      <div className="relative bg-black rounded-md overflow-hidden aspect-video mb-4 border-4 border-[var(--border-primary)]">
        {cameraError ? (
            <div className="flex items-center justify-center h-full text-white p-4 text-center">{cameraError}</div>
        ) : (
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center p-8 pointer-events-none">
            <div className="w-full h-full border-4 border-dashed border-white/50 rounded-lg"/>
        </div>
      </div>
      
      <div className="text-center my-4 p-4 bg-[var(--background-muted)] rounded-lg">
        <span className="text-lg font-bold text-[var(--text-primary)]">Total Despachado:</span>
        <span className="ml-2 text-3xl font-extrabold text-[var(--brand-primary)]">{scannedCount}</span>
      </div>
      
      <div className="h-16 mt-4 flex items-center justify-center">
        {scanResult ? (
            <div className={`flex items-center p-4 rounded-md text-white animate-fade-in-up ${scanResult.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                {scanResult.type === 'success' ? <IconCheckCircle className="w-6 h-6 mr-3" /> : <IconAlertTriangle className="w-6 h-6 mr-3" />}
                <span className="font-medium">{scanResult.message}</span>
            </div>
        ) : (
             <p className="text-center text-[var(--text-muted)]">Apunta la cámara al código QR para agregarlo a tu ruta de despacho.</p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button 
          onClick={onBack}
          className="w-full px-4 py-2 text-base font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-lg hover:bg-[var(--background-hover)]"
        >
          Volver
        </button>
      </div>

      <style>{`
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ScanDispatchPage;