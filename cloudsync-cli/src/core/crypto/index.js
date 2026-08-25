/**
 * crypto/index.js - Native AES-256-GCM Snapshot Encryption for CloudSync-CLI
 * 
 * Features:
 * - Authenticated AES-256-GCM encryption with 128-bit authentication tag
 * - Key derivation using Scrypt with cryptographically random 16-byte salt
 * - Zero external dependencies (uses native node:crypto)
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // 96-bit standard for GCM
const TAG_LENGTH = 16; // 128-bit auth tag
const KEY_LENGTH = 32; // 256-bit key

/**
 * Derive 256-bit key from passphrase and salt using Scrypt
 * @param {string} passphrase 
 * @param {Buffer} salt 
 * @returns {Buffer}
 */
export function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
}

/**
 * Encrypt a buffer with AES-256-GCM
 * @param {Buffer} data - Plaintext buffer
 * @param {string} passphrase - User encryption secret
 * @returns {Buffer} - Encrypted payload [salt (16b) + iv (12b) + tag (16b) + ciphertext]
 */
export function encryptData(data, passphrase) {
  if (!passphrase) throw new Error('Passphrase is required for encryption');
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine: salt (16) + iv (12) + tag (16) + ciphertext
  return Buffer.concat([salt, iv, tag, encrypted]);
}

/**
 * Decrypt an AES-256-GCM payload
 * @param {Buffer} encryptedData - Combined payload
 * @param {string} passphrase - User encryption secret
 * @returns {Buffer} - Decrypted plaintext buffer
 */
export function decryptData(encryptedData, passphrase) {
  if (!passphrase) throw new Error('Passphrase is required for decryption');
  if (encryptedData.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid or corrupted encrypted payload');
  }

  const salt = encryptedData.subarray(0, SALT_LENGTH);
  const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = encryptedData.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const ciphertext = encryptedData.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
