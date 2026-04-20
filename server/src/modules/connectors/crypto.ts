import crypto from 'node:crypto';

import { env } from '@/utils/env';

const ENCRYPTION_VERSION = 'v1';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

function getKey() {
  return crypto.createHash('sha256').update(env.JWT_SECRET).digest().subarray(0, KEY_LENGTH);
}

export function encryptConnectorSecret(plainText: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptConnectorSecret(serialized: string) {
  const [version, ivPart, authTagPart, ciphertextPart] = serialized.split('.');

  if (version !== ENCRYPTION_VERSION || !ivPart || !authTagPart || !ciphertextPart) {
    throw new Error('Unsupported encrypted connector secret payload');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

  const plainText = Buffer.concat([decipher.update(Buffer.from(ciphertextPart, 'base64url')), decipher.final()]);

  return plainText.toString('utf8');
}
