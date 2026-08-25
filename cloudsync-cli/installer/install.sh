#!/usr/bin/env bash
# CloudSync-CLI Universal Installer for Linux & macOS
# Usage:
#   Install:   curl -fsSL https://raw.githubusercontent.com/Tech4File/cloudsync-cli/main/installer/install.sh | bash
#   Custom:    INSTALL_DIR=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/Tech4File/cloudsync-cli/main/installer/install.sh | bash
#   Uninstall: curl -fsSL https://raw.githubusercontent.com/Tech4File/cloudsync-cli/main/installer/install.sh | bash -s -- --uninstall

set -e

REPO="Tech4File/cloudsync-cli"
INSTALL_DIR="${INSTALL_DIR:-${HOME}/.cloudsync/bin}"
EXECUTABLE="${INSTALL_DIR}/cloudsync"
VERSION="${VERSION:-latest}"

echo ""
echo "🔒 CloudSync-CLI Universal Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─────────────────────────────────────────────────────────────
# UNINSTALL MODE
# ─────────────────────────────────────────────────────────────
if [ "$1" = "--uninstall" ] || [ "$1" = "-u" ]; then
  echo "🗑️  Uninstalling CloudSync-CLI..."
  if [ -f "${EXECUTABLE}" ]; then
    rm -f "${EXECUTABLE}"
    echo "✅ Removed executable: ${EXECUTABLE}"
  fi
  if [ -d "${INSTALL_DIR}" ] && [ -z "$(ls -A "${INSTALL_DIR}" 2>/dev/null)" ]; then
    rmdir "${INSTALL_DIR}" 2>/dev/null || true
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🎉 CloudSync-CLI has been uninstalled."
  echo "ℹ️  Remember to remove ${INSTALL_DIR} from your shell profile if desired."
  echo ""
  exit 0
fi

# ─────────────────────────────────────────────────────────────
# OS & ARCHITECTURE DETECTION
# ─────────────────────────────────────────────────────────────
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
    echo "❌ Unsupported operating system: ${OS}"
    echo "   Please build from source or install via npm: npm install -g cloudsync-cli"
    exit 1
    ;;
esac

echo "📦 Target System: ${OS} (${ARCH})"
echo "📁 Install Path:   ${INSTALL_DIR}"

if [ "${VERSION}" = "latest" ]; then
  DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}"
else
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${VERSION}/${BINARY_NAME}"
fi

echo "📥 Downloading binary from ${DOWNLOAD_URL}..."

mkdir -p "${INSTALL_DIR}"
if ! curl -fsSL "${DOWNLOAD_URL}" -o "${EXECUTABLE}"; then
  echo "❌ Download failed. Verify network connectivity or check release assets at https://github.com/${REPO}/releases"
  exit 1
fi

chmod +x "${EXECUTABLE}"
echo "✅ Binary installed to: ${EXECUTABLE}"

# ─────────────────────────────────────────────────────────────
# ENVIRONMENT VARIABLES & GLOBAL PATH RECOGNITION
# ─────────────────────────────────────────────────────────────
PATH_LINE="export PATH=\"${INSTALL_DIR}:\$PATH\""
ADDED_PATH=false

for PROFILE_FILE in "${HOME}/.bashrc" "${HOME}/.zshrc" "${HOME}/.profile" "${HOME}/.bash_profile"; do
  if [ -f "${PROFILE_FILE}" ]; then
    if ! grep -Fq "${INSTALL_DIR}" "${PROFILE_FILE}"; then
      echo "" >> "${PROFILE_FILE}"
      echo "# CloudSync-CLI PATH" >> "${PROFILE_FILE}"
      echo "${PATH_LINE}" >> "${PROFILE_FILE}"
      echo "📝 Registered PATH in: ${PROFILE_FILE}"
      ADDED_PATH=true
    fi
  fi
done

if [ "$ADDED_PATH" = false ]; then
  # Fallback to .profile if no profiles exist
  if [ ! -f "${HOME}/.bashrc" ] && [ ! -f "${HOME}/.zshrc" ]; then
    echo "${PATH_LINE}" >> "${HOME}/.profile"
    echo "📝 Created and registered PATH in: ${HOME}/.profile"
  fi
fi

# ─────────────────────────────────────────────────────────────
# VERIFICATION
# ─────────────────────────────────────────────────────────────
echo "🔍 Verifying binary execution..."
if "${EXECUTABLE}" --version >/dev/null 2>&1; then
  INSTALLED_VER="$("${EXECUTABLE}" --version)"
  echo "✅ Verified CloudSync-CLI executable: ${INSTALLED_VER}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 CloudSync-CLI installed successfully!"
echo "🚀 Run 'cloudsync --help' to get started."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
