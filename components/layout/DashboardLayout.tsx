
import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import Dashboard from '../Dashboard';
import UserManagement from '../admin/UserManagement';
import DriverDashboard from '../driver/DriverDashboard';
import { Role } from '../../constants';
import ScanPickupPage from '../driver/ScanPickupPage';
import ClientDashboard from '../client/ClientDashboard';
import { IconMenu, IconCube, IconCheckCircle, IconX } from '../Icon';
import SettingsPage from '../admin/SettingsPage';
import IntegrationSettingsPage from '../admin/IntegrationSettingsPage';
import ImportOrdersPage from '../admin/ImportOrdersPage';
import { ScanDispatchPage } from '../driver/ScanDispatchPage';
import BillingReportPage from '../admin/BillingReportPage';
import ZoneSettingsPage from '../admin/ZoneSettingsPage';
import { DriverPerformanceReportPage } from '../admin/DriverPerformanceReportPage';
import ClientPerformanceReportPage from '../client/ClientPerformanceReportPage';
import DeliveryHistoryPage from '../driver/DeliveryHistoryPage';
import DriverMobileLayout from '../driver/DriverMobileLayout';
import GlobalBillingPage from '../admin/GlobalBillingPage';
import DispatchScanner from '../auxiliar/DispatchScanner';
import { PickupDashboard } from '../admin/PickupDashboard';
import PickupReportPage from '../admin/PickupReportPage';
import LiveMap from '../admin/LiveMap';
import GeolocatePage from '../admin/GeolocatePage';

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
  
  if (user?.role === Role.Driver) {
    return <DriverMobileLayout />;
  }

  const getDefaultView = () => {
    switch (user?.role) {
      case Role.Admin: return 'packages';
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
    } else if (activeView === 'pickup-report') {
      title = 'Reporte de Retiros';
      content = <PickupReportPage />;
    }
  } else if (activeView === 'packages') {
    title = 'Gestión de Paquetes';
    content = <Dashboard />;
  } else if (activeView === 'import-orders') {
    title = 'Importar Envíos';
    content = <ImportOrdersPage />;
  } else if (activeView === 'assign-pickups') {
    title = 'Gestión de Retiros';
    content = <PickupDashboard />;
  } else if (activeView === 'users-clients' && user?.role === Role.Admin) {
    title = 'Gestión de Clientes';
    content = <UserManagement roleFilter={Role.Client} />;
  } else if (activeView === 'users-drivers' && user?.role === Role.Admin) {
    title = 'Gestión de Conductores';
    content = <UserManagement roleFilter={Role.Driver} />;
  } else if (activeView === 'users-admins' && user?.role === Role.Admin) {
    title = 'Gestión de Administradores';
    content = <UserManagement roleFilter={Role.Admin} />;
  } else if (activeView === 'users-auxiliares' && user?.role === Role.Admin) {
    title = 'Gestión de Auxiliares';
    content = <UserManagement roleFilter={Role.Auxiliar} />;
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
  } else if (activeView === 'global-billing' && user?.role === Role.Admin) {
    title = 'Facturación Masiva';
    content = <GlobalBillingPage />;
  } else if (activeView === 'billing-report' && user?.role === Role.Admin) {
    title = 'Informe de Facturación por Cliente';
    content = <BillingReportPage />;
  } else if (activeView === 'driver-performance' && user?.role === Role.Admin) {
    title = 'Informe de Rendimiento por Conductor';
    content = <DriverPerformanceReportPage />;
  } else if (activeView === 'pickup-report' && user?.role === Role.Admin) {
    title = 'Reporte de Retiros';
    content = <PickupReportPage />;
  } else if (activeView === 'zone-settings' && user?.role === Role.Admin) {
    title = 'Configuración de Zonas';
    content = <ZoneSettingsPage />;
  } else if (activeView === 'live-map' && user?.role === Role.Admin) {
    title = 'Mapa en Vivo de Conductores';
    content = <LiveMap />;
  } else if (activeView === 'geolocate' && user?.role === Role.Admin) {
    title = ''; // Title handled inside component
    content = <GeolocatePage />;
  } else if (activeView === 'settings' && user?.email === 'admin') {
    title = 'Ajustes del Sistema';
    content = <SettingsPage />;
  } else if (activeView === 'integrations' && user?.role === Role.Admin) {
    title = 'Configuración de Integraciones';
    content = <IntegrationSettingsPage />;
  } else {
    // Fallback to default view if a view is invalid (e.g. non-admin accessing admin page)
    const defaultView = getDefaultView();
    if(activeView !== defaultView) {
        setActiveView(defaultView);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      <Sidebar 
        activeView={activeView} 
        onNavigate={handleNavigate} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-[var(--background-secondary)] shadow-sm flex items-center justify-between h-16 px-4 sm:px-6 flex-shrink-0 z-10">
           <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2 -ml-2 text-[var(--text-muted)] hover:bg-[var(--background-hover)] rounded-md"
                aria-label="Abrir menú"
           >
                <IconMenu className="h-6 w-6" />
           </button>
           <div className="flex items-center space-x-2">
                <IconCube className="h-7 w-7 text-[var(--brand-primary)]" />
                <span className="font-bold text-lg text-[var(--text-primary)] truncate">{systemSettings.companyName}</span>
           </div>
           <div className="w-8"></div> {/* Spacer to balance the header */}
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--background-primary)] p-4 sm:p-6 lg:p-8 custom-scrollbar relative">
           {notification && (
                <div className={`fixed top-20 right-8 z-50 flex items-center p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    <IconCheckCircle className="w-6 h-6 mr-3" />
                    <span className="font-medium">{notification.message}</span>
                     <button onClick={() => setNotification(null)} className="ml-4 p-1 rounded-full hover:bg-black/20"><IconX className="w-5 h-5"/></button>
                </div>
           )}
          {title && <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{title}</h1>}
          {content}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
