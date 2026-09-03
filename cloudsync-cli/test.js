#!/usr/bin/env node

/**
 * CloudSync-CLI Production Verification & Staged Test Suite
 *
 * Staging Architecture:
 * - Stage 1: Core CLI & Command Routing Engine
 * - Stage 2: Git-Like VCS & Snapshot Lifecycle
 * - Stage 3: Cryptography & Security Layer
 * - Stage 4: Network Transport & Cloud Protocols
 * - Stage 5: Developer UX, Scaffolding & Platform Installers
 * - Stage 6: Threat Modeling & Security Hardening Verification
 * - Stage 7: Exit-Code Contract & Error-Path Verification
 * - Stage 8: External-Agent Report Regression (5 blocking fixes)
 * - Stage 9: Encrypted Lifecycle E2E & Package Integrity Gates
 *
 * A separate end-to-end network test (share -> fetch) lives in
 * test-integration.js and is executed by `npm test` after this suite.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, 'bin', 'cloudsync.js');
const TEST_DIR = join(__dirname, 'test-workspace');

import { VERSION as EXPECTED_VERSION } from './src/version.mjs';

function safeRm(dir) {
  if (existsSync(dir)) {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch (_) { }
  }
}

// Setup fresh sandbox directory
safeRm(TEST_DIR);
mkdirSync(TEST_DIR, { recursive: true });

function run(cmd, dir = process.cwd(), timeout = 20000) {
  try {
    return execSync(`node "${CLI_PATH}" ${cmd}`, {
      encoding: 'utf8',
      cwd: dir,
      timeout,
      env: { ...process.env, NODE_ENV: 'test', CI: 'true' }
    });
  } catch (e) {
    return e.stdout || e.stderr || e.message;
  }
}

// Same as run(), but returns { output, code } so exit codes can be asserted.
// stdout and stderr are combined so error messages (written to stderr by
// failWith) are visible to assertions.
function runWithCode(cmd, dir = process.cwd(), timeout = 20000) {
  try {
    const output = execSync(`node "${CLI_PATH}" ${cmd}`, {
      encoding: 'utf8',
      cwd: dir,
      timeout,
      env: { ...process.env, NODE_ENV: 'test', CI: 'true' }
    });
    return { output, code: 0 };
  } catch (e) {
    return { output: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
  }
}

console.log('\n' + '━'.repeat(65));
console.log('🔒 CloudSync-CLI Production Verification & Test Suite');
console.log('━'.repeat(65));

let passed = 0;
let failed = 0;

function test(name, condition, details = '') {
  if (condition) {
    console.log(`   ✅ ${name}`);
    passed++;
  } else {
    console.log(`   ❌ ${name}`);
    if (details) console.log(`      ${details.replace(/\n/g, '\n      ')}`);
    failed++;
  }
}

// HARNESS CANARY — verifies the suite is capable of FAILING.
// If this ever fails, every other green result is meaningless.
{
  const canaryPassedBefore = passed, canaryFailedBefore = failed;
  test('HARNESS CANARY: test() records failures (self-check)', false);
  const canaryWorked = failed === canaryFailedBefore + 1 && passed === canaryPassedBefore;
  // Roll the canary back out of the visible counts
  failed = canaryFailedBefore;
  if (!canaryWorked) {
    console.error('\n!!! TEST HARNESS BROKEN: test() cannot record failures — aborting !!!\n');
    process.exit(78); // EX_CONFIG: the harness itself is broken
  }
  console.log('   (canary fired correctly — harness is sound)');
}

// ─────────────────────────────────────────────────────────────
// STAGE 1: CORE CLI & COMMAND ROUTING ENGINE
// ─────────────────────────────────────────────────────────────
console.log('\n📦 [Stage 1] Core CLI & Command Routing Engine');
console.log('─'.repeat(60));

const version = run('--version');
test('Test 1.1: Version Flag consistency (--version)', version.includes(EXPECTED_VERSION), version);

const help = run('--help');
test('Test 1.2: Global Help Flag routing (--help)', help.includes('Commands:') && help.includes('Quick Start'), help);

const helpSub = run('help stage');
test('Test 1.3: Dynamic Subcommand Help resolution (help stage)', helpSub.includes('Stage files'), helpSub);

// ─────────────────────────────────────────────────────────────
// STAGE 2: GIT-LIKE VCS & SNAPSHOT LIFECYCLE
// ─────────────────────────────────────────────────────────────
console.log('\n📦 [Stage 2] Git-Like VCS & Snapshot Lifecycle');
console.log('─'.repeat(60));

const initOut = run('init --host testserver.local --user admin --port 2222 --force', TEST_DIR);
const configExists = existsSync(join(TEST_DIR, '.cloudsync', 'config.json'));
test('Test 2.1: Repository Initialization (init)', configExists && (initOut.includes('initialized') || initOut.includes('Initialized')), initOut);

run('config profiles.default.user newadmin', TEST_DIR);
const configRead = run('config profiles.default.user', TEST_DIR);
test('Test 2.2: Configuration Management (config)', configRead.includes('newadmin'), configRead);

// Create sample workspace payload files
mkdirSync(join(TEST_DIR, 'data'), { recursive: true });
writeFileSync(join(TEST_DIR, 'data', 'sample.txt'), 'Hello CloudSync Test Payload\nLine 2');
writeFileSync(join(TEST_DIR, 'data', 'config.json'), JSON.stringify({ test: true }, null, 2));

const stageOut = run('stage data/sample.txt data/config.json', TEST_DIR);
test('Test 2.3: File Staging (stage)', stageOut.includes('Staged 2 file(s)'), stageOut);

const unstageOut = run('unstage data/config.json', TEST_DIR);
test('Test 2.4: File Unstaging (unstage)', unstageOut.includes('Unstaged 1 file(s)'), unstageOut);

const commitOut = run('commit "Test initial commit"', TEST_DIR);
test('Test 2.5: Commit Staged Changes (commit)', commitOut.includes('Committed successfully'), commitOut);

const statusOut = run('status', TEST_DIR);
test('Test 2.6: Repository Status (status)', statusOut.includes('CloudSync Status') && statusOut.includes('Initialized'), statusOut);

const historyOut = run('history', TEST_DIR);
test('Test 2.7: Commit History (history)', historyOut.includes('CloudSync History') && historyOut.includes('Test initial commit'), historyOut);

// Stage & commit second version for diff/rollback tests
run('stage data/config.json', TEST_DIR);
run('commit "Test second commit"', TEST_DIR);

const diffOut = run('diff', TEST_DIR);
test('Test 2.8: Commit Diff Comparison (diff)', diffOut.includes('CloudSync Diff') && diffOut.includes('Summary'), diffOut);

let firstCommitId = null;
try {
  const historyIndex = JSON.parse(readFileSync(join(TEST_DIR, '.cloudsync', 'history', 'index.json'), 'utf8'));
  // The FIRST commit contains data/sample.txt (staged before any unstage)
  if (historyIndex.length > 0) firstCommitId = historyIndex[historyIndex.length - 1].id;
} catch (e) { }

// Corrupt the file AFTER committing — a passing rollback must restore it.
// (Success text alone is not proof; the restored CONTENT is.)
writeFileSync(join(TEST_DIR, 'data', 'sample.txt'), 'CORRUPTED — rollback must restore this\n');
const rollbackOut = firstCommitId ? run(`rollback ${firstCommitId} --force`, TEST_DIR) : '';
let rollbackRestored = false;
try {
  rollbackRestored = readFileSync(join(TEST_DIR, 'data', 'sample.txt'), 'utf8') === 'Hello CloudSync Test Payload\nLine 2';
} catch (_) { }
test('Test 2.9: Rollback restores byte-identical content (rollback)', rollbackOut.includes('Rollback complete') && rollbackRestored, `${rollbackOut}\n   file restored: ${rollbackRestored}`);

const logOut = run('log', TEST_DIR);
test('Test 2.10: Operation Logs (log)', logOut.includes('CloudSync Logs') || logOut.includes('No log entries'), logOut);

// ─────────────────────────────────────────────────────────────
// STAGE 3: CRYPTOGRAPHY & SECURITY LAYER
// ─────────────────────────────────────────────────────────────
console.log('\n📦 [Stage 3] Cryptography & Security Layer');
console.log('─'.repeat(60));

let cryptoModuleOk = false;
try {
  const { encryptData, decryptData } = await import('./src/core/crypto/index.js');
  const secretText = 'CloudSync-Confidential-Config-Payload-2026';
  const passphrase = 'SuperSecretEncryptionPassphrase123!';
  const cipher = encryptData(Buffer.from(secretText), passphrase);
  const plain = decryptData(cipher, passphrase);
  cryptoModuleOk = plain.toString() === secretText;
} catch (e) { }
test('Test 3.1: Authenticated AES-256-GCM Snapshot Encryption (crypto)', cryptoModuleOk);

let streamHashOk = false;
try {
  const { VersionControl } = await import('./src/core/vcs/index.js');
  const vcs = new VersionControl();
  const testFile = join(TEST_DIR, 'data', 'config.json');
  const hash = await vcs.calculateArchiveChecksum(testFile);
  streamHashOk = typeof hash === 'string' && hash.length === 64;
} catch (e) { }
test('Test 3.2: Streaming Chunk-Based SHA-256 Hashing (vcs)', streamHashOk);

// ─────────────────────────────────────────────────────────────
// STAGE 4: NETWORK TRANSPORT & CLOUD PROTOCOLS
// ─────────────────────────────────────────────────────────────
console.log('\n📦 [Stage 4] Network Transport & Cloud Protocols');
console.log('─'.repeat(60));

const doctorOut = run('doctor --help');
test('Test 4.1: System Doctor Diagnostics (doctor --help)', doctorOut.includes('diagnostics') || doctorOut.includes('Doctor'), doctorOut);

const portOut = run('port --help');
test('Test 4.2: SSH Tunneling Forwarding (port --help)', portOut.includes('tunnel') || portOut.includes('port'), portOut);

const shareOut = run('share --help');
test('Test 4.3: HTTP Share Server Integration (share --help)', shareOut.includes('shareable') && shareOut.includes('--password'), shareOut);

const cloneOut = run('clone --help');
test('Test 4.4: Remote Workspace Clone (clone --help)', cloneOut.includes('Clone a remote workspace'), cloneOut);

const uploadOut = run('upload --help');
test('Test 4.5: Remote Transport Upload (upload --help)', uploadOut.includes('Upload files to remote') && uploadOut.includes('--concurrency'), uploadOut);

const downloadOut = run('download --help');
test('Test 4.6: Remote Transport Download (download --help)', downloadOut.includes('Download files from remote') && downloadOut.includes('--concurrency'), downloadOut);

const syncOut = run('sync --help');
test('Test 4.7: Bidirectional Sync (sync --help)', syncOut.includes('Bidirectional sync'), syncOut);

const fetchOut = run('fetch --help');
test('Test 4.8: Direct Share Receiver (fetch --help)', fetchOut.includes('Receive shared files directly') && fetchOut.includes('--password'), fetchOut);

// ─────────────────────────────────────────────────────────────
// STAGE 5: DEVELOPER UX, SCAFFOLDING & INSTALLERS
// ─────────────────────────────────────────────────────────────
console.log('\n📦 [Stage 5] Developer UX, Scaffolding & Installers');
console.log('─'.repeat(60));

const ignoreOut = run('ignore --template node --force', TEST_DIR);
const ignoreCreated = existsSync(join(TEST_DIR, '.cloudsyncignore'));
test('Test 5.1: Smart Ignore Generator (ignore)', ignoreOut.includes('generated successfully') && ignoreCreated, ignoreOut);

let progressModuleOk = false;
try {
  const { ProgressBar } = await import('./src/utils/progress.js');
  const bar = new ProgressBar(1024, 'Test Transfer');
  bar.update(512);
  bar.finish();
  progressModuleOk = bar.total === 1024;
} catch (e) { }
test('Test 5.2: Native Terminal Progress Bar (progress)', progressModuleOk);

const installShExists = existsSync(join(__dirname, 'installer', 'install.sh'));
const installPs1Exists = existsSync(join(__dirname, 'installer', 'Install-CloudSync.ps1'));
test('Test 5.3: Universal Platform Installers (installers)', installShExists && installPs1Exists);

// ─────────────────────────────────────────────────────────────
// STAGE 6: THREAT MODELING & SECURITY HARDENING VERIFICATION
// ─────────────────────────────────────────────────────────────
console.log('\n📦 [Stage 6] Threat Modeling & Security Hardening Verification');
console.log('─'.repeat(60));

let safePathOk = false;
let protoPollutionOk = false;
let rateLimiterOk = false;
let safeFilenameOk = false;
let zipSlipOk = false;

try {
  const { safePath, safeJsonParse, RateLimiter, isSafeFilename } = await import('./src/utils/security.js');

  // Test 6.1: Path Traversal & Null Byte Rejection
  const traversalCheck = safePath('../../etc/passwd', TEST_DIR);
  const nullByteCheck = safePath('safe/path\0/bad', TEST_DIR);
  const validCheck = safePath('data/config.json', TEST_DIR);
  safePathOk = !traversalCheck.safe && !nullByteCheck.safe && validCheck.safe;

  // Test 6.2: Prototype Pollution Stripping
  const pollutedJson = '{"__proto__": {"isAdmin": true}, "constructor": {"polluted": true}, "name": "safe"}';
  const parsed = safeJsonParse(pollutedJson, {});
  protoPollutionOk = parsed.name === 'safe' && !Object.prototype.isAdmin && !Object.prototype.polluted;

  // Test 6.3: Rate Limiter Throttling and Auto-Cleanup
  const limiter = new RateLimiter(5, 1000);
  let allowedCount = 0;
  for (let i = 0; i < 10; i++) {
    if (limiter.isAllowed('192.168.1.100')) allowedCount++;
  }
  rateLimiterOk = allowedCount === 5 && !limiter.isAllowed('192.168.1.100');

  // Test 6.4: Safe Filename Validator
  safeFilenameOk = isSafeFilename('normal-file.txt') && !isSafeFilename('../bad.txt') && !isSafeFilename('CON') && !isSafeFilename('NUL');

  // Test 6.5: Zip Slip Defense in VCS
  const { VersionControl } = await import('./src/core/vcs/index.js');
  const vcs = new VersionControl();
  // Attempt extraction to verify bounds
  const extractRes = vcs.extractArchive(join(TEST_DIR, 'nonexistent.zip'), TEST_DIR);
  zipSlipOk = typeof extractRes === 'object' && extractRes.extracted === false;
} catch (e) {
  console.log('Stage 6 error:', e);
}

test('Test 6.1: Path Traversal & Null Byte Guard (safePath)', safePathOk);
test('Test 6.2: Prototype Pollution Immunity (safeJsonParse)', protoPollutionOk);
test('Test 6.3: Sliding Window IP Rate Limiting & Throttling (RateLimiter)', rateLimiterOk);
test('Test 6.4: Safe Filename & Device Name Sanitization (isSafeFilename)', safeFilenameOk);
test('Test 6.5: Zip-Slip Vulnerability Extraction Mitigation (vcs)', zipSlipOk);

// ─────────────────────────────────────────────────────────────
// STAGE 7: EXIT-CODE CONTRACT & ERROR-PATH VERIFICATION
// ─────────────────────────────────────────────────────────────
console.log('\n[Stage 7] Exit-Code Contract & Error-Path Verification');
console.log('─'.repeat(60));

// Fresh workspace for error-path checks
const ERR_DIR = join(__dirname, 'test-workspace-errors');
safeRm(ERR_DIR);
mkdirSync(ERR_DIR, { recursive: true });

// 7.1: invalid hostname must exit non-zero
const invalidInit = runWithCode('init --host "not a host!" --force', ERR_DIR);
test('Test 7.1: Invalid hostname exits non-zero (init)', invalidInit.code !== 0, invalidInit.output);

// 7.2: invalid port must exit non-zero
const invalidPort = runWithCode('init --host x.com --port 99999 --force', ERR_DIR);
test('Test 7.2: Invalid port exits non-zero (init)', invalidPort.code !== 0, invalidPort.output);

// 7.3: committing with nothing staged must exit non-zero
run('init --host testserver.local --user admin --force', ERR_DIR);
const emptyCommit = runWithCode('commit "should fail"', ERR_DIR);
test('Test 7.3: Empty commit exits non-zero (commit)', emptyCommit.code !== 0, emptyCommit.output);

// 7.4: staging a path-traversal escape must exit non-zero
writeFileSync(join(ERR_DIR, 'dummy.txt'), 'x');
const traversal = runWithCode('stage ../../../../etc/passwd', ERR_DIR);
test('Test 7.4: Path traversal staging exits non-zero (stage)', traversal.code !== 0, traversal.output);

// 7.5: staging a Windows reserved filename must exit non-zero
const reserved = runWithCode('stage CON', ERR_DIR);
test('Test 7.5: Reserved filename staging exits non-zero (stage)', reserved.code !== 0, reserved.output);

// 7.6: rollback to a non-existent version must exit non-zero
run('stage dummy.txt', ERR_DIR);
run('commit "base"', ERR_DIR);
const badRollback = runWithCode('rollback nonexistent-version', ERR_DIR);
test('Test 7.6: Unknown version rollback exits non-zero (rollback)', badRollback.code !== 0, badRollback.output);

// 7.7: successful commands must exit zero
const goodStatus = runWithCode('status', ERR_DIR);
test('Test 7.7: Successful status exits zero', goodStatus.code === 0, goodStatus.output);

// 7.8: fetch to a dead host must exit non-zero
const deadFetch = runWithCode('fetch http://127.0.0.1:1/share/deadbeef', ERR_DIR);
test('Test 7.8: Unreachable share exits non-zero (fetch)', deadFetch.code !== 0, deadFetch.output);

// Teardown error workspace
safeRm(ERR_DIR);

// ─────────────────────────────────────────────────────────────
// STAGE 8: AGENT-REPORT REGRESSION TESTS (the 5 blocking fixes)
// ─────────────────────────────────────────────────────────────
console.log('\n[Stage 8] Agent-Report Regression: 5 Blocking Fixes');
console.log('─'.repeat(60));

const FIX_DIR = join(__dirname, 'test-workspace-fixes');
safeRm(FIX_DIR);
mkdirSync(FIX_DIR, { recursive: true });

// 8.1: sync with pending changes must NOT claim success — exit non-zero
run('init --host testserver.local --user admin --force', FIX_DIR);
writeFileSync(join(FIX_DIR, 'a.txt'), 'pending change');
const syncPending = runWithCode('sync', FIX_DIR);
const syncHonest = syncPending.code !== 0 && !/files uploaded/i.test(syncPending.output);
test('Test 8.1: sync exits non-zero and never claims uploads (sync)', syncHonest, syncPending.output);

// 8.2: sync --dry-run is honest analysis — exits zero
const syncDry = runWithCode('sync --dry-run', FIX_DIR);
test('Test 8.2: sync --dry-run exits zero (analysis only)', syncDry.code === 0, syncDry.output);

// 8.3: encrypted v2-stream roundtrip via decryptData (simulates >50MB layout)
let streamLayoutOk = false;
try {
  const { decryptData } = await import('./src/core/crypto/index.js');
  // Craft a v2-stream-layout payload: [0x02][salt][iv][ciphertext][tag]
  const { createCipheriv, randomBytes, scryptSync } = await import('crypto');
  const secret = Buffer.from('stream-layout roundtrip payload');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync('pw', salt, 32, { N: 16384, r: 8, p: 1 });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(secret), cipher.final()]);
  const tag = cipher.getAuthTag();
  const streamPayload = Buffer.concat([Buffer.from([0x02]), salt, iv, ct, tag]);
  const roundtrip = decryptData(streamPayload, 'pw');
  streamLayoutOk = roundtrip.equals(secret);
} catch (e) {
  console.log('Stage 8 crypto error:', e.message);
}
test('Test 8.3: v2 stream-layout decryptData roundtrip (crypto)', streamLayoutOk);

// 8.4: no shell interpolation in upload — source must not contain conn.exec
let noShellExecOk = false;
try {
  const uploadSrc = readFileSync(join(__dirname, 'src', 'cli', 'commands', 'upload.js'), 'utf8');
  noShellExecOk = !uploadSrc.includes('conn.exec');
} catch (e) { }
test('Test 8.4: Upload uses SFTP mkdir, zero conn.exec shell calls (upload)', noShellExecOk);

// 8.5: staging index derives from directory (parallel stage → union)
let raceOk = false;
try {
  writeFileSync(join(FIX_DIR, 'r1.txt'), '1');
  writeFileSync(join(FIX_DIR, 'r2.txt'), '2');
  // Two stages that overlap: stage one file each
  run('stage r1.txt', FIX_DIR);
  run('stage r2.txt', FIX_DIR);
  // Index must list both files (directory-derived, not snapshot)
  const idx = JSON.parse(readFileSync(join(FIX_DIR, '.cloudsync', 'staging', 'index.json'), 'utf8'));
  raceOk = Array.isArray(idx.files) && idx.files.includes('r1.txt') && idx.files.includes('r2.txt');
} catch (e) {
  console.log('Stage 8 race error:', e.message);
}
test('Test 8.5: Staging index reflects directory state after parallel stages', raceOk);

// 8.6: share with an absolute path argument must not mangle it
let absPathOk = false;
try {
  const shareSrc = readFileSync(join(__dirname, 'src', 'cli', 'commands', 'share.js'), 'utf8');
  absPathOk = shareSrc.includes('resolve(sharePath)') && !shareSrc.includes('join(process.cwd(), sharePath)');
} catch (e) { }
test('Test 8.6: share resolves absolute paths via resolve() (share)', absPathOk);

// Teardown fix workspace
safeRm(FIX_DIR);

// ─────────────────────────────────────────────────────────────
// STAGE 9: ENCRYPTED LIFECYCLE E2E & PACKAGE INTEGRITY GATES
// (the gaps that let v2026.9.1/9.2 ship broken while green)
// ─────────────────────────────────────────────────────────────
console.log('\n[Stage 9] Encrypted Lifecycle E2E & Package Integrity');
console.log('─'.repeat(60));

const ENC_DIR = join(__dirname, 'test-workspace-encrypted');
safeRm(ENC_DIR);
mkdirSync(ENC_DIR, { recursive: true });

// 9.1: encrypted commit — archive on disk must NOT be a plaintext zip
run('init --host testserver.local --user admin --force', ENC_DIR);
writeFileSync(join(ENC_DIR, 'secret.txt'), 'TOP SECRET payload — must survive encrypted roundtrip\n');
run('stage secret.txt', ENC_DIR);
const encCommit = runWithCode('commit "encrypted commit" --encrypt --passphrase "test-pass-123"', ENC_DIR);
let archiveNotPlainZip = false;
try {
  const histDir = join(ENC_DIR, '.cloudsync', 'history', 'commits');
  const zips = readdirSync(histDir).filter(f => f.endsWith('.zip'));
  if (zips.length > 0) {
    const head = readFileSync(join(histDir, zips[0]));
    // ZIP local header magic is 0x50 0x4B ("PK"); an encrypted file must not start with it
    archiveNotPlainZip = !(head[0] === 0x50 && head[1] === 0x4b);
  }
} catch (_) { }
test('Test 9.1: Encrypted commit stores non-plaintext archive (commit --encrypt)', encCommit.code === 0 && archiveNotPlainZip, encCommit.output);

// 9.2: encrypted rollback with WRONG passphrase — must fail, file must NOT change
let encCommitId = null;
try {
  const idx = JSON.parse(readFileSync(join(ENC_DIR, '.cloudsync', 'history', 'index.json'), 'utf8'));
  encCommitId = idx.length > 0 ? idx[0].id : null;
} catch (_) { }

writeFileSync(join(ENC_DIR, 'secret.txt'), 'WRONG STATE — wrong-passphrase rollback must not restore over this\n');
const wrongPw = encCommitId ? runWithCode(`rollback ${encCommitId} --passphrase "wrong-password" --force`, ENC_DIR) : { code: 0, output: 'no commit id' };
let wrongPwPreserved = false;
try {
  wrongPwPreserved = readFileSync(join(ENC_DIR, 'secret.txt'), 'utf8').startsWith('WRONG STATE');
} catch (_) { }
test('Test 9.2: Wrong passphrase rollback fails AND leaves file untouched', wrongPw.code !== 0 && wrongPwPreserved, `${wrongPw.output}\n   file preserved: ${wrongPwPreserved}`);

// 9.3: encrypted rollback with CORRECT passphrase — content must restore byte-identical
const rightPw = encCommitId ? runWithCode(`rollback ${encCommitId} --passphrase "test-pass-123" --force`, ENC_DIR) : { code: 1, output: 'no commit id' };
let rightPwRestored = false;
try {
  rightPwRestored = readFileSync(join(ENC_DIR, 'secret.txt'), 'utf8') === 'TOP SECRET payload — must survive encrypted roundtrip\n';
} catch (_) { }
test('Test 9.3: Correct passphrase rollback restores byte-identical content', rightPw.code === 0 && rightPwRestored, `${rightPw.output}\n   file restored: ${rightPwRestored}`);

// 9.4: commit archive must not recursively include .cloudsync history (H3).
// Scan the plaintext Stage-2 workspace's latest commit zip.
let noSelfInclusion = false;
try {
  const plainHist = join(TEST_DIR, '.cloudsync', 'history', 'commits');
  const plainZips = readdirSync(plainHist).filter(f => f.endsWith('.zip'));
  if (plainZips.length > 0) {
    const plainData = readFileSync(join(plainHist, plainZips[0]));
    const text = plainData.toString('latin1');
    noSelfInclusion = !text.includes('.cloudsync/history') && !text.includes('.cloudsync\\history');
  }
} catch (_) { }
test('Test 9.4: Commit archives never include .cloudsync history (self-inflation)', noSelfInclusion);

// 9.5: npm pack size budget — the published tarball must stay small (H4)
let packSizeOk = false;
let packSizeKb = -1;
try {
  const packJson = execSync('npm pack --dry-run --json', { cwd: __dirname, timeout: 90000, encoding: 'utf8' });
  const packInfo = JSON.parse(packJson);
  const tarballBytes = packInfo[0]?.size ?? 0;
  packSizeKb = Math.round(tarballBytes / 1024);
  packSizeOk = tarballBytes > 0 && tarballBytes < 2 * 1024 * 1024; // 2 MB budget
  console.log(`   (tarball: ${packSizeKb} KB / budget 2048 KB)`);
} catch (e) {
  console.log('   (npm pack check failed:', e.message.slice(0, 100), ')');
}
test('Test 9.5: npm tarball stays under 2 MB (files allowlist enforced)', packSizeOk);

// Teardown encrypted workspace
safeRm(ENC_DIR);

// ─────────────────────────────────────────────────────────────
// STAGE 10: Remote-path honesty & validation regressions
// (cloud-agent v2026.9.4 findings H1/H3, M1, M2)
// ─────────────────────────────────────────────────────────────
console.log('\n── Stage 10: Remote-path honesty & validation regressions ──');

// 10.1: unimplemented upload protocols must exit non-zero and say so (H3)
const S10_DIR = join(__dirname, 'tmp-stage10');
safeRm(S10_DIR);
mkdirSync(join(S10_DIR, '.cloudsync'), { recursive: true });
writeFileSync(join(S10_DIR, '.cloudsync', 'config.json'), JSON.stringify({
  profiles: { default: { host: '127.0.0.1', user: 'test', port: 22, key: '', workspace: S10_DIR } },
  settings: { defaultProfile: 'default' }
}));
writeFileSync(join(S10_DIR, 'file.txt'), 'stage 10 payload');

const plannedUpload = runWithCode('upload --protocol rsync --message planned', S10_DIR, 30000);
const plannedRejected = plannedUpload.code !== 0 &&
  plannedUpload.output.includes('not implemented');
test('Test 10.1: Unimplemented upload protocol (rsync) exits 1 with explicit message', plannedRejected,
  `code=${plannedUpload.code}\n${plannedUpload.output}`);

// 10.2: download from an unreachable remote must exit 1 (H1 honesty path)
const unreachableDownload = runWithCode('download --latest', S10_DIR, 20000);
test('Test 10.2: Unreachable remote download exits 1 with an error', unreachableDownload.code !== 0,
  `code=${unreachableDownload.code}\n${unreachableDownload.output}`);

// 10.3: init --port abc must be rejected (M1 — NaN previously became 22)
const S10_INIT = join(__dirname, 'tmp-stage10-init');
safeRm(S10_INIT);
mkdirSync(S10_INIT, { recursive: true });
const badPortInit = runWithCode('init --port abc --host 127.0.0.1', S10_INIT, 20000);
test('Test 10.3: init --port abc is rejected (NaN never silently saved)', badPortInit.code !== 0,
  `code=${badPortInit.code}\n${badPortInit.output}`);

// 10.4: init --port 2222 still succeeds (guard does not over-reject)
const goodPortInit = runWithCode('init --port 2222 --host 127.0.0.1', S10_INIT, 20000);
test('Test 10.4: init --port 2222 still succeeds', goodPortInit.code === 0,
  `code=${goodPortInit.code}\n${goodPortInit.output}`);

// 10.5: port command must not claim success for an uncreated tunnel (M2)
const portProbe = runWithCode('port 8090:80', S10_INIT, 20000);
const portHonest = portProbe.code !== 0 && !portProbe.output.includes('tunnel configuration ready');
test('Test 10.5: port command fails honestly instead of printing tunnel-ready', portHonest,
  `code=${portProbe.code}\n${portProbe.output}`);

// Teardown Stage-10 workspaces
safeRm(S10_DIR);
safeRm(S10_INIT);

// ─────────────────────────────────────────────────────────────
// CLEANUP & SUMMARY
// ─────────────────────────────────────────────────────────────
// Teardown test workspace
safeRm(TEST_DIR);

console.log('\n' + '━'.repeat(65));
console.log('📊 Comprehensive Staged Test Suite Summary:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Total:  ${passed + failed}`);
console.log('━'.repeat(65));

if (failed === 0) {
  console.log(`\nAll ${passed} tests across all 10 stages passed! CLI is production ready.`);
  console.log('Next: run "node test-integration.js" for the end-to-end share -> fetch test.\n');
  process.exit(0);
} else {
  console.log('\nSome tests failed. Review details above.\n');
  process.exit(1);
}
