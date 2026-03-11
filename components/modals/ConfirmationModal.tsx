

import React from 'react';
import { IconX, IconAlertTriangle } from '../Icon';

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmText?: string;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ title, message, confirmText = 'Confirmar', onClose, onConfirm }) => {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background-secondary)] rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-[var(--error-bg)] sm:mx-0 sm:h-10 sm:w-10">
              <IconAlertTriangle className="h-6 w-6 text-[var(--error-text)]" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 className="text-lg leading-6 font-medium text-[var(--text-primary)]">{title}</h3>
              <div className="mt-2">
                <p className="text-sm text-[var(--text-secondary)]">{message}</p>
              </div>
            </div>
          </div>
        </div>

        <footer className="px-6 py-4 bg-[var(--background-muted)] rounded-b-xl flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full inline-flex justify-center rounded-md border border-[var(--border-secondary)] shadow-sm px-4 py-2 bg-[var(--background-secondary)] text-base font-medium text-[var(--text-secondary)] hover:bg-[var(--background-hover)] focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:w-auto sm:text-sm"
          >
            {confirmText}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ConfirmationModal;
