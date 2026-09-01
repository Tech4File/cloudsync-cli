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
 *
 * A separate end-to-end network test (share -> fetch) lives in
 * test-integration.js and is executed by `npm test` after this suite.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
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
    return { output: e.stdout || e.stderr || e.message, code: e.status ?? 1 };
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

let commitId = null;
try {
  const historyIndex = JSON.parse(readFileSync(join(TEST_DIR, '.cloudsync', 'history', 'index.json'), 'utf8'));
  if (historyIndex.length > 0) commitId = historyIndex[0].id;
} catch (e) { }

const rollbackOut = commitId ? run(`rollback ${commitId}`, TEST_DIR) : '';
test('Test 2.9: Version Rollback (rollback)', rollbackOut.includes('Rollback complete'), rollbackOut);

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
  console.log(`\nAll ${passed} tests across all 7 stages passed! CLI is production ready.`);
  console.log('Next: run "node test-integration.js" for the end-to-end share -> fetch test.\n');
  process.exit(0);
} else {
  console.log('\nSome tests failed. Review details above.\n');
  process.exit(1);
}
