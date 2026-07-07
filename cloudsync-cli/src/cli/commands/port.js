/**
 * port.js - SSH tunnel/port forwarding management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const portCommand = new Command('port')
  .description('🔌 Create SSH tunnel/port forwarding')
  .argument('<local:remote>', 'Port mapping (e.g., 3000:3000)')
  .option('--host <hostname>', 'Remote host to bind', '0.0.0.0')
  .option('--verbose', 'Show tunnel details', false)
  .option('--background', 'Run tunnel in background', false)
  .option('--profile <name>', 'Config profile to use', 'default')
  .action(async (mapping, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const configPath = join(process.cwd(), '.cloudsync', 'config.json');
    
    if (!existsSync(configPath)) {
      console.log(chalk.red('❌ Not initialized. Run: cloudsync init'));
      return;
    }

    // Parse port mapping
    const [localPort, remotePort] = mapping.split(':').map(p => parseInt(p, 10));
    
    if (isNaN(localPort) || isNaN(remotePort)) {
      console.log(chalk.red('❌ Invalid port mapping. Use format: local:remote (e.g., 3000:3000)'));
      return;
    }

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const profile = config.profiles[options.profile] || config.profiles[config.settings.defaultProfile];
    
    if (!profile) {
      console.log(chalk.red(`❌ Profile '${options.profile}' not found`));
      return;
    }

    console.log(chalk.cyan('\n🔌 CloudSync - SSH Tunnel Manager'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white(`   Local Port:  ${chalk.cyan(localPort)}`));
    console.log(chalk.white(`   Remote Port: ${chalk.cyan(remotePort)}`));
    console.log(chalk.white(`   Bind Host:   ${chalk.cyan(options.host)}`));
    console.log(chalk.gray('━'.repeat(50)));

    if (verbose) {
      console.log(chalk.gray('\n📋 Tunnel Configuration:'));
      console.log(chalk.gray(`   Host: ${profile.host}`));
      console.log(chalk.gray(`   User: ${profile.user}`));
      console.log(chalk.gray(`   Port: ${profile.port}`));
      console.log(chalk.gray(`   Background: ${options.background ? 'Yes' : 'No'}`));
    }

    // Create SSH tunnel
    await createTunnel(profile, localPort, remotePort, options.host, verbose, options.background);
  });

async function createTunnel(profile, localPort, remotePort, bindHost, verbose, background) {
  console.log(chalk.green('\n✅ SSH tunnel configuration ready!'));
  console.log(chalk.cyan('\n🌐 Tunnel Information:'));
  console.log(chalk.white(`   Local:  ${chalk.cyan(`http://localhost:${localPort}`)}`));
  console.log(chalk.white(`   Remote: ${chalk.cyan(`${profile.host}:${remotePort}`)}`));
  console.log(chalk.gray('\n   Forwarding: localhost:' + localPort + ' <-> ' + profile.host + ':' + remotePort));
  
  console.log(chalk.yellow('\n⚠️ SSH tunnel demo mode'));
  console.log(chalk.gray('   Tunnel command that would run:'));
  console.log(chalk.cyan(`   ssh -L ${localPort}:localhost:${remotePort} ${profile.user}@${profile.host} -p ${profile.port || 22}`));
  console.log(chalk.cyan(`   ssh -R ${remotePort}:localhost:${localPort} ${profile.user}@${profile.host} -p ${profile.port || 22}`));
}

export default portCommand;
