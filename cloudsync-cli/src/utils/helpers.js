/**
 * Utility helpers for CloudSync-CLI
 */

import { readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Format duration to human readable
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Parse patterns into array
 */
export function parsePatterns(input) {
  if (!input) return [];
  return input.split(',').map(p => p.trim()).filter(Boolean);
}

/**
 * Match file against patterns
 */
export function matchPatterns(file, patterns) {
  if (!patterns || patterns.length === 0) return true;
  
  const filename = basename(file);
  
  return patterns.some(pattern => {
    if (pattern.startsWith('*')) {
      return filename.endsWith(pattern.slice(1));
    }
    if (pattern.endsWith('*')) {
      return filename.startsWith(pattern.slice(0, -1));
    }
    return file.includes(pattern) || filename.includes(pattern);
  });
}

/**
 * Calculate directory statistics
 */
export function calculateDirStats(dir, excludePatterns = []) {
  let totalFiles = 0;
  let totalSize = 0;
  let lastModified = new Date(0);

  function scan(currentDir) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        
        // Check exclusions
        if (excludePatterns.some(p => fullPath.includes(p))) continue;
        
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile()) {
          try {
            const stat = statSync(fullPath);
            totalFiles++;
            totalSize += stat.size;
            if (stat.mtime > lastModified) {
              lastModified = stat.mtime;
            }
          } catch (e) {
            // Skip inaccessible files
          }
        }
      }
    } catch (e) {
      // Skip inaccessible directories
    }
  }

  scan(dir);

  return {
    files: totalFiles,
    size: totalSize,
    lastModified: lastModified > new Date(0) ? lastModified : null
  };
}

/**
 * Get file extension category
 */
export function getFileCategory(filename) {
  const ext = extname(filename).toLowerCase();
  const categories = {
    code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php'],
    config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.env', '.config'],
    markup: ['.html', '.htm', '.xml', '.md', '.markdown'],
    style: ['.css', '.scss', '.sass', '.less', '.styl'],
    image: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'],
    document: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
    archive: ['.zip', '.tar', '.gz', '.rar', '.7z'],
    data: ['.csv', '.tsv', '.sql', '.db']
  };

  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(ext)) {
      return category;
    }
  }

  return 'other';
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Deep merge objects
 */
export function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Create progress bar
 */
export function createProgressBar(current, total, width = 30) {
  const percent = Math.floor((current / total) * 100);
  const filled = Math.floor((current / total) * width);
  const empty = width - filled;
  
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
}

/**
 * Sleep/delay utility
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry(fn, maxAttempts = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        await sleep(baseDelay * Math.pow(2, attempt - 1));
      }
    }
  }
  
  throw lastError;
}

/**
 * Validate SSH key format
 */
export function validateSSHKey(keyPath) {
  try {
    const fs = require('fs');
    const content = fs.readFileSync(keyPath, 'utf8');
    
    // Check for valid SSH key headers
    const validHeaders = [
      '-----BEGIN OPENSSH PRIVATE KEY-----',
      '-----BEGIN RSA PRIVATE KEY-----',
      '-----BEGIN DSA PRIVATE KEY-----',
      '-----BEGIN EC PRIVATE KEY-----',
      '-----BEGIN ED25519 PRIVATE KEY-----'
    ];
    
    return validHeaders.some(header => content.includes(header));
  } catch (e) {
    return false;
  }
}

/**
 * Get file icon based on extension
 */
export function getFileIcon(filename) {
  const category = getFileCategory(filename);
  const icons = {
    code: '📄',
    config: '⚙️',
    markup: '📝',
    style: '🎨',
    image: '🖼️',
    document: '📃',
    archive: '📦',
    data: '📊',
    other: '📁'
  };
  
  return icons[category] || icons.other;
}
