
import React, { useState } from 'react';
import { IconX, IconAlertTriangle } from '../Icon';

interface DeleteDatabaseModalProps {
  onClose: () => void;
  onConfirm: (password: string) => void;
}

const DeleteDatabaseModal: React.FC<DeleteDatabaseModalProps> = ({ onClose, onConfirm }) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [password, setPassword] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const correctConfirmationText = 'BORRAR TODO';
  const masterPassword = 'adminborrar';

  const isFormValid = confirmationText === correctConfirmationText && password === masterPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
        setIsConfirming(true);
        onConfirm(password);
    }
  };

  const inputClasses = "w-full px-3 py-2 font-mono border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 bg-[var(--background-secondary)]";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <h3 className="text-lg font-bold text-red-600">Limpieza de Sistema</h3>
          <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="flex items-start p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-md">
                <IconAlertTriangle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0"/>
                <div>
                    <h4 className="font-bold text-red-800 dark:text-red-200">¡Acción Irreversible!</h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        Se eliminarán permanentemente: Paquetes, Historiales, Zonas, Facturas y Clientes.
                        <br/><br/>
                        <strong>Se conservarán:</strong> Administradores, Conductores y Configuración del Sistema.
                    </p>
                </div>
            </div>
            
            <div>
              <label htmlFor="confirmation-text" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Escribe <span className="font-bold text-red-600">{correctConfirmationText}</span> para confirmar.
              </label>
              <input
                type="text"
                id="confirmation-text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                required
                className={`${inputClasses} focus:ring-red-500`}
                autoComplete="off"
              />
            </div>
            
             <div>
              <label htmlFor="master-password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Ingresa la contraseña maestra de borrado.
              </label>
              <input
                type="password"
                id="master-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${inputClasses} focus:ring-red-500`}
                autoComplete="new-password"
              />
            </div>

          </div>

          <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end">
            <button 
                type="submit" 
                disabled={!isFormValid || isConfirming} 
                className="w-full px-4 py-3 text-sm font-bold text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
            >
              {isConfirming ? 'Procesando...' : 'Confirmar Limpieza'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default DeleteDatabaseModal;
