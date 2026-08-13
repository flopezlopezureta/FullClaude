import React, { useContext, useEffect } from 'react';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
import TrackingPage from './pages/TrackingPage';
import DashboardLayout from './components/layout/DashboardLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage';

const AppContent: React.FC = () => {
  const auth = useContext(AuthContext);

  useEffect(() => {
    // Reverted 2026-08-13: removing this (to let the offline-shell Service Worker actually stay
    // registered) caused a worse regression on fresh/cleared installs inside the Android WebView
    // wrapper specifically — sometimes nothing rendered at all behind the permission dialogs,
    // reproducible even with normal connectivity and a fully cleared app. Restored to the known-
    // stable behavior (always loads, just doesn't support a zero-connectivity cold start) until
    // the SW/WebView interaction can be diagnosed properly on a real device, not blind.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister()
            .then(unregistered => {
              if (unregistered) console.log('Service Worker unregistered successfully.');
            });
        }
      }).catch(function(err) {
        console.log('Service Worker unregistration failed: ', err);
      });
    }
  }, []); // Run only once on component mount

  useEffect(() => {
    if (auth?.systemSettings.companyName) {
      document.title = `${auth.systemSettings.companyName} - Sistema de Seguimiento`;
    }
  }, [auth?.systemSettings.companyName]);

  if (!auth || !auth.isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl font-bold text-slate-400 tracking-tight uppercase">Full Envios</div>
        </div>
      </div>
    );
  }

  const isTrackingRoute = window.location.pathname.startsWith('/track');
  if (isTrackingRoute) {
    return <TrackingPage />;
  }

  if (!auth.user) {
    return <AuthPage />;
  }

  const isDev = auth.systemSettings.appEnv === 'development';

  return (
    <>
      {isDev && (
        <div className="bg-yellow-500 text-white text-center py-1 text-xs font-bold uppercase tracking-widest sticky top-0 z-[9999] shadow-sm animate-pulse">
          ⚠️ Ambiente de Desarrollo - Las pruebas no afectan a Producción ⚠️
        </div>
      )}
      <DashboardLayout />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;