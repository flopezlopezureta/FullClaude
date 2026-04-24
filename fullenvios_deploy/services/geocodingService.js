
const db = require('../db');

let isGeocoding = false;

// Helper function to geocode address
async function geocodeAddress(address, commune, city) {
    if (!address || !commune) return { lat: null, lng: null };
    
    try {
        // Construct a search query. Prioritize street + commune + country
        const query = `${address}, ${commune}, Chile`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'FullEnviosApp/1.0' // Nominatim requires a User-Agent
            }
        });

        if (!response.ok) return { lat: null, lng: null };
        
        const data = await response.json();
        if (data && data.length > 0) {
            return { 
                lat: parseFloat(data[0].lat), 
                lng: parseFloat(data[0].lon) 
            };
        }
    } catch (error) {
        console.error("Geocoding error:", error.message);
    }
    return { lat: null, lng: null };
}

async function triggerBackgroundGeocoding() {
    if (isGeocoding) return;
    isGeocoding = true;
    
    console.log("Starting background geocoding process...");
    try {
        while (true) {
            // Find packages with null coordinates that haven't been tried recently or at all
            const { rows: pending } = await db.query(
                'SELECT id, "recipientAddress", "recipientCommune", "recipientCity" FROM packages WHERE "destLatitude" IS NULL LIMIT 10'
            );
            
            if (pending.length === 0) {
                console.log("No more packages to geocode.");
                break;
            }
            
            for (const pkg of pending) {
                console.log(`Geocoding package ${pkg.id}: ${pkg.recipientAddress}, ${pkg.recipientCommune}`);
                const coords = await geocodeAddress(pkg.recipientAddress, pkg.recipientCommune, pkg.recipientCity);
                
                if (coords.lat !== null) {
                    await db.query(
                        'UPDATE packages SET "destLatitude" = $1, "destLongitude" = $2 WHERE id = $3',
                        [coords.lat, coords.lng, pkg.id]
                    );
                } else {
                    // Mark as tried by setting to a very small non-zero value if we want to avoid re-trying
                    // To avoid infinite loops on bad addresses, let's set to 0.000001
                    await db.query(
                        'UPDATE packages SET "destLatitude" = 0.000001, "destLongitude" = 0.000001 WHERE id = $1',
                        [pkg.id]
                    );
                }
                // Respect Nominatim rate limit (1 request per second)
                await new Promise(r => setTimeout(r, 1200));
            }
        }
    } catch (error) {
        console.error("Background geocoding error:", error);
    } finally {
        isGeocoding = false;
        console.log("Background geocoding process finished.");
    }
}

module.exports = {
    geocodeAddress,
    triggerBackgroundGeocoding
};
