import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { safeJsonParse, isValidPort, isValidHost } from '../../utils/security.js';
import { failWith, okWith } from '../../utils/exit.js';

const portCommand = new Command('port')
  .description('🔌 Create SSH tunnel/port forwarding')
  .argument('<local:remote>', 'Port mapping (e.g., 3000:3000)')
  .option('--host <hostname>', 'Remote host to bind', '0.0.0.0')
  .option('--verbose', 'Show tunnel details', false)
  .option('--background', 'Run tunnel in background', false)
  .option('--profile <name>', 'Config profile to use', 'default')
  .action(async (mapping, options) => {
    okWith();
    const verbose = options.verbose || process.argv.includes('--verbose');
    const configPath = join(process.cwd(), '.cloudsync', 'config.json');
    
    if (!existsSync(configPath)) {
      console.log(chalk.red('❌ Not initialized. Run: cloudsync init'));
      return;
    }

    // Parse port mapping
    const parts = mapping.split(':');
    if (parts.length !== 2) {
      console.log(chalk.red('❌ Invalid port mapping format. Use: local:remote (e.g., 3000:3000)'));
      return;
    }

    const localPort = parseInt(parts[0], 10);
    const remotePort = parseInt(parts[1], 10);
    
    if (!isValidPort(localPort) || !isValidPort(remotePort)) {
      console.log(chalk.red(`❌ Invalid port numbers: "${parts[0]}:${parts[1]}" (ports must be integers 1-65535)`));
      return;
    }

    if (options.host && !isValidHost(options.host)) {
      console.log(chalk.red(`❌ Invalid bind host: "${options.host}"`));
      return;
    }

    const config = safeJsonParse(readFileSync(configPath, 'utf8'), {});
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
    await createTunnel(profile, localPort, remotePort);
  });

async function createTunnel(profile, localPort, remotePort) {
  // Live tunneling is not implemented yet — fail honestly instead of
  // printing a success banner for a tunnel that was never created.
  const sshPort = profile.port || 22;
  failWith(
    `SSH tunnel is not implemented yet — no tunnel was created for localhost:${localPort} <-> ${profile.host}:${remotePort}. ` +
    'Create it manually with: ' +
    `ssh -L ${localPort}:localhost:${remotePort} ${profile.user}@${profile.host} -p ${sshPort}`
  );
}

export default portCommand;
