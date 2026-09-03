#!/usr/bin/env node
/**
 * test-integration.js - End-to-end share -> fetch integration test.
 *
 * Boots a real `cloudsync share` server on a temp port, probes the
 * /status health contract, runs `cloudsync fetch` against it, and
 * verifies exit codes for error paths. Complements the regression
 * suite in test.js by exercising the real network workflow.
 */
import { spawn } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import http from 'http';

const NODE_BIN = process.execPath;
const WORKSPACE = mkdtempSync(join(tmpdir(), 'cs-int-'));
const SENDER_DIR = join(WORKSPACE, 'sender');
const RECEIVER_DIR = join(WORKSPACE, 'receiver');
const CLI = join(process.cwd(), 'bin', 'cloudsync.js');
mkdirSync(SENDER_DIR, { recursive: true });
mkdirSync(RECEIVER_DIR, { recursive: true });

const COLOR_GREEN = '\x1b[32m', COLOR_RED = '\x1b[31m', COLOR_RESET = '\x1b[0m';
let passed = 0, failed = 0;
function ok(msg) { console.log(`${COLOR_GREEN}   PASS  ${msg}${COLOR_RESET}`); passed++; }
function bad(msg, det = '') { console.log(`${COLOR_RED}   FAIL  ${msg}${COLOR_RESET}`); if (det) console.log(`      ${det}`); failed++; }

function runCli(args, cwd = WORKSPACE, timeout = 20000) {
  return new Promise((resolve) => {
    const proc = spawn(NODE_BIN, [CLI, ...args], { cwd, env: { ...process.env, NODE_ENV: 'test', CI: 'true', FORCE_COLOR: '0' } });
    let stdout = '', stderr = '';
    const t = setTimeout(() => { proc.kill('SIGKILL'); resolve({ code: -1, stdout, stderr: 'timeout' }); }, timeout);
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', (code) => { clearTimeout(t); resolve({ code, stdout, stderr }); });
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ code: res.statusCode, body }));
    });
    req.on('error', e => resolve({ code: -1, body: e.message }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ code: -1, body: 'timeout' }); });
  });
}

(async () => {
  console.log('\n=== Integration Test: Share -> Fetch ===\n');

  // 1. Init sender
  const r1 = await runCli(['init', '--host', '127.0.0.1', '--user', 'sender', '--port', '18099', '--force', '--name', 'sender'], SENDER_DIR);
  if (r1.code === 0) ok('Sender init'); else bad('Sender init', `code=${r1.code}\n${r1.stderr || r1.stdout}`);

  // 2. Create test payload
  const sample = 'integration-test-' + Date.now();
  writeFileSync(join(SENDER_DIR, 'data.txt'), sample);
  writeFileSync(join(SENDER_DIR, 'config.json'), JSON.stringify({ test: true, ts: Date.now() }));
  const sampleHash = createHash('sha256').update(readFileSync(join(SENDER_DIR, 'data.txt'))).digest('hex');
  ok(`Created payload (sha256=${sampleHash.slice(0, 12)}...)`);

  // 3. Start share server in background
  console.log('   ...starting share server on 18099 (password-protected)...');
  const SHARE_PW = 'P@ssw0rd-Int!';
  const shareProc = spawn(NODE_BIN, [CLI, 'share', '.', '--port', '18099', '--host', '127.0.0.1', '--expires', '5', '--type', 'file', '--password', SHARE_PW], {
    cwd: SENDER_DIR,
    env: { ...process.env, NODE_ENV: 'test', CI: 'true', FORCE_COLOR: '0' }
  });
  let shareLog = '';
  shareProc.stdout.on('data', d => shareLog += d.toString());
  shareProc.stderr.on('data', d => shareLog += d.toString());

  await sleep(2500);

  // 4. Probe /status — the session health contract used by fetch
  const probe = await httpGet('http://127.0.0.1:18099/status');
  if (probe.code === 200) {
    let parsed = null;
    try { parsed = JSON.parse(probe.body); } catch (_) { }
    if (parsed && parsed.status === 'active') ok('GET /status returns {status:"active"}');
    else bad('GET /status missing status:"active"', JSON.stringify(parsed));
  } else {
    bad('GET /status failed', `HTTP ${probe.code}: ${probe.body}`);
  }

  // 5. Fetch via CLI (sender -> receiver)
  // Extract share ID from the shareLog (it appears after "Share ID:")
  const idMatch = shareLog.match(/Share ID:\s+([a-f0-9-]+)/);
  const shareId = idMatch ? idMatch[1] : null;
  if (shareId) {
    const fetchRes = await runCli(['fetch', `http://127.0.0.1:18099/share/${shareId}`, '--password', SHARE_PW, '--output', RECEIVER_DIR], RECEIVER_DIR, 30000);
    if (fetchRes.code === 0) ok('cloudsync fetch completes (exit 0)');
    else bad('cloudsync fetch exit code', `code=${fetchRes.code}\n${fetchRes.stderr || fetchRes.stdout}`);

    // Folder shares arrive as <foldername>.zip — but existence is NOT proof.
    // Verify CONTENT: unzip and SHA-256-compare the payload against the source.
    const { readdirSync } = await import('fs');
    const zips = readdirSync(RECEIVER_DIR).filter(f => f.endsWith('.zip'));
    if (zips.length > 0) {
      const z = join(RECEIVER_DIR, zips[0]);
      const size = statSync(z).size;
      if (size > 0) ok(`Downloaded archive exists: ${zips[0]} (${size} bytes)`);
      else bad('Downloaded archive is empty', zips[0]);

      // Content integrity: walk the zip local-file headers. Streaming zips
      // (flags bit 3 / cSize 0) carry the real sizes only in the trailing
      // data descriptor — so scan for the next PK signature to find dataEnd.
      const raw = readFileSync(z);
      let content = null;
      let off = 0;
      while (off < raw.length - 30) {
        if (raw.readUInt32LE(off) !== 0x04034b50) break; // not a local header
        const method = raw.readUInt16LE(off + 8);
        const flags = raw.readUInt16LE(off + 6);
        const cSize = raw.readUInt32LE(off + 18);
        const nLen = raw.readUInt16LE(off + 26);
        const eLen = raw.readUInt16LE(off + 28);
        const name = raw.toString('utf8', off + 30, off + 30 + nLen);
        const dataStart = off + 30 + nLen + eLen;

        let dataEnd;
        if (cSize > 0 && !(flags & 0x0008)) {
          dataEnd = dataStart + cSize; // size known in the local header
        } else {
          // Streaming entry — the compressed data runs until the next
          // PK signature (descriptor 0x08074b50 / central dir 0x02014b50)
          let s = dataStart;
          while (s < raw.length - 3) {
            const b = raw[s];
            if (b === 0x50 && raw[s + 1] === 0x4b &&
                (raw.readUInt16LE(s + 2) === 0x0708 || raw.readUInt16LE(s + 2) === 0x0201 || raw.readUInt16LE(s + 2) === 0x0403)) {
              break;
            }
            s++;
          }
          dataEnd = s;
        }

        if (name === 'data.txt') {
          try {
            if (method === 0) {
              content = raw.subarray(dataStart, dataEnd).toString('utf8');
            } else if (method === 8) {
              const zlib = await import('zlib');
              content = zlib.inflateRawSync(raw.subarray(dataStart, dataEnd)).toString('utf8');
            }
          } catch (e) {
            content = `EXTRACT-ERROR: ${e.message}`;
          }
          break;
        }
        off = dataEnd;
      }
      if (content === sample) ok('Received payload is byte-identical (content verified)');
      else bad('Received payload content mismatch', `expected: ${sample.slice(0, 40)}... got: ${String(content).slice(0, 60)}`);
    } else {
      bad('Downloaded file missing', `no .zip found in ${RECEIVER_DIR}`);
    }

    // 5b. Server must STILL be alive after the download (folder-share crash guard, C2)
    await sleep(300);
    const alive = await httpGet('http://127.0.0.1:18099/status');
    if (alive.code === 200) ok('Share server still alive after download (no crash)');
    else bad('Share server DIED after download', `HTTP ${alive.code}: ${String(alive.body).slice(0, 200)}`);

    // 5c. Wrong password must be rejected with 401 (auth actually enforced)
    const badAuth = await httpGet(`http://127.0.0.1:18099/download/${shareId}?pwd=wrong-password`);
    if (badAuth.code === 401 || badAuth.code === 403) ok('Wrong password rejected with 401/403');
    else bad('Wrong password NOT rejected', `HTTP ${badAuth.code}`);
  } else {
    bad('Could not extract Share ID', shareLog.slice(-500));
  }

  // 6. Exit-code contract: failed init must exit 1
  const failRes = await runCli(['init', '--host', 'not a host!', '--force'], WORKSPACE);
  if (failRes.code === 1) ok('Invalid host argument -> exit code 1');
  else bad('Invalid host did NOT exit 1', `code=${failRes.code}`);

  // 7. Exit-code contract: path traversal rejection
  const traRes = await runCli(['stage', '../../../../etc/passwd'], SENDER_DIR);
  if (traRes.code === 1) ok('Path traversal rejection -> exit code 1');
  else bad('Path traversal NOT rejected', `code=${traRes.code}\n${traRes.stdout}`);

  // Cleanup — kill the share process and wait for the OS to release the
  // port. SIGINT can be ignored on Windows, so we escalate to SIGKILL if
  // the process is still alive after the grace period.
  try { shareProc.kill('SIGINT'); } catch (_) { }
  for (let i = 0; i < 10; i++) {
    await sleep(100);
    if (shareProc.exitCode !== null) break;
    if (i === 4) { try { shareProc.kill('SIGKILL'); } catch (_) { } }
  }
  try { rmSync(WORKSPACE, { recursive: true, force: true }); } catch (_) { }

  console.log('\n=== Summary ===');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
})();