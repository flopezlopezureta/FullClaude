

import React, { useState } from 'react';
import { PackageStatus, ShippingType } from '../../constants';
import type { Package, User } from '../../types';
import { IconX, IconCalendar, IconMapPin, IconPhone, IconWhatsapp, IconAlertTriangle, IconCheckCircle, IconSun, IconZap, IconMoon, IconPrinter, IconQrcode, IconChevronLeft, IconCamera, IconTruck, IconId, IconArrowUturnLeft } from '../Icon';
import QRCodeModal from '../client/QRCodeModal';

interface PackageDetailModalProps {
  pkg: Package;
  onClose: () => void;
  driver?: User;
  onStartDelivery?: (pkg: Package) => void;
  onReportProblem?: (pkg: Package) => void;
  onPrintLabel?: (pkg: Package) => void;
  isFullScreen?: boolean;
  companyName?: string;
  creatorForReturn?: User;
  onStartReturn?: (pkg: Package) => void;
  creator?: User | null;
}

const PackageDetailModal: React.FC<PackageDetailModalProps> = ({ pkg, onClose, driver, onStartDelivery, onReportProblem, onStartReturn, onPrintLabel, isFullScreen = false, companyName = "FULL ENVIOS", creatorForReturn, creator }) => {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const isReturn = pkg.status === PackageStatus.ReturnPending && !!onStartReturn;

  const estimatedDelivery = new Date(pkg.estimatedDelivery).toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  
  const canInteract = onStartDelivery && onReportProblem && !isReturn;
  const canReturnInteract = onStartReturn && isReturn;

  const recipientPhoneForNotif = isReturn ? creatorForReturn?.phone : pkg.recipientPhone;
  const enRouteMessage = isReturn
    ? `Hola ${creatorForReturn?.name}, soy el repartidor de ${companyName}. Voy en camino a devolver el paquete con ID ${pkg.id}. ¡Nos vemos pronto!`
    : `Hola, soy el repartidor de ${companyName}. Voy en camino a entregar tu paquete con ID ${pkg.id}. ¡Nos vemos pronto!`;
  const whatsappEnRouteUrl = `https://wa.me/${String(recipientPhoneForNotif).replace(/\D/g, '')}?text=${encodeURIComponent(enRouteMessage)}`;


  const shippingTypeConfig: { [key in ShippingType]: { icon: React.ReactNode; text: string } } = {
    [ShippingType.SameDay]: { icon: <IconSun className="w-5 h-5 mt-0.5 mr-2 text-[var(--text-muted)] flex-shrink-0" />, text: 'Envío en el Día' },
    [ShippingType.Express]: { icon: <IconZap className="w-5 h-5 mt-0.5 mr-2 text-[var(--text-muted)] flex-shrink-0" />, text: 'Envío Express' },
    [ShippingType.NextDay]: { icon: <IconMoon className="w-5 h-5 mt-0.5 mr-2 text-[var(--text-muted)] flex-shrink-0" />, text: 'Envío Next Day' },
  };
  const typeConfig = shippingTypeConfig[pkg.shippingType] || { icon: null, text: pkg.shippingType };

  const modalClasses = isFullScreen 
    ? 'bg-[var(--background-primary)] h-full w-full' 
    : 'bg-[var(--background-secondary)] rounded-xl max-w-2xl max-h-[90vh] animate-fade-in-up';

  const mainContainerClasses = isFullScreen
    ? 'bg-[var(--background-primary)]'
    : 'bg-black bg-opacity-60 flex justify-center items-center p-4';
    
  const streetAddress = isReturn ? (creatorForReturn?.pickupAddress || pkg.origin)?.split(',')[0].trim() : pkg.recipientAddress.split(',')[0].trim();
  const recipientNameForDisplay = isReturn ? creatorForReturn?.name : pkg.recipientName;
  const recipientPhoneForDisplay = isReturn ? creatorForReturn?.phone : pkg.recipientPhone;
  const recipientCommuneForDisplay = isReturn ? creatorForReturn?.address?.split(',').pop()?.trim() : pkg.recipientCommune;
  
  const problemEvent = pkg.status === PackageStatus.Problem 
    ? pkg.history.find(event => event.status === PackageStatus.Problem)
    : null;

  return (
    <>
      <div
        className={`fixed inset-0 z-50 ${mainContainerClasses}`}
        onClick={!isFullScreen ? onClose : undefined}
      >
        <div
          className={`shadow-2xl flex flex-col ${modalClasses}`}
          onClick={(e) => e.stopPropagation()}
        >
          <header className={`flex items-center justify-between p-4 flex-shrink-0 ${isFullScreen ? 'bg-[var(--background-primary)]' : 'border-b border-[var(--border-primary)]'}`}>
             {isFullScreen && (
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]"
                    aria-label="Volver"
                >
                    <IconChevronLeft className="w-6 h-6" />
                </button>
             )}
            <h3 className="text-lg font-bold text-[var(--brand-primary)] text-center flex-grow">{pkg.id}</h3>
            <div className="flex items-center gap-2">
                {pkg.meliOrderId ? (
                    <button
                        onClick={() => setIsQrModalOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full hover:bg-green-200 transition-colors"
                        aria-label="Pedir Código QR por WhatsApp"
                    >
                        <IconWhatsapp className="w-4 h-4"/>
                        <span>Pedir QR</span>
                    </button>
                ) : (
                    <button
                        onClick={() => setIsQrModalOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full hover:bg-purple-200 transition-colors"
                        aria-label="Mostrar Código QR"
                    >
                        <IconQrcode className="w-4 h-4"/>
                        <span>QR</span>
                    </button>
                )}
                {!isFullScreen && (
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)] hover:text-[var(--text-primary)] transition-colors"
                        aria-label="Cerrar modal"
                    >
                        <IconX className="w-6 h-6" />
                    </button>
                )}
            </div>
          </header>

          <div className="p-4 overflow-y-auto custom-scrollbar space-y-4">
              {/* Recipient Info Card */}
              <div className="bg-[var(--background-secondary)] p-4 rounded-lg shadow-sm border border-[var(--border-primary)]">
                  <div className="flex justify-between items-start mb-3">
                      <h4 className="text-sm font-semibold text-[var(--text-muted)]">{isReturn ? 'Información de Devolución' : 'Información del Destinatario'}</h4>
                       <div className="flex items-center gap-2">
                            {canInteract && (
                                <a href={whatsappEnRouteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-100 rounded-full hover:bg-orange-200 transition-colors" aria-label="Notificar que va en camino">
                                    <IconTruck className="w-4 h-4"/>
                                    <span>En Camino</span>
                                </a>
                            )}
                            {recipientPhoneForDisplay && (
                                <>
                                <a href={`tel:${recipientPhoneForDisplay}`} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors" aria-label="Llamar">
                                    <IconPhone className="w-4 h-4"/>
                                    <span>Llamar</span>
                                </a>
                                <a href={`https://wa.me/${String(recipientPhoneForDisplay).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full hover:bg-green-200 transition-colors" aria-label="Enviar WhatsApp">
                                    <IconWhatsapp className="w-4 h-4"/>
                                    <span>Chat</span>
                                </a>
                                </>
                            )}
                        </div>
                  </div>
                  <p className="font-bold text-[var(--text-primary)] text-lg">{streetAddress}</p>
                  <p className="text-[var(--text-secondary)] text-lg">{recipientNameForDisplay}</p>
                  <div className="mt-2 space-y-0.5 text-sm text-[var(--text-secondary)]">
                      <p><span className="font-medium text-[var(--text-primary)]">Teléfono:</span> {recipientPhoneForDisplay || 'N/A'}</p>
                      <p><span className="font-medium text-[var(--text-primary)]">Comuna:</span> {recipientCommuneForDisplay || 'N/A'}</p>
                      <p><span className="font-medium text-[var(--text-primary)]">Ciudad:</span> {pkg.recipientCity}</p>
                  </div>
              </div>

              {/* Status Card */}
              <div className="bg-[var(--background-secondary)] p-4 rounded-lg shadow-sm border border-[var(--border-primary)]">
                  <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-2">Estado Actual: <span className="text-[var(--brand-primary)] font-bold">{pkg.status.replace('_', ' ')}</span></h4>
                   {problemEvent && (
                    <div className="my-3 p-3 bg-[var(--error-bg)] border-l-4 border-[var(--error-border)] rounded-r-md flex items-start gap-3">
                        <IconAlertTriangle className="w-5 h-5 text-[var(--error-text)] flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-[var(--error-text)]">Motivo del Problema:</p>
                            <p className="text-sm text-[var(--error-text)] opacity-90 mt-1">{problemEvent.details.replace('Problema reportado: ', '')}</p>
                        </div>
                    </div>
                  )}
                  <div className="flex items-start text-[var(--text-secondary)]">
                       <IconCalendar className="w-5 h-5 mt-0.5 mr-2 text-[var(--text-muted)] flex-shrink-0" />
                       <div>
                          <p className="font-medium text-sm">Fecha Objetivo</p>
                          <p className="text-sm">{estimatedDelivery}</p>
                       </div>
                  </div>
                   <div className="flex items-start text-[var(--text-secondary)] mt-3">
                       {typeConfig.icon}
                       <div>
                          <p className="font-medium text-sm">Tipo de Envío Original</p>
                          <p className="text-sm">{typeConfig.text}</p>
                       </div>
                  </div>
              </div>

              {/* Proof of Delivery / Problem Card */}
              {pkg.deliveryPhotosBase64 && pkg.deliveryPhotosBase64.length > 0 && (
                <div className="bg-[var(--background-secondary)] p-4 rounded-lg shadow-sm border border-[var(--border-primary)]">
                    <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-3">
                        {pkg.status === PackageStatus.Delivered ? 'Evidencia de Entrega' : pkg.status === PackageStatus.Returned ? 'Evidencia de Devolución' : 'Evidencia del Problema'}
                    </h4>
                    {(pkg.status === PackageStatus.Delivered || pkg.status === PackageStatus.Returned) && (
                        <div className="p-3 bg-[var(--background-muted)] rounded-md border border-[var(--border-secondary)] space-y-1">
                            <p className="text-sm"><span className="font-semibold text-[var(--text-primary)]">Recibido por:</span> {pkg.deliveryReceiverName}</p>
                            <p className="text-sm"><span className="font-semibold text-[var(--text-primary)]">RUT:</span> {pkg.deliveryReceiverId}</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                        {pkg.deliveryPhotosBase64.map((photo, index) => (
                            <img
                                key={index}
                                src={photo}
                                alt={`Evidencia ${index + 1}`}
                                className="aspect-square w-full rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setViewingPhoto(photo)}
                            />
                        ))}
                    </div>
                </div>
              )}
            
              {/* Delivery Actions Card */}
              {canInteract && onStartDelivery && onReportProblem && (
                <div className="bg-[var(--background-secondary)] p-4 rounded-lg shadow-sm border border-[var(--border-primary)]">
                    <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-3 text-center">Acciones de Entrega</h4>
                    <div className="space-y-3">
                        <button 
                            onClick={() => onStartDelivery(pkg)}
                            className="w-full px-4 py-3 text-base font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            <IconCheckCircle className="w-5 h-5"/>
                            Registrar Entrega
                        </button>
                        <button 
                            onClick={() => onReportProblem(pkg)} 
                            className="w-full px-4 py-2 text-base font-medium text-red-600 bg-[var(--background-secondary)] border border-red-500 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <IconAlertTriangle className="w-4 h-4"/>
                            Reportar un Problema
                        </button>
                    </div>
                </div>
              )}

              {/* Return Actions Card */}
              {canReturnInteract && (
                <div className="bg-[var(--background-secondary)] p-4 rounded-lg shadow-sm border border-[var(--border-primary)]">
                    <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-3 text-center">Acciones de Devolución</h4>
                    <div className="space-y-3">
                        <button 
                            onClick={() => onStartReturn!(pkg)}
                            className="w-full px-4 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            <IconArrowUturnLeft className="w-5 h-5"/>
                            Registrar Devolución
                        </button>
                    </div>
                </div>
              )}


              {/* History Card */}
              {!canInteract && !canReturnInteract && (
                  <div className="bg-[var(--background-secondary)] p-4 rounded-lg shadow-sm border border-[var(--border-primary)]">
                      <h4 className="text-sm font-semibold text-[var(--text-muted)] mb-4">Historial</h4>
                      <div className="relative border-l-2 border-[var(--border-primary)] ml-3">
                      {pkg.history.map((event, index) => (
                          <div key={event.timestamp.toString() + index} className="mb-8 ml-8">
                          <span className={`absolute -left-[11px] flex items-center justify-center w-5 h-5 ${index === 0 ? 'bg-[var(--brand-primary)]' : 'bg-[var(--border-secondary)]'} rounded-full ring-4 ring-[var(--background-secondary)]`}></span>
                          <h5 className="font-semibold text-[var(--text-primary)] text-sm">{event.status.replace('_', ' ')}</h5>
                          <time className="block mb-2 text-xs font-normal leading-none text-[var(--text-muted)]">
                              {new Date(event.timestamp).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}
                          </time>
                          <p className="text-sm text-[var(--text-secondary)] flex items-center"><IconMapPin className="w-4 h-4 mr-2 text-[var(--text-muted)]" /> {event.location}</p>
                          </div>
                      ))}
                      </div>
                  </div>
              )}
          </div>
        </div>
        <style>{`
          @keyframes fade-in-up {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
              animation: fade-in-up 0.3s ease-out forwards;
          }
        `}</style>
      </div>

      {isQrModalOpen && (
        <QRCodeModal pkg={pkg} creator={creator} onClose={() => setIsQrModalOpen(false)} />
      )}

      {viewingPhoto && (
        <div 
            className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 animate-fade-in-up"
            onClick={() => setViewingPhoto(null)}
        >
            <button
                onClick={() => setViewingPhoto(null)}
                className="absolute top-4 right-4 p-2 rounded-full text-white bg-black bg-opacity-50 hover:bg-opacity-75"
                aria-label="Cerrar imagen"
            >
                <IconX className="w-6 h-6" />
            </button>
            <img 
                src={viewingPhoto} 
                alt="Evidencia en tamaño completo" 
                className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
      )}
    </>
  );
};

export default PackageDetailModal;