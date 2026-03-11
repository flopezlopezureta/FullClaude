
import {
    Role,
    UserStatus,
    PackageStatus,
    ShippingType,
    PickupStatus,
    PickupShift,
    AssignmentStatus,
    PackageSource,
    MessagingPlan,
    PickupMode,
} from './constants';

export {
    Role,
    UserStatus,
    PackageStatus,
    ShippingType,
    PickupStatus,
    PickupShift,
    AssignmentStatus,
    PackageSource,
    MessagingPlan,
    PickupMode,
};

export interface SystemSettings {
    companyName: string;
    isAppEnabled: boolean;
    requiredPhotos: number;
    messagingPlan: MessagingPlan;
    pickupMode?: PickupMode;
    meliFlexValidation?: boolean;
}

export interface ZonePricing {
  sameDay: number;
  express: number;
  nextDay: number;
  pickup?: number;
}

export type UserPricing = ZonePricing;

export interface DeliveryZone {
  id: string;
  name: string;
  communes: string[]; // Lista de nombres de comunas
  pricing: ZonePricing;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  technicalReviewExpiry: string; // 'YYYY-MM-DD'
  circulationPermitExpiry: string; // 'YYYY-MM-DD'
}

export interface Invoice {
  id: string;
  date: Date;
  amount: number;
  packageIds: string[];
  pickupCount?: number;
  pickupCostTotal?: number;
}

export interface MeliIntegration {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
}

export interface WooCommerceIntegration {
  consumerKey: string;
  consumerSecret: string;
  storeUrl: string;
}

export interface ShopifyIntegration {
  shopUrl: string;
  accessToken: string;
}

export interface DriverPermissions {
  canDeliver: boolean;
  canPickup: boolean;
  canDispatch: boolean;
  canReturn: boolean;
  canViewHistory: boolean;
  canBulkPickup: boolean;
  canColecta: boolean;
}

export interface IntegrationSettings {
    meliAppId?: string;
    meliClientSecret?: string;
    shopifyShopUrl?: string;
    shopifyAccessToken?: string;
}

export interface MeliOrder {
  id: string;
  recipientName: string;
  address: string;
  commune: string;
  city: string;
  notes?: string;
}


export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password: string; // En una app real, esto sería un hash
  role: Role;
  status: UserStatus;
  assignedDriverId?: string | null;
  lastAssignmentTimestamp?: string;
  latitude?: number;
  longitude?: number;
  lastLocationUpdate?: string;
  // Campos específicos del cliente
  rut?: string;
  address?: string;
  pickupAddress?: string;
  storesInfo?: string;
  pricing?: UserPricing;
  clientIdentifier?: string;
  pickupCost?: number;

  // Campos de facturación del cliente
  billingName?: string;
  billingRut?: string;
  billingAddress?: string;
  billingCommune?: string;
  billingGiro?: string;
  invoices?: Invoice[];

  // Campos específicos del conductor
  personalRut?: string;
  hasCompany?: boolean;
  companyName?: string;
  companyRut?: string;
  companyAddress?: string;
  licenseExpiry?: string;
  licenseType?: string;
  backgroundCheckNotes?: string;
  vehicles?: Vehicle[];
  driverPermissions?: DriverPermissions;

  // Integrations
  integrations?: {
    meli?: MeliIntegration;
    woocommerce?: WooCommerceIntegration;
    shopify?: ShopifyIntegration;
  };
}

export interface Package {
  id: string;
  recipientName: string;
  recipientPhone: string;
  status: PackageStatus;
  shippingType: ShippingType;
  origin: string;
  destination: string;
  recipientAddress: string;
  recipientCommune: string;
  recipientCity: string;
  notes?: string;
  estimatedDelivery: Date;
  createdAt: Date;
  updatedAt: Date;
  history: TrackingEvent[];
  driverId: string | null;
  creatorId: string | null;
  destLatitude?: number;
  destLongitude?: number;
  deliveryReceiverName?: string;
  deliveryReceiverId?: string;
  deliveryPhotosBase64?: string[];
  billed?: boolean;
  source: PackageSource;
  meliOrderId?: string;
  wooOrderId?: string;
  shopifyOrderId?: string;
}

// --- New Pickup Management System Types ---

export interface TrackingEvent {
  timestamp: Date;
  status: string;
  location: string;
  details: string;
}

export interface PickupAssignment {
  id: string;
  runId: string;
  clientId: string;
  clientName: string;
  clientAddress: string;
  clientPhone?: string;
  status: PickupStatus;
  cost: number;
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
  packagesToPickup: number; // Count of pending packages at time of creation
  packagesPickedUp?: number; // Count of actual packages picked up by driver
}

export interface PickupRun {
  id: string;
  driverId: string;
  driverName: string;
  date: string; // YYYY-MM-DD
  shift: PickupShift;
  assignments: PickupAssignment[];
  createdAt: Date;
  informed?: boolean;
  informedAt?: Date;
}

// --- Legacy Assignment Types ---
export interface AssignmentEvent {
    id: string;
    clientId: string;
    clientName: string;
    driverId: string | null;
    driverName: string | null;
    assignedAt: Date;
    completedAt?: Date;
    status: AssignmentStatus;
    pickupCost?: number;
    packagesPickedUp?: number;
}
