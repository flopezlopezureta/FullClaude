import React, { useContext, useEffect } from 'react';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
import TrackingPage from './pages/TrackingPage';
import DashboardLayout from './components/layout/DashboardLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage';

const AppContent: React.FC = () => {
  const auth = useContext(AuthContext);
  const [isLoginView, setIsLoginView] = React.useState(window.location.pathname === '/login');

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
    const handlePopState = () => {
      setIsLoginView(window.location.pathname === '/login');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  const isTrackingRoute = window.location.pathname.startsWith('/track');
  if (isTrackingRoute) {
    return <TrackingPage />;
  }

  if (!auth.user) {
    if (isLoginView) {
      return <AuthPage onBack={() => {
        window.history.pushState({}, '', '/');
        setIsLoginView(false);
      }} />;
    }
    return <LandingPage onLogin={() => {
      window.history.pushState({}, '', '/login');
      setIsLoginView(true);
    }} />;
  }

  return <DashboardLayout />;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;