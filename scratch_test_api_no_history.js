const jwt = require('jsonwebtoken');

const JWT_SECRET = 'fullenvios_jwt_secret_2024';
const payload = {
    user: {
        id: 'user-admin-id',
        role: 'ADMIN',
        name: 'Test Admin'
    }
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

async function testRequest() {
    try {
        console.log('Sending request to http://localhost:3000/api/packages?limit=0&excludePhotos=true&includeHistory=false&startDate=2026-05-01&endDate=2026-05-31 ...');
        const t0 = Date.now();
        const response = await fetch('http://localhost:3000/api/packages?limit=0&excludePhotos=true&includeHistory=false&startDate=2026-05-01&endDate=2026-05-31', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log(`Response status: ${response.status} (${response.statusText})`);
        const data = await response.json();
        
        if (response.ok) {
            console.log(`SUCCESS! Loaded ${data.packages.length} packages (no history) in ${Date.now() - t0}ms.`);
        } else {
            console.error('ERROR response body:', data);
        }
    } catch (e) {
        console.error('Fetch request failed:', e.message);
    }
    process.exit(0);
}

testRequest();
