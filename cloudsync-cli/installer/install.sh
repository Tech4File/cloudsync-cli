#!/usr/bin/env bash
# CloudSync-CLI Universal Installer for Linux & macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/Tech4File/cloudsync-cli/main/installer/install.sh | bash

set -e

REPO="Tech4File/cloudsync-cli"
INSTALL_DIR="${HOME}/.cloudsync/bin"
EXECUTABLE="${INSTALL_DIR}/cloudsync"

echo "🔒 CloudSync-CLI Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Detect OS & Architecture
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  linux*)
    BINARY_NAME="cloudsync-linux-x64"
    ;;
  darwin*)
    BINARY_NAME="cloudsync-macos-x64"
    ;;
  *)
    echo "❌ Unsupported OS: $OS"
    exit 1
    ;;
esac

echo "📦 System detected: ${OS} (${ARCH})"
echo "📥 Fetching latest release binary (${BINARY_NAME})..."

mkdir -p "${INSTALL_DIR}"

DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}"
curl -fsSL "${DOWNLOAD_URL}" -o "${EXECUTABLE}"
chmod +x "${EXECUTABLE}"

echo "✅ Binary installed to: ${EXECUTABLE}"

# Add to PATH if not present
SHELL_CONFIG=""
if [ -n "$BASH_VERSION" ]; then
  SHELL_CONFIG="${HOME}/.bashrc"
elif [ -n "$ZSH_VERSION" ]; then
  SHELL_CONFIG="${HOME}/.zshrc"
fi

if [ -n "$SHELL_CONFIG" ] && [ -f "$SHELL_CONFIG" ]; then
  if ! grep -q '.cloudsync/bin' "$SHELL_CONFIG"; then
    echo "export PATH=\"\$HOME/.cloudsync/bin:\$PATH\"" >> "$SHELL_CONFIG"
    echo "📝 Added ~/.cloudsync/bin to $SHELL_CONFIG"
  fi
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 CloudSync-CLI installed successfully!"
echo "🚀 Run 'cloudsync --help' to get started."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
