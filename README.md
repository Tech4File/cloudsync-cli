# 🔒 CloudSync-CLI

<div align="center">

[![npm version](https://img.shields.io/npm/v/cloudsync-cli.svg?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/cloudsync-cli)
[![npm downloads](https://img.shields.io/npm/dm/cloudsync-cli.svg?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/cloudsync-cli)
[![npm total downloads](https://img.shields.io/npm/dt/cloudsync-cli.svg?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/cloudsync-cli)
[![GitHub Packages](https://img.shields.io/badge/GitHub%20Packages-@tech4file/cloudsync--cli-blue?style=for-the-badge&logo=github)](https://github.com/Tech4File/cloudsync-cli/packages)
[![GitHub release](https://img.shields.io/github/v/release/Tech4File/cloudsync-cli?style=for-the-badge&color=2da44e)](https://github.com/Tech4File/cloudsync-cli/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=for-the-badge)](https://nodejs.org/)
[![GitHub Actions CI](https://img.shields.io/github/actions/workflow/status/Tech4File/cloudsync-cli/ci.yml?style=for-the-badge&branch=main&label=CI)](https://github.com/Tech4File/cloudsync-cli/actions)

**An open-source, Git-like version control CLI for secure cloud-to-local synchronization via encrypted SSH tunnels.**

*"Your configs, your cloud, your rules — no public repos required."*

</div>

---

## 🚀 Quick Installation

### Option 1: One-Line Automated Installers (Recommended)

#### 🐧 Linux & 🍏 macOS (curl / bash)
```bash
curl -fsSL https://raw.githubusercontent.com/Tech4File/cloudsync-cli/main/installer/install.sh | bash
```

#### 🪟 Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/Tech4File/cloudsync-cli/main/installer/Install-CloudSync.ps1 | iex
```

### Option 2: Install via npm (Global CLI)
```bash
npm install -g cloudsync-cli
```

### Option 3: Install via GitHub Packages (GPR)
```bash
npm install -g @tech4file/cloudsync-cli --registry=https://npm.pkg.github.com
```

### Option 4: Download Standalone Binaries (Windows / Linux / macOS)
Download single-executable binaries directly from the latest [GitHub Releases](https://github.com/Tech4File/cloudsync-cli/releases):
- 🪟 `cloudsync.exe` / `cloudsync-windows-x64.zip` (Windows)
- 🐧 `cloudsync-linux-x64` (Linux x64)
- 🍏 `cloudsync-macos-x64` (macOS x64 / ARM64)

---

## 📋 Quick Start

```bash
# 1. Initialize configuration
cloudsync init --host your-server.com --user username --port 22

# 2. Generate .cloudsyncignore file
cloudsync ignore --template node

# 3. Stage files for version control
cloudsync stage .env config.json

# 4. Commit staged changes locally
cloudsync commit "Update database config"

# 5. Securely upload to remote target
cloudsync upload --profile default

# 6. Share and receive files over peer-to-peer sessions
cloudsync share ./data --port 8095 --password mysecret
cloudsync fetch http://192.168.1.5:8095/share/abc1234 --password mysecret

# 7. Check operational health & network connectivity
cloudsync doctor
```

Full documentation & CLI command reference: [cloudsync-cli/README.md](cloudsync-cli/README.md)

---

## 📁 Repository Structure

| Path | Description |
|---|---|
| [`cloudsync-cli/`](cloudsync-cli/) | The npm package directory containing CLI source, commands, transport engine, and VCS modules. |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Continuous Integration matrix testing Node 18, 20, 22 on Ubuntu, Windows, and macOS. |
| [`.github/workflows/release.yml`](.github/workflows/release.yml) | Automated build & publication pipeline — produces standalone binaries, releases to npmjs, publishes to GitHub Packages (GPR), and creates GitHub Releases. |

---

## ⚙️ Automated CI/CD Pipeline

| Pipeline | Trigger | Automated Operations |
|---|---|---|
| **CI Matrix** (`ci.yml`) | Push / PR to `main` | Runs multi-OS test matrix across Node.js 18, 20, and 22. |
| **Release Pipeline** (`release.yml`) | Push to `main` | Runs test suite $\rightarrow$ builds bundles $\rightarrow$ compiles standalone EXEs/binaries $\rightarrow$ publishes to npmjs $\rightarrow$ publishes to GPR $\rightarrow$ generates GitHub Release with SHA-256 checksums. |

---

## 🛡️ Security & Hardening Highlights

- **AES-256-GCM Encrypted Snapshots**: Local history snapshot archives encrypted on disk via Scrypt key derivation with authenticated AES-256-GCM (`cloudsync commit --encrypt --passphrase <secret>`).
- **Streaming 64KB Chunk Integrity**: Stream-based SHA-256 checksum hashing for large file archives without memory spikes.
- **Zero-Dependency Security Core**: Hardened with prototype pollution protection (`safeJsonParse`), path traversal filtering (`safePath`), and SSRF-safe hostname validation.
- **Encrypted SSH Channels**: Native `ssh2` transport layer supporting keypair auth, custom ports, and SCP/SFTP/RSYNC protocols with multi-stream concurrency (`-j, --concurrency`).
- **HTTP Share Server Security**: Built-in HTTP sharing with rate limiting (60 req/min), CORS restriction, password authentication, and security headers (`CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

Security Policy: [SECURITY.md](cloudsync-cli/SECURITY.md) | Contributing Guidelines: [CONTRIBUTING.md](cloudsync-cli/CONTRIBUTING.md)
