import crypto from 'crypto';

/**
 * Server-side encryption utilities
 * Uses Node.js crypto module for AES-GCM encryption
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits for GCM auth tag

/**
 * Generate a new encryption key for a conversation
 * Returns base64-encoded key
 * Note: This is not currently used - keys are derived from MASTER_ENCRYPTION_KEY
 */
export function generateConversationKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - The message to encrypt
 * @param keyBase64 - Base64-encoded encryption key
 * @returns Object with ciphertext and iv (both base64-encoded)
 */
export function encryptMessage(plaintext: string, keyBase64: string): { ciphertext: string; iv: string } {
  const key = Buffer.from(keyBase64, 'base64');
  
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Combine ciphertext and auth tag (GCM requires auth tag for decryption)
  const combined = Buffer.concat([
    Buffer.from(ciphertext, 'base64'),
    authTag
  ]).toString('base64');

  return {
    ciphertext: combined,
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param ciphertextBase64 - Base64-encoded ciphertext (includes auth tag)
 * @param ivBase64 - Base64-encoded initialization vector
 * @param keyBase64 - Base64-encoded encryption key
 * @returns Decrypted plaintext
 */
export function decryptMessage(ciphertextBase64: string, ivBase64: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  const iv = Buffer.from(ivBase64, 'base64');
  
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }

  const combined = Buffer.from(ciphertextBase64, 'base64');
  
  // Extract ciphertext and auth tag
  const ciphertext = combined.slice(0, -TAG_LENGTH);
  const authTag = combined.slice(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, undefined, 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Derive a conversation key from a master key and conversation ID
 * This allows key rotation and better key management
 */
export function deriveConversationKey(masterKey: string, conversationId: string): string {
  return crypto
    .createHmac('sha256', Buffer.from(masterKey, 'base64'))
    .update(conversationId)
    .digest('base64');
}

