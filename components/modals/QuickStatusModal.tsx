
import React, { useState } from 'react';
import { api } from '../../services/api';
import { Package } from '../../types';
import { IconX, IconSearch, IconPackage, IconCheckCircle, IconClock, IconAlertTriangle, IconTruck, IconCornerUpLeft, IconXCircle, IconRefresh, IconMercadoLibre } from '../Icon';
import { PackageStatus } from '../../constants';

interface QuickStatusModalProps {
  onClose: () => void;
  onViewDetails: (pkg: Package) => void;
}

const QuickStatusModal: React.FC<QuickStatusModalProps> = ({ onClose, onViewDetails }) => {
  const [searchId, setSearchId] = useState('');
  const [result, setResult] = useState<Package | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchId.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // We use the existing packages search but with a specific limit of 1
      const response = await api.getPackages({ searchQuery: searchId.trim(), limit: 1 });
      if (response.packages && response.packages.length > 0) {
        setResult(response.packages[0]);
      } else {
        setError('No se encontró ningún paquete con ese ID en nuestro sistema.');
      }
    } catch (err: any) {
      setError('Error al buscar el paquete.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncMeli = async () => {
    if (!searchId.trim()) return;
    setIsSyncing(true);
    setError(null);
    try {
      // Try to sync this specific ID from Mercado Libre
      const syncResult = await api.syncMeliPackage(searchId.trim());
      if (syncResult && syncResult.id) {
        // If sync successful, it returns the package
        setResult(syncResult);
      } else {
        setError('No se pudo sincronizar desde Mercado Libre. Verifique que el ID sea correcto y corresponda a una venta Flex.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al sincronizar con Mercado Libre.');
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = (status: PackageStatus) => {
    switch (status) {
      case PackageStatus.Delivered: return <IconCheckCircle className="w-8 h-8 text-green-500" />;
      case PackageStatus.InTransit: return <IconTruck className="w-8 h-8 text-blue-500" />;
      case PackageStatus.Pending: return <IconClock className="w-8 h-8 text-yellow-500" />;
      case PackageStatus.Problem: return <IconAlertTriangle className="w-8 h-8 text-red-500" />;
      case PackageStatus.Returned: return <IconCornerUpLeft className="w-8 h-8 text-purple-500" />;
      case PackageStatus.Cancelled: return <IconXCircle className="w-8 h-8 text-gray-500" />;
      default: return <IconPackage className="w-8 h-8 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: PackageStatus) => {
    switch (status) {
      case PackageStatus.Pending: return 'Pendiente';
      case PackageStatus.PickedUp: return 'Retirado';
      case PackageStatus.InTransit: return 'En Tránsito';
      case PackageStatus.Delivered: return 'Entregado';
      case PackageStatus.Delayed: return 'Retrasado';
      case PackageStatus.Problem: return 'Problema';
      case PackageStatus.ReturnPending: return 'Pendiente de Devolución';
      case PackageStatus.Returned: return 'Devuelto';
      case PackageStatus.Cancelled: return 'Cancelado';
      case PackageStatus.Rescheduled: return 'Reprogramado';
      default: return status;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-[var(--background-primary)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-[var(--border-primary)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)] bg-[var(--background-secondary)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <IconSearch className="w-5 h-5 text-[var(--brand-primary)]" />
            Consultar Estado Flex
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--background-hover)] transition-colors">
            <IconX className="w-6 h-6 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSearch} className="mb-6">
            <label htmlFor="quick-search-id" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              ID de Envío / Orden ML
            </label>
            <div className="flex gap-2">
              <input
                id="quick-search-id"
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Ej: 2000015676219900"
                className="flex-1 px-4 py-2 border border-[var(--border-secondary)] rounded-lg bg-[var(--background-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand-primary)] outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading || !searchId.trim()}
                className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-secondary)] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isLoading ? <IconRefresh className="w-5 h-5 animate-spin" /> : <IconSearch className="w-5 h-5" />}
                Buscar
              </button>
            </div>
          </form>

          {isLoading && (
            <div className="flex flex-col items-center py-8">
              <IconRefresh className="w-10 h-10 text-[var(--brand-primary)] animate-spin mb-4" />
              <p className="text-[var(--text-secondary)]">Buscando en el sistema...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg mb-4">
              <div className="flex items-start gap-3">
                <IconAlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                  {searchId.length > 10 && (
                    <button
                      onClick={handleSyncMeli}
                      disabled={isSyncing}
                      className="mt-3 text-xs font-bold text-red-700 underline flex items-center gap-1 hover:text-red-900"
                    >
                      {isSyncing ? <IconRefresh className="w-3 h-3 animate-spin" /> : <IconRefresh className="w-3 h-3" />}
                      Intentar sincronizar desde Mercado Libre
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {result && !isLoading && (
            <div className="bg-[var(--background-secondary)] border border-[var(--border-primary)] rounded-xl p-6 text-center animate-fade-in">
              <div className="flex justify-center mb-4">
                {getStatusIcon(result.status)}
              </div>
              <h4 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                {getStatusLabel(result.status)}
              </h4>
              <p className="text-sm text-[var(--text-muted)] mb-4 font-mono">
                ID: {result.id}
              </p>

              {result.meliOrderId && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-left">
                    <div className="flex items-center gap-2 mb-2">
                        <IconMercadoLibre className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-bold text-blue-800">Estado Mercado Libre</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-blue-600 block">Status:</span>
                            <span className="font-bold text-blue-900 uppercase">
                                {result.status === PackageStatus.Pending && (result.source as any) === 'MELI' ? 'READY_TO_SHIP' : result.status}
                            </span>
                        </div>
                        {result.meliOrderId && (
                            <button
                                onClick={handleSyncMeli}
                                disabled={isSyncing}
                                className="ml-auto text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                                <IconRefresh className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                <span className="underline">Sincronizar</span>
                            </button>
                        )}
                    </div>
                    <p className="mt-2 text-[10px] text-blue-500 italic">ID de Venta: {result.meliOrderId}</p>
                </div>
              )}
              
              <div className="space-y-3 text-left border-t border-[var(--border-primary)] pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Destinatario:</span>
                  <span className="font-medium text-[var(--text-primary)]">{result.recipientName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Dirección:</span>
                  <span className="font-medium text-[var(--text-primary)] truncate max-w-[200px]">{result.recipientAddress}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Última actualización:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {new Date(result.updatedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onViewDetails(result)}
                className="mt-6 w-full py-2 bg-[var(--background-primary)] border border-[var(--border-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--background-hover)] transition-colors font-medium shadow-sm"
              >
                Ver Detalle Completo
              </button>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-[var(--background-secondary)] border-t border-[var(--border-primary)] text-center">
            <p className="text-xs text-[var(--text-muted)]">
                Ingrese el ID interno o el código de Mercado Libre para obtener el estado actual.
            </p>
        </div>
      </div>
    </div>
  );
};

export default QuickStatusModal;
