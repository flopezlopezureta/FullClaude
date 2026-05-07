const https = require('https');

function checkLatency() {
    const start = Date.now();
    https.get('https://google.com', (res) => {
        const latency = Date.now() - start;
        console.log(`Latency to Google: ${latency}ms`);
        process.exit(0);
    }).on('error', (e) => {
        console.error(e);
        process.exit(1);
    });
}

checkLatency();
