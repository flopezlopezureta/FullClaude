
import React, { useContext, useEffect } from 'react';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
import DashboardLayout from './components/layout/DashboardLayout';
import { ThemeProvider } from './contexts/ThemeContext';

const AppContent: React.FC = () => {
  const auth = useContext(AuthContext);

  useEffect(() => {
    // Aggressively unregister any service workers to prevent caching issues.
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
      <div className="flex items-center justify-center h-screen bg-[var(--background-muted)]">
        <div className="text-xl font-semibold text-[var(--text-secondary)]">Cargando...</div>
      </div>
    );
  }

  if (!auth.user) {
    return <AuthPage />;
  }

  return <DashboardLayout />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;