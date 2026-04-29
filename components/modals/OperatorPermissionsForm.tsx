import React from 'react';
import { OperatorPermissions } from '../../types';

interface OperatorPermissionsFormProps {
    permissions: OperatorPermissions;
    onChange: (permissions: OperatorPermissions) => void;
}

export const operatorPermissionItems: { key: keyof OperatorPermissions; label: string }[] = [
    { key: 'canManageDrivers', label: 'Gestión de Conductores' },
    { key: 'canManageClients', label: 'Gestión de Clientes' },
    { key: 'canManagePackages', label: 'Gestión de Envíos' },
    { key: 'canDeletePackages', label: 'Eliminar Envíos' },
    { key: 'canManageZones', label: 'Gestión de Zonas' },
    { key: 'canManageSettings', label: 'Configuración del Sistema' },
    { key: 'canManageIntegrations', label: 'Gestión de Integraciones' },
    { key: 'canViewReports', label: 'Ver Reportes' },
    { key: 'canBulkActions', label: 'Acciones Masivas' },
];

const OperatorPermissionsForm: React.FC<OperatorPermissionsFormProps> = ({ permissions, onChange }) => {
    const handleToggle = (key: keyof OperatorPermissions) => {
        onChange({
            ...permissions,
            [key]: !permissions[key]
        });
    };

    return (
        <div className="pt-4 mt-4 border-t border-[var(--border-primary)] space-y-3">
            <h4 className="text-md font-semibold text-[var(--text-secondary)]">Permisos de Operador</h4>
            <p className="text-xs text-[var(--text-muted)] -mt-1 mb-3">
                Selecciona los módulos y acciones a los que este operador tendrá acceso.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {operatorPermissionItems.map((item) => (
                    <label key={item.key} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-secondary)] bg-[var(--background-muted)] cursor-pointer hover:bg-[var(--background-hover)] transition-colors">
                        <input 
                            type="checkbox" 
                            checked={permissions[item.key] || false} 
                            onChange={() => handleToggle(item.key)}
                            className="w-4 h-4 rounded border-[var(--border-secondary)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                        />
                        <span className="text-sm text-[var(--text-primary)] font-medium">{item.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

export default OperatorPermissionsForm;
