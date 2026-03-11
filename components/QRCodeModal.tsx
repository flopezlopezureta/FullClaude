
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { IconX, IconQrcode } from './Icon';

interface QRCodeModalProps {
  value: string;
  title: string;
  onClose: () => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ value, title, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 p-4 animate-fade-in">
      <div className="bg-[var(--background-secondary)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        <div className="p-4 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--background-muted)]">
          <div className="flex items-center gap-2">
            <IconQrcode className="w-5 h-5 text-[var(--brand-primary)]" />
            <h3 className="font-bold text-[var(--text-primary)]">Código FLEX</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--background-hover)] text-[var(--text-muted)] transition-colors"
          >
            <IconX className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-8 flex flex-col items-center justify-center bg-white">
          <div className="p-4 bg-white rounded-xl shadow-inner border border-gray-100">
            <QRCodeSVG 
              value={value} 
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>
          <p className="mt-6 text-lg font-mono font-bold text-gray-800 tracking-wider">
            {value}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {title}
          </p>
        </div>
        
        <div className="p-4 bg-[var(--background-muted)] border-t border-[var(--border-primary)]">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:bg-[var(--brand-secondary)] transition-colors shadow-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
