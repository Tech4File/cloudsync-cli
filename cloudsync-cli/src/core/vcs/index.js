/**
 * Version Control System - Git-like operations for CloudSync
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync, cpSync, createWriteStream, createReadStream } from 'fs';
import { join, relative, basename } from 'path';
import { createHash, randomBytes } from 'crypto';
import { ZipArchive } from 'archiver';
import os from 'os';
import DiffMatchPatch from 'diff-match-patch';
import { inflateRawSync } from 'zlib';
import { safeJsonParse } from '../../utils/security.js';

class VersionControl {
  constructor(options = {}) {
    this.options = options;
    this.dmp = new DiffMatchPatch();
    this.historyDir = join(process.cwd(), '.cloudsync', 'history');
    this.stagingDir = join(process.cwd(), '.cloudsync', 'staging');
    this.cacheDir = join(process.cwd(), '.cloudsync', 'cache');
  }

  init() {
    const dirs = [
      this.historyDir,
      join(this.historyDir, 'commits'),
      join(this.historyDir, 'diffs'),
      this.stagingDir,
      this.cacheDir
    ];
    dirs.forEach(dir => {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    });
    return { initialized: true };
  }

  stage(files, workspace = process.cwd()) {
    const staged = [], errors = [];
    for (const file of files) {
      const fullPath = join(workspace, file);
      if (!existsSync(fullPath)) { errors.push({ file, error: 'File not found' }); continue; }
      const safeName = file.replace(/[\\/]/g, '__');
      const stagedPath = join(this.stagingDir, safeName);
      try { cpSync(fullPath, stagedPath, { recursive: true }); staged.push(relative(workspace, file)); }
      catch (e) { errors.push({ file, error: e.message }); }
    }
    this.updateStagingIndex(staged);
    return { staged, errors, total: staged.length };
  }

  unstage(files) {
    const unstaged = [];
    for (const file of files) {
      const stagedPath = join(this.stagingDir, basename(file));
      if (existsSync(stagedPath)) { unlinkSync(stagedPath); unstaged.push(file); }
    }
    this.refreshStagingIndex();
    return { unstaged, total: unstaged.length };
  }

  unstageAll() {
    const files = readdirSync(this.stagingDir).filter(f => !f.startsWith('.'));
    files.forEach(f => unlinkSync(join(this.stagingDir, f)));
    this.refreshStagingIndex();
    return { total: files.length };
  }

  getStagedFiles() {
    return readdirSync(this.stagingDir).filter(f => !f.startsWith('.') && f !== 'index.json');
  }

  commit(message, author = null) {
    const stagedFiles = this.getStagedFiles();
    if (stagedFiles.length === 0) throw new Error('Nothing to commit - staging area is empty');
    const commitId = this.generateCommitId();
    const timestamp = new Date().toISOString();
    const archivePath = join(this.historyDir, 'commits', commitId + '.zip');
    this.createStagedArchive(archivePath);
    const checksum = this.calculateArchiveChecksum(archivePath);
    const commit = {
      id: commitId, message, timestamp,
      author: author || this.getDefaultAuthor(),
      files: stagedFiles, checksum,
      parent: this.getLastCommitId()
    };
    writeFileSync(join(this.historyDir, 'commits', commitId + '.json'), JSON.stringify(commit, null, 2));
    this.addToHistoryIndex(commit);
    this.unstageAll();
    return commit;
  }

  getHistory(limit = 10, file = null) {
    const indexPath = join(this.historyDir, 'index.json');
    if (!existsSync(indexPath)) return [];
    let history = safeJsonParse(readFileSync(indexPath, 'utf8'), []);
    if (file) {
      history = history.filter(h => {
        const commitFile = join(this.historyDir, 'commits', h.id + '.json');
        if (existsSync(commitFile)) {
          const commit = safeJsonParse(readFileSync(commitFile, 'utf8'), {});
          return commit.files.some(f => f.includes(file));
        }
        return false;
      });
    }
    return history.slice(0, limit);
  }

  getCommit(commitId) {
    const commitFile = join(this.historyDir, 'commits', commitId + '.json');
    if (!existsSync(commitFile)) return null;
    return safeJsonParse(readFileSync(commitFile, 'utf8'), null);
  }

  diff(commitId1, commitId2, file = null) {
    const commit1 = this.getCommit(commitId1);
    const commit2 = this.getCommit(commitId2);
    if (!commit1 || !commit2) throw new Error('One or both commits not found');
    const oldFiles = new Set(commit1.files || []);
    const newFiles = new Set(commit2.files || []);
    const diff = { added: [], removed: [], modified: [], unchanged: [] };
    for (const f of newFiles) { if (!oldFiles.has(f)) diff.added.push(f); }
    for (const f of oldFiles) { if (!newFiles.has(f)) diff.removed.push(f); }
    for (const f of oldFiles) { if (newFiles.has(f)) diff.modified.push(f); }
    if (file) {
      diff.added = diff.added.filter(f => f.includes(file));
      diff.removed = diff.removed.filter(f => f.includes(file));
      diff.modified = diff.modified.filter(f => f.includes(file));
    }
    return { from: commitId1, to: commitId2, stats: { added: diff.added.length, removed: diff.removed.length, modified: diff.modified.length }, ...diff };
  }

  rollback(commitId, file = null) {
    const commit = this.getCommit(commitId);
    if (!commit) throw new Error('Commit ' + commitId + ' not found');
    const rollbackId = this.generateCommitId('rollback');
    const timestamp = new Date().toISOString();
    const archivePath = join(this.historyDir, 'commits', commitId + '.zip');
    if (existsSync(archivePath)) this.extractArchive(archivePath, process.cwd(), file);
    const rollback = { id: rollbackId, type: 'rollback', targetCommit: commitId, message: commit.message, timestamp, files: file ? [file] : commit.files };
    writeFileSync(join(this.historyDir, 'commits', rollbackId + '.json'), JSON.stringify(rollback, null, 2));
    this.addToHistoryIndex(rollback);
    return rollback;
  }

  getFileAtVersion(commitId, fileName) {
    const archivePath = join(this.historyDir, 'commits', commitId + '.zip');
    if (!existsSync(archivePath)) return null;
    const commit = this.getCommit(commitId);
    return commit && commit.files.includes(basename(fileName)) ? fileName : null;
  }

  generateCommitId(prefix = 'v') {
    return prefix + Date.now().toString(36) + '-' + randomBytes(2).toString('hex');
  }

  updateStagingIndex(files) {
    writeFileSync(join(this.stagingDir, 'index.json'), JSON.stringify({ files, timestamp: new Date().toISOString() }, null, 2));
  }

  refreshStagingIndex() {
    const files = this.getStagedFiles();
    if (files.length > 0) this.updateStagingIndex(files);
    else { const p = join(this.stagingDir, 'index.json'); if (existsSync(p)) unlinkSync(p); }
  }

  createStagedArchive(outputPath) {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      output.on('close', () => resolve());
      archive.on('error', reject);
      archive.pipe(output);
      this.getStagedFiles().forEach(f => archive.file(join(this.stagingDir, f), { name: f }));
      archive.finalize();
    });
  }

  calculateArchiveChecksum(archivePath) {
    return createHash('sha256').update(readFileSync(archivePath)).digest('hex');
  }

  getDefaultAuthor() {
    return { name: os.userInfo().username, hostname: os.hostname() };
  }

  getLastCommitId() {
    const history = this.getHistory(1);
    return history.length > 0 ? history[0].id : null;
  }

  addToHistoryIndex(commit) {
    const indexPath = join(this.historyDir, 'index.json');
    let history = existsSync(indexPath) ? safeJsonParse(readFileSync(indexPath, 'utf8'), []) : [];
    history.unshift({ id: commit.id, timestamp: commit.timestamp, message: commit.message });
    writeFileSync(indexPath, JSON.stringify(history, null, 2));
  }

  extractArchive(archivePath, targetDir, specificFile = null) {
    try {
      const data = readFileSync(archivePath);
      const extracted = [];

      let offset = 0;
      while (offset < data.length - 4) {
        const sig = data.readUInt32LE(offset);
        if (sig !== 0x04034b50) break; // Not a local file header

        const flags = data.readUInt16LE(offset + 6);
        const compressionMethod = data.readUInt16LE(offset + 8);
        let compressedSize = data.readUInt32LE(offset + 18);
        const fileNameLen = data.readUInt16LE(offset + 26);
        const extraFieldLen = data.readUInt16LE(offset + 28);
        const fileName = data.toString('utf8', offset + 30, offset + 30 + fileNameLen);
        const dataStart = offset + 30 + fileNameLen + extraFieldLen;

        const hasDataDescriptor = (flags & 0x0008) !== 0 || compressedSize === 0;
        let dataEnd = dataStart + compressedSize;
        let descriptorLen = 0;

        if (hasDataDescriptor) {
          let search = dataStart;
          while (search < data.length - 4) {
            const s = data.readUInt32LE(search);
            if (s === 0x08074b50) { // Data descriptor signature
              dataEnd = search;
              descriptorLen = 16;
              break;
            } else if (s === 0x04034b50 || s === 0x02014b50) {
              dataEnd = search;
              descriptorLen = 0;
              break;
            }
            search++;
          }
          if (search >= data.length - 4 && dataEnd === dataStart) {
            dataEnd = data.length;
          }
        }

        const compressedData = data.subarray(dataStart, dataEnd);

        // Skip directories and filter by specificFile if provided
        if (!fileName.endsWith('/')) {
          if (!specificFile || fileName === specificFile || basename(fileName) === specificFile) {
            let fileData;
            if (compressionMethod === 0) {
              fileData = compressedData;
            } else if (compressionMethod === 8) {
              fileData = inflateRawSync(compressedData);
            } else {
              offset = dataEnd + descriptorLen;
              continue;
            }

            const outPath = join(targetDir, fileName);
            const outDir = join(targetDir, fileName.split('/').slice(0, -1).join('/'));
            if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });
            writeFileSync(outPath, fileData);
            extracted.push(fileName);
          }
        }

        offset = dataEnd + descriptorLen;
      }

      return { extracted: true, path: targetDir, files: extracted, count: extracted.length };
    } catch (e) {
      return { extracted: false, error: e.message, path: targetDir };
    }
  }
}

export default VersionControl;
export { VersionControl };
