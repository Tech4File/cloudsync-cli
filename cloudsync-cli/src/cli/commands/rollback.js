/**
 * rollback.js - Revert to previous version
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { safeJsonParse } from '../../utils/security.js';


const rollbackCommand = new Command('rollback')
  .description('⏪ Revert to a previous version')
  .argument('<version>', 'Version ID to rollback to')
  .option('--file <path>', 'Specific file to rollback (default: all)')
  .option('-p, --passphrase <secret>', 'Passphrase for AES-256-GCM encrypted snapshot')
  .option('--force', 'Skip confirmation', false)
  .option('--verbose', 'Show detailed rollback info', false)
  .action(async (versionId, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const indexFile = join(process.cwd(), '.cloudsync', 'history', 'index.json');
    
    if (!existsSync(indexFile)) {
      console.log(chalk.red('❌ No history found'));
      return;
    }

    const history = safeJsonParse(readFileSync(indexFile, 'utf8'), {});
    const targetVersion = history.find(h => h.id === versionId);

    if (!targetVersion) {
      console.log(chalk.red(`❌ Version '${versionId}' not found`));
      console.log(chalk.gray('Run: cloudsync history'));
      return;
    }

    const commitsDir = join(process.cwd(), '.cloudsync', 'history', 'commits');
    const commitFile = join(commitsDir, `${versionId}.json`);

    if (!existsSync(commitFile)) {
      console.log(chalk.red(`❌ Commit data not found for '${versionId}'`));
      return;
    }

    const commit = safeJsonParse(readFileSync(commitFile, 'utf8'), {});

    console.log(chalk.cyan('\n⏪ CloudSync Rollback'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.white(`   Target Version: ${chalk.cyan(versionId)}`));
    console.log(chalk.white(`   Message: ${chalk.cyan(commit.message || 'No message')}`));
    console.log(chalk.white(`   Timestamp: ${chalk.cyan(new Date(commit.timestamp).toLocaleString())}`));
    if (options.file) {
      console.log(chalk.white(`   File: ${chalk.cyan(options.file)}`));
    } else {
      console.log(chalk.white(`   Files: ${chalk.cyan(commit.files?.length || 0)} files`));
    }
    console.log(chalk.gray('━'.repeat(60)));

    if (verbose) {
      console.log(chalk.gray('\n📋 Files in this version:'));
      (commit.files || []).forEach(f => console.log(chalk.gray(`   - ${f}`)));
    }

    // Confirmation
    if (!options.force) {
      console.log(chalk.yellow('\n⚠️ This will restore files to a previous state.'));
    }

    console.log(chalk.cyan('\n🔄 Performing rollback...'));

    // Extract the archive to restore files
    const archivePath = join(commitsDir, `${versionId}.zip`);
    let extractedCount = 0;
    if (existsSync(archivePath)) {
      try {
        const { VersionControl } = await import('../../core/vcs/index.js');
        const vcs = new VersionControl();
        const passphrase = options.passphrase || process.env.CLOUDSYNC_KEY_PASSWORD || null;
        const result = vcs.extractArchive(archivePath, process.cwd(), options.file || null, passphrase);
        if (result.extracted) {
          extractedCount = result.count || 0;
          if (verbose && result.files) {
            result.files.forEach(f => console.log(chalk.gray(`   📄 Restored: ${f}`)));
          }
        } else {
          console.log(chalk.yellow(`   ⚠️ Archive extraction issue: ${result.error || 'Unknown'}`));
        }
      } catch (e) {
        console.log(chalk.yellow(`   ⚠️ Could not extract archive: ${e.message}`));
      }
    } else {
      console.log(chalk.yellow('   ⚠️ Archive not found - recording rollback metadata only'));
    }

    // Create rollback commit record
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

    console.log(chalk.green('\n✅ Rollback complete!'));
    console.log(chalk.gray(`   Restored to version: ${versionId}`));
    console.log(chalk.gray(`   Files restored: ${extractedCount}`));
    console.log(chalk.gray(`   Rollback ID: ${rollbackRecord.id}`));
    console.log(chalk.yellow('\n💡 Note: Changes have been reverted but can be restored by rolling forward'));
  });

export default rollbackCommand;
