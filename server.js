


require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();

// --- Middlewares ---
// Aggressively disable caching for all responses to solve stale asset issues.
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for photo uploads

// --- API Routes ---
// Helper to avoid startup crashes if a route file is missing in deploy.
function tryRequireRoute(modulePath) {
  try {
    return require(modulePath);
  } catch (err) {
    console.warn(`[WARN] Route module not found: ${modulePath}. Skipping.`, err && err.code ? err.code : err && err.message ? err.message : err);
    return null;
  }
}
// Define API routes first to ensure they are not overridden by the static file server or SPA fallback.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});
const authRoute = tryRequireRoute('./routes/auth.js'); if (authRoute) app.use('/api/auth', authRoute);
const usersRoute = tryRequireRoute('./routes/users.js'); if (usersRoute) app.use('/api/users', usersRoute);
const packagesRoute = tryRequireRoute('./routes/packages.js'); if (packagesRoute) app.use('/api/packages', packagesRoute);
const settingsRoute = tryRequireRoute('./routes/settings.js'); if (settingsRoute) app.use('/api/settings', settingsRoute);
const zonesRoute = tryRequireRoute('./routes/zones.js'); if (zonesRoute) app.use('/api/zones', zonesRoute);
const invoicesRoute = tryRequireRoute('./routes/invoices.js'); if (invoicesRoute) app.use('/api/invoices', invoicesRoute);
const billingRoute = tryRequireRoute('./routes/billing.js'); if (billingRoute) app.use('/api/billing', billingRoute);
const integrationsRoute = tryRequireRoute('./routes/integrations.js'); if (integrationsRoute) app.use('/api/integrations', integrationsRoute);
const geoRoute = tryRequireRoute('./routes/geo.js'); if (geoRoute) app.use('/api/geo', geoRoute);
// Montar rutas de pickups directamente
const pickupsRoute = tryRequireRoute('./routes/pickups.js'); if (pickupsRoute) app.use('/api/pickups', pickupsRoute);
const assignmentsRoute = tryRequireRoute('./routes/assignments.js'); if (assignmentsRoute) app.use('/api/assignments', assignmentsRoute);
const debugRoute = tryRequireRoute('./routes/debug.js'); if (debugRoute) app.use('/api/debug', debugRoute);


// --- Frontend Serving & SPA Fallback ---
const distPath = path.join(__dirname, 'dist');

// Serve static files from the 'dist' directory (Vite's build output).
app.use(express.static(distPath));

// The SPA fallback (catch-all) MUST be the last route.
// It handles all GET requests that didn't match an API route or a static file.
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});


// --- Server & DB Initialization ---
const PORT = process.env.PORT || 3001;

async function initializeDatabase() {
    console.log('Initializing database schema...');
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                status TEXT NOT NULL,
                "assignedDriverId" TEXT,
                "lastAssignmentTimestamp" TIMESTAMPTZ,
                rut TEXT,
                address TEXT,
                "pickupAddress" TEXT,
                "storesInfo" TEXT,
                pricing JSONB,
                "clientIdentifier" TEXT,
                "pickupCost" INTEGER,
                "billingName" TEXT,
                "billingRut" TEXT,
                "billingAddress" TEXT,
                "billingCommune" TEXT,
                "billingGiro" TEXT,
                invoices JSONB,
                "personalRut" TEXT,
                "hasCompany" BOOLEAN,
                "companyName" TEXT,
                "companyRut" TEXT,
                "companyAddress" TEXT,
                "licenseExpiry" TEXT,
                "licenseType" TEXT,
                "backgroundCheckNotes" TEXT,
                vehicles JSONB,
                "driverPermissions" JSONB,
                latitude REAL,
                longitude REAL,
                "lastLocationUpdate" TIMESTAMPTZ,
                integrations JSONB
            );
        `);
        console.log('Table "users" is ready.');

        // --- USERS: ensure critical columns exist in older schemas ---
        const ensureUserColumns = async () => {
            const userCols = [
                'assignedDriverId TEXT',
                'lastAssignmentTimestamp TIMESTAMPTZ',
                'pickupAddress TEXT',
                'phone TEXT',
                'pricing JSONB',
                'clientIdentifier TEXT',
                'pickupCost INTEGER',
                'billingName TEXT',
                'billingRut TEXT',
                'billingAddress TEXT',
                'billingCommune TEXT',
                'billingGiro TEXT'
            ];
            for (const spec of userCols) {
                const col = spec.split(' ')[0];
                try {
                    await db.query(`ALTER TABLE users ADD COLUMN "${col}" ${spec.split(' ').slice(1).join(' ')}`);
                    console.log(`MIGRATION APPLIED: Column "${col}" added to "users".`);
                } catch (err) {
                    if (err.code !== '42701') { console.error(`Error during users migration (${col}):`, err); }
                }
            }
        };
        await ensureUserColumns();

        await db.query(`
            CREATE TABLE IF NOT EXISTS packages (
                id TEXT PRIMARY KEY,
                "recipientName" TEXT NOT NULL,
                "recipientPhone" TEXT NOT NULL,
                status TEXT NOT NULL,
                "shippingType" TEXT NOT NULL,
                origin TEXT,
                destination TEXT,
                "recipientAddress" TEXT,
                "recipientCommune" TEXT,
                "recipientCity" TEXT,
                notes TEXT,
                "estimatedDelivery" TIMESTAMPTZ,
                "createdAt" TIMESTAMPTZ,
                "updatedAt" TIMESTAMPTZ,
                "driverId" TEXT,
                "creatorId" TEXT,
                "deliveryReceiverName" TEXT,
                "deliveryReceiverId" TEXT,
                "deliveryPhotosBase64" JSONB,
                billed BOOLEAN DEFAULT false,
                source TEXT,
                "meliOrderId" TEXT,
                "wooOrderId" TEXT
            );
        `);
        console.log('Table "packages" is ready.');

        // --- PACKAGES: ensure critical columns exist in older schemas ---
        const ensurePackageColumns = async () => {
            const pkgCols = [
                'createdAt TIMESTAMPTZ',
                'updatedAt TIMESTAMPTZ',
                'driverId TEXT',
                'creatorId TEXT',
                'deliveryPhotosBase64 JSONB',
                'billed BOOLEAN DEFAULT false',
                'source TEXT'
            ];
            for (const spec of pkgCols) {
                const col = spec.split(' ')[0];
                try {
                    await db.query(`ALTER TABLE packages ADD COLUMN "${col}" ${spec.split(' ').slice(1).join(' ')}`);
                    console.log(`MIGRATION APPLIED: Column "${col}" added to "packages".`);
                } catch (err) {
                    if (err.code !== '42701') { console.error(`Error during packages migration (${col}):`, err); }
                }
            }
        };
        await ensurePackageColumns();

        await db.query(`
            CREATE TABLE IF NOT EXISTS tracking_events (
                id SERIAL PRIMARY KEY,
                "packageId" TEXT NOT NULL,
                status TEXT,
                location TEXT,
                details TEXT,
                timestamp TIMESTAMPTZ NOT NULL
            );
        `);
        console.log('Table "tracking_events" is ready.');

        await db.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id INTEGER PRIMARY KEY,
                "companyName" TEXT,
                "isAppEnabled" BOOLEAN DEFAULT true,
                "requiredPhotos" INTEGER DEFAULT 1,
                "messagingPlan" TEXT DEFAULT 'NONE',
                "pickupMode" TEXT DEFAULT 'SCAN',
                "meliFlexValidation" BOOLEAN DEFAULT true
            );
        `);
        
        // --- MIGRATION SCRIPT ---
        try {
            await db.query('ALTER TABLE system_settings ADD COLUMN "isAppEnabled" BOOLEAN DEFAULT true');
            console.log('MIGRATION APPLIED: Column "isAppEnabled" was added to "system_settings".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during settings migration (isAppEnabled):', err); }
        }
         try {
            await db.query('ALTER TABLE system_settings ADD COLUMN "requiredPhotos" INTEGER DEFAULT 1');
            console.log('MIGRATION APPLIED: Column "requiredPhotos" was added to "system_settings".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during settings migration (requiredPhotos):', err); }
        }
        try {
            await db.query('ALTER TABLE system_settings ADD COLUMN "messagingPlan" TEXT DEFAULT \'NONE\'');
            console.log('MIGRATION APPLIED: Column "messagingPlan" was added to "system_settings".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during settings migration (messagingPlan):', err); }
        }
        try {
            await db.query('ALTER TABLE packages ADD COLUMN "createdAt" TIMESTAMPTZ');
            console.log('MIGRATION APPLIED: Column "createdAt" was added to "packages".');
        } catch (err) {
             if (err.code !== '42701') { console.error('Error during packages migration (createdAt):', err); }
        }
        try {
            await db.query('ALTER TABLE users ADD COLUMN "driverPermissions" JSONB');
            console.log('MIGRATION APPLIED: Column "driverPermissions" was added to "users".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during users migration (driverPermissions):', err); }
        }
        try {
            await db.query('ALTER TABLE system_settings ADD COLUMN "pickupMode" TEXT DEFAULT \'SCAN\'');
            console.log('MIGRATION APPLIED: Column "pickupMode" was added to "system_settings".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during settings migration (pickupMode):', err); }
        }
        try {
            await db.query('ALTER TABLE users ADD COLUMN "latitude" REAL');
            console.log('MIGRATION APPLIED: Column "latitude" was added to "users".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during users migration (latitude):', err); }
        }
        try {
            await db.query('ALTER TABLE users ADD COLUMN "longitude" REAL');
            console.log('MIGRATION APPLIED: Column "longitude" was added to "users".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during users migration (longitude):', err); }
        }
        try {
            await db.query('ALTER TABLE system_settings ADD COLUMN "meliFlexValidation" BOOLEAN DEFAULT true');
            console.log('MIGRATION APPLIED: Column "meliFlexValidation" was added to "system_settings".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during settings migration (meliFlexValidation):', err); }
        }
        // Drop old columns if they exist. Using IF EXISTS is safer.
        const dropOldPlanColumns = async () => {
            try { await db.query('ALTER TABLE system_settings DROP COLUMN IF EXISTS "planType"'); } catch(e){}
            try { await db.query('ALTER TABLE system_settings DROP COLUMN IF EXISTS "planPackageLimit"'); } catch(e){}
            try { await db.query('ALTER TABLE system_settings DROP COLUMN IF EXISTS "planOverageFee"'); } catch(e){}
            try { await db.query('ALTER TABLE system_settings DROP COLUMN IF EXISTS "planLimits"'); } catch(e){}
            console.log('MIGRATION APPLIED: Old plan-related columns were dropped.');
        };
        await dropOldPlanColumns();
        // --- END MIGRATION SCRIPT ---

        console.log('Table "system_settings" is ready.');
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS delivery_zones (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                communes JSONB,
                pricing JSONB
            );
        `);
        console.log('Table "delivery_zones" is ready.');

        // --- NEW PICKUP TABLES ---
        await db.query(`
            CREATE TABLE IF NOT EXISTS assignment_events (
                id TEXT PRIMARY KEY,
                "clientId" TEXT NOT NULL,
                "clientName" TEXT NOT NULL,
                "driverId" TEXT,
                "driverName" TEXT,
                "assignedAt" TIMESTAMPTZ NOT NULL,
                "completedAt" TIMESTAMPTZ,
                status TEXT NOT NULL,
                "pickupCost" INTEGER,
                "packagesPickedUp" INTEGER
            );
        `);
        console.log('Table "assignment_events" is ready.');


        await db.query(`
            CREATE TABLE IF NOT EXISTS pickup_runs (
                id TEXT PRIMARY KEY,
                "driverId" TEXT NOT NULL,
                date DATE NOT NULL,
                shift TEXT,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Table "pickup_runs" is ready.');

        await db.query(`
            CREATE TABLE IF NOT EXISTS pickup_assignments (
                id TEXT PRIMARY KEY,
                "runId" TEXT NOT NULL REFERENCES pickup_runs(id) ON DELETE CASCADE,
                "clientId" TEXT NOT NULL,
                status TEXT NOT NULL,
                cost INTEGER NOT NULL,
                "packagesToPickup" INTEGER NOT NULL,
                "packagesPickedUp" INTEGER,
                notes TEXT,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Table "pickup_assignments" is ready.');

        // --- NEW INTEGRATIONS TABLE ---
        await db.query(`
            CREATE TABLE IF NOT EXISTS integration_settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                meli_app_id TEXT,
                meli_client_secret TEXT,
                shopify_shop_url TEXT,
                shopify_access_token TEXT
            );
        `);
        console.log('Table "integration_settings" is ready.');

        // --- MIGRATIONS: Add Shopify fields ---
        try {
            await db.query('ALTER TABLE integration_settings ADD COLUMN shopify_shop_url TEXT');
            console.log('MIGRATION APPLIED: Column "shopify_shop_url" added to "integration_settings".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during integration_settings migration (shopify_shop_url):', err); }
        }
        try {
            await db.query('ALTER TABLE integration_settings ADD COLUMN shopify_access_token TEXT');
            console.log('MIGRATION APPLIED: Column "shopify_access_token" added to "integration_settings".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during integration_settings migration (shopify_access_token):', err); }
        }
        
        // --- MIGRATIONS: Add missing package fields ---
        try {
            await db.query('ALTER TABLE packages ADD COLUMN "shopifyOrderId" TEXT');
            console.log('MIGRATION APPLIED: Column "shopifyOrderId" added to "packages".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during packages migration (shopifyOrderId):', err); }
        }


        // --- MIGRATIONS: Add informed fields to pickup tables ---
        try {
            await db.query('ALTER TABLE pickup_runs ADD COLUMN informed BOOLEAN DEFAULT FALSE');
            console.log('MIGRATION APPLIED: Column "informed" added to "pickup_runs".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during pickup_runs migration (informed):', err); }
        }
        try {
            await db.query('ALTER TABLE pickup_runs ADD COLUMN "informedAt" TIMESTAMPTZ');
            console.log('MIGRATION APPLIED: Column "informedAt" added to "pickup_runs".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during pickup_runs migration (informedAt):', err); }
        }
        try {
            await db.query('ALTER TABLE pickup_assignments ADD COLUMN informed BOOLEAN DEFAULT FALSE');
            console.log('MIGRATION APPLIED: Column "informed" added to "pickup_assignments".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during pickup_assignments migration (informed):', err); }
        }
        try {
            await db.query('ALTER TABLE pickup_assignments ADD COLUMN "informedAt" TIMESTAMPTZ');
            console.log('MIGRATION APPLIED: Column "informedAt" added to "pickup_assignments".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during pickup_assignments migration (informedAt):', err); }
        }
        try {
            await db.query('ALTER TABLE pickup_runs ADD COLUMN shift TEXT');
            console.log('MIGRATION APPLIED: Column "shift" added to "pickup_runs".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during pickup_runs migration (shift):', err); }
        }
        try {
            await db.query('ALTER TABLE pickup_assignments ADD COLUMN "packagesPickedUp" INTEGER');
            console.log('MIGRATION APPLIED: Column "packagesPickedUp" added to "pickup_assignments".');
        } catch (err) {
            if (err.code !== '42701') { console.error('Error during pickup_assignments migration (packagesPickedUp):', err); }
        }

        console.log('Database schema initialization complete.');
    } catch (err) {
        console.error('FATAL: Could not initialize database schema.', err);
    }
}

async function ensureAdminUser() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('.Dan15223.', salt);

        // Look specifically for the user with email 'admin'
        const { rows } = await db.query("SELECT * FROM users WHERE email = 'admin'");

        if (rows.length > 0) {
            // User 'admin' exists, update its password and ensure role/status are correct
            const adminToUpdate = rows[0];
            console.log(`Admin user 'admin' found. Updating credentials...`);
            await db.query('UPDATE users SET password = $1, role = $2, status = $3 WHERE id = $4', [hashedPassword, 'ADMIN', 'APROBADO', adminToUpdate.id]);
            console.log('Admin user credentials updated.');
        } else {
            // User 'admin' does not exist, create it
            console.log("Default 'admin' user not found. Creating one...");
            const adminUser = {
                id: `user-admin-${uuidv4()}`,
                name: 'Administrador Principal',
                email: 'admin',
                password: hashedPassword,
                role: 'ADMIN',
                status: 'APROBADO',
                phone: '123456789'
            };
            const columns = Object.keys(adminUser).map(k => `"${k}"`).join(', ');
            const values = Object.values(adminUser);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            await db.query(`INSERT INTO users (${columns}) VALUES (${placeholders})`, values);
            console.log('Default admin user created with username: admin');
        }
    } catch (err) {
        if (err.message && err.message.includes("La base de datos no está configurada")) {
             console.warn('DB not configured. Skipping admin user seed.');
        } else {
             console.error('Error ensuring admin user exists:', err);
        }
    }
}

// PRODUCTION MODE: Data seeding disabled
async function seedDatabase() {
    // In production or after a "Reset Database", we want a clean slate.
    // We return immediately to prevent creating mock data.
    console.log('Data seeding disabled for production/clean mode.');
    return;
}

async function importUsersFromFile() {
    const fs = require('fs');
    const filePath = path.join(__dirname, 'users_data.txt');
    if (!fs.existsSync(filePath)) return;

    console.log('Detectado archivo de datos de usuarios. Iniciando importación...');
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n').filter(l => l.trim() !== '' && l !== '\\.');

        const columns = [
            'id', 'name', 'email', 'phone', 'password', 'role', 'status', 
            'assignedDriverId', 'lastAssignmentTimestamp', 'rut', 'address', 
            'pickupAddress', 'storesInfo', 'pricing', 'clientIdentifier', 
            'pickupCost', 'billingName', 'billingRut', 'billingAddress', 
            'billingCommune', 'billingGiro', 'invoices', 'personalRut', 
            'hasCompany', 'companyName', 'companyRut', 'companyAddress', 
            'licenseExpiry', 'licenseType', 'backgroundCheckNotes', 'vehicles', 
            'driverPermissions', 'latitude', 'longitude', 'lastLocationUpdate', 
            'integrations'
        ];

        for (const line of lines) {
            const fields = line.split('\t');
            const values = fields.slice(0, 36).map(f => {
                const val = f.trim();
                if (val === '\\N' || val === '') return null;
                if (val === 't') return true;
                if (val === 'f') return false;
                return val;
            });

            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            const query = `INSERT INTO users (${columns.map(c => `"${c}"`).join(', ')}) 
                           VALUES (${placeholders}) 
                           ON CONFLICT (id) DO UPDATE SET 
                           ${columns.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ')}`;
            await db.query(query, values);
        }
        console.log(`✅ Importación de ${lines.length} usuarios completada.`);
        // Opcional: borrar el archivo después de importar para no repetir
        // fs.unlinkSync(filePath); 
    } catch (err) {
        console.error('Error durante la importación de usuarios:', err);
    }
}

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await initializeDatabase();
  await importUsersFromFile();
  await ensureAdminUser();
  await seedDatabase();
});
