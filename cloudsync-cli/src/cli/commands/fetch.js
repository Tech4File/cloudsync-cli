/**
 * fetch.js - Direct CLI-to-CLI Share Receiver for CloudSync-CLI
 *
 * Connects to an active `cloudsync share` session over HTTP, validates the
 * session health via GET /status ({"status":"active"}), then downloads the
 * payload from /download/<id> into the local workspace.
 *
 * Credentials are sent as headers: x-share-password and x-share-token.
 * Every failure path exits with code 1 so scripts can detect errors.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import http from 'http';
import { existsSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { safeJsonParse } from '../../utils/security.js';
import { failWith, okWith } from '../../utils/exit.js';

const fetchCommand = new Command('fetch')
  .description('📥 Receive shared files directly from an active CloudSync share session')
  .argument('<target>', 'Share URL (e.g. http://192.168.1.5:8095/share/abc1234) or Share ID')
  .option('--host <hostname>', 'Remote host (if target is Share ID)', '127.0.0.1')
  .option('--port <number>', 'Remote port (if target is Share ID)', (v) => parseInt(v, 10), 3000)
  .option('--password <pwd>', 'Password if session is protected')
  .option('--token <token>', 'Session token (required by share server)')
  .option('--output <path>', 'Output destination directory', './')
  .option('--timeout <ms>', 'HTTP timeout in milliseconds', (v) => parseInt(v, 10), 30000)
  .option('--verbose', 'Show detailed download progress', false)
  .action(async (target, options) => {
    okWith();

    const verbose = options.verbose || process.argv.includes('--verbose');
    let host = options.host;
    let port = options.port;
    let shareId = target;

    // Parse URL if provided
    if (target.startsWith('http://') || target.startsWith('https://')) {
      try {
        const parsed = new URL(target);
        host = parsed.hostname || '127.0.0.1';
        port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
        const parts = parsed.pathname.split('/').filter(Boolean);
        shareId = parts[parts.length - 1] || target;
      } catch (e) {
        failWith(`❌ Invalid share URL: ${target}`);
        return;
      }
    }

    console.log(chalk.cyan('\n📥 CloudSync Fetch - Direct Peer Receiver'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.white(`   Remote Host: ${chalk.cyan(host)}`));
    console.log(chalk.white(`   Remote Port: ${chalk.cyan(port)}`));
    console.log(chalk.white(`   Share ID:    ${chalk.cyan(shareId)}`));
    console.log(chalk.white(`   Destination: ${chalk.cyan(resolve(options.output))}`));
    console.log(chalk.gray('━'.repeat(60)));

    console.log(chalk.cyan('\n🔍 Connecting to sharing session...'));

    try {
      // Step 1: verify the session is live via /status
      const statusUrl = `http://${host}:${port}/status`;
      const statusData = await httpGet(statusUrl, 5000, {}, false);
      const status = safeJsonParse(statusData.body, {});

      if (status.status !== 'active') {
        failWith(`❌ Share session is not active on ${host}:${port} (status="${status.status || 'missing'}")`);
        return;
      }

      console.log(chalk.green(`✅ Connected to session (${status.type || 'file'} share)`));

      // Step 2: Query share dashboard (auth via token + password headers)
      const headers = {};
      if (options.password) headers['x-share-password'] = options.password;
      if (options.token) headers['x-share-token'] = options.token;

      const shareUrl = `http://${host}:${port}/share/${shareId}`;
      const sharePage = await httpGet(shareUrl, 5000, headers, false);

      if (sharePage.statusCode === 401) {
        failWith('Unauthorized — wrong password, or the session requires a token. Pass --password <pwd> and/or --token <t>.');
        return;
      }
      if (sharePage.statusCode === 410) {
        failWith('❌ Share link has expired.');
        return;
      }
      if (sharePage.statusCode !== 200) {
        failWith(`❌ Could not access share ID ${shareId} (HTTP ${sharePage.statusCode})`);
        return;
      }

      // Step 3: Download payload
      console.log(chalk.cyan('\n📦 Downloading shared files...'));
      const downloadUrl = `http://${host}:${port}/download/${shareId}`;
      const downloadRes = await httpGet(downloadUrl, options.timeout, headers, true);

      if (downloadRes.statusCode === 401) {
        failWith('❌ Unauthorized: This share is password-protected. Provide --password <pwd> --token <t>.');
        return;
      }
      if (downloadRes.statusCode === 410) {
        failWith('❌ Share link has expired.');
        return;
      }
      if (downloadRes.statusCode !== 200) {
        failWith(`❌ Download failed: HTTP ${downloadRes.statusCode}`);
        return;
      }

      const outDir = resolve(options.output);
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }

      // Choose filename from Content-Disposition if present, otherwise fall back
      let filename = `shared_${shareId}.zip`;
      const cd = downloadRes.headers['content-disposition'] || '';
      const m = cd.match(/filename="?([^";]+)"?/);
      if (m && m[1]) filename = m[1];

      const outFile = join(outDir, filename);
      writeFileSync(outFile, downloadRes.rawBuffer);

      const sz = statSync(outFile).size;
      console.log(chalk.green(`\n✅ Download complete!`));
      console.log(chalk.white(`   Saved: ${chalk.cyan(outFile)}`));
      console.log(chalk.gray(`   Size:  ${sz.toLocaleString()} bytes`));
      console.log(chalk.gray('━'.repeat(60)));
    } catch (err) {
      failWith(`❌ Could not connect to remote host ${host}:${port} (${err.message})`);
      if (verbose && err.stack) console.error(err.stack);
    }
  });

function httpGet(targetUrl, timeout = 10000, customHeaders = {}, showProgress = false) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(targetUrl); }
    catch (e) { reject(new Error(`Invalid URL: ${targetUrl}`)); return; }

    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      headers: customHeaders
    };

    const req = http.get(options, (res) => {
      const chunks = [];
      const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
      let progressBar = null;
      if (showProgress && res.statusCode === 200 && totalBytes > 0) {
        import('../../utils/progress.js').then(({ ProgressBar }) => {
          progressBar = new ProgressBar(totalBytes, 'Receiving Payload');
        }).catch(() => {});
      }

      res.on('data', chunk => {
        chunks.push(chunk);
        if (progressBar) progressBar.update(chunk.length);
      });

      res.on('end', () => {
        if (progressBar) progressBar.finish();
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: buffer.toString('utf8'),
          rawBuffer: buffer
        });
      });

      res.on('error', (e) => reject(e));
    });

    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Connection timed out after ${timeout}ms`));
    });
  });
}

export default fetchCommand;
