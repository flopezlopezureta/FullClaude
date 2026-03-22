
import React, { useEffect, useRef } from 'react';

declare const L: any;

interface TrackingMapProps {
  destLat: number | null;
  destLng: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
  status: string;
}

const TrackingMap: React.FC<TrackingMapProps> = ({ destLat, destLng, driverLat, driverLng, status }) => {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerGroupRef = useRef<any>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([-33.4489, -70.6693], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);
      markerGroupRef.current = L.layerGroup().addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerGroupRef.current) return;

    markerGroupRef.current.clearLayers();
    const bounds: [number, number][] = [];

    // Add destination marker
    if (destLat && destLng && destLat !== 0.000001) {
      const destIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      L.marker([destLat, destLng], { icon: destIcon }).addTo(markerGroupRef.current).bindPopup('Destino del Pedido');
      bounds.push([destLat, destLng]);
    }

    // Add driver marker if in transit
    if (status === 'EN_TRANSITO' && driverLat && driverLng) {
      const driverIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(markerGroupRef.current).bindPopup('Ubicación del Repartidor');
      bounds.push([driverLat, driverLng]);
    }

    if (bounds.length > 0) {
      if (bounds.length === 1) {
        mapRef.current.setView(bounds[0], 15);
      } else {
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [destLat, destLng, driverLat, driverLng, status]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      <div ref={mapContainerRef} className="h-[300px] w-full z-0" />
      <div className="bg-white p-2 text-xs text-gray-500 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 border border-white"></div>
          <span>Destino</span>
        </div>
        {status === 'EN_TRANSITO' && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-sm"></div>
            <span>Repartidor (En camino)</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackingMap;
