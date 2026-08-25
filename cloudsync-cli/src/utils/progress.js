/**
 * progress.js - Native Zero-Dependency Stream Progress Bar for CloudSync-CLI
 * 
 * Features:
 * - Real-time percentage, transfer speed (KB/s, MB/s), and ETA calculation
 * - Uses native process.stdout.write('\r...') terminal control
 * - Automatically disables when non-interactive or in quiet mode
 */

import chalk from 'chalk';
import { formatBytes } from './helpers.js';

export class ProgressBar {
  /**
   * @param {number} totalBytes - Total bytes to transfer
   * @param {string} [title='Transferring'] - Action title
   */
  constructor(totalBytes, title = 'Transferring') {
    this.total = totalBytes || 1;
    this.transferred = 0;
    this.title = title;
    this.startTime = Date.now();
    this.lastRenderTime = 0;
    this.enabled = Boolean(process.stdout.isTTY && !process.env.CI && !process.argv.includes('-q') && !process.argv.includes('--quiet'));
  }

  /**
   * Update transferred bytes and render progress bar
   * @param {number} chunkBytes - Additional bytes transferred
   */
  update(chunkBytes) {
    this.transferred += chunkBytes;
    if (this.transferred > this.total) this.transferred = this.total;

    const now = Date.now();
    // Throttle renders to at most once every 100ms
    if (now - this.lastRenderTime < 100 && this.transferred < this.total) {
      return;
    }
    this.lastRenderTime = now;
    this.render();
  }

  /**
   * Render progress line in terminal
   */
  render() {
    if (!this.enabled) return;

    const percent = Math.min(100, Math.round((this.transferred / this.total) * 100));
    const barWidth = 24;
    const filledWidth = Math.round((percent / 100) * barWidth);
    const emptyWidth = Math.max(0, barWidth - filledWidth);
    const bar = chalk.cyan('█'.repeat(filledWidth)) + chalk.gray('░'.repeat(emptyWidth));

    const elapsedSec = (Date.now() - this.startTime) / 1000;
    const speed = elapsedSec > 0 ? this.transferred / elapsedSec : 0;
    const speedStr = `${formatBytes(speed)}/s`;

    let etaStr = '--s';
    if (speed > 0 && percent < 100) {
      const remainingBytes = this.total - this.transferred;
      const etaSec = Math.ceil(remainingBytes / speed);
      etaStr = etaSec < 60 ? `${etaSec}s` : `${Math.floor(etaSec / 60)}m ${etaSec % 60}s`;
    }

    const currentFormatted = formatBytes(this.transferred);
    const totalFormatted = formatBytes(this.total);

    const line = `   ${chalk.cyan('📦')} ${this.title}: [${bar}] ${chalk.bold.white(percent + '%')} | ${chalk.green(speedStr)} | ${currentFormatted}/${totalFormatted} | ETA: ${chalk.yellow(etaStr)}`;
    process.stdout.write(`\r${line}`);
  }

  /**
   * Complete progress bar and print newline
   */
  finish() {
    if (this.enabled) {
      this.transferred = this.total;
      this.render();
      process.stdout.write('\n');
    }
  }
}
