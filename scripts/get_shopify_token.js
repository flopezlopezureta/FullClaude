const express = require('express');
const app = express();
const port = 3005;

// ==========================================
// CONFIGURACIÓN DEL CLIENTE (CAMBIA ESTO)
// ==========================================
const CLIENT_ID = 'TU_ID_DE_CLIENTE_AQUI';
const CLIENT_SECRET = 'TU_SECRETO_AQUI';
const SHOP = 'tienda-del-cliente.myshopify.com';
// ==========================================

app.get('/callback', async (req, res) => {
    const { code, shop } = req.query;
    
    if (!code) {
        return res.send('Error: No se recibió código de Shopify.');
    }

    try {
        console.log('Intercambiando código por Token...');
        const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code
            })
        });
        
        const data = await response.json();
        const token = data.access_token;
        console.log('¡Token obtenido con éxito!');
        console.log(token);

        res.send(`
            <html>
            <head>
                <style>
                    body { font-family: system-ui, sans-serif; background: #f4f6f8; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
                    h1 { color: #008060; margin-top: 0; }
                    .token { background: #e3f1df; color: #008060; padding: 20px; font-family: monospace; font-size: 20px; border-radius: 8px; margin: 20px 0; word-break: break-all; }
                    p { color: #444; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>¡Éxito! 🎉</h1>
                    <p>Hemos "atrapado" el Token permanente de Shopify para ${shop}. Cópialo y pégalo en el panel de Fullenvíos:</p>
                    <div class="token">${token}</div>
                    <p><strong>Nota:</strong> Ya puedes cerrar esta ventana y apagar el servidor en tu terminal (Ctrl+C).</p>
                </div>
            </body>
            </html>
        `);
        
        setTimeout(() => process.exit(0), 2000);
        
    } catch (err) {
        console.error('Error al obtener el token:', err.message);
        res.send(`<h1>Error</h1><p>${err.message}</p>`);
    }
});

app.listen(port, () => {
    console.log('\n======================================================');
    console.log('🚀 SERVIDOR ATRAPA-TOKENS INICIADO');
    console.log('======================================================\n');
    console.log('Asegúrate de haber configurado tu CLIENT_ID y CLIENT_SECRET en este script.');
    console.log('\nPaso 1: Pega esta URL exacta en tu navegador:');
    console.log(`\nhttps://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=read_orders,write_orders&redirect_uri=http://localhost:${port}/callback\n`);
    console.log('Paso 2: Haz clic en "Instalar".');
    console.log('Paso 3: ¡El token aparecerá en la pantalla!');
    console.log('\nEsperando respuesta de Shopify...');
});
