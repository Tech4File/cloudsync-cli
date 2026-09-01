/**
 * stage.js - Stage files for commit (Git-like staging area)
 *
 * Copies files into .cloudsync/staging/ so they can be committed as a snapshot.
 * Paths are validated with safePath()/isSafeFilename() before copying —
 * traversal sequences, null bytes and Windows reserved names are rejected.
 * The --all scan skips the .cloudsync/ directory itself so snapshots never
 * include their own history.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, statSync, renameSync, unlinkSync } from 'fs';
import { join, relative, basename } from 'path';
import { formatBytes } from '../../utils/helpers.js';
import { safePath, isSafeFilename } from '../../utils/security.js';
import { failWith, okWith } from '../../utils/exit.js';

const stageCommand = new Command('stage')
  .description('Stage files for commit (Git-like staging area)')
  .argument('[files...]', 'Files to stage')
  .option('--all', 'Stage all changed files', false)
  .option('--include <patterns>', 'Include patterns (comma-separated)')
  .option('--exclude <patterns>', 'Exclude patterns (comma-separated)', 'node_modules,.git,dist,build')
  .option('--verbose', 'Show detailed staging info', false)
  .action(async (files, options) => {
    okWith();

    const verbose = options.verbose || process.argv.includes('--verbose');
    const stagingDir = join(process.cwd(), '.cloudsync', 'staging');

    if (!existsSync(stagingDir)) {
      mkdirSync(stagingDir, { recursive: true });
    }

    const stagedFiles = [];
    const rejectedFiles = [];
    const workspace = process.cwd();

    if (options.all) {
      console.log(chalk.cyan('\nStaging all files...'));

      const excludePatterns = options.exclude.split(',').map(p => p.trim());

      function scan(dir) {
        try {
          const entries = readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            const relPath = relative(workspace, fullPath);

            // Never stage the repository's own metadata/history
            if (entry.name === '.cloudsync') continue;
            // Skip any other dotfile dirs (e.g., .git, .vscode, .idea) for hygiene
            if (entry.name.startsWith('.') && entry.isDirectory()) continue;

            // Check exclusions
            if (excludePatterns.some(p => relPath.includes(p))) continue;

            if (entry.isDirectory()) {
              scan(fullPath);
            } else if (entry.isFile()) {
              stageFile(fullPath, stagedFiles, stagingDir, verbose, rejectedFiles);
            }
          }
        } catch (e) {
          // Skip inaccessible directories
        }
      }

      scan(workspace);
    } else if (files.length > 0) {
      console.log(chalk.cyan('\nStaging specified files...'));

      for (const file of files) {
        // Validate path safety before copying anything into staging
        const check = safePath(file, workspace);
        if (!check.safe) {
          rejectedFiles.push({ file, reason: check.error || 'unsafe path' });
          console.log(chalk.yellow(`   Rejected unsafe path: ${file} (${check.error})`));
          continue;
        }
        const fname = basename(file);
        if (!isSafeFilename(fname)) {
          rejectedFiles.push({ file, reason: 'reserved/unsafe filename' });
          console.log(chalk.yellow(`   Rejected reserved filename: ${fname}`));
          continue;
        }
        if (!existsSync(check.resolved)) {
          console.log(chalk.yellow(`   File not found: ${file}`));
          rejectedFiles.push({ file, reason: 'not found' });
          continue;
        }
        stageFile(check.resolved, stagedFiles, stagingDir, verbose, rejectedFiles, file);
      }
    } else {
      // Show what's staged (no changes to commit)
      showStagedFiles(stagingDir, verbose);
      return;
    }

    // Save staged files list (atomic write)
    saveStagedIndex(stagedFiles, verbose);

    if (stagedFiles.length > 0) {
      console.log(chalk.green('\nStaged ') + chalk.cyan(stagedFiles.length) + chalk.green(' file(s)'));
      if (rejectedFiles.length > 0) {
        console.log(chalk.yellow(`   (${rejectedFiles.length} rejected)`));
      }
      console.log(chalk.gray('\n   Commit with: ') + chalk.cyan('cloudsync commit "<message>"'));
    } else {
      // Nothing accepted — treat as a failure for scripting
      failWith(`No files staged${rejectedFiles.length ? ` (${rejectedFiles.length} rejected)` : ''}`);
    }
  });

function stageFile(filePath, stagedFiles, stagingDir, verbose, rejectedFiles, originalArg) {
  try {
    const relPath = originalArg || relative(process.cwd(), filePath);
    const safeName = relPath.replace(/[\\/]/g, '__');
    const stagedPath = join(stagingDir, safeName);

    copyFileSync(filePath, stagedPath);
    stagedFiles.push(relPath);

    if (verbose) {
      console.log(chalk.green(`   + ${relPath}`));
    }
  } catch (e) {
    if (verbose) console.log(chalk.red(`   Failed to stage: ${filePath}`));
    rejectedFiles.push({ file: filePath, reason: e.message });
  }
}

function showStagedFiles(stagingDir, verbose) {
  const files = readdirSync(stagingDir).filter(f => f !== 'index.json');

  console.log(chalk.cyan('\nStaged Files:'));
  console.log(chalk.gray('-'.repeat(40)));

  if (files.length === 0) {
    console.log(chalk.yellow('   No files staged'));
    console.log(chalk.gray('\n   Usage:'));
    console.log(chalk.gray('      cloudsync stage <files...>  # Stage specific files'));
    console.log(chalk.gray('      cloudsync stage --all       # Stage all'));
  } else {
    files.forEach(f => {
      try {
        const stat = statSync(join(stagingDir, f));
        const size = formatBytes(stat.size);
        console.log(chalk.green('   + ') + chalk.white(f) + chalk.gray(` (${size})`));
      } catch (e) {
        console.log(chalk.green('   + ') + chalk.white(f));
      }
    });

    console.log(chalk.gray('-'.repeat(40)));
    console.log(chalk.gray(`   ${files.length} file(s) staged`));
  }
}

function saveStagedIndex(files, verbose) {
  const indexFile = join(process.cwd(), '.cloudsync', 'staging', 'index.json');
  // Atomic write: temp + rename — prevents races with concurrent stage invocations
  const tmp = indexFile + '.tmp';
  writeFileSync(tmp, JSON.stringify({
    files,
    timestamp: new Date().toISOString()
  }, null, 2));
  try {
    renameSync(tmp, indexFile);
  } catch (e) {
    // Fallback: just copy if rename across mount fails
    writeFileSync(indexFile, JSON.stringify({ files, timestamp: new Date().toISOString() }, null, 2));
    try { unlinkSync(tmp); } catch (_) { }
  }

  if (verbose) console.log(chalk.gray(`Staging index saved`));
}

export default stageCommand;
