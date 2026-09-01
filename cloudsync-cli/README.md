# 🔒 CloudSync-CLI

<div align="center">

![CloudSync Banner](https://img.shields.io/badge/CloudSync-CLI-blue?style=for-the-badge)
[![npm version](https://img.shields.io/npm/v/cloudsync-cli.svg?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/cloudsync-cli)
[![npm downloads](https://img.shields.io/npm/dm/cloudsync-cli.svg?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/cloudsync-cli)
[![npm total downloads](https://img.shields.io/npm/dt/cloudsync-cli.svg?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/cloudsync-cli)
[![GitHub package version](https://img.shields.io/github/package-json/v/Tech4File/cloudsync-cli?style=for-the-badge)](https://github.com/Tech4File/cloudsync-cli/packages)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=for-the-badge)](https://nodejs.org/)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/Tech4File/cloudsync-cli/release.yml?style=for-the-badge)](https://github.com/Tech4File/cloudsync-cli/actions)
[![GitHub Downloads](https://img.shields.io/github/downloads/Tech4File/cloudsync-cli/total?style=for-the-badge)](https://github.com/Tech4File/cloudsync-cli/releases)

**An open-source, Git-like version control CLI for secure cloud-to-local synchronization via encrypted SSH tunnels**

*"Your configs, your cloud, your rules - no public repos required."*

</div>

---

## 🚀 Why CloudSync-CLI?

### The Problem with Traditional Git

| Limitation | Git | CloudSync-CLI |
|------------|-----|---------------|
| **Sensitive Data** | Requires `.gitignore` hacks & external tools | Built-in encrypted channels for `.env`, keys, configs |
| **Large Binaries** | Poor handling, bloats repos | Optimized chunking & delta compression |
| **Binary Diffs** | Not supported | Full delta compression with zstd/lz4 |
| **Transfer Protocols** | HTTPS only | SSH, SFTP, RSYNC, WebSocket, Direct Pipe |

| **Real-time Sync** | Manual push/pull cycles | Optional watch mode with instant sync |
| **P2P Sharing** | Requires fork/clone | Session links with optional password protection |
| **Conflict Resolution** | Manual 3-way merge | Visual diff + automated strategies |
| **Cloud-Native** | Indirect integration | Direct SSH, any cloud platform |
| **Memory Safety** | Disk-based temp files | Memory-only streams for sensitive data |
| **Speed** | Compressed HTTPS | Raw SSH piping for maximum throughput |

### Our Solution

CloudSync-CLI brings **Git-like version control** to sensitive configuration files, environment data, and arbitrary payloads with **enterprise-grade security** and **multiple transport options** that Git simply wasn't designed for.

---

## 🌐 Universal Deployment: Where & When to Use CloudSync-CLI

CloudSync-CLI is built for **anywhere-to-anywhere synchronization** across trusted and untrusted environments without credential leakage:

```text
┌─────────────────────────┐       Encrypted Tunnel / P2P       ┌─────────────────────────┐
│   AI Agent Sandboxes    │ ◄────────────────────────────────► │     Local Workstation   │
│ (Docker, VM, WebVM, CI) │      (Password Authenticated)      │ (macOS, Windows, Linux) │
└────────────┬────────────┘                                    └────────────┬────────────┘
             │                                                              │
             │           AES-256-GCM Encrypted Snapshots                    │
             ▼                                                              ▼
┌─────────────────────────┐       Pure SSH2 Multi-Stream       ┌─────────────────────────┐
│  Remote Cloud Servers   │ ◄────────────────────────────────► │ Air-Gapped Infrastruct. │
│ (AWS, GCP, Azure, VPS)  │          (Zero-Tracking)           │   (On-Premises Nodes)   │
└─────────────────────────┘                                    └─────────────────────────┘
```

### 🎯 Primary Use-Case Scenarios

| Environment & Use-Case | Scenario & Threat Model | How CloudSync-CLI Protects You |
|---|---|---|
| 🤖 **Untrusted AI Agent Sandboxes** | Transferring code, logs, and artifacts to/from ephemeral AI agent sandboxes (Docker, VM, E2B, Modal) where you **cannot risk storing permanent SSH private keys or cloud credentials**. | Use ephemeral **`cloudsync share`** and **`cloudsync fetch`** with user-defined session passwords. The sandbox only receives an encrypted, time-limited tunnel with zero exposure of your permanent cloud credentials. |
| ☁️ **Cloud Server & VPS Sync** | Synchronizing `.env`, microservice certs, and database configs between staging and production VPS instances (AWS, GCP, DigitalOcean). | Direct **pure SSH2 encrypted tunnels** with memory-only stream transfers. No sensitive configuration data ever touches third-party public Git repositories. |
| 🛡️ **Air-Gapped & High-Security Nodes** | Maintaining version history on machines with restricted or no internet access. | Native **AES-256-GCM encrypted local history snapshots** with Scrypt key derivation. Staged changes are stored as encrypted blobs on disk requiring `--passphrase` to unpack. |
| ⚡ **CI/CD Build Pipelines & Runners** | Transferring large pre-built binaries or dependency caches between distributed CI runners without vendor lock-in. | Multi-stream parallel concurrency (**`-j, --concurrency`**) with streaming 64KB chunk SHA-256 integrity verification. |
| 👥 **Peer-to-Peer Developer Handoff** | Sharing database dumps, debug logs, or staging configs directly between team members behind NATs or firewalls. | Ephemeral HTTP sharing with rate limiting (60 req/min), CORS protection, security headers, and SHA-256 password authentication. |

---

## ✨ Features

### 🔐 Security First
- **Pure SSH2 Protocols** - No middleman tracking, all traffic between your authorized keypairs
- **Memory-Only Streams** - Temporary files bypass disk writes, protecting sensitive keys
- **SHA-256 Integrity** - Every transfer verified with cryptographic checksums
- **Password Protection** - Optional password for shareable session links

### 🚄 Multiple Transport Methods
| Protocol | Speed | Compression | Resume | Best For |
|----------|-------|-------------|--------|----------|
| `SSH-SCP` | ⚡⚡⚡ | External | ❌ | Simple transfers |
| `SSH-SFTP` | ⚡⚡⚡ | Configurable | ✅ | Full features |
| `RSYNC-DELTA` | ⚡⚡⚡⚡ | Built-in | ✅ | Large syncs |
| `WEBSOCKET` | ⚡⚡⚡⚡ | Stream | ✅ | Real-time sync |
| `DIRECT-PIPE` | ⚡⚡⚡⚡⚡ | None | ❌ | Maximum speed |
| `HYBRID-ZIP` | ⚡⚡⚡ | High | ❌ | Archives |

### 📦 Git-Like Version Control
- **Staging Area** - Stage specific files before committing
- **Commit History** - Full version history with messages
- **Diff Comparison** - Compare any two versions
- **Rollback** - Revert to any previous version instantly
- **Branching Model** - Profile-based configuration management

### 🔗 P2P Sharing
- Generate shareable session links
- Password-protected sessions
- Real-time connection monitoring
- Clipboard-ready URLs
- Configurable expiration

### 🖥️ SSH Tunneling
- Local and remote port forwarding
- Background tunnel mode
- Multi-port configuration
- Verbose tunnel status

---

## 💻 Installation Options

### 1. One-Line Automated Installers (Recommended)

#### 🐧 Linux & 🍏 macOS (curl / bash)
```bash
curl -fsSL https://raw.githubusercontent.com/Tech4File/cloudsync-cli/main/installer/install.sh | bash
```

#### 🪟 Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/Tech4File/cloudsync-cli/main/installer/Install-CloudSync.ps1 | iex
```

### 2. Via npm (Global - npmjs.org)

```bash
npm install -g cloudsync-cli
```

### 3. Via GitHub Packages (GPR)

```bash
npm install -g @tech4file/cloudsync-cli --registry=https://npm.pkg.github.com
```

### 4. Standalone Executable Binaries (Windows / Linux / macOS)

Download pre-compiled single-executable binaries directly from the [GitHub Releases Page](https://github.com/Tech4File/cloudsync-cli/releases):
- 🪟 `cloudsync.exe` / `cloudsync-windows-x64.zip` (Windows x64)
- 🐧 `cloudsync-linux-x64` (Linux x64)
- 🍏 `cloudsync-macos-x64` (macOS Intel & Apple Silicon)

### Verify Installation

```bash
cloudsync --version
```

---

## 📖 Quick Start

### 1. Initialize Configuration

```bash
# Interactive setup
cloudsync init

# Or with all options
cloudsync init \
  --host your-server.com \
  --user myusername \
  --port 22 \
  --protocol ssh \
  --verbose
```

### 2. Stage Files

```bash
# Stage specific files
cloudsync stage .env config.json

# Stage all files
cloudsync stage --all

# Stage by pattern
cloudsync stage --include "*.config.js,*.json"
```

### 3. Commit Changes

```bash
cloudsync commit "Add production environment config"
```

### 4. Upload to Cloud

```bash
# Full upload with compression
cloudsync upload --compress zip --verbose

# Upload with custom protocol
cloudsync upload --protocol rsync --exclude node_modules,.git

# Dry run preview
cloudsync upload --dry-run
```

### 5. Download from Cloud

```bash
# Download latest
cloudsync download --latest

# Download specific version
cloudsync download --version v1234-abcd

# Download specific files
cloudsync download .env --verbose
```

### 6. Bidirectional Sync

```bash
# One-time sync
cloudsync sync

# Watch mode (continuous)
cloudsync sync --watch --interval 30

# With conflict strategy
cloudsync sync --strategy local --verbose
```

---

## 🛠️ Command Reference

### Core Commands

| Command | Description |
|---|---|
| `cloudsync init` | Initialize configuration profile |
| `cloudsync upload [files]` | Upload files to remote with version tracking |
| `cloudsync download [files]` | Download files from remote with version history |
| `cloudsync sync` | Bidirectional synchronization with conflict resolution |
| `cloudsync fetch <target>` | 📥 Receive shared files directly from an active share session |
| `cloudsync port <local:remote>` | Create SSH tunnel / port forwarding |
| `cloudsync share [path]` | Generate shareable session link with optional password |

### Version Control Commands

| Command | Description |
|---|---|
| `cloudsync stage [files]` | Stage files for commit |
| `cloudsync unstage [files]` | Remove from staging area |
| `cloudsync commit [msg]` | Commit staged changes |
| `cloudsync history` | View commit history |
| `cloudsync diff [versions]` | Compare versions |
| `cloudsync rollback <version>` | Revert to previous version |
| `cloudsync status` | Show current repository & staging status |
| `cloudsync log` | View operation logs |

### Utility Commands

| Command | Description |
|---|---|
| `cloudsync ignore [options]` | 🛡️ Generate or manage `.cloudsyncignore` rules |
| `cloudsync config [key] [value]` | Manage configuration profiles and settings |
| `cloudsync doctor` | Run environment diagnostics & connectivity checks |
| `cloudsync clone <remote>` | Clone remote workspace structure |
| `cloudsync help [topic]` | Show help information |

### Global Flags

| Flag | Description |
|---|---|
| `-v, --verbose` | Enable verbose output |
| `-q, --quiet` | Suppress messages |
| `-c, --config <path>` | Custom config file path |
| `--no-color` | Disable colorized terminal output |

---

## 📋 Command Options Reference

### `upload` Options

```bash
cloudsync upload [files...]
  --include <patterns>     # Files to include (comma-separated)
  --exclude <patterns>      # Files to exclude (default: node_modules,.git,dist,build)
  --message <msg>           # Commit message
  --all                     # Upload all changes
  --force                   # Force overwrite
  --compress <method>       # zip|lz4|zstd (default: zip)
  --chunk-size <MB>        # Chunk size (default: 10)
  -j, --concurrency <num>  # Concurrent transfer streams (default: 4)
  --protocol <proto>       # ssh|sftp|rsync|websocket|pipe
  --verbose                # Detailed progress
  --dry-run                # Preview only
  --profile <name>         # Config profile
```

### `download` Options

```bash
cloudsync download [files...]
  --include <patterns>     # Specific files to fetch
  --exclude <patterns>     # Skip certain files
  --version <id>          # Specific version
  --latest                # Fetch latest
  -j, --concurrency <num>  # Concurrent transfer streams (default: 4)
  --verbose               # Detailed progress
  --dry-run               # Preview only
  --profile <name>        # Config profile
  --output <path>         # Output directory
```

### `commit` Options

```bash
cloudsync commit [message]
  --amend                 # Amend the last commit
  -e, --encrypt           # Encrypt snapshot archive on disk with AES-256-GCM
  -p, --passphrase <pwd>  # Passphrase for AES-256-GCM encryption
  --no-verify             # Skip pre-commit hooks
  --verbose               # Show detailed commit metadata
  --dry-run               # Preview without committing
```

### `rollback` Options

```bash
cloudsync rollback <version-id>
  --file <path>           # Specific file to rollback (default: all)
  -p, --passphrase <pwd>  # Passphrase for AES-256-GCM encrypted snapshot
  --force                 # Skip confirmation prompt
  --verbose               # Detailed restoration logs
```

### `sync` Options

```bash
cloudsync sync
  --strategy <type>       # local|remote|manual
  --watch                 # Continuous watching
  --interval <seconds>    # Sync interval (default: 30)
  --verbose               # Detailed logs
  --dry-run               # Preview
  --profile <name>        # Config profile
  --include <patterns>    # Files to sync
  --exclude <patterns>    # Files to skip
```

### `share` Options

```bash
cloudsync share [path]
  --type <type>           # file|folder|session
  --port <number>         # Server port (default: 3000)
  --expires <minutes>     # Expiration (default: 60)
  --password <pwd>         # Password protection
  --verbose               # Show details
  --open                  # Auto-open URL
  --profile <name>        # Config profile
```

### `fetch` Options

```bash
cloudsync fetch <url-or-id>
  --host <hostname>       # Remote host (if target is Share ID) (default: 127.0.0.1)
  --port <number>         # Remote port (if target is Share ID) (default: 3000)
  --password <pwd>         # Password if session is protected
  --output <path>         # Output directory (default: ./)
  --verbose               # Show download progress
```

### `ignore` Options

```bash
cloudsync ignore
  -t, --template <type>   # Preset: node|python|go|docker|general (default: node)
  -s, --show              # Display current .cloudsyncignore rules
  -a, --append            # Append preset to existing .cloudsyncignore
  -f, --force             # Overwrite existing .cloudsyncignore file
```

### `port` Options

```bash
cloudsync port <local:remote>
  --host <hostname>       # Bind host (default: 0.0.0.0)
  --verbose               # Show tunnel details
  --background            # Run in background
  --profile <name>        # Config profile
```

---

## 🔧 Configuration

### Profile Structure

```json
{
  "profiles": {
    "default": {
      "host": "your-server.com",
      "user": "myusername",
      "port": 22,
      "key": "~/.ssh/id_rsa",
      "protocol": "ssh",
      "workspace": "/home/myuser/project",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "production": {
      "host": "prod.example.com",
      "user": "deploy",
      "protocol": "rsync"
    }
  },
  "settings": {
    "compression": "zip",
    "chunkSize": 10,
    "verbose": false,
    "defaultProfile": "default"
  }
}
```

### Config Commands

```bash
# List all config
cloudsync config --list

# Get specific value
cloudsync config profiles.default.host

# Set value
cloudsync config settings.compression zstd

# Use global config
cloudsync config --global settings.verbose true

# Unset value
cloudsync config --unset profiles.production
```

---

## 🔒 Security Architecture

### Transport Security

```
┌─────────────────────────────────────────────────────────┐
│                    CloudSync Security                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Your Local Machine                                      │
│  ┌─────────────────┐                                    │
│  │  Private Key 🔐  │──── Encrypted Tunnel ──────►      │
│  │  (never leaves)  │        SSH2                         │
│  └─────────────────┘              │                     │
│                                    ▼                     │
│  Memory-Only Streams ◄──────────────┤                     │
│  (no disk writes)                   │                     │
│                                     ▼                     │
│  Remote Server (SSH or cloud)         │                     │
│  ┌─────────────────┐       Authenticated & Encrypted    │
│  │  Public Key 🔓  │◄──────────────────────────         │
│  └─────────────────┘                                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key Security Features

1. **Zero-Trust Architecture** - Keys never leave your machine
2. **Memory-Only Processing** - Sensitive data never touches disk
3. **End-to-End Encryption** - SSH2 with strong cipher suites
4. **Integrity Verification** - SHA-256 checksums on all transfers
5. **Session Tokens** - Unique, expirable shareable links
6. **No Third-Party Tracking** - 100% peer-to-peer

---

## 🏗️ Architecture Overview

```
cloudsync-cli/
├── bin/
│   └── cloudsync.js          # CLI entry point
├── src/
│   ├── cli/
│   │   ├── index.js          # Commander.js CLI engine
│   │   └── commands/         # 19 command definitions
│   │       ├── init.js
│   │       ├── upload.js
│   │       ├── download.js
│   │       ├── sync.js
│   │       ├── fetch.js      # CLI-to-CLI share receiver
│   │       ├── ignore.js     # .cloudsyncignore generator
│   │       ├── port.js
│   │       ├── share.js
│   │       ├── stage.js
│   │       ├── unstage.js
│   │       ├── commit.js
│   │       ├── history.js
│   │       ├── diff.js
│   │       ├── rollback.js
│   │       ├── status.js
│   │       ├── config.js
│   │       ├── doctor.js
│   │       ├── clone.js
│   │       └── log.js
│   ├── core/
│   │   ├── transport/        # Multi-protocol transfer engine
│   │   └── vcs/              # Git-like VCS & snapshot engine
│   └── utils/
│       ├── banner.js         # Native ASCII banner
│       ├── update-check.js   # 24h cached NPM update notifier
│       ├── logger.js         # Structured audit logging
│       ├── security.js       # Sanitization & path guards
│       └── helpers.js        # Formatting & utilities
├── eslint.config.js          # ESLint v9/v10 flat configuration
├── package.json
└── README.md
```

---

## 📊 Comparison with Git Workflows

### Traditional Git Workflow (With Sensitive Files)

```bash
# Problem: Sensitive files need special handling
git add .env                    # ❌ Danger! May commit secrets
echo ".env" >> .gitignore      # ✓ But now it's untracked
git add .env.example            # ✓ Manual workaround

# Or use git-crypt (complex setup)
git crypt init                  # Complex
git crypt lock                  # Lock when done

# Environment-specific repos (messy)
git remote add prod git@github.com:myorg/prod-configs.git
```

### CloudSync Workflow (Same Project)

```bash
# Simple and secure
cloudsync init --host your-server.com --user myuser
cloudsync stage .env config.json
cloudsync commit "Update environment config"
cloudsync upload                # Encrypted, versioned, done

# Files stay private, never in Git
```

---

## 🌐 Use Cases

### 1. Cloud Environment Sync

```bash
# Sync local .env to your cloud server
cloudsync upload --include .env,config.json --exclude node_modules

# Pull latest from your cloud server
cloudsync download --latest

# Create persistent tunnel for local dev
cloudsync port 3000:3000 --background
```

### 2. Multi-Environment Configs

```bash
# Development profile
cloudsync init --profile dev --host dev.server.com

# Production profile
cloudsync init --profile prod --host prod.server.com

# Switch and sync
cloudsync upload --profile prod
```

### 3. Team Sharing (Without Git Access)

```bash
# Generate secure share link
cloudsync share --type folder . --expires 120 --password MyPass123

# Share the link with team
🔗 http://localhost:3000/share/abc123
```

### 4. CI/CD Integration

```bash
# In CI pipeline
cloudsync download --version $COMMIT_SHA --dry-run
cloudsync download --version $COMMIT_SHA
```

---

## 🔍 Troubleshooting

### Doctor Command

Run diagnostics to identify issues:

```bash
cloudsync doctor --verbose
```

### Common Issues

| Issue | Solution |
|-------|----------|
| SSH connection fails | Run `cloudsync doctor` to test credentials |
| Permission denied | Check SSH key permissions: `chmod 600 ~/.ssh/id_rsa` |
| No files to upload | Ensure `--include` patterns match your files |
| Config not found | Run `cloudsync init` first |

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Commander.js](https://www.npmjs.com/package/commander) - CLI framework
- [ssh2](https://www.npmjs.com/package/ssh2) - SSH client
- [Archiver](https://www.npmjs.com/package/archiver) - ZIP compression
- [Chalk](https://www.npmjs.com/package/chalk) - Terminal styling

---

<div align="center">

**Made with ❤️ for developers who value security and simplicity**

[![Star on GitHub](https://img.shields.io/github/stars/Tech4File/cloudsync-cli?style=social)](https://github.com/Tech4File/cloudsync-cli)
[![Tweet](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Fgithub.com%2FTech4File%2Fcloudsync-cli)](https://twitter.com/intent/tweet?text=Check%20out%20CloudSync-CLI%20-%20A%20secure%2C%20Git-like%20tool%20for%20syncing%20configs%20to%20cloud%20environments&url=https%3A%2F%2Fgithub.com%2FTech4File%2Fcloudsync-cli)

</div>
