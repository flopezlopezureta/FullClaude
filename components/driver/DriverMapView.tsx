
import React, { useEffect, useRef, useState, useContext } from 'react';
import type { Package } from '../../types';
import { PackageStatus } from '../../constants';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import { IconRoute } from '../Icon';

declare const L: any;

const DriverMapView: React.FC = () => {
    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const routingControlRef = useRef<any>(null);
    const { user } = useContext(AuthContext)!;
    
    const [packages, setPackages] = useState<Package[]>([]);
    const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [route, setRoute] = useState<any | null>(null); // Estado para almacenar la ruta calculada
    const lastSentPosition = useRef<{ lat: number; lng: number; time: number } | null>(null);

    // Obtiene los paquetes pendientes del conductor
    useEffect(() => {
        const fetchPackages = async () => {
            if (!user) return;
            try {
                // Fetch all packages for the current driver
                const { packages: allPackages } = await api.getPackages({ driverFilter: user.id, limit: 0 });
                // Explicitly type the array to satisfy the .includes() check.
                const excludedStatuses: string[] = [PackageStatus.Delivered, PackageStatus.Problem, PackageStatus.Returned, PackageStatus.ReturnPending];
                const driverPackages = allPackages.filter(p => 
                    !excludedStatuses.includes(p.status)
                );
                setPackages(driverPackages);
            } catch (err) {
                console.error("Failed to fetch driver packages", err);
                setError("No se pudieron cargar los paquetes.");
            }
        };
        fetchPackages();
    }, [user]);

    // Inicializa el mapa de Leaflet
    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current).setView([-33.45, -70.67], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);
            setTimeout(() => mapRef.current?.invalidateSize(), 100);
        }
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Vigila la geolocalización del dispositivo
    useEffect(() => {
        if (!user) return;
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const newPos = { lat: latitude, lng: longitude };
                setCurrentPosition(newPos);
                setError(null);

                // Actualiza la ubicación en el servidor periódicamente (cada 30 segundos)
                if (!lastSentPosition.current || Date.now() - lastSentPosition.current.time > 30000) {
                    api.updateDriverLocation(user.id, latitude, longitude);
                    lastSentPosition.current = { ...newPos, time: Date.now() };
                }
            },
            (err) => {
                console.error("Geolocation error:", err);
                setError("No se pudo obtener la ubicación. Activa el GPS y los permisos.");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [user]);

    // Actualiza el mapa con marcadores y la ruta calculada
    useEffect(() => {
        if (!mapRef.current || !user || !currentPosition) return;
        const map = mapRef.current;
        
        setRoute(null); // Resetea la ruta al recalcular

        if (routingControlRef.current) {
            map.removeControl(routingControlRef.current);
        }

        const packagesWithCoords = packages.filter(p => p.destLatitude && p.destLongitude);

        if (packagesWithCoords.length === 0) {
             map.setView([currentPosition.lat, currentPosition.lng], 15);
             L.marker([currentPosition.lat, currentPosition.lng]).addTo(map).bindPopup('Tu Ubicación');
             return;
        }

        // Crea los puntos de la ruta: inicia en la posición actual y luego visita cada paquete
        const waypoints = [
            L.latLng(currentPosition.lat, currentPosition.lng),
            ...packagesWithCoords.map(p => L.latLng(p.destLatitude!, p.destLongitude!))
        ];

        // Configura y añade el control de enrutamiento al mapa
        routingControlRef.current = L.Routing.control({
            waypoints: waypoints,
            createMarker: function(i: number, waypoint: any) {
                // Personaliza el marcador del conductor
                if (i === 0) {
                    return L.marker(waypoint.latLng, {
                        icon: L.divIcon({
                            html: `<div class="p-1 bg-white rounded-full shadow-lg"><div class="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center border-4 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg></div></div>`,
                            className: '', iconSize: [48, 48], iconAnchor: [24, 48]
                        }),
                        zIndexOffset: 1000
                    }).bindPopup('<b>Tu Ubicación</b>');
                }
                // Marcadores para los paquetes
                const pkg = packagesWithCoords[i - 1];
                return L.marker(waypoint.latLng)
                    .bindPopup(`<b>${pkg.recipientAddress}</b><br>${pkg.recipientName}<br>ID: ${pkg.id}`);
            },
            lineOptions: {
                styles: [{ color: '#3b82f6', opacity: 0.8, weight: 6 }]
            },
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            show: true,
            collapsible: true,
        }).on('routesfound', (e: any) => {
            // Guarda la ruta calculada en el estado para usarla después
            if (e.routes && e.routes.length > 0) {
                setRoute(e.routes[0]);
            }
        }).addTo(map);
        
    }, [currentPosition, packages, user]);

    // Función para abrir la ruta en Google Maps
    const handleNavigateWithGoogleMaps = () => {
        if (!route || !route.waypoints || route.waypoints.length < 2) return;

        const waypoints = route.waypoints.map((wp: any) => `${wp.latLng.lat},${wp.latLng.lng}`);
        const origin = waypoints.shift();
        const destination = waypoints.pop() || origin;
        
        const waypointsString = waypoints.join('|');

        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsString}&travelmode=driving`;
        
        window.open(url, '_blank');
    };

    return (
        <>
        <style>{`
          /* Estilos para el panel de instrucciones de ruta de Leaflet */
          .leaflet-routing-container {
              max-height: 60vh;
              overflow-y: auto;
              background-color: var(--background-secondary);
              color: var(--text-primary);
              border: 1px solid var(--border-primary);
          }
          .leaflet-routing-alt {
              background-color: var(--background-muted);
          }
          .leaflet-routing-alt:hover {
              background-color: var(--background-hover);
          }
          .leaflet-routing-geocoder, .leaflet-routing-error {
              background-color: var(--background-secondary);
          }
           .leaflet-routing-icon {
              background-color: var(--background-muted);
           }
        `}</style>
        <div className="relative h-[calc(100vh-144px)]">
            {error && <div className="absolute top-2 left-2 right-2 z-[1001] bg-red-500 text-white text-sm font-semibold p-3 rounded-md shadow-lg">{error}</div>}
            
            <button
                onClick={handleNavigateWithGoogleMaps}
                disabled={!route}
                className="absolute top-4 right-4 z-[1000] flex items-center gap-2 px-4 py-3 bg-blue-600 text-white font-bold rounded-full shadow-lg transition-colors hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
                <IconRoute className="w-5 h-5" />
                Iniciar Navegación en Google Maps
            </button>

            <div ref={mapContainerRef} className="h-full w-full" />
        </div>
        </>
    );
};

export default DriverMapView;
