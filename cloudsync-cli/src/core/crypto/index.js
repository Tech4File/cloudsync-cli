/**
 * crypto/index.js - Native AES-256-GCM snapshot encryption for CloudSync-CLI
 *
 * Key derivation uses Scrypt with a random 16-byte salt per payload.
 * Files above STREAM_THRESHOLD are encrypted/decrypted as streams so large
 * snapshots never need to fit in memory; smaller ones use the buffer path.
 *
 * On-disk layouts (v2 — current):
 *   0x01 buffer-style: [fmt(1B)][salt 16B][iv 12B][tag 16B][ciphertext]
 *   0x02 stream-style: [fmt(1B)][salt 16B][iv 12B][ciphertext...][tag 16B]
 *     — the tag is at the END of stream-style files (written after the
 *       ciphertext drains). Used when size > STREAM_THRESHOLD.
 *
 * The format byte lets decryptFile and extractArchive route to the right
 * decoder. Older v1 payloads (no header, [salt|iv|tag|ciphertext]) are
 * still recognized and decoded for backward compatibility.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { createReadStream, createWriteStream, readFileSync, writeFileSync, unlinkSync, renameSync, statSync } from 'fs';
import { pipeline } from 'stream/promises';

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // 96-bit standard for GCM
const TAG_LENGTH = 16; // 128-bit auth tag
const KEY_LENGTH = 32; // 256-bit key
const STREAM_THRESHOLD = 50 * 1024 * 1024;

// v2 format byte — distinguishes our new format from raw zips/buffers
const FORMAT_V2_BUFFER = 0x01;
const FORMAT_V2_STREAM = 0x02;

/**
 * Derive 256-bit key from passphrase and salt using Scrypt
 */
export function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
}

/**
 * Encrypt a buffer with AES-256-GCM (for small payloads)
 * Returns: [format(1B)][salt(16B)][iv(12B)][tag(16B)][ciphertext]
 */
export function encryptData(data, passphrase) {
  if (!passphrase) throw new Error('Passphrase is required for encryption');
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  // v2 layout: format byte first so decoders can route
  const formatHeader = Buffer.from([FORMAT_V2_BUFFER]);
  return Buffer.concat([formatHeader, salt, iv, tag, encrypted]);
}

/**
 * Decrypt an AES-256-GCM payload in memory.
 * Accepts all on-disk layouts:
 * - v2 buffer: [fmt(0x01)][salt][iv][tag][ciphertext]
 * - v2 stream: [fmt(0x02)][salt][iv][ciphertext...][tag]  (tag at the END)
 * - v1 legacy: [salt][iv][tag][ciphertext]                 (no header)
 */
export function decryptData(encryptedData, passphrase) {
  if (!passphrase) throw new Error('Passphrase is required for decryption');
  if (encryptedData.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid or corrupted encrypted payload');
  }

  let salt, iv, tag, ciphertext;
  const firstByte = encryptedData[0];

  if (firstByte === FORMAT_V2_STREAM) {
    // v2 stream layout — tag is the last 16 bytes
    const headerLen = 1 + SALT_LENGTH + IV_LENGTH;
    if (encryptedData.length < headerLen + TAG_LENGTH) {
      throw new Error('Invalid or corrupted encrypted payload');
    }
    salt = encryptedData.subarray(1, 1 + SALT_LENGTH);
    iv = encryptedData.subarray(1 + SALT_LENGTH, headerLen);
    tag = encryptedData.subarray(encryptedData.length - TAG_LENGTH);
    ciphertext = encryptedData.subarray(headerLen, encryptedData.length - TAG_LENGTH);
  } else if (firstByte === FORMAT_V2_BUFFER) {
    // v2 buffer layout — tag sits right after the header
    let offset = 1;
    salt = encryptedData.subarray(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;
    iv = encryptedData.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;
    tag = encryptedData.subarray(offset, offset + TAG_LENGTH);
    offset += TAG_LENGTH;
    ciphertext = encryptedData.subarray(offset);
  } else if (firstByte === 0x50 && encryptedData[1] === 0x4b) {
    // 'PK' — actually a ZIP, not encrypted
    throw new Error('Payload is not encrypted (looks like a ZIP archive)');
  } else {
    // Assume v1 layout (no header): [salt|iv|tag|ciphertext]
    salt = encryptedData.subarray(0, SALT_LENGTH);
    iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    tag = encryptedData.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    ciphertext = encryptedData.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  }

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypt a file in-place using AES-256-GCM.
 * v2 layout on disk: [FORMAT_V2_STREAM(1B)][salt(16B)][iv(12B)][ciphertext...][tag(16B)]
 * Threshold above which we use streaming: 50 MB.
 */
export async function encryptFile(filePath, passphrase) {
  if (!passphrase) throw new Error('Passphrase is required for encryption');

  const fileSize = statSync(filePath).size;

  if (fileSize <= STREAM_THRESHOLD) {
    // Small file: load into memory, encrypt, write back as v2 buffer format
    const plaintext = readFileSync(filePath);
    const encrypted = encryptData(plaintext, passphrase);
    writeFileSync(filePath, encrypted);
    return;
  }

  // Large file: streaming encryption — v2 format with FORMAT_V2_STREAM byte
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const tmpPath = filePath + '.enc.tmp';
  const outStream = createWriteStream(tmpPath);

  // Write v2 header: format byte + salt + iv
  outStream.write(Buffer.from([FORMAT_V2_STREAM]));
  outStream.write(salt);
  outStream.write(iv);

  await pipeline(createReadStream(filePath), cipher, outStream);

  const tag = cipher.getAuthTag();
  writeFileSync(tmpPath, tag, { flag: 'a' });

  unlinkSync(filePath);
  renameSync(tmpPath, filePath);
}

/**
 * Decrypt a file in-place using AES-256-GCM.
 * Auto-detects v1 / v2 (buffer or stream) by inspecting the format byte.
 */
export async function decryptFile(filePath, passphrase) {
  if (!passphrase) throw new Error('Passphrase is required for decryption');

  const fileSize = statSync(filePath).size;
  const minSize = 1 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH;

  if (fileSize < minSize) {
    throw new Error('Invalid or corrupted encrypted payload');
  }

  // Peek at the first byte to decide routing
  const fd = await import('fs');
  const fh = fd.openSync(filePath, 'r');
  const headBuf = Buffer.alloc(1);
  fd.readSync(fh, headBuf, 0, 1, 0);
  fd.closeSync(fh);
  const formatByte = headBuf[0];

  const isV2Stream = formatByte === FORMAT_V2_STREAM;
  const isV2Buffer = formatByte === FORMAT_V2_BUFFER;

  if (fileSize <= STREAM_THRESHOLD && isV2Buffer) {
    // Small v2 buffer file — decode in memory
    const encryptedData = readFileSync(filePath);
    const decrypted = decryptData(encryptedData, passphrase);
    writeFileSync(filePath, decrypted);
    return;
  }

  if (!isV2Stream) {
    // v1 layout or unrecognized — try buffer-style decode
    const encryptedData = readFileSync(filePath);
    try {
      const decrypted = decryptData(encryptedData, passphrase);
      writeFileSync(filePath, decrypted);
      return;
    } catch (e) {
      throw new Error(`Decryption failed (format byte 0x${formatByte.toString(16)}): ${e.message}`);
    }
  }

  // v2 stream format — read header, stream-decrypt
  const headerBuf = Buffer.alloc(SALT_LENGTH + IV_LENGTH);
  const fh2 = fd.openSync(filePath, 'r');
  fd.readSync(fh2, headerBuf, 0, headerBuf.length, 1); // skip format byte

  const tagBuf = Buffer.alloc(TAG_LENGTH);
  fd.readSync(fh2, tagBuf, 0, TAG_LENGTH, fileSize - TAG_LENGTH);
  fd.closeSync(fh2);

  const salt = headerBuf.subarray(0, SALT_LENGTH);
  const iv = headerBuf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tagBuf);

  const tmpPath = filePath + '.dec.tmp';
  const ciphertextStart = 1 + SALT_LENGTH + IV_LENGTH;
  const ciphertextEnd = fileSize - TAG_LENGTH;

  const inStream = createReadStream(filePath, { start: ciphertextStart, end: ciphertextEnd - 1 });
  const outStream = createWriteStream(tmpPath);

  await pipeline(inStream, decipher, outStream);

  unlinkSync(filePath);
  renameSync(tmpPath, filePath);
}
