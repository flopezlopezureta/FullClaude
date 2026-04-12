import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL, STORAGE_KEYS } from '../constants';

const apiInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el token a todas las peticiones
apiInstance.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth
  login: async (credentials: any) => {
    const response = await apiInstance.post('/auth/login', credentials);
    if (response.data.token) {
      await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, response.data.token);
      await SecureStore.setItemAsync(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER);
  },

  getCurrentUser: async () => {
    const response = await apiInstance.get('/auth/me');
    return response.data;
  },

  // Packages (Conductor)
  getDriverPackages: async (driverId: string) => {
    const response = await apiInstance.get(`/packages?driverFilter=${driverId}&limit=0`);
    return response.data.packages;
  },

  confirmDelivery: async (pkgId: string, data: any) => {
    const response = await apiInstance.post(`/packages/${pkgId}/deliver`, data);
    return response.data;
  },

  markAsProblem: async (pkgId: string, reason: string, photos: string[]) => {
    const response = await apiInstance.post(`/packages/${pkgId}/problem`, { reason, photosBase64: photos });
    return response.data;
  },

  syncLocation: async (driverId: string, latitude: number, longitude: number) => {
    return apiInstance.post('/geo/update-location', { driverId, latitude, longitude });
  },

  // Obtener todos los usuarios (para mapear creadores)
  getUsers: async () => {
    const response = await apiInstance.get('/users');
    return response.data;
  },

  // Obtener datos del cliente (para retiros)
  getClients: async () => {
    const response = await apiInstance.get('/users');
    return response.data.filter((u: any) => u.role === 'CLIENT');
  },

  // Despacho / Carga de Ruta
  scanPackageForDispatch: async (packageId: string, driverId: string, flexCode?: string, flexLabelPhotoBase64?: string) => {
    const response = await apiInstance.post(`/packages/${packageId}/dispatch`, { 
        driverId, 
        flexCode, 
        flexLabelPhotoBase64 
    });
    return response.data;
  },

  // Mercado Libre Tools
  markPackageAsFlexed: async (packageId: string, isFlexed: boolean, flexLabelPhotoBase64?: string) => {
    const response = await apiInstance.post(`/packages/${packageId}/flex`, { isFlexed, flexLabelPhotoBase64 });
    return response.data;
  },

  syncPackageWithMeli: async (packageId: string) => {
    const response = await apiInstance.post(`/packages/${packageId}/sync-meli`);
    return response.data;
  },

  // Retiros
  getDriverPickups: async () => {
    const response = await apiInstance.get('/pickups/driver/today');
    return response.data;
  },

  updatePickupStatus: async (assignmentId: string, status: string, packagesPickedUp: number) => {
    const response = await apiInstance.put(`/pickups/assignments/${assignmentId}/status`, { status, packagesPickedUp });
    return response.data;
  },

  markPackageAsPickedUp: async (packageId: string, flexCode?: string) => {
    const response = await apiInstance.post(`/packages/${packageId}/pickup`, { flexCode });
    return response.data;
  },

  getSystemSettings: async () => {
    const response = await apiInstance.get('/settings/system');
    return response.data;
  }
};
