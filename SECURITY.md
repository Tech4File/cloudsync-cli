# 🔒 Security Policy & Threat Defense Model

---

## 🛡️ Supported Versions

We actively maintain and provide security patches for the following versions of CloudSync-CLI:

| Version | Supported | Security Patch Policy |
|:---|:---:|:---|
| **2026.x.x (Latest / Current)** | ✅ Full Support | Critical & High severity patches released within 48 hours |
| **1.x.x (Legacy LTS)** | ✅ Maintenance | Critical security fixes only |
| **< 1.0.0** | ❌ End of Life | Not supported — please upgrade immediately |

---

## 🚨 Reporting a Vulnerability

If you discover a potential security vulnerability within CloudSync-CLI, please follow responsible disclosure practices:

1. **Do NOT create a public GitHub issue** or post details in public forums.
2. Submit your report privately via:
   - **GitHub Private Vulnerability Reporting**: [Open Security Advisory](https://github.com/Tech4File/cloudsync-cli/security/advisories/new)
   - **Security Team Email**: `security@cloudsync.dev`

### 📝 What to Include in Your Report
To help us triage and resolve the issue quickly, please include:
- **Vulnerability Type**: (e.g., Remote Code Execution, Privilege Escalation, Path Traversal, Authentication Bypass)
- **Affected Components**: Exact file paths, functions, or CLI command parameters
- **Environment & Setup**: Operating System, Node.js version, and CLI version (`cloudsync --version`)
- **Step-by-Step Reproduction**: Detailed steps, proof-of-concept (PoC) scripts, or raw request payloads
- **Impact Assessment**: Explanation of how the vulnerability could be exploited and potential impact on users

### ⏱️ Vulnerability Response Timeline
- **Initial Acknowledgment**: Within **48 hours**
- **Severity Assessment & Triaging**: Within **5 business days**
- **Patch Development & Testing**: Prioritized based on CVSS score
- **Public Disclosure**: Coordinated release after the security patch is published on npm and GitHub Releases

---

## 🔒 Security Architecture Overview

CloudSync-CLI is built on a **Zero-Trust, Memory-Only, End-to-End Encrypted** foundation designed to manage sensitive environment variables, cryptographic keys, configurations, and repository snapshots without exposing them to public code hosts, third-party clouds, or untrusted network intermediaries.

---

## 🎯 Threat Model & Attack Defense Matrix

The following matrix documents the attack vectors CloudSync-CLI defends against and the corresponding cryptographic/architectural safeguards:

| Threat Vector | Attack Scenario | CloudSync-CLI Defense Mechanism | Protection Status |
|:---|:---|:---|:---:|
| **Network Packet Sniffing (Wireshark / Shark Spoofs)** | Attacker intercepts network packets on public Wi-Fi, untrusted LAN, or ISP backbones. | **SSH2 End-to-End Encryption** with `aes256-gcm`, `chacha20-poly1305`, and `aes256-ctr` + `hmac-sha2-256`. All payload data is high-entropy binary ciphertext. | ✅ **100% Ciphertext Protected** (Plaintext unreadable) |
| **Man-in-the-Middle (MITM) Impersonation** | Attacker spoofs DNS/ARP to route connections to a rogue server. | **Asymmetric Host Key Verification** (`known_hosts` / ED25519 / RSA 4096-bit). Cryptographic handshake terminates immediately on key mismatch. | ✅ **Connection Terminated** |
| **API / Postman / Request Spoofing** | Attacker scans for open share ports and sends unauthorized curl/Postman download requests. | **Cryptographic SHA-256 Password Header Validation** (`x-share-password` header / `?pwd=` parameter) + expirable random 128-bit UUID session tokens. | ✅ **401 Unauthorized Block** |
| **Denial of Service (DoS / Flooding)** | Attacker sends rapid request bursts to exhaust server sockets or RAM. | **Per-IP Sliding Window Rate Limiter** (`RateLimiter`). Bursts trigger instant `HTTP 429 Too Many Requests` before disk I/O or memory allocation. | ✅ **429 Rate Limited** |
| **Slowloris & Socket Starvation** | Attacker opens connections and transmits byte-by-byte headers to keep sockets open indefinitely. | **Hardened Socket Timeouts**: `headersTimeout = 15000ms`, `server.timeout = 30000ms`, and `maxHeadersCount = 50`. | ✅ **Sockets Dropped in 15s** |
| **Cross-Site Scripting (XSS)** | Attacker attempts to inject malicious `<script>` tags into share UI. | **Zero-Script Content Security Policy**: `Content-Security-Policy: default-src 'self'; style-src 'unsafe-inline'; script-src 'none'`. Browsers reject all script execution. | ✅ **Blocked by CSP** |
| **Clickjacking & UI Redressing** | Attacker embeds the share dashboard in a malicious transparent `<iframe>`. | `X-Frame-Options: DENY` header blocks all frame embedding across all modern browsers. | ✅ **Blocked by Browser** |
| **MIME-Sniffing Exploits** | Attacker uploads files disguised with deceptive MIME types. | `X-Content-Type-Options: nosniff` forces strict MIME adherence. | ✅ **Blocked** |
| **Cache & Proxy Leaks** | Public proxy caches sensitive files or environment variables. | `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` prevents intermediate caching. | ✅ **Zero Cache Footprint** |
| **Directory / Path Traversal** | Attacker requests `../../etc/passwd` or `..\..\Windows\System32`. | `safePath()` boundary resolution confirms requested path remains within workspace root; rejects null bytes (`\0`). | ✅ **Path Boundary Guard** |
| **Prototype Pollution** | Attacker crafts JSON payloads containing `__proto__` or `constructor`. | `safeJsonParse()` and `sanitizeObject()` recursively strip blacklisted object keys from all parsed payloads. | ✅ **Object Sanitized** |

---

## 🔐 Cryptographic Specifications

### 1. Transport Layer Cryptography
- **Asymmetric Key Exchange**: `curve25519-sha256`, `ecdh-sha2-nistp256`, `diffie-hellman-group14-sha256`.
- **Ciphers**: `aes256-gcm@openssh.com`, `chacha20-poly1305@openssh.com`, `aes256-ctr`.
- **Integrity MACs**: `hmac-sha2-256-etm@openssh.com`, `hmac-sha2-512-etm@openssh.com`.

### 2. Version Control & Snapshot Integrity
- **Commit Hashing**: Every commit snapshot zip archive is cryptographically verified via **SHA-256** checksum.
- **POSIX Mode Preservation**: Unix file permissions (`chmod 755`, `644`, etc.) are recorded in metadata and restored on rollback to prevent privilege escalation or broken script executions.

### 3. Memory-Only Processing
- Temporary `.env` and configuration files bypass disk persistence and stream directly through in-memory Buffers to prevent unencrypted traces from lingering in swap or temporary disk sectors.

---

## 🛡️ HTTP Share Server Hardened Headers

Every response served by `cloudsync share` includes the following production headers:

```http
Content-Security-Policy: default-src 'self'; style-src 'unsafe-inline'; script-src 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: no-referrer
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```

---

## 📋 Security Best Practices for Users

### 1. SSH Key Management & Hygiene
```bash
# Generate a strong ED25519 key (recommended) or 4096-bit RSA key
ssh-keygen -t ed25519 -f ~/.ssh/cloudsync_key -C "user@cloudsync"

# Restrict private key permissions
chmod 600 ~/.ssh/cloudsync_key
chmod 700 ~/.ssh
```

### 2. Environment Variables & Credentials
- Never hardcode secrets in configuration files.
- Store passwords in environment variables (`CLOUDSYNC_KEY_PASSWORD`, etc.) or your operating system's credential vault.

### 3. Use `.cloudsyncignore`
- Run `cloudsync ignore --template node` (or `python`, `go`, `docker`, `general`) to ensure local `.env.local` and credential keys are not unintentionally pushed to shared targets.

### 4. Password-Protect Peer Shares
- Always specify a strong password when launching share servers:
  ```bash
  cloudsync share ./data --password "YourSuperSecurePassword" --expires 30
  ```

### 5. Direct Peer Fetching
- Use `cloudsync fetch` to receive payloads securely without opening browser windows on untrusted terminals:
  ```bash
  cloudsync fetch http://192.168.1.5:8095/share/abc1234 --password "YourSuperSecurePassword"
  ```

---

## ⚠️ Known Operational Considerations

### 1. Memory-Only Streaming for Very Large Files
CloudSync-CLI processes sensitive data in-memory to prevent disk leakage. When transferring multi-gigabyte files on memory-constrained systems, ensure sufficient swap space is configured.

### 2. SSH Tunnel Port Binding
When using `cloudsync port`:
- Bind to `127.0.0.1` (localhost) whenever remote LAN access is not required.
- Monitor active tunnels and terminate inactive forwarding sessions.

---

## 🔄 Keeping CloudSync-CLI Updated

Always run the latest version to ensure you have the newest security enhancements and dependency patches:

```bash
# Update via npm
npm install -g cloudsync-cli@latest

# Update via GitHub Packages (GPR)
npm install -g @tech4file/cloudsync-cli@latest --registry=https://npm.pkg.github.com

# Verify installed version
cloudsync --version
```
