
import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import Dashboard from '../Dashboard';
import UserManagement from '../admin/UserManagement';
import { Role } from '../../constants';
import ClientDashboard from '../client/ClientDashboard';
import { IconMenu, IconCheckCircle, IconX } from '../Icon';
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
    console.log(`[Navigation] Navigating to: ${view} (Current Role: ${user?.role})`);
    setActiveView(view);
    if (isMobileView) { 
        setIsSidebarOpen(false);
    }
  };

  /**
   * [LOGIC REFACTOR] Resolving the "Back to Dashboard" reset bug.
   * We define view content in a declarative way.
   */
  const getViewContent = () => {
    // 1. Initial State / Loading
    if (!user) return { title: 'Cargando...', content: <div className="p-8 text-center">Iniciando sesión...</div> };

    // 2. Global Role Redirection (Driver has unique layout)
    if (user.role === Role.Driver) return null; // Handled by early return at line 76

    // 3. View Selection Switch
    switch (activeView) {
      // Common Views
      case 'packages':
        return { title: 'Gestión de Paquetes', content: <Dashboard /> };
      
      case 'import-orders':
        if (user.role === Role.Admin || user.role === Role.OperadorSistemas) {
            return { title: 'Importar Paquetes', content: <ImportOrdersPage /> };
        }
        break;

      case 'assign-pickups':
        if (user.role === Role.Admin || user.role === Role.OperadorSistemas || user.role === Role.Retiros) {
            return { title: 'Gestión de Retiros', content: <PickupDashboard /> };
        }
        break;

      case 'pickup-report':
        if (user.role === Role.Admin || user.role === Role.OperadorSistemas || user.role === Role.Retiros) {
            return { title: 'Reporte de Retiros', content: <PickupReportPage /> };
        }
        break;

      // User Management
      case 'users-admins':
        if (user.role === Role.Admin && isSuperUser) {
            return { title: 'Gestión de Administradores', content: <UserManagement roleFilter={Role.Admin} /> };
        }
        break;
      
      case 'users-operadores':
        if (user.role === Role.Admin) {
            return { title: 'Gestión de Operadores', content: <UserManagement roleFilter={Role.OperadorSistemas} /> };
        }
        break;

      case 'users-clients':
        if (user.role === Role.Admin || user.role === Role.OperadorSistemas) {
            return { title: 'Gestión de Clientes', content: <UserManagement roleFilter={Role.Client} /> };
        }
        break;

      case 'users-drivers':
        if (user.role === Role.Admin || user.role === Role.OperadorSistemas) {
            return { title: 'Gestión de Conductores', content: <UserManagement roleFilter={Role.Driver} /> };
        }
        break;

      case 'users-auxiliares':
        if (user.role === Role.Admin || user.role === Role.OperadorSistemas) {
            return { title: 'Gestión de Personal Auxiliar', content: <UserManagement roleFilter={Role.Auxiliar} /> };
        }
        break;

      case 'users-retiros':
        if (user.role === Role.Admin) {
            return { title: 'Gestión de Personal de Retiros', content: <UserManagement roleFilter={Role.Retiros} /> };
        }
        break;

      case 'users-facturacion':
        if (user.role === Role.Admin) {
            return { title: 'Gestión de Personal de Facturación', content: <UserManagement roleFilter={Role.Facturacion} /> };
        }
        break;

      // Operations & Logistics
      case 'flex-discrepancies':
        if (user.role === Role.Admin || user.role === Role.OperadorSistemas || isSuperUser) {
            return { title: 'Discrepancias de Carga (Bodega)', content: <DriverFlexDiscrepancyPage /> };
        }
        break;

      case 'zone-settings':
        if (user.role === Role.Admin || user.role === Role.OperadorSistemas) {
            return { title: 'Configuración de Zonas', content: <ZoneSettingsPage /> };
        }
        break;

      case 'live-map':
        if (user.role === Role.Admin || user.role === Role.OperadorSistemas) {
            return { title: 'Mapa en Vivo de Conductores', content: <LiveMap /> };
        }
        break;

      case 'geolocate':
        if (user.role === Role.Admin || user.role === Role.OperadorSistemas) {
            return { title: '', content: <GeolocatePage /> };
        }
        break;

      // Billing (Role Specific or SuperUser)
      case 'global-billing':
        if (user.role === Role.Admin || user.role === Role.Facturacion) {
            return { title: 'Facturación Masiva', content: <GlobalBillingPage /> };
        }
        break;

      case 'billing-report':
        if (user.role === Role.Admin || user.role === Role.Facturacion) {
            return { title: 'Informe de Facturación por Cliente', content: <BillingReportPage /> };
        }
        break;

      case 'driver-performance':
        if (user.role === Role.Admin && isSuperUser) {
            return { title: 'Informe de Rendimiento por Conductor', content: <DriverPerformanceReportPage /> };
        }
        break;

      // Client Views
      case 'my-creations':
        if (user.role === Role.Client) {
            return { title: '', content: <ClientDashboard /> };
        }
        break;

      case 'my-performance':
        if (user.role === Role.Client) {
            return { title: 'Rendimiento de Envíos', content: <ClientPerformanceReportPage /> };
        }
        break;

      // Auxiliar Views
      case 'scan-dispatch':
        if (user.role === Role.Auxiliar) {
            return { title: 'Despacho de Paquetes', content: <DispatchScanner /> };
        }
        break;

      // System Settings (Admin Only)
      case 'settings':
        if (user.role === Role.Admin) {
            return { title: 'Ajustes del Sistema', content: <SettingsPage /> };
        }
        break;

      case 'integrations':
        if (user.role === Role.Admin) {
            return { title: 'Configuración de Integraciones', content: <IntegrationSettingsPage /> };
        }
        break;

      case 'system-logs':
        if (user.role === Role.Admin && isSuperUser) {
            return { title: '', content: <SystemLogsPage /> };
        }
        break;
    }

    // Default Fallback
    console.warn(`[Navigation] View not found or Unauthorized: ${activeView} for role ${user.role}. Defaulting...`);
    const defaultView = getDefaultView();
    if (activeView !== defaultView) {
        // We use a timeout to avoid illegal state update while rendering
        // Better yet: Just return the default view content here without forcing state sync just yet
        const dViewData = getStaticViewData(defaultView);
        return dViewData;
    }
    return { title: 'Gestión de Paquetes', content: <Dashboard /> };
  };

  const getStaticViewData = (view: string) => {
    switch (view) {
        case 'packages': return { title: 'Gestión de Paquetes', content: <Dashboard /> };
        case 'my-creations': return { title: '', content: <ClientDashboard /> };
        case 'global-billing': return { title: 'Facturación Masiva', content: <GlobalBillingPage /> };
        case 'assign-pickups': return { title: 'Gestión de Retiros', content: <PickupDashboard /> };
        case 'scan-dispatch': return { title: 'Despacho de Paquetes', content: <DispatchScanner /> };
        default: return { title: 'Gestión de Paquetes', content: <Dashboard /> };
    }
  };

  const viewData = getViewContent();
  const title = viewData?.title || '';
  const content = viewData?.content || null;

  // Handle automatic state correction in an effect, NOT in render body
  useEffect(() => {
    const verifiedContent = getViewContent();
    if (!verifiedContent && activeView !== getDefaultView()) {
        setActiveView(getDefaultView());
    }
  }, [user, activeView]);


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
