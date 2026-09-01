/**
 * rollback.js - Revert the workspace to a previous version
 *
 * Extracts the archive for the given commit ID back into the workspace
 * (optionally a single file via --file, decrypted with --passphrase) and
 * records a rollback entry in history. A rollback record is only written
 * when the extraction actually succeeded — failures exit non-zero.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { safeJsonParse } from '../../utils/security.js';
import { failWith, okWith } from '../../utils/exit.js';


const rollbackCommand = new Command('rollback')
  .description('Revert to a previous version')
  .argument('<version>', 'Version ID to rollback to')
  .option('--file <path>', 'Specific file to rollback (default: all)')
  .option('-p, --passphrase <secret>', 'Passphrase for AES-256-GCM encrypted snapshot')
  .option('--force', 'Skip confirmation', false)
  .option('--verbose', 'Show detailed rollback info', false)
  .action(async (versionId, options) => {
    okWith();

    const verbose = options.verbose || process.argv.includes('--verbose');
    const indexFile = join(process.cwd(), '.cloudsync', 'history', 'index.json');

    if (!existsSync(indexFile)) {
      failWith('No history found. Make a commit first.');
      return;
    }

    const history = safeJsonParse(readFileSync(indexFile, 'utf8'), {});
    const targetVersion = history.find(h => h.id === versionId);

    if (!targetVersion) {
      failWith(`Version '${versionId}' not found. Run: cloudsync history`);
      return;
    }

    const commitsDir = join(process.cwd(), '.cloudsync', 'history', 'commits');
    const commitFile = join(commitsDir, `${versionId}.json`);

    if (!existsSync(commitFile)) {
      failWith(`Commit metadata not found for '${versionId}'`);
      return;
    }

    const commit = safeJsonParse(readFileSync(commitFile, 'utf8'), {});

    console.log(chalk.cyan('\nCloudSync Rollback'));
    console.log(chalk.gray('-'.repeat(60)));
    console.log(chalk.white(`   Target Version: ${chalk.cyan(versionId)}`));
    console.log(chalk.white(`   Message: ${chalk.cyan(commit.message || 'No message')}`));
    console.log(chalk.white(`   Timestamp: ${chalk.cyan(new Date(commit.timestamp).toLocaleString())}`));
    if (options.file) {
      console.log(chalk.white(`   File: ${chalk.cyan(options.file)}`));
    } else {
      console.log(chalk.white(`   Files: ${chalk.cyan(commit.files?.length || 0)} files`));
    }
    console.log(chalk.gray('-'.repeat(60)));

    if (verbose) {
      console.log(chalk.gray('\nFiles in this version:'));
      (commit.files || []).forEach(f => console.log(chalk.gray(`   - ${f}`)));
    }

    // Confirmation warning (not a hard prompt — --force bypasses)
    if (!options.force) {
      console.log(chalk.yellow('\nThis will restore files to a previous state.'));
    }

    console.log(chalk.cyan('\nPerforming rollback...'));

    // Extract the archive
    const archivePath = join(commitsDir, `${versionId}.zip`);
    let extractedCount = 0;
    let extractionSucceeded = false;
    let extractionError = null;

    if (existsSync(archivePath)) {
      try {
        const { VersionControl } = await import('../../core/vcs/index.js');
        const vcs = new VersionControl();
        const passphrase = options.passphrase || process.env.CLOUDSYNC_KEY_PASSWORD || null;
        const result = vcs.extractArchive(archivePath, process.cwd(), options.file || null, passphrase);
        if (result && result.extracted) {
          extractedCount = result.count || 0;
          extractionSucceeded = true;
          if (verbose && result.files) {
            result.files.forEach(f => console.log(chalk.gray(`   Restored: ${f}`)));
          }
        } else {
          extractionError = result ? (result.error || 'Unknown extraction error') : 'No result';
          console.log(chalk.yellow(`   Archive extraction issue: ${extractionError}`));
        }
      } catch (e) {
        extractionError = e.message;
        console.log(chalk.yellow(`   Could not extract archive: ${e.message}`));
      }
    } else {
      extractionError = 'Archive file missing';
      console.log(chalk.yellow('   Archive not found - nothing to extract'));
    }

    if (!extractionSucceeded) {
      // No history record on failure — a rollback entry implies success
      failWith(`Rollback failed: ${extractionError || 'extraction did not succeed'}`);
      return;
    }

    // Write rollback commit record (only on success)
    const rollbackRecord = {
      id: `rollback-${Date.now()}`,
      type: 'rollback',
      targetVersion: versionId,
      timestamp: new Date().toISOString(),
      files: commit.files,
      filesRestored: extractedCount,
      message: `Rollback to: ${commit.message || 'previous version'}`
    };

    mkdirSync(commitsDir, { recursive: true });
    writeFileSync(
      join(commitsDir, `${rollbackRecord.id}.json`),
      JSON.stringify(rollbackRecord, null, 2)
    );

    // Update history index
    history.unshift({
      id: rollbackRecord.id,
      timestamp: rollbackRecord.timestamp,
      message: rollbackRecord.message
    });
    writeFileSync(indexFile, JSON.stringify(history, null, 2));

    console.log(chalk.green('\nRollback complete!'));
    console.log(chalk.gray(`   Restored to version: ${versionId}`));
    console.log(chalk.gray(`   Files restored: ${extractedCount}`));
    console.log(chalk.gray(`   Rollback ID: ${rollbackRecord.id}`));
    console.log(chalk.yellow('\nNote: Changes have been reverted but can be restored by rolling forward'));
  });

export default rollbackCommand;
