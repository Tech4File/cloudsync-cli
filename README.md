# 🔒 CloudSync-CLI Workspace

Welcome to the **CloudSync-CLI** monorepo repository! 

This repository contains the source code, build configurations, and specifications for **CloudSync-CLI**—a Git-like version control command-line interface designed for secure cloud-to-local synchronization using encrypted SSH tunnels.

[![GitHub license](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![GitHub package version](https://img.shields.io/github/package-json/v/Tech4File/cloudsync-cli?style=for-the-badge)](cloudsync-cli/package.json)
[![GitHub Actions CI/CD](https://img.shields.io/github/actions/workflow/status/Tech4File/cloudsync-cli/ci.yml?style=for-the-badge)](https://github.com/Tech4File/cloudsync-cli/actions)
[![npm version](https://img.shields.io/npm/v/cloudsync-cli.svg?style=for-the-badge)](https://www.npmjs.com/package/cloudsync-cli)

---

## 📂 Repository Structure

The workspace is organized as follows:

| Directory / File | Description |
|:---|:---|
| 📂 **[cloudsync-cli/](file:///h:/Project-TF/cloudsync-cli/cloudsync-cli)** | The core Node.js package directory for the CLI tool (this directory is published directly to npm). Contains all CLI commands, core transport logic, and internal tests. |
| 📂 **[test-workspace/](file:///h:/Project-TF/cloudsync-cli/test-workspace)** | A sandbox environment used for local CLI command testing, credentials verification, and dry-run synchronization behavior. |
| 📄 **[SPEC.md](file:///h:/Project-TF/cloudsync-cli/SPEC.md)** | Technical design specification detailing the command architecture, security mechanics, and underlying network protocol details. |
| 📄 **[IMPROVEMENTS.md](file:///h:/Project-TF/cloudsync-cli/IMPROVEMENTS.md)** | Developer task board outlining planned fixes, performance enhancements, and future additions. |

---

## 🚀 Quick Start for Developers

To run, develop, and test the CLI tool locally, check out the core package directory:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Tech4File/cloudsync-cli.git
   cd cloudsync-cli
   ```

2. **Navigate to the CLI package**:
   ```bash
   cd cloudsync-cli
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Run the CLI in development mode**:
   ```bash
   npm run start -- --help
   # Or using the global link
   npm link
   cloudsync --help
   ```

5. **Execute tests**:
   ```bash
   npm test
   ```

Refer to the internal **[cloudsync-cli/README.md](file:///h:/Project-TF/cloudsync-cli/cloudsync-cli/README.md)** for a detailed list of CLI commands, configuration options, and installation instructions for end-users.

---

## 🛡️ Security and Community Guideline Policies

We maintain standard repository templates and guideline files at the root level for easy reference:

*   **[LICENSE](file:///h:/Project-TF/cloudsync-cli/LICENSE)** - MIT License information.
*   **[CODE_OF_CONDUCT.md](file:///h:/Project-TF/cloudsync-cli/CODE_OF_CONDUCT.md)** - Standards of behavior for contributors.
*   **[CONTRIBUTING.md](file:///h:/Project-TF/cloudsync-cli/CONTRIBUTING.md)** - Guidance on opening issues, writing code, and submitting PRs.
*   **[SECURITY.md](file:///h:/Project-TF/cloudsync-cli/SECURITY.md)** - Directions for disclosing security vulnerabilities responsibly.
