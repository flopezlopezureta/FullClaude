
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { IconHistory, IconLogOut, IconUser, IconBell, IconBellOff, IconArrowUturnLeft, IconTruck, IconChevronLeft, IconChecklist, IconArchive, IconPlus, IconCube } from '../Icon';
import DriverDashboard from './DriverDashboard';
import ScanDispatchPage from './ScanDispatchPage';
import DeliveryHistoryPage from './DeliveryHistoryPage';
import ReturnsDashboard from './ReturnsDashboard';
import ScanPickupPage from './ScanPickupPage';
import ColectaPage from './ColectaPage';
import { DriverPermissions } from '../../types';
import { api } from '../../services/api';

type DriverView = 'my-packages' | 'scan-dispatch' | 'scan-pickups' | 'colectas' | 'returns' | 'delivery-history';

const menuItems: { id: DriverView; label: string; subtitle?: string; icon: React.ReactNode; color: string, permission: keyof DriverPermissions }[] = [
    { id: 'my-packages', label: '1. Entregas', subtitle: 'RUTA DE HOY', icon: <IconTruck />, color: 'bg-blue-600', permission: 'canDeliver' },
    { id: 'scan-pickups', label: '2. Retiros', subtitle: 'CLIENTES ASIG.', icon: <IconArchive />, color: 'bg-purple-600', permission: 'canPickup' },
    { id: 'colectas', label: '3. Colecta', subtitle: 'INGRESAR BULTOS', icon: <IconPlus />, color: 'bg-indigo-600', permission: 'canColecta' },
    { id: 'scan-dispatch', label: '4. Despacho', subtitle: 'CARGA RUTA', icon: <IconChecklist />, color: 'bg-teal-600', permission: 'canDispatch' },
    { id: 'returns', label: '5. Devoluciones', subtitle: 'LOGÍSTICA INVERSA', icon: <IconArrowUturnLeft />, color: 'bg-orange-500', permission: 'canReturn' },
    { id: 'delivery-history', label: '6. Historial', subtitle: 'MIS ENTREGAS', icon: <IconHistory />, color: 'bg-slate-600', permission: 'canViewHistory' },
];

const DriverMobileLayout: React.FC = () => {
    const { user, logout, isPushSubscribed, isPushLoading, subscribeToPush, unsubscribeFromPush, systemSettings } = useContext(AuthContext)!;
    const [activeView, setActiveView] = useState<DriverView | 'menu'>('menu');
    
    // Automatic background location tracking
    useEffect(() => {
        if (!user) return;

        const sendLocation = () => {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        await api.updateDriverLocation(user.id, latitude, longitude);
                        console.log('Location updated successfully');
                    } catch (error) {
                        console.error("Failed to send location", error);
                    }
                },
                (error) => {
                    console.error("Geolocation error", error);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        };

        // Send location immediately on component mount (if user is available)
        sendLocation(); 

        // Set up interval to send location every 30 seconds
        const intervalId = setInterval(sendLocation, 30000);

        // Clean up interval on component unmount
        return () => clearInterval(intervalId);

    }, [user]); // Rerun effect if user object changes

    const driverPermissions = useMemo(() => {
        return user?.driverPermissions || {
            canDeliver: true,
            canPickup: true,
            canDispatch: true,
            canReturn: true,
            canViewHistory: true,
            canBulkPickup: false,
            canColecta: false,
        };
    }, [user]);

    const availableMenuItems = useMemo(() => {
        return menuItems.filter(item => {
            if (item.id === 'colectas' && systemSettings.pickupMode !== 'COLECTA') {
                return false;
            }
            return driverPermissions[item.permission];
        });
    }, [driverPermissions, systemSettings.pickupMode]);

    const handleSubscriptionToggle = () => {
        if (isPushSubscribed) {
            unsubscribeFromPush();
        } else {
            subscribeToPush();
        }
    };

    const activeViewLabel = useMemo(() => {
        if (activeView === 'menu') return 'Menú Principal';
        return menuItems.find(item => item.id === activeView)?.label || 'Conductor';
    }, [activeView]);

    const renderContent = () => {
        switch (activeView) {
            case 'my-packages': return <DriverDashboard />;
            case 'scan-pickups': return <ScanPickupPage />;
            case 'colectas': return <ColectaPage onBack={() => setActiveView('menu')} />;
            case 'scan-dispatch': return <ScanDispatchPage onBack={() => setActiveView('menu')} />;
            case 'returns': return <ReturnsDashboard />;
            case 'delivery-history': return <DeliveryHistoryPage />;
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[var(--background-primary)]">
            <header className="bg-[var(--background-secondary)] shadow-sm flex items-center justify-between h-16 px-4 flex-shrink-0 z-10 border-b border-[var(--border-primary)] relative">
                {activeView === 'menu' ? (
                     <>
                        <div className="flex items-center space-x-2">
                            <IconUser className="h-8 w-8 p-1.5 bg-[var(--background-muted)] text-[var(--text-secondary)] rounded-full" />
                            <div>
                                <p className="font-bold text-[var(--text-primary)] truncate text-sm">{user?.name}</p>
                                <p className="text-xs text-[var(--text-muted)]">Conductor</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-1">
                             <button
                                onClick={handleSubscriptionToggle}
                                disabled={isPushLoading}
                                className="p-2 text-[var(--text-muted)] hover:bg-[var(--background-hover)] rounded-md transition-colors disabled:opacity-50"
                                aria-label={isPushSubscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
                            >
                                {isPushSubscribed ? <IconBell className="h-5 w-5 text-green-500" /> : <IconBellOff className="h-5 w-5" />}
                            </button>
                            <button
                                onClick={logout}
                                className="p-2 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-100 rounded-md transition-colors"
                                aria-label="Cerrar sesión"
                            >
                                <IconLogOut className="h-5 w-5" />
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <button onClick={() => setActiveView('menu')} className="p-2 -ml-2 text-[var(--text-muted)] hover:bg-[var(--background-hover)] rounded-full">
                            <IconChevronLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-lg font-bold text-[var(--text-primary)] absolute left-1/2 -translate-x-1/2">{activeViewLabel}</h1>
                        <button
                            onClick={logout}
                            className="p-2 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-100 rounded-md transition-colors"
                            aria-label="Cerrar sesión"
                        >
                            <IconLogOut className="h-5 w-5" />
                        </button>
                    </>
                )}
            </header>

            <main className="flex-1 overflow-y-auto no-scrollbar bg-gray-50">
                {activeView === 'menu' ? (
                    <div className="p-4">
                        <div className="mb-6 rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-600 p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-xs font-medium opacity-80 mb-1">EMPRESA</p>
                                <h2 className="text-2xl font-bold tracking-tight">FULL ENVIOS</h2>
                            </div>
                            <IconCube className="absolute -right-4 -bottom-4 w-32 h-32 text-white opacity-10 rotate-12" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {availableMenuItems.map(item => (
                                <button 
                                    key={item.id} 
                                    onClick={() => setActiveView(item.id)} 
                                    className="flex flex-col items-start justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100 aspect-[4/3] transition-all duration-200 hover:shadow-md active:scale-95"
                                >
                                    <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center shadow-sm mb-2`}>
                                        {React.cloneElement(item.icon as React.ReactElement, { className: "w-6 h-6 text-white" })}
                                    </div>
                                    <div className="text-left w-full">
                                        <span className="block font-bold text-gray-800 text-base truncate">{item.label}</span>
                                        {item.subtitle && (
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-0.5 truncate">{item.subtitle}</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-4">
                        {renderContent()}
                    </div>
                )}
            </main>
        </div>
    );
};

export default DriverMobileLayout;
