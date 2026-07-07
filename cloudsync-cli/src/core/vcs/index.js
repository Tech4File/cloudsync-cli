/**
 * Version Control System - Git-like operations for CloudSync
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync, cpSync } from 'fs';
import { join, relative, basename } from 'path';
import { createHash, randomBytes } from 'crypto';
import archiver from 'archiver';
import { createReadStream, createWriteStream } from 'fs';
import DiffMatchPatch from 'diff-match-patch';

class VersionControl {
  constructor(options = {}) {
    this.options = options;
    this.dmp = new DiffMatchPatch();
    this.historyDir = join(process.cwd(), '.cloudsync', 'history');
    this.stagingDir = join(process.cwd(), '.cloudsync', 'staging');
    this.cacheDir = join(process.cwd(), '.cloudsync', 'cache');
  }

  /**
   * Initialize VCS directories
   */
  init() {
    const dirs = [
      this.historyDir,
      join(this.historyDir, 'commits'),
      join(this.historyDir, 'diffs'),
      this.stagingDir,
      this.cacheDir
    ];

    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });

    return { initialized: true };
  }

  /**
   * Stage files for commit
   */
  stage(files, workspace = process.cwd()) {
    const staged = [];
    const errors = [];

    for (const file of files) {
      const fullPath = join(workspace, file);
      
      if (!existsSync(fullPath)) {
        errors.push({ file, error: 'File not found' });
        continue;
      }

      const stagedPath = join(this.stagingDir, basename(file));
      
      try {
        cpSync(fullPath, stagedPath, { recursive: true });
        staged.push(relative(workspace, file));
      } catch (e) {
        errors.push({ file, error: e.message });
      }
    }

    // Update staging index
    this.updateStagingIndex(staged);

    return { staged, errors, total: staged.length };
  }

  /**
   * Unstage files
   */
  unstage(files) {
    const unstaged = [];

    for (const file of files) {
      const stagedPath = join(this.stagingDir, basename(file));
      
      if (existsSync(stagedPath)) {
        unlinkSync(stagedPath);
        unstaged.push(file);
      }
    }

    // Update staging index
    this.refreshStagingIndex();

    return { unstaged, total: unstaged.length };
  }

  /**
   * Unstage all files
   */
  unstageAll() {
    const files = readdirSync(this.stagingDir).filter(f => !f.startsWith('.'));
    files.forEach(f => unlinkSync(join(this.stagingDir, f)));
    this.refreshStagingIndex();
    return { total: files.length };
  }

  /**
   * Get list of staged files
   */
  getStagedFiles() {
    return readdirSync(this.stagingDir).filter(f => !f.startsWith('.') && f !== 'index.json');
  }

  /**
   * Create a commit from staged files
   */
  commit(message, author = null) {
    const stagedFiles = this.getStagedFiles();
    
    if (stagedFiles.length === 0) {
      throw new Error('Nothing to commit - staging area is empty');
    }

    const commitId = this.generateCommitId();
    const timestamp = new Date().toISOString();

    // Create archive of staged files
    const archivePath = join(this.historyDir, 'commits', `${commitId}.zip`);
    this.createStagedArchive(archivePath);

    // Calculate checksum
    const checksum = this.calculateArchiveChecksum(archivePath);

    // Create commit object
    const commit = {
      id: commitId,
      message,
      timestamp,
      author: author || this.getDefaultAuthor(),
      files: stagedFiles,
      checksum,
      parent: this.getLastCommitId()
    };

    // Save commit metadata
    writeFileSync(
      join(this.historyDir, 'commits', `${commitId}.json`),
      JSON.stringify(commit, null, 2)
    );

    // Update history index
    this.addToHistoryIndex(commit);

    // Clear staging area
    this.unstageAll();

    return commit;
  }

  /**
   * Get commit history
   */
  getHistory(limit = 10, file = null) {
    const indexPath = join(this.historyDir, 'index.json');
    
    if (!existsSync(indexPath)) {
      return [];
    }

    let history = JSON.parse(readFileSync(indexPath, 'utf8'));

    // Filter by file if specified
    if (file) {
      history = history.filter(h => {
        const commitFile = join(this.historyDir, 'commits', `${h.id}.json`);
        if (existsSync(commitFile)) {
          const commit = JSON.parse(readFileSync(commitFile, 'utf8'));
          return commit.files.some(f => f.includes(file));
        }
        return false;
      });
    }

    return history.slice(0, limit);
  }

  /**
   * Get specific commit
   */
  getCommit(commitId) {
    const commitFile = join(this.historyDir, 'commits', `${commitId}.json`);
    
    if (!existsSync(commitFile)) {
      return null;
    }

    return JSON.parse(readFileSync(commitFile, 'utf8'));
  }

  /**
   * Compare two commits
   */
  diff(commitId1, commitId2, file = null) {
    const commit1 = this.getCommit(commitId1);
    const commit2 = this.getCommit(commitId2);

    if (!commit1 || !commit2) {
      throw new Error('One or both commits not found');
    }

    const oldFiles = new Set(commit1.files || []);
    const newFiles = new Set(commit2.files || []);

    const diff = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };

    // Find added files
    for (const f of newFiles) {
      if (!oldFiles.has(f)) {
        diff.added.push(f);
      }
    }

    // Find removed files
    for (const f of oldFiles) {
      if (!newFiles.has(f)) {
        diff.removed.push(f);
      }
    }

    // Find potentially modified files
    for (const f of oldFiles) {
      if (newFiles.has(f)) {
        diff.modified.push(f);
      }
    }

    // Filter by specific file if requested
    if (file) {
      diff.added = diff.added.filter(f => f.includes(file));
      diff.removed = diff.removed.filter(f => f.includes(file));
      diff.modified = diff.modified.filter(f => f.includes(file));
    }

    return {
      from: commitId1,
      to: commitId2,
      stats: {
        added: diff.added.length,
        removed: diff.removed.length,
        modified: diff.modified.length
      },
      ...diff
    };
  }

  /**
   * Rollback to a specific version
   */
  rollback(commitId, file = null) {
    const commit = this.getCommit(commitId);
    
    if (!commit) {
      throw new Error(`Commit ${commitId} not found`);
    }

    const rollbackId = this.generateCommitId('rollback');
    const timestamp = new Date().toISOString();

    // Restore files from archive
    const archivePath = join(this.historyDir, 'commits', `${commitId}.zip`);
    
    if (existsSync(archivePath)) {
      this.extractArchive(archivePath, process.cwd(), file);
    }

    // Create rollback record
    const rollback = {
      id: rollbackId,
      type: 'rollback',
      targetCommit: commitId,
      message: commit.message,
      timestamp,
      files: file ? [file] : commit.files
    };

    // Save rollback record
    writeFileSync(
      join(this.historyDir, 'commits', `${rollbackId}.json`),
      JSON.stringify(rollback, null, 2)
    );

    // Add to history
    this.addToHistoryIndex(rollback);

    return rollback;
  }

  /**
   * Get file content at specific version
   */
  getFileAtVersion(commitId, fileName) {
    const archivePath = join(this.historyDir, 'commits', `${commitId}.zip`);
    
    if (!existsSync(archivePath)) {
      return null;
    }

    // For demo, return that file exists in archive
    const commit = this.getCommit(commitId);
    return commit?.files.includes(basename(fileName)) ? fileName : null;
  }

  // Helper methods
  generateCommitId(prefix = 'v') {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(2).toString('hex');
    return `${prefix}${timestamp}-${random}`;
  }

  updateStagingIndex(files) {
    writeFileSync(
      join(this.stagingDir, 'index.json'),
      JSON.stringify({ files, timestamp: new Date().toISOString() }, null, 2)
    );
  }

  refreshStagingIndex() {
    const files = this.getStagedFiles();
    if (files.length > 0) {
      this.updateStagingIndex(files);
    } else {
      const indexPath = join(this.stagingDir, 'index.json');
      if (existsSync(indexPath)) {
        unlinkSync(indexPath);
      }
    }
  }

  createStagedArchive(outputPath) {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', reject);

      archive.pipe(output);

      const stagedFiles = this.getStagedFiles();
      stagedFiles.forEach(f => {
        archive.file(join(this.stagingDir, f), { name: f });
      });

      archive.finalize();
    });
  }

  calculateArchiveChecksum(archivePath) {
    return createHash('sha256').update(readFileSync(archivePath)).digest('hex');
  }

  getDefaultAuthor() {
    const os = require('os');
    return {
      name: os.userInfo().username,
      hostname: os.hostname()
    };
  }

  getLastCommitId() {
    const history = this.getHistory(1);
    return history.length > 0 ? history[0].id : null;
  }

  addToHistoryIndex(commit) {
    const indexPath = join(this.historyDir, 'index.json');
    let history = [];

    if (existsSync(indexPath)) {
      history = JSON.parse(readFileSync(indexPath, 'utf8'));
    }

    history.unshift({
      id: commit.id,
      timestamp: commit.timestamp,
      message: commit.message
    });

    writeFileSync(indexPath, JSON.stringify(history, null, 2));
  }

  extractArchive(archivePath, targetDir, specificFile = null) {
    // Placeholder for archive extraction
    // In production, would use decompress package
    return { extracted: true, path: targetDir };
  }
}

export default VersionControl;
export { VersionControl };
