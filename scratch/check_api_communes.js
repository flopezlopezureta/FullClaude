const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/settings/system', // Using /system because it doesn't require auth
  method: 'GET',
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', error => console.error(error));
req.end();
