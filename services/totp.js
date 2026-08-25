const crypto = require('crypto');

// RFC 4648 base32 (no padding) — authenticator apps expect the secret in this form.
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
    let bits = '';
    for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
    while (bits.length % 5 !== 0) bits += '0';
    let output = '';
    for (let i = 0; i < bits.length; i += 5) {
        output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
    }
    return output;
}

function base32Decode(base32) {
    const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = '';
    for (const char of clean) {
        const val = BASE32_ALPHABET.indexOf(char);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}

// RFC 4226 HOTP over a raw secret buffer.
function hotp(secretBuffer, counter) {
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binCode = ((hmac[offset] & 0x7f) << 24) |
                     ((hmac[offset + 1] & 0xff) << 16) |
                     ((hmac[offset + 2] & 0xff) << 8) |
                     (hmac[offset + 3] & 0xff);
    return (binCode % 1000000).toString().padStart(6, '0');
}

const TIME_STEP_SECONDS = 30;

function generateSecret() {
    return base32Encode(crypto.randomBytes(20)); // 160-bit secret, standard for TOTP
}

// Builds the otpauth:// URI an authenticator app scans as a QR code.
function buildOtpAuthUri(secretBase32, accountLabel, issuer = 'Full Envios') {
    const label = encodeURIComponent(`${issuer}:${accountLabel}`);
    const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: 'SHA1', digits: '6', period: String(TIME_STEP_SECONDS) });
    return `otpauth://totp/${label}?${params.toString()}`;
}

// Accepts the current 30s window plus one step on either side (±30s) to tolerate normal
// clock drift between the phone and the server — same tolerance most TOTP implementations use.
function verifyTotp(secretBase32, token) {
    if (!/^\d{6}$/.test(String(token || ''))) return false;
    const secretBuffer = base32Decode(secretBase32);
    const currentCounter = Math.floor(Date.now() / 1000 / TIME_STEP_SECONDS);
    for (let drift = -1; drift <= 1; drift++) {
        const candidate = hotp(secretBuffer, currentCounter + drift);
        if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(String(token)))) {
            return true;
        }
    }
    return false;
}

module.exports = { generateSecret, buildOtpAuthUri, verifyTotp };
