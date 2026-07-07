/**
 * stage.js - Stage files for commit (Git-like)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const stageCommand = new Command('stage')
  .description('📦 Stage files for commit (Git-like staging area)')
  .argument('[files...]', 'Files to stage')
  .option('--all', 'Stage all changed files', false)
  .option('--include <patterns>', 'Include patterns (comma-separated)')
  .option('--exclude <patterns>', 'Exclude patterns (comma-separated)', 'node_modules,.git,dist,build')
  .option('--verbose', 'Show detailed staging info', false)
  .action(async (files, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const stagingDir = join(process.cwd(), '.cloudsync', 'staging');
    
    if (!existsSync(stagingDir)) {
      mkdirSync(stagingDir, { recursive: true });
    }

    const stagedFiles = [];
    const workspace = process.cwd();

    if (options.all) {
      // Stage all files
      console.log(chalk.cyan('\n📦 Staging all files...'));
      
      const excludePatterns = options.exclude.split(',').map(p => p.trim());
      
      function scan(dir) {
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            const relPath = relative(workspace, fullPath);
            
            // Skip hidden dirs except .cloudsync
            if (entry.name.startsWith('.') && entry.name !== '.cloudsync') continue;
            
            // Check exclusions
            if (excludePatterns.some(p => relPath.includes(p))) continue;
            
            if (entry.isDirectory()) {
              if (entry.name !== 'node_modules' && entry.name !== '.git') {
                scan(fullPath);
              }
            } else if (entry.isFile()) {
              stageFile(fullPath, stagedFiles, stagingDir, verbose);
            }
          }
        } catch (e) {
          // Skip inaccessible directories
        }
      }
      
      scan(workspace);
    } else if (files.length > 0) {
      // Stage specific files
      console.log(chalk.cyan('\n📦 Staging specified files...'));
      
      for (const file of files) {
        const fullPath = join(workspace, file);
        if (existsSync(fullPath)) {
          stageFile(fullPath, stagedFiles, stagingDir, verbose);
        } else {
          console.log(chalk.yellow(`   ⚠️ File not found: ${file}`));
        }
      }
    } else {
      // Show what's staged
      showStagedFiles(stagingDir, verbose);
      return;
    }

    // Save staged files list
    saveStagedIndex(stagedFiles, verbose);

    if (stagedFiles.length > 0) {
      console.log(chalk.green('\n✅ Staged ') + chalk.cyan(stagedFiles.length) + chalk.green(' file(s)'));
      console.log(chalk.gray('\n   Commit with: ') + chalk.cyan('cloudsync commit "<message>"'));
    } else {
      console.log(chalk.yellow('\n⚠️ No files staged'));
    }
  });

function stageFile(filePath, stagedFiles, stagingDir, verbose) {
  try {
    const relPath = relative(process.cwd(), filePath);
    const stagedPath = join(stagingDir, basename(filePath));
    
    // Copy to staging area
    copyFileSync(filePath, stagedPath);
    stagedFiles.push(relPath);
    
    if (verbose) {
      console.log(chalk.green(`   + ${relPath}`));
    }
  } catch (e) {
    if (verbose) console.log(chalk.red(`   ✗ Failed to stage: ${filePath}`));
  }
}

function showStagedFiles(stagingDir, verbose) {
  const files = readdirSync(stagingDir).filter(f => f !== 'index.json');
  
  console.log(chalk.cyan('\n📦 Staged Files:'));
  console.log(chalk.gray('─'.repeat(40)));
  
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
    
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.gray(`   ${files.length} file(s) staged`));
  }
}

function saveStagedIndex(files, verbose) {
  const indexFile = join(process.cwd(), '.cloudsync', 'staging', 'index.json');
  writeFileSync(indexFile, JSON.stringify({
    files,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  if (verbose) console.log(chalk.gray(`Staging index saved`));
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default stageCommand;
