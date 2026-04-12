import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';
import { STORAGE_KEYS } from '../constants';

export const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync(STORAGE_KEYS.USER);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        // Opcionalmente verificar token con el servidor
        const freshUser = await api.getCurrentUser();
        setUser(freshUser);
        await SecureStore.setItemAsync(STORAGE_KEYS.USER, JSON.stringify(freshUser));
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
    <AuthContext.Provider value={{ user, setUser, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
