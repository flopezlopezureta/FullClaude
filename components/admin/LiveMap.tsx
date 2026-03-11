
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { User, Package } from '../../types';
import { PackageStatus } from '../../constants';
import { api } from '../../services/api';
import { IconRefresh, IconLoader, IconMapPin, IconBattery, IconWifi, IconCopy, IconPower } from '../Icon';

declare const L: any;

function formatTimeAgo(date: Date | null): string {
    if (!date) return 'Nunca';
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `hace segundos`;
    
    let interval = seconds / 31536000;
    if (interval > 1) return `hace ${Math.floor(interval)} años`;
    interval = seconds / 2592000;
    if (interval > 1) return `hace ${Math.floor(interval)} meses`;
    interval = seconds / 86400;
    if (interval > 1) return `hace ${Math.floor(interval)} días`;
    interval = seconds / 3600;
    if (interval > 1) return `hace ${Math.floor(interval)} horas`;
    interval = seconds / 60;
    return `hace ${Math.floor(interval)} minutos`;
}


const LiveMap: React.FC = () => {
    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersLayerRef = useRef<any>(null);
    const [activeDrivers, setActiveDrivers] = useState<User[]>([]);
    const [packages, setPackages] = useState<Package[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [fetchedActiveDrivers, packagesResponse, allUsersData] = await Promise.all([
                api.getActiveDriversLocations(),
                api.getPackages({ limit: 0 }),
                api.getUsers()
            ]);
            setActiveDrivers(fetchedActiveDrivers);
            setPackages(packagesResponse.packages);
            setAllUsers(allUsersData);
        } catch (error) {
            console.error("Failed to fetch map data", error);
        }
    }, []);

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        await fetchData();
        setTimeout(() => setIsRefreshing(false), 500); // Small delay for better UX
    }, [fetchData, isRefreshing]);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current).setView([-33.45, -70.67], 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);
            markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
            setTimeout(() => mapRef.current?.invalidateSize(), 100);
        }

        handleRefresh(); // Initial fetch with loading state
        const intervalId = setInterval(fetchData, 15000);

        return () => {
            clearInterval(intervalId);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [fetchData]);

    const allApprovedDrivers = useMemo(() => 
        allUsers.filter(u => u.role === 'DRIVER' && u.status === 'APROBADO')
                .sort((a,b) => a.name.localeCompare(b.name)), 
    [allUsers]);

    const driverStatuses = useMemo(() => {
        const activeDriverIds = new Set(activeDrivers.map(d => d.id));
        return allApprovedDrivers.map(driver => {
            const isActive = activeDriverIds.has(driver.id);
            const activeDriverData = isActive ? activeDrivers.find(d => d.id === driver.id) : null;
            
            return {
                ...driver,
                isOnline: isActive,
                latitude: activeDriverData?.latitude ?? driver.latitude,
                longitude: activeDriverData?.longitude ?? driver.longitude,
                lastUpdate: activeDriverData?.lastLocationUpdate ? new Date(activeDriverData.lastLocationUpdate) : (driver.lastLocationUpdate ? new Date(driver.lastLocationUpdate) : null)
            };
        });
    }, [allApprovedDrivers, activeDrivers]);

    useEffect(() => {
        if (!mapRef.current || !markersLayerRef.current) return;

        markersLayerRef.current.clearLayers();

        const driverIcon = L.divIcon({
            html: `<div class="p-1 bg-[var(--background-secondary)] rounded-full shadow-lg"><div class="w-8 h-8 bg-[var(--brand-primary)] text-white rounded-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg></div></div>`,
            className: '', iconSize: [40, 40], iconAnchor: [20, 40]
        });

        const packageIcon = L.divIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
            className: '', iconSize: [28, 28], iconAnchor: [14, 28]
        });

        activeDrivers.forEach(driver => {
            if (driver.latitude && driver.longitude) {
                const position: [number, number] = [driver.latitude, driver.longitude];
                const marker = L.marker(position, { icon: driverIcon })
                    .bindPopup(`<b>${driver.name}</b><br>${driver.email}`)
                    .bindTooltip(`<b>${driver.name}</b>`, {
                        permanent: true, direction: 'top', offset: [0, -40], className: 'driver-name-tooltip'
                    });
                markersLayerRef.current.addLayer(marker);
            }
        });

        const pendingPackages = packages.filter(p => 
            (p.status === PackageStatus.Pending || p.status === PackageStatus.InTransit) && p.destLatitude && p.destLongitude
        );

        pendingPackages.forEach(pkg => {
            const position: [number, number] = [pkg.destLatitude!, pkg.destLongitude!];
            const assignedDriver = allUsers.find(u => u.id === pkg.driverId);
            const popupContent = `<b>Paquete: ${pkg.id}</b><br>Dest: ${pkg.recipientName}<br>Dir: ${pkg.recipientAddress}<br>Conductor: ${assignedDriver?.name || 'No asignado'}`;
            const marker = L.marker(position, { icon: packageIcon }).bindPopup(popupContent);
            markersLayerRef.current.addLayer(marker);
        });

    }, [activeDrivers, packages, allUsers]);
    
    const handleDriverClick = (driver: typeof driverStatuses[0]) => {
        if (driver.isOnline && driver.latitude && driver.longitude && mapRef.current) {
            mapRef.current.setView([driver.latitude, driver.longitude], 16, { animate: true });
        }
    };

    const handleCopyInstructions = () => {
        const instructions = `
        Un conductor aparece 'Offline' si no podemos recibir su ubicación. Pídele que revise lo siguiente en su teléfono (es muy importante seguir todos los pasos):

        1.  📍 *GPS / Ubicación:* Asegurarse de que los servicios de ubicación estén *ACTIVADOS*.
    
        2.  🔐 *Permisos de la App:* Ir a Ajustes -> Aplicaciones -> (Nombre de la App) -> Permisos y verificar que la *UBICACIÓN* esté permitida ("Permitir siempre" o "Mientras se usa").
    
        3.  🔋 *Ahorro de Batería:* Ir a Ajustes -> Batería -> Optimización de batería y *EXCLUIR* nuestra app para que no se cierre en segundo plano.
    
        4.  🔌 *IMPORTANTE - App sin Uso:* En la misma pantalla de información de la app, buscar una opción llamada "Pausar actividad si no se usa" o "Quitar permisos si la app no se usa" y *DESACTIVARLA*.
    
        5.  📶 *Conexión a Internet:* Verificar que tenga una conexión de datos móviles o Wi-Fi estable.
        `;
        navigator.clipboard.writeText(instructions.trim()).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    return (
        <>
            <style>{`
                .driver-name-tooltip { background-color: var(--background-secondary); color: var(--text-primary); border: 1px solid var(--border-secondary); padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); white-space: nowrap; }
                .driver-name-tooltip.leaflet-tooltip-top:before { border-top-color: var(--border-secondary); }
            `}</style>
            <div className="flex flex-col md:flex-row gap-4" style={{ height: '75vh' }}>
                <div className="flex-grow bg-[var(--background-secondary)] shadow-md rounded-lg p-4 h-full">
                    <div ref={mapContainerRef} className="h-full w-full rounded-md" style={{ zIndex: 0 }} />
                </div>
                
                <div className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-[var(--background-secondary)] shadow-md rounded-lg flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)] flex-shrink-0">
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">
                            Estado de Conductores
                        </h3>
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            title="Refrescar estado"
                            className="p-2 rounded-full hover:bg-[var(--background-hover)] transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isRefreshing ? (
                                <IconLoader className="w-5 h-5 animate-spin" />
                            ) : (
                                <IconRefresh className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-grow">
                        {driverStatuses.length === 0 && <p className="p-4 text-sm text-[var(--text-muted)]">No hay conductores aprobados.</p>}
                        {driverStatuses.map(driver => (
                            <button
                                key={driver.id}
                                onClick={() => handleDriverClick(driver)}
                                disabled={!driver.isOnline}
                                className="w-full text-left p-3 flex items-center gap-3 border-b border-[var(--border-primary)] hover:bg-[var(--background-hover)] disabled:hover:bg-transparent disabled:cursor-not-allowed"
                            >
                                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${driver.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                <div className="flex-grow min-w-0">
                                    <p className="font-semibold text-sm truncate text-[var(--text-primary)]">{driver.name}</p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Últ. act: {formatTimeAgo(driver.lastUpdate)}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                     <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--background-muted)] rounded-b-lg">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-2">Guía de Solución Rápida</h4>
                        <ul className="space-y-2.5 text-xs text-[var(--text-secondary)]">
                            <li className="flex items-start gap-2"><IconMapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500"/> <strong>GPS / Ubicación:</strong> Asegurarse de que esté ACTIVADO.</li>
                            <li className="flex items-start gap-2"><IconMapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500"/> <strong>Permisos:</strong> Permitir la ubicación "Siempre" o "Mientras se usa la app".</li>
                            <li className="flex items-start gap-2"><IconBattery className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500"/> <strong>Batería:</strong> Quitar la app de las optimizaciones de batería.</li>
                            <li className="flex items-start gap-2"><IconPower className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500"/> <strong className="text-red-600">App sin Uso (Importante):</strong> DESACTIVAR "Pausar actividad si no se usa".</li>
                            <li className="flex items-start gap-2"><IconWifi className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500"/> <strong>Internet:</strong> Verificar conexión de datos o Wi-Fi.</li>
                        </ul>
                         <button 
                            onClick={handleCopyInstructions}
                            className={`w-full mt-3 px-3 py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${copySuccess ? 'bg-green-600 text-white' : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] hover:bg-[var(--background-hover)] border border-[var(--border-secondary)]'}`}
                         >
                             <IconCopy className="w-4 h-4"/>
                             {copySuccess ? '¡Copiado!' : 'Copiar Instrucciones'}
                         </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LiveMap;