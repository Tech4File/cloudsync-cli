/**
 * init.js - Initialize CloudSync configuration
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { logOperation } from '../../utils/logger.js';

const initCommand = new Command('init')
  .description('Initialize CloudSync configuration profile')
  .option('--host <hostname>', 'Remote host address (e.g., your-server.com)')
  .option('--user <username>', 'SSH username')
  .option('--port <number>', 'SSH port', (v) => parseInt(v, 10), 22)
  .option('--key <path>', 'Path to SSH private key')
  .option('--protocol <protocol>', 'Default transport protocol', /^(ssh|rsync|sftp|websocket|pipe)$/i, 'ssh')
  .option('--workspace <path>', 'Local workspace path', process.cwd())
  .option('--name <profile>', 'Profile name', 'default')
  .option('--force', 'Overwrite existing configuration', false)
  .option('--verbose', 'Show detailed output', false)
  .action(async (options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    
    if (verbose) {
      console.log(chalk.gray('\n🔍 Verbose mode enabled'));
      console.log(chalk.gray('Options received:'), options);
    }

    const configDir = join(process.cwd(), '.cloudsync');
    const configPath = join(configDir, 'config.json');
    const historyDir = join(configDir, 'history');
    const stagingDir = join(configDir, 'staging');

    // Create directories
    [configDir, historyDir, join(historyDir, 'commits'), join(historyDir, 'diffs'), join(stagingDir)].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        if (verbose) console.log(chalk.gray(`Created directory: ${dir}`));
      }
    });

    // Load existing config or create new
    let config = { profiles: {}, settings: {} };
    if (existsSync(configPath) && !options.force) {
      try {
        config = JSON.parse(readFileSync(configPath, 'utf8'));
        if (verbose) console.log(chalk.gray('Loaded existing configuration'));
      } catch (e) {
        if (verbose) console.log(chalk.yellow('Existing config corrupted, creating new one'));
      }
    }

    // Use options or defaults
    const host = options.host || 'your-server.com';
    const user = options.user || process.env.USER || 'user';
    const port = options.port || 22;
    const keyPath = options.key || join(homedir(), '.ssh', 'id_rsa');
    const protocol = options.protocol;
    const workspace = options.workspace;

    // Build profile
    const profileName = options.name;
    config.profiles[profileName] = {
      host,
      user,
      port: parseInt(port, 10),
      key: keyPath,
      protocol: protocol.toLowerCase(),
      workspace,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    // Default settings
    config.settings = {
      compression: 'zip',
      chunkSize: 10,
      verbose: verbose,
      defaultProfile: profileName
    };

    // Save config
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    logOperation('init', `Initialized profile '${profileName}' -> ${host}:${port}`);

    console.log(chalk.green('\n✅ CloudSync initialized successfully!'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white(`   Profile: ${chalk.cyan(profileName)}`));
    console.log(chalk.white(`   Host: ${chalk.cyan(host)}`));
    console.log(chalk.white(`   User: ${chalk.cyan(user)}`));
    console.log(chalk.white(`   Port: ${chalk.cyan(port)}`));
    console.log(chalk.white(`   Protocol: ${chalk.cyan(protocol)}`));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.gray(`\n📁 Config saved to: ${configPath}`));
    console.log(chalk.cyan('\n🚀 Next steps:'));
    console.log(chalk.gray('   cloudsync upload --help'));
    console.log(chalk.gray('   cloudsync doctor  # Test your connection'));
  });

export default initCommand;
