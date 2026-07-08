/**
 * log.js - Show detailed operation logs
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const logCommand = new Command('log')
  .description('📜 Show detailed operation logs')
  .option('--limit <n>', 'Number of entries', (v) => parseInt(v, 10), 20)
  .option('--type <type>', 'Filter by type: upload|download|sync|all', /^(upload|download|sync|all)$/i, 'all')
  .option('--format <type>', 'Output format: detailed|short|json', /^(detailed|short|json)$/i, 'detailed')
  .option('--verbose', 'Show full log data', false)
  .action(async (options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const logsDir = join(process.cwd(), '.cloudsync', 'logs');
    
    if (!existsSync(logsDir)) {
      console.log(chalk.yellow('⚠️ No logs found'));
      console.log(chalk.gray('   Logs are created when you use CloudSync commands'));
      return;
    }

    // Get log files
    const logFiles = readdirSync(logsDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, options.limit);

    if (logFiles.length === 0) {
      console.log(chalk.yellow('⚠️ No log entries found'));
      return;
    }

    console.log(chalk.cyan('\n📜 CloudSync Logs'));
    console.log(chalk.gray('━'.repeat(70)));
    console.log(chalk.white(`   Showing ${logFiles.length} entries (type: ${options.type})`));
    console.log(chalk.gray('━'.repeat(70)));

    const logs = [];
    for (const file of logFiles) {
      try {
        const log = JSON.parse(readFileSync(join(logsDir, file), 'utf8'));
        
        if (options.type !== 'all' && log.type !== options.type) {
          continue;
        }
        
        logs.push(log);
      } catch (e) {
        // Skip invalid log files
      }
    }

    switch (options.format) {
      case 'short':
        displayShortLogs(logs);
        break;
      case 'json':
        console.log(JSON.stringify(logs, null, 2));
        break;
      default:
        displayDetailedLogs(logs, verbose);
    }
  });

function displayDetailedLogs(logs, verbose) {
  for (const log of logs) {
    const timestamp = new Date(log.timestamp).toLocaleString();
    const typeColor = getTypeColor(log.type);
    
    console.log();
    console.log(chalk.gray('┌' + '─'.repeat(68) + '┐'));
    console.log(chalk.gray('│') + chalk.cyan(` ${timestamp} `.padEnd(50)) + typeColor(` ${(log.type || 'unknown').toUpperCase()} `.padStart(16)) + chalk.gray('│'));
    console.log(chalk.gray('├' + '─'.repeat(68) + '┤'));
    console.log(chalk.gray('│') + chalk.white(` ${log.message || 'No message'}`.padEnd(68)) + chalk.gray('│'));
    
    if (verbose && log.files) {
      console.log(chalk.gray('│'));
      log.files.slice(0, 5).forEach(f => {
        console.log(chalk.gray('│') + chalk.gray(`   - ${f}`.padEnd(66)) + chalk.gray('│'));
      });
      if (log.files.length > 5) {
        console.log(chalk.gray('│') + chalk.gray(`   ... and ${log.files.length - 5} more`.padEnd(66)) + chalk.gray('│'));
      }
    }
    
    if (log.duration) {
      console.log(chalk.gray('│') + chalk.gray(` Duration: ${log.duration}ms`.padEnd(68)) + chalk.gray('│'));
    }
    
    console.log(chalk.gray('└' + '─'.repeat(68) + '┘'));
  }
}

function displayShortLogs(logs) {
  for (const log of logs) {
    const timestamp = new Date(log.timestamp).toLocaleString().slice(0, 16);
    const type = (log.type || 'unknown').padEnd(8).slice(0, 8);
    
    console.log(
      chalk.gray(`${timestamp} `) +
      getTypeColor(log.type)(type) +
      chalk.white(` ${log.message || 'No message'}`)
    );
  }
}

function getTypeColor(type) {
  switch (type) {
    case 'upload': return chalk.green;
    case 'download': return chalk.blue;
    case 'sync': return chalk.cyan;
    case 'error': return chalk.red;
    default: return chalk.white;
  }
}

export default logCommand;
