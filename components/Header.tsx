

import React, { useContext } from 'react';
import { IconCube, IconUser, IconLogOut } from './Icon';
import { AuthContext } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const auth = useContext(AuthContext);

  return (
    <header className="bg-[var(--background-secondary)] shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <IconCube className="h-8 w-8 text-[var(--brand-primary)]" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Sistema de Seguimiento de Paquetes
            </h1>
          </div>
          {auth?.user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-[var(--text-secondary)]">
                <IconUser className="h-5 w-5" />
                <span className="font-medium">{auth.user.name} ({auth.user.role})</span>
              </div>
              <button
                onClick={auth.logout}
                className="flex items-center space-x-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand-secondary)] transition-colors"
                aria-label="Cerrar sesión"
              >
                <IconLogOut className="h-5 w-5" />
                <span>Salir</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;