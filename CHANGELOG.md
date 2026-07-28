# Changelog - Fullenvios

Todos los cambios notables en este proyecto serán documentados en este archivo.

## [2.7.2] - 2026-07-28
### Corregido
* **Dashboard Principal:** Se restauró la consulta de fecha amplia original (`createdAt` OR `updatedAt` OR `estimatedDelivery`) para la opción por defecto `"created"`. Esto soluciona la regresión crítica de la versión 2.7.0 que ocultaba paquetes activos del día creados en fechas anteriores.

## [2.7.1] - 2026-07-28
### Corregido
* **App Móvil de Conductores:** Se incluyó el estado `ASIGNADO` en la consulta del endpoint `/api/mobile/entregas`. Esto soluciona el problema donde los choferes no veían los pedidos recién asignados hasta que se cambiaban manualmente a tránsito.

## [2.7.0] - 2026-07-28
### Añadido
* **Filtros Estrictos en Alertas Críticas:** 
  * Las alertas de reasignación (`isReassigned = true`) ahora se filtran estrictamente por la columna `assignedAt` en lugar de `updatedAt`. Esto evita falsos positivos causados por el servicio de sincronización automática de Mercado Libre (`meliPollingService.js`) al actualizar paquetes antiguos de meses anteriores.
  * Las alertas de duplicados (`isDuplicate = true`) ahora se filtran estrictamente por la columna `createdAt`.
* **Mejora en Dashboard UI:** Las tarjetas de reasignación ahora muestran la hora real del evento (`assignedAt`) en lugar de la hora de sincronización.
