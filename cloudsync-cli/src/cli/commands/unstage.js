/**
 * unstage.js - Remove files from staging area
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';


const unstageCommand = new Command('unstage')
  .description('📤 Remove files from staging area')
  .argument('[files...]', 'Files to unstage')
  .option('--all', 'Unstage all files', false)
  .option('--verbose', 'Show detailed output', false)
  .action(async (files, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const stagingDir = join(process.cwd(), '.cloudsync', 'staging');
    const indexFile = join(stagingDir, 'index.json');

    if (!existsSync(stagingDir)) {
      console.log(chalk.yellow('⚠️ No staging area exists'));
      return;
    }

    const stagedFiles = readdirSync(stagingDir).filter(f => f !== 'index.json');

    if (stagedFiles.length === 0) {
      console.log(chalk.yellow('⚠️ No files are staged'));
      return;
    }

    if (options.all) {
      // Unstage all
      console.log(chalk.cyan('\n📤 Unstaging all files...'));
      
      let count = 0;
      stagedFiles.forEach(f => {
        const path = join(stagingDir, f);
        unlinkSync(path);
        count++;
        if (verbose) console.log(chalk.red(`   - ${f}`));
      });

      // Clear index
      if (existsSync(indexFile)) {
        unlinkSync(indexFile);
      }

      console.log(chalk.green(`\n✅ Unstaged ${count} file(s)`));
    } else if (files.length > 0) {
      // Unstage specific files
      console.log(chalk.cyan('\n📤 Unstaging specified files...'));
      
      let count = 0;
      files.forEach(f => {
        const stagedName = f.split('/').pop();
        const path = join(stagingDir, stagedName);
        
        if (existsSync(path)) {
          unlinkSync(path);
          count++;
          if (verbose) console.log(chalk.red(`   - ${stagedName}`));
        } else {
          console.log(chalk.yellow(`   ⚠️ Not staged: ${f}`));
        }
      });

      console.log(chalk.green(`\n✅ Unstaged ${count} file(s)`));
    } else {
      // Show usage
      console.log(chalk.cyan('\n📤 CloudSync Unstage'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(chalk.gray('Usage:'));
      console.log(chalk.gray('   cloudsync unstage <files...>  # Unstage specific files'));
      console.log(chalk.gray('   cloudsync unstage --all      # Unstage all files'));
    }

    // Update index
    const remainingFiles = readdirSync(stagingDir).filter(f => f !== 'index.json');
    if (remainingFiles.length > 0) {
      writeFileSync(indexFile, JSON.stringify({
        files: remainingFiles,
        timestamp: new Date().toISOString()
      }, null, 2));
    } else if (existsSync(indexFile)) {
      unlinkSync(indexFile);
    }
  });

export default unstageCommand;
