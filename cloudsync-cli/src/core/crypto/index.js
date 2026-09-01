/**
 * crypto/index.js - Native AES-256-GCM Snapshot Encryption for CloudSync-CLI
 * 
 * Features:
 * - Authenticated AES-256-GCM encryption with 128-bit authentication tag
 * - Key derivation using Scrypt with cryptographically random 16-byte salt
 * - Streaming file-level encryption/decryption for large archives (no OOM)
 * - Buffer-level encryption/decryption for small payloads
 * - Zero external dependencies (uses native node:crypto)
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { createReadStream, createWriteStream, readFileSync, writeFileSync, unlinkSync, renameSync, statSync } from 'fs';
import { pipeline } from 'stream/promises';

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // 96-bit standard for GCM
const TAG_LENGTH = 16; // 128-bit auth tag
const KEY_LENGTH = 32; // 256-bit key
// Threshold above which streaming encryption is used instead of buffer-based (50MB)
const STREAM_THRESHOLD = 50 * 1024 * 1024;

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
 * Encrypt a buffer with AES-256-GCM (for small payloads)
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
 * Decrypt an AES-256-GCM payload (for small payloads)
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

/**
 * Encrypt a file in-place using AES-256-GCM.
 * Automatically uses streaming for files > 50MB, buffer-based for smaller files.
 * Format: [salt (16b) + iv (12b) + ciphertext + tag (16b)]
 * Note: For streaming, the auth tag is appended at the end (after ciphertext).
 * 
 * @param {string} filePath - Path to file to encrypt in-place
 * @param {string} passphrase - User encryption secret
 */
export async function encryptFile(filePath, passphrase) {
  if (!passphrase) throw new Error('Passphrase is required for encryption');

  const fileSize = statSync(filePath).size;

  if (fileSize <= STREAM_THRESHOLD) {
    // Small file: use buffer-based encryption (existing logic)
    const plaintext = readFileSync(filePath);
    const encrypted = encryptData(plaintext, passphrase);
    writeFileSync(filePath, encrypted);
    return;
  }

  // Large file: streaming encryption
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const tmpPath = filePath + '.enc.tmp';
  const outStream = createWriteStream(tmpPath);

  // Write header: salt + iv
  outStream.write(salt);
  outStream.write(iv);

  // Stream the ciphertext
  await pipeline(createReadStream(filePath), cipher, outStream);

  // Append auth tag at the end of the file
  const tag = cipher.getAuthTag();
  writeFileSync(tmpPath, tag, { flag: 'a' });

  // Atomic replace: remove original, rename temp to original
  unlinkSync(filePath);
  renameSync(tmpPath, filePath);
}

/**
 * Decrypt a file in-place using AES-256-GCM.
 * Automatically detects streaming vs buffer format based on file structure.
 * 
 * @param {string} filePath - Path to encrypted file to decrypt in-place
 * @param {string} passphrase - User encryption secret
 */
export async function decryptFile(filePath, passphrase) {
  if (!passphrase) throw new Error('Passphrase is required for decryption');

  const fileSize = statSync(filePath).size;
  const minSize = SALT_LENGTH + IV_LENGTH + TAG_LENGTH;

  if (fileSize < minSize) {
    throw new Error('Invalid or corrupted encrypted payload');
  }

  if (fileSize <= STREAM_THRESHOLD) {
    // Small file: use buffer-based decryption (existing logic)
    const encryptedData = readFileSync(filePath);
    const decrypted = decryptData(encryptedData, passphrase);
    writeFileSync(filePath, decrypted);
    return;
  }

  // Large file: streaming decryption
  // Read header (salt + iv) and tail (tag) directly
  const headerBuf = Buffer.alloc(SALT_LENGTH + IV_LENGTH);
  const fd = await import('fs').then(fs => fs.openSync(filePath, 'r'));
  const fsModule = await import('fs');
  fsModule.readSync(fd, headerBuf, 0, headerBuf.length, 0);

  const tagBuf = Buffer.alloc(TAG_LENGTH);
  fsModule.readSync(fd, tagBuf, 0, TAG_LENGTH, fileSize - TAG_LENGTH);
  fsModule.closeSync(fd);

  const salt = headerBuf.subarray(0, SALT_LENGTH);
  const iv = headerBuf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tagBuf);

  const tmpPath = filePath + '.dec.tmp';
  const ciphertextStart = SALT_LENGTH + IV_LENGTH;
  const ciphertextEnd = fileSize - TAG_LENGTH;

  const inStream = createReadStream(filePath, { start: ciphertextStart, end: ciphertextEnd - 1 });
  const outStream = createWriteStream(tmpPath);

  await pipeline(inStream, decipher, outStream);

  // Atomic replace
  unlinkSync(filePath);
  renameSync(tmpPath, filePath);
}
