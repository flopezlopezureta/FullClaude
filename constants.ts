
export enum Role {
  Admin = 'ADMIN',
  Client = 'CLIENT',
  Driver = 'DRIVER',
  Facturacion = 'FACTURACION',
  Retiros = 'RETIROS',
  Auxiliar = 'AUXILIAR',
}

export enum UserStatus {
  Pending = 'PENDIENTE',
  Approved = 'APROBADO',
  Disabled = 'DESHABILITADO',
}

export enum PackageStatus {
  Pending = 'PENDIENTE',
  PickedUp = 'RETIRADO',
  InTransit = 'EN_TRANSITO',
  Delivered = 'ENTREGADO',
  Delayed = 'RETRASADO',
  Problem = 'PROBLEMA',
  ReturnPending = 'PENDIENTE_DEVOLUCION',
  Returned = 'DEVUELTO',
}

export enum ShippingType {
  SameDay = 'SAME_DAY',
  Express = 'EXPRESS',
  NextDay = 'NEXT_DAY',
}

export enum PickupStatus {
  ASIGNADO = 'ASIGNADO',
  EN_RUTA = 'EN_RUTA',
  RETIRADO = 'RETIRADO',
  EN_BODEGA = 'EN_BODEGA',
  NO_RETIRADO = 'NO_RETIRADO',
}

export enum PickupShift {
  MANANA = 'MANANA',
  TARDE = 'TARDE',
  NOCHE = 'NOCHE',
}

export enum AssignmentStatus {
  PreAssigned = 'PRE_ASIGNADO',
  Pending = 'PENDIENTE',
  Completed = 'COMPLETADO',
}

export enum PackageSource {
  Manual = 'MANUAL',
  MercadoLibre = 'MERCADO_LIBRE',
  Shopify = 'SHOPIFY',
  WooCommerce = 'WOOCOMMERCE',
  Falabella = 'FALABELLA',
}

export enum MessagingPlan {
  None = 'NONE',
  Email = 'EMAIL',
  WhatsApp = 'WHATSAPP',
}

export enum PickupMode {
  Scan = 'SCAN',
  Manual = 'MANUAL',
  ScanWithCount = 'SCAN_COUNT',
  Colecta = 'COLECTA',
}
