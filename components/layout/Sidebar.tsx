
import React, { useContext, useState } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { IconCube, IconPackage, IconUsers, IconUser, IconLogOut, IconLayoutDashboard, IconX, IconChevronDown, IconTruck, IconUserCheck, IconSettings, IconQrcode, IconFileText, IconMapPin, IconChartBar, IconFileInvoice, IconPlugConnected, IconDownload, IconMap } from '../Icon';
import { Role } from '../../constants';
import type { User } from '../../types';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const getRoleInSpanish = (role?: Role): string => {
    if (!role) return '';
    switch (role) {
        case Role.Admin: return 'Administrador';
        case Role.Driver: return 'Conductor';
        case Role.Client: return 'Cliente';
        case Role.Facturacion: return 'Facturación';
        case Role.Retiros: return 'Retiros';
        case Role.Auxiliar: return 'Auxiliar';
        default: return role;
    }
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, isOpen, onClose }) => {
  const { user, logout, systemSettings } = useContext(AuthContext)!;

  const [openMenus, setOpenMenus] = useState<Set<string>>(() => {
    const menus = new Set<string>();
    if (activeView.startsWith('users-')) menus.add('users');
    if (['assign-pickups', 'pickup-report'].includes(activeView)) menus.add('pickups');
    if (['settings', 'integrations'].includes(activeView)) menus.add('configuration');
    return menus;
  });

  const toggleMenu = (id: string) => {
    setOpenMenus(prev => {
      const newMenus = new Set(prev);
      if (newMenus.has(id)) {
        newMenus.delete(id);
      } else {
        newMenus.add(id);
      }
      return newMenus;
    });
  };

  const adminNavItems = [
    { id: 'packages', label: 'Gestión de Paquetes', icon: <IconLayoutDashboard className="h-6 w-6" /> },
    { id: 'geolocate', label: 'Geolocalizar', icon: <IconMap className="h-6 w-6" /> },
    { id: 'import-orders', label: 'Importar Envíos', icon: <IconDownload className="h-6 w-6" /> },
    { 
      id: 'pickups',
      label: 'Retiros',
      icon: <IconUserCheck className="h-6 w-6" />,
      subItems: [
        { id: 'assign-pickups', label: 'Gestión de Retiros', icon: <IconPackage className="h-5 w-5" /> },
        { id: 'pickup-report', label: 'Reporte de Retiros', icon: <IconChartBar className="h-5 w-5" /> }
      ]
    },
    { 
      id: 'users', 
      label: 'Gestión de Usuarios', 
      icon: <IconUsers className="h-6 w-6" />,
      subItems: [
        { id: 'users-clients', label: 'Clientes', icon: <IconUser className="h-5 w-5" /> },
        { id: 'users-drivers', label: 'Conductores', icon: <IconTruck className="h-5 w-5" /> },
        { id: 'users-auxiliares', label: 'Auxiliares', icon: <IconUser className="h-5 w-5" /> },
        { id: 'users-retiros', label: 'Retiros', icon: <IconUserCheck className="h-5 w-5" /> },
        { id: 'users-facturacion', label: 'Facturación', icon: <IconFileInvoice className="h-5 w-5" /> },
        { id: 'users-admins', label: 'Administradores', icon: <IconUserCheck className="h-5 w-5" /> }
      ]
    },
    { id: 'zone-settings', label: 'Gestión de Zonas', icon: <IconMapPin className="h-6 w-6" /> },
    { id: 'live-map', label: 'Mapa en Vivo', icon: <IconMapPin className="h-6 w-6" /> },
    { id: 'global-billing', label: 'Facturación Masiva', icon: <IconFileInvoice className="h-6 w-6" /> },
    { id: 'billing-report', label: 'Informe por Cliente', icon: <IconFileText className="h-6 w-6" /> },
    { id: 'driver-performance', label: 'Reporte Conductores', icon: <IconChartBar className="h-6 w-6" /> },
    {
      id: 'configuration',
      label: 'Configuración',
      icon: <IconSettings className="h-6 w-6" />,
      subItems: [
        ...(user?.email === 'admin' ? [{ id: 'settings', label: 'Sistema', icon: <IconSettings className="h-5 w-5" /> }] : []),
        { id: 'integrations', label: 'Integraciones', icon: <IconPlugConnected className="h-5 w-5" /> }
      ]
    }
  ].filter(item => !('subItems' in item) || (item as any).subItems.length > 0);
  
  const clientNavItems = [
    { id: 'my-creations', label: 'Mis Paquetes Creados', icon: <IconPackage className="h-6 w-6" /> },
    { id: 'my-performance', label: 'Rendimiento de Envíos', icon: <IconChartBar className="h-6 w-6" /> },
  ];

  const facturacionNavItems = [
    { id: 'global-billing', label: 'Facturación Masiva', icon: <IconFileInvoice className="h-6 w-6" /> },
    { id: 'billing-report', label: 'Informe por Cliente', icon: <IconFileText className="h-6 w-6" /> },
  ];

  const retirosNavItems: any[] = [
      { id: 'assign-pickups', label: 'Gestión de Retiros', icon: <IconUserCheck className="h-6 w-6" /> },
      { id: 'pickup-report', label: 'Reporte de Retiros', icon: <IconChartBar className="h-6 w-6" /> },
  ];

  const auxiliarNavItems = [
    { id: 'scan-dispatch', label: 'Despachar Paquetes', icon: <IconQrcode className="h-6 w-6" /> },
  ];


  let navItems;
  switch (user?.role) {
      case Role.Admin:
          navItems = adminNavItems;
          break;
      case Role.Client:
          navItems = clientNavItems;
          break;
      case Role.Facturacion:
          navItems = facturacionNavItems;
          break;
      case Role.Retiros:
          navItems = retirosNavItems;
          break;
      case Role.Auxiliar:
          navItems = auxiliarNavItems;
          break;
      default:
          navItems = [];
  }

  return (
    <aside className={`w-64 flex-shrink-0 bg-[var(--background-secondary)] flex flex-col border-r border-[var(--border-primary)] transform transition-transform duration-300 ease-in-out fixed inset-y-0 left-0 z-40 lg:static lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--border-primary)]">
        <div className="flex items-center space-x-3 min-w-0">
            <IconCube className="h-8 w-8 text-[var(--brand-primary)] flex-shrink-0" />
            <h1 className="text-xl font-bold text-[var(--text-primary)] truncate">
              {systemSettings.companyName}
            </h1>
        </div>
        <button 
            onClick={onClose} 
            className="lg:hidden p-2 -mr-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--background-hover)] rounded-md"
            aria-label="Cerrar menú"
        >
            <IconX className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 custom-scrollbar overflow-y-auto">
        {navItems.map(item => (
          'subItems' in item ? (
            <div key={item.id}>
              <button
                onClick={() => toggleMenu(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  (item.subItems as any[])?.some(sub => sub.id === activeView) || openMenus.has(item.id)
                    ? 'bg-[var(--background-hover)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--background-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                <IconChevronDown className={`w-5 h-5 transform transition-transform duration-200 ${openMenus.has(item.id) ? 'rotate-180' : ''}`} />
              </button>
              {openMenus.has(item.id) && (
                <div className="pl-6 pt-1 mt-1 space-y-1">
                  {(item.subItems as any[]).map(subItem => (
                    <button
                      key={subItem.id}
                      onClick={() => onNavigate(subItem.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeView === subItem.id
                          ? 'bg-[var(--brand-muted)] text-[var(--brand-text)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--background-hover)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {subItem.icon}
                      <span>{subItem.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeView === item.id
                  ? 'bg-[var(--brand-muted)] text-[var(--brand-text)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--background-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          )
        ))}
        
        {/* Direct Access Shortcut for Admin */}
        {/* {user?.role === 'ADMIN' && (
            <button
                onClick={() => setIsScannerTestOpen(true)}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-bold text-yellow-600 hover:bg-yellow-50 transition-colors mt-4 border border-yellow-200 border-dashed"
            >
                <IconQrcode className="h-6 w-6" />
                <span>PRUEBA DE LECTOR</span>
            </button>
        )} */}
      </nav>

      <div className="px-4 py-4 border-t border-[var(--border-primary)] space-y-4">
        <div className="flex items-center space-x-3 p-3 bg-[var(--background-muted)] rounded-md">
            <div className="flex-shrink-0">
                <IconUser className="h-8 w-8 p-1.5 bg-[var(--background-secondary)] text-[var(--text-secondary)] rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user?.name}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{getRoleInSpanish(user?.role)}</p>
            </div>
            <button
                onClick={logout}
                className="p-2 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-100 rounded-md transition-colors"
                aria-label="Cerrar sesión"
            >
                <IconLogOut className="h-5 w-5" />
            </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
