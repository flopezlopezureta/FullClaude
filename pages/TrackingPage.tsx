import React, { useState, useEffect } from 'react';
import TrackingMap from '../components/TrackingMap';

interface TrackingHistory {
  status: string;
  location: string;
  details: string;
  timestamp: string;
}

interface Package {
  id: string;
  status: string;
  recipientName: string;
  recipientAddress: string;
  recipientCommune: string;
  recipientCity: string;
  estimatedDelivery: string;
  updatedAt: string;
  history: TrackingHistory[];
  destLatitude?: number | null;
  destLongitude?: number | null;
  driverLatitude?: number | null;
  driverLongitude?: number | null;
  driverLastUpdate?: string | null;
}

const TrackingPage: React.FC = () => {
  const [trackingId, setTrackingId] = useState('');
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-track if ID is in URL
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/track\/(.+)/);
    if (match && match[1]) {
      const id = match[1];
      setTrackingId(id);
      handleTrack(id);
    }
  }, []);

  // Polling for driver location if in transit
  useEffect(() => {
    let interval: any;
    if (pkg && pkg.status === 'EN_TRANSITO') {
      interval = setInterval(() => {
        handleTrack(pkg.id);
      }, 30000); // Poll every 30 seconds
    }
    return () => clearInterval(interval);
  }, [pkg?.status, pkg?.id]);

  const handleTrack = async (id: string = trackingId) => {
    if (!id) return;
    setLoading(true);
    setError('');
    setPkg(null);

    try {
      const response = await fetch(`/api/packages/public/track/${id}`);
      if (response.status === 403) {
        const data = await response.json();
        throw new Error(data.message || 'El seguimiento público está desactivado.');
      }
      if (!response.ok) {
        throw new Error('No se encontró información para este código de seguimiento.');
      }
      const data = await response.json();
      setPkg(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDIENTE': return 'bg-yellow-100 text-yellow-800';
      case 'RETIRADO': return 'bg-blue-100 text-blue-800';
      case 'EN_TRANSITO': return 'bg-indigo-100 text-indigo-800';
      case 'ENTREGADO': return 'bg-green-100 text-green-800';
      case 'PROBLEMA': return 'bg-red-100 text-red-800';
      case 'DEVUELTO': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Seguimiento de Pedido
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ingresa tu código de seguimiento para ver el estado de tu paquete.
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Código de seguimiento (ej: ML-12345)"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTrack()}
              />
            </div>
          </div>

          <div>
            <button
              onClick={() => handleTrack()}
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Buscando...' : 'Consultar'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mt-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {pkg && (
          <div className="space-y-6 mt-8">
            {/* Informative Note */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md shadow-sm">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800 leading-relaxed">
                    Recuerde que el conductor tiene varios envíos por entregar en su ruta y el tiempo de entrega de su paquete puede variar por factores como el tránsito y orden de entrega. Si usted recibe este link, su paquete ya está en camino y pronto llegará, esté atento.
                  </p>
                </div>
              </div>
            </div>

            {/* Map Section */}
            {(pkg.destLatitude || (pkg.status === 'EN_TRANSITO' && pkg.driverLatitude)) ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-indigo-500"></span>
                    Ubicación en Tiempo Real
                  </h3>
                  {pkg.status === 'EN_TRANSITO' && pkg.driverLastUpdate && (
                    <p className="mt-1 text-xs text-gray-500">
                      Última actualización: {new Date(pkg.driverLastUpdate).toLocaleTimeString('es-CL')}
                    </p>
                  )}
                </div>
                <div className="p-4">
                  <TrackingMap 
                    destLat={pkg.destLatitude || null} 
                    destLng={pkg.destLongitude || null} 
                    driverLat={pkg.driverLatitude} 
                    driverLng={pkg.driverLongitude} 
                    status={pkg.status} 
                  />
                </div>
              </div>
            ) : pkg.status === 'EN_TRANSITO' && (
              <div className="bg-white shadow sm:rounded-lg p-6 text-center">
                <p className="text-gray-500 italic">La ubicación en tiempo real no está disponible en este momento.</p>
              </div>
            )}

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Detalles del Paquete
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  ID: {pkg.id}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(pkg.status)}`}>
                {pkg.status}
              </span>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
              <dl className="sm:divide-y sm:divide-gray-200">
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Destinatario</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{pkg.recipientName}</dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Dirección</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {pkg.recipientAddress}, {pkg.recipientCommune}, {pkg.recipientCity}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Entrega Estimada</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {new Date(pkg.estimatedDelivery).toLocaleDateString('es-CL')}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="px-4 py-5 sm:px-6 border-t border-gray-200">
              <h4 className="text-md font-medium text-gray-900 mb-4">Historial de Seguimiento</h4>
              <div className="flow-root">
                <ul className="-mb-8">
                  {pkg.history.map((event, idx) => (
                    <li key={idx}>
                      <div className="relative pb-8">
                        {idx !== pkg.history.length - 1 && (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${idx === 0 ? 'bg-indigo-500' : 'bg-gray-400'}`}>
                              <div className="h-2.5 w-2.5 rounded-full bg-white"></div>
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                <span className="font-medium text-gray-900">{event.status}</span> - {event.details}
                              </p>
                              <p className="text-xs text-gray-400">{event.location}</p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              <time dateTime={event.timestamp}>
                                {new Date(event.timestamp).toLocaleString('es-CL', { 
                                  day: '2-digit', 
                                  month: '2-digit', 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};

export default TrackingPage;
