import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { IconCheckCircle, IconAlertTriangle, IconChevronLeft, IconInfo } from '../Icon';

interface MeliFlexTestScannerProps {
  onBack?: () => void;
}

export const MeliFlexTestScanner: React.FC<MeliFlexTestScannerProps> = ({ onBack }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error' | 'info'; message: string; data?: string; extractedId?: string } | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const handleScan = useCallback((data: string) => {
    if (!isScanning) return;
    setIsScanning(false);
    
    // Play a beep sound if possible
    try {
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
    } catch (e) {}

    // Validation logic
    let type: 'success' | 'error' | 'info' = 'info';
    let message = 'Código detectado';
    
    // Check if it's a Mercado Libre Flex URL or code
    const isMeliUrl = data.includes('/flex/shipping/');
    const isMeliCode = /^\d{10,20}$/.test(data.trim()); // Simple heuristic for ML IDs

    let extractedId = data.trim();
    if (isMeliUrl) {
        const parts = data.split('/');
        // Get the last non-empty part of the URL path
        extractedId = parts.filter(p => p.trim() !== '').pop() || data;
        type = 'success';
        message = '¡Código de ML Flex leído correctamente (URL)!';
    } else if (isMeliCode) {
        type = 'success';
        message = '¡ID de Mercado Libre detectado correctamente!';
    } else {
        type = 'info';
        message = 'Código leído, pero no parece ser un formato estándar de ML Flex.';
    }

    setScanResult({ type, message, data, extractedId });
  }, [isScanning]);

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
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            setStream(mediaStream);
            const video = videoRef.current;
            if (video) {
                video.srcObject = mediaStream;
                video.onloadedmetadata = () => {
                    video.play().catch(console.error);
                };
            }
        } catch (err: any) {
            setCameraError("No se pudo acceder a la cámara.");
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
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2 text-center">Prueba de Lectura ML Flex</h2>
      <p className="text-center text-[var(--text-muted)] mb-4 -mt-1 text-sm">Esta es una herramienta de prueba para verificar si los códigos de Mercado Libre Flex se leen correctamente.</p>
      
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
      
      <div className="min-h-[160px] mt-4 flex items-center justify-center">
        {scanResult ? (
            <div className={`flex flex-col items-center p-4 rounded-md text-white animate-fade-in-up w-full ${
                scanResult.type === 'success' ? 'bg-green-500' : 
                scanResult.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }`}>
                <div className="flex items-center mb-3">
                    {scanResult.type === 'success' ? <IconCheckCircle className="w-6 h-6 mr-3" /> : 
                     scanResult.type === 'error' ? <IconAlertTriangle className="w-6 h-6 mr-3" /> :
                     <IconInfo className="w-6 h-6 mr-3" />}
                    <span className="font-bold">{scanResult.message}</span>
                </div>
                
                <div className="w-full space-y-2">
                    <div className="bg-black/20 p-2 rounded w-full">
                        <p className="text-[10px] uppercase opacity-70 mb-1">Contenido QR (Raw):</p>
                        <p className="text-xs font-mono break-all">{scanResult.data}</p>
                    </div>
                    
                    {scanResult.extractedId && scanResult.extractedId !== scanResult.data && (
                        <div className="bg-black/20 p-2 rounded w-full">
                            <p className="text-[10px] uppercase opacity-70 mb-1">ID Extraído (Limpio):</p>
                            <p className="text-sm font-mono font-bold break-all">{scanResult.extractedId}</p>
                        </div>
                    )}
                </div>

                <button 
                    onClick={() => {
                        setScanResult(null);
                        setIsScanning(true);
                    }}
                    className="mt-4 px-6 py-2 bg-white text-black font-bold rounded-full text-sm hover:bg-opacity-90 transition-all"
                >
                    Escanear Siguiente
                </button>
            </div>
        ) : (
             <p className="text-center text-[var(--text-muted)]">Apunta la cámara a un código QR de Mercado Libre.</p>
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
              <strong>Nota:</strong> Si el código se lee bien aquí pero da error en "Despacho", asegúrate de que el paquete ya haya sido <strong>Retirado</strong> en el sistema. Los paquetes deben estar en el sistema antes de poder ser despachados.
          </p>
      </div>

      <div className="mt-6">
        <button 
          onClick={onBack}
          className="w-full px-4 py-2 text-base font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-lg hover:bg-[var(--background-hover)] flex items-center justify-center gap-2"
        >
          <IconChevronLeft className="w-5 h-5" /> Volver al Menú
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

export default MeliFlexTestScanner;
