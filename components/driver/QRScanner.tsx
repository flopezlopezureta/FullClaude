import React, { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import jsQR from 'jsqr';
import { api } from '../../services/api';
import { IconCheckCircle, IconAlertTriangle, IconChecklist, IconX, IconPackage, IconQrcode } from '../Icon';
import type { Package, User, DriverPermissions } from '../../types';
import { PackageStatus, MessagingPlan, PickupMode } from '../../constants';
import { AuthContext } from '../../contexts/AuthContext';

interface QRScannerProps {
    client: User;
    onBack: () => void;
    driverPermissions?: DriverPermissions;
}

const playBeep = () => {
    if (window.AudioContext || (window as any).webkitAudioContext) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);

        const osc1 = audioCtx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc1.connect(gainNode);
        osc1.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 0.08);

        const osc2 = audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1600, audioCtx.currentTime + 0.09);
        osc2.connect(gainNode);
        osc2.start(audioCtx.currentTime + 0.09);
        osc2.stop(audioCtx.currentTime + 0.17);
    }
};

const QRScanner: React.FC<QRScannerProps> = ({ client, onBack, driverPermissions }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [scannedPackageIds, setScannedPackageIds] = useState<string[]>([]);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isManifestOpen, setIsManifestOpen] = useState(false);
  
  const [isConfirmingCount, setIsConfirmingCount] = useState(false);
  const [manualCount, setManualCount] = useState<number | ''>('');
  
  const auth = useContext(AuthContext);

  const canPickup = driverPermissions?.canPickup ?? true; // Default to true if not provided

  const fetchPackages = async () => {
        try {
            // Fetch ALL packages to ensure we can scan anything
            const { packages: pkgs } = await api.getPackages({ limit: 0 });
            setPackages(pkgs);
        } catch (e) {
            console.error("Could not fetch packages for validation", e);
            setCameraError("No se pudieron cargar los datos de los paquetes para validación.");
        }
  }

  useEffect(() => {
    fetchPackages();
    // Polling to get updates (e.g. admin reassigned a package to pending)
    const interval = setInterval(fetchPackages, 15000);
    return () => clearInterval(interval);
  }, []);

  const scannedPackagesList = useMemo(() => {
      return packages.filter(p => scannedPackageIds.includes(p.id));
  }, [packages, scannedPackageIds]);

  const handleScan = useCallback(async (rawCode: string) => {
    if(!isScanning) return;

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
    
    const codeForApi = extractedId || cleanRawCode;

    let pkg = packages.find(p => 
        p.id === codeForApi || 
        (p.meliOrderId && (p.meliOrderId === codeForApi || p.meliOrderId === cleanRawCode)) ||
        (p.shopifyOrderId && p.shopifyOrderId === codeForApi) ||
        (p.wooOrderId && p.wooOrderId === codeForApi)
    );

    if (pkg && scannedPackageIds.includes(pkg.id)) {
        return; // Already scanned in this session
    }

    setIsScanning(false);

    const showFeedbackAndResume = (type: 'success' | 'error', message: string, duration: number) => {
        setScanFeedback({ type, message });
        setTimeout(() => {
            setScanFeedback(null);
            setIsScanning(true);
        }, duration);
    };

    try {
        if (!pkg || (pkg.status === PackageStatus.PickedUp || pkg.status === PackageStatus.InTransit)) {
             try {
                 const searchRes = await api.getPackages({ searchQuery: codeForApi, limit: 1 });
                 if (searchRes.packages.length > 0) {
                     const freshPkg = searchRes.packages[0];
                     if (freshPkg.creatorId === client.id && freshPkg.status === PackageStatus.Pending) {
                         pkg = freshPkg; 
                     }
                 }
             } catch (e) { console.warn("Failed to double check package", e); }
        }

        let finalPackageId = pkg?.id;
        let isExternalImport = false;

        if (pkg) {
            if (pkg.status !== PackageStatus.Pending) {
                if (pkg.status === PackageStatus.PickedUp || pkg.status === PackageStatus.InTransit) {
                     showFeedbackAndResume('success', 'Ya retirado anteriormente.', 1500);
                     return;
                }
                showFeedbackAndResume('error', `El paquete está en estado ${pkg.status}.`, 3000);
                return;
            }

            if (pkg.creatorId !== client.id) {
                showFeedbackAndResume('error', `Paquete pertenece a otro cliente.`, 3000);
                return;
            }

            finalPackageId = pkg.id;
            await api.markPackageAsPickedUp(finalPackageId);
            
        } else {
            if (client.integrations?.meli) {
                 try {
                    const response = await api.importScannedMeliOrder(client.id, codeForApi);
                    pkg = response.pkg;
                    finalPackageId = pkg.id;
                    isExternalImport = true;
                 } catch (importError: any) {
                     console.warn("External import failed", importError);
                     let msg = importError.message || 'Error desconocido';
                     if (msg.includes('not found') || msg.includes('no encontrado')) {
                         msg = `No encontrado (ni local, ni ML): ${codeForApi}`;
                     }
                     showFeedbackAndResume('error', msg, 3000);
                     return;
                 }
            } else {
                 showFeedbackAndResume('error', `Código ${codeForApi} no encontrado.`, 3000);
                 return;
            }
        }

        if (!finalPackageId) throw new Error("ID de paquete no resuelto.");

        playBeep(); 
        setScannedPackageIds(prev => [...prev, finalPackageId!]);

        if (isExternalImport && pkg) {
             const packageToAdd = { ...pkg, status: PackageStatus.PickedUp };
             setPackages(prev => [...prev, packageToAdd]);
             showFeedbackAndResume('success', `¡Importado y Retirado!`, 2000);
        } else {
             setPackages(prevPackages => prevPackages.map(p => 
                p.id === finalPackageId ? { ...p, status: PackageStatus.PickedUp } : p
            ));
            showFeedbackAndResume('success', `¡Paquete retirado!`, 1500);
        }

    } catch (error: any) {
      showFeedbackAndResume('error', error.message || 'Error al procesar.', 3000);
    }
  }, [client, packages, isScanning, scannedPackageIds]);

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
          const cleanData = code.data.trim();
          if (cleanData) handleScan(cleanData);
        }
      }
    }
    if (isScanning) {
        requestRef.current = requestAnimationFrame(tick);
    }
  }, [isScanning, handleScan]);
  
  useEffect(() => {
    if (!canPickup) return;
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
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(err => {
                            setCameraError("No se pudo iniciar la reproducción de la cámara.");
                        });
                    }
                };
            }
        } catch (err: any) {
            setCameraError("No se pudo acceder a la cámara. Revisa los permisos.");
        }
    };
    startCamera();

    return () => {
      mediaStream?.getTracks().forEach(track => track.stop());
    };
  }, [canPickup]);


  useEffect(() => {
    if (isScanning && stream && canPickup) {
      requestRef.current = requestAnimationFrame(tick);
    } else if(requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
        if(requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [isScanning, stream, tick, canPickup]);

  const handleInitialFinishClick = () => {
    if (auth?.systemSettings.pickupMode === PickupMode.ScanWithCount) {
        setManualCount(scannedPackageIds.length);
        setIsConfirmingCount(true);
        setIsScanning(false);
    } else {
        handleFinishPickup(scannedPackageIds.length);
    }
  };
  
  const handleFinishPickup = async (finalCount: number) => {
    setIsFinishing(true);

    try {
        await api.completeClientPickupAssignment(client.id, finalCount);

        const message = `Hola ${client.name}, hemos retirado ${finalCount} paquetes.\n\nIDs Escaneados: ${scannedPackageIds.join(', ')}\n\n¡Gracias!`;
        
        if (auth?.systemSettings.messagingPlan === MessagingPlan.WhatsApp && client.phone) {
            const clientPhone = client.phone.replace(/\D/g, '');
            const whatsappUrl = `https://wa.me/${clientPhone}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        } else if (auth?.systemSettings.messagingPlan === MessagingPlan.Email && client.email) {
            const subject = `Retiro de ${finalCount} paquetes completado`;
            const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
            window.open(mailtoUrl, '_blank');
        }

        setTimeout(() => {
            onBack();
        }, 1500);
    } catch (error) {
        console.error("Failed to complete pickup assignment", error);
        alert("Hubo un error al finalizar el retiro. Intente nuevamente.");
        setIsFinishing(false);
        setIsConfirmingCount(false);
    }
  };

  if (!canPickup) {
    return (
        <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6 max-w-2xl mx-auto text-center">
             <div className="my-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
                <div className="flex">
                    <div className="py-1"><IconAlertTriangle className="h-6 w-6 text-red-500 mr-4" /></div>
                    <div>
                        <p className="font-bold">No tienes permiso para realizar retiros.</p>
                        <p className="text-sm">Contacta a un administrador para que active este permiso en tu perfil.</p>
                    </div>
                </div>
            </div>
            <button 
                onClick={onBack}
                className="w-full mt-4 px-4 py-2 text-base font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-lg hover:bg-[var(--background-hover)]"
            >
                Volver
            </button>
        </div>
    );
  }


  return (
    <div className="bg-[var(--background-secondary)] shadow-md rounded-lg p-6 max-w-2xl mx-auto relative">
      <h2 className="text-xl font-semibold text-[var(--text-primary)] text-center mb-2">
          Retirando para: <span className="text-[var(--brand-primary)]">{client.name}</span>
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
      
      <div className="mt-4 text-center">
          <p className="text-sm text-[var(--text-secondary)] font-medium">Paquetes Escaneados</p>
          <p className="text-4xl font-extrabold text-[var(--brand-primary)]">{scannedPackageIds.length}</p>
      </div>
      
      <div className="h-14 mt-2 flex items-center justify-center">
        {scanFeedback ? (
            <div className={`flex items-center px-4 py-2 rounded-md text-white shadow-md ${scanFeedback.type === 'success' ? 'bg-green-600' : 'bg-red-500'}`}>
                {scanFeedback.type === 'success' ? <IconCheckCircle className="w-5 h-5 mr-2" /> : <IconAlertTriangle className="w-5 h-5 mr-2" />}
                <span className="font-medium text-sm">{scanFeedback.message}</span>
            </div>
        ) : (
             <p className="text-center text-[var(--text-muted)] text-sm">Apunta la cámara al código QR del paquete.</p>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-3">
        <button 
          onClick={() => setIsManifestOpen(true)}
          className="w-full px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-muted)] border border-[var(--border-secondary)] rounded-lg hover:bg-[var(--background-hover)] flex items-center justify-center gap-2"
        >
          <IconChecklist className="w-5 h-5" /> Ver Escaneados ({scannedPackageIds.length})
        </button>
        <button 
          onClick={handleInitialFinishClick}
          disabled={isFinishing}
          className="w-full px-4 py-3 text-base font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          {isFinishing ? 'Finalizando...' : `Finalizar Retiro`}
        </button>
        <button 
          onClick={onBack}
          className="w-full px-4 py-2 text-base font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-lg hover:bg-[var(--background-hover)]"
        >
          Volver
        </button>
      </div>

      {isManifestOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-60 p-4 sm:p-6 animate-fade-in-up">
              <div className="bg-[var(--background-secondary)] w-full max-w-md rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
                  <header className="p-4 border-b border-[var(--border-primary)] flex justify-between items-center">
                      <h3 className="font-bold text-[var(--text-primary)]">Paquetes Escaneados</h3>
                      <button onClick={() => setIsManifestOpen(false)} className="p-2 rounded-full hover:bg-[var(--background-hover)] text-[var(--text-muted)]">
                          <IconX className="w-6 h-6" />
                      </button>
                  </header>
                  <div className="p-4 overflow-y-auto flex-1">
                      {scannedPackagesList.length === 0 ? (
                          <p className="text-center text-[var(--text-muted)] py-8">Aún no has escaneado ningún paquete en esta sesión.</p>
                      ) : (
                          <ul className="divide-y divide-[var(--border-primary)]">
                              {scannedPackagesList.map((pkg, idx) => (
                                  <li key={pkg.id} className="py-3 flex items-start justify-between">
                                      <div className="flex-1 min-w-0 pr-4">
                                          <p className="text-sm font-medium text-[var(--text-primary)]">
                                              {idx + 1}. {pkg.recipientName}
                                          </p>
                                          <p className="text-xs text-[var(--text-muted)] truncate">{pkg.recipientCommune}</p>
                                          <p className="text-xs font-mono text-[var(--text-secondary)]">{pkg.id}</p>
                                      </div>
                                      <div className="flex-shrink-0">
                                          <IconCheckCircle className="w-6 h-6 text-green-500" />
                                      </div>
                                  </li>
                              ))}
                          </ul>
                      )}
                  </div>
                  <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--background-muted)] rounded-b-xl">
                      <p className="text-center text-sm text-[var(--text-secondary)]">
                          {scannedPackageIds.length} escaneados en total
                      </p>
                  </div>
              </div>
          </div>
      )}

      {isConfirmingCount && (
          <div className="fixed inset-0 z-50 flex justify-center items-center bg-black bg-opacity-70 p-4 animate-fade-in-up">
            <div className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                <button onClick={() => { setIsConfirmingCount(false); setIsScanning(true); }} className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:bg-[var(--background-hover)] rounded-full"><IconX className="w-6 h-6"/></button>
                <h3 className="text-lg font-bold text-[var(--text-primary)] text-center mb-4">Confirmar Total Retirado</h3>
                
                <div className="flex flex-col items-center mb-6">
                     <input
                        type="number"
                        value={manualCount}
                        onChange={(e) => setManualCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="block w-32 text-center text-4xl font-bold py-3 border-2 border-[var(--brand-primary)] rounded-md bg-[var(--background-muted)] text-[var(--text-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-muted)]"
                        autoFocus
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                        Escaneados por cámara: {scannedPackageIds.length}
                    </p>
                </div>

                <button 
                    onClick={() => handleFinishPickup(Number(manualCount))}
                    disabled={manualCount === '' || isFinishing}
                    className="w-full px-4 py-3 text-base font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    {isFinishing ? 'Finalizando...' : 'Confirmar y Finalizar'}
                </button>
            </div>
          </div>
      )}
    </div>
  );
};

export default QRScanner;
