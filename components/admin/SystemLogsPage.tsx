
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { IconHistory, IconSearch, IconFilter } from '../Icon';

interface SystemLog {
  id: number;
  userId: string;
  userName: string;
  action: string;
  details: any;
  timestamp: string;
}

const SystemLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getSystemLogs();
      setLogs(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Error al cargar los logs del sistema.');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = (logs || []).filter(log => {
    if (!log) return false;
    
    const userName = log.userName || '';
    const action = log.action || '';
    const detailsStr = log.details ? JSON.stringify(log.details) : '';

    const matchesSearch = 
      userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      detailsStr.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === '' || action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set((logs || []).map(log => log?.action).filter(Boolean)));

  const formatDetails = (details: any) => {
    if (typeof details === 'string') return details;
    try {
      return JSON.stringify(details, null, 2);
    } catch (e) {
      return String(details);
    }
  };

  return (
    <div className="bg-[var(--background-secondary)] rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <IconHistory className="w-6 h-6 text-[var(--brand-primary)] mr-2" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Logs del Sistema</h2>
        </div>
        <button 
          onClick={fetchLogs}
          className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-md hover:bg-[var(--brand-hover)] transition-colors text-sm font-medium"
        >
          Actualizar
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por usuario, acción o detalles..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--background-primary)] border border-[var(--border-primary)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64 relative">
          <IconFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
          <select
            className="w-full pl-10 pr-4 py-2 bg-[var(--background-primary)] border border-[var(--border-primary)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] appearance-none"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">Todas las acciones</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border-primary)]">
            <thead className="bg-[var(--background-primary)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Fecha/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Acción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Detalles</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--background-secondary)] divide-y divide-[var(--border-primary)]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-[var(--text-muted)]">
                    No se encontraron logs que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--background-hover)] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text-primary)]">
                      {log.userName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        log.action.includes('DELETE') ? 'bg-red-100 text-red-800' :
                        log.action.includes('CREATE') ? 'bg-green-100 text-green-800' :
                        log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-secondary)] max-w-md">
                      <pre className="text-xs overflow-auto max-h-24 bg-[var(--background-primary)] p-2 rounded border border-[var(--border-primary)]">
                        {formatDetails(log.details)}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SystemLogsPage;
