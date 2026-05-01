import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setApiBaseUrl } from '../services/api';
import { STORAGE_KEYS } from '../constants';

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const storedServer = await SecureStore.getItemAsync(STORAGE_KEYS.SERVER_URL);
      if (storedServer) {
        setServerUrl(storedServer);
        setApiBaseUrl(storedServer);
      }

      const storedUser = await SecureStore.getItemAsync(STORAGE_KEYS.USER);
      if (storedUser && storedServer) {
        setUser(JSON.parse(storedUser));
        try {
          const freshUser = await api.getCurrentUser();
          setUser(freshUser);
          await SecureStore.setItemAsync(STORAGE_KEYS.USER, JSON.stringify(freshUser));
        } catch (e) {
          console.log("Session expired or server unreachable");
        }
      }
    } catch (e) {
      console.log("Error loading stored auth", e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: any) => {
    const data = await api.login(credentials);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, serverUrl, setServerUrl, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
