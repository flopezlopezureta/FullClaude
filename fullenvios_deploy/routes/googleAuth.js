const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const getCredentials = () => ({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUrl: process.env.GOOGLE_REDIRECT_URL
});

// GET /api/auth/google/url - Genera la URL de consentimiento
router.get('/url', authMiddleware, (req, res) => {
    const { clientId, clientSecret, redirectUrl } = getCredentials();

    if (!clientId || !clientSecret || !redirectUrl) {
        return res.status(500).json({ 
            error: 'Configuración de Google OAuth2 incompleta.',
            details: 'Faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REDIRECT_URL en las variables de entorno.' 
        });
    }

    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl);
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Requerido para obtener refresh_token
        prompt: 'consent',     // Forzar consentimiento para asegurar recibir refresh_token
        scope: [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/userinfo.email'
        ]
    });
    res.json({ url });
});

// GET /api/auth/google/callback - Maneja el retorno de Google
router.get('/callback', async (req, res) => {
    const { code } = req.query;
    const { clientId, clientSecret, redirectUrl } = getCredentials();

    if (!code) return res.status(400).send('Código de autorización faltante.');

    try {
        const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl);
        const { tokens } = await oauth2Client.getToken(code);
        
        oauth2Client.setCredentials(tokens);
        const userInfo = await oauth2Client.request({ url: 'https://www.googleapis.com/oauth2/v3/userinfo' });
        const email = userInfo.data.email;

        // Actualizar la base de datos
        // Solo sobreescribimos el refresh_token si Google nos envió uno nuevo
        if (tokens.refresh_token) {
            await db.query(`
                UPDATE integration_settings 
                SET smtp_google_refresh_token = $1, smtp_google_email = $2 
                WHERE id = 1
            `, [tokens.refresh_token, email]);
        } else {
            await db.query(`
                UPDATE integration_settings 
                SET smtp_google_email = $1 
                WHERE id = 1
            `, [email]);
        }

        // Script para comunicar el éxito al frontend y cerrar el popup
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Autorización Exitosa</title></head>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h2 style="color: #10b981;">✓ ¡Conexión Exitosa!</h2>
                <p>Tu cuenta <strong>${email}</strong> ha sido vinculada correctamente.</p>
                <p>Esta ventana se cerrará automáticamente...</p>
                <script>
                    setTimeout(() => {
                        if (window.opener) {
                            window.opener.postMessage({ 
                                type: 'GOOGLE_AUTH_SUCCESS', 
                                email: '${email}' 
                            }, '*');
                        }
                        window.close();
                    }, 2000);
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('[GoogleAuth] Error en callback:', err);
        res.status(500).send(`
            <h2 style="color: #ef4444;">Error de Autorización</h2>
            <p>${err.message}</p>
        `);
    }
});

module.exports = router;
