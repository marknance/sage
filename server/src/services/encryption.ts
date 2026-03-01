import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc:';

function getEncryptionKey(): Buffer {
  if (process.env.ENCRYPTION_KEY) {
    const salt = process.env.ENCRYPTION_SALT;
    if (!salt || salt.length < 16) {
      throw new Error('ENCRYPTION_SALT must be set (min 16 chars) when using ENCRYPTION_KEY');
    }
    return crypto.scryptSync(process.env.ENCRYPTION_KEY, salt, 32);
  }

  const keyPath = path.join(__dirname, '..', '..', 'data', '.encryption_key');
  if (fs.existsSync(keyPath)) {
    return Buffer.from(fs.readFileSync(keyPath, 'utf-8').trim(), 'hex');
  }

  // Auto-generate key on first run
  const key = crypto.randomBytes(32);
  const dataDir = path.dirname(keyPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
  logger.info('Generated encryption key at %s', keyPath);
  return key;
}

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!cachedKey) cachedKey = getEncryptionKey();
  return cachedKey;
}

export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext; // already encrypted

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return ENCRYPTED_PREFIX + combined.toString('base64');
}

export function decrypt(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) return encrypted; // plaintext (legacy)

  const key = getKey();
  const data = Buffer.from(encrypted.slice(ENCRYPTED_PREFIX.length), 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}
