/**
 * security.js - Production-grade security utilities for CloudSync-CLI
 * 
 * Provides: safe JSON parsing, path traversal prevention, input sanitization,
 * secure file operations, and content security validation.
 */

import { resolve, normalize, sep } from 'path';
import { existsSync, statSync } from 'fs';

/**
 * Safely parse JSON with error handling - prevents crash on malformed data
 * @param {string} data - Raw JSON string
 * @param {*} fallback - Default value if parsing fails
 * @returns {*} Parsed object or fallback
 */
export function safeJsonParse(data, fallback = null) {
  try {
    if (typeof data !== 'string' || data.trim().length === 0) return fallback;
    const parsed = JSON.parse(data);
    // Prevent prototype pollution via __proto__ or constructor
    if (typeof parsed === 'object' && parsed !== null) {
      sanitizeObject(parsed);
    }
    return parsed;
  } catch (e) {
    return fallback;
  }
}

/**
 * Recursively remove dangerous prototype pollution keys
 * @param {object} obj - Object to sanitize
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  for (const key of Object.keys(obj)) {
    if (dangerous.includes(key)) {
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * Validate and sanitize a file path to prevent path traversal attacks
 * Supports POSIX and Windows filesystem boundaries cleanly.
 * 
 * @param {string} inputPath - User-provided path
 * @param {string} baseDir - Allowed base directory
 * @returns {{ safe: boolean, resolved: string, error?: string }}
 */
export function safePath(inputPath, baseDir = process.cwd()) {
  try {
    if (!inputPath || typeof inputPath !== 'string') {
      return { safe: false, resolved: '', error: 'Invalid path input' };
    }

    // Reject null bytes (common path traversal technique)
    if (inputPath.includes('\0')) {
      return { safe: false, resolved: '', error: 'Path contains null bytes' };
    }

    const resolvedBase = resolve(baseDir);
    const resolvedPath = resolve(resolvedBase, inputPath);
    const normalizedPath = normalize(resolvedPath);

    const isWindows = process.platform === 'win32';
    const checkBase = isWindows ? resolvedBase.toLowerCase() : resolvedBase;
    const checkPath = isWindows ? normalizedPath.toLowerCase() : normalizedPath;

    // Ensure the resolved path is within the base directory or exactly matches base directory
    const basePrefix = checkBase.endsWith(sep) ? checkBase : checkBase + sep;
    if (!checkPath.startsWith(basePrefix) && checkPath !== checkBase) {
      return { safe: false, resolved: normalizedPath, error: 'Path traversal detected' };
    }

    return { safe: true, resolved: normalizedPath };
  } catch (e) {
    return { safe: false, resolved: '', error: e.message };
  }
}

/**
 * Validate that a filename is safe (no path traversal characters or reserved device names)
 * @param {string} filename 
 * @returns {boolean}
 */
export function isSafeFilename(filename) {
  if (!filename || typeof filename !== 'string') return false;
  if (filename.includes('/') || filename.includes('\\') || filename.includes('\0')) return false;
  if (filename === '.' || filename === '..') return false;
  
  // Windows reserved device names
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
  if (reserved.test(filename)) return false;

  return true;
}

/**
 * Sanitize user input strings - removes control characters and limits length
 * @param {string} input - Raw user input
 * @param {number} maxLength - Maximum allowed length (default: 1024)
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input, maxLength = 1024) {
  if (typeof input !== 'string') return '';
  // Remove control characters except newline/tab
  let cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Truncate to max length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }
  return cleaned;
}

/**
 * Validate hostname format to prevent SSRF/injection
 * @param {string} host - Hostname to validate
 * @returns {boolean}
 */
export function isValidHost(host) {
  if (!host || typeof host !== 'string') return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
  // Allow domains and IPs, reject anything with special characters
  const hostRegex = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
  return hostRegex.test(host) && host.length <= 253;
}

/**
 * Validate port number
 * @param {number|string} port - Port to validate
 * @returns {boolean}
 */
export function isValidPort(port) {
  const p = parseInt(port, 10);
  return Number.isInteger(p) && p >= 1 && p <= 65535;
}

/**
 * Validate SSH username
 * @param {string} username - Username to validate
 * @returns {boolean}
 */
export function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  // Unix usernames: alphanumeric, dash, underscore, dot
  const usernameRegex = /^[a-zA-Z_][a-zA-Z0-9._-]{0,31}$/;
  return usernameRegex.test(username);
}

/**
 * Validate file size is within limits
 * @param {string} filePath - Path to file
 * @param {number} maxSizeMB - Max size in MB (default: 500)
 * @returns {{ valid: boolean, size: number, error?: string }}
 */
export function validateFileSize(filePath, maxSizeMB = 500) {
  try {
    if (!existsSync(filePath)) {
      return { valid: false, size: 0, error: 'File not found' };
    }
    const stats = statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return { valid: false, size: stats.size, error: `File exceeds ${maxSizeMB}MB limit (${sizeMB.toFixed(1)}MB)` };
    }
    return { valid: true, size: stats.size };
  } catch (e) {
    return { valid: false, size: 0, error: e.message };
  }
}

/**
 * Rate limiter for share server endpoints with auto-cleanup
 */
export class RateLimiter {
  constructor(maxRequests = 60, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
    this.calls = 0;
  }

  /**
   * Check if a client IP is rate-limited
   * @param {string} ip - Client IP
   * @returns {boolean} true if allowed, false if rate-limited
   */
  isAllowed(ip) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Periodic automatic cleanup every 100 requests to prevent memory leakage
    if (++this.calls % 100 === 0) {
      this.cleanup();
    }

    if (!this.requests.has(ip)) {
      this.requests.set(ip, []);
    }

    const timestamps = this.requests.get(ip).filter(t => t > windowStart);
    this.requests.set(ip, timestamps);

    if (timestamps.length >= this.maxRequests) {
      return false;
    }

    timestamps.push(now);
    return true;
  }

  /** Cleanup old entries */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [ip, timestamps] of this.requests) {
      const filtered = timestamps.filter(t => t > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, filtered);
      }
    }
  }
}

/**
 * Mask sensitive data in logs/output
 * @param {string} value - Value to mask
 * @param {number} visibleChars - Number of chars to show at start/end
 * @returns {string}
 */
export function maskSensitive(value, visibleChars = 4) {
  if (!value || typeof value !== 'string') return '****';
  if (value.length <= visibleChars * 2) return '*'.repeat(value.length);
  return value.slice(0, visibleChars) + '*'.repeat(Math.min(value.length - visibleChars * 2, 16)) + value.slice(-visibleChars);
}

/**
 * Sanitize environment variable names (prevent injection)
 * @param {string} name - Variable name
 * @returns {string} Sanitized name
 */
export function sanitizeEnvName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

export default {
  safeJsonParse,
  safePath,
  isSafeFilename,
  sanitizeInput,
  isValidHost,
  isValidPort,
  isValidUsername,
  validateFileSize,
  RateLimiter,
  maskSensitive,
  sanitizeEnvName
};
