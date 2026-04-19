
import React, { useState, useEffect, useContext } from 'react';
import { Role, UserStatus, PackageSource } from '../../constants';
import type { User, DriverPermissions } from '../../types';
import { api, UserCreationData, UserUpdateData, PackageCreationData } from '../../services/api';
import { IconUserCheck, IconPencil, IconTrash, IconUserPlus, IconHistory, IconUserOff, IconDollarSign, IconFileInvoice, IconMercadoLibre, IconWoocommerce, IconShopify, IconFalabella, IconJumpseller, IconQrcode, IconTruck, IconArrowUturnLeft, IconChecklist, IconPackage, IconSearch, IconCopy, IconCheck } from '../Icon';
import CreateUserModal from '../modals/CreateUserModal';
import EditUserModal from '../modals/EditUserModal';
import ConfirmationModal from '../modals/ConfirmationModal';
import DoubleKeyConfirmationModal from '../modals/DoubleKeyConfirmationModal';
import DriverHistoryModal from './DriverHistoryModal';
import { AuthContext } from '../../contexts/AuthContext';
import DriverRatesModal from '../modals/DriverRatesModal';
import ClientInvoiceHistoryModal from '../modals/ClientInvoiceHistoryModal';
import ExternalImportModal from '../modals/ExternalImportModal';


interface UserManagementProps {
  roleFilter: Role;
}

const statusStyles: { [key in UserStatus]: { badge: string; text: string; } } = {
    [UserStatus.Approved]: { 
      badge: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300', 
      text: 'Activo', 
    },
    [UserStatus.Disabled]: { 
      badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', 
      text: 'Suspendido', 
    },
    [UserStatus.Deleted]: { 
      badge: 'bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300', 
      text: 'Eliminado', 
    },
    [UserStatus.Pending]: { 
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300', 
      text: 'Pendiente', 
    },
  };

const UserManagement: React.FC<UserManagementProps> = ({ roleFilter }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deletingIntegration, setDeletingIntegration] = useState<{ user: User, source: PackageSource } | null>(null);
  const [reintegratingUser, setReintegratingUser] = useState<User | null>(null);
  const [viewingHistoryUser, setViewingHistoryUser] = useState<User | null>(null);
  const [editingDriverRates, setEditingDriverRates] = useState<User | null>(null);
  const [viewingInvoicesClient, setViewingInvoicesClient] = useState<User | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [importingClient, setImportingClient] = useState<User | null>(null);
  const [importingSource, setImportingSource] = useState<PackageSource | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'newest' | 'oldest' | 'packages'>('newest');
  const auth = useContext(AuthContext);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const allUsers = await api.getUsers();
      const filteredUsers = allUsers.filter(u => u.role === roleFilter);
      
      filteredUsers.sort((a, b) => {
        if (a.status === UserStatus.Pending && b.status !== UserStatus.Pending) return -1;
        if (a.status !== UserStatus.Pending && b.status === UserStatus.Pending) return 1;
        return a.name.localeCompare(b.name);
      });
      setUsers(filteredUsers);
    } catch (error: any) {
      console.error("Failed to fetch users", error);
      alert("Error al cargar los usuarios: " + (error.message || "Error desconocido"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSearchTerm('');
    fetchUsers();
  }, [roleFilter]);
  
  const handleApproveUser = async (userId: string) => {
    try {
        const updatedUser = await api.approveUser(userId);
        setUsers(users.map(u => u.id === userId ? updatedUser : u));
    } catch (error: any) {
        console.error("Failed to approve user:", error);
        alert("Error al aprobar el usuario: " + (error.message || "Error desconocido"));
    }
  };
  
  const handleToggleStatus = async (user: User) => {
    try {
        const updatedUser = await api.toggleUserStatus(user.id);
        setUsers(users.map(u => u.id === user.id ? updatedUser : u));
    } catch (error: any) {
        console.error("Failed to toggle user status:", error);
        alert("Error al cambiar el estado del usuario: " + (error.message || "Error desconocido"));
    }
  };

  const handleCreateUser = async (data: UserCreationData) => {
    try {
        const newUser = await api.createUser(data);
        if (newUser.role === roleFilter) {
            setUsers(prev => [...prev, newUser]);
        }
        setIsCreateModalOpen(false);
    } catch (error: any) {
        console.error("Failed to create user:", error);
        throw error; // Re-throw so the modal can catch it and display the message
    }
  };

  const handleUpdateUser = async (userId: string, data: UserUpdateData) => {
    try {
        const updatedUser = await api.updateUser(userId, data);
        setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
        setEditingUser(null);
        setEditingDriverRates(null);
    } catch (error: any) {
        console.error("Failed to update user:", error);
        throw error; // Re-throw so the modal can catch it and display the message
    }
  };

  const handleDeleteUser = async (userId: string, password?: string) => {
    await api.deleteUser(userId, password);
    setUsers(prev => prev.filter(u => u.id !== userId));
    setDeletingUser(null);
    fetchUsers(); // Refresh to show soft deleted state if needed
  };

  const handleDeleteIntegration = async (userId: string, source: PackageSource, password?: string) => {
    const sourceMap: Record<string, string> = {
        [PackageSource.MercadoLibre]: 'meli',
        [PackageSource.Shopify]: 'shopify',
        [PackageSource.WooCommerce]: 'woocommerce',
        [PackageSource.Falabella]: 'falabella',
        [PackageSource.Jumpseller]: 'jumpseller'
    };
    const integrationKey = sourceMap[source];
    if (!integrationKey) return;

    await api.deleteIntegration(userId, integrationKey, password);
    setUsers(prev => prev.map(u => {
        if (u.id === userId && u.integrations) {
            const newIntegrations = { ...u.integrations } as any;
            delete newIntegrations[integrationKey];
            return { ...u, integrations: newIntegrations };
        }
        return u;
    }));
    setDeletingIntegration(null);
  };

  const handleReintegrateUser = async (userId: string) => {
    try {
        await api.reintegrateUser(userId);
        fetchUsers();
        setReintegratingUser(null);
        alert("Usuario reintegrado con éxito. Su historial de envíos ha sido borrado.");
    } catch (error: any) {
        alert("Error al reintegrar: " + error.message);
    }
  };

  const handleOpenImportModal = (client: User, source: PackageSource) => {
    setImportingClient(client);
    setImportingSource(source);
  };
  
  const handleCloseImportModal = () => {
    setImportingClient(null);
    setImportingSource(null);
  };

  const handleImportPackages = async (packagesToCreate: Omit<PackageCreationData, 'creatorId' | 'origin'>[]) => {
    if (!importingClient) return;

    const fullPackagesData: PackageCreationData[] = packagesToCreate.map(p => ({
        ...p,
        creatorId: importingClient.id,
        origin: importingClient.pickupAddress || importingClient.name,
    }));

    try {
        await api.createMultiplePackages(fullPackagesData);
        handleCloseImportModal();
        alert(`${fullPackagesData.length} paquetes importados con éxito.`);
        // Note: No need to update local package state here, as the main dashboard will refetch.
    } catch (error) {
        console.error("Failed to import packages:", error);
        alert("Ocurrió un error al importar los paquetes.");
    }
  };
  
  const handleTogglePermission = async (user: User, permission: keyof DriverPermissions) => {
    const currentPermissions = user.driverPermissions || {
        canDeliver: true,
        canPickup: true,
        canDispatch: true,
        canReturn: true,
        canViewHistory: true,
        canBulkPickup: false,
        canColecta: false,
    };

    const newPermissions = {
        ...currentPermissions,
        [permission]: !currentPermissions[permission],
    };

    try {
        await api.updateUser(user.id, { driverPermissions: newPermissions });
        fetchUsers(); // Refetch to ensure consistency
    } catch (error) {
        console.error("Failed to update driver permission", error);
        alert("Error al actualizar el permiso.");
    }
  };


  const handleCopyRegistrationLink = (user: User) => {
    const registrationUrl = `${window.location.origin}/?mode=register&email=${encodeURIComponent(user.email)}`;
    navigator.clipboard.writeText(registrationUrl);
    setCopiedUserId(user.id);
    setTimeout(() => setCopiedUserId(null), 2000);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phone && user.phone.includes(searchTerm)) ||
      (user.rut && user.rut.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (showDeleted) return matchesSearch;
    return matchesSearch && user.status !== UserStatus.Deleted;
  }).sort((a, b) => {
    // Always keep Pending status at the top
    if (a.status === UserStatus.Pending && b.status !== UserStatus.Pending) return -1;
    if (a.status !== UserStatus.Pending && b.status === UserStatus.Pending) return 1;

    // Then apply the selected sort
    if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
    } else if (sortBy === 'newest') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
    } else if (sortBy === 'oldest') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
    } else if (sortBy === 'packages') {
        return (b.packageCount || 0) - (a.packageCount || 0);
    }
    return 0;
  });

  return (
    <div className="container mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IconSearch className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, email, RUT o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-[var(--border-primary)] rounded-md leading-5 bg-[var(--background-secondary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] sm:text-sm transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
            <span className="text-sm text-[var(--text-muted)] whitespace-nowrap">Ordenar por:</span>
            <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="block w-full sm:w-48 pl-3 pr-10 py-2 border border-[var(--border-primary)] rounded-md leading-5 bg-[var(--background-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] sm:text-sm transition-colors"
            >
                <option value="newest">Más nuevos</option>
                <option value="oldest">Más antiguos</option>
                <option value="name">Nombre</option>
                <option value="packages">Más paquetes</option>
            </select>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
            <input 
              type="checkbox" 
              checked={showDeleted} 
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-[var(--border-primary)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
            />
            Mostrar eliminados
          </label>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-secondary)] whitespace-nowrap"
          >
            <IconUserPlus className="w-5 h-5 mr-2 -ml-1"/>
            Crear Usuario
          </button>
        </div>
      </div>
      <div className="bg-[var(--background-secondary)] shadow-md rounded-lg">
        <div className="divide-y divide-[var(--border-primary)]">
          {isLoading ? (
            <p className="p-6 text-center text-[var(--text-muted)]">Cargando usuarios...</p>
          ) : filteredUsers.length === 0 ? (
             <p className="p-6 text-center text-[var(--text-muted)]">
               {searchTerm ? 'No se encontraron usuarios que coincidan con la búsqueda.' : `No se encontraron usuarios con el rol de ${roleFilter}.`}
             </p>
          ) : filteredUsers.map(user => {
            const hasNoCustomPricing = user.role === Role.Client &&
              (!user.pricing || (user.pricing.sameDay === 0 && user.pricing.express === 0 && user.pricing.nextDay === 0)) &&
              (!user.pickupCost || user.pickupCost === 0);
            
            return (
            <div key={user.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                    <p className={`font-semibold ${hasNoCustomPricing ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>{user.name}</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[user.status].badge}`}>
                        {statusStyles[user.status].text}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border-2 border-emerald-300 shadow-sm uppercase tracking-tighter">
                        <IconPackage className="w-4 h-4" />
                        {user.packageCount || 0} paquetes
                    </span>
                    {user.integrations?.meli && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300 shadow-sm">
                            <IconMercadoLibre className="w-4 h-4" />
                            <span>ML</span>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingIntegration({ user, source: PackageSource.MercadoLibre });
                                }}
                                className="ml-1 p-1 text-red-600 hover:bg-red-200 rounded-md transition-all"
                                title="Eliminar conexión con Mercado Libre"
                            >
                                <IconTrash className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {user.integrations?.shopify && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300 shadow-sm">
                            <IconShopify className="w-4 h-4" />
                            <span>Shopify</span>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingIntegration({ user, source: PackageSource.Shopify });
                                }}
                                className="ml-1 p-1 text-red-600 hover:bg-red-200 rounded-md transition-all"
                                title="Eliminar conexión con Shopify"
                            >
                                <IconTrash className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {user.integrations?.woocommerce && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 shadow-sm">
                            <IconWoocommerce className="w-4 h-4" />
                            <span>Woo</span>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingIntegration({ user, source: PackageSource.WooCommerce });
                                }}
                                className="ml-1 p-1 text-red-600 hover:bg-red-200 rounded-md transition-all"
                                title="Eliminar conexión con WooCommerce"
                            >
                                <IconTrash className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {user.integrations?.falabella && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300 shadow-sm">
                            <IconFalabella className="w-4 h-4" />
                            <span>Falabella</span>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingIntegration({ user, source: PackageSource.Falabella });
                                }}
                                className="ml-1 p-1 text-red-600 hover:bg-red-200 rounded-md transition-all"
                                title="Eliminar conexión con Falabella"
                            >
                                <IconTrash className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {user.integrations?.jumpseller && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300 shadow-sm">
                            <IconJumpseller className="w-4 h-4" />
                            <span>Jumpseller</span>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingIntegration({ user, source: PackageSource.Jumpseller });
                                }}
                                className="ml-1 p-1 text-red-600 hover:bg-red-200 rounded-md transition-all"
                                title="Eliminar conexión con Jumpseller"
                            >
                                <IconTrash className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
                <p className="text-sm text-[var(--text-muted)] mt-1">{user.email}</p>
                {user.plainPassword && auth?.user?.email === 'admin' && (
                    <p className="text-sm font-mono text-[var(--brand-primary)] mt-1">
                        Contraseña: {user.plainPassword}
                    </p>
                )}
                {roleFilter === Role.Driver && (
                    (() => {
                        const permissions = user.driverPermissions || { canDeliver: true, canPickup: true, canDispatch: true, canReturn: true, canViewHistory: true, canBulkPickup: false, canColecta: false };
                        const permissionItems: { key: keyof DriverPermissions, label: string, icon: React.ReactNode }[] = [
                            { key: 'canDeliver', label: 'Entregar', icon: <IconTruck className="w-4 h-4"/> },
                            { key: 'canPickup', label: 'Retirar', icon: <IconQrcode className="w-4 h-4"/> },
                            { key: 'canColecta', label: 'Colecta', icon: <IconTruck className="w-4 h-4"/> },
                            { key: 'canBulkPickup', label: 'Retiro Masivo', icon: <IconChecklist className="w-4 h-4"/> },
                            { key: 'canDispatch', label: 'Despachar', icon: <IconPackage className="w-4 h-4"/> },
                            { key: 'canReturn', label: 'Devoluciones', icon: <IconArrowUturnLeft className="w-4 h-4"/> },
                            { key: 'canViewHistory', label: 'Historial', icon: <IconHistory className="w-4 h-4"/> },
                        ];
                        return (
                            <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
                                <span className="text-xs font-semibold text-[var(--text-muted)] mb-2 block">Permisos de Módulo:</span>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {permissionItems.map(item => (
                                        <button 
                                            key={item.key}
                                            onClick={() => handleTogglePermission(user, item.key)}
                                            title={item.label}
                                            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${permissions[item.key] ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                                        >
                                            {item.icon}
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )
                    })()
                )}
              </div>
              
              {roleFilter === Role.Client && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm text-center sm:text-left">
                      <div>
                          <p className="text-xs text-[var(--text-muted)]">En el Día</p>
                          <p className="font-semibold text-[var(--text-primary)]">
                              {(user.pricing?.sameDay || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                          </p>
                      </div>
                      <div>
                          <p className="text-xs text-[var(--text-muted)]">Express</p>
                          <p className="font-semibold text-[var(--text-primary)]">
                              {(user.pricing?.express || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                          </p>
                      </div>
                      <div>
                          <p className="text-xs text-[var(--text-muted)]">Next Day</p>
                          <p className="font-semibold text-[var(--text-primary)]">
                              {(user.pricing?.nextDay || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                          </p>
                      </div>
                      <div>
                          <p className="text-xs text-[var(--text-muted)]">Retiro</p>
                          <p className="font-semibold text-[var(--text-primary)]">
                              {(user.pickupCost || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                          </p>
                      </div>
                  </div>
              )}

              <div className="flex items-center space-x-2 flex-shrink-0">
                {user.status === UserStatus.Pending && (
                  <button 
                    onClick={() => handleApproveUser(user.id)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-secondary)] transition-colors"
                  >
                    Aprobar
                  </button>
                )}
                {roleFilter === Role.Client && (
                    <>
                    {user.integrations?.meli && 
                        <button onClick={() => handleOpenImportModal(user, PackageSource.MercadoLibre)} className="p-2 text-[var(--text-muted)] hover:text-yellow-600 hover:bg-yellow-100 rounded-md transition-colors" title="Importar de Mercado Libre"><IconMercadoLibre className="w-5 h-5" /></button>}
                    {user.integrations?.shopify && 
                        <button onClick={() => handleOpenImportModal(user, PackageSource.Shopify)} className="p-2 text-[var(--text-muted)] hover:text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Importar de Shopify"><IconShopify className="w-5 h-5" /></button>}
                    {user.integrations?.woocommerce && 
                        <button onClick={() => handleOpenImportModal(user, PackageSource.WooCommerce)} className="p-2 text-[var(--text-muted)] hover:text-purple-600 hover:bg-purple-100 rounded-md transition-colors" title="Importar de WooCommerce"><IconWoocommerce className="w-5 h-5" /></button>}
                    {user.integrations?.falabella && 
                        <button onClick={() => handleOpenImportModal(user, PackageSource.Falabella)} className="p-2 text-[var(--text-muted)] hover:text-orange-600 hover:bg-orange-100 rounded-md transition-colors" title="Importar de Falabella"><IconFalabella className="w-5 h-5" /></button>}
                    {user.integrations?.jumpseller && 
                        <button onClick={() => handleOpenImportModal(user, PackageSource.Jumpseller)} className="p-2 text-[var(--text-muted)] hover:text-sky-600 hover:bg-sky-100 rounded-md transition-colors" title="Importar de Jumpseller"><IconJumpseller className="w-5 h-5" /></button>}
                    {auth?.user?.email === 'admin' && (
                        <button 
                            onClick={async () => {
                                const superKey = window.prompt(`Ingresa la Clave de Superusuario para entrar al portal de ${user.name}:`);
                                if (superKey) {
                                    try {
                                        const response = await api.login({ email: user.email, password: superKey });
                                        localStorage.setItem('token', response.token);
                                        window.location.href = '/'; // Refresh to load as client
                                    } catch (err: any) {
                                        alert("Clave de Superusuario incorrecta o error de conexión: " + err.message);
                                    }
                                }
                            }}
                            className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200"
                            title="Entrar al Portal del Cliente (Requiere Clave de Superusuario)"
                        >
                            <IconTruck className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={() => setViewingInvoicesClient(user)} className="p-2 text-[var(--text-muted)] hover:text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors" title="Historial de Facturas"><IconFileInvoice className="w-5 h-5" /></button>
                    </>
                )}
                {user.role === 'DRIVER' && (
                    <>
                     <button onClick={() => setEditingDriverRates(user)} className="p-2 text-[var(--text-muted)] hover:text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Definir tarifas de pago"><IconDollarSign className="w-5 h-5" /></button>
                     <button onClick={() => setViewingHistoryUser(user)} className="p-2 text-[var(--text-muted)] hover:text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Ver historial"><IconHistory className="w-5 h-5" /></button>
                    </>
                )}
                 {user.email !== 'admin@admin.cl' && user.status !== UserStatus.Pending && user.status !== UserStatus.Deleted && (
                    <button 
                        onClick={() => handleToggleStatus(user)}
                        className="p-2 text-[var(--text-muted)] hover:text-yellow-600 hover:bg-yellow-100 rounded-md transition-colors"
                        title={user.status === UserStatus.Approved ? "Deshabilitar usuario" : "Habilitar usuario"}
                    >
                        {user.status === UserStatus.Approved ? <IconUserOff className="w-5 h-5" /> : <IconUserCheck className="w-5 h-5" />}
                    </button>
                )}
                {user.status === UserStatus.Deleted && (
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => setReintegratingUser(user)}
                            className="p-2 text-[var(--text-muted)] hover:text-green-600 hover:bg-green-100 rounded-md transition-colors"
                            title="Reintegrar usuario"
                        >
                            <IconArrowUturnLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => handleCopyRegistrationLink(user)}
                            className={`p-2 rounded-md transition-all ${copiedUserId === user.id ? 'text-green-500 bg-green-50' : 'text-[var(--text-muted)] hover:text-blue-600 hover:bg-blue-100'}`}
                            title="Copiar Link de Reintegración"
                        >
                            {copiedUserId === user.id ? <IconCheck className="w-5 h-5" /> : <IconCopy className="w-5 h-5" />}
                        </button>
                    </div>
                )}
                <button 
                    onClick={() => setEditingUser(user)}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-muted)] rounded-md transition-colors"
                    title="Editar usuario"
                >
                    <IconPencil className="w-5 h-5" />
                </button>
                {user.email !== 'admin@admin.cl' && (
                    <button 
                        onClick={() => setDeletingUser(user)}
                        className="p-2 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-100 rounded-md transition-colors"
                        title="Eliminar usuario"
                    >
                        <IconTrash className="w-5 h-5" />
                    </button>
                )}
              </div>
            </div>
            )
          })}
        </div>
      </div>
      
      {/* --- Modals --- */}
      {isCreateModalOpen && (
        <CreateUserModal 
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateUser}
          defaultRole={roleFilter}
        />
      )}
      {editingUser && (
        <EditUserModal 
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdate={handleUpdateUser}
          currentUserRole={auth?.user?.role}
        />
      )}
      {deletingUser && (
        <DoubleKeyConfirmationModal 
          title="Eliminar Usuario"
          message={`¿Estás seguro de que quieres eliminar a ${deletingUser.name}? Esta acción es IRREVERSIBLE. El usuario será marcado como ELIMINADO, sus integraciones serán borradas y no podrá volver a ingresar hasta ser reintegrado.`}
          confirmText="Eliminar Usuario"
          onClose={() => setDeletingUser(null)}
          onConfirm={(password) => handleDeleteUser(deletingUser.id, password)}
          requiredPhrase="BORRAR USUARIO"
        />
      )}
      {deletingIntegration && (
        <DoubleKeyConfirmationModal 
          title="Eliminar Integración"
          message={`¿Estás seguro de que quieres eliminar la integración de ${deletingIntegration.source} para ${deletingIntegration.user.name}? Esta acción es IRREVERSIBLE. Se perderá la conexión con la tienda externa y no se podrán sincronizar más pedidos.`}
          confirmText="Eliminar Integración"
          onClose={() => setDeletingIntegration(null)}
          onConfirm={(password) => handleDeleteIntegration(deletingIntegration.user.id, deletingIntegration.source, password)}
          requiredPhrase="BORRAR INTEGRACION"
        />
      )}
      {reintegratingUser && (
        <ConfirmationModal 
          title="Reintegrar Usuario"
          message={`¿Estás seguro de que quieres reintegrar a ${reintegratingUser.name}? El usuario volverá a estar activo, pero su historial de envíos empezará de cero.`}
          confirmText="Reintegrar"
          onClose={() => setReintegratingUser(null)}
          onConfirm={() => handleReintegrateUser(reintegratingUser.id)}
        />
      )}
      {viewingHistoryUser && (
        <DriverHistoryModal
            user={viewingHistoryUser}
            onClose={() => setViewingHistoryUser(null)}
        />
      )}
      {editingDriverRates && (
        <DriverRatesModal 
          driver={editingDriverRates}
          onClose={() => setEditingDriverRates(null)}
          onSave={handleUpdateUser}
        />
      )}
      {viewingInvoicesClient && (
        <ClientInvoiceHistoryModal
            client={viewingInvoicesClient}
            onClose={() => setViewingInvoicesClient(null)}
        />
      )}
      {importingClient && importingSource && (
        <ExternalImportModal
            client={importingClient}
            source={importingSource}
            onClose={handleCloseImportModal}
            onImport={handleImportPackages}
        />
      )}
    </div>
  );
};

export default UserManagement;
