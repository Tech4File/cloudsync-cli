/**
 * unstage.js - Remove files from the staging area
 *
 * Removes specific files (--all for everything) from .cloudsync/staging/
 * and refreshes the staging index. Exits non-zero when nothing could be
 * unstaged so scripts can detect a no-op.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, unlinkSync, writeFileSync, renameSync } from 'fs';
import { join } from 'path';
import { failWith, okWith } from '../../utils/exit.js';


const unstageCommand = new Command('unstage')
  .description('Remove files from staging area')
  .argument('[files...]', 'Files to unstage')
  .option('--all', 'Unstage all files', false)
  .option('--verbose', 'Show detailed output', false)
  .action(async (files, options) => {
    okWith();

    const verbose = options.verbose || process.argv.includes('--verbose');
    const stagingDir = join(process.cwd(), '.cloudsync', 'staging');
    const indexFile = join(stagingDir, 'index.json');

    if (!existsSync(stagingDir)) {
      failWith('No staging area exists. Run cloudsync init and stage some files first.');
      return;
    }

    const stagedFiles = readdirSync(stagingDir).filter(f => f !== 'index.json');

    if (stagedFiles.length === 0) {
      failWith('No files are staged.');
      return;
    }

    if (options.all) {
      console.log(chalk.cyan('\nUnstaging all files...'));

      let count = 0;
      stagedFiles.forEach(f => {
        try {
          unlinkSync(join(stagingDir, f));
          count++;
          if (verbose) console.log(chalk.red(`   - ${f}`));
        } catch (e) {
          if (verbose) console.log(chalk.yellow(`   Could not remove ${f}: ${e.message}`));
        }
      });

      if (existsSync(indexFile)) {
        try { unlinkSync(indexFile); } catch (_) { }
      }

      console.log(chalk.green(`\nUnstaged ${count} file(s)`));
    } else if (files.length > 0) {
      console.log(chalk.cyan('\nUnstaging specified files...'));

      let count = 0;
      let notFound = 0;
      files.forEach(f => {
        const safeName = f.replace(/[\\/]/g, '__');
        const path1 = join(stagingDir, safeName);
        const path2 = join(stagingDir, f);
        const path3 = join(stagingDir, f.split(/[\\/]/).pop());
        const targetPath = existsSync(path1) ? path1 : (existsSync(path2) ? path2 : path3);

        if (existsSync(targetPath)) {
          try {
            unlinkSync(targetPath);
            count++;
            if (verbose) console.log(chalk.red(`   - ${f}`));
          } catch (e) {
            notFound++;
            if (verbose) console.log(chalk.yellow(`   Could not remove ${f}: ${e.message}`));
          }
        } else {
          notFound++;
          if (verbose) console.log(chalk.yellow(`   Not staged: ${f}`));
        }
      });

      console.log(chalk.green(`\nUnstaged ${count} file(s)`));
      if (notFound > 0 && count === 0) {
        failWith(`No staged files matched. ${notFound} not found.`);
      }
    } else {
      console.log(chalk.cyan('\nCloudSync Unstage'));
      console.log(chalk.gray('-'.repeat(40)));
      console.log(chalk.gray('Usage:'));
      console.log(chalk.gray('   cloudsync unstage <files...>  # Unstage specific files'));
      console.log(chalk.gray('   cloudsync unstage --all      # Unstage all files'));
    }

    // Update index atomically
    const remainingFiles = readdirSync(stagingDir).filter(f => f !== 'index.json');
    if (remainingFiles.length > 0) {
      const tmp = indexFile + '.tmp';
      writeFileSync(tmp, JSON.stringify({
        files: remainingFiles,
        timestamp: new Date().toISOString()
      }, null, 2));
      try { renameSync(tmp, indexFile); } catch (_) {
        writeFileSync(indexFile, JSON.stringify({ files: remainingFiles, timestamp: new Date().toISOString() }, null, 2));
        try { unlinkSync(tmp); } catch (__) { }
      }
    } else if (existsSync(indexFile)) {
      try { unlinkSync(indexFile); } catch (_) { }
    }
  });

export default unstageCommand;
