/**
 * share.js - P2P file sharing with generated session links
 *
 * Starts a temporary HTTP server that exposes a single file or folder:
 * - GET /status           → JSON session health (consumed by `cloudsync fetch`)
 * - GET /share/<id>       → HTML dashboard page
 * - GET /download/<id>    → file (octet-stream) or folder (streamed ZIP)
 *
 * Security model:
 * - Binds to 127.0.0.1 by default; --host 0.0.0.0 exposes on the LAN.
 * - Optional --password (stored as scrypt + per-session salt, timing-safe compare).
 * - Optional --require-token (session token validated via header or query param).
 * - Rate limiting of 60 req/min per IP with JSON 429 responses.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, writeFileSync, mkdirSync, createReadStream, statSync, createWriteStream, rmSync } from 'fs';
import { join, basename, resolve } from 'path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import http from 'http';
import url from 'url';
import { RateLimiter } from '../../utils/security.js';
import { failWith, okWith } from '../../utils/exit.js';
import { ZipArchive } from 'archiver';

const DEFAULT_BIND_HOST = '127.0.0.1';

// Password hashing: scrypt with per-session random salt, timing-safe compare.
function hashPassword(password, salt) {
  const s = salt || randomBytes(16);
  const derived = scryptSync(String(password), s, 64, { N: 16384, r: 8, p: 1 });
  return { hash: derived.toString('hex'), salt: s.toString('hex') };
}
function verifyPassword(password, storedHashHex, storedSaltHex) {
  if (!storedHashHex || !storedSaltHex) return false;
  const { hash } = hashPassword(password, Buffer.from(storedSaltHex, 'hex'));
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHashHex, 'hex');
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch (_) { return false; }
}

const shareCommand = new Command('share')
  .description('🔗 Generate shareable session links for file access')
  .argument('[path]', 'File or folder to share', '.')
  .option('--type <type>', 'Share type: file|folder|session', /^(file|folder|session)$/i, 'folder')
  .option('--port <number>', 'Local server port', (v) => parseInt(v, 10), 3000)
  .option('--host <addr>', 'Bind host (127.0.0.1 loopback | 0.0.0.0 LAN | custom IP)', DEFAULT_BIND_HOST)
  .option('--expires <minutes>', 'Link expiration time', (v) => parseInt(v, 10), 60)
  .option('--password <pwd>', 'Optional password protection (hashed with scrypt+salt)')
  .option('--require-token', 'Require the session token on every request (extra hardening)', false)
  .option('--verbose', 'Show connection details', false)
  .option('--open', 'Automatically open share URL', false)
  .option('--profile <name>', 'Config profile to use', 'default')
  .action(async (sharePath, options) => {
    okWith();

    const verbose = options.verbose || process.argv.includes('--verbose');
    const expiresMinutes = parseInt(options.expires) || 60;

    if (expiresMinutes < 1 || expiresMinutes > 60 * 24 * 7) {
      failWith(`❌ Invalid --expires: ${expiresMinutes} (must be 1..10080 minutes)`);
      return;
    }
    if (options.port < 1 || options.port > 65535) {
      failWith(`❌ Invalid --port: ${options.port}`);
      return;
    }

    // resolve() handles both relative and absolute inputs correctly
    // (unlike join(), which mangles absolute paths by prefixing cwd)
    const targetPath = resolve(sharePath);

    if (!existsSync(targetPath)) {
      failWith(`❌ Path not found: ${targetPath}`);
      return;
    }

    // Generate session token + id
    const sessionToken = generateSessionToken();
    const shareId = randomUUID().slice(0, 8);

    console.log(chalk.cyan('\n🔗 CloudSync - Secure File Sharing'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white(`   Share ID:   ${chalk.cyan(shareId)}`));
    console.log(chalk.white(`   Type:       ${chalk.cyan(options.type)}`));
    console.log(chalk.white(`   Path:       ${chalk.cyan(targetPath)}`));
    console.log(chalk.white(`   Expires:    ${chalk.cyan(expiresMinutes + ' minutes')}`));
    console.log(chalk.cyan('━'.repeat(50)));

    // Password (hashed + salted)
    let pwHash = null;
    let pwSalt = null;
    if (options.password) {
      const r = hashPassword(options.password);
      pwHash = r.hash;
      pwSalt = r.salt;
    }

    // Session object
    const session = {
      id: shareId,
      token: sessionToken,
      requireToken: Boolean(options.requireToken),
      path: targetPath,
      type: options.type,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresMinutes * 60000).toISOString(),
      passwordHash: pwHash,
      passwordSalt: pwSalt,
      accessCount: 0,
      activeConnections: 0,
      bindHost: options.host || DEFAULT_BIND_HOST
    };

    saveSession(session, verbose);

    console.log(chalk.green('\n✅ Share created successfully!'));
    console.log(chalk.cyan('\n📎 Share Links:'));
    console.log(chalk.white(`   Local:  ${chalk.cyan(`http://localhost:${options.port}/share/${shareId}`)}`));
    if ((options.host || DEFAULT_BIND_HOST) === '0.0.0.0') {
      console.log(chalk.white(`   LAN:    ${chalk.yellow(`http://0.0.0.0:${options.port}/share/${shareId}`)}`));
    } else {
      console.log(chalk.gray(`   (LAN access disabled — using --host 0.0.0.0 to expose)`));
    }
    console.log(chalk.white(`   Token:  ${chalk.cyan(sessionToken)}`));

    if (options.password) {
      console.log(chalk.yellow('\n🔐 Password protected (scrypt + salt)'));
    }

    console.log(chalk.gray(`\n⏰ Expires: ${new Date(session.expiresAt).toLocaleString()}`));

    await startShareServer(session, options, verbose);
  });

function generateSessionToken() {
  return randomBytes(24).toString('base64url');
}

function generateShareUrl(session, port) {
  return `http://localhost:${port}/share/${session.id}`;
}

function saveSession(session, verbose) {
  const sessionsDir = join(process.cwd(), '.cloudsync', 'sessions');
  if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
  }
  const sessionFile = join(sessionsDir, `${session.id}.json`);
  writeFileSync(sessionFile, JSON.stringify(session, null, 2));
  if (verbose) console.log(chalk.gray(`Session saved to: ${sessionFile}`));
}

async function startShareServer(session, options, verbose) {
  const rateLimiter = new RateLimiter(60, 60000); // 60 req/min per IP

  // Debounce session writes — was writing on every request.
  let saveDirty = false;
  let saveTimer = null;
  function scheduleSave() {
    saveDirty = true;
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (saveDirty) {
        saveDirty = false;
        try { saveSession(session, false); } catch (_) { /* ignore */ }
      }
    }, 1000);
  }

  const server = http.createServer((req, res) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Rate limiting
    if (!rateLimiter.isAllowed(clientIp)) {
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': '60'
      });
      res.end(JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Try again later.' }));
      return;
    }

    // Only allow GET and OPTIONS
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
      return;
    }

    // Update counters (debounced persistence)
    session.accessCount++;
    scheduleSave();

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'; script-src 'none'");
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Session health endpoint — `cloudsync fetch` relies on the "status"
    // field being "active" to recognize a live session.
    if (pathname === '/status') {
      const isExpired = new Date() > new Date(session.expiresAt);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: isExpired ? 'expired' : 'active',
        id: session.id,
        type: session.type,
        accessCount: session.accessCount,
        expiresAt: session.expiresAt,
        bindHost: session.bindHost,
        port: options.port
      }));
      return;
    }

    // Token enforcement is opt-in (--require-token) so the default workflow
    // (receiver only needs the share URL) keeps working.
    function checkToken() {
      if (!session.requireToken) return true; // not enforced
      const provided = req.headers['x-share-token'] || parsedUrl.query.token || '';
      if (!provided) return false;
      try {
        const a = Buffer.from(provided);
        const b = Buffer.from(session.token);
        if (a.length !== b.length) return false;
        return timingSafeEqual(a, b);
      } catch (_) { return false; }
    }

    // Password validation helper
    function checkPassword() {
      if (!session.passwordHash) return true; // no password set
      const reqPwd = req.headers['x-share-password'] || parsedUrl.query.pwd || '';
      if (!reqPwd) return false;
      return verifyPassword(reqPwd, session.passwordHash, session.passwordSalt);
    }

    if (pathname.startsWith('/share/')) {
      const shareId = pathname.split('/')[2];
      if (shareId !== session.id) {
        res.writeHead(404);
        res.end('Share not found');
        return;
      }
      if (new Date() > new Date(session.expiresAt)) {
        res.writeHead(410);
        res.end('Share link expired');
        return;
      }
      if (!checkPassword()) {
        res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>🔒 Password Required</h2><p>This share session is password-protected. Provide it via <code>x-share-password</code> header or <code>?pwd=</code> query.</p></body></html>');
        return;
      }
      if (!checkToken()) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Valid session token required (x-share-token header or ?token= query)');
        return;
      }

      const html = generateSharePage(session, verbose);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (pathname.startsWith('/download/')) {
      const shareId = pathname.split('/')[2];
      if (shareId !== session.id) {
        res.writeHead(404);
        res.end('Share not found');
        return;
      }
      if (new Date() > new Date(session.expiresAt)) {
        res.writeHead(410);
        res.end('Share link expired');
        server.close();
        return;
      }
      if (!checkPassword()) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('401 Unauthorized: Valid password required');
        return;
      }
      if (!checkToken()) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('401 Unauthorized: Valid session token required');
        return;
      }

      // Directory shares stream as a ZIP; file shares stream raw bytes.
      const target = session.path;
      const filename = basename(target) || 'shared';

      try {
        if (!existsSync(target)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Shared path no longer exists');
          return;
        }

        const stat = statSync(target);
        if (stat.isDirectory()) {
          // Stream a ZIP of the directory on-the-fly — never crashes the server
          res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${filename}.zip"`
          });
          const archive = new ZipArchive({ zlib: { level: 6 } });
          archive.on('warning', (e) => { if (verbose) console.warn('zip warning:', e.message); });
          archive.on('error', (e) => {
            console.error('Archive error:', e.message);
            try { res.end(); } catch (_) {}
          });
          archive.pipe(res);
          // Exclude dot-directories — sharing "." must never leak the
          // sender's .cloudsync/ internals (sessions, history, password hash)
          archive.directory(target, false, (entry) => {
            const rel = entry.name.replace(/^\.\//, '');
            const parts = rel.split('/');
            const first = parts[0] || '';
            if (first.startsWith('.') && first.length > 1) {
              return false; // drop the entire dot-directory subtree
            }
            return entry;
          });
          archive.finalize().catch((e) => {
            console.error('Finalize error:', e.message);
          });
          return;
        }

        // Single file — stream raw bytes with an error handler so stream
        // failures surface as HTTP 500 rather than killing the server.
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': stat.size
        });
        const stream = createReadStream(target);
        let aborted = false;
        stream.on('error', (err) => {
          aborted = true;
          console.error(`Share stream error: ${err.message}`);
          if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
          try { res.end(`500 Stream error: ${err.message}`); } catch (_) {}
        });
        req.on('close', () => { if (!aborted) try { stream.destroy(); } catch (_) {} });
        stream.pipe(res);
      } catch (e) {
        console.error('Download handler crash (caught):', e.message);
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
        try { res.end(`500 ${e.message}`); } catch (_) {}
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  // Server hardening
  server.timeout = 30000;
  server.maxHeadersCount = 50;
  server.headersTimeout = 15000;

  return new Promise((resolve) => {
    server.on('error', (err) => {
      console.error(chalk.red(`\n❌ Server failed to start: ${err.message}`));
      if (err.code === 'EADDRINUSE') {
        failWith(`Port ${options.port} is already in use. Pick another with --port <n>.`);
      } else {
        failWith(`Share server error: ${err.message}`);
      }
      resolve();
    });

    server.listen(options.port, options.host || DEFAULT_BIND_HOST, () => {
      console.log(chalk.cyan('\n🚀 Sharing server running!'));
      console.log(chalk.gray(`   Bound to: ${options.host || DEFAULT_BIND_HOST}:${options.port}`));

      if (verbose) {
        console.log(chalk.gray('\n📊 Connection Status:'));
        console.log(chalk.gray(`   Access count: ${session.accessCount}`));
        console.log(chalk.gray(`   Session ID: ${session.id}`));
      }

      // Auto-expiry timer
      const ttl = new Date(session.expiresAt) - Date.now();
      if (ttl > 0) {
        setTimeout(() => {
          console.log(chalk.yellow('\n⏰ Share session expired. Server shutting down.'));
          server.close(() => process.exit(0));
        }, ttl).unref();
      }

      console.log(chalk.cyan('\n👀 Press Ctrl+C to stop sharing...\n'));

      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\n🔒 Stopping share server...'));
        server.close(() => process.exit(0));
      });
    });
  });
}

function generateSharePage(session, verbose) {
  const pathName = basename(session.path);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudSync Share - ${session.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 2rem; margin-bottom: 10px; }
    .header p { opacity: 0.8; }
    .content { padding: 30px; }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .info-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
    }
    .info-card .label { color: #666; font-size: 0.85rem; }
    .info-card .value { color: #333; font-size: 1.2rem; font-weight: bold; margin-top: 5px; }
    .path-display {
      background: #1a1a2e;
      color: #00ff88;
      padding: 15px 20px;
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9rem;
      word-break: break-all;
      margin-bottom: 20px;
    }
    .status {
      margin-top: 20px;
      padding: 15px;
      background: #e8f5e9;
      border-radius: 8px;
      color: #2e7d32;
      text-align: center;
    }
    .token-box {
      background: #fff3e0;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .token-box .label { color: #e65100; font-weight: bold; }
    .token-box .token {
      font-family: monospace;
      background: #ffcc80;
      padding: 8px 12px;
      border-radius: 4px;
      margin-top: 8px;
      display: inline-block;
    }
    .download-btn {
      display: inline-block;
      margin-top: 20px;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔒 CloudSync Share</h1>
      <p>Secure, temporary file sharing session</p>
    </div>
    <div class="content">
      <div class="info-grid">
        <div class="info-card">
          <div class="label">Share ID</div>
          <div class="value">${session.id}</div>
        </div>
        <div class="info-card">
          <div class="label">Type</div>
          <div class="value">${session.type}</div>
        </div>
        <div class="info-card">
          <div class="label">Accesses</div>
          <div class="value">${session.accessCount}</div>
        </div>
      </div>

      <div class="path-display">
        📁 ${pathName}
      </div>

      <div class="token-box">
        <div class="label">🔑 Session Token</div>
        <div class="token">${session.token.slice(0, 4)}${'*'.repeat(Math.min(session.token.length - 8, 16))}${session.token.slice(-4)}</div>
        <div style="margin-top:8px;font-size:0.8rem;color:#999">Full token available on the server console only</div>
      </div>

      <a class="download-btn" href="/download/${session.id}">⬇️ Download Files</a>

      <div class="status">
        ✅ Share is active and accepting connections
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default shareCommand;
