
import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import Dashboard from '../Dashboard';
import UserManagement from '../admin/UserManagement';
import { Role } from '../../constants';
import ClientDashboard from '../client/ClientDashboard';
import { IconMenu, IconCube, IconCheckCircle, IconX } from '../Icon';
import SettingsPage from '../admin/SettingsPage';
import IntegrationSettingsPage from '../admin/IntegrationSettingsPage';
import SystemLogsPage from '../admin/SystemLogsPage';
import ImportOrdersPage from '../admin/ImportOrdersPage';
import BillingReportPage from '../admin/BillingReportPage';
import ZoneSettingsPage from '../admin/ZoneSettingsPage';
import { DriverPerformanceReportPage } from '../admin/DriverPerformanceReportPage';
import ClientPerformanceReportPage from '../client/ClientPerformanceReportPage';
import GlobalBillingPage from '../admin/GlobalBillingPage';
import DispatchScanner from '../auxiliar/DispatchScanner';
import { PickupDashboard } from '../admin/PickupDashboard';
import PickupReportPage from '../admin/PickupReportPage';
import LiveMap from '../admin/LiveMap';
import GeolocatePage from '../admin/GeolocatePage';
import DriverMobileLayout from '../driver/DriverMobileLayout';
import DriverFlexDiscrepancyPage from '../admin/DriverFlexDiscrepancyPage';

const DashboardLayout: React.FC = () => {
  const { user, systemSettings } = useContext(AuthContext)!;
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('integration_status');
    const source = params.get('source');
    if (status === 'success') {
      const sourceName = source === 'meli' ? 'Mercado Libre' : source;
      setNotification({ type: 'success', message: `¡Integración con ${sourceName} conectada con éxito!` });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === 'error') {
      const message = params.get('message') || 'Ocurrió un error desconocido durante la integración.';
      setNotification({ type: 'error', message: `Error: ${decodeURIComponent(message)}` });
       window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);
  
  const isSuperUser = user?.email === 'admin';

  if (user?.role === Role.Driver) {
    return <DriverMobileLayout />;
  }

  const getDefaultView = () => {
    switch (user?.role) {
      case Role.Admin: return 'packages';
      case Role.OperadorSistemas: return 'packages';
      case Role.Client: return 'my-creations';
      case Role.Facturacion: return 'global-billing';
      case Role.Retiros: return 'assign-pickups';
      case Role.Auxiliar: return 'scan-dispatch';
      default: return 'packages';
    }
  };

  const [activeView, setActiveView] = useState(getDefaultView());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 1024;

  const handleNavigate = (view: string) => {
    setActiveView(view);
    if (isMobileView) { 
        setIsSidebarOpen(false);
    }
  };

  let title = '';
  let content: React.ReactNode = null;

  if (user?.role === Role.Facturacion) {
    if (activeView === 'global-billing') {
      title = 'Facturación Masiva';
      content = <GlobalBillingPage />;
    } else {
      title = 'Informe de Facturación por Cliente';
      content = <BillingReportPage />;
    }
  } else if (user?.role === Role.Auxiliar) {
    title = 'Despacho de Paquetes';
    content = <DispatchScanner />;
  } else if (user?.role === Role.Retiros) {
    if (activeView === 'assign-pickups') {
      title = 'Gestión de Retiros';
      content = <PickupDashboard />;
    } else {
      title = 'Reporte de Retiros';
      content = <PickupReportPage />;
    }
  } else if (activeView === 'packages') {
    title = 'Gestión de Paquetes';
    content = <Dashboard />;
  } else if (activeView === 'import-orders' && (user?.role === Role.Admin || user?.role === Role.OperadorSistemas)) {
    title = 'Importar Paquetes';
    content = <ImportOrdersPage />;
  } else if (activeView === 'users-admins' && user?.role === Role.Admin && isSuperUser) {
    title = 'Gestión de Administradores y Operadores';
    content = <UserManagement roleFilter={Role.Admin} />;
  } else if (activeView === 'users-clients' && (user?.role === Role.Admin || user?.role === Role.OperadorSistemas)) {
    title = 'Gestión de Clientes';
    content = <UserManagement roleFilter={Role.Client} />;
  } else if (activeView === 'users-drivers' && (user?.role === Role.Admin || user?.role === Role.OperadorSistemas)) {
    title = 'Gestión de Conductores y Auxiliares';
    content = <UserManagement roleFilter={Role.Driver} />;
  } else if (activeView === 'users-retiros' && user?.role === Role.Admin) {
    title = 'Gestión de Personal de Retiros';
    content = <UserManagement roleFilter={Role.Retiros} />;
  } else if (activeView === 'users-facturacion' && user?.role === Role.Admin) {
    title = 'Gestión de Personal de Facturación';
    content = <UserManagement roleFilter={Role.Facturacion} />;
  } else if (activeView === 'my-creations' && user?.role === Role.Client) {
    title = ''; // Title is now handled within ClientDashboard
    content = <ClientDashboard />;
  } else if (activeView === 'my-performance' && user?.role === Role.Client) {
    title = 'Rendimiento de Envíos';
    content = <ClientPerformanceReportPage />;
  } else if (activeView === 'global-billing' && user?.role === Role.Admin && isSuperUser) {
    title = 'Facturación Masiva';
    content = <GlobalBillingPage />;
  } else if (activeView === 'billing-report' && user?.role === Role.Admin && isSuperUser) {
    title = 'Informe de Facturación por Cliente';
    content = <BillingReportPage />;
  } else if (activeView === 'driver-performance' && user?.role === Role.Admin && isSuperUser) {
    title = 'Informe de Rendimiento por Conductor';
    content = <DriverPerformanceReportPage />;
  } else if (activeView === 'pickup-report' && (user?.role === Role.Admin || user?.role === Role.OperadorSistemas)) {
    title = 'Reporte de Retiros';
    content = <PickupReportPage />;
  } else if (activeView === 'flex-discrepancies' && (user?.role === Role.Admin || user?.role === Role.OperadorSistemas || isSuperUser)) {
    title = 'Discrepancias de Carga (Bodega)';
    content = <DriverFlexDiscrepancyPage />;
  } else if (activeView === 'zone-settings' && (user?.role === Role.Admin || user?.role === Role.OperadorSistemas)) {
    title = 'Configuración de Zonas';
    content = <ZoneSettingsPage />;
  } else if (activeView === 'live-map' && (user?.role === Role.Admin || user?.role === Role.OperadorSistemas)) {
    title = 'Mapa en Vivo de Conductores';
    content = <LiveMap />;
  } else if (activeView === 'geolocate' && (user?.role === Role.Admin || user?.role === Role.OperadorSistemas)) {
    title = ''; // Title handled inside component
    content = <GeolocatePage />;
  } else if (activeView === 'settings' && user?.role === Role.Admin) {
    title = 'Ajustes del Sistema';
    content = <SettingsPage />;
  } else if (activeView === 'integrations' && user?.role === Role.Admin) {
    title = 'Configuración de Integraciones';
    content = <IntegrationSettingsPage />;
  } else if (activeView === 'system-logs' && user?.role === Role.Admin && isSuperUser) {
    title = ''; // Title handled inside component
    content = <SystemLogsPage />;
  } else {
    // Fallback to default view if a view is invalid (e.g. non-admin accessing admin page)
    const defaultView = getDefaultView();
    setActiveView(defaultView);
  }

  return (
    <div className="flex h-screen bg-[var(--background-primary)] overflow-hidden font-sans">
      <Sidebar 
        activeView={activeView} 
        onNavigate={handleNavigate} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="bg-[var(--background-secondary)] shadow-sm z-30 flex items-center justify-between px-4 h-16 shrink-0 border-b border-[var(--border-primary)]">
          <div className="flex items-center">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 mr-2 text-[var(--text-secondary)] hover:bg-[var(--background-hover)] rounded-md lg:hidden transition-colors"
            >
              <IconMenu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight truncate max-w-[200px] sm:max-w-md">
                {title || (activeView === 'my-creations' ? systemSettings?.companyName : 'Dashboard')}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex flex-col items-end">
               <span className="text-sm font-semibold text-[var(--text-primary)]">{user?.name}</span>
               <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{user?.role}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center font-bold shadow-sm border-2 border-white dark:border-gray-800">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Floating Notifications */}
        {notification && (
            <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right duration-300">
                <div className={`flex items-center p-4 rounded-lg shadow-lg border ${
                    notification.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' 
                    : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400'
                }`}>
                    {notification.type === 'success' ? (
                        <IconCheckCircle className="w-5 h-5 mr-3 shrink-0" />
                    ) : (
                        <IconX className="w-5 h-5 mr-3 shrink-0" />
                    )}
                    <span className="font-medium text-sm">{notification.message}</span>
                </div>
            </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[var(--background-primary)]">
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
            {content}
          </div>
        </main>
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
