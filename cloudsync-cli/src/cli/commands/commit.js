/**
 * commit.js - Commit staged changes with version control
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, createWriteStream } from 'fs';
import { join, basename } from 'path';
import { createHash, randomBytes } from 'crypto';
import archiver from 'archiver';
import { logOperation } from '../../utils/logger.js';
import { fileURLToPath } from 'url';


const commitCommand = new Command('commit')
  .description('💾 Commit staged changes with version tracking')
  .argument('[message]', 'Commit message')
  .option('--amend', 'Amend the last commit', false)
  .option('--no-verify', 'Skip pre-commit hooks', false)
  .option('--verbose', 'Show detailed commit info', false)
  .option('--dry-run', 'Preview without committing', false)
  .action(async (message, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const stagingDir = join(process.cwd(), '.cloudsync', 'staging');
    const historyDir = join(process.cwd(), '.cloudsync', 'history', 'commits');
    const indexFile = join(stagingDir, 'index.json');

    if (!existsSync(stagingDir)) {
      console.log(chalk.red('❌ No staging area. Run: cloudsync init'));
      return;
    }

    const stagedFiles = readdirSync(stagingDir).filter(f => f !== 'index.json');

    if (stagedFiles.length === 0) {
      console.log(chalk.yellow('⚠️ Nothing to commit. Stage some files first:'));
      console.log(chalk.gray('   cloudsync stage <files>'));
      return;
    }

    const commitMessage = message || 'No message provided';
    
    if (!commitMessage) {
      console.log(chalk.yellow('\n⚠️ Commit cancelled - no message provided'));
      return;
    }

    if (verbose) {
      console.log(chalk.gray('\n📋 Commit Details:'));
      console.log(chalk.gray(`   Message: ${commitMessage}`));
      console.log(chalk.gray(`   Files: ${stagedFiles.length}`));
      console.log(chalk.gray(`   Amend: ${options.amend ? 'Yes' : 'No'}`));
      stagedFiles.forEach(f => console.log(chalk.gray(`   + ${f}`)));
    }

    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 Dry run - commit preview:'));
      console.log(chalk.gray(`   Message: "${commitMessage}"`));
      console.log(chalk.gray(`   Files: ${stagedFiles.length}`));
      return;
    }

    // Generate commit ID
    const commitId = generateCommitId();
    const timestamp = new Date().toISOString();

    // Create commit object
    const commit = {
      id: commitId,
      message: commitMessage,
      timestamp,
      author: { name: process.env.USER || 'user' },
      files: stagedFiles,
      checksum: null
    };

    // Create archive of staged files
    const archivePath = join(historyDir, `${commitId}.zip`);
    await createStagedArchive(stagingDir, stagedFiles, archivePath);

    // Save commit metadata
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(join(historyDir, `${commitId}.json`), JSON.stringify(commit, null, 2));

    // Update history index
    const indexPath = join(process.cwd(), '.cloudsync', 'history', 'index.json');
    let history = [];
    if (existsSync(indexPath)) {
      history = JSON.parse(readFileSync(indexPath, 'utf8'));
    }

    if (options.amend && history.length > 0) {
      // Replace last commit
      const lastCommit = history[0];
      const lastCommitFile = join(historyDir, `${lastCommit.id}.json`);
      if (existsSync(lastCommitFile)) {
        unlinkSync(lastCommitFile);
      }
      history.shift();
      console.log(chalk.gray('\n   Amending previous commit...'));
    }

    history.unshift({
      id: commitId,
      timestamp,
      message: commitMessage
    });
    writeFileSync(indexPath, JSON.stringify(history, null, 2));

    // Clear staging area
    stagedFiles.forEach(f => {
      unlinkSync(join(stagingDir, f));
    });
    if (existsSync(indexFile)) {
      unlinkSync(indexFile);
    }

    // Display commit info
    logOperation('commit', `Committed: ${commitMessage}`, { files: stagedFiles, commitId });
    console.log(chalk.green('\n✅ Committed successfully!'));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.cyan(`   Commit ID: ${commitId}`));
    console.log(chalk.white(`   Message: ${commitMessage}`));
    console.log(chalk.gray(`   Files: ${stagedFiles.length}`));
    console.log(chalk.gray(`   Time: ${new Date(timestamp).toLocaleString()}`));
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.cyan('\n   Push with: ') + chalk.white('cloudsync upload'));
  });

function generateCommitId() {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(2).toString('hex');
  return `${timestamp}-${random}`;
}

async function createStagedArchive(stagingDir, files, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);

    files.forEach(f => {
      archive.file(join(stagingDir, f), { name: f });
    });

    archive.finalize();
  });
}

export default commitCommand;
