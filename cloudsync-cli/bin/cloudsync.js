#!/usr/bin/env node

/**
 * CloudSync-CLI Entry Point
 * An open-source CLI for secure cloud-to-local synchronization
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Ensure directories exist
const cloudsyncDir = join(process.cwd(), '.cloudsync');
const stagingDir = join(cloudsyncDir, 'staging');
const historyDir = join(cloudsyncDir, 'history');
const cacheDir = join(cloudsyncDir, 'cache');
const logsDir = join(cloudsyncDir, 'logs');

[cloudsyncDir, stagingDir, historyDir, cacheDir, logsDir].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// Set up global error handlers
process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error.message);
  if (process.argv.includes('--verbose') || process.argv.includes('-V')) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Import and run CLI
import('../src/cli/index.js').catch((error) => {
  console.error('Failed to load CLI:', error.message);
  process.exit(1);
});
