import React, { useEffect, useRef, useState, useContext } from 'react';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import { IconCheckCircle, IconAlertTriangle, IconX, IconMapPin, IconQrcode, IconLoader, IconPackage } from '../Icon';
import jsQR from 'jsqr';

// Declare Leaflet globally to avoid TypeScript errors
declare const L: any;

interface ScanResult {
  type: 'success' | 'error';
  message: string;
  pkg?: any;
  sectorDetails?: {
    comuna: string;
    sector: string;
    sectorLabel: string;
    geometry?: any;
  } | null;
}

interface ZoningScannerProps {
  onBack: () => void;
}

const ZoningScanner: React.FC<ZoningScannerProps> = ({ onBack }) => {
  const auth = useContext(AuthContext);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const scanLock = useRef(false);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const sectorLayerRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastScannedRaw, setLastScannedRaw] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);

  // --- Camera Setup ---
  useEffect(() => {
    let streamRef: MediaStream | null = null;
    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
        streamRef = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
        }
      } catch {
        setCameraError('No se pudo acceder a la cámara. Usa el ingreso manual.');
      }
    };
    startCamera();
    return () => {
      streamRef?.getTracks().forEach(t => t.stop());
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // --- QR Scanning Loop ---
  useEffect(() => {
    if (!stream) return;
    const scan = () => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState === 4) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
          if (code && code.data && !scanLock.current) {
            handleQuery(code.data);
          }
        }
      }
      requestRef.current = requestAnimationFrame(scan);
    };
    requestRef.current = requestAnimationFrame(scan);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [stream]);

  // --- Map Setup (once) ---
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    try {
      mapRef.current = L.map(mapContainerRef.current, { zoomControl: true, attributionControl: false }).setView([-33.4489, -70.6693], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
      sectorLayerRef.current = L.layerGroup().addTo(mapRef.current);
    } catch {}
  }, []);

  // --- Draw Sector on Map ---
  const drawSectorOnMap = (pkg: any, sectorDetails: any) => {
    if (!mapRef.current || !sectorLayerRef.current) return;
    sectorLayerRef.current.clearLayers();
    if (markerRef.current) {
      sectorLayerRef.current.removeLayer(markerRef.current);
    }

    if (sectorDetails?.geometry) {
      try {
        // Draw sector polygon
        const layer = L.geoJSON(
          { type: 'Feature', geometry: sectorDetails.geometry, properties: {} },
          {
            style: {
              color: '#4f46e5',
              weight: 3,
              fillColor: '#818cf8',
              fillOpacity: 0.3,
            },
          }
        );
        sectorLayerRef.current.addLayer(layer);
        // Fit map to sector bounds
        try { mapRef.current.fitBounds(layer.getBounds(), { padding: [30, 30] }); } catch {}
      } catch {}
    }

    if (pkg?.destLatitude && pkg?.destLongitude) {
      const lat = parseFloat(pkg.destLatitude);
      const lon = parseFloat(pkg.destLongitude);
      if (!isNaN(lat) && !isNaN(lon)) {
        const marker = L.circleMarker([lat, lon], {
          radius: 10,
          fillColor: '#ef4444',
          color: '#fff',
          weight: 2,
          fillOpacity: 1,
        }).bindPopup(`<b>${pkg.id}</b><br>${pkg.recipientAddress}<br><b>${sectorDetails?.sectorLabel || pkg.recipientCommune}</b>`);
        sectorLayerRef.current.addLayer(marker);
        marker.openPopup();
        markerRef.current = marker;
      }
    }
  };

  const handleQuery = async (rawCode: string) => {
    if (scanLock.current || isLoading) return;
    const code = rawCode.trim();
    if (!code) return;

    scanLock.current = true;
    setIsLoading(true);
    setLastScannedRaw(code);
    setScanResult(null);

    try {
      const res = await api.queryPackageSector(code);
      const pkg = res.package;
      const sectorDetails = res.sectorDetails;

      let sectorLabel = pkg.recipientCommune || 'Sin datos de zona';
      if (sectorDetails?.sectorLabel) sectorLabel = sectorDetails.sectorLabel;

      setScanResult({
        type: 'success',
        message: `✅ ${pkg.id}`,
        pkg,
        sectorDetails,
      });

      drawSectorOnMap(pkg, sectorDetails);
    } catch (err: any) {
      setScanResult({ type: 'error', message: err.message || 'Paquete no encontrado.' });
    } finally {
      setIsLoading(false);
      setTimeout(() => { scanLock.current = false; }, 2500);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleQuery(manualCode.trim());
      setManualCode('');
      setIsManualMode(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--background-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-700 text-white flex-shrink-0 safe-area-top">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-indigo-600 transition-colors">
          <IconX className="w-6 h-6" />
        </button>
        <div className="text-center">
          <h1 className="text-base font-bold">Consulta de Zona</h1>
          <p className="text-[10px] text-indigo-200">Escaneo sin asignación</p>
        </div>
        <button
          onClick={() => setIsManualMode(m => !m)}
          className="p-2 rounded-full hover:bg-indigo-600 transition-colors"
          title="Ingresar código manual"
        >
          <IconQrcode className="w-6 h-6" />
        </button>
      </div>

      {/* Manual entry bar */}
      {isManualMode && (
        <form onSubmit={handleManualSubmit} className="flex gap-2 px-3 py-2 bg-indigo-800 flex-shrink-0">
          <input
            type="text"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Ingresa código o ID del paquete..."
            className="flex-1 px-3 py-2 text-sm rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm font-bold bg-yellow-400 text-indigo-900 rounded-md hover:bg-yellow-300"
          >
            Buscar
          </button>
        </form>
      )}

      {/* Camera viewfinder */}
      <div className="relative bg-black flex-shrink-0" style={{ height: '200px' }}>
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900 p-4">
            <IconAlertTriangle className="w-8 h-8 text-yellow-400 mb-2" />
            <p className="text-xs text-center text-gray-300">{cameraError}</p>
            <button
              onClick={() => setIsManualMode(true)}
              className="mt-3 px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-md"
            >
              Usar Ingreso Manual
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-yellow-400 rounded-lg" style={{ width: 160, height: 100 }}>
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-yellow-400 rounded-tl" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-yellow-400 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-yellow-400 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-yellow-400 rounded-br" />
              </div>
            </div>
            {isLoading && (
              <div className="absolute top-2 right-2">
                <IconLoader className="w-6 h-6 text-yellow-400 animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Last scanned code pill */}
      {lastScannedRaw && (
        <div className="px-3 py-1 bg-[var(--background-muted)] border-b border-[var(--border-secondary)] flex-shrink-0">
          <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Último código leído:</p>
          <p className="text-xs font-mono text-[var(--text-primary)] truncate">{lastScannedRaw}</p>
        </div>
      )}

      {/* Result card */}
      {scanResult && (
        <div className={`mx-3 mt-2 p-3 rounded-xl border flex-shrink-0 ${scanResult.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'}`}>
          {scanResult.type === 'success' ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <IconCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="font-bold text-green-800 dark:text-green-300 text-sm truncate">{scanResult.pkg?.id}</span>
              </div>
              <div className="flex items-start gap-2 mt-1">
                <IconPackage className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">{scanResult.pkg?.recipientName}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{scanResult.pkg?.recipientAddress}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                <IconMapPin className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-black text-indigo-800 dark:text-indigo-300">
                    {scanResult.sectorDetails?.sectorLabel || scanResult.pkg?.recipientCommune || 'Zona no identificada'}
                  </p>
                  {!scanResult.sectorDetails && (
                    <p className="text-[10px] text-indigo-500">Sin coordenadas geocodificadas — se muestra la comuna declarada</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{scanResult.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 flex flex-col min-h-0 px-3 pb-3 mt-2">
        <div className="flex items-center gap-2 mb-1">
          <IconMapPin className="w-4 h-4 text-indigo-600" />
          <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Mapa del Sector</h2>
        </div>
        <div ref={mapContainerRef} className="flex-1 rounded-xl overflow-hidden border border-[var(--border-secondary)] z-0 min-h-[180px]" />
        {!scanResult && (
          <p className="text-center text-[10px] text-[var(--text-muted)] mt-1">
            Escanea un paquete para ver su sector en el mapa
          </p>
        )}
      </div>
    </div>
  );
};

export default ZoningScanner;
