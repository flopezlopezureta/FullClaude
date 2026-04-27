
require('dotenv').config();
const db = require('../db');
const meliPollingService = require('../services/meliPollingService');

async function debugPolling() {
    console.log("Starting debug polling...");
    try {
        await meliPollingService.autoImportMeliPackages();
        console.log("Done.");
    } catch (err) {
        console.error("Error during debug polling:", err);
    }
    process.exit(0);
}

debugPolling();
