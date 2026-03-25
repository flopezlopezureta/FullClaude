
import React, { useState } from 'react';
import { IconAlertTriangle, IconX, IconLock } from '../Icon';

interface DoubleKeyConfirmationModalProps {
  title: string;
  message: string;
  confirmText: string;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  requiredPhrase?: string;
}

const DoubleKeyConfirmationModal: React.FC<DoubleKeyConfirmationModalProps> = ({
  title,
  message,
  confirmText,
  onClose,
  onConfirm,
  requiredPhrase = "BORRAR INTEGRACION"
}) => {
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (phrase !== requiredPhrase) {
      setError(`Debes escribir exactamente "${requiredPhrase}"`);
      return;
    }
    if (!password) {
      setError('Debes ingresar tu contraseña de administrador');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onConfirm(password);
    } catch (err: any) {
      setError(err.message || 'Error al procesar la solicitud');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--background-primary)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-red-500/30 animate-in zoom-in-95 duration-200">
        <div className="bg-red-50 p-4 flex items-center justify-between border-b border-red-100">
          <div className="flex items-center gap-3 text-red-600">
            <IconAlertTriangle className="w-6 h-6" />
            <h3 className="text-lg font-black uppercase tracking-tight">{title}</h3>
          </div>
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="text-red-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-100/50"
          >
            <IconX className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-red-50/50 p-4 rounded-xl border border-red-100">
            <p className="text-[var(--text-primary)] font-medium leading-relaxed">
              {message}
            </p>
            <div className="mt-4 flex items-center gap-2 text-red-600 font-black text-xs uppercase tracking-widest">
              <div className="h-1 w-1 rounded-full bg-red-600 animate-pulse" />
              ESTA ACCIÓN ES TOTALMENTE IRREVERSIBLE
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                Frase de confirmación: <span className="text-red-600">"{requiredPhrase}"</span>
              </label>
              <input
                type="text"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border-primary)] bg-[var(--background-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all placeholder:opacity-30 font-medium"
                placeholder={requiredPhrase}
              />
            </div>
            
            <div>
              <label className="block text-xs font-black text-[var(--text-secondary)] mb-2 uppercase tracking-wider flex items-center gap-2">
                <IconLock className="w-3.5 h-3.5" />
                Contraseña de administrador
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border-primary)] bg-[var(--background-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-start gap-2 animate-in slide-in-from-top-1">
              <IconAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>

        <div className="p-6 bg-[var(--background-secondary)] flex gap-3 border-t border-[var(--border-primary)]">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--background-primary)] rounded-xl transition-colors border border-[var(--border-primary)]"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-6 py-3 text-sm font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 uppercase tracking-wider"
          >
            {isLoading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoubleKeyConfirmationModal;
