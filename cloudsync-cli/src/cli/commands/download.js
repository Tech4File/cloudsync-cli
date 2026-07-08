/**
 * download.js - Download files from remote with version control
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { logOperation } from '../../utils/logger.js';


const downloadCommand = new Command('download')
  .description('📥 Download files from remote with version history')
  .argument('[files...]', 'Specific files to download')
  .option('--include <patterns>', 'Include patterns (comma-separated)')
  .option('--exclude <patterns>', 'Exclude patterns (comma-separated)')
  .option('--version <id>', 'Download specific version')
  .option('--latest', 'Fetch latest version', false)
  .option('--verbose', 'Show detailed progress', false)
  .option('--dry-run', 'Preview without downloading', false)
  .option('--profile <name>', 'Config profile to use', 'default')
  .option('--output <path>', 'Output directory', './')
  .action(async (files, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const configPath = join(process.cwd(), '.cloudsync', 'config.json');
    
    if (!existsSync(configPath)) {
      console.log(chalk.red('❌ Not initialized. Run: cloudsync init'));
      return;
    }

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const profile = config.profiles[options.profile] || config.profiles[config.settings.defaultProfile];
    
    if (!profile) {
      console.log(chalk.red(`❌ Profile '${options.profile}' not found`));
      return;
    }

    if (verbose) {
      console.log(chalk.gray('\n📋 Download Configuration:'));
      console.log(chalk.gray(`   Host: ${profile.host}`));
      console.log(chalk.gray(`   User: ${profile.user}`));
      if (options.version) console.log(chalk.gray(`   Version: ${options.version}`));
      if (options.latest) console.log(chalk.gray('   Mode: Latest'));
    }

    // Check version history
    const indexFile = join(process.cwd(), '.cloudsync', 'history', 'index.json');
    if (options.version || options.latest) {
      let versionInfo = null;
      
      if (existsSync(indexFile)) {
        const history = JSON.parse(readFileSync(indexFile, 'utf8'));
        if (options.latest && history.length > 0) {
          versionInfo = history[0];
        } else if (options.version) {
          versionInfo = history.find(h => h.id === options.version);
        }
      }

      if (versionInfo) {
        console.log(chalk.cyan(`\n📦 Fetching version: ${versionInfo.id}`));
        console.log(chalk.gray(`   Message: ${versionInfo.message}`));
        console.log(chalk.gray(`   Time: ${new Date(versionInfo.timestamp).toLocaleString()}`));
        
        const commitFile = join(process.cwd(), '.cloudsync', 'history', 'commits', `${versionInfo.id}.json`);
        if (existsSync(commitFile)) {
          const commit = JSON.parse(readFileSync(commitFile, 'utf8'));
          if (verbose) {
            console.log(chalk.gray('\n📁 Files in this version:'));
            commit.files.forEach(f => console.log(chalk.gray(`   - ${f}`)));
          }
        }
      }
    }

    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 Dry run mode - no files downloaded'));
      return;
    }

    // Simulate download
    console.log(chalk.cyan('\n🚀 Downloading via SSH...'));
    
    try {
      await downloadWithProtocol(profile, options, verbose);
      logOperation('download', `Downloaded files from ${profile.host}`);
      console.log(chalk.green('\n✅ Download complete!'));
      
      // Update local status
      updateLocalStatus(verbose);
    } catch (error) {
      console.log(chalk.red(`\n❌ Download failed: ${error.message}`));
      if (verbose) console.error(error.stack);
    }
  });

async function downloadWithProtocol(profile, options, verbose) {
  const host = profile.host;
  const port = profile.port || 22;
  const username = profile.user;
  const keyPath = profile.key;

  if (verbose) {
    console.log(chalk.gray(`\n🔌 Connecting to ${username}@${host}:${port}`));
  }

  return new Promise((resolve) => {
    console.log(chalk.yellow('\n⚠️ SSH connection not available (demo mode)'));
    console.log(chalk.gray('   In production, files would be downloaded via:'));
    console.log(chalk.cyan(`   scp ${username}@${host}:~/.cloudsync/uploads/<file> ./`));
    resolve();
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
