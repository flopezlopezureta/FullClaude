import React, { useState, useRef, useEffect } from 'react';
import { Package } from '../../types';
import { IconX, IconAlertTriangle, IconCamera } from '../Icon';

interface UndeliveredModalProps {
  pkg: Package;
  onClose: () => void;
  onConfirm: (pkgId: string, reason: string, photos: string[]) => Promise<void>;
}

const commonReasons = [
    "Destinatario ausente en domicilio",
    "Dirección de entrega incorrecta o incompleta",
    "Entrega rechazada por el destinatario",
    "Acceso denegado o zona peligrosa",
    "Cliente solicita reagendar entrega",
    "Otro motivo (especificar)",
];

const CameraView: React.FC<{ onCapture: (dataUrl: string) => void, onCancel: () => void }> = ({ onCapture, onCancel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    useEffect(() => {
        let mediaStream: MediaStream | null = null;
        const startCamera = async () => {
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                const video = videoRef.current;
                if (video) {
                    video.srcObject = mediaStream;
                    video.onloadedmetadata = () => video.play().catch(err => setCameraError("No se pudo iniciar la cámara."));
                }
            } catch (err: any) {
                let message = "No se pudo acceder a la cámara. Revisa los permisos.";
                if (err.name === "NotAllowedError") message = "Permiso de cámara denegado.";
                setCameraError(message);
            }
        };
        startCamera();
        return () => {
            mediaStream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            onCapture(canvas.toDataURL('image/jpeg', 0.8));
        }
    };

    return (
        <div className="absolute inset-0 bg-black z-10 flex flex-col items-center justify-center">
            {cameraError ? (
                <div className="text-white text-center p-8">
                    <p>{cameraError}</p>
                    <button onClick={onCancel} className="mt-4 px-4 py-2 text-black bg-white rounded-lg">Volver</button>
                </div>
            ) : (
                <>
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50 flex justify-center space-x-4">
                        <button onClick={onCancel} className="px-4 py-2 text-white bg-slate-600 rounded-md">Cancelar</button>
                        <button onClick={handleCapture} className="px-4 py-2 text-white bg-blue-600 rounded-md">Capturar</button>
                    </div>
                </>
            )}
        </div>
    );
};


const UndeliveredModal: React.FC<UndeliveredModalProps> = ({ pkg, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [photosBase64, setPhotosBase64] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const finalReason = reason === "Otro motivo (especificar)" ? customReason : reason;
  const isFormValid = finalReason.trim() !== '' && photosBase64.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsLoading(true);
    setError('');
    try {
      await onConfirm(pkg.id, finalReason, photosBase64);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al reportar el problema.');
      setIsLoading(false);
    }
  };
  
  const handleRemovePhoto = (indexToRemove: number) => {
      setPhotosBase64(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between p-4 border-b border-[var(--border-primary)]">
            <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Reportar Problema de Entrega</h3>
                <p className="text-sm text-[var(--text-muted)]">Paquete: <span className="font-medium text-[var(--brand-primary)]">{pkg.id}</span></p>
            </div>
          <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {error && <p className="text-sm text-[var(--error-text)] bg-[var(--error-bg)] p-3 rounded-md flex items-center"><IconAlertTriangle className="w-4 h-4 mr-2"/> {error}</p>}
            
            <div>
              <label htmlFor="reason-select" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Motivo del problema</label>
              <select
                id="reason-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)]"
              >
                <option value="" disabled>Selecciona un motivo...</option>
                {commonReasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {reason === "Otro motivo (especificar)" && (
              <div>
                <label htmlFor="custom-reason" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Describe el motivo</label>
                <textarea
                  id="custom-reason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)]"
                  placeholder="Ej: El cliente no responde al teléfono y no hay conserjería."
                />
              </div>
            )}
            
            <div className="p-4 bg-[var(--background-muted)] rounded-lg text-center">
                <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Evidencia Fotográfica (Obligatorio)</h4>
                {photosBase64.length > 0 && (
                     <div className="grid grid-cols-3 gap-2 mb-3">
                        {photosBase64.map((photo, index) => (
                            <div key={index} className="relative aspect-square">
                                <img src={photo} alt={`Evidencia ${index + 1}`} className="rounded-md w-full h-full object-cover" />
                                <button type="button" onClick={() => handleRemovePhoto(index)} className="absolute top-1 right-1 p-1 bg-black bg-opacity-60 text-white rounded-full hover:bg-opacity-80">
                                    <IconX className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                 <button type="button" onClick={() => setIsCameraOpen(true)} className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-[var(--border-secondary)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--background-hover)]">
                    <IconCamera className="w-10 h-10 mb-2" />
                    <span className="font-semibold">{photosBase64.length > 0 ? 'Agregar Otra Foto' : 'Tomar Foto de Evidencia'}</span>
                </button>
                {isCameraOpen && <CameraView onCapture={(dataUrl) => { setPhotosBase64(prev => [...prev, dataUrl]); setIsCameraOpen(false); }} onCancel={() => setIsCameraOpen(false)} />}
            </div>
          </div>

          <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
            <button type="submit" disabled={!isFormValid || isLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:bg-slate-400 disabled:cursor-not-allowed">
              {isLoading ? 'Reportando...' : 'Confirmar Problema'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default UndeliveredModal;