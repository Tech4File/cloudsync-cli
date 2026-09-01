/**
 * share.js - P2P sharing with generated session links
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, writeFileSync, mkdirSync, createReadStream } from 'fs';
import { join, basename } from 'path';
import { createHash, randomBytes, randomUUID } from 'crypto';
import http from 'http';
import url from 'url';
import { RateLimiter } from '../../utils/security.js';

const shareCommand = new Command('share')
  .description('🔗 Generate shareable session links for file access')
  .argument('[path]', 'File or folder to share', '.')
  .option('--type <type>', 'Share type: file|folder|session', /^(file|folder|session)$/i, 'folder')
  .option('--port <number>', 'Local server port', (v) => parseInt(v, 10), 3000)
  .option('--expires <minutes>', 'Link expiration time', (v) => parseInt(v, 10), 60)
  .option('--password <pwd>', 'Optional password protection')
  .option('--verbose', 'Show connection details', false)
  .option('--open', 'Automatically open share URL', false)
  .option('--profile <name>', 'Config profile to use', 'default')
  .action(async (sharePath, options) => {
    const verbose = options.verbose || process.argv.includes('--verbose');
    const expiresMinutes = parseInt(options.expires) || 60;
    
    // Resolve path
    const targetPath = join(process.cwd(), sharePath);
    
    if (!existsSync(targetPath)) {
      console.log(chalk.red(`❌ Path not found: ${targetPath}`));
      return;
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const shareId = randomUUID().slice(0, 8);
    
    console.log(chalk.cyan('\n🔗 CloudSync - Secure File Sharing'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white(`   Share ID:   ${chalk.cyan(shareId)}`));
    console.log(chalk.white(`   Type:       ${chalk.cyan(options.type)}`));
    console.log(chalk.white(`   Path:       ${chalk.cyan(targetPath)}`));
    console.log(chalk.white(`   Expires:    ${chalk.cyan(expiresMinutes + ' minutes')}`));
    console.log(chalk.cyan('━'.repeat(50)));

    // Store session info
    const session = {
      id: shareId,
      token: sessionToken,
      path: targetPath,
      type: options.type,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresMinutes * 60000).toISOString(),
      password: options.password ? createHash('sha256').update(options.password).digest('hex') : null,
      accessCount: 0,
      activeConnections: 0
    };

    // Save session
    saveSession(session, verbose);

    // Generate share URL
    const shareUrl = generateShareUrl(session, options.port);
    
    console.log(chalk.green('\n✅ Share created successfully!'));
    console.log(chalk.cyan('\n📎 Share Links:'));
    console.log(chalk.white(`   Local:  ${chalk.cyan(`http://localhost:${options.port}/share/${shareId}`)}`));
    console.log(chalk.white(`   LAN:    ${chalk.cyan(`http://0.0.0.0:${options.port}/share/${shareId}`)}`));
    console.log(chalk.white(`   Token:  ${chalk.cyan(sessionToken)}`));

    if (options.password) {
      console.log(chalk.yellow('\n🔐 Password protected'));
    }

    console.log(chalk.gray(`\n⏰ Expires: ${new Date(session.expiresAt).toLocaleString()}`));

    // Start sharing server
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

  const server = http.createServer((req, res) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Rate limiting
    if (!rateLimiter.isAllowed(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'text/plain', 'Retry-After': '60' });
      res.end('Too many requests. Try again later.');
      return;
    }

    // Only allow GET and OPTIONS
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
      return;
    }

    // Update connection count
    session.accessCount++;
    saveSession(session, verbose);

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

    if (pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: session.id,
        accessCount: session.accessCount,
        expiresAt: session.expiresAt
      }));
      return;
    }

    if (pathname.startsWith('/share/')) {
      const shareId = pathname.split('/')[2];
      
      if (shareId !== session.id) {
        res.writeHead(404);
        res.end('Share not found');
        return;
      }

      // Check expiration
      if (new Date() > new Date(session.expiresAt)) {
        res.writeHead(410);
        res.end('Share link expired');
        server.close();
        return;
      }

      // Check password if session is protected
      if (session.password) {
        const reqPwd = req.headers['x-share-password'] || parsedUrl.query.pwd;
        const hashedReq = reqPwd ? createHash('sha256').update(String(reqPwd)).digest('hex') : null;
        if (!hashedReq || hashedReq !== session.password) {
          res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>\uD83D\uDD12 Password Required</h2><p>This share session is password-protected. Add <code>?pwd=YOUR_PASSWORD</code> to the URL.</p></body></html>');
          return;
        }
      }

      // Serve share page
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

      // Check expiration
      if (new Date() > new Date(session.expiresAt)) {
        res.writeHead(410);
        res.end('Share link expired');
        server.close();
        return;
      }

      // Check password if session is protected
      if (session.password) {
        const reqPwd = req.headers['x-share-password'] || parsedUrl.query.pwd;
        const hashedReq = reqPwd ? createHash('sha256').update(String(reqPwd)).digest('hex') : null;
        if (!hashedReq || hashedReq !== session.password) {
          res.writeHead(401, { 'Content-Type': 'text/plain' });
          res.end('401 Unauthorized: Valid password required');
          return;
        }
      }

      // Serve payload
      const filename = basename(session.path);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`
      });

      if (existsSync(session.path)) {
        createReadStream(session.path).pipe(res);
      } else {
        res.end('File data');
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  // Server hardening
  server.timeout = 30000; // 30s request timeout
  server.maxHeadersCount = 50;
  server.headersTimeout = 15000;

  return new Promise((resolve) => {
    server.listen(options.port, () => {
      console.log(chalk.cyan('\n\uD83D\uDE80 Sharing server running!'));
      
      if (verbose) {
        console.log(chalk.gray('\n\uD83D\uDCCA Connection Status:'));
        console.log(chalk.gray(`   Access count: ${session.accessCount}`));
        console.log(chalk.gray(`   Session ID: ${session.id}`));
      }

      // Fix #9: Auto-expiry timer — shut down server when session expires
      const ttl = new Date(session.expiresAt) - Date.now();
      if (ttl > 0) {
        setTimeout(() => {
          console.log(chalk.yellow('\n\u23F0 Share session expired. Server shutting down.'));
          server.close();
          process.exit(0);
        }, ttl);
      }

      console.log(chalk.cyan('\n\uD83D\uDC40 Press Ctrl+C to stop sharing...\n'));

      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\n\uD83D\uDD12 Stopping share server...'));
        server.close();
        process.exit(0);
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
      
      <div class="status">
        ✅ Share is active and accepting connections
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default shareCommand;
