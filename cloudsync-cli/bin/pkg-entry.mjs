#!/usr/bin/env node
/**
 * pkg build entry point — uses only static imports so pkg can trace all files.
 */
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const csyncDir = join(process.cwd(), '.cloudsync');
[csyncDir, join(csyncDir,'staging'), join(csyncDir,'history','commits'),
 join(csyncDir,'history','diffs'), join(csyncDir,'cache'), join(csyncDir,'logs')
].forEach(d => { if (!existsSync(d)) mkdirSync(d, {recursive:true}); });

process.on('uncaughtException', (e) => { console.error('\n❌', e.message); process.exit(1); });
process.on('unhandledRejection', (r) => { console.error('\n❌', r); process.exit(1); });

// STATIC import — pkg traces this at bundle time
import '../src/cli/index.js';
