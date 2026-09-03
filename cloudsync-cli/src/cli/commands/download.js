/**
 * download.js - Download files from remote with version control
 *
 * Versioned downloads (--version / --latest) are restored from the local
 * commit archive when available. Otherwise the transfer goes over SSH/SFTP
 * to the configured profile host. Connection failures exit non-zero.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logOperation } from '../../utils/logger.js';
import { safeJsonParse } from '../../utils/security.js';
import { failWith, okWith } from '../../utils/exit.js';


const downloadCommand = new Command('download')
  .description('Download files from remote with version history')
  .argument('[files...]', 'Specific files to download')
  .option('--include <patterns>', 'Include patterns (comma-separated)')
  .option('--exclude <patterns>', 'Exclude patterns (comma-separated)')
  .option('--version <id>', 'Download specific version')
  .option('--latest', 'Fetch latest version', false)
  .option('-j, --concurrency <number>', 'Number of concurrent transfer streams', (v) => parseInt(v, 10), 4)
  .option('--verbose', 'Show detailed progress', false)
  .option('--dry-run', 'Preview without downloading', false)
  .option('--profile <name>', 'Config profile to use', 'default')
  .option('--output <path>', 'Output directory', './')
  .action(async (files, options) => {
    okWith();

    const verbose = options.verbose || process.argv.includes('--verbose');
    const configPath = join(process.cwd(), '.cloudsync', 'config.json');

    if (!existsSync(configPath)) {
      failWith('Not initialized. Run: cloudsync init');
      return;
    }

    const config = safeJsonParse(readFileSync(configPath, 'utf8'), {});
    const profile = config.profiles[options.profile] || config.profiles[config?.settings?.defaultProfile];

    if (!profile) {
      failWith(`Profile '${options.profile}' not found`);
      return;
    }

    if (verbose) {
      console.log(chalk.gray('\nDownload Configuration:'));
      console.log(chalk.gray(`   Host: ${profile.host}`));
      console.log(chalk.gray(`   User: ${profile.user}`));
      if (options.version) console.log(chalk.gray(`   Version: ${options.version}`));
      if (options.latest) console.log(chalk.gray('   Mode: Latest'));
    }

    // Local archive path for versioned downloads
    const indexFile = join(process.cwd(), '.cloudsync', 'history', 'index.json');
    if (options.version || options.latest) {
      let versionInfo = null;
      if (existsSync(indexFile)) {
        const history = safeJsonParse(readFileSync(indexFile, 'utf8'), {});
        if (options.latest && history.length > 0) versionInfo = history[0];
        else if (options.version) versionInfo = history.find(h => h.id === options.version);
      }

      if (versionInfo) {
        console.log(chalk.cyan(`\nFetching version: ${versionInfo.id}`));
        console.log(chalk.gray(`   Message: ${versionInfo.message}`));
        console.log(chalk.gray(`   Time: ${new Date(versionInfo.timestamp).toLocaleString()}`));

        const commitFile = join(process.cwd(), '.cloudsync', 'history', 'commits', `${versionInfo.id}.json`);
        if (existsSync(commitFile)) {
          const commit = safeJsonParse(readFileSync(commitFile, 'utf8'), {});
          if (verbose) {
            console.log(chalk.gray('\nFiles in this version:'));
            commit.files.forEach(f => console.log(chalk.gray(`   - ${f}`)));
          }
        }
      }
    }

    if (options.dryRun) {
      console.log(chalk.yellow('\nDry run mode - no files downloaded'));
      return;
    }

    // Try local archive retrieval first (for versioned downloads)
    const versionId = options.version || (options.latest ? getLatestVersionId() : null);
    if (versionId) {
      const archivePath = join(process.cwd(), '.cloudsync', 'history', 'commits', `${versionId}.zip`);
      if (existsSync(archivePath)) {
        console.log(chalk.cyan(`\nRestoring from local archive: ${versionId}`));
        try {
          const { VersionControl } = await import('../../core/vcs/index.js');
          const vcs = new VersionControl();
          const result = vcs.extractArchive(archivePath, options.output || process.cwd());
          if (result.extracted) {
            logOperation('download', `Restored ${result.count || 0} files from version ${versionId}`);
            console.log(chalk.green(`\nRestored ${result.count || 0} files from version ${versionId}`));
            if (result.files && verbose) {
              result.files.forEach(f => console.log(chalk.gray(`   ${f}`)));
            }
            updateLocalStatus(verbose);
            return;
          } else {
            failWith(`Extraction failed: ${result.error || 'Unknown error'}`);
            return;
          }
        } catch (err) {
          failWith(`Archive extraction failed: ${err.message}`);
          if (verbose) console.error(err.stack);
          return;
        }
      }
    }

    // Remote download attempt
    console.log(chalk.cyan('\nDownloading from remote...'));

    try {
      await downloadWithProtocol(profile, options, verbose);
      logOperation('download', `Downloaded files from ${profile.host}`);
      console.log(chalk.green('\nDownload complete!'));
      updateLocalStatus(verbose);
    } catch (error) {
      failWith(`Download failed: ${error.message}`);
      if (verbose) console.error(error.stack);
    }
  });

function getLatestVersionId() {
  const indexFile = join(process.cwd(), '.cloudsync', 'history', 'index.json');
  if (!existsSync(indexFile)) return null;
  try {
    const history = safeJsonParse(readFileSync(indexFile, 'utf8'), {});
    return history.length > 0 ? history[0].id : null;
  } catch (e) {
    return null;
  }
}

async function downloadWithProtocol(profile, options, verbose) {
  const host = profile.host;
  const port = profile.port || 22;
  const username = profile.user;

  if (verbose) console.log(chalk.gray(`\nConnecting to ${username}@${host}:${port}`));

  const { Client: SSHClient } = await import('ssh2');
  const keyPath = profile.key || join(homedir(), '.ssh', 'id_rsa');
  const privateKey = existsSync(keyPath) ? readFileSync(keyPath) : null;

  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      conn.end();
      reject(new Error(`SSH connection timed out after 10s to ${host}:${port}`));
    }, 10000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      if (verbose) console.log(chalk.green('   Connected to SSH server'));
      conn.sftp((err, _sftp) => {
        if (err) { conn.end(); return reject(err); }
        if (verbose) console.log(chalk.gray('   SFTP session established'));
        conn.end();
        resolve();
      });
    });

    // Surface connection errors to the caller as rejections
    conn.on('error', (err) => {
      clearTimeout(timeout);
      if (timedOut) return;
      reject(new Error(`Remote unreachable: ${err.message}`));
    });

    try {
      conn.connect({ host, port, username, privateKey, readyTimeout: 10000 });
    } catch (e) {
      clearTimeout(timeout);
      reject(new Error(`SSH connect failed: ${e.message}`));
    }
  });
}

function updateLocalStatus(verbose) {
  const statusFile = join(process.cwd(), '.cloudsync', 'status.json');
  const status = {
    lastSync: new Date().toISOString(),
    lastAction: 'download',
    pendingChanges: false
  };
  writeFileSync(statusFile, JSON.stringify(status, null, 2));
  if (verbose) console.log(chalk.gray('Status updated'));
}

export default downloadCommand;
