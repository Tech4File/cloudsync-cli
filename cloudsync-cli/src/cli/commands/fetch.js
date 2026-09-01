/**
 * fetch.js - Direct CLI-to-CLI Share Receiver for CloudSync-CLI
 * 
 * Connects directly to an active 'cloudsync share' session over HTTP/LAN/WAN,
 * validates session credentials, and downloads files directly to local workspace.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import http from 'http';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { safeJsonParse } from '../../utils/security.js';

const fetchCommand = new Command('fetch')
  .description('📥 Receive shared files directly from an active CloudSync share session')
  .argument('<target>', 'Share URL (e.g. http://192.168.1.5:8095/share/abc1234) or Share ID')
  .option('--host <hostname>', 'Remote host (if target is Share ID)', '127.0.0.1')
  .option('--port <number>', 'Remote port (if target is Share ID)', (v) => parseInt(v, 10), 3000)
  .option('--password <pwd>', 'Password if session is protected')
  .option('--output <path>', 'Output destination directory', './')
  .option('--verbose', 'Show detailed download progress', false)
  .action(async (target, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    
    let host = options.host;
    let port = options.port;
    let shareId = target;

    // Parse URL if provided
    if (target.startsWith('http://') || target.startsWith('https://')) {
      try {
        const parsed = new URL(target);
        host = parsed.hostname || '127.0.0.1';
        port = parsed.port ? parseInt(parsed.port, 10) : 80;
        const parts = parsed.pathname.split('/').filter(Boolean);
        shareId = parts[parts.length - 1] || target;
      } catch (e) {
        console.log(chalk.red(`❌ Invalid share URL: ${target}`));
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
      // Step 1: Check session status
      const statusUrl = `http://${host}:${port}/status`;
      const statusData = await httpGet(statusUrl, 5000);
      const status = safeJsonParse(statusData.body, {});

      if (status.status !== 'active') {
        console.log(chalk.red(`❌ Share session is not active on ${host}:${port}`));
        return;
      }

      console.log(chalk.green(`✅ Connected to session (${status.type || 'file'} share)`));
      
      // Step 2: Query share dashboard
      const shareUrl = `http://${host}:${port}/share/${shareId}`;
      const sharePage = await httpGet(shareUrl, 5000);

      if (sharePage.statusCode !== 200) {
        console.log(chalk.red(`❌ Could not access share ID ${shareId} (HTTP ${sharePage.statusCode})`));
        return;
      }

      // Step 3: Download payload
      console.log(chalk.cyan('\n📦 Downloading shared files...'));
      const downloadUrl = `http://${host}:${port}/download/${shareId}`;
      const headers = {};
      if (options.password) {
        headers['x-share-password'] = options.password;
      }

      const downloadRes = await httpGet(downloadUrl, 30000, headers, true);

      if (downloadRes.statusCode === 401) {
        console.log(chalk.red('\n❌ Unauthorized: This share is password-protected. Provide `--password <pwd>`.'));
        return;
      }

      if (downloadRes.statusCode !== 200) {
        console.log(chalk.red(`\n❌ Download failed: HTTP ${downloadRes.statusCode}`));
        return;
      }

      const outDir = resolve(options.output);
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }

      const outFile = join(outDir, `shared_${shareId}.zip`);
      writeFileSync(outFile, downloadRes.rawBuffer);

      console.log(chalk.green(`\n✅ Download complete!`));
      console.log(chalk.white(`   Saved: ${chalk.cyan(outFile)}`));
      console.log(chalk.gray('━'.repeat(60)));
    } catch (err) {
      if (verbose) {
        console.error(chalk.red(`\n❌ Fetch failed: ${err.message}`));
      } else {
        console.log(chalk.red(`\n❌ Could not connect to remote host ${host}:${port} (${err.message})`));
      }
    }
  });

function httpGet(targetUrl, timeout = 10000, customHeaders = {}, showProgress = false) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      headers: customHeaders
    };

    const req = http.get(options, (res) => {
      const chunks = [];
      const totalBytes = parseInt(res.headers['content-length'], 10) || 1024;
      let progressBar = null;
      if (showProgress && res.statusCode === 200) {
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
    });

    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Connection timed out'));
    });
  });
}

export default fetchCommand;
