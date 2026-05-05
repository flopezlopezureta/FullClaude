# Contexto Histórico: Hack de Integración Manual Shopify (Mayo 2026)

## ¿Por qué existe este documento?
Este archivo fue creado a petición para tener el contexto exacto de cómo resolvimos el bloqueo de Shopify para el cliente **Donenic**. Servirá como memoria técnica en caso de que en el futuro la App Oficial de Fullenvíos ("Full Envion Integration 2026") siga "En revisión" y necesitemos conectar a clientes urgentes.

## El Problema Base (Cambios Shopify 2026)
A partir de enero de 2026, Shopify eliminó la función de "Aplicaciones Personalizadas Heredadas" que permitía generar un Token Estático (`shpat_...`) con un par de clics.
Ahora, todas las apps personalizadas obligan a usar el **Dev Dashboard**, el cual exige un flujo de autenticación **OAuth 2.0** para generar el token. Esto bloqueó el método antiguo donde el cliente simplemente pegaba su Token en Fullenvíos.

## La Solución Aplicada (El Hack de Donenic)
Logramos sacar el token a la fuerza bruta engañando al flujo OAuth de Shopify:
1. El cliente creó una App en su propio Dev Dashboard.
2. Inyectamos los permisos de pedidos (`read_orders`) creando una **"Nueva Versión"** en la web de Shopify.
3. Configuramos la URL de redireccionamiento a un servidor local `http://localhost:3005/callback`.
4. Levantamos un servidor Node.js en la terminal local (`scripts/get_shopify_token.js`).
5. El cliente hizo clic en la URL de instalación (autorizando la app).
6. Nuestro servidor interceptó el código temporal de Shopify, hizo la petición OAuth por debajo, y escupió el **Token Permanente (`shpat_...`)** en la pantalla del navegador.

## El "Plan B" para el futuro
Si llega un nuevo cliente remoto y no quiere dar sus credenciales de administrador (lo que impide usar el servidor en `localhost`), tenemos este "Plan B" listo para ser ejecutado:

**Crear un "Generador de Tokens Web" público:**
Podemos programar una ruta oculta en el backend de Fullenvíos (ej. `fullenvios.cl/api/utils/shopify-token-catcher`). 
El flujo sería:
1. El cliente crea su app y saca su `Client ID` y `Secret`.
2. El cliente entra a una página secreta en Fullenvíos, pega esos datos y le da a "Obtener mi Token".
3. El backend de Fullenvíos hace todo el protocolo OAuth y le devuelve el Token en la pantalla para que lo copie.

*Si en algún momento en el futuro necesitas implementar este Plan B, solo menciónamelo y leeré este documento para recordar exactamente qué hacer.*
