import {
  Package,
  User,
  SystemSettings,
  DeliveryZone,
  Invoice,
  IntegrationSettings,
  MeliOrder,
  PickupRun,
  PickupAssignment,
  AssignmentEvent,
  DriverPermissions
} from '../types';
import { PackageStatus, ShippingType, Role } from '../constants';

const API_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `Error ${response.status}: ${response.statusText}`);
  }

  // Some endpoints might return 204 No Content
  if (response.status === 204) {
      return {} as T;
  }

  return response.json();
}

const get = <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' });
const post = <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
const put = <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) });
const del = <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' });

// --- Types ---

export interface LoginCredentials {
  email?: string;
  password?: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password?: string;
  role: Role;
  phone?: string;
  rut?: string;
  address?: string;
  pickupAddress?: string;
  storesInfo?: string;
}

export interface PackageCreationData {
  creatorId: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCommune: string;
  recipientCity: string;
  notes?: string;
  estimatedDelivery: Date;
  shippingType: ShippingType;
  origin: string;
  source: string;
  meliOrderId?: string;
  shopifyOrderId?: string;
  wooOrderId?: string;
}

export interface PackageUpdateData {
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  recipientCommune?: string;
  recipientCity?: string;
  notes?: string;
  origin?: string;
  status?: PackageStatus;
  shippingType?: ShippingType;
  estimatedDelivery?: Date;
  destLatitude?: number;
  destLongitude?: number;
}

export interface UserCreationData extends RegisterData {
    personalRut?: string;
    billingName?: string;
    billingRut?: string;
    billingAddress?: string;
    billingCommune?: string;
    billingGiro?: string;
    pickupCost?: number;
    pricing?: any;
    driverPermissions?: DriverPermissions;
}

export interface UserUpdateData extends Partial<UserCreationData> {
    companyName?: string;
    companyRut?: string;
    companyAddress?: string;
    licenseType?: string;
    licenseExpiry?: string;
    backgroundCheckNotes?: string;
    vehicles?: any[];
    integrations?: any;
    driverPermissions?: DriverPermissions;
}

export interface DeliveryConfirmationData {
  receiverName: string;
  receiverId: string;
  photosBase64: string[];
}

export const cityCoordinates: { [key: string]: [number, number] } = {
    'Santiago': [-33.4489, -70.6693],
    'Arica': [-18.4783, -70.3126],
    'Iquique': [-20.2307, -70.1357],
    'Antofagasta': [-23.6509, -70.3975],
    'Calama': [-22.4542, -68.9292],
    'Copiapó': [-27.3667, -70.3333],
    'La Serena': [-29.9027, -71.2520],
    'Coquimbo': [-29.9533, -71.3436],
    'Valparaíso': [-33.0472, -71.6127],
    'Viña del Mar': [-33.0245, -71.5518],
    'Rancagua': [-34.1708, -70.7444],
    'Talca': [-35.4264, -71.6554],
    'Concepción': [-36.8201, -73.0444],
    'Talcahuano': [-36.7167, -73.1167],
    'Temuco': [-38.7359, -72.5904],
    'Valdivia': [-39.8142, -73.2459],
    'Puerto Montt': [-41.4689, -72.9411],
    'Coyhaique': [-45.5712, -72.0685],
    'Punta Arenas': [-53.1638, -70.9171],
    'Providencia': [-33.4314, -70.6093],
    'Las Condes': [-33.4116, -70.5807],
    'Vitacura': [-33.4000, -70.6000], // Approx
    'Lo Barnechea': [-33.3500, -70.5167], // Approx
    'Ñuñoa': [-33.4569, -70.6036],
    'La Reina': [-33.4400, -70.5300], // Approx
    'Macul': [-33.4862, -70.6030],
    'Peñalolén': [-33.4860, -70.5370],
    'La Florida': [-33.5230, -70.5970],
    'San Joaquín': [-33.4930, -70.6270],
    'La Granja': [-33.5350, -70.6190],
    'San Ramón': [-33.5420, -70.6440],
    'La Cisterna': [-33.5360, -70.6620],
    'El Bosque': [-33.5670, -70.6730],
    'San Miguel': [-33.4930, -70.6540],
    'Lo Espejo': [-33.5220, -70.6870],
    'Pedro Aguirre Cerda': [-33.4870, -70.6730],
    'Cerrillos': [-33.5040, -70.7150],
    'Maipú': [-33.5106, -70.7573],
    'Estación Central': [-33.4610, -70.6970],
    'Quinta Normal': [-33.4430, -70.6930],
    'Lo Prado': [-33.4440, -70.7250],
    'Cerro Navia': [-33.4240, -70.7300],
    'Renca': [-33.4050, -70.7290],
    'Independencia': [-33.4160, -70.6630],
    'Recoleta': [-33.4060, -70.6420],
    'Conchalí': [-33.3820, -70.6780],
    'Huechuraba': [-33.3740, -70.6370],
    'Quilicura': [-33.3550, -70.7280],
    'Pudahuel': [-33.4420, -70.7720],
    'La Pintana': [-33.5830, -70.6340],
    'San Bernardo': [-33.5930, -70.6990],
    'Puente Alto': [-33.6117, -70.5758],
    'Lampa': [-33.2830, -70.8670],
    'Colina': [-33.2030, -70.6760],
};

export const parseDateString = (dateString: string): Date => {
    // Expecting YYYY-MM-DD
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateString);
};

export const getISODate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const api = {
  // Auth
  login: (credentials: LoginCredentials) => post<{token: string, user: User}>('/auth/login', credentials),
  register: (data: RegisterData) => post<User>('/auth/register', data),
  getUserByToken: () => get<User>('/auth/me'),
  requestPasswordRecovery: (email: string) => post<{message: string}>('/auth/recover-password', { email }),

  // Users
  getUsers: () => get<User[]>('/users'),
  createUser: (data: UserCreationData) => post<User>('/users', data),
  updateUser: (userId: string, data: UserUpdateData) => put<User>(`/users/${userId}`, data),
  deleteUser: (userId: string) => del<void>(`/users/${userId}`),
  approveUser: (userId: string) => post<User>(`/users/${userId}/approve`, {}),
  toggleUserStatus: (userId: string) => post<User>(`/users/${userId}/toggle-status`, {}),
  
  // Packages
  getPackages: (params: any) => {
      const searchParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
          if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
              searchParams.append(key, String(params[key]));
          }
      });
      return get<{ packages: Package[], total: number }>(`/packages?${searchParams.toString()}`);
  },
  createPackage: (data: PackageCreationData) => post<Package>('/packages', data),
  createMultiplePackages: (packages: PackageCreationData[]) => post<Package[]>('/packages/batch', { packages }),
  updatePackage: (pkgId: string, data: PackageUpdateData) => put<Package>(`/packages/${pkgId}`, data),
  deletePackage: (pkgId: string) => del<void>(`/packages/${pkgId}`),
  assignDriverToPackage: (pkgId: string, driverId: string | null, newDeliveryDate: Date) => post<Package>(`/packages/${pkgId}/assign-driver`, { driverId, newDeliveryDate }),
  batchAssignDriverToPackages: (packageIds: string[], driverId: string, newDeliveryDate: Date) => post<{message: string}>(`/packages/batch-assign-driver`, { packageIds, driverId, newDeliveryDate }),
  markPackageForReturn: (pkgId: string) => post<Package>(`/packages/${pkgId}/mark-for-return`, {}),
  confirmDelivery: (pkgId: string, data: DeliveryConfirmationData) => post<Package>(`/packages/${pkgId}/deliver`, data),
  markPackageAsProblem: (pkgId: string, reason: string, photos: string[]) => post<Package>(`/packages/${pkgId}/problem`, { reason, photosBase64: photos }),
  confirmReturn: (pkgId: string, data: DeliveryConfirmationData) => post<Package>(`/packages/${pkgId}/return`, data),
  markPackagesAsBilled: (packageIds: string[]) => post<void>('/packages/mark-billed', { packageIds }),
  scanPackageForDispatch: (packageId: string, driverId: string) => post<{message: string}>(`/packages/${packageId}/dispatch`, { driverId }),
  markPackageAsPickedUp: (packageId: string) => post<Package>(`/packages/${packageId}/pickup`, {}),
  confirmBulkPickup: (clientId: string) => post<{count: number, message: string}>('/packages/bulk-pickup-client', { clientId }),
  scanPackageByAdmin: (packageId: string) => post<{message: string}>(`/packages/${packageId}/scan-admin`, {}),

  // Settings
  getSystemSettings: () => get<SystemSettings>('/settings/system'),
  updateSystemSettings: (data: Partial<SystemSettings>) => put<SystemSettings>('/settings/system', data),
  resetDatabase: (password: string) => post<{message: string}>('/settings/reset-database', { password }),
  
  // Integrations
  getIntegrationSettings: () => get<IntegrationSettings>('/settings/integrations'),
  updateIntegrationSettings: (data: Partial<IntegrationSettings>) => put<IntegrationSettings>('/settings/integrations', data),
  testMeliConnection: (creds: { meliAppId: string, meliClientSecret: string }) => post<{message: string}>('/settings/test-meli', creds),
  
  fetchMeliOrders: (clientId: string) => get<MeliOrder[]>(`/integrations/${clientId}/meli/orders`),
  importMeliOrders: (clientId: string, orderIds: string[]) => post<void>(`/integrations/${clientId}/meli/import`, { orderIds }),
  fetchShopifyOrders: (clientId: string) => get<any[]>(`/integrations/${clientId}/shopify/orders`),
  fetchWooCommerceOrders: (clientId: string) => get<any[]>(`/integrations/${clientId}/woocommerce/orders`),
  fetchFalabellaOrders: (clientId: string) => get<any[]>(`/integrations/${clientId}/falabella/orders`),
  importScannedMeliOrder: (clientId: string, scannedId: string) => post<{message: string, pkg: Package}>(`/integrations/import/meli-scanned`, { clientId, scannedId }),
  checkMeliShipmentStatus: (shipmentId: string) => get<{status: string, substatus: string}>(`/integrations/status/${shipmentId}`),

  // Push Notifications
  savePushSubscription: (subscription: PushSubscription) => post<void>('/notifications/subscribe', subscription),
  deletePushSubscription: (subscription: PushSubscriptionJSON) => post<void>('/notifications/unsubscribe', subscription),

  // Zones
  getDeliveryZones: () => get<DeliveryZone[]>('/zones'),
  createDeliveryZone: (data: Omit<DeliveryZone, 'id'>) => post<DeliveryZone>('/zones', data),
  updateDeliveryZone: (id: string, data: Omit<DeliveryZone, 'id'>) => put<DeliveryZone>(`/zones/${id}`, data),
  deleteDeliveryZone: (id: string) => del<void>(`/zones/${id}`),

  // Invoices & Billing
  createInvoice: (clientId: string, packageIds: string[], amount: number, pickupCount?: number, pickupCostTotal?: number) => post<Invoice>('/invoices', { clientId, packageIds, amount, pickupCount, pickupCostTotal }),

  // Geo
  updateDriverLocation: (driverId: string, latitude: number, longitude: number) => post<void>('/geo/update-location', { driverId, latitude, longitude }),
  getActiveDriversLocations: () => get<User[]>('/geo/active-drivers'),
  getRoutePolyline: (points: {lat: number, lng: number}[]) => post<[number, number][]>('/geo/route', { points }),

  // Pickups & Assignments (Legacy + New System)
  getAssignmentHistory: () => get<AssignmentEvent[]>('/assignments/history'),
  assignDriverToClient: (clientId: string, driverId: string | null) => post<AssignmentEvent>('/assignments/assign-client', { clientId, driverId }),
  reassignPickup: (eventId: string, newDriverId: string, reason: string) => post<AssignmentEvent>(`/assignments/${eventId}/reassign`, { newDriverId, reason }),
  updateAssignmentCost: (eventId: string, cost: number) => put<AssignmentEvent>(`/assignments/${eventId}/cost`, { cost }),
  dispatchPickupAssignment: (eventId: string) => post<AssignmentEvent>(`/assignments/${eventId}/dispatch`, {}),
  
  getPickupRuns: (params: { startDate: string, endDate: string }) => {
      const searchParams = new URLSearchParams(params);
      return get<PickupRun[]>(`/pickups?${searchParams.toString()}`);
  },
  // Fix: Add missing method to fetch today's pickup runs for a driver.
  getDriverPickupRun: () => get<PickupRun[]>('/pickups/driver/today'),
  createPickupRun: (data: any) => post<PickupRun>('/pickups', data),
  addAssignmentsToRun: (runId: string, assignments: any[]) => post<{message: string}>(`/pickups/runs/${runId}/assignments`, { assignments }),
  copyPickupRun: (runId: string, dates: string[], assignmentIds: string[]) => post<{message: string}>(`/pickups/runs/${runId}/copy`, { dates, assignmentIds }),
  reassignPickupRun: (runId: string, newDriverId: string) => put<PickupRun>(`/pickups/runs/${runId}/reassign`, { newDriverId }),
  updatePickupAssignment: (id: string, data: any) => put<void>(`/pickups/assignments/${id}`, data),
  deletePickupAssignment: (id: string) => del<void>(`/pickups/assignments/${id}`),
  deletePickupRun: (id: string) => del<void>(`/pickups/runs/${id}`),
  markPickupRunAsInformed: (id: string) => put<void>(`/pickups/runs/${id}/inform`, {}),
  updatePickupAssignmentStatus: (id: string, status: string, packagesPickedUp?: number) => put<void>(`/pickups/assignments/${id}/status`, { status, packagesPickedUp }),
  completeClientPickupAssignment: (clientId: string, packagesPickedUp: number) => post<any>('/assignments/complete', { clientId, packagesPickedUp }),
  
  // Colectas
  getAvailableColectas: () => get<any[]>('/pickups/colectas/available'),
  claimColecta: (clientId: string, shift: string) => post<any>('/pickups/colectas/claim', { clientId, shift }),
};