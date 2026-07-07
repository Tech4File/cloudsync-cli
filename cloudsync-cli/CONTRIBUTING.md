# Contributing to CloudSync-CLI

Thank you for your interest in contributing to CloudSync-CLI! This document
provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

By participating, you are expected to uphold this project's code of conduct.
Please report unacceptable behavior to the project maintainers.

## Getting Started

1. **Fork the Repository**
   ```bash
   git clone https://github.com/Tech4File/cloudsync-cli.git
   cd cloudsync-cli
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Test the Application**
   ```bash
   npm test
   # or for development with watch mode
   npm run dev
   ```

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

### Environment Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/cli.git
cd cli

# Add upstream remote
git remote add upstream https://github.com/Tech4File/cloudsync-cli.git

# Create a new branch for your feature
git checkout -b feature/your-feature-name
```

## Making Changes

### Code Style

We use ESLint for code linting:

```bash
npm run lint
```

### Writing Tests

All new features should include tests. Run tests with:

```bash
npm test
```

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
feat: add new command for X
fix: resolve issue with Y
docs: update documentation for Z
test: add tests for A
refactor: improve B's implementation
```

## Submitting Changes

1. **Update Documentation**
   - Update relevant documentation files
   - Add inline comments for complex code

2. **Run Tests**
   ```bash
   npm test
   npm run lint
   ```

3. **Push Your Changes**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request**
   - Fill out the PR template
   - Link related issues
   - Wait for code review

## Reporting Bugs

### Before Submitting a Bug Report

- Search existing issues to avoid duplicates
- Verify the bug in the latest version
- Collect relevant information:
  - Node.js version
  - Operating system
  - Steps to reproduce
  - Expected vs actual behavior
  - Error messages

### Submitting a Bug Report

Use the [Bug Report Template](https://github.com/Tech4File/cloudsync-cli/issues/new?template=bug_report.md)
on GitHub Issues.

## Suggesting Features

### Before Submitting a Feature Request

- Check the roadmap and existing issues
- Consider if it aligns with the project's goals
- Think about backward compatibility

### Submitting a Feature Request

Use the [Feature Request Template](https://github.com/Tech4File/cloudsync-cli/issues/new?template=feature_request.md)
on GitHub Issues.

## 🗺️ Project Structure

```
cloudsync-cli/
├── bin/                      # Executable entry point
│   └── cloudsync.js
├── src/
│   ├── cli/                 # CLI command definitions
│   │   ├── index.js
│   │   └── commands/        # Individual commands
│   ├── core/
│   │   ├── transport/       # Transfer protocols
│   │   ├── vcs/             # Version control
│   │   └── crypto/          # Encryption utilities
│   └── utils/               # Helper functions
├── test/                    # Test files
├── package.json
└── README.md
```

## 📝 License

By contributing, you agree that your contributions will be licensed
under the MIT License.

## 🙏 Thank You!

Your contributions make the open-source community an amazing place to learn,
inspire, and create. Thank you for your time and effort!
