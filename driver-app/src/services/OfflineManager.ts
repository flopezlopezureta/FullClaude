import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { STORAGE_KEYS } from '../constants';

export const OfflineManager = {
  // Guardar la lista de paquetes para uso offline
  savePackagesToCache: async (packages: any[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PACKAGES_CACHE, JSON.stringify({
        data: packages,
        timestamp: new Date().getTime()
      }));
    } catch (e) {
      console.error('Error caching packages', e);
    }
  },

  // Recuperar la lista de paquetes desde el cache
  getPackagesFromCache: async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.PACKAGES_CACHE);
      return cached ? JSON.parse(cached).data : [];
    } catch (e) {
      return [];
    }
  },

  // Añadir una acción a la cola de sincronización (Ej: entregar paquete)
  queueAction: async (type: 'DELIVER' | 'PROBLEM' | 'CLOSURE', data: any) => {
    try {
      const queueRaw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
      const queue = queueRaw ? JSON.parse(queueRaw) : [];
      
      const newAction = {
        id: `sync-${new Date().getTime()}`,
        type,
        data,
        timestamp: new Date().getTime()
      };
      
      queue.push(newAction);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(queue));
      return true;
    } catch (e) {
      console.error('Error queuing action', e);
      return false;
    }
  },

  // Obtener acciones pendientes
  getPendingActions: async () => {
    try {
      const queueRaw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
      return queueRaw ? JSON.parse(queueRaw) : [];
    } catch (e) {
      return [];
    }
  },

  // Eliminar una acción procesada de la cola
  removeActionFromQueue: async (actionId: string) => {
    try {
      const queueRaw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
      if (!queueRaw) return;
      
      const queue = JSON.parse(queueRaw);
      const newQueue = queue.filter((a: any) => a.id !== actionId);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(newQueue));
    } catch (e) {}
  },

  // Verificar si hay conexión
  isConnected: async () => {
    const status = await Network.getNetworkStateAsync();
    return status.isConnected && status.isInternetReachable;
  }
};
