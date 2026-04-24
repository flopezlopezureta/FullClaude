
import type { User, Package, DeliveryZone } from '../types';
import { Role, UserStatus, PackageStatus, ShippingType, PackageSource } from '../constants';

export const MOCK_ZONES: DeliveryZone[] = [
    {
        id: 'zone-1',
        name: 'Santiago Centro',
        communes: ['Santiago', 'Providencia', 'Las Condes', 'Vitacura', 'Lo Barnechea', 'Ñuñoa'],
        pricing: { sameDay: 3500, express: 5000, nextDay: 2800 }
    },
    {
        id: 'zone-2',
        name: 'Santiago Periferia',
        communes: ['Maipú', 'Puente Alto', 'La Florida', 'San Bernardo', 'Peñalolén'],
        pricing: { sameDay: 4500, express: 6000, nextDay: 3800 }
    },
    {
        id: 'zone-3',
        name: 'Santiago Rural',
        communes: ['Lampa', 'Colina', 'Paine', 'Melipilla'],
        pricing: { sameDay: 5500, express: 7500, nextDay: 4800 }
    }
];

const firstNames = ["ALEJANDRO", "CAROLINA", "JAVIER", "SOFIA", "DIEGO", "VALENTINA", "MATIAS", "ISABELLA", "NICOLAS", "ANTONIA", "SEBASTIAN", "CAMILA", "BENJAMIN", "FERNANDA", "VICENTE", "MARTINA", "JOAQUIN", "MARIA", "AGUSTIN", "EMILIA"];
const lastNames = ["ROJAS", "SOTO", "GONZALEZ", "DIAZ", "PEREZ", "MORALES", "SILVA", "CASTILLO", "REYES", "MOLINA", "CASTRO", "FERNANDEZ", "VARGAS", "TORRES", "RIOS", "NAVARRO", "PAREDES", "VALENZUELA", "ESPINOZA", "SALAZAR"];
const storePrefixes = ["Emporio", "Bazar", "Tienda", "Rincón", "Mercado", "Punto", "Almacén", "Casa", "Estilo", "Mundo", "Outlet", "Taller", "Bodega", "Fábrica", "Estudio"];
const storeSuffixes = ["Creativo", "Digital", "Urbano", "Feliz", "Austral", "Andino", "Gourmet", "Express", "Mágico", "Artesanal", "Moderno", "Clásico", "Del Sur", "Norteño", "Central"];
const communes = ['Santiago', 'Providencia', 'Las Condes', 'Vitacura', 'Lo Barnechea', 'Ñuñoa', 'Maipú', 'Puente Alto', 'La Florida', 'San Bernardo', 'Peñalolén', 'Lampa', 'Colina', 'Paine'];

function generateRut() {
    let num = Math.floor(Math.random() * 18000000) + 7000000; // Ruts between 7 and 25 million
    let M = 0, S = 1;
    for (let t = num; t; t = Math.floor(t / 10)) {
        S = (S + t % 10 * (9 - M++ % 6)) % 11;
    }
    const dv = S ? S - 1 : 'K';
    const numStr = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${numStr}-${dv}`;
}


const generatedUsers: User[] = [];

// Generate 27 more clients (total 30 with existing)
for (let i = 4; i <= 30; i++) {
    const commune = communes[Math.floor(Math.random() * communes.length)];
    const storeName = `${storePrefixes[Math.floor(Math.random() * storePrefixes.length)]} ${storeSuffixes[Math.floor(Math.random() * storeSuffixes.length)]}`;
    const clientIdentifier = `${storeName.substring(0, 4).toUpperCase()}-${i}`;
    generatedUsers.push({
        id: `user-client-${i}`,
        name: storeName,
        email: `cliente${i}@demo.cl`,
        password: 'password',
        role: Role.Client,
        status: UserStatus.Approved,
        rut: generateRut(),
        address: `Calle Ficticia ${i * 100}, ${commune}`,
        pickupAddress: `Calle Ficticia ${i * 100}, ${commune}`,
        clientIdentifier: clientIdentifier,
        billingName: `${storeName} SpA`,
        billingRut: generateRut(),
        billingAddress: `Avenida Inventada ${i * 10}`,
        billingCommune: commune,
        billingGiro: 'Ventas por Menor',
        pickupCost: 1500 + Math.floor(Math.random() * 10) * 100,
        invoices: [],
    });
}

// Generate 17 more drivers (total 20 with existing)
for (let i = 4; i <= 20; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    generatedUsers.push({
        id: `user-driver-${i}`,
        name: `${firstName} ${lastName}`,
        email: `conductor${i}@demo.cl`,
        password: 'password',
        role: Role.Driver,
        status: UserStatus.Approved,
        personalRut: generateRut(),
        pricing: { sameDay: 1800, express: 2500, nextDay: 1500, pickup: 5000 },
        driverPermissions: { canDeliver: true, canPickup: true, canDispatch: true, canReturn: true, canViewHistory: true, canBulkPickup: false, canColecta: false }
    });
}


export const MOCK_USERS: User[] = [
  {
    id: 'user-admin',
    name: 'Administrador Principal',
    email: 'admin',
    password: 'admin',
    role: Role.Admin,
    status: UserStatus.Approved
  },
  {
    id: 'user-client-1',
    name: 'Tienda Zapatilla Feliz',
    email: 'cliente@cliente.cl',
    password: 'cliente',
    role: Role.Client,
    status: UserStatus.Approved,
    rut: '76.123.456-7',
    address: 'Av. Providencia 123, Providencia',
    pickupAddress: 'Av. Providencia 123, Providencia',
    clientIdentifier: 'ZAPA-FE12',
    billingName: 'Zapatilla Feliz SpA',
    billingRut: '76.123.456-7',
    billingAddress: 'Av. Providencia 123',
    billingCommune: 'Providencia',
    billingGiro: 'Venta de Calzado',
    pickupCost: 1500,
    invoices: [],
  },
  {
    id: 'user-client-2',
    name: 'Libros del Saber',
    email: 'libros@cliente.cl',
    password: 'libros',
    role: Role.Client,
    status: UserStatus.Approved,
    rut: '77.890.123-K',
    address: 'Calle Falsa 456, Santiago',
    pickupAddress: 'Bodega Central, Lampa',
    clientIdentifier: 'LIBR-SA12',
    billingName: 'Comercial Libros del Saber Ltda.',
    billingRut: '77.890.123-K',
    billingAddress: 'Calle Falsa 456',
    billingCommune: 'Santiago',
    billingGiro: 'Librería',
    pickupCost: 2000,
    invoices: [],
  },
   {
    id: 'user-client-3',
    name: 'Tecno Soluciones',
    email: 'tecno@cliente.cl',
    password: 'tecno',
    role: Role.Client,
    status: UserStatus.Pending,
    rut: '78.456.789-1',
    address: 'Apoquindo 3000, Las Condes',
    pickupAddress: 'Apoquindo 3000, Las Condes',
    clientIdentifier: 'TEC-SOL1',
    invoices: [],
  },
  {
    id: 'user-driver-1',
    name: 'IGNACIO LOPEZ',
    email: 'conductor@conductor.cl',
    password: 'conductor',
    role: Role.Driver,
    status: UserStatus.Approved,
    personalRut: '18.123.456-7',
    pricing: { sameDay: 1800, express: 2500, nextDay: 1500, pickup: 5000 },
    driverPermissions: { canDeliver: true, canPickup: true, canDispatch: true, canReturn: true, canViewHistory: true, canBulkPickup: true, canColecta: false }
  },
  {
    id: 'user-driver-2',
    name: 'CARLA PEREZ',
    email: 'carla@conductor.cl',
    password: 'conductor',
    role: Role.Driver,
    status: UserStatus.Approved,
    personalRut: '19.876.543-2',
    pricing: { sameDay: 1800, express: 2500, nextDay: 1500, pickup: 5000 },
    driverPermissions: { canDeliver: true, canPickup: true, canDispatch: true, canReturn: true, canViewHistory: true, canBulkPickup: false, canColecta: false }
  },
  {
    id: 'user-driver-3',
    name: 'PEDRO GOMEZ',
    email: 'pedro@conductor.cl',
    password: 'conductor',
    role: Role.Driver,
    status: UserStatus.Pending,
    personalRut: '17.555.444-3',
    driverPermissions: { canDeliver: true, canPickup: true, canDispatch: true, canReturn: true, canViewHistory: true, canBulkPickup: false, canColecta: false }
  },
  {
    id: 'user-driver-4',
    name: 'IGNACIO LOPEZ',
    email: 'ilopez@selcom.cl',
    password: 'conductor',
    role: Role.Driver,
    status: UserStatus.Approved,
    phone: '+56985367387',
    personalRut: '19.672.365-K',
    hasCompany: false,
    licenseType: '',
    licenseExpiry: '',
    backgroundCheckNotes: '',
    pricing: { sameDay: 1800, express: 2500, nextDay: 1500, pickup: 5000 },
    driverPermissions: { canDeliver: true, canPickup: true, canDispatch: true, canReturn: true, canViewHistory: true, canBulkPickup: true, canColecta: false }
  },
  {
    id: 'user-facturacion',
    name: 'Contabilidad General',
    email: 'facturacion@fullenvios.cl',
    password: 'facturacion',
    role: Role.Facturacion,
    status: UserStatus.Approved,
  },
  {
    id: 'user-retiros',
    name: 'Jefe de Retiros',
    email: 'retiros',
    password: 'retiros12345678',
    role: Role.Retiros,
    status: UserStatus.Approved,
  },
  {
    id: 'user-auxiliar',
    name: 'Auxiliar de Bodega',
    email: 'auxiliar@fullenvios.cl',
    password: 'auxiliar',
    role: Role.Auxiliar,
    status: UserStatus.Approved,
  },
  ...generatedUsers,
];

const now = new Date();
const yesterday = new Date(now);
yesterday.setDate(now.getDate() - 1);
const tomorrow = new Date(now);
tomorrow.setDate(now.getDate() + 1);

export const MOCK_PACKAGES: Package[] = [
    {
        id: 'ZAPA-FE12-0001',
        recipientName: 'ANA MARTINEZ',
        recipientPhone: '+56987654321',
        status: PackageStatus.Delivered,
        shippingType: ShippingType.SameDay,
        origin: 'Av. Providencia 123, Providencia',
        destination: 'Calle Maipú 456, Maipú',
        recipientAddress: 'Calle Maipú 456',
        recipientCommune: 'Maipú',
        recipientCity: 'Santiago',
        estimatedDelivery: yesterday,
        createdAt: new Date(yesterday.getTime() - 1000 * 60 * 60),
        updatedAt: yesterday,
        history: [
            { timestamp: yesterday, status: PackageStatus.Delivered, location: 'Calle Maipú 456, Maipú', details: 'Entregado a Ana Martinez.' },
            { timestamp: yesterday, status: PackageStatus.InTransit, location: 'Centro de Distribución', details: 'En camino al destinatario.' },
            { timestamp: yesterday, status: PackageStatus.PickedUp, location: 'Av. Providencia 123, Providencia', details: 'Retirado por conductor.' },
            { timestamp: new Date(yesterday.getTime() - 1000 * 60 * 60), status: 'Creado', location: 'Av. Providencia 123, Providencia', details: 'Paquete creado.' },
        ],
        driverId: 'user-driver-1',
        creatorId: 'user-client-1',
        source: PackageSource.Manual,
        billed: true,
    },
    {
        id: 'ZAPA-FE12-0002',
        recipientName: 'LUIS GONZALEZ',
        recipientPhone: '+56912345678',
        status: PackageStatus.InTransit,
        shippingType: ShippingType.Express,
        origin: 'Av. Providencia 123, Providencia',
        destination: 'Av. Las Condes 789, Las Condes',
        recipientAddress: 'Av. Las Condes 789, Depto 101',
        recipientCommune: 'Las Condes',
        recipientCity: 'Santiago',
        estimatedDelivery: now,
        createdAt: new Date(now.getTime() - 1000 * 60 * 30),
        updatedAt: now,
        history: [
            { timestamp: now, status: PackageStatus.InTransit, location: 'Centro de Distribución', details: 'En camino al destinatario.' },
            { timestamp: now, status: PackageStatus.PickedUp, location: 'Av. Providencia 123, Providencia', details: 'Retirado por conductor.' },
            { timestamp: new Date(now.getTime() - 1000 * 60 * 30), status: 'Creado', location: 'Av. Providencia 123, Providencia', details: 'Paquete creado.' },
        ],
        driverId: 'user-driver-2',
        creatorId: 'user-client-1',
        source: PackageSource.Manual,
    },
    {
        id: 'LIBR-SA12-0001',
        recipientName: 'MARIA FERNANDEZ',
        recipientPhone: '+56955554444',
        status: PackageStatus.Pending,
        shippingType: ShippingType.NextDay,
        origin: 'Bodega Central, Lampa',
        destination: 'Plaza de Armas 1, Santiago',
        recipientAddress: 'Plaza de Armas 1',
        recipientCommune: 'Santiago',
        recipientCity: 'Santiago',
        estimatedDelivery: tomorrow,
        createdAt: now,
        updatedAt: now,
        history: [
             { timestamp: now, status: 'Creado', location: 'Bodega Central, Lampa', details: 'Paquete creado.' },
        ],
        driverId: null,
        creatorId: 'user-client-2',
        source: PackageSource.Manual,
    },
    {
        id: 'LIBR-SA12-0002',
        recipientName: 'CARLOS SOTO',
        recipientPhone: '+56933332222',
        status: PackageStatus.Problem,
        shippingType: ShippingType.SameDay,
        origin: 'Bodega Central, Lampa',
        destination: 'Calle Inexistente 123, Peñalolén',
        recipientAddress: 'Calle Inexistente 123',
        recipientCommune: 'Peñalolén',
        recipientCity: 'Santiago',
        estimatedDelivery: now,
        createdAt: new Date(now.getTime() - 1000 * 60 * 60),
        updatedAt: now,
        history: [
            { timestamp: now, status: PackageStatus.Problem, location: 'Calle Inexistente 123, Peñalolén', details: 'Dirección de entrega incorrecta o incompleta' },
            { timestamp: now, status: PackageStatus.InTransit, location: 'Centro de Distribución', details: 'En camino al destinatario.' },
            { timestamp: new Date(now.getTime() - 1000 * 60 * 60), status: 'Creado', location: 'Bodega Central, Lampa', details: 'Paquete creado.' },
        ],
        driverId: 'user-driver-1',
        creatorId: 'user-client-2',
        source: PackageSource.Manual,
    },
     {
        id: 'LIBR-SA12-0003',
        recipientName: 'SOFIA VEGA',
        recipientPhone: '+56911112222',
        status: PackageStatus.ReturnPending,
        shippingType: ShippingType.SameDay,
        origin: 'Bodega Central, Lampa',
        destination: 'Avenida Siempre Viva 742, Springfield',
        recipientAddress: 'Avenida Siempre Viva 742',
        recipientCommune: 'Springfield',
        recipientCity: 'Santiago',
        estimatedDelivery: yesterday,
        createdAt: new Date(yesterday.getTime() - 1000 * 60 * 60),
        updatedAt: now,
        history: [
            { timestamp: now, status: PackageStatus.ReturnPending, location: 'Centro de Distribución', details: 'Devolución solicitada por administrador.' },
            { timestamp: yesterday, status: PackageStatus.Problem, location: 'Avenida Siempre Viva 742, Springfield', details: 'Destinatario rechazó el paquete.' },
            { timestamp: yesterday, status: PackageStatus.InTransit, location: 'Centro de Distribución', details: 'En camino al destinatario.' },
            { timestamp: new Date(yesterday.getTime() - 1000 * 60 * 60), status: 'Creado', location: 'Bodega Central, Lampa', details: 'Paquete creado.' },
        ],
        driverId: 'user-driver-1',
        creatorId: 'user-client-2',
        source: PackageSource.Manual,
    },
];
