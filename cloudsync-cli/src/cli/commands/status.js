/**
 * status.js - Show current sync status
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';


const statusCommand = new Command('status')
  .description('📊 Show current sync and repository status')
  .option('--verbose', 'Show full details', false)
  .option('--json', 'Output as JSON', false)
  .option('--profile <name>', 'Config profile to check', 'default')
  .action(async (options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const configPath = join(process.cwd(), '.cloudsync', 'config.json');
    const statusFile = join(process.cwd(), '.cloudsync', 'status.json');
    const stagingDir = join(process.cwd(), '.cloudsync', 'staging');
    const indexFile = join(process.cwd(), '.cloudsync', 'history', 'index.json');

    // Get workspace stats
    const workspace = process.cwd();
    const workspaceStats = getWorkspaceStats(workspace);

    // Get sync status
    let syncStatus = {
      lastSync: null,
      lastAction: null,
      pendingChanges: false
    };
    if (existsSync(statusFile)) {
      syncStatus = JSON.parse(readFileSync(statusFile, 'utf8'));
    }

    // Get staged files
    let stagedFiles = [];
    if (existsSync(stagingDir)) {
      stagedFiles = readdirSync(stagingDir).filter(f => f !== 'index.json');
    }

    // Get history
    let commitCount = 0;
    if (existsSync(indexFile)) {
      const history = JSON.parse(readFileSync(indexFile, 'utf8'));
      commitCount = history.length;
    }

    // Build status object
    const status = {
      initialized: existsSync(configPath),
      profile: options.profile,
      workspace: {
        path: workspace,
        totalFiles: workspaceStats.totalFiles,
        totalSize: workspaceStats.totalSize,
        lastModified: workspaceStats.lastModified
      },
      sync: syncStatus,
      versionControl: {
        commits: commitCount,
        stagedFiles: stagedFiles.length,
        pendingChanges: workspaceStats.changedFiles > 0
      },
      timestamp: new Date().toISOString()
    };

    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    // Display status
    console.log(chalk.cyan('\n📊 CloudSync Status'));
    console.log(chalk.gray('━'.repeat(60)));

    // Initialization status
    if (status.initialized) {
      console.log(chalk.green('   ✓ ') + chalk.white('Initialized'));
    } else {
      console.log(chalk.red('   ✗ ') + chalk.white('Not initialized - Run: ') + chalk.cyan('cloudsync init'));
    }

    // Workspace status
    console.log(chalk.gray('\n   📁 Workspace:'));
    console.log(chalk.gray('   ├─ Path: ') + chalk.white(status.workspace.path));
    console.log(chalk.gray('   ├─ Files: ') + chalk.cyan(status.workspace.totalFiles));
    console.log(chalk.gray('   ├─ Size: ') + chalk.cyan(formatBytes(status.workspace.totalSize)));
    console.log(chalk.gray('   └─ Last modified: ') + chalk.white(status.workspace.lastModified));

    // Version control status
    console.log(chalk.gray('\n   🔄 Version Control:'));
    console.log(chalk.gray('   ├─ Total commits: ') + chalk.cyan(status.versionControl.commits));
    console.log(chalk.gray('   ├─ Staged files: ') + chalk.cyan(status.versionControl.stagedFiles));
    
    if (status.versionControl.pendingChanges) {
      console.log(chalk.yellow('   ├─ Changes: ') + chalk.yellow('Pending (run cloudsync stage to track)'));
    } else {
      console.log(chalk.green('   ├─ Changes: ') + chalk.green('None'));
    }

    // Sync status
    console.log(chalk.gray('\n   🔗 Last Sync:'));
    if (syncStatus.lastSync) {
      console.log(chalk.gray('   ├─ Time: ') + chalk.white(new Date(syncStatus.lastSync).toLocaleString()));
      console.log(chalk.gray('   ├─ Action: ') + chalk.cyan(syncStatus.lastAction || 'N/A'));
      
      if (syncStatus.pendingChanges) {
        console.log(chalk.yellow('   └─ Status: ') + chalk.yellow('Local changes pending upload'));
      } else {
        console.log(chalk.green('   └─ Status: ') + chalk.green('In sync'));
      }
    } else {
      console.log(chalk.gray('   └─ ') + chalk.yellow('No sync history'));
    }

    // Staged files detail
    if (verbose && stagedFiles.length > 0) {
      console.log(chalk.gray('\n   📋 Staged Files:'));
      stagedFiles.forEach(f => {
        console.log(chalk.gray('   + ') + chalk.green(f));
      });
    }

    console.log(chalk.gray('━'.repeat(60)));

    // Quick commands
    console.log(chalk.cyan('\n   💡 Quick Commands:'));
    console.log(chalk.gray('      cloudsync stage <files>  # Stage changes'));
    console.log(chalk.gray('      cloudsync commit <msg>   # Commit staged'));
    console.log(chalk.gray('      cloudsync upload         # Push to remote'));
    console.log(chalk.gray('      cloudsync history        # View history'));
  });

function getWorkspaceStats(workspace) {
  let totalFiles = 0;
  let totalSize = 0;
  let lastModified = new Date(0);

  function scan(dir) {
    if (!existsSync(dir)) return;
    
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        // Skip hidden dirs except .cloudsync
        if (entry.name.startsWith('.') && entry.name !== '.cloudsync') continue;
        
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            scan(fullPath);
          }
        } else if (entry.isFile()) {
          try {
            const stat = statSync(fullPath);
            totalFiles++;
            totalSize += stat.size;
            if (stat.mtime > lastModified) {
              lastModified = stat.mtime;
            }
          } catch (e) {
            // Skip files we can't access
          }
        }
      }
    } catch (e) {
      // Skip directories we can't access
    }
  }

  scan(workspace);

  return {
    totalFiles,
    totalSize,
    lastModified: lastModified > new Date(0) ? lastModified.toLocaleString() : 'N/A'
  };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default statusCommand;
