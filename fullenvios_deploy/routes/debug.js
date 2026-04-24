const express = require('express');
const router = express.Router();
const db = require('../db');

// This file was missing and is referenced in server.js.
// Creating a placeholder to ensure server stability.

// Example debug route to check DB connection
router.get('/db-check', async (req, res) => {
    try {
        const { rows: dbInfo } = await db.query("SELECT current_database(), current_user, inet_server_addr()");
        const { rows: packageCount } = await db.query("SELECT count(*) FROM packages");
        
        res.status(200).json({ 
            status: 'ok', 
            message: 'Database connection successful.',
            database: dbInfo[0].current_database,
            user: dbInfo[0].current_user,
            server_addr: dbInfo[0].inet_server_addr,
            packageCount: parseInt(packageCount[0].count),
            envHost: process.env.DB_HOST,
            envName: process.env.DB_NAME,
            nodeEnv: process.env.NODE_ENV
        });
    } catch (err) {
        res.status(500).json({ 
            status: 'error', 
            message: 'Database connection failed.', 
            error: err.message,
            envHost: process.env.DB_HOST,
            envName: process.env.DB_NAME
        });
    }
});

module.exports = router;
