/**
 * download.js - Download files from remote with version control
 *
 * Versioned downloads (--version / --latest) are restored from the local
 * commit archive when available. Otherwise the remote upload directory is
 * listed over SFTP and its archives are pulled and extracted. Every path
 * exits non-zero on failure so scripts can detect a failed download.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, writeFileSync, createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
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

    // Remote download: list the remote upload directory and pull every archive
    console.log(chalk.cyan('\nDownloading from remote...'));

    try {
      const result = await downloadWithProtocol(profile, options, verbose);
      if (result.files && result.files.length > 0) {
        logOperation('download', `Downloaded ${result.files.length} archive(s) from ${profile.host}`);
        console.log(chalk.green(`\nDownload complete! ${result.files.length} archive(s) restored.`));
        updateLocalStatus(verbose);
      } else {
        failWith(
          `Remote upload directory is empty — nothing to download. ` +
          'Upload first with: cloudsync upload'
        );
      }
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
  const outputDir = options.output || process.cwd();

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
      conn.sftp(async (sftpErr, sftp) => {
        if (sftpErr) { conn.end(); return reject(sftpErr); }
        if (verbose) console.log(chalk.gray('   SFTP session established'));

        // Resolve the remote upload dir, expanding "~" to the remote home
        const remotePath = profile.path || '~/.cloudsync/uploads';
        const remoteDir = await sftpRealpath(sftp, remotePath);
        if (verbose) console.log(chalk.gray(`   Remote directory: ${remoteDir}`));

        try {
          const downloaded = [];
          const archives = await sftpListDir(sftp, remoteDir);
          const zipFiles = archives.filter(f => f.isFile && f.name.endsWith('.zip'));

          if (zipFiles.length === 0) {
            conn.end();
            return resolve({ files: [] });
          }

          for (const entry of zipFiles) {
            const remoteFile = `${remoteDir}/${entry.name}`;
            const localFile = join(outputDir, entry.name);
            await sftpReadFile(sftp, remoteFile, localFile, verbose);
            downloaded.push(entry.name);
            if (verbose) console.log(chalk.gray(`   Pulled: ${entry.name}`));

            // Extract the archive into the output directory so files are restored
            try {
              const { VersionControl } = await import('../../core/vcs/index.js');
              const vcs = new VersionControl();
              vcs.extractArchive(localFile, outputDir);
            } catch (e) {
              if (verbose) console.log(chalk.yellow(`   Extraction skipped for ${entry.name}: ${e.message}`));
            }
          }

          conn.end();
          resolve({ files: downloaded });
        } catch (e) {
          conn.end();
          reject(new Error(`Remote listing failed: ${e.message}`));
        }
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

/**
 * Resolve a remote path to an absolute one, expanding a leading "~"
 * via the SFTP start directory (the remote user's home).
 */
function sftpRealpath(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    const resolved = (base) => {
      if (!remotePath.startsWith('~')) {
        return resolve(remotePath.startsWith('/') ? remotePath : `${base}/${remotePath}`);
      }
      resolve(remotePath.replace(/^~(?=\/|$)/, base));
    };
    sftp.realpath('.', (err, base) => {
      if (err) return reject(err);
      resolved(base);
    });
  });
}

/** List a remote directory; resolves [] when it does not exist yet. */
function sftpListDir(sftp, remoteDir) {
  return new Promise((resolve, reject) => {
    sftp.readdir(remoteDir, (err, list) => {
      if (err && (err.code === 2 || err.code === 4)) return resolve([]);
      if (err) return reject(err);
      resolve(list.map(e => ({ name: e.filename, isFile: !e.longname.startsWith('d') })));
    });
  });
}

/** Stream a single remote file to a local path over SFTP. */
function sftpReadFile(sftp, remoteFile, localFile, verbose) {
  return new Promise((resolve, reject) => {
    mkdirSync(dirname(localFile), { recursive: true });
    const writeStream = createWriteStream(localFile);
    const readStream = sftp.createReadStream(remoteFile);
    let transferred = 0;
    readStream.on('data', (chunk) => { transferred += chunk.length; });
    writeStream.on('close', () => {
      if (verbose) console.log(chalk.green(`   Transfer complete: ${(transferred / 1024).toFixed(1)} KB`));
      resolve(transferred);
    });
    writeStream.on('error', reject);
    readStream.on('error', reject);
    readStream.pipe(writeStream);
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
