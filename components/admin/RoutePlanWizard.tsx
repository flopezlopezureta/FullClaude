
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Package } from '../../types';
import { PackageStatus, MAP_TILE_URL, MAP_TILE_ATTRIBUTION } from '../../constants';
import { api, cityCoordinates } from '../../services/api';
import { optimizeMultiDriverRoute } from '../../services/routeOptimizer';
import {
    IconRoute, IconLoader, IconSearch, IconChevronLeft,
    IconTruck, IconClock
} from '../Icon';

declare const L: any;

const ROUTE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#4f46e5', '#ca8a04', '#0d9488'];
const AVG_SPEED_KMH = 30;
const SERVICE_TIME_MIN = 6;

type Step = 'info' | 'pedidos' | 'resultado';

interface PlanInfo {
    nombre: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    conductores: number;
    startCommune: string;
}

const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const toRad = (d: number) => d * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const RoutePlanWizard: React.FC = () => {
    const [step, setStep] = useState<Step>('info');
    const today = new Date().toISOString().split('T')[0];

    const [info, setInfo] = useState<PlanInfo>({
        nombre: '',
        fecha: today,
        horaInicio: '09:00',
        horaFin: '21:00',
        conductores: 3,
        startCommune: 'Santiago',
    });

    const [allPackages, setAllPackages] = useState<Package[]>([]);
    const [isLoadingPedidos, setIsLoadingPedidos] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [showOnlyApprox, setShowOnlyApprox] = useState(false);

    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizedRoutes, setOptimizedRoutes] = useState<Package[][]>([]);
    const [activeDriverIdx, setActiveDriverIdx] = useState(0);

    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const layerGroupRef = useRef<any>(null);

    const startLocation = useMemo(() => {
        const coords = cityCoordinates[info.startCommune] || [-33.4489, -70.6693];
        return { lat: coords[0], lng: coords[1] };
    }, [info.startCommune]);

    const isApprox = (pkg: Package) => !pkg.destLatitude || !pkg.destLongitude || pkg.destLatitude === 0.000001;

    // --- Step "pedidos": cargar pedidos pendientes de la fecha elegida ---
    useEffect(() => {
        if (step !== 'pedidos') return;
        let cancelled = false;
        setIsLoadingPedidos(true);
        api.getPackages({
            limit: 0,
            includeHistory: false,
            statusFilter: PackageStatus.Pending,
            startDate: info.fecha,
            endDate: info.fecha,
        }).then(({ packages }) => {
            if (!cancelled) {
                setAllPackages(packages);
                setSelectedIds(new Set(packages.map(p => p.id)));
            }
        }).catch(err => console.error('Error cargando pedidos', err))
          .finally(() => { if (!cancelled) setIsLoadingPedidos(false); });
        return () => { cancelled = true; };
    }, [step, info.fecha]);

    const filteredPackages = useMemo(() => {
        return allPackages.filter(pkg => {
            if (showOnlyApprox && !isApprox(pkg)) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return pkg.id.toLowerCase().includes(q)
                || pkg.recipientName?.toLowerCase().includes(q)
                || pkg.recipientAddress?.toLowerCase().includes(q)
                || pkg.recipientCommune?.toLowerCase().includes(q);
        });
    }, [allPackages, searchQuery, showOnlyApprox]);

    const toggleSelected = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAllFiltered = () => {
        const allFilteredSelected = filteredPackages.every(p => selectedIds.has(p.id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            filteredPackages.forEach(p => allFilteredSelected ? next.delete(p.id) : next.add(p.id));
            return next;
        });
    };

    // --- Optimizar y pasar a resultados ---
    const handleOptimize = () => {
        const selected = allPackages.filter(p => selectedIds.has(p.id));
        if (selected.length === 0) return;
        setIsOptimizing(true);
        const [hIni, mIni] = info.horaInicio.split(':').map(Number);
        const planStart = new Date(`${info.fecha}T00:00:00`);
        planStart.setHours(hIni || 9, mIni || 0, 0, 0);
        setTimeout(() => {
            const routes = optimizeMultiDriverRoute(selected, Math.max(1, info.conductores), startLocation, info.horaFin, planStart);
            setOptimizedRoutes(routes);
            setActiveDriverIdx(0);
            setIsOptimizing(false);
            setStep('resultado');
        }, 400);
    };

    // --- Mapa de resultados ---
    useEffect(() => {
        if (step !== 'resultado' || !mapContainerRef.current) return;
        if (!mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current).setView([startLocation.lat, startLocation.lng], 11);
            L.tileLayer(MAP_TILE_URL, { attribution: MAP_TILE_ATTRIBUTION }).addTo(mapRef.current);
            layerGroupRef.current = L.layerGroup().addTo(mapRef.current);
        }
        return () => {
            if (step !== 'resultado' && mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [step]);

    useEffect(() => {
        if (step !== 'resultado' || !mapRef.current || !layerGroupRef.current) return;
        layerGroupRef.current.clearLayers();

        const warehouseIcon = L.divIcon({
            className: '',
            html: `<div style="background-color:#0f172a;color:white;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 6px rgba(0,0,0,0.4);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M10 9a3 3 0 0 1 6 0v6h-6v-6"/></svg></div>`,
            iconSize: [28, 28], iconAnchor: [14, 28]
        });
        L.marker([startLocation.lat, startLocation.lng], { icon: warehouseIcon }).bindPopup('<b>Centro de Distribución</b>').addTo(layerGroupRef.current);

        const bounds: [number, number][] = [[startLocation.lat, startLocation.lng]];

        optimizedRoutes.forEach((route, routeIdx) => {
            const color = ROUTE_COLORS[routeIdx % ROUTE_COLORS.length];
            const points = [{ ...startLocation }];
            route.forEach((pkg, stopIdx) => {
                let lat = pkg.destLatitude, lng = pkg.destLongitude;
                if (!lat || !lng || lat === 0.000001) return;
                points.push({ lat, lng });
                bounds.push([lat, lng]);
                const icon = L.divIcon({
                    className: '',
                    html: `<div style="background-color:${color};color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${stopIdx + 1}</div>`,
                    iconSize: [22, 22], iconAnchor: [11, 11]
                });
                L.marker([lat, lng], { icon })
                    .bindPopup(`<b>#${stopIdx + 1} ${pkg.recipientAddress}</b><br>${pkg.recipientName}`)
                    .addTo(layerGroupRef.current);
            });

            if (points.length > 1) {
                api.getRoutePolyline(points).then(geometry => {
                    if (geometry?.length && layerGroupRef.current) {
                        L.polyline(geometry, { color, weight: 4, opacity: 0.75 }).addTo(layerGroupRef.current);
                    }
                }).catch(() => {});
            }
        });

        if (bounds.length > 1) mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }, [step, optimizedRoutes]);

    // --- ETA acumulada por parada, solo para mostrar en la tabla ---
    const buildEtaRows = (route: Package[]) => {
        const [h, m] = info.horaInicio.split(':').map(Number);
        let cursor = new Date(`${info.fecha}T00:00:00`);
        cursor.setHours(h || 9, m || 0, 0, 0);
        let lat = startLocation.lat, lng = startLocation.lng;
        let totalKm = 0;

        return route.map(pkg => {
            const destLat = pkg.destLatitude || lat;
            const destLng = pkg.destLongitude || lng;
            const distKm = getDistanceKm(lat, lng, destLat, destLng);
            const travelMin = Math.round((distKm / AVG_SPEED_KMH) * 60);
            cursor = new Date(cursor.getTime() + travelMin * 60000);
            const eta = cursor.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
            cursor = new Date(cursor.getTime() + SERVICE_TIME_MIN * 60000);
            totalKm += distKm;
            lat = destLat; lng = destLng;
            return { pkg, travelMin, eta, serviceMin: SERVICE_TIME_MIN };
        });
    };

    const selectedCount = selectedIds.size;
    const totalAssigned = optimizedRoutes.reduce((s, r) => s + r.length, 0);
    const totalUnassigned = allPackages.filter(p => selectedIds.has(p.id)).length - totalAssigned;

    // --- Barra de pasos (incluye los 2 pasos futuros, deshabilitados) ---
    const StepsBar = () => (
        <div className="flex border-b border-[var(--border-primary)] bg-[var(--background-muted)]">
            {[
                { id: 'info', label: 'Información inicial' },
                { id: 'pedidos', label: 'Agregar pedidos' },
            ].map(t => (
                <button
                    key={t.id}
                    onClick={() => { if (t.id === 'info' || (t.id === 'pedidos' && info.nombre.trim())) setStep(t.id as Step); }}
                    className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${step === t.id ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                >
                    {t.label}
                </button>
            ))}
            {['Agregar vehículo', 'Configura la optimización'].map(label => (
                <div key={label} className="px-5 py-3 text-sm font-bold text-[var(--text-muted)] opacity-50 cursor-not-allowed flex items-center gap-1.5">
                    {label}
                    <span className="text-[9px] font-extrabold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Próximamente</span>
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-[var(--background-primary)]">
            <div className="p-4 border-b border-[var(--border-primary)] bg-[var(--background-secondary)] flex items-center gap-2">
                <IconRoute className="w-6 h-6 text-[var(--brand-primary)]" />
                <div>
                    <h1 className="text-lg font-bold text-[var(--text-primary)]">Plan de Rutas</h1>
                    <p className="text-xs text-[var(--text-muted)]">Prototipo — arma un plan de entrega multi-conductor a partir de tus pedidos pendientes.</p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col bg-[var(--background-secondary)] m-4 rounded-xl border border-[var(--border-primary)] shadow-sm">
                <StepsBar />

                {step === 'info' && (
                    <div className="flex-1 overflow-y-auto p-6 max-w-xl space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-[var(--text-primary)]">Nombre</label>
                            <p className="text-xs text-[var(--text-muted)] mb-1.5">El nombre para identificar tu plan de ruta</p>
                            <input type="text" value={info.nombre} onChange={e => setInfo({ ...info, nombre: e.target.value })}
                                placeholder="Ej: Reparto Las Condes 26/09"
                                className="w-full border border-[var(--border-secondary)] rounded-md px-3 py-2 bg-[var(--background-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-muted)]" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[var(--text-primary)]">Fecha de Salida</label>
                            <p className="text-xs text-[var(--text-muted)] mb-1.5">Los pedidos pendientes de esta fecha se cargarán en el siguiente paso</p>
                            <input type="date" value={info.fecha} onChange={e => setInfo({ ...info, fecha: e.target.value })}
                                className="border border-[var(--border-secondary)] rounded-md px-3 py-2 bg-[var(--background-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-muted)]" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[var(--text-primary)]">Rango de tiempo</label>
                            <p className="text-xs text-[var(--text-muted)] mb-1.5">La hora inicial y final para tus rutas</p>
                            <div className="flex items-center gap-2">
                                <input type="time" value={info.horaInicio} onChange={e => setInfo({ ...info, horaInicio: e.target.value })}
                                    className="border border-[var(--border-secondary)] rounded-md px-3 py-2 bg-[var(--background-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-muted)]" />
                                <span className="text-[var(--text-muted)]">—</span>
                                <input type="time" value={info.horaFin} onChange={e => setInfo({ ...info, horaFin: e.target.value })}
                                    className="border border-[var(--border-secondary)] rounded-md px-3 py-2 bg-[var(--background-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-muted)]" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[var(--text-primary)]">Cantidad de Conductores</label>
                            <p className="text-xs text-[var(--text-muted)] mb-1.5">Cuántas rutas se van a armar en paralelo (reemplaza "Tipo de flota" — todavía no hay gestión de vehículos)</p>
                            <input type="number" min={1} max={15} value={info.conductores}
                                onChange={e => setInfo({ ...info, conductores: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-28 border border-[var(--border-secondary)] rounded-md px-3 py-2 bg-[var(--background-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-muted)]" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[var(--text-primary)]">Punto de Partida</label>
                            <p className="text-xs text-[var(--text-muted)] mb-1.5">Comuna base del Centro de Distribución</p>
                            <select value={info.startCommune} onChange={e => setInfo({ ...info, startCommune: e.target.value })}
                                className="border border-[var(--border-secondary)] rounded-md px-3 py-2 bg-[var(--background-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-muted)]">
                                <option value="Santiago">Santiago</option>
                                <option value="Providencia">Providencia</option>
                                <option value="Lampa">Lampa</option>
                                <option value="Maipú">Maipú</option>
                                <option value="Puente Alto">Puente Alto</option>
                            </select>
                        </div>
                    </div>
                )}

                {step === 'pedidos' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-[var(--border-primary)] flex flex-wrap items-center gap-3 bg-[var(--background-muted)]">
                            <div className="flex items-center gap-2 flex-1 min-w-[220px] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md px-2.5 py-1.5">
                                <IconSearch className="w-4 h-4 text-[var(--text-muted)]" />
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar pedidos..."
                                    className="flex-1 bg-transparent text-sm focus:outline-none text-[var(--text-primary)]" />
                            </div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                                <input type="checkbox" checked={showOnlyApprox} onChange={e => setShowOnlyApprox(e.target.checked)} className="h-3.5 w-3.5 rounded" />
                                Solo direcciones aproximadas
                            </label>
                            <span className="text-xs font-bold text-[var(--brand-primary)]">{selectedCount} seleccionados de {allPackages.length}</span>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoadingPedidos ? (
                                <div className="flex items-center justify-center h-full text-[var(--text-muted)] gap-2"><IconLoader className="w-5 h-5 animate-spin" /> Cargando pedidos pendientes...</div>
                            ) : filteredPackages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No hay pedidos pendientes para esta fecha.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-[var(--background-muted)] border-b border-[var(--border-primary)] text-[10px] uppercase font-bold text-[var(--text-muted)]">
                                        <tr>
                                            <th className="p-3 text-left w-10">
                                                <input type="checkbox" checked={filteredPackages.length > 0 && filteredPackages.every(p => selectedIds.has(p.id))}
                                                    onChange={toggleSelectAllFiltered} className="h-4 w-4 rounded" />
                                            </th>
                                            <th className="p-3 text-left">Pedido</th>
                                            <th className="p-3 text-left">Cliente</th>
                                            <th className="p-3 text-left">Dirección</th>
                                            <th className="p-3 text-left">Comuna</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPackages.map(pkg => (
                                            <tr key={pkg.id} onClick={() => toggleSelected(pkg.id)}
                                                className={`border-b border-[var(--border-primary)] cursor-pointer hover:bg-[var(--background-hover)] ${selectedIds.has(pkg.id) ? 'bg-[var(--brand-muted)] bg-opacity-10' : ''}`}>
                                                <td className="p-3" onClick={e => e.stopPropagation()}>
                                                    <input type="checkbox" checked={selectedIds.has(pkg.id)} onChange={() => toggleSelected(pkg.id)} className="h-4 w-4 rounded" />
                                                </td>
                                                <td className="p-3 font-mono text-xs text-[var(--brand-primary)] font-bold">{pkg.id}</td>
                                                <td className="p-3 font-semibold text-[var(--text-primary)]">{pkg.recipientName}</td>
                                                <td className="p-3 text-[var(--text-secondary)]">
                                                    {pkg.recipientAddress}
                                                    {isApprox(pkg) && <span className="ml-2 text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Aprox.</span>}
                                                </td>
                                                <td className="p-3 text-[var(--text-secondary)]">{pkg.recipientCommune}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {step === 'resultado' && (
                    <div className="flex-1 flex overflow-hidden">
                        <div className="w-96 border-r border-[var(--border-primary)] flex flex-col overflow-hidden">
                            <div className="flex overflow-x-auto border-b border-[var(--border-primary)] bg-[var(--background-muted)]">
                                {optimizedRoutes.map((route, idx) => (
                                    <button key={idx} onClick={() => setActiveDriverIdx(idx)}
                                        className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 border-b-2 ${activeDriverIdx === idx ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-[var(--text-muted)]'}`}>
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ROUTE_COLORS[idx % ROUTE_COLORS.length] }} />
                                        Conductor {idx + 1} <span className="opacity-60">({route.length})</span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {optimizedRoutes[activeDriverIdx] && buildEtaRows(optimizedRoutes[activeDriverIdx]).map((row, idx) => (
                                    <div key={row.pkg.id} className="p-3 border-b border-[var(--border-primary)] flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                                            style={{ backgroundColor: ROUTE_COLORS[activeDriverIdx % ROUTE_COLORS.length] }}>{idx + 1}</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-mono text-[var(--brand-primary)] font-bold">{row.pkg.id}</p>
                                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{row.pkg.recipientName}</p>
                                            <p className="text-xs text-[var(--text-secondary)] truncate">{row.pkg.recipientAddress}</p>
                                            <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--text-muted)] font-semibold">
                                                <span className="flex items-center gap-1"><IconClock className="w-3 h-3" /> ETA {row.eta}</span>
                                                <span>Viaje {row.travelMin} min</span>
                                                <span>Servicio {row.serviceMin} min</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {totalUnassigned > 0 && (
                                <div className="p-3 bg-red-50 border-t border-red-200 text-xs text-red-700 font-semibold">
                                    {totalUnassigned} pedido(s) no entraron en el horario configurado.
                                </div>
                            )}
                        </div>
                        <div className="flex-1 relative">
                            <div ref={mapContainerRef} className="h-full w-full" />
                        </div>
                    </div>
                )}

                <footer className="p-3 border-t border-[var(--border-primary)] bg-[var(--background-muted)] flex justify-between items-center">
                    <button
                        onClick={() => step === 'pedidos' ? setStep('info') : step === 'resultado' ? setStep('pedidos') : undefined}
                        disabled={step === 'info'}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)] disabled:opacity-40 disabled:cursor-not-allowed">
                        <IconChevronLeft className="w-4 h-4" /> Anterior
                    </button>

                    {step === 'info' && (
                        <button onClick={() => setStep('pedidos')} disabled={!info.nombre.trim()}
                            className="px-6 py-2 text-sm font-bold text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                            Siguiente
                        </button>
                    )}
                    {step === 'pedidos' && (
                        <button onClick={handleOptimize} disabled={selectedCount === 0 || isOptimizing}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                            {isOptimizing ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconRoute className="w-4 h-4" />}
                            Optimizar {selectedCount} pedido{selectedCount !== 1 ? 's' : ''}
                        </button>
                    )}
                    {step === 'resultado' && (
                        <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                            <IconTruck className="w-4 h-4 text-[var(--brand-primary)]" />
                            {totalAssigned} asignados en {optimizedRoutes.length} ruta{optimizedRoutes.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default RoutePlanWizard;
