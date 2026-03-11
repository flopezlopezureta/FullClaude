import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import jsQR from 'jsqr';
import { api } from '../../services/api';
import { IconCheckCircle, IconAlertTriangle } from '../Icon';
import type { User } from '../../types';

// Sound utility from other scanner component
const playBeep = () => {
    if (window.AudioContext || (window as any).webkitAudioContext) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc1 = audioCtx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc1.connect(audioCtx.destination);
        osc1.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 0.08);
        const osc2 = audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1600, audioCtx.currentTime + 0.09);
        osc2.connect(audioCtx.destination);
        osc2.start(audioCtx.currentTime + 0.09);
        osc2.stop(audioCtx.currentTime + 0.17);
    }
};

interface OrderScannerProps {
    client: User;
    onBack: () => void;
}

const OrderScanner: React.FC<OrderScannerProps> = ({ client, onBack }) => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scannedCount, setScannedCount] = useState(0);
    const scannedInSession = useRef(new Set<string>());

    const handleScan = useCallback(async (scannedId: string) => {
        if (!isScanning || scannedInSession.current.has(scannedId)) return;
        
        setIsScanning(false);
        scannedInSession.current.add(scannedId);

        const showFeedbackAndResume = (type: 'success' | 'error', message: string, duration: number) => {
            setScanFeedback({ type, message });
            setTimeout(() => {
                setScanFeedback(null);
                setIsScanning(true);
            }, duration);
        };
        
        try {
            const result = await api.importScannedMeliOrder(client.id, scannedId);
            playBeep();
            setScannedCount(prev => prev + 1);
            showFeedbackAndResume('success', result.message, 2000);
        } catch (error: any) {
            scannedInSession.current.delete(scannedId);
            showFeedbackAndResume('error', error.message || 'Error al importar paquete.', 4000);
        }
    }, [client.id, isScanning]);
    
    const tick = useCallback(() => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            context?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
            if (imageData) {
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });
                if (code) {
                    const scannedId = code.data.replace(/[^0-9]/g, ''); // Clean the ID
                    if (scannedId.length > 5) { // Basic validation
                         handleScan(scannedId);
                    }
                }
            }
        }
        if (isScanning) {
            requestRef.current = requestAnimationFrame(tick);
        }
    }, [isScanning, handleScan]);

    useEffect(() => {
        let mediaStream: MediaStream | null = null;
        const startCamera = async () => {
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    videoRef.current.play().catch(e => console.error("Error playing video:", e));
                }
            } catch (err: any) {
                let message = "No se pudo acceder a la cámara. Revisa los permisos.";
                if (err.name === "NotAllowedError") {
                    message = "Permiso de cámara denegado. Habilítalo en la configuración del navegador.";
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
            requestRef.current = requestAnimationFrame(tick);
        } else if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isScanning, stream, tick]);

    return (
        <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] text-center mb-2">
                Escaneando para: <span className="text-[var(--brand-primary)]">{client.name}</span>
            </h2>
            <div className="relative bg-black rounded-md overflow-hidden aspect-video border-4 border-[var(--border-primary)]">
                {cameraError ? (
                    <div className="flex items-center justify-center h-full text-white p-4 text-center">{cameraError}</div>
                ) : (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                )}
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center p-8 pointer-events-none">
                    <div className="w-full h-full border-4 border-dashed border-white/50 rounded-lg"/>
                </div>
            </div>
            <div className="h-16 mt-4 flex items-center justify-center">
                {scanFeedback ? (
                    <div className={`flex items-center p-4 rounded-md text-white ${scanFeedback.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {scanFeedback.type === 'success' ? <IconCheckCircle className="w-6 h-6 mr-3" /> : <IconAlertTriangle className="w-6 h-6 mr-3" />}
                        <span className="font-medium">{scanFeedback.message}</span>
                    </div>
                ) : (
                    <p className="text-center text-[var(--text-muted)]">Apunta al código de barras o QR de la etiqueta de Mercado Libre.</p>
                )}
            </div>
            <div className="text-center my-4 p-4 bg-[var(--background-muted)] rounded-lg">
                <span className="text-lg font-bold text-[var(--text-primary)]">Total Importado:</span>
                <span className="ml-2 text-3xl font-extrabold text-[var(--brand-primary)]">{scannedCount}</span>
            </div>
            <div className="mt-6 flex flex-col gap-3">
                <button 
                    onClick={onBack}
                    className="w-full px-4 py-2 text-base font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-lg hover:bg-[var(--background-hover)]"
                >
                    Cambiar de Cliente
                </button>
            </div>
        </div>
    );
};

export default OrderScanner;
