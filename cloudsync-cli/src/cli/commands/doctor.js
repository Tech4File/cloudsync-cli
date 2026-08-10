/**
 * doctor.js - Run diagnostics and connectivity tests
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, writeFileSync, unlinkSync, statfsSync } from 'fs';
import { join } from 'path';
import { homedir, platform, freemem, totalmem } from 'os';
import { execSync } from 'child_process';
import { safeJsonParse } from '../../utils/security.js';

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

    // Check write permissions
    results.push(checkWritePermissions(verbose));

    // Check disk space
    results.push(checkDiskSpace(verbose));

    // Check system memory
    results.push(checkMemory(verbose));

    // Check system tools
    results.push(checkSystemTools(verbose));

    // Check SSH connectivity (if configured)
    results.push(await checkSSHConnectivity(verbose));
    
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
      message: exists ? 'Installed and initialized' : 'CLI available, workspace not initialized'
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
  
  if (!existsSync(configPath)) {
    return {
      name: 'Configuration',
      status: 'warn',
      message: 'Not initialized - Run: cloudsync init',
      fix: 'cloudsync init'
    };
  }

  try {
    const config = safeJsonParse(readFileSync(configPath, 'utf8'), {});
    const profileCount = Object.keys(config.profiles || {}).length;
    return {
      name: 'Configuration',
      status: 'pass',
      message: `Found (${profileCount} profile${profileCount !== 1 ? 's' : ''})`
    };
  } catch (e) {
    return {
      name: 'Configuration',
      status: 'fail',
      message: 'Config file is corrupted',
      fix: 'cloudsync init --force'
    };
  }
}

function checkSSHKey(verbose) {
  const sshDir = join(homedir(), '.ssh');
  const commonKeys = ['id_ed25519', 'id_rsa', 'id_ecdsa'];
  
  const found = commonKeys.filter(k => existsSync(join(sshDir, k)));
  
  return {
    name: 'SSH Key',
    status: found.length > 0 ? 'pass' : 'warn',
    message: found.length > 0 ? `Found: ${found.join(', ')}` : 'No SSH key found',
    fix: found.length === 0 ? 'ssh-keygen -t ed25519 -C "your@email.com"' : null
  };
}

function checkWritePermissions(verbose) {
  const testDir = join(process.cwd(), '.cloudsync');
  const testFile = join(testDir, '.doctor-test');
  
  try {
    writeFileSync(testFile, 'test');
    unlinkSync(testFile);
    return {
      name: 'Write Permissions',
      status: 'pass',
      message: '.cloudsync directory is writable'
    };
  } catch (e) {
    return {
      name: 'Write Permissions',
      status: existsSync(testDir) ? 'fail' : 'warn',
      message: existsSync(testDir) ? 'Cannot write to .cloudsync directory' : 'No .cloudsync directory yet',
      fix: existsSync(testDir) ? `chmod -R 755 ${testDir}` : 'cloudsync init'
    };
  }
}

function checkDiskSpace(verbose) {
  try {
    // Use statfsSync if available (Node 18.15+)
    if (typeof statfsSync === 'function') {
      const stats = statfsSync(process.cwd());
      const freeGB = (stats.bavail * stats.bsize) / (1024 ** 3);
      const totalGB = (stats.blocks * stats.bsize) / (1024 ** 3);
      const usedPercent = ((1 - stats.bavail / stats.blocks) * 100).toFixed(1);
      
      return {
        name: 'Disk Space',
        status: freeGB > 1 ? 'pass' : freeGB > 0.1 ? 'warn' : 'fail',
        message: `${freeGB.toFixed(1)} GB free of ${totalGB.toFixed(1)} GB (${usedPercent}% used)`,
        fix: freeGB <= 0.1 ? 'Free up disk space' : null
      };
    }
    return {
      name: 'Disk Space',
      status: 'pass',
      message: 'Check skipped (requires Node 18.15+)'
    };
  } catch (e) {
    return {
      name: 'Disk Space',
      status: 'pass',
      message: 'Unable to check (non-critical)'
    };
  }
}

function checkMemory(verbose) {
  const freeGB = (freemem() / (1024 ** 3)).toFixed(2);
  const totalGB = (totalmem() / (1024 ** 3)).toFixed(2);
  return {
    name: 'System Memory',
    status: freemem() > 256 * 1024 * 1024 ? 'pass' : 'warn',
    message: `${freeGB} GB free of ${totalGB} GB`
  };
}

function checkSystemTools(verbose) {
  const tools = [];
  const missing = [];

  for (const tool of ['ssh', 'scp', 'rsync']) {
    try {
      execSync(`${platform() === 'win32' ? 'where' : 'which'} ${tool}`, { stdio: 'pipe' });
      tools.push(tool);
    } catch {
      missing.push(tool);
    }
  }

  if (missing.length === 0) {
    return {
      name: 'System Tools',
      status: 'pass',
      message: `Found: ${tools.join(', ')}`
    };
  }

  return {
    name: 'System Tools',
    status: tools.includes('ssh') ? 'warn' : 'warn',
    message: `Found: ${tools.join(', ') || 'none'}${missing.length > 0 ? ` | Missing: ${missing.join(', ')}` : ''}`,
    fix: missing.includes('ssh') ? 'Install OpenSSH client' : null
  };
}

async function checkSSHConnectivity(verbose) {
  const configPath = join(process.cwd(), '.cloudsync', 'config.json');
  if (!existsSync(configPath)) {
    return {
      name: 'SSH Connectivity',
      status: 'warn',
      message: 'No config - skipping connection test'
    };
  }

  try {
    const config = safeJsonParse(readFileSync(configPath, 'utf8'), {});
    const defaultProfile = config.settings?.defaultProfile || 'default';
    const profile = config.profiles?.[defaultProfile];

    if (!profile || !profile.host || profile.host === 'your-server.com') {
      return {
        name: 'SSH Connectivity',
        status: 'warn',
        message: 'Default host not configured - skipping test'
      };
    }

    // Quick DNS/reachability check using SSH timeout
    try {
      const { Client: SSHClient } = await import('ssh2');
      return new Promise((resolve) => {
        const conn = new SSHClient();
        const timeout = setTimeout(() => {
          conn.end();
          resolve({
            name: 'SSH Connectivity',
            status: 'warn',
            message: `${profile.host} - connection timed out (5s)`
          });
        }, 5000);

        conn.on('ready', () => {
          clearTimeout(timeout);
          conn.end();
          resolve({
            name: 'SSH Connectivity',
            status: 'pass',
            message: `${profile.host} - connected successfully`
          });
        });

        conn.on('error', (err) => {
          clearTimeout(timeout);
          resolve({
            name: 'SSH Connectivity',
            status: 'warn',
            message: `${profile.host} - ${err.message}`
          });
        });

        const sshDir = join(homedir(), '.ssh');
        const keyPath = profile.key || join(sshDir, 'id_ed25519');
        const privateKey = existsSync(keyPath) ? readFileSync(keyPath) : undefined;

        conn.connect({
          host: profile.host,
          port: profile.port || 22,
          username: profile.user || 'root',
          privateKey,
          readyTimeout: 5000
        });
      });
    } catch (e) {
      return {
        name: 'SSH Connectivity',
        status: 'warn',
        message: `${profile.host} - test failed: ${e.message}`
      };
    }
  } catch (e) {
    return {
      name: 'SSH Connectivity',
      status: 'warn',
      message: 'Config parse error'
    };
  }
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

