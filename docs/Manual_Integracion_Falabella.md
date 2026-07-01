# Manual de Integración: Falabella Seller Center (Chile)

Este manual detalla el funcionamiento, la configuración y el flujo operacional de la integración entre la plataforma de **Full Envíos** y la API de **Falabella Seller Center (Chile)**.

---

## 🔑 1. Configuración de Credenciales

Para activar la integración, el administrador debe ingresar las credenciales de la API en el panel de control:

1. Ingrese a **Ajustes de Integraciones** en la plataforma web.
2. Complete los siguientes campos:
   * **API Key de Falabella**: Clave de API proporcionada en tu perfil de Seller Center.
   * **Seller ID de Falabella**: Tu UserID / Email registrado de vendedor en Falabella.
3. Presione el botón **Probar Conexión**:
   * El sistema realizará una petición real firmada criptográficamente (`GetDocumentTemplates`) hacia los servidores de Falabella.
   * Si la conexión es exitosa, se guardará la configuración y se mostrará un mensaje verde de confirmación.
   * Si falla, se reportará el error exacto arrojado por la API de Falabella (por ejemplo, firma inválida o credenciales incorrectas).

> [!NOTE]
> **Seguridad y Criptografía**:
> La API Key de Falabella se almacena en la base de datos de manera **encriptada** usando el algoritmo **AES-256-CBC**. En pantalla, por seguridad, se mostrará siempre enmascarada como `************************`.

---

## 📦 2. Requisitos de los Paquetes (Mapeo de Datos)

Para que el trigger de terreno pueda notificar a Falabella sobre una entrega, los paquetes deben ser importados o creados con las siguientes propiedades en la base de datos:

* **`source`**: Debe tener el valor exacto `'FALABELLA'`.
* **`falabellaOrderId`**: ID del pedido de Falabella.
* **`falabellaTrackingId`**: ID de bulto/paquete (`tracking_number` o `OrderItemId` en Falabella). Este campo es el que se envía a la API externa para identificar el ítem despachado.

---

## ⚡ 3. Sincronización Automática en Terreno

El flujo de sincronización de entregas está completamente automatizado y funciona en segundo plano:

1. **Gatillo**: Cuando el repartidor confirma la entrega del paquete y presiona **Confirmar Entrega**, el servidor local procesa la petición de forma asíncrona.
2. **Firma SHA256**: El servidor ordena alfabéticamente los parámetros del request, añade el parámetro `Timestamp` (ISO 8601) y calcula la firma `HMAC-SHA256` utilizando la API Key del vendedor.
3. **Petición API**: Se realiza una llamada HTTP POST a `sellercenter-api.falabella.com` llamando a la acción `UpdateOrderItems` con el estado `delivered`.
4. **Resiliencia ante Caídas (Exponencial Backoff)**:
   * Si la API de Falabella está caída o responde con error, el sistema reintentará el envío hasta **3 veces** (con intervalos de 3 y 6 segundos).
   * Si los 3 intentos fallan, la tarea de sincronización se encola en la base de datos (`integration_sync_queue`) para ejecutarse automáticamente en 15 minutos.
5. **Historial de Tracking (Trazabilidad)**:
   * Al iniciar el proceso: Se añade el evento `SYNC_FALABELLA_START`.
   * Si es exitoso: Se añade el evento `SYNC_FALABELLA_OK`.
   * Si falla permanentemente y se encola: Se añade el evento `SYNC_FALABELLA_ERROR` detallando el error devuelto por la API.
