/**
 * commit.js - Commit staged changes with version control
 *
 * Archives the staging area into .cloudsync/history/commits/<id>.zip and
 * records metadata + history entries. Optionally encrypts the archive with
 * AES-256-GCM (--encrypt / --passphrase). --amend rewrites the head commit
 * in place instead of appending a new entry. The staging area is cleared
 * after a successful commit.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, createWriteStream, renameSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { ZipArchive } from 'archiver';
import { logOperation } from '../../utils/logger.js';
import { safeJsonParse } from '../../utils/security.js';
import { failWith, okWith } from '../../utils/exit.js';

const commitCommand = new Command('commit')
  .description('Commit staged changes with version tracking')
  .argument('[message]', 'Commit message')
  .option('--amend', 'Amend the last commit (rewrite message + archive in-place)', false)
  .option('-e, --encrypt', 'Encrypt snapshot archive on disk with AES-256-GCM', false)
  .option('-p, --passphrase <secret>', 'Passphrase for AES-256-GCM encryption')
  .option('--no-verify', 'Skip pre-commit hooks', false)
  .option('--verbose', 'Show detailed commit info', false)
  .option('--dry-run', 'Preview without committing', false)
  .action(async (message, options) => {
    okWith();

    const verbose = options.verbose || process.argv.includes('--verbose');
    const stagingDir = join(process.cwd(), '.cloudsync', 'staging');
    const historyDir = join(process.cwd(), '.cloudsync', 'history', 'commits');
    const indexPath = join(process.cwd(), '.cloudsync', 'history', 'index.json');
    const indexFile = join(stagingDir, 'index.json');

    if (!existsSync(stagingDir)) {
      failWith('No staging area. Run: cloudsync init');
      return;
    }

    const stagedFiles = readdirSync(stagingDir).filter(f => f !== 'index.json');

    if (stagedFiles.length === 0 && !options.amend) {
      failWith('Nothing to commit. Stage some files first: cloudsync stage <files>');
      return;
    }

    const commitMessage = (message && String(message).trim()) || '';
    if (!commitMessage) {
      failWith('Commit cancelled — message is required. Usage: cloudsync commit "<message>"');
      return;
    }

    if (verbose) {
      console.log(chalk.gray('\nCommit Details:'));
      console.log(chalk.gray(`   Message: ${commitMessage}`));
      console.log(chalk.gray(`   Files: ${stagedFiles.length}`));
      console.log(chalk.gray(`   Amend: ${options.amend ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`   Encrypted: ${options.encrypt || options.passphrase ? 'Yes (AES-256-GCM)' : 'No'}`));
      stagedFiles.forEach(f => console.log(chalk.gray(`   + ${f}`)));
    }

    if (options.dryRun) {
      console.log(chalk.yellow('\nDry run - commit preview:'));
      console.log(chalk.gray(`   Message: "${commitMessage}"`));
      console.log(chalk.gray(`   Files: ${stagedFiles.length}`));
      return;
    }

    // --amend rewrites the head commit's archive + metadata in place
    // so no dangling duplicate remains in history.
    let commitId;
    let amendingId = null;
    if (options.amend) {
      const history = existsSync(indexPath)
        ? safeJsonParse(readFileSync(indexPath, 'utf8'), [])
        : [];
      if (history.length === 0) {
        failWith('No previous commit to amend. Stage files and run without --amend.');
        return;
      }
      amendingId = history[0].id;
      commitId = amendingId;
      // Remove old archive + metadata so we can rewrite them
      try { unlinkSync(join(historyDir, `${amendingId}.zip`)); } catch (_) { }
      try { unlinkSync(join(historyDir, `${amendingId}.json`)); } catch (_) { }
      console.log(chalk.gray(`\n   Amending previous commit ${amendingId}...`));
    } else {
      commitId = generateCommitId();
    }
    const timestamp = new Date().toISOString();

    // Create zip archive
    const archivePath = join(historyDir, `${commitId}.zip`);
    mkdirSync(historyDir, { recursive: true });
    await createStagedArchive(stagingDir, stagedFiles, archivePath);

    // Apply AES-256-GCM encryption if requested
    let isEncrypted = false;
    if (options.encrypt || options.passphrase) {
      const passphrase = options.passphrase || process.env.CLOUDSYNC_KEY_PASSWORD;
      if (!passphrase) {
        // Remove the partial archive so no unencrypted snapshot is left behind
        try { unlinkSync(archivePath); } catch (_) { }
        failWith('Encryption requires a passphrase. Use --encrypt --passphrase <secret> or set CLOUDSYNC_KEY_PASSWORD.');
        return;
      }
      try {
        const { encryptFile } = await import('../../core/crypto/index.js');
        await encryptFile(archivePath, passphrase);
        isEncrypted = true;
      } catch (e) {
        try { unlinkSync(archivePath); } catch (_) { }
        failWith(`Encryption failed: ${e.message}`);
        return;
      }
    }

    // Create commit object
    const commit = {
      id: commitId,
      message: commitMessage,
      timestamp,
      files: stagedFiles,
      encrypted: isEncrypted,
      author: process.env.USER || process.env.USERNAME || 'unknown'
    };

    // Save commit metadata (atomic: tmp + rename)
    mkdirSync(historyDir, { recursive: true });
    const commitMetaPath = join(historyDir, `${commitId}.json`);
    const tmpMeta = commitMetaPath + '.tmp';
    writeFileSync(tmpMeta, JSON.stringify(commit, null, 2));
    renameSync(tmpMeta, commitMetaPath);

    // Update history index
    let history = [];
    if (existsSync(indexPath)) {
      history = safeJsonParse(readFileSync(indexPath, 'utf8'), []);
    }
    if (options.amend && history.length > 0 && history[0].id === amendingId) {
      // Replace the head entry — keep its slot, update content
      history[0] = { id: commitId, timestamp, message: commitMessage };
    } else {
      history.unshift({ id: commitId, timestamp, message: commitMessage });
    }
    const tmpIdx = indexPath + '.tmp';
    writeFileSync(tmpIdx, JSON.stringify(history, null, 2));
    renameSync(tmpIdx, indexPath);

    // Clear staging area (only on a fresh commit, not on amend)
    if (!options.amend) {
      stagedFiles.forEach(f => {
        try { unlinkSync(join(stagingDir, f)); } catch (_) { }
      });
      if (existsSync(indexFile)) {
        try { unlinkSync(indexFile); } catch (_) { }
      }
    }

    // Display commit info
    logOperation('commit', `Committed: ${commitMessage}`, { files: stagedFiles, commitId });
    console.log(chalk.green('\nCommitted successfully!'));
    console.log(chalk.gray('-'.repeat(60)));
    console.log(chalk.cyan(`   Commit ID: ${commitId}`));
    console.log(chalk.white(`   Message: ${commitMessage}`));
    console.log(chalk.gray(`   Files: ${stagedFiles.length}`));
    console.log(chalk.gray(`   Time: ${new Date(timestamp).toLocaleString()}`));
    console.log(chalk.gray('-'.repeat(60)));
    console.log(chalk.cyan('\n   Push with: ') + chalk.white('cloudsync upload'));
  });

function generateCommitId() {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(2).toString('hex');
  return `${timestamp}-${random}`;
}

async function createStagedArchive(stagingDir, files, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);

    files.forEach(f => {
      const safeName = f.replace(/[\\/]/g, '__');
      const stagedFilePath = join(stagingDir, safeName);
      const actualPath = existsSync(stagedFilePath) ? stagedFilePath : join(stagingDir, f);
      if (existsSync(actualPath)) {
        archive.file(actualPath, { name: f });
      }
    });

    archive.finalize();
  });
}

export default commitCommand;
