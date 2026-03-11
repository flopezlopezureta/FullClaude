import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { MessagingPlan, PickupMode } from '../constants';
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
  });
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (token) {
          const fetchedUser = await api.getUserByToken();
          setUser(fetchedUser);
        }
        const settings = await api.getSystemSettings();
        setSystemSettings(settings);
      } catch (error) {
        console.error("Failed to initialize auth:", error);
        // If token is invalid, log out
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setIsInitialized(true);
      }
    };
    initializeAuth();
  }, [token]);

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