/**
 * history.js - View version control history
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const historyCommand = new Command('history')
  .description('📜 View version control history')
  .option('--limit <n>', 'Number of entries to show', (v) => parseInt(v, 10), 10)
  .option('--file <path>', 'Show history for specific file')
  .option('--format <type>', 'Output format: table|json|short', /^(table|json|short)$/i, 'table')
  .option('--verbose', 'Show detailed history', false)
  .action(async (options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const indexFile = join(process.cwd(), '.cloudsync', 'history', 'index.json');
    
    if (!existsSync(indexFile)) {
      console.log(chalk.yellow('⚠️ No history found. Make some commits first!'));
      return;
    }

    const history = JSON.parse(readFileSync(indexFile, 'utf8'));
    const limitedHistory = history.slice(0, options.limit);

    console.log(chalk.cyan('\n📜 CloudSync History'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.white(`   Total commits: ${chalk.cyan(history.length)}`));
    console.log(chalk.gray('━'.repeat(60)));

    if (verbose) {
      console.log(chalk.gray('\n📋 History Settings:'));
      console.log(chalk.gray(`   Limit: ${options.limit}`));
      console.log(chalk.gray(`   Format: ${options.format}`));
      if (options.file) console.log(chalk.gray(`   File filter: ${options.file}`));
    }

    switch (options.format) {
      case 'json':
        displayJsonHistory(limitedHistory, options.file);
        break;
      case 'short':
        displayShortHistory(limitedHistory);
        break;
      default:
        displayTableHistory(limitedHistory, options.file, verbose);
    }
  });

function displayTableHistory(history, fileFilter, verbose) {
  console.log();
  
  // Header
  console.log(chalk.gray('│') + chalk.cyan(' ID       ') + chalk.gray('│') + 
    chalk.cyan(' Timestamp            ') + chalk.gray('│') + 
    chalk.cyan(' Message                      ') + chalk.gray('│'));
  console.log(chalk.gray('├─────────┼─────────────────────┼──────────────────────────────┤'));

  for (const entry of history) {
    const timestamp = new Date(entry.timestamp).toLocaleString().slice(0, 19);
    const message = (entry.message || 'No message').padEnd(28).slice(0, 28);
    const id = entry.id.padEnd(8);

    console.log(
      chalk.gray('│') + chalk.green(` ${id} `) + chalk.gray('│') +
      chalk.white(` ${timestamp} `) + chalk.gray('│') +
      chalk.white(` ${message} `) + chalk.gray('│')
    );
  }

  console.log(chalk.gray('└─────────┴─────────────────────┴──────────────────────────────┘'));
}

function displayShortHistory(history) {
  console.log();
  for (const entry of history) {
    const timestamp = new Date(entry.timestamp).toLocaleString().slice(0, 10);
    console.log(chalk.green(`${entry.id.slice(0, 7)} `) + 
      chalk.gray(`${timestamp} `) + 
      chalk.white(entry.message || 'No message'));
  }
}

function displayJsonHistory(history, fileFilter) {
  console.log(JSON.stringify(history, null, 2));
}

export default historyCommand;
