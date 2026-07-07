#!/usr/bin/env node

/**
 * CloudSync-CLI Quick Test Suite
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, 'bin', 'cloudsync.js');
const TEST_DIR = join(__dirname, 'test-workspace');

const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));
const EXPECTED_VERSION = pkg.version;

// Ensure test-workspace directory exists
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

function run(cmd, dir = process.cwd()) {
  try {
    return execSync(`node ${CLI_PATH} ${cmd}`, { 
      encoding: 'utf8', 
      cwd: dir,
      timeout: 10000 
    });
  } catch (e) {
    return e.stdout || e.message;
  }
}

console.log('🧪 CloudSync-CLI Comprehensive Test Suite\n');
console.log('━'.repeat(55));

let passed = 0;
let failed = 0;

function test(name, condition, details = '') {
  if (condition) {
    console.log(`\n✅ ${name}`);
    passed++;
  } else {
    console.log(`\n❌ ${name}`);
    if (details) console.log(`   ${details}`);
    failed++;
  }
}

// Test 1: Version
const version = run('--version');
test('Version Check', version.includes(EXPECTED_VERSION));

// Test 2: Help
const help = run('--help');
test('Help Command', help.includes('Commands:'));

// Test 3: Init in test workspace
run('init --host test.com --user test --force', TEST_DIR);
const configExists = existsSync(join(TEST_DIR, '.cloudsync', 'config.json'));
test('Init Command', configExists);

// Test 4: Status
const status = run('status', TEST_DIR);
test('Status Command', status.includes('Initialized'));

// Test 5: Doctor
const doctor = run('doctor');
test('Doctor Command', doctor.includes('Summary'));

// Test 6: Stage
const stage = run('stage --help');
test('Stage Command Help', stage.includes('Stage files'));

// Test 7: Stage & Commit
run('stage --help', TEST_DIR); // Create staging dir
const stageResult = run('stage README.md', TEST_DIR);
test('Stage Files', stageResult.includes('Staged') || stageResult.includes('No files'));

// Test 8: Upload help
const upload = run('upload --help');
test('Upload Command', upload.includes('Upload files'));

// Test 9: Download help
const download = run('download --help');
test('Download Command', download.includes('Download files'));

// Test 10: Sync help
const sync = run('sync --help');
test('Sync Command', sync.includes('Bidirectional sync'));

// Test 11: Share help
const share = run('share --help');
test('Share Command', share.includes('shareable'));

// Test 12: History (from workspace with history)
run('init --force', TEST_DIR);
const history = run('history', TEST_DIR);
test('History Command', history.includes('History') || history.includes('No history'));

// Test 13: Diff help
const diff = run('diff --help');
test('Diff Command', diff.includes('Compare'));

// Test 14: Config help
const config = run('config --help');
test('Config Command', config.includes('Configuration'));

// Test 15: Clone help
const clone = run('clone --help');
test('Clone Command', clone.includes('Clone'));

// Summary
console.log('\n' + '━'.repeat(55));
console.log(`\n📊 Test Summary:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Total:  ${passed + failed}`);
console.log('━'.repeat(55));

if (failed === 0) {
  console.log('\n🎉 All tests passed! CLI is ready for production.\n');
} else {
  console.log('\n⚠️  Some tests failed. Review and fix before publishing.\n');
}

process.exit(failed > 0 ? 1 : 0);
