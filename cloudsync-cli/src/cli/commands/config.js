/**
 * config.js - Manage CloudSync configuration
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const configCommand = new Command('config')
  .description('⚙️ Manage CloudSync configuration')
  .argument('[key]', 'Configuration key')
  .argument('[value]', 'Configuration value')
  .option('--global', 'Use global config', false)
  .option('--list', 'List all configuration', false)
  .option('--unset <key>', 'Remove a configuration key')
  .option('--verbose', 'Show detailed info', false)
  .action(async (key, value, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    
    const configDir = options.global 
      ? join(homedir(), '.cloudsync')
      : join(process.cwd(), '.cloudsync');
    
    const configPath = join(configDir, 'config.json');

    // Ensure config directory exists
    if (!existsSync(configDir)) {
      if (key || value) {
        console.log(chalk.yellow('⚠️ No config found. Run: cloudsync init'));
        return;
      }
    }

    // Load or create config
    let config = {};
    if (existsSync(configPath)) {
      try {
        config = JSON.parse(readFileSync(configPath, 'utf8'));
      } catch (e) {
        config = {};
      }
    }

    if (verbose) {
      console.log(chalk.gray(`\n📋 Config path: ${configPath}`));
    }

    // List all config
    if (options.list) {
      console.log(chalk.cyan('\n⚙️ CloudSync Configuration'));
      console.log(chalk.gray('━'.repeat(50)));
      displayConfig(config, verbose);
      return;
    }

    // Unset key
    if (options.unset) {
      const keys = options.unset.split('.');
      unsetNestedKey(config, keys);
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green(`\n✅ Unset: ${options.unset}`));
      return;
    }

    // Get value
    if (key && !value) {
      const keys = key.split('.');
      const val = getNestedValue(config, keys);
      
      if (val !== undefined) {
        console.log(chalk.cyan(`${key} = `) + chalk.white(JSON.stringify(val)));
      } else {
        console.log(chalk.yellow(`\n⚠️ Key not found: ${key}`));
      }
      return;
    }

    // Set value
    if (key && value) {
      const keys = key.split('.');
      setNestedValue(config, keys, parseValue(value));
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green('\n✅ Configuration updated:'));
      console.log(chalk.cyan(`   ${key} = `) + chalk.white(JSON.stringify(parseValue(value))));
      return;
    }

    // Show usage
    console.log(chalk.cyan('\n⚙️ CloudSync Config'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.gray('Usage:'));
    console.log(chalk.gray('   cloudsync config                    # Show all config'));
    console.log(chalk.gray('   cloudsync config --list             # List all settings'));
    console.log(chalk.gray('   cloudsync config <key>              # Get value'));
    console.log(chalk.gray('   cloudsync config <key> <value>      # Set value'));
    console.log(chalk.gray('   cloudsync config --unset <key>     # Remove key'));
    console.log(chalk.gray('   cloudsync config --global          # Use global config'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.gray('\n📁 Current config:'));
    displayConfig(config, verbose);
  });

function displayConfig(config, verbose) {
  if (verbose) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  const settings = config.settings || {};
  const profiles = config.profiles || {};

  console.log(chalk.gray('\n   Settings:'));
  if (Object.keys(settings).length === 0) {
    console.log(chalk.yellow('      No settings configured'));
  } else {
    Object.entries(settings).forEach(([k, v]) => {
      console.log(chalk.gray(`      ${k}: `) + chalk.white(JSON.stringify(v)));
    });
  }

  console.log(chalk.gray('\n   Profiles:'));
  if (Object.keys(profiles).length === 0) {
    console.log(chalk.yellow('      No profiles configured'));
  } else {
    Object.entries(profiles).forEach(([name, p]) => {
      console.log(chalk.cyan(`      [${name}]`));
      console.log(chalk.gray(`         host: ${p.host || 'N/A'}`));
      console.log(chalk.gray(`         user: ${p.user || 'N/A'}`));
      console.log(chalk.gray(`         port: ${p.port || 22}`));
    });
  }
}

function getNestedValue(obj, keys) {
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function setNestedValue(obj, keys, value) {
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

function unsetNestedKey(obj, keys) {
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current && typeof current === 'object' && keys[i] in current) {
      current = current[keys[i]];
    } else {
      return;
    }
  }
  const lastKey = keys[keys.length - 1];
  if (current && typeof current === 'object' && lastKey in current) {
    delete current[lastKey];
  }
}

function parseValue(value) {
  // Try to parse as JSON
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch {
    // Return as string
    return value;
  }
}

export default configCommand;
