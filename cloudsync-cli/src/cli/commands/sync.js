/**
 * sync.js - Bidirectional synchronization with conflict resolution
 *
 * The remote transfer engine is not implemented yet, so a real sync run
 * reports the pending changes and exits non-zero instead of pretending
 * files were transferred. Dry-run mode (local analysis only) is fully
 * functional and exits zero.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { okWith, failWith } from '../../utils/exit.js';
import { safeJsonParse } from '../../utils/security.js';


const syncCommand = new Command('sync')
  .description('🔄 Bidirectional sync with conflict resolution')
  .option('--strategy <type>', 'Conflict resolution: local|remote|manual', /^(local|remote|manual)$/i, 'manual')
  .option('--watch', 'Continuous file watching mode', false)
  .option('--interval <seconds>', 'Sync interval in seconds', (v) => parseInt(v, 10), 30)
  .option('--verbose', 'Show detailed sync logs', false)
  .option('--dry-run', 'Preview sync without executing', false)
  .option('--profile <name>', 'Config profile to use', 'default')
  .option('--include <patterns>', 'Files to sync (comma-separated)')
  .option('--exclude <patterns>', 'Files to exclude (comma-separated)', 'node_modules,.git')
  .action(async (options) => {
    okWith();
    const verbose = options.verbose || process.argv.includes('--verbose');
    const configPath = join(process.cwd(), '.cloudsync', 'config.json');

    if (!existsSync(configPath)) {
      failWith('Not initialized. Run: cloudsync init');
      return;
    }

    const config = safeJsonParse(readFileSync(configPath, 'utf8'), {});
    const profile = config.profiles[options.profile] || config.profiles[config.settings.defaultProfile];

    if (!profile) {
      failWith(`Profile '${options.profile}' not found`);
      return;
    }

    console.log(chalk.cyan('\n🔄 CloudSync - Bidirectional Synchronization'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white(`   Strategy: ${chalk.cyan(options.strategy)}`));
    console.log(chalk.white(`   Interval: ${chalk.cyan(options.interval + 's')}`));
    console.log(chalk.white(`   Watch Mode: ${chalk.cyan(options.watch ? 'ON' : 'OFF')}`));
    console.log(chalk.gray('━'.repeat(50)));

    if (verbose) {
      console.log(chalk.gray('\n📋 Sync Configuration:'));
      console.log(chalk.gray(`   Host: ${profile.host}`));
      console.log(chalk.gray(`   User: ${profile.user}`));
      console.log(chalk.gray(`   Protocol: ${profile.protocol}`));
      console.log(chalk.gray(`   Include: ${options.include || 'all'}`));
      console.log(chalk.gray(`   Exclude: ${options.exclude}`));
    }

    // Analyze the local workspace
    console.log(chalk.cyan('\n🔍 Analyzing workspace...'));
    const changes = analyzeChanges(options, verbose);
    displayChanges(changes, verbose);

    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 Dry run — analysis only, nothing was transferred.'));
      return;
    }

    if (changes.upload.length === 0 && changes.download.length === 0 && changes.conflicts.length === 0) {
      console.log(chalk.green('\n✅ No pending changes — nothing to sync.'));
      return;
    }

    // The remote transfer engine is not implemented yet. Report honestly
    // and exit non-zero so scripts/CI never mistake this for a real sync.
    failWith(
      `Remote sync is not implemented yet — ${changes.upload.length} pending upload(s), ` +
      `${changes.download.length} pending download(s) were NOT transferred. ` +
      'Use "cloudsync sync --dry-run" for analysis, or upload/download explicitly.'
    );
  });

function analyzeChanges(options, verbose) {
  const workspace = process.cwd();
  const excludePatterns = options.exclude.split(',').map(p => p.trim());
  const includePatterns = options.include ? options.include.split(',').map(p => p.trim()) : null;

  const changes = {
    upload: [],
    download: [],
    conflicts: [],
    unchanged: []
  };

  function scanDirectory(dir, baseDir = dir) {
    if (!existsSync(dir)) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relative(baseDir, fullPath);

        // Skip hidden directories except .cloudsync
        if (entry.name === '.cloudsync' || entry.name === '.git') {
          continue;
        }

        // Check exclusions
        if (excludePatterns.some(p => relPath.includes(p))) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDirectory(fullPath, baseDir);
        } else if (entry.isFile()) {
          // Check if included
          if (includePatterns) {
            if (!includePatterns.some(p => relPath.includes(p))) {
              continue;
            }
          }

          const fileStat = statSync(fullPath);
          changes.upload.push({
            path: fullPath,
            relative: relPath,
            size: fileStat.size,
            modified: fileStat.mtime
          });
        }
      }
    } catch (e) {
      // Skip inaccessible directories
    }
  }

  scanDirectory(workspace);

  if (verbose) {
    console.log(chalk.gray(`\n📊 Analysis Results:`));
    console.log(chalk.gray(`   Files to upload: ${changes.upload.length}`));
    console.log(chalk.gray(`   Files to download: ${changes.download.length}`));
    console.log(chalk.gray(`   Conflicts: ${changes.conflicts.length}`));
  }

  return changes;
}

function displayChanges(changes, _verbose) {
  if (changes.upload.length > 0) {
    console.log(chalk.cyan('\n📤 Files to upload:'));
    changes.upload.forEach(f => {
      const size = (f.size / 1024).toFixed(1) + ' KB';
      console.log(chalk.gray(`   + ${f.relative} (${size})`));
    });
  }

  if (changes.download.length > 0) {
    console.log(chalk.cyan('\n📥 Files to download:'));
    changes.download.forEach(f => {
      console.log(chalk.gray(`   - ${f.relative}`));
    });
  }

  if (changes.conflicts.length > 0) {
    console.log(chalk.yellow('\n⚠️ Conflicts:'));
    changes.conflicts.forEach(f => {
      console.log(chalk.gray(`   ! ${f}`));
    });
  }
}




export default syncCommand;
