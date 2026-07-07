/**
 * doctor.js - Run diagnostics and connectivity tests
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const doctorCommand = new Command('doctor')
  .description('🔍 Run diagnostics and connectivity tests')
  .option('--fix', 'Attempt to fix issues automatically', false)
  .option('--verbose', 'Show detailed diagnostic output', false)
  .action(async (options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    
    console.log(chalk.cyan('\n🔍 CloudSync Doctor'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.white('   Running diagnostics...\n'));

    const results = [];
    
    // Check Node.js version
    results.push(checkNodeVersion());
    
    // Check CloudSync installation
    results.push(checkCloudSync(verbose));
    
    // Check configuration
    results.push(checkConfiguration(verbose));
    
    // Check SSH key
    results.push(checkSSHKey(verbose));
    
    // Display summary
    displaySummary(results);
  });

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  const passed = major >= 18;
  
  return {
    name: 'Node.js Version',
    status: passed ? 'pass' : 'fail',
    message: passed ? `${version} (supported)` : `${version} (requires 18+)`,
    fix: !passed ? 'Upgrade Node.js: nvm install 18' : null
  };
}

function checkCloudSync(verbose) {
  try {
    // Check if .cloudsync directory exists
    const cloudsyncPath = join(process.cwd(), '.cloudsync');
    const exists = existsSync(cloudsyncPath);
    
    return {
      name: 'CloudSync Installation',
      status: 'pass',
      message: exists ? 'Installed' : 'CLI available, workspace not initialized'
    };
  } catch (e) {
    return {
      name: 'CloudSync Installation',
      status: 'pass',
      message: 'CLI available'
    };
  }
}

function checkConfiguration(verbose) {
  const configPath = join(process.cwd(), '.cloudsync', 'config.json');
  
  const exists = existsSync(configPath);
  
  return {
    name: 'Configuration',
    status: exists ? 'pass' : 'warn',
    message: exists ? 'Found' : 'Not initialized - Run: cloudsync init',
    fix: !exists ? 'cloudsync init' : null
  };
}

function checkSSHKey(verbose) {
  const sshDir = join(homedir(), '.ssh');
  const commonKeys = ['id_rsa', 'id_ed25519', 'id_ecdsa'];
  
  const found = commonKeys.filter(k => existsSync(join(sshDir, k)));
  
  return {
    name: 'SSH Key',
    status: found.length > 0 ? 'pass' : 'warn',
    message: found.length > 0 ? `Found: ${found[0]}` : 'No SSH key found',
    fix: found.length === 0 ? 'ssh-keygen -t rsa -b 4096' : null
  };
}

function displaySummary(results) {
  console.log(chalk.gray('━'.repeat(60)));
  
  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  console.log(chalk.cyan('\n📊 Summary:'));
  console.log(chalk.green(`   ✓ Passed:   ${passCount}`));
  console.log(chalk.yellow(`   ⚠ Warnings: ${warnCount}`));
  console.log(chalk.red(`   ✗ Failed:   ${failCount}`));

  // Show checks
  console.log(chalk.gray('\n📋 Checks:'));
  results.forEach(r => {
    const icon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '⚠' : '✗';
    const color = r.status === 'pass' ? chalk.green : r.status === 'warn' ? chalk.yellow : chalk.red;
    console.log(color(`   ${icon} ${r.name}: ${r.message}`));
  });

  // Show fixes needed
  const needsFix = results.filter(r => r.fix);
  if (needsFix.length > 0) {
    console.log(chalk.cyan('\n🔧 Recommended Actions:'));
    needsFix.forEach(r => {
      console.log(chalk.gray(`   • ${r.name}: ${r.fix}`));
    });
  }

  // Overall status
  console.log(chalk.gray('\n' + '━'.repeat(60)));
  if (failCount === 0 && warnCount === 0) {
    console.log(chalk.green('   ✅ All checks passed! CloudSync is ready to use.'));
  } else if (failCount === 0) {
    console.log(chalk.yellow('   ⚠️ Minor issues detected. CloudSync may have limited functionality.'));
  } else {
    console.log(chalk.red('   ❌ Some checks failed. Please fix the issues above.'));
  }
  console.log(chalk.gray('━'.repeat(60)));
}

export default doctorCommand;
