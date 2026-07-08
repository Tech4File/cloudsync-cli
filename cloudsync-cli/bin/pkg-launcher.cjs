// pkg build launcher — pure CJS, no import.meta, no dynamic imports
const { mkdirSync, existsSync } = require('fs');
const { join } = require('path');

const csyncDir = join(process.cwd(), '.cloudsync');
[csyncDir, join(csyncDir,'staging'), join(csyncDir,'history','commits'),
 join(csyncDir,'history','diffs'), join(csyncDir,'cache'), join(csyncDir,'logs')
].forEach(d => { if (!existsSync(d)) mkdirSync(d, {recursive:true}); });

process.on('uncaughtException', (e) => { console.error('\n❌', e.message); process.exit(1); });
process.on('unhandledRejection', (r) => { console.error('\n❌', r); process.exit(1); });

// esbuild inlines this during bundle — all ESM converted to CJS
require('../src/cli/index.js');
