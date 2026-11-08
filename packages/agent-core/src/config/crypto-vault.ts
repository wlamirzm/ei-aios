// ==============================================================================
// CRYPTO VAULT: AES-256-GCM SYMMETRIC ENCRYPTION FOR EMAIL & SYSTEM SECRETS
// Sprint 1 - BKL-002
// ==============================================================================

import crypto from 'node:crypto';
import { env } from './env.js';

const ENCRYPTION_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';

function resolveVaultKey(customSecret?: string): Buffer {
  const rawMaterial =
    customSecret ||
    env.EMAIL_SECRET_KEY ||
    process.env.JWT_SECRET ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    'ei-aios-default-vault-master-secret-key-2026';

  return crypto.createHash('sha256').update(rawMaterial, 'utf8').digest();
}

export function isEncryptedSecret(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith(ENCRYPTION_PREFIX) && value.split(':').length === 5;
}

/**
 * Criptografa um segredo em texto plano usando AES-256-GCM com IV de 12 bytes e AuthTag de 16 bytes.
 * Idempotente: se já estiver criptografado com 'enc:v1:', retorna sem re-criptografar.
 */
export function encryptSecret(plaintext: string, customSecret?: string): string {
  if (!plaintext) return '';
  if (isEncryptedSecret(plaintext)) {
    return plaintext;
  }

  const key = resolveVaultKey(customSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descriptografa um segredo em formato 'enc:v1:<iv_hex>:<tag_hex>:<cipher_hex>'.
 * Se o valor ainda estiver em formato legado (texto puro), retorna o texto puro para retrocompatibilidade
 * enquanto a migração em background o converte no banco.
 */
export function decryptSecret(payload: string, customSecret?: string): string {
  if (!payload) return '';
  if (!payload.startsWith(ENCRYPTION_PREFIX)) {
    return payload;
  }

  const parts = payload.slice(ENCRYPTION_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de segredo criptografado inválido (enc:v1 corrompido).');
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = resolveVaultKey(customSecret);
  const iv = Buffer.from(ivHex!, 'hex');
  const authTag = Buffer.from(authTagHex!, 'hex');
  const encrypted = Buffer.from(cipherHex!, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
