import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const HEX_KEY_RE = /^[0-9a-f]{64}$/i;

function loadKey(secretHex) {
  if (!secretHex || !HEX_KEY_RE.test(secretHex)) {
    throw new Error('Encryption key must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(secretHex, 'hex');
}

// Payload format: base64( iv[12 bytes] || authTag[16 bytes] || ciphertext )
export function encryptSecret(plaintext, secretHex) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('plaintext must be a non-empty string');
  }
  const key = loadKey(secretHex);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(payload, secretHex) {
  const key = loadKey(secretHex);
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const authTag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function timingSafeTokenEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
