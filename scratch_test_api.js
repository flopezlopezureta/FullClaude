const jwt = require('jsonwebtoken');

// Generate an admin token matching the signature in authMiddleware
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
        console.log('Sending request to http://localhost:3000/api/packages?limit=0&excludePhotos=true ...');
        const t0 = Date.now();
        const response = await fetch('http://localhost:3000/api/packages?limit=0&excludePhotos=true', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log(`Response status: ${response.status} (${response.statusText})`);
        const data = await response.json();
        
        if (response.ok) {
            console.log(`SUCCESS! Loaded ${data.packages.length} packages in ${Date.now() - t0}ms.`);
            if (data.packages.length > 0) {
                console.log('Sample package structure:', Object.keys(data.packages[0]));
                console.log('flexLabelPhotoBase64:', data.packages[0].flexLabelPhotoBase64);
                console.log('deliveryPhotosBase64:', data.packages[0].deliveryPhotosBase64);
            }
        } else {
            console.error('ERROR response body:', data);
        }
    } catch (e) {
        console.error('Fetch request failed:', e.message);
    }
    process.exit(0);
}

// Wait for server to be fully ready
setTimeout(testRequest, 2000);
