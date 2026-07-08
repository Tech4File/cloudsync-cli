/**
 * diff.js - Compare file versions
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import DiffMatchPatch from 'diff-match-patch';


const diffCommand = new Command('diff')
  .description('📊 Compare file versions')
  .argument('[versions...]', 'Version IDs to compare (default: last 2)')
  .option('--stat', 'Show change statistics only', false)
  .option('--verbose', 'Show detailed diff output', false)
  .option('--file <path>', 'Compare specific file across versions')
  .action(async (versions, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const indexFile = join(process.cwd(), '.cloudsync', 'history', 'index.json');
    
    if (!existsSync(indexFile)) {
      console.log(chalk.red('❌ No history found'));
      return;
    }

    const history = JSON.parse(readFileSync(indexFile, 'utf8'));
    
    // Default to last 2 versions
    if (versions.length === 0) {
      versions = [history[1]?.id, history[0]?.id].filter(Boolean);
    }

    if (versions.length < 2) {
      console.log(chalk.yellow('⚠️ Need at least 2 versions to compare'));
      return;
    }

    console.log(chalk.cyan('\n📊 CloudSync Diff'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.white(`   Comparing: ${chalk.cyan(versions[0])} → ${chalk.cyan(versions[1])}`));
    if (options.file) console.log(chalk.white(`   File: ${chalk.cyan(options.file)}`));
    console.log(chalk.gray('━'.repeat(60)));

    // Load commits
    const commitsDir = join(process.cwd(), '.cloudsync', 'history', 'commits');
    const commits = versions.map(v => {
      const file = join(commitsDir, `${v}.json`);
      if (existsSync(file)) {
        return JSON.parse(readFileSync(file, 'utf8'));
      }
      return null;
    }).filter(Boolean);

    if (commits.length < 2) {
      console.log(chalk.red('❌ Could not load one or more versions'));
      return;
    }

    // Calculate diff statistics
    const stats = {
      added: 0,
      removed: 0,
      modified: 0
    };

    // Files in first version
    const oldFiles = new Set(commits[0].files || []);
    // Files in second version
    const newFiles = new Set(commits[1].files || []);

    // Find added files
    for (const file of newFiles) {
      if (!oldFiles.has(file)) {
        stats.added++;
        if (verbose) console.log(chalk.green(`+ ${file} (new)`));
      }
    }

    // Find removed files
    for (const file of oldFiles) {
      if (!newFiles.has(file)) {
        stats.removed++;
        if (verbose) console.log(chalk.red(`- ${file} (removed)`));
      }
    }

    // Find modified files
    for (const file of oldFiles) {
      if (newFiles.has(file)) {
        stats.modified++;
        if (verbose) console.log(chalk.yellow(`~ ${file} (modified)`));
      }
    }

    if (options.stat) {
      console.log(chalk.cyan('\n📈 Change Statistics:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(chalk.green(`   Added:     ${stats.added}`));
      console.log(chalk.red(`   Removed:   ${stats.removed}`));
      console.log(chalk.yellow(`   Modified:  ${stats.modified}`));
      console.log(chalk.gray('─'.repeat(40)));
    }

    // Summary
    console.log(chalk.cyan('\n📋 Summary:'));
    console.log(chalk.gray('━'.repeat(60)));
    const totalChanges = stats.added + stats.removed + stats.modified;
    console.log(chalk.white(`   Total changes: ${chalk.cyan(totalChanges)}`));
    console.log(chalk.gray(`   Commits compared: ${commits.length}`));
    
    if (totalChanges === 0) {
      console.log(chalk.green('   Status: No differences detected'));
    } else {
      const changePercent = ((totalChanges / (commits[1].files?.length || 1)) * 100).toFixed(1);
      console.log(chalk.white(`   Change rate: ${chalk.cyan(changePercent + '%')}`));
    }
    console.log(chalk.gray('━'.repeat(60)));
  });

export default diffCommand;
