import React, { useState, useEffect, useMemo, ReactNode } from 'react';
import type { Package, User } from '../../types';
import { PackageStatus } from '../../constants';
import { api } from '../../services/api';
import { IconX, IconUser, IconChecklist, IconRoute, IconClock, IconUserCheck, IconAlertTriangle } from '../Icon';

const StatusBadge: React.FC<{ status: PackageStatus }> = ({ status }) => {
  const statusSlug = status.toLowerCase();
  const badgeClass = `bg-[var(--status-${statusSlug}-bg)] text-[var(--status-${statusSlug}-text)]`;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
      {status}
    </span>
  );
}

const KpiCard: React.FC<{ icon: ReactNode, title: string, value: string | number, subtext?: string }> = ({ icon, title, value, subtext }) => (
    <div className="bg-[var(--background-muted)] rounded-lg p-4 flex items-center">
        <div className="flex-shrink-0 bg-[var(--background-secondary)] p-3 rounded-full shadow-sm">
            {icon}
        </div>
        <div className="ml-4">
            <p className="text-sm font-medium text-[var(--text-muted)]">{title}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            {subtext && <p className="text-xs text-[var(--text-muted)] opacity-70">{subtext}</p>}
        </div>
    </div>
);


const DriverHistoryModal: React.FC<{ user: User, onClose: () => void }> = ({ user, onClose }) => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPackages = async () => {
      setIsLoading(true);
      try {
        const { packages: allPackages } = await api.getPackages({ driverFilter: user.id, limit: 0 });
        const driverPackages = allPackages
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setPackages(driverPackages);
      } catch (error) {
        console.error("Failed to fetch packages for driver", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPackages();
  }, [user.id]);

  const driverStats = useMemo(() => {
    const deliveredPackages = packages.filter(p => p.status === PackageStatus.Delivered);
    const totalDelivered = deliveredPackages.length;

    let onTimeCount = 0;
    let totalDeliveryMillis = 0;

    deliveredPackages.forEach(pkg => {
      const deliveredEvent = pkg.history.find(e => e.status === PackageStatus.Delivered);
      if (deliveredEvent) {
        if (new Date(deliveredEvent.timestamp) <= new Date(pkg.estimatedDelivery)) {
          onTimeCount++;
        }
        
        const creationEvent = pkg.history.find(e => e.status === 'Creado') || pkg.history[pkg.history.length - 1];
        if (creationEvent) {
            totalDeliveryMillis += new Date(deliveredEvent.timestamp).getTime() - new Date(creationEvent.timestamp).getTime();
        }
      }
    });
    
    const onTimeRate = totalDelivered > 0 ? ((onTimeCount / totalDelivered) * 100).toFixed(0) : 0;
    
    let avgDeliveryHours = 0;
    if (totalDelivered > 0) {
        avgDeliveryHours = Math.round(totalDeliveryMillis / totalDelivered / (1000 * 60 * 60));
    }

    return { totalDelivered, onTimeRate, avgDeliveryHours };
  }, [packages]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between p-6 border-b border-[var(--border-primary)]">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-4">
                <IconUser className="h-16 w-16 p-3 bg-[var(--background-muted)] text-[var(--text-muted)] rounded-full" />
            </div>
            <div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)]">{user.name}</h3>
                <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
                {user.status === 'APROBADO' ? (
                  <div className="flex items-center text-green-600 text-sm mt-1 font-medium">
                    <IconUserCheck className="w-4 h-4 mr-1.5"/>
                    <span>Aprobado</span>
                  </div>
                ) : (
                  <div className="flex items-center text-yellow-600 text-sm mt-1 font-medium">
                    <IconAlertTriangle className="w-4 h-4 mr-1.5"/>
                    <span>Pendiente de Aprobación</span>
                  </div>
                )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Cerrar modal"
          >
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6 bg-[var(--background-primary)]/70">
            <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-3">Métricas de Rendimiento</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard icon={<IconChecklist className="w-6 h-6 text-blue-600"/>} title="Paquetes Entregados" value={driverStats.totalDelivered} />
                <KpiCard icon={<IconClock className="w-6 h-6 text-green-600"/>} title="Entregas a Tiempo" value={`${driverStats.onTimeRate}%`} />
                <KpiCard icon={<IconRoute className="w-6 h-6 text-purple-600"/>} title="Tiempo Promedio" value={`${driverStats.avgDeliveryHours}h`} subtext="Creación a entrega" />
            </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
             <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-3">Historial de Paquetes Asignados</h4>
             <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
                <div className="divide-y divide-[var(--border-primary)]">
                {isLoading ? (
                    <p className="p-6 text-center text-[var(--text-muted)]">Cargando historial...</p>
                ) : packages.length > 0 ? (
                    packages.map(pkg => (
                        <div key={pkg.id} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-[var(--background-hover)]">
                            <div className="col-span-12 sm:col-span-3">
                                <p className="font-bold text-[var(--text-primary)]">{pkg.id}</p>
                                <p className="text-sm text-[var(--text-muted)]">{pkg.recipientName}</p>
                            </div>
                            <div className="col-span-6 sm:col-span-4">
                                <p className="text-sm text-[var(--text-secondary)]">{pkg.origin} → {pkg.destination}</p>
                            </div>
                            <div className="col-span-6 sm:col-span-2">
                                <StatusBadge status={pkg.status} />
                            </div>
                             <div className="col-span-12 sm:col-span-3 text-sm text-[var(--text-muted)]">
                                {pkg.status === PackageStatus.Delivered 
                                    ? `Entregado: ${new Date(pkg.history[0].timestamp).toLocaleDateString('es-ES')}`
                                    : `Estimado: ${new Date(pkg.estimatedDelivery).toLocaleDateString('es-ES')}`
                                }
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="p-6 text-center text-[var(--text-muted)]">Este conductor no tiene paquetes asignados.</p>
                )}
                </div>
             </div>
        </div>

      </div>
    </div>
  );
};

export default DriverHistoryModal;