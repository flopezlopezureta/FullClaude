import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

import Sidebar from './Sidebar';
import Dashboard from '../Dashboard';
import UserManagement from '../admin/UserManagement';
import { Role, DEFAULT_OPERATOR_PERMISSIONS } from '../../constants';
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
import AdminBillingSummary from '../admin/AdminBillingSummary';
import DeliveryEfficiencyDashboard from '../admin/DeliveryEfficiencyDashboard';
import DispatchScanner from '../auxiliar/DispatchScanner';
import { PickupDashboard } from '../admin/PickupDashboard';
import PickupReportPage from '../admin/PickupReportPage';
import LiveMap from '../admin/LiveMap';
import GeolocatePage from '../admin/GeolocatePage';
import DriverMobileLayout from '../driver/DriverMobileLayout';
import DriverFlexDiscrepancyPage from '../admin/DriverFlexDiscrepancyPage';
import ClientSettingsPage from '../client/ClientSettingsPage';

const DashboardLayout: React.FC = () => {
  const { user, systemSettings } = useContext(AuthContext)!;
  const { notification, showToast, clearNotification } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('integration_status');
    const source = params.get('source');
    if (status === 'success') {
      const sourceName = source === 'meli' ? 'Mercado Libre' : source;
      showToast(`¡Integración con ${sourceName} conectada con éxito!`, 'success');
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === 'error') {
      const message = params.get('message') || 'Ocurrió un error desconocido durante la integración.';
      showToast(`Error: ${decodeURIComponent(message)}`, 'error');
       window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => clearNotification(), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);
  
  const isSuperUser = user?.email === 'admin' || user?.email === 'admin@admin.cl';

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

  // Helper to ensure role comparisons are case-insensitive and robust
  const hasRole = (role: string | undefined, ...requiredRoles: Role[]) => {
    if (!role) return false;
    const upperRole = role.toUpperCase();
    return requiredRoles.map(r => r.toString().toUpperCase()).includes(upperRole);
  };

  const handleNavigate = (view: string) => {
    console.log(`[Navigation] Navigating to: ${view} (User Role: ${user?.role})`);
    setActiveView(view);
    if (isMobileView) { 
        setIsSidebarOpen(false);
    }
  };

  /**
   * [LOGIC REFACTOR v2] Determining the view content accurately.
   * If a view is forbidden or unknown, we return NULL, triggering a safe redirect in useEffect.
   */
  const getViewData = () => {
    if (!user) return null;
    if (user.role === Role.Driver) return null; // Unique Layout

    const isAdmin = hasRole(user.role, Role.Admin);
    const isOp = hasRole(user.role, Role.OperadorSistemas);
    const isRetiros = hasRole(user.role, Role.Retiros);
    const isFact = hasRole(user.role, Role.Facturacion);
    const isAux = hasRole(user.role, Role.Auxiliar);
    const isClient = hasRole(user.role, Role.Client);
    
    // Use defaults if permissions are missing (backward compatibility)
    const permissions = user?.operatorPermissions || (isOp ? DEFAULT_OPERATOR_PERMISSIONS : null);

    switch (activeView) {
      case 'packages':
        return { title: 'Gestión de Paquetes', content: <Dashboard /> };
      
      case 'import-orders':
        if (isAdmin || (isOp && permissions?.canManagePackages)) return { title: 'Importar Paquetes', content: <ImportOrdersPage /> };
        break;

      case 'assign-pickups':
        if (isAdmin || (isOp && permissions?.canBulkActions) || isRetiros) return { title: 'Gestión de Retiros', content: <PickupDashboard /> };
        break;

      case 'pickup-report':
        if (isAdmin || (isOp && permissions?.canViewReports) || isRetiros) return { title: 'Reporte de Retiros', content: <PickupReportPage /> };
        break;

      // User Management
      case 'users-admins':
        if (isAdmin) return { title: 'Gestión de Administradores', content: <UserManagement roleFilter={Role.Admin} /> };
        break;
      
      case 'users-operadores':
        if (isAdmin || (isOp && permissions?.canManageSettings)) return { title: 'Gestión de Operadores', content: <UserManagement roleFilter={Role.OperadorSistemas} /> };
        break;

      case 'users-clients':
        if (isAdmin || (isOp && permissions?.canManageClients)) return { title: 'Gestión de Clientes', content: <UserManagement roleFilter={Role.Client} /> };
        break;

      case 'users-drivers':
        if (isAdmin || (isOp && permissions?.canManageDrivers)) return { title: 'Gestión de Conductores', content: <UserManagement roleFilter={Role.Driver} /> };
        break;

      case 'users-auxiliares':
        if (isAdmin || (isOp && permissions?.canManageDrivers)) return { title: 'Gestión de Personal Auxiliar', content: <UserManagement roleFilter={Role.Auxiliar} /> };
        break;

      case 'users-retiros':
        if (isAdmin || (isOp && permissions?.canBulkActions)) return { title: 'Gestión de Personal de Retiros', content: <UserManagement roleFilter={Role.Retiros} /> };
        break;

      case 'users-facturacion':
        if (isAdmin || (isOp && permissions?.canViewReports)) return { title: 'Gestión de Personal de Facturación', content: <UserManagement roleFilter={Role.Facturacion} /> };
        break;

      // Logistics
      case 'flex-discrepancies':
        if (isAdmin || (isOp && permissions?.canManagePackages)) return { title: 'Discrepancias de Carga', content: <DriverFlexDiscrepancyPage /> };
        break;

      case 'zone-settings':
        if (isAdmin || (isOp && user?.operatorPermissions?.canManageZones)) return { title: 'Configuración de Zonas', content: <ZoneSettingsPage /> };
        break;

      case 'live-map':
        if (isAdmin || (isOp && user?.operatorPermissions?.canManageDrivers)) return { title: 'Mapa en Vivo', content: <LiveMap /> };
        break;

      case 'geolocate':
        if (isAdmin || (isOp && user?.operatorPermissions?.canManagePackages)) return { title: '', content: <GeolocatePage /> };
        break;

      // Billing
      case 'global-billing':
        if (isAdmin || (isOp && user?.operatorPermissions?.canViewReports) || isFact) return { title: 'Facturación Masiva', content: <GlobalBillingPage /> };
        break;

      case 'billing-report':
        if (isAdmin || (isOp && user?.operatorPermissions?.canViewReports) || isFact) return { title: 'Informe de Facturación', content: <BillingReportPage /> };
        break;

      case 'billing-summary':
        if (isAdmin) return { title: 'Resumen Operativo de Cobro', content: <AdminBillingSummary /> };
        break;

      case 'delivery-analytics':
        if (isAdmin || isOp) return { title: 'Análisis de Eficiencia Logística', content: <DeliveryEfficiencyDashboard /> };
        break;

      case 'driver-performance':
        if (isAdmin || (isOp && user?.operatorPermissions?.canViewReports)) return { title: 'Rendimiento por Conductor', content: <DriverPerformanceReportPage /> };
        break;

      // Client
      case 'my-creations':
        if (isClient) return { title: '', content: <ClientDashboard /> };
        break;

      case 'my-performance':
        if (isClient) return { title: 'Rendimiento de Envíos', content: <ClientPerformanceReportPage /> };
        break;

      // Auxiliar
      case 'scan-dispatch':
        if (isAux) return { title: 'Despacho de Paquetes', content: <DispatchScanner /> };
        break;

      // Settings
      case 'settings':
        if (isAdmin || (isOp && user?.operatorPermissions?.canManageSettings)) return { title: 'Ajustes del Sistema', content: <SettingsPage /> };
        if (isClient) return { title: 'Configuración de Mi Cuenta', content: <ClientSettingsPage /> };
        break;

      case 'integrations':
        if (isAdmin || (isOp && user?.operatorPermissions?.canManageIntegrations)) return { title: 'Configuración de Integraciones', content: <IntegrationSettingsPage /> };
        break;

      case 'system-logs':
        if (isAdmin && isSuperUser) return { title: '', content: <SystemLogsPage /> };
        break;
    }

    return null; // Unauthorized or Unknown
  };

  const viewData = getViewData();
  const title = viewData?.title || '';
  const content = viewData?.content;

  // Handle automatic state correction in an effect
  useEffect(() => {
    const verified = getViewData();
    if (!verified && activeView !== getDefaultView()) {
        console.warn(`[Navigation] Access denied to ${activeView}. Redirecting to ${getDefaultView()}...`);
        setActiveView(getDefaultView());
    }
  }, [user, activeView]);

  // If we have no content yet (loading or redirecting), show a blank dashboard or skeleton
  const finalContent = content || <Dashboard />;
  const finalTitle = title || (activeView === 'packages' ? 'GESTIÓN DE PAQUETES [ACTIVO]' : '');

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
                {finalTitle || (activeView === 'my-creations' ? systemSettings?.companyName : 'Dashboard')}
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
            {finalContent}
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
