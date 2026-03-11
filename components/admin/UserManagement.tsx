
import React, { useState, useEffect, useContext } from 'react';
import { Role, UserStatus, PackageSource } from '../../constants';
import type { User, DriverPermissions } from '../../types';
import { api, UserCreationData, UserUpdateData, PackageCreationData } from '../../services/api';
import { IconUserCheck, IconClock, IconPencil, IconTrash, IconUserPlus, IconHistory, IconUserOff, IconDollarSign, IconFileInvoice, IconMercadoLibre, IconWoocommerce, IconQrcode, IconTruck, IconArrowUturnLeft, IconChecklist, IconPackage } from '../Icon';
import CreateUserModal from '../modals/CreateUserModal';
import EditUserModal from '../modals/EditUserModal';
import ConfirmationModal from '../modals/ConfirmationModal';
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
    [UserStatus.Pending]: { 
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300', 
      text: 'Pendiente', 
    },
  };

const UserManagement: React.FC<UserManagementProps> = ({ roleFilter }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [viewingHistoryUser, setViewingHistoryUser] = useState<User | null>(null);
  const [editingDriverRates, setEditingDriverRates] = useState<User | null>(null);
  const [viewingInvoicesClient, setViewingInvoicesClient] = useState<User | null>(null);
  const [importingClient, setImportingClient] = useState<User | null>(null);
  const [importingSource, setImportingSource] = useState<PackageSource | null>(null);
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
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);
  
  const handleApproveUser = async (userId: string) => {
    const updatedUser = await api.approveUser(userId);
    setUsers(users.map(u => u.id === userId ? updatedUser : u));
  };
  
  const handleToggleStatus = async (user: User) => {
    try {
        const updatedUser = await api.toggleUserStatus(user.id);
        setUsers(users.map(u => u.id === user.id ? updatedUser : u));
    } catch (error) {
        console.error("Failed to toggle user status:", error);
    }
  };

  const handleCreateUser = async (data: UserCreationData) => {
    const newUser = await api.createUser(data);
    if (newUser.role === roleFilter) {
        setUsers(prev => [...prev, newUser]);
    }
    setIsCreateModalOpen(false);
  };

  const handleUpdateUser = async (userId: string, data: UserUpdateData) => {
    const updatedUser = await api.updateUser(userId, data);
    setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
    setEditingUser(null);
    setEditingDriverRates(null);
  };

  const handleDeleteUser = async (userId: string) => {
    await api.deleteUser(userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
    setDeletingUser(null);
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


  return (
    <div className="container mx-auto">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-secondary)]"
        >
          <IconUserPlus className="w-5 h-5 mr-2 -ml-1"/>
          Crear Usuario
        </button>
      </div>
      <div className="bg-[var(--background-secondary)] shadow-md rounded-lg">
        <div className="divide-y divide-[var(--border-primary)]">
          {isLoading ? (
            <p className="p-6 text-center text-[var(--text-muted)]">Cargando usuarios...</p>
          ) : users.length === 0 ? (
             <p className="p-6 text-center text-[var(--text-muted)]">No se encontraron usuarios con el rol de {roleFilter}.</p>
          ) : users.map(user => {
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
                    {user.integrations?.meli && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300" title="Conectado a Mercado Libre">
                            <IconMercadoLibre className="w-3 h-3" />
                            ML Conectado
                        </span>
                    )}
                </div>
                <p className="text-sm text-[var(--text-muted)] mt-1">{user.email}</p>
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
                {user.role === Role.Client && (
                    <>
                    {user.integrations?.meli && 
                        <button onClick={() => handleOpenImportModal(user, PackageSource.MercadoLibre)} className="p-2 text-[var(--text-muted)] hover:text-yellow-600 hover:bg-yellow-100 rounded-md transition-colors" title="Importar de Mercado Libre"><IconMercadoLibre className="w-5 h-5" /></button>}
                    {user.integrations?.woocommerce && 
                        <button onClick={() => handleOpenImportModal(user, PackageSource.WooCommerce)} className="p-2 text-[var(--text-muted)] hover:text-purple-600 hover:bg-purple-100 rounded-md transition-colors" title="Importar de WooCommerce"><IconWoocommerce className="w-5 h-5" /></button>}
                    <button onClick={() => setViewingInvoicesClient(user)} className="p-2 text-[var(--text-muted)] hover:text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors" title="Historial de Facturas"><IconFileInvoice className="w-5 h-5" /></button>
                    </>
                )}
                {user.role === 'DRIVER' && (
                    <>
                     <button onClick={() => setEditingDriverRates(user)} className="p-2 text-[var(--text-muted)] hover:text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Definir tarifas de pago"><IconDollarSign className="w-5 h-5" /></button>
                     <button onClick={() => setViewingHistoryUser(user)} className="p-2 text-[var(--text-muted)] hover:text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Ver historial"><IconHistory className="w-5 h-5" /></button>
                    </>
                )}
                 {user.email !== 'admin@admin.cl' && user.status !== UserStatus.Pending && (
                    <button 
                        onClick={() => handleToggleStatus(user)}
                        className="p-2 text-[var(--text-muted)] hover:text-yellow-600 hover:bg-yellow-100 rounded-md transition-colors"
                        title={user.status === UserStatus.Approved ? "Deshabilitar usuario" : "Habilitar usuario"}
                    >
                        {user.status === UserStatus.Approved ? <IconUserOff className="w-5 h-5" /> : <IconUserCheck className="w-5 h-5" />}
                    </button>
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
        <ConfirmationModal 
          title="Eliminar Usuario"
          message={`¿Estás seguro de que quieres eliminar a ${deletingUser.name}? Esta acción es permanente y desasignará todos sus paquetes.`}
          confirmText="Eliminar Usuario"
          onClose={() => setDeletingUser(null)}
          onConfirm={() => handleDeleteUser(deletingUser.id)}
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
