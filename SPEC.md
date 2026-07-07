# CloudSync-CLI Specification

## 1. Project Overview

**Project Name:** CloudSync-CLI  
**Type:** Open-source cross-platform CLI tool for secure cloud-to-local synchronization  
**Core Functionality:** A Git-like version control system with encrypted SSH transfers, multiple transport protocols, and peer-to-peer sharing capabilities designed as a superior alternative to restrictive Git workflows.  
**Target Users:** Developers who need to sync configuration files, environment variables, and sensitive data between local machines and cloud environments (Replit, SSH servers) without exposing them in public repositories.

---

## 2. Technical Architecture

### 2.1 Core Stack
- **Runtime:** Node.js 18+ (ES Modules)
- **CLI Framework:** Commander.js for argument parsing
- **SSH/SFTP:** ssh2 library for encrypted tunnels
- **Compression:** archiver (ZIP), lz4 (fast), zstd (high compression)
- **Version Control:** Custom diff-match-patch for delta tracking
- **Sharing:** Local HTTP server with generated session tokens

### 2.2 Transport Methods
1. **SSH-SCP** - Classic encrypted copy (default)
2. **SSH-SFTP** - Full-featured file transfer protocol
3. **RSYNC-DELTA** - Efficient delta synchronization
4. **WEBSOCKET-STREAM** - WebSocket-based real-time streaming
5. **DIRECT-PIPE** - SSH piping for maximum speed
6. **HYBRID-ZIP** - Compressed chunked transfers

### 2.3 Directory Structure
```
cloudsync-cli/
├── src/
│   ├── cli/                 # Commander.js command definitions
│   ├── core/
│   │   ├── transport/       # Multi-protocol transfer engines
│   │   ├── vcs/             # Version control system
│   │   ├── crypto/          # Encryption utilities
│   │   └── sharing/         # P2P sharing module
│   ├── utils/               # Helpers
│   └── index.js
├── bin/
│   └── cloudsync.js         # Entry point
├── config/
│   └── default.config.js
├── package.json
└── README.md
```

---

## 3. Feature Specification

### 3.1 Core Commands

#### `cloudsync init [options]`
- Initialize configuration profile
- Options:
  - `--host <hostname>` - Remote host address
  - `--user <username>` - SSH username
  - `--port <number>` - SSH port (default: 22)
  - `--key <path>` - Path to SSH private key
  - `--protocol <ssh|rsync|sftp|websocket>` - Default transport
  - `--workspace <path>` - Local workspace path
- Creates `.cloudsync/config.json` with encrypted credentials

#### `cloudsync upload [files...] [options]`
- Upload files to remote with version tracking
- Options:
  - `--include <patterns>` - Files to include (comma-separated)
  - `--exclude <patterns>` - Files/folders to exclude
  - `--message <msg>` - Commit message for version control
  - `--all` - Stage and commit all changes
  - `--force` - Overwrite remote without backup
  - `--compress <zip|lz4|zstd>` - Compression method
  - `--chunk-size <MB>` - Chunk size for large files
  - `--verbose` - Detailed transfer progress
  - `--dry-run` - Preview without transferring
- Creates `.cloudsync/history/` with diffs

#### `cloudsync download [files...] [options]`
- Download files from remote with version history
- Options:
  - `--include <patterns>` - Specific files to fetch
  - `--exclude <patterns>` - Skip certain files
  - `--version <id>` - Download specific version
  - `--latest` - Fetch latest version
  - `--verbose` - Show detailed progress
  - `--dry-run` - Preview without downloading

#### `cloudsync sync [options]`
- Bidirectional synchronization with conflict resolution
- Options:
  - `--strategy <local|remote|manual>` - Conflict resolution
  - `--watch` - Continuous file watching
  - `--interval <seconds>` - Sync interval
  - `--verbose` - Detailed sync logs

#### `cloudsync port <local>:<remote> [options]`
- Create SSH tunnel/port forwarding
- Options:
  - `--verbose` - Show tunnel details
  - `--background` - Run tunnel in background

#### `cloudsync share [options]`
- Generate shareable session link for file access
- Options:
  - `--port <number>` - Local server port
  - `--expires <minutes>` - Link expiration time
  - `--password <pwd>` - Optional password protection
  - `--verbose` - Show connection details

#### `cloudsync history [options]`
- View version control history
- Options:
  - `--limit <n>` - Number of entries
  - `--file <path>` - History for specific file
  - `--format <table|json|short>` - Output format

#### `cloudsync diff [versions...] [options]`
- Compare file versions
- Options:
  - `--stat` - Show change statistics
  - `--verbose` - Detailed diff output

#### `cloudsync rollback <version> [options]`
- Revert to previous version
- Options:
  - `--file <path>` - Specific file to rollback
  - `--force` - Skip confirmation

#### `cloudsync status [options]`
- Show current sync status
- Options:
  - `--verbose` - Full details
  - `--json` - JSON output

#### `cloudsync config [key] [value]`
- Manage configuration settings

#### `cloudsync doctor`
- Run diagnostics and connectivity tests

### 3.2 Version Control System

**Staging Area Concept (Git-like):**
- `cloudsync stage <files>` - Add files to staging area
- `cloudsync unstage <files>` - Remove from staging
- `cloudsync staged` - List staged files
- `cloudsync commit <message>` - Commit staged changes

**Storage Structure:**
```
.cloudsync/
├── config.json          # Connection profiles
├── staging/             # Staged files before commit
├── history/             # Version history
│   ├── commits/         # Commit snapshots
│   └── diffs/           # Delta patches
├── cache/               # Local cache
└── logs/                # Operation logs
```

### 3.3 Sharing System

**Session-Based P2P Sharing:**
- Generates unique session tokens
- Creates local HTTP server for file access
- Supports optional password protection
- Real-time connection status monitoring
- Clipboard-ready shareable URLs

**Share Types:**
- `cloudsync share --type file <path>` - Single file
- `cloudsync share --type folder <path>` - Directory
- `cloudsync share --type session` - Interactive session

### 3.4 Transport Engine

**Multi-Protocol Support:**
| Protocol | Speed | Compression | Resume | Best For |
|----------|-------|-------------|--------|----------|
| SSH-SCP | Medium | External | No | Simple transfers |
| SSH-SFTP | Medium | Configurable | Yes | Full features |
| RSYNC-DELTA | Fast | Built-in | Yes | Large syncs |
| WEBSOCKET | Fast | Stream | Yes | Real-time sync |
| DIRECT-PIPE | Fastest | None | No | Raw speed |
| HYBRID-ZIP | Medium | High | No | Archives |

---

## 4. Advantages Over Git

### 4.1 Why CloudSync-CLI > Traditional Git

| Feature | Git | CloudSync-CLI |
|---------|-----|---------------|
| **Sensitive Files** | Requires .gitignore hacks | Built-in secure channels |
| **Large Binaries** | Poor handling | Optimized chunking |
| **Binary Diffs** | Not supported | Delta compression |
| **Transfer Protocol** | HTTPS only | Multi-protocol SSH/WebSocket |
| **Real-time Sync** | Manual push/pull | Optional watch mode |
| **Sharing** | Fork/clone required | P2P session links |
| **Conflict Resolution** | Manual merge | Visual diff + strategies |
| **Environment Configs** | Extra tooling needed | First-class support |
| **Cloud-Native** | Indirect | Direct Replit/cloud integration |

### 4.2 Security Features
- End-to-end SSH encryption
- Memory-only temporary files (no disk writes for sensitive data)
- No third-party tracking
- SHA-256 integrity verification
- Optional password-protected sharing

---

## 5. Global Flags
- `-v, --verbose` - Enable verbose logging
- `-q, --quiet` - Suppress output
- `-c, --config <path>` - Custom config file
- `-h, --help` - Show help
- `--version` - Show version
- `--no-color` - Disable colors

---

## 6. Acceptance Criteria

### 6.1 Core Functionality
- [ ] All commands parse and execute without errors
- [ ] SSH connections establish with proper authentication
- [ ] File upload/download works across all transport methods
- [ ] Version control tracks changes correctly
- [ ] Sharing generates valid accessible links

### 6.2 Performance
- [ ] Large files (>100MB) transfer without memory issues
- [ ] Delta sync reduces bandwidth by >60% on repeated transfers
- [ ] Verbose mode shows detailed progress metrics

### 6.3 Error Handling
- [ ] Invalid credentials show clear error messages
- [ ] Network interruptions trigger retry logic
- [ ] Partial transfers can be resumed

### 6.4 Platform Support
- [ ] Windows: Installer works and registers PATH
- [ ] macOS/Linux: npm global install works
- [ ] All commands accessible from any directory
