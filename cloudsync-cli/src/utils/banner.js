/**
 * banner.js - Native Zero-Dependency ASCII Banner Generator for CloudSync-CLI
 */

import chalk from 'chalk';

const ASCII_BANNER = `
  ██████╗██╗      ██████╗ ██╗   ██╗██████╗ ███████╗██╗   ██╗███╗   ██╗ ██████╗
 ██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝
 ██║     ██║     ██║   ██║██║   ██║██║  ██║███████╗ ╚████╔╝ ██╔██╗ ██║██║     
 ██║     ██║     ██║   ██║██║   ██║██║  ██║╚════██║  ╚██╔╝  ██║╚██╗██║██║     
 ╚██████╗███████╗╚██████╔╝╚██████╔╝██████╔╝███████║   ██║   ██║ ╚████║╚██████╗
  ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝
`;

/**
 * Display the CloudSync CLI brand banner
 * @param {string} version - Current package version
 */
export function showBanner(version = '') {
  console.log(chalk.cyan(ASCII_BANNER));
  console.log(chalk.gray('━'.repeat(74)));
  const versionStr = version ? chalk.cyan(` v${version}`) : '';
  console.log(chalk.white(`  🔒 CloudSync-CLI${versionStr} • Secure • Fast • Git-like Version Control`));
  console.log(chalk.gray('━'.repeat(74)));
  console.log();
}
