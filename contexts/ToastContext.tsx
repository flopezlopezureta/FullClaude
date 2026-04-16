import React, { createContext, useState, useContext, useCallback } from 'react';

type ToastType = 'success' | 'error';

interface Toast {
    type: ToastType;
    message: string;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    notification: Toast | null;
    clearNotification: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notification, setNotification] = useState<Toast | null>(null);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setNotification({ type, message });
    }, []);

    const clearNotification = useCallback(() => {
        setNotification(null);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, notification, clearNotification }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
