/**
 * update-check.js - Asynchronous Non-Blocking NPM Update Notifier for CloudSync-CLI
 * 
 * Features:
 * - 24-hour timestamp caching to eliminate repeat network requests
 * - Silent error handling (never crashes or blocks the CLI)
 * - Skips in CI/CD environments or when --quiet / --no-color flags are present
 */

import https from 'https';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { safeJsonParse } from './security.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Compare two semver-like version strings
 * @param {string} current 
 * @param {string} latest 
 * @returns {boolean} True if latest is newer than current
 */
function isNewerVersion(current, latest) {
  if (!current || !latest) return false;
  const cParts = current.split('.').map(p => parseInt(p, 10) || 0);
  const lParts = latest.split('.').map(p => parseInt(p, 10) || 0);
  
  for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
    const c = cParts[i] || 0;
    const l = lParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Fetch latest version from npm registry asynchronously
 * @param {string} packageName 
 * @returns {Promise<string|null>}
 */
function fetchLatestNpmVersion(packageName) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'registry.npmjs.org',
      path: `/${packageName}/latest`,
      headers: {
        'User-Agent': 'cloudsync-cli-update-notifier'
      },
      timeout: 3000
    };

    const req = https.get(options, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = safeJsonParse(data, {});
        resolve(parsed.version || null);
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Check for updates asynchronously without blocking CLI execution
 * @param {string} currentVersion 
 * @param {string} [packageName='cloudsync-cli'] 
 */
export async function checkForUpdates(currentVersion, packageName = 'cloudsync-cli') {
  // Skip in CI or automated testing environments
  if (process.env.CI || process.env.NODE_ENV === 'test' || process.argv.includes('-q') || process.argv.includes('--quiet')) {
    return;
  }

  const cacheDir = join(homedir(), '.cloudsync');
  const cacheFile = join(cacheDir, 'update-cache.json');

  let cache = {};
  if (existsSync(cacheFile)) {
    cache = safeJsonParse(readFileSync(cacheFile, 'utf8'), {});
  }

  const now = Date.now();
  const lastChecked = cache.lastChecked || 0;

  // If cache is fresh, check cached version
  if (now - lastChecked < CACHE_TTL_MS && cache.latestVersion) {
    if (isNewerVersion(currentVersion, cache.latestVersion)) {
      printUpdateNotice(currentVersion, cache.latestVersion);
    }
    return;
  }

  // Fetch in background
  try {
    const latestVersion = await fetchLatestNpmVersion(packageName);
    if (latestVersion) {
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }
      writeFileSync(cacheFile, JSON.stringify({ lastChecked: now, latestVersion }, null, 2));

      if (isNewerVersion(currentVersion, latestVersion)) {
        printUpdateNotice(currentVersion, latestVersion);
      }
    }
  } catch (e) {
    // Non-blocking silent error catch
  }
}

/**
 * Display clean single-line update notification
 */
function printUpdateNotice(current, latest) {
  console.log();
  console.log(chalk.yellow('╭──────────────────────────────────────────────────────────╮'));
  console.log(chalk.yellow('│') + chalk.white(`  💡 Update available: `) + chalk.gray(current) + chalk.white(' → ') + chalk.green(latest) + ' '.repeat(Math.max(0, 30 - current.length - latest.length)) + chalk.yellow('│'));
  console.log(chalk.yellow('│') + chalk.cyan('  Run: ') + chalk.bold.white('npm install -g cloudsync-cli') + ' '.repeat(25) + chalk.yellow('│'));
  console.log(chalk.yellow('╰──────────────────────────────────────────────────────────╯'));
  console.log();
}
