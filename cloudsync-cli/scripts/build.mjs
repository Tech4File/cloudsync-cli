/**
 * Build script — bundles the CLI into a single CJS file for pkg compilation.
 * Uses esbuild to convert ESM→CJS, externalizing native modules.
 */
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['bin/pkg-launcher.cjs'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: 'dist/bundle.cjs',
  external: [
    'ssh2', 'cpu-features', 'sshcrypto', 'figlet',
    './build/Release/*', './crypto/build/Release/*'
  ],
  logLevel: 'warning',
});

console.log('✅ dist/bundle.cjs built');
