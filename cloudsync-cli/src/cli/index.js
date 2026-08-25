/**
 * CloudSync-CLI Main CLI Module
 * Handles all command definitions and execution
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '../version.mjs';
import { showBanner } from '../utils/banner.js';

const packageJson = { version: VERSION };

// Initialize command
const program = new Command();

// Configure global options
program
  .name('cloudsync')
  .description(chalk.cyan('🔒 CloudSync-CLI - Secure cloud-to-local synchronization with Git-like version control'))
  .version(packageJson.version, '-v, --version', 'Output the current version')
  .option('--verbose', 'Enable verbose logging', false)
  .option('-q, --quiet', 'Suppress output messages', false)
  .option('-c, --config <path>', 'Custom config file path')
  .option('--no-color', 'Disable colored output');



// Import command handlers
import initCommand from './commands/init.js';
import uploadCommand from './commands/upload.js';
import downloadCommand from './commands/download.js';
import syncCommand from './commands/sync.js';
import portCommand from './commands/port.js';
import shareCommand from './commands/share.js';
import fetchCommand from './commands/fetch.js';
import ignoreCommand from './commands/ignore.js';
import historyCommand from './commands/history.js';
import diffCommand from './commands/diff.js';
import rollbackCommand from './commands/rollback.js';
import statusCommand from './commands/status.js';
import stageCommand from './commands/stage.js';
import unstageCommand from './commands/unstage.js';
import commitCommand from './commands/commit.js';
import configCommand from './commands/config.js';
import doctorCommand from './commands/doctor.js';
import cloneCommand from './commands/clone.js';
import logCommand from './commands/log.js';
import { checkForUpdates } from '../utils/update-check.js';

// Register all commands
program.addCommand(initCommand);
program.addCommand(uploadCommand);
program.addCommand(downloadCommand);
program.addCommand(syncCommand);
program.addCommand(portCommand);
program.addCommand(shareCommand);
program.addCommand(fetchCommand);
program.addCommand(ignoreCommand);
program.addCommand(historyCommand);
program.addCommand(diffCommand);
program.addCommand(rollbackCommand);
program.addCommand(statusCommand);
program.addCommand(stageCommand);
program.addCommand(unstageCommand);
program.addCommand(commitCommand);
program.addCommand(configCommand);
program.addCommand(doctorCommand);
program.addCommand(cloneCommand);
program.addCommand(logCommand);

// Help subcommand
program
  .command('help [topic]', { isDefault: false })
  .description('Show help information')
  .action((topic) => {
    if (topic) {
      const subCmd = program.commands.find(cmd => cmd.name() === topic);
      if (subCmd) {
        subCmd.help();
      } else {
        console.log(chalk.red(`Unknown topic: ${topic}`));
        console.log('Available topics: ' + program.commands.map(c => c.name()).join(', '));
      }
    } else {
      showBanner(VERSION);
      program.help();
    }
  });


// Add examples to --help output
program.on('--help', () => {
  console.log('');
  console.log(chalk.cyan('📖 Quick Start'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log('  cloudsync init --host server.com --user admin');
  console.log('  cloudsync stage .env config.json');
  console.log('  cloudsync commit "Update config"');
  console.log('  cloudsync upload --include .env --exclude node_modules');
  console.log('  cloudsync download --latest');
  console.log('  cloudsync sync --dry-run');
  console.log('');
  console.log(chalk.cyan('💡 More Examples'));
  console.log(chalk.gray('━'.repeat(60)));
  console.log('  cloudsync fetch http://192.168.1.5:8095/share/abc1234');
  console.log('  cloudsync ignore --template node');
  console.log('  cloudsync upload --protocol rsync --include .env');
  console.log('  cloudsync sync --watch --interval 30');
  console.log('  cloudsync share . --expires 30');
  console.log('  cloudsync port 3000:3000');
  console.log('  cloudsync init --profile staging --host staging.example.com');
  console.log('');
  console.log(chalk.cyan('🔗 Full documentation:'));
  console.log(chalk.white('  https://github.com/Tech4File/cloudsync-cli#readme'));
  console.log('');
});

// Parse arguments
program.parse(process.argv);

// Show banner when no args
if (process.argv.length === 2) {
  showBanner(VERSION);
}

// Asynchronous non-blocking background update check
if (!process.env.CI && process.env.NODE_ENV !== 'test' && !process.argv.includes('-v') && !process.argv.includes('--version') && !process.argv.includes('-h') && !process.argv.includes('--help')) {
  checkForUpdates(VERSION).catch(() => {});
}

// Export for testing
export { program, showBanner };
