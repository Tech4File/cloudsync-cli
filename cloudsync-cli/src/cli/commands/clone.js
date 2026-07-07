/**
 * clone.js - Clone a remote workspace
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const cloneCommand = new Command('clone')
  .description('📥 Clone a remote workspace to local')
  .argument('<remote>', 'Remote workspace identifier (user@host:path)')
  .option('--directory <path>', 'Target directory', process.cwd())
  .option('--depth <n>', 'Clone depth (full=0)', (v) => parseInt(v, 10), 0)
  .option('--profile <name>', 'Config profile to use', 'default')
  .option('--verbose', 'Show detailed progress', false)
  .action(async (remote, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    
    // Parse remote identifier
    const parsed = parseRemote(remote);
    
    if (!parsed) {
      console.log(chalk.red('❌ Invalid remote format. Use: user@host:path'));
      return;
    }

    console.log(chalk.cyan('\n📥 CloudSync Clone'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.white(`   Remote:  ${chalk.cyan(remote)}`));
    console.log(chalk.white(`   User:    ${chalk.cyan(parsed.user)}`));
    console.log(chalk.white(`   Host:    ${chalk.cyan(parsed.host)}`));
    console.log(chalk.white(`   Path:    ${chalk.cyan(parsed.path)}`));
    console.log(chalk.gray('━'.repeat(60)));

    // Create target directory
    const targetDir = options.directory;
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    if (verbose) {
      console.log(chalk.gray(`\n   Target: ${targetDir}`));
    }

    // Simulate clone
    console.log(chalk.cyan('\n📦 Cloning workspace...'));
    console.log(chalk.gray('   (This would transfer files via SFTP/SCP in production)'));
    
    // Create local .cloudsync directory
    const cloudsyncDir = join(targetDir, '.cloudsync');
    mkdirSync(cloudsyncDir, { recursive: true });
    mkdirSync(join(cloudsyncDir, 'history', 'commits'), { recursive: true });
    mkdirSync(join(cloudsyncDir, 'history', 'diffs'), { recursive: true });
    mkdirSync(join(cloudsyncDir, 'staging'), { recursive: true });
    mkdirSync(join(cloudsyncDir, 'cache'), { recursive: true });

    // Create config
    const config = {
      profiles: {
        default: {
          host: parsed.host,
          user: parsed.user,
          path: parsed.path,
          port: 22,
          clonedAt: new Date().toISOString()
        }
      },
      settings: {
        compression: 'zip',
        defaultProfile: 'default'
      }
    };

    writeFileSync(
      join(cloudsyncDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    console.log(chalk.green('\n✅ Clone complete!'));
    console.log(chalk.gray(`   Workspace: ${targetDir}`));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.cyan('\n🚀 Next steps:'));
    console.log(chalk.gray(`   cd ${targetDir}`));
    console.log(chalk.gray('   cloudsync status'));
  });

function parseRemote(remote) {
  // Format: user@host:path or host:path
  const match = remote.match(/^(?:([^@]+)@)?([^:]+):(.+)$/);
  
  if (!match) return null;
  
  return {
    user: match[1] || 'root',
    host: match[2],
    path: match[3]
  };
}

export default cloneCommand;
