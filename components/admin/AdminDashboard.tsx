

import React, { useState } from 'react';
import Dashboard from '../Dashboard';
import UserManagement from './UserManagement';
import { IconPackage, IconUsers } from '../Icon';
import { Role } from '../../constants';
import type { User } from '../../types';

type Tab = 'packages' | 'users';
type UserRoleView = 'clients' | 'drivers' | 'admins' | 'facturacion' | 'retiros' | 'auxiliares';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('packages');
  const [activeUserView, setActiveUserView] = useState<UserRoleView>('drivers');

  const tabStyles = "flex items-center px-4 py-3 font-medium text-sm transition-colors duration-200";
  const activeTabStyles = "text-[var(--brand-primary)] border-b-2 border-[var(--brand-primary)]";
  const inactiveTabStyles = "text-[var(--text-muted)] hover:text-[var(--text-primary)]";

  const subTabStyles = "px-3 py-1.5 text-sm font-medium rounded-md";
  const activeSubTabStyles = "bg-[var(--brand-muted)] text-[var(--brand-text)]";
  const inactiveSubTabStyles = "text-[var(--text-secondary)] hover:bg-[var(--background-hover)]";

  const renderUserManagement = () => {
    let roleFilter: Role;
    switch (activeUserView) {
      case 'clients':
        roleFilter = Role.Client;
        break;
      case 'admins':
        roleFilter = Role.Admin;
        break;
      case 'facturacion':
        roleFilter = Role.Facturacion;
        break;
      case 'retiros':
        roleFilter = Role.Retiros;
        break;
      case 'auxiliares':
        roleFilter = Role.Auxiliar;
        break;
      case 'drivers':
      default:
        roleFilter = Role.Driver;
        break;
    }
    return <UserManagement roleFilter={roleFilter} />;
  };

  return (
    <div>
      <div className="bg-[var(--background-secondary)] shadow-md rounded-lg mb-6">
        <div className="border-b border-[var(--border-primary)]">
          <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('packages')}
              className={`${tabStyles} ${activeTab === 'packages' ? activeTabStyles : inactiveTabStyles}`}
            >
              <IconPackage className="w-5 h-5 mr-2" />
              <span>Gestión de Paquetes</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`${tabStyles} ${activeTab === 'users' ? activeTabStyles : inactiveTabStyles}`}
            >
              <IconUsers className="w-5 h-5 mr-2" />
              <span>Gestión de Usuarios</span>
            </button>
          </nav>
        </div>
        {activeTab === 'users' && (
            <div className="p-4 flex items-center space-x-2 border-b border-[var(--border-primary)] flex-wrap gap-2">
                <span className="text-sm font-medium text-[var(--text-muted)]">Filtrar por rol:</span>
                <button 
                    onClick={() => setActiveUserView('drivers')} 
                    className={`${subTabStyles} ${activeUserView === 'drivers' ? activeSubTabStyles : inactiveSubTabStyles}`}
                >Conductores</button>
                <button 
                    onClick={() => setActiveUserView('clients')}
                    className={`${subTabStyles} ${activeUserView === 'clients' ? activeSubTabStyles : inactiveSubTabStyles}`}
                >Clientes</button>
                <button 
                    onClick={() => setActiveUserView('facturacion')}
                    className={`${subTabStyles} ${activeUserView === 'facturacion' ? activeSubTabStyles : inactiveSubTabStyles}`}
                >Facturación</button>
                <button 
                    onClick={() => setActiveUserView('retiros')}
                    className={`${subTabStyles} ${activeUserView === 'retiros' ? activeSubTabStyles : inactiveSubTabStyles}`}
                >Retiros</button>
                <button 
                    onClick={() => setActiveUserView('auxiliares')}
                    className={`${subTabStyles} ${activeUserView === 'auxiliares' ? activeSubTabStyles : inactiveSubTabStyles}`}
                >Auxiliares</button>
                <button 
                    onClick={() => setActiveUserView('admins')}
                    className={`${subTabStyles} ${activeUserView === 'admins' ? activeSubTabStyles : inactiveSubTabStyles}`}
                >Administradores</button>
            </div>
        )}
      </div>

      <div>
        {activeTab === 'packages' && <Dashboard />}
        {activeTab === 'users' && renderUserManagement()}
      </div>
    </div>
  );
};

export default AdminDashboard;