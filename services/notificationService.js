const db = require('../db');
const https = require('https');

/**
 * Notification Service to handle recipient notifications.
 */
const NotificationService = {
    /**
     * Sends a notification to the recipient of a package.
     * @param {string} packageId - The internal ID of the package.
     * @param {string} status - The new status of the package.
     */
    async notifyRecipient(packageId, status) {
        try {
            // 1. Check if notifications are enabled in system_settings
            const { rows: settingsRows } = await db.query('SELECT "recipientNotificationsEnabled", "companyName" FROM system_settings LIMIT 1');
            if (settingsRows.length === 0 || !settingsRows[0].recipientNotificationsEnabled) {
                return;
            }
            const settings = settingsRows[0];

            // 2. Get package and recipient details
            const { rows: pkgRows } = await db.query(
                'SELECT "recipientName", "recipientPhone", "trackingId", "meliOrderId" FROM packages WHERE id = $1',
                [packageId]
            );
            if (pkgRows.length === 0) return;
            const pkg = pkgRows[0];

            if (!pkg.recipientPhone) {
                console.log(`Notification skipped for package ${packageId}: No recipient phone.`);
                return;
            }

            // 3. Get WhatsApp integration settings
            const { rows: integrationRows } = await db.query('SELECT whatsapp_api_key, whatsapp_phone_number FROM integration_settings LIMIT 1');
            const integration = integrationRows.length > 0 ? integrationRows[0] : null;

            // 4. Prepare message based on status
            let message = '';
            // Use APP_URL if available, otherwise fallback to a generic one
            const baseUrl = process.env.APP_URL || 'https://ais-dev-k6cwqf2wjap4uwk7nddh5p-110952431422.us-east1.run.app';
            const trackingUrl = `${baseUrl}/track/${pkg.trackingId || pkg.id}`;

            switch (status) {
                case 'PENDIENTE':
                    message = `Hola ${pkg.recipientName}, tu pedido de ${settings.companyName} ha sido recibido y está siendo procesado. Puedes seguirlo aquí: ${trackingUrl}`;
                    break;
                case 'EN_TRANSITO':
                    message = `¡Buenas noticias ${pkg.recipientName}! Tu pedido de ${settings.companyName} está en camino y será entregado hoy. Sigue al repartidor aquí: ${trackingUrl}`;
                    break;
                case 'ENTREGADO':
                    message = `Hola ${pkg.recipientName}, tu pedido de ${settings.companyName} ha sido entregado exitosamente. ¡Gracias por preferirnos!`;
                    break;
                case 'PROBLEMA':
                    message = `Hola ${pkg.recipientName}, hemos tenido un inconveniente con la entrega de tu pedido de ${settings.companyName}. Nos pondremos en contacto pronto.`;
                    break;
                case 'RETIRO':
                    message = `Hola ${pkg.recipientName}, tu pedido de ${settings.companyName} ha sido retirado y está en camino. Sigue tu pedido aquí: ${trackingUrl}`;
                    break;
                case 'DEVOLUCION':
                    message = `Hola ${pkg.recipientName}, tu pedido de ${settings.companyName} ha sido devuelto al remitente.`;
                    break;
                default:
                    return;
            }

            // 5. Log the notification in the database
            try {
                const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await db.query(
                    'INSERT INTO notifications (id, type, title, message, "userId", "relatedId") VALUES ($1, $2, $3, $4, $5, $6)',
                    [notificationId, 'RECIPIENT_UPDATE', 'Actualización de Pedido', message, null, packageId]
                );
            } catch (e) {
                console.error('Error logging notification:', e);
            }

            // 6. Send via WhatsApp API if configured
            if (integration && integration.whatsapp_api_key) {
                console.log(`[WhatsApp API] Sending to ${pkg.recipientPhone}: ${message}`);
                // This is where you would integrate with a real WhatsApp API provider
            } else {
                console.log(`[SIMULATED NOTIFICATION] To: ${pkg.recipientPhone} | Message: ${message}`);
            }

        } catch (err) {
            console.error('Error in NotificationService:', err);
        }
    }
};

module.exports = NotificationService;
