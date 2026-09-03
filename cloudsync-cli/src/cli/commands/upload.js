/**
 * upload.js - Upload files to remote with version control
 *
 * Collects workspace files (honoring include/exclude patterns and path
 * safety checks), packs them into a ZIP archive with a SHA-256 checksum,
 * records a version entry in history, and transfers via the selected
 * protocol. SSH-family protocols use a direct SFTP transfer; other
 * protocols route through the TransportEngine. Any transfer failure
 * exits non-zero.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, readdirSync, createWriteStream, createReadStream, writeFileSync, mkdirSync } from 'fs';
import { join, relative, basename } from 'path';
import { homedir } from 'os';
import { ZipArchive } from 'archiver';
import { Client as SSHClient } from 'ssh2';
import crypto from 'crypto';
import { logOperation } from '../../utils/logger.js';
import { safeJsonParse, safePath, isSafeFilename } from '../../utils/security.js';
import { failWith, okWith } from '../../utils/exit.js';


const uploadCommand = new Command('upload')
  .description('Upload files to remote with version tracking')
  .argument('[files...]', 'Specific files to upload')
  .option('--include <patterns>', 'Include patterns (comma-separated)')
  .option('--exclude <patterns>', 'Exclude patterns (comma-separated)', 'node_modules,.git,dist,build,.next,.cloudsync')
  .option('--message <msg>', 'Commit message for version control')
  .option('--all', 'Stage and upload all changes', false)
  .option('--force', 'Force overwrite remote files', false)
  .option('--compress <method>', 'Compression method (zip/lz4/zstd)', 'zip')
  .option('--chunk-size <MB>', 'Chunk size in MB for large files', (v) => parseFloat(v), 10)
  .option('-j, --concurrency <number>', 'Number of concurrent transfer streams', (v) => parseInt(v, 10), 4)
  .option('--protocol <proto>', 'Transport protocol', /^(ssh|scp|sftp|rsync|websocket|ws|pipe|hybrid|zip|chunked|http)$/i, 'ssh')
  .option('--verbose', 'Show detailed transfer progress', false)
  .option('--dry-run', 'Preview without transferring', false)
  .option('--profile <name>', 'Config profile to use', 'default')
  .action(async (files, options) => {
    okWith();

    const verbose = options.verbose || process.argv.includes('--verbose');
    const configPath = join(process.cwd(), '.cloudsync', 'config.json');

    if (!existsSync(configPath)) {
      failWith('Not initialized. Run: cloudsync init');
      return;
    }

    const config = safeJsonParse(readFileSync(configPath, 'utf8'), { profiles: {}, settings: {} });
    const profile = config.profiles[options.profile] || config.profiles[config?.settings?.defaultProfile];

    if (!profile) {
      failWith(`Profile '${options.profile}' not found`);
      return;
    }

    if (verbose) {
      console.log(chalk.gray('\nUpload Configuration:'));
      console.log(chalk.gray(`   Host: ${profile.host}`));
      console.log(chalk.gray(`   User: ${profile.user}`));
      console.log(chalk.gray(`   Protocol: ${options.protocol}`));
      console.log(chalk.gray(`   Compression: ${options.compress}`));
      console.log(chalk.gray(`   Exclude: ${options.exclude}`));
    }

    const workspace = profile.workspace || process.cwd();
    const excludePatterns = options.exclude.split(',').map(p => p.trim());
    const includePatterns = options.include ? options.include.split(',').map(p => p.trim()) : null;

    const filesToUpload = collectFiles(workspace, files, excludePatterns, includePatterns, verbose);

    if (filesToUpload.length === 0) {
      failWith('No files to upload (all excluded or none matched)');
      return;
    }

    console.log(chalk.cyan(`\nPreparing ${filesToUpload.length} files for upload...`));

    if (verbose) {
      console.log(chalk.gray('Files to upload:'));
      filesToUpload.forEach(f => console.log(chalk.gray(`   - ${relative(workspace, f)}`)));
    }

    if (options.dryRun) {
      console.log(chalk.yellow('\nDry run mode - no files transferred'));
      return;
    }

    // Generate archive
    const archivePath = join(process.cwd(), '.cloudsync', 'cache', `upload-${Date.now()}.zip`);
    try {
      await createArchive(workspace, filesToUpload, archivePath, verbose);
    } catch (e) {
      failWith(`Failed to create archive: ${e.message}`);
      return;
    }

    const versionId = generateVersionId();
    const commitMessage = options.message || `Upload ${filesToUpload.length} files`;

    if (verbose) console.log(chalk.gray(`\nVersion ID: ${versionId}`));

    // Streaming SHA-256 checksum
    const checksum = await new Promise((resolve) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(archivePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', () => resolve(''));
    });

    const historyEntry = {
      id: versionId,
      type: 'upload',
      message: commitMessage,
      files: filesToUpload.map(f => relative(workspace, f)),
      timestamp: new Date().toISOString(),
      protocol: options.protocol,
      checksum
    };

    saveHistory(historyEntry, verbose);

    console.log(chalk.cyan('\nUploading via ' + options.protocol.toUpperCase() + '...'));

    // Route through the TransportEngine when a non-ssh protocol is requested,
    // otherwise fall through to the SSH path. Previously --protocol was cosmetic.
    let uploadResult;
    try {
      if (options.protocol === 'ssh' || options.protocol === 'scp' || options.protocol === 'sftp') {
        uploadResult = await uploadWithProtocol(profile, archivePath, options, verbose);
      } else {
        const { TransportEngine } = await import('../../core/transport/index.js');
        const engine = new TransportEngine({ verbose, chunkSize: options.chunkSize });
        uploadResult = await engine.upload(filesToUpload, profile.path || '~/.cloudsync', options.protocol, { ...profile, workspace });
      }
    } catch (error) {
      failWith(`Upload failed: ${error.message}`);
      if (verbose) console.error(error.stack);
      return;
    }

    logOperation('upload', `Uploaded ${filesToUpload.length} files via ${options.protocol}`,
      { files: filesToUpload.map(f => relative(workspace, f)), versionId, protocol: options.protocol });

    console.log(chalk.green('\nUpload complete!'));
    console.log(chalk.gray(`   Version: ${versionId}`));
    console.log(chalk.gray(`   Files: ${filesToUpload.length}`));
    if (uploadResult && uploadResult.implemented === false) {
      console.log(chalk.yellow(`   Note: ${options.protocol} is planned — archive saved locally at ${archivePath}`));
    }
  });

function collectFiles(dir, specificFiles, excludePatterns, includePatterns, verbose) {
  const files = [];

  function shouldExclude(path) {
    return excludePatterns.some(pattern => {
      if (!pattern) return false;
      if (pattern.startsWith('*')) return path.endsWith(pattern.slice(1));
      return path.includes(pattern);
    });
  }

  function scanDirectory(currentDir) {
    let entries;
    try { entries = readdirSync(currentDir, { withFileTypes: true }); }
    catch (e) { return; }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const relativePath = relative(process.cwd(), fullPath);

      if (shouldExclude(relativePath)) {
        if (verbose) console.log(chalk.gray(`   Excluded: ${relativePath}`));
        continue;
      }

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        if (!isSafeFilename(entry.name)) continue;
        if (includePatterns) {
          if (includePatterns.some(p => relativePath.includes(p))) files.push(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    }
  }

  if (specificFiles.length > 0) {
    for (const f of specificFiles) {
      const check = safePath(f, process.cwd());
      if (!check.safe) {
        if (verbose) console.log(chalk.yellow(`   Rejected unsafe path: ${f}`));
        continue;
      }
      if (!isSafeFilename(basename(f))) {
        if (verbose) console.log(chalk.yellow(`   Rejected reserved filename: ${f}`));
        continue;
      }
      if (existsSync(check.resolved)) files.push(check.resolved);
      else if (verbose) console.log(chalk.yellow(`   File not found: ${f}`));
    }
  } else {
    scanDirectory(dir);
  }

  return files;
}

function createArchive(workspace, files, outputPath, verbose) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => {
      if (verbose) console.log(chalk.gray(`Archive created`));
      resolve();
    });
    archive.on('error', reject);
    archive.pipe(output);

    files.forEach(file => {
      try {
        const relativePath = relative(workspace, file);
        archive.file(file, { name: relativePath });
        if (verbose) console.log(chalk.gray(`   Added: ${relativePath}`));
      } catch (e) {
        if (verbose) console.log(chalk.yellow(`   Skipped ${file}: ${e.message}`));
      }
    });

    archive.finalize();
  });
}

function generateVersionId() {
  return `v${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
}

function saveHistory(entry, verbose) {
  const historyDir = join(process.cwd(), '.cloudsync', 'history', 'commits');
  const historyFile = join(historyDir, `${entry.id}.json`);

  mkdirSync(historyDir, { recursive: true });
  writeFileSync(historyFile, JSON.stringify(entry, null, 2));

  const indexFile = join(process.cwd(), '.cloudsync', 'history', 'index.json');
  let index = [];
  if (existsSync(indexFile)) index = safeJsonParse(readFileSync(indexFile, 'utf8'), []);
  index.unshift({ id: entry.id, timestamp: entry.timestamp, message: entry.message });
  writeFileSync(indexFile, JSON.stringify(index, null, 2));

  if (verbose) console.log(chalk.gray(`History saved to: ${historyFile}`));
}

async function uploadWithProtocol(profile, archivePath, options, verbose) {
  const host = profile.host;
  const port = profile.port || 22;
  const username = profile.user;
  const keyPath = profile.key || join(homedir(), '.ssh', 'id_rsa');
  const remotePath = profile.path || '~/.cloudsync/uploads';
  const remoteFile = `${remotePath}/${basename(archivePath)}`;

  if (verbose) console.log(chalk.gray(`\nConnecting to ${username}@${host}:${port}`));

  return new Promise((resolve, reject) => {
    const conn = new SSHClient();

    conn.on('ready', () => {
      if (verbose) console.log(chalk.gray('   Connected to SSH server'));
      conn.sftp(async (sftpErr, sftp) => {
        if (sftpErr) { conn.end(); return reject(new Error(`SFTP channel failed: ${sftpErr.message}`)); }

        // Create the remote directory over SFTP only — never via a shell
        // command — so a tampered profile `path` can't inject shell syntax.
        try {
          await sftpMkdirp(sftp, remotePath, verbose);
        } catch (e) {
          conn.end();
          return reject(new Error(`Remote mkdir failed: ${e.message}`));
        }

        if (verbose) console.log(chalk.gray(`   SFTP channel open, uploading to ${remoteFile}`));

        const readStream = createReadStream(archivePath);
        const writeStream = sftp.createWriteStream(remoteFile);

        let transferred = 0;
        readStream.on('data', (chunk) => { transferred += chunk.length; });

        writeStream.on('close', () => {
          if (verbose) console.log(chalk.green(`   Transfer complete: ${(transferred / 1024).toFixed(1)} KB`));
          conn.end();
          resolve({ transferred });
        });

        writeStream.on('error', (e) => { conn.end(); reject(new Error(`SFTP write failed: ${e.message}`)); });
        readStream.pipe(writeStream);
      });
    });

    conn.on('error', (err) => {
      reject(new Error(`SSH unavailable: ${err.message}. Try --protocol hybrid for local archive, or --protocol http for cloud API.`));
    });

    try {
      const privateKey = existsSync(keyPath) ? readFileSync(keyPath) : null;
      conn.connect({ host, port, username, privateKey, readyTimeout: 30000, keepaliveInterval: 10000 });
    } catch (e) {
      reject(new Error(`SSH connect failed: ${e.message}`));
    }
  });
}

/**
 * Recursively create a remote directory over pure SFTP — no shell involved,
 * so the profile `path` value can never be interpreted as shell syntax.
 * Missing parents are created segment by segment; existing dirs are skipped.
 * A leading "~" is expanded via sftp.realpath(".") (the remote home dir).
 */
function sftpMkdirp(sftp, remotePath, verbose) {
  return new Promise((resolve, reject) => {
    const build = (basePath) => {
      const segments = remotePath.split('/').filter(seg => seg && seg !== '~');
      let built = basePath;

      const next = () => {
        if (segments.length === 0) return resolve();
        built = built.endsWith('/') ? `${built}${segments.shift()}` : `${built}/${segments.shift()}`;
        if (verbose) console.log(chalk.gray(`   mkdir: ${built}`));
        sftp.mkdir(built, (err) => {
          // Ignore "already exists" — the goal is just for the dir to exist
          if (err && err.code !== 4 && err.code !== 11) return reject(err);
          next();
        });
      };

      next();
    };

    if (remotePath.startsWith('~')) {
      sftp.realpath('.', (err, home) => {
        if (err) return reject(err);
        build(home);
      });
    } else if (remotePath.startsWith('/')) {
      build('/');
    } else {
      // Relative path — resolve against the SFTP start directory
      sftp.realpath('.', (err, home) => {
        if (err) return reject(err);
        build(home);
      });
    }
  });
}

export default uploadCommand;
