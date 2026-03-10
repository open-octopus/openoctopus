#!/bin/bash
set -euo pipefail

# ── OpenOctopus Installer ──
# Usage: curl -fsSL https://raw.githubusercontent.com/openoctopus/openoctopus/main/scripts/install.sh | bash
# Flags: --version <tag>  --beta  --skip-doctor

PACKAGE="openoctopus"
VERSION="latest"
SKIP_DOCTOR=false

# ── Parse flags ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --beta)
      VERSION="beta"
      shift
      ;;
    --skip-doctor)
      SKIP_DOCTOR=true
      shift
      ;;
    *)
      echo "Unknown flag: $1"
      exit 1
      ;;
  esac
done

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC}  $1"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $1"; }
fail()  { echo -e "${RED}[fail]${NC}  $1"; exit 1; }

echo ""
echo -e "${CYAN}  ╔═══════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║     OpenOctopus Installer          ║${NC}"
echo -e "${CYAN}  ╚═══════════════════════════════════╝${NC}"
echo ""

# ── Detect OS ──
OS="$(uname -s)"
case "$OS" in
  Linux*)  info "Platform: Linux" ;;
  Darwin*) info "Platform: macOS" ;;
  MINGW*|MSYS*|CYGWIN*)
    fail "Windows is not supported by this installer. Use: npm i -g $PACKAGE"
    ;;
  *)
    fail "Unsupported OS: $OS"
    ;;
esac

# ── Check Node.js ──
if ! command -v node &>/dev/null; then
  fail "Node.js not found. Install Node.js >= 22.12.0 first:
    nvm install 22   (https://github.com/nvm-sh/nvm)
    fnm install 22   (https://github.com/Schniz/fnm)"
fi

NODE_VERSION="$(node -v)"
NODE_MAJOR="$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)"
NODE_MINOR="$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f2)"

if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 12 ]; }; then
  fail "Node.js $NODE_VERSION is too old. Requires >= 22.12.0.
    nvm install 22 && nvm use 22
    fnm install 22 && fnm use 22"
fi

ok "Node.js $NODE_VERSION"

# ── Check npm ──
if ! command -v npm &>/dev/null; then
  fail "npm not found. It should be bundled with Node.js."
fi

ok "npm $(npm -v)"

# ── Install ──
SPEC="${PACKAGE}@${VERSION}"
info "Installing $SPEC..."

npm i -g "$SPEC" --no-fund --no-audit --loglevel=error

if ! command -v tentacle &>/dev/null; then
  fail "Installation succeeded but 'tentacle' not found in PATH.
    This usually means the npm global bin directory is not in your PATH.
    Try: npm config get prefix  (add <prefix>/bin to PATH)"
fi

INSTALLED_VERSION="$(tentacle --version 2>/dev/null || echo 'unknown')"
ok "Installed openoctopus $INSTALLED_VERSION"

# ── Run doctor ──
if [ "$SKIP_DOCTOR" = false ]; then
  info "Running diagnostics..."
  tentacle doctor || warn "Some checks reported warnings (this is normal for a fresh install)"
fi

# ── Done ──
echo ""
echo -e "${GREEN}  OpenOctopus installed successfully!${NC}"
echo ""
echo "  Get started:"
echo "    tentacle setup          # First-time setup wizard"
echo "    tentacle config init    # Create config file"
echo "    tentacle start          # Start the gateway"
echo "    tentacle chat           # Start chatting"
echo ""
echo "  Update later:   tentacle update"
echo "  Documentation:  https://github.com/openoctopus/openoctopus"
echo ""
