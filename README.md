# 🔒 CloudSync-CLI

<div align="center">

[![GitHub license](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![npm version](https://img.shields.io/npm/v/cloudsync-cli.svg?style=for-the-badge)](https://www.npmjs.com/package/cloudsync-cli)
[![GitHub Actions CI](https://img.shields.io/github/actions/workflow/status/Tech4File/cloudsync-cli/ci.yml?style=for-the-badge&branch=main)](https://github.com/Tech4File/cloudsync-cli/actions)

**Secure, Git-like version control CLI for synchronizing files between local and remote environments over encrypted SSH tunnels.**

</div>

---

## What is CloudSync-CLI?

CloudSync-CLI is a cross-platform command-line tool that brings Git-like version control (stage, commit, history, diff, rollback) to configuration files and sensitive data — syncing them directly between machines over encrypted tunnels without ever touching a public repository.

**10 transport protocols.** **Git-like VCS.** **Zero public exposure.**

---

## Repository Structure

| Path | Description |
|---|---|
| `cloudsync-cli/` | The npm package — CLI source, commands, transport engine, VCS |
| `.github/workflows/ci.yml` | CI pipeline — tests on Ubuntu (18/20/22) + Windows + macOS |
| `.github/workflows/release.yml` | Auto-release on tag push — builds Win/Mac/Linux binaries + npm + GPR |

---

## Quick Start

```bash
npm install -g cloudsync-cli
cloudsync init --host your-server.com --user username
cloudsync stage .env config.json
cloudsync commit "Update config"
cloudsync upload --include .env --exclude node_modules
cloudsync --help
```

Full docs: [cloudsync-cli/README.md](cloudsync-cli/README.md)

---

## Automated CI/CD

| Trigger | What Happens |
|---|---|
| Push to `main` / PR | `ci.yml` — tests Ubuntu (18/20/22) + Windows + macOS + security |
| Push version tag `v1.0.6` | `release.yml` — tests → builds EXEs → npm publish → GPR publish → GitHub Release |

**No `npm publish` locally. Everything automated.**

---

## Development

```bash
git clone https://github.com/Tech4File/cloudsync-cli.git
cd cloudsync-cli/cloudsync-cli
npm install && npm test
```

## License

MIT — [LICENSE](LICENSE) | [Security policy](cloudsync-cli/SECURITY.md) | [Contributing](cloudsync-cli/CONTRIBUTING.md)
