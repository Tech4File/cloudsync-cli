/**
 * Crypto Utilities - Encryption, hashing, and secure operations
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

class CryptoUtils {
  /**
   * Generate SHA-256 hash
   */
  static sha256(data) {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate SHA-512 hash
   */
  static sha512(data) {
    return createHash('sha512').update(data).digest('hex');
  }

  /**
   * Generate random token
   */
  static generateToken(length = 32) {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generate session ID
   */
  static generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * Hash password with salt
   */
  static hashPassword(password, salt = null) {
    const useSalt = salt || randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(password + useSalt)
      .digest('hex');
    return { hash, salt: useSalt };
  }

  /**
   * Verify password
   */
  static verifyPassword(password, hash, salt) {
    const result = createHash('sha256')
      .update(password + salt)
      .digest('hex');
    return result === hash;
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  static encrypt(data, key) {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  static decrypt(encryptedData, key, iv, authTag) {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex'),
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Calculate file checksum
   */
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

  /**
   * Generate secure random bytes
   */
  static secureRandom(size = 32) {
    return randomBytes(size);
  }

  /**
   * Create HMAC
   */
  static hmac(data, key, algorithm = 'sha256') {
    const crypto = require('crypto');
    return crypto.createHmac(algorithm, key).update(data).digest('hex');
  }

  /**
   * Verify HMAC
   */
  static verifyHmac(data, key, signature, algorithm = 'sha256') {
    const computed = this.hmac(data, key, algorithm);
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature)
    );
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitive(data, visibleChars = 4) {
    if (typeof data !== 'string') return data;
    if (data.length <= visibleChars * 2) return '*'.repeat(data.length);
    
    const start = data.slice(0, visibleChars);
    const end = data.slice(-visibleChars);
    const middle = '*'.repeat(Math.min(data.length - visibleChars * 2, 10));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Sanitize filename
   */
  static sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
}

export default CryptoUtils;
export { CryptoUtils };
