import React, { useState } from 'react';
import { IconX, IconEye, IconEyeOff, IconAlertTriangle } from '../Icon';

interface DeletePasswordModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

const DeletePasswordModal: React.FC<DeletePasswordModalProps> = ({ onClose, onConfirm }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const correctPassword = 'adminborrar';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === correctPassword) {
      onConfirm();
    } else {
      setError('Contraseña incorrecta.');
      setPassword('');
    }
  };
  
  const inputClasses = "w-full px-3 py-2 font-mono border border-[var(--border-secondary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)] bg-[var(--background-secondary)] text-[var(--text-primary)]";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-sm animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Confirmar Eliminación</h3>
          <button onClick={onClose} className="p-2 rounded-full text-[var(--text-muted)] hover:bg-[var(--background-hover)]" aria-label="Cerrar modal">
            <IconX className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="flex items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-[var(--error-bg)] sm:mx-0">
                    <IconAlertTriangle className="h-6 w-6 text-[var(--error-text)]" />
                </div>
                <div className="mt-1 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <p className="text-sm text-[var(--text-secondary)]">Esta acción es permanente. Para continuar, ingresa la contraseña de administrador.</p>
                </div>
            </div>
            <div>
              <label htmlFor="delete-password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="delete-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  required
                  className={`${inputClasses} pr-10`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    {showPassword ? <IconEyeOff className="h-5 w-5 text-[var(--text-muted)]" /> : <IconEye className="h-5 w-5 text-[var(--text-muted)]" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--background-secondary)] border border-[var(--border-secondary)] rounded-md hover:bg-[var(--background-hover)]">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700">Eliminar</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default DeletePasswordModal;