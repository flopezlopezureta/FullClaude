const db = require('../db');
const https = require('https');
const nodemailer = require('nodemailer');

/**
 * Notification Service to handle recipient notifications via WhatsApp (simulated) 
 * and Email (via SMTP).
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
                'SELECT "recipientName", "recipientPhone", "recipientEmail", "recipientAddress", "trackingId", "meliOrderId" FROM packages WHERE id = $1',
                [packageId]
            );
            if (pkgRows.length === 0) return;
            const pkg = pkgRows[0];

            // 3. Get integration settings (WhatsApp & SMTP)
            const { rows: integrationRows } = await db.query('SELECT whatsapp_api_key, whatsapp_phone_number, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from FROM integration_settings WHERE id = 1');
            const integration = integrationRows.length > 0 ? integrationRows[0] : null;

            // 4. Prepare tracking URL
            const baseUrl = process.env.APP_URL || 'https://ais-dev-k6cwqf2wjap4uwk7nddh5p-110952431422.us-east1.run.app';
            const trackingUrl = `${baseUrl}/tracking/${pkg.trackingId || pkg.id}`;

            // --- 5. SEND WHATSAPP (SIMULATED/API) ---
            if (pkg.recipientPhone) {
                let waMessage = '';
                switch (status) {
                    case 'EN_TRANSITO':
                        waMessage = `¡Hola ${pkg.recipientName}! Tu pedido de ${settings.companyName} está en camino. Sigue el envío aquí: ${trackingUrl}`;
                        break;
                    case 'ENTREGADO':
                        waMessage = `Hola ${pkg.recipientName}, tu pedido de ${settings.companyName} ha sido entregado exitosamente. ¡Gracias!`;
                        break;
                }

                if (waMessage) {
                    if (integration && integration.whatsapp_api_key) {
                        console.log(`[WhatsApp API] Sending to ${pkg.recipientPhone}: ${waMessage}`);
                    } else {
                        console.log(`[WA SIMULATION] To: ${pkg.recipientPhone} | Message: ${waMessage}`);
                    }
                }
            }

            // --- 6. SEND EMAIL (IF SMTP CONFIGURED) ---
            if (pkg.recipientEmail && integration && integration.smtp_host) {
                await this.sendEmailNotification(pkg, status, settings, integration, trackingUrl);
            }

        } catch (err) {
            console.error('Error in NotificationService:', err);
        }
    },

    /**
     * Helper to send email using Nodemailer
     */
    async sendEmailNotification(pkg, status, settings, integration, trackingUrl) {
        try {
            const transporterConfig = {
                host: integration.smtp_host,
                port: parseInt(integration.smtp_port) || 587,
                secure: parseInt(integration.smtp_port) === 465,
                auth: {
                    user: integration.smtp_user,
                    pass: integration.smtp_password
                }
            };

            // [NUEVO] Soporte para Google OAuth2
            if (integration.smtp_google_refresh_token) {
                transporterConfig.auth = {
                    type: 'OAuth2',
                    user: integration.smtp_google_email || integration.smtp_user,
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    refreshToken: integration.smtp_google_refresh_token
                };
                
                // Si es Gmail y no hay host configurado, usamos los valores por defecto recomendados para OAuth2
                if (!integration.smtp_host || integration.smtp_host.includes('gmail')) {
                    transporterConfig.host = 'smtp.gmail.com';
                    transporterConfig.port = 465;
                    transporterConfig.secure = true;
                }
            }

            const transporter = nodemailer.createTransport(transporterConfig);

            let subject = '';
            let html = '';

            const headerStyle = "background-color: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;";
            const bodyStyle = "padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #374151; line-height: 1.6;";
            const buttonStyle = "display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px;";
            const footerStyle = "padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;";

            switch (status) {
                case 'EN_TRANSITO':
                    subject = `🚚 Tu pedido está en camino - ${settings.companyName}`;
                    html = `
                        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                            <div style="${headerStyle}">
                                <h1 style="margin: 0; font-size: 24px;">¡Tu pedido está en ruta!</h1>
                            </div>
                            <div style="${bodyStyle}">
                                <p>Hola <strong>${pkg.recipientName}</strong>,</p>
                                <p>Te informamos que tu pedido realizado en <strong>${settings.companyName}</strong> ya salió de nuestras bodegas y se encuentra en manos de uno de nuestros repartidores.</p>
                                <p><strong>Dirección de entrega:</strong><br/>${pkg.recipientAddress}</p>
                                <div style="text-align: center;">
                                    <a href="${trackingUrl}" style="${buttonStyle}">Seguir mi Envío</a>
                                </div>
                                <p style="margin-top: 20px;">Si tienes alguna duda, puedes responder a este correo.</p>
                            </div>
                            <div style="${footerStyle}">
                                &copy; ${new Date().getFullYear()} ${settings.companyName} - Sistema de Logística.
                            </div>
                        </div>
                    `;
                    break;
                case 'ENTREGADO':
                    subject = `✅ Tu pedido ha sido entregado - ${settings.companyName}`;
                    html = `
                        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                            <div style="${headerStyle}; background-color: #10b981;">
                                <h1 style="margin: 0; font-size: 24px;">¡Pedido Entregado!</h1>
                            </div>
                            <div style="${bodyStyle}">
                                <p>Hola <strong>${pkg.recipientName}</strong>,</p>
                                <p>Confirmamos que tu pedido ha sido entregado exitosamente en la dirección registrada.</p>
                                <p>Esperamos que disfrutes tu compra. ¡Gracias por preferir a <strong>${settings.companyName}</strong>!</p>
                                <div style="text-align: center;">
                                    <a href="${trackingUrl}" style="${buttonStyle}; background-color: #10b981;">Ver Detalle del Pedido</a>
                                </div>
                            </div>
                            <div style="${footerStyle}">
                                &copy; ${new Date().getFullYear()} ${settings.companyName} - Sistema de Logística.
                            </div>
                        </div>
                    `;
                    break;
                default:
                    return; // Don't send other statuses for now as requested
            }

            if (html) {
                await transporter.sendMail({
                    from: integration.smtp_from || `"Notificaciones ${settings.companyName}" <${integration.smtp_user}>`,
                    to: pkg.recipientEmail,
                    subject: subject,
                    html: html
                });
                console.log(`[Email Sent] Success: ${status} notification sent to ${pkg.recipientEmail}`);
            }

        } catch (emailErr) {
            console.error('[Email Error] Failed to send email:', emailErr.message);
        }
    }
};

module.exports = NotificationService;
