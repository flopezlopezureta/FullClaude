import React, { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { Package } from '../../types';
import { DeliveryConfirmationData } from '../../services/api';
import { IconX, IconUser, IconId, IconCamera, IconAlertTriangle, IconCheckCircle } from '../Icon';
import { AuthContext } from '../../contexts/AuthContext';

interface DeliveryConfirmationModalProps {
  pkg: Package;
  onClose: () => void;
  onConfirm: (pkgId: string, data: DeliveryConfirmationData) => Promise<void>;
}

const CameraView: React.FC<{ onCapture: (dataUrl: string) => void, onCancel: () => void }> = ({ onCapture, onCancel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    useEffect(() => {
        let mediaStream: MediaStream | null = null;
        const startCamera = async () => {
            try {
                const videoConstraints: MediaTrackConstraints = {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                };
                try {
                    mediaStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
                } catch (err) {
                    console.warn("Could not get environment camera, falling back to default.", err);
                    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
                }
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

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            onCapture(dataUrl);
        }
    };

    return (
        <div className="absolute inset-0 bg-black z-10 flex flex-col items-center justify-center">
            {cameraError ? (
                <div className="text-white text-center p-8">
                    <IconAlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-300" />
                    <p className="font-semibold text-lg">Error de Cámara</p>
                    <p className="text-sm mt-2">{cameraError}</p>
                    <button onClick={onCancel} className="mt-6 px-6 py-2 text-sm font-medium text-black bg-white rounded-lg">Volver</button>
                </div>
            ) : (
                <>
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50 flex justify-center space-x-4">
                        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-white bg-slate-600 rounded-md">Cancelar</button>
                        <button onClick={handleCapture} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md">Capturar Foto</button>
                    </div>
                </>
            )}
        </div>
    );
};

const validateRut = (rutCompleto: string): boolean => {
    rutCompleto = rutCompleto.replace(/\./g, '').replace('-', '');
    if (!/^[0-9]+[0-9kK]{1}$/.test(rutCompleto)) {
        return false;
    }
    const rut = rutCompleto.slice(0, -1);
    const dv = rutCompleto.slice(-1).toUpperCase();
    let suma = 0;
    let multiplo = 2;
    for (let i = rut.length - 1; i >= 0; i--) {
        suma += parseInt(rut.charAt(i), 10) * multiplo;
        if (multiplo < 7) {
            multiplo++;
        } else {
            multiplo = 2;
        }
    }
    const dvEsperado = 11 - (suma % 11);
    const dvCalculado = (dvEsperado === 11) ? '0' : (dvEsperado === 10) ? 'K' : dvEsperado.toString();

    return dv === dvCalculado;
};


const DeliveryConfirmationModal: React.FC<DeliveryConfirmationModalProps> = ({ pkg, onClose, onConfirm }) => {
  const [receiverName, setReceiverName] = useState(pkg.recipientName || '');
  const [receiverId, setReceiverId] =useState('');
  const [photosBase64, setPhotosBase64] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rutError, setRutError] = useState<string | null>(null);

  const auth = useContext(AuthContext);
  const requiredPhotos = auth?.systemSettings.requiredPhotos || 1;
  const photosRemaining = requiredPhotos - photosBase64.length;

  const formatRut = (rut: string) => {
    rut = rut.replace(/[^0-9kK]/g, '');
    let result = '';
    let i = rut.length - 1;
    if (i >= 0) {
      result = '-' + rut[i];
      i--;
    }
    let count = 0;
    for (; i >= 0; i--) {
      result = rut[i] + result;
      count++;
      if (count === 3 && i > 0) {
        result = '.' + result;
        count = 0;
      }
    }
    return result.toUpperCase();
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const rawValue = value.replace(/[^0-9kK]/g, '');

    let finalRawValue = rawValue;

    if (rawValue.endsWith('1') && (rawValue.length >= 8 && rawValue.length <= 9)) {
        const numberPart = rawValue.slice(0, -1);
        const rutWithOne = numberPart + '1';
        const rutWithK = numberPart + 'K';
        const isOneValid = validateRut(rutWithOne);
        const isKValid = validateRut(rutWithK);
        if (isKValid && !isOneValid) {
             finalRawValue = rutWithK;
        }
    }
    
    setReceiverId(formatRut(finalRawValue));
    
    if (rutError) {
        setRutError(null);
    }
  };

  const handleRutBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const rut = e.target.value;
    if (rut.trim() !== '' && !validateRut(rut)) {
        setRutError('El RUT ingresado no es válido.');
    } else {
        setRutError(null);
    }
  };
  
  const handleRemovePhoto = (indexToRemove: number) => {
      setPhotosBase64(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const isFormValid = receiverName.trim() !== '' && receiverId.trim() !== '' && photosBase64.length >= requiredPhotos && !rutError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm(pkg.id, {
        receiverName,
        receiverId,
        photosBase64,
      });
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado al confirmar la entrega.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between p-4 border-b border-[var(--border-primary)]">
            <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Confirmar Entrega: <span className="text-[var(--brand-primary)]">{pkg.id}</span></h3>
                <p className="text-sm text-[var(--text-muted)]">Para: {pkg.recipientName}</p>
            </div>
          <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto no-scrollbar">
            {error && <p className="text-sm text-[var(--error-text)] bg-[var(--error-bg)] p-3 rounded-md flex items-center"><IconAlertTriangle className="w-4 h-4 mr-2"/> {error}</p>}
            
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IconUser className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <input type="text" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Nombre de quien recibe" required className="w-full pl-10 pr-3 py-2 border border-[var(--border-secondary)] rounded-md bg-[var(--background-secondary)] text-[var(--text-primary)]"/>
            </div>
            <div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <IconId className="h-5 w-5 text-[var(--text-muted)]" />
                    </div>
                    <input 
                        type="tel"
                        value={receiverId} 
                        onChange={handleRutChange}
                        onBlur={handleRutBlur}
                        placeholder="RUT de quien recibe" 
                        required 
                        className={`w-full pl-10 pr-3 py-2 border rounded-md bg-[var(--background-secondary)] text-[var(--text-primary)] ${rutError ? 'border-red-500' : 'border-[var(--border-secondary)]'}`}
                        aria-invalid={!!rutError}
                    />
                </div>
                {rutError && <p className="text-xs text-red-600 mt-1 ml-1">{rutError}</p>}
            </div>

            <div className="p-4 bg-[var(--background-muted)] rounded-lg text-center">
                {photosBase64.length > 0 && (
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                            {photosBase64.map((photo, index) => (
                                <div key={index} className="relative aspect-square">
                                    <img src={photo} alt={`Prueba de entrega ${index + 1}`} className="rounded-md w-full h-full object-cover" />
                                    <button type="button" onClick={() => handleRemovePhoto(index)} className="absolute top-1 right-1 p-1 bg-black bg-opacity-60 text-white rounded-full hover:bg-opacity-80" aria-label={`Quitar foto ${index + 1}`}>
                                        <IconX className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {photosRemaining > 0 ? (
                    <button type="button" onClick={() => setIsCameraOpen(true)} className={`w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-[var(--border-secondary)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--background-hover)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors ${photosBase64.length > 0 ? 'mt-3' : ''}`}>
                        <IconCamera className="w-10 h-10 mb-2" />
                        <span className="font-semibold">{photosBase64.length > 0 ? 'Agregar Otra Foto' : 'Tomar Foto de Entrega'}</span>
                        <span className="text-xs mt-1">({photosRemaining} restante{photosRemaining > 1 ? 's' : ''})</span>
                    </button>
                ) : (
                    <p className="text-xs text-green-600 flex items-center justify-center mt-3"><IconCheckCircle className="w-4 h-4 mr-1.5"/> Todas las fotos requeridas han sido capturadas.</p>
                )}
                {isCameraOpen && <CameraView onCapture={(dataUrl) => { setPhotosBase64(prev => [...prev, dataUrl]); setIsCameraOpen(false); }} onCancel={() => setIsCameraOpen(false)} />}
            </div>
          </div>

          <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3 border-t border-[var(--border-primary)]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
            <button type="submit" disabled={!isFormValid || isLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed">
              {isLoading ? 'Confirmando...' : 'Confirmar Entrega'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default DeliveryConfirmationModal;