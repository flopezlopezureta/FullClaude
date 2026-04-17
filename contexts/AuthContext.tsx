import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { MessagingPlan, PickupMode, LabelFormat } from '../constants';
import type { User, SystemSettings } from '../types';
import { api, LoginCredentials, RegisterData } from '../services/api';

const VAPID_PUBLIC_KEY = 'BElz_7y329pI3y-nJv4vQ22f0yq2fJOVAHP3yqg2K42j2Q3hQ4w9w8jX7JU8y8F8cE8d7j_8H4Jz3VpXqGfA2Bc';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isInitialized: boolean;
  systemSettings: SystemSettings;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => void;
  register: (data: RegisterData) => Promise<User>;
  updateSystemSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  refetchUser: () => Promise<void>;
  isPushSubscribed: boolean;
  isPushLoading: boolean;
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    companyName: 'Sistema de Seguimiento',
    isAppEnabled: true,
    requiredPhotos: 1,
    messagingPlan: MessagingPlan.None,
    pickupMode: PickupMode.Scan,
    meliFlexValidation: true,
    saveFlexLabelPhoto: false,
    meliAutoImport: false,
    shopifyAutoImport: false,
    publicTrackingEnabled: true,
    isRutRequired: true,
    labelFormat: LabelFormat.CompactThermal,
    circuitExportEnabled: false,
  });
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      // If we literally just logged in (user and token set), we don't need to re-fetch yet.
      // This prevents a redundant call that, if it fails due to transient network issues, kicks the user out.
      if (user && token && isInitialized) {
        console.log("[Auth] Already have user session, skipping re-initialization re-fetch.");
        return;
      }

      console.log("[Auth] Initializing session...");
      try {
        // 1. Core Profile fetch (needs token)
        if (token) {
          try {
            const fetchedUser = await api.getUserByToken();
            setUser(fetchedUser);
          } catch (userErr: any) {
            console.error("[Auth] Failed to fetch user profile:", userErr);
            // ONLY logout if the error is an authentication error (401 or 403)
            // or if the user is explicitly reported as not found/inactive.
            const statusCode = userErr.status;
            const errorMsg = String(userErr.message || "");
            
            if (statusCode === 401 || statusCode === 403 || errorMsg.includes("autorización denegada")) {
              console.warn("[Auth] Invalid session detected. Clearing credentials.");
              localStorage.removeItem('token');
              setToken(null);
              setUser(null);
            }
          }
        }

        // 2. Systems Settings fetch (non-blocking for auth)
        try {
          const settings = await api.getSystemSettings();
          setSystemSettings(settings);
        } catch (settingsErr) {
          console.error("[Auth] Failed to fetch system settings. Using fallbacks.", settingsErr);
          // Don't log out here! The app can run with fallback settings.
        }

      } catch (globalErr) {
        console.error("[Auth] Fatal initialization error:", globalErr);
      } finally {
        setIsInitialized(true);
      }
    };

    // Avoid running if we are already initialized and have a user (prevents logout loops)
    if (!isInitialized || (token && !user)) {
      initializeAuth();
    } else {
      setIsInitialized(true);
    }
  }, [token]);

  useEffect(() => {
    if (systemSettings.companyName) {
      document.title = systemSettings.companyName;
    }
  }, [systemSettings.companyName]);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.getSubscription().then(subscription => {
                setIsPushSubscribed(!!subscription);
                setIsPushLoading(false);
            });
        });
    } else {
        console.warn('Push notifications are not supported in this browser.');
        setIsPushLoading(false);
    }
  }, []);
  
  const refetchUser = async () => {
      if (token) {
           const fetchedUser = await api.getUserByToken();
           setUser(fetchedUser);
      }
  };

  const login = async (credentials: LoginCredentials) => {
    const { token: newToken, user: loggedInUser } = await api.login(credentials);
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const register = async (data: RegisterData) => {
    const newUser = await api.register(data);
    return newUser;
  };

  const updateSystemSettings = async (newSettings: Partial<SystemSettings>) => {
    const updatedSettingsData = await api.updateSystemSettings(newSettings);
    setSystemSettings(prev => ({...prev, ...updatedSettingsData}));
  };

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) return;
    
    setIsPushLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
         throw new Error('Notification permission not granted.');
      }
      const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource
      });
      await api.savePushSubscription(subscription);
      setIsPushSubscribed(true);
    } catch (error) {
      console.error('Error subscribing to push notifications', error);
    } finally {
      setIsPushLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) return;

    setIsPushLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const subscriptionJson = subscription.toJSON();
        const successful = await subscription.unsubscribe();
        if (successful) {
          await api.deletePushSubscription(subscriptionJson);
          setIsPushSubscribed(false);
        }
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications', error);
    } finally {
      setIsPushLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isInitialized, systemSettings, login, logout, register, updateSystemSettings, refetchUser, isPushSubscribed, isPushLoading, subscribeToPush, unsubscribeFromPush }}>
      {children}
    </AuthContext.Provider>
  );
};