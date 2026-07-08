#!/usr/bin/env node

/**
 * CloudSync-CLI Entry Point
 *
 * Dynamically loads the CLI module using a resolved absolute file path
 * from import.meta.url so that pkg can locate the bundled files at build time
 * (pkg traces static imports; dynamic paths are resolved via import.meta.url).
 */

import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Ensure .cloudsync directories exist ──────────────────
const csyncDir = join(process.cwd(), '.cloudsync');
[
  csyncDir,
  join(csyncDir, 'staging'),
  join(csyncDir, 'history', 'commits'),
  join(csyncDir, 'history', 'diffs'),
  join(csyncDir, 'cache'),
  join(csyncDir, 'logs'),
].forEach((dir) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

// ── Global error handlers ────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('\n❌', err.message);
  if (process.argv.includes('--verbose')) console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n❌ Unhandled rejection:', reason);
  process.exit(1);
});

// ── Resolve CLI entry via import.meta.url (works with pkg) ──
const cliUrl = new URL('../src/cli/index.js', import.meta.url).href;

import(cliUrl).catch((err) => {
  console.error('Failed to load CLI:', err.message);
  process.exit(1);
});
