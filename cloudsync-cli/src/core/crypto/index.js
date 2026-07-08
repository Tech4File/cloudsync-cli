/**
 * Crypto Utilities - Encryption, hashing, and secure operations
 */

import crypto from 'crypto';
const { createHash, randomBytes, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } = crypto;

class CryptoUtils {
  static sha256(data) {
    return createHash('sha256').update(data).digest('hex');
  }

  static sha512(data) {
    return createHash('sha512').update(data).digest('hex');
  }

  static generateToken(length = 32) {
    return randomBytes(length).toString('hex');
  }

  static generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }

  static hashPassword(password, salt = null) {
    const useSalt = salt || randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(password + useSalt).digest('hex');
    return { hash, salt: useSalt };
  }

  static verifyPassword(password, hash, salt) {
    const result = createHash('sha256').update(password + salt).digest('hex');
    return result === hash;
  }

  static encrypt(data, key) {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return { encrypted, iv: iv.toString('hex'), authTag: authTag.toString('hex') };
  }

  static decrypt(encryptedData, key, iv, authTag) {
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static async fileChecksum(filePath, algorithm = 'sha256') {
    const fs = await import('fs');
    const hash = createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  static secureRandom(size = 32) {
    return randomBytes(size);
  }

  static hmac(data, key, algorithm = 'sha256') {
    return createHmac(algorithm, key).update(data).digest('hex');
  }

  static verifyHmac(data, key, signature, algorithm = 'sha256') {
    const computed = this.hmac(data, key, algorithm);
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  }

  static maskSensitive(data, visibleChars = 4) {
    if (typeof data !== 'string') return data;
    if (data.length <= visibleChars * 2) return '*'.repeat(data.length);
    const start = data.slice(0, visibleChars);
    const end = data.slice(-visibleChars);
    const middle = '*'.repeat(Math.min(data.length - visibleChars * 2, 10));
    return `${start}${middle}${end}`;
  }

  static sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
}

export default CryptoUtils;
export { CryptoUtils };
