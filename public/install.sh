#!/usr/bin/env bash
# Sparkflow installer.
#
#   curl -fsSL https://sparkflow-ai.web.app/install.sh | bash             latest release
#   curl -fsSL https://sparkflow-ai.web.app/install.sh | bash -s v0.2.0   a given release
#
# Checks what Sparkflow needs, downloads the release from GitHub (checksum verified), installs
# it in ~/.sparkflow and puts a `sparkflow` command in ~/.local/bin. Your apps live in
# ~/.sparkflow/data and survive updates.
set -euo pipefail

REPO="Antoinegtir/sparkflow"
HOME_DIR="${SPARKFLOW_HOME:-$HOME/.sparkflow}"
BIN_DIR="${SPARKFLOW_BIN_DIR:-$HOME/.local/bin}"
WANTED="${1:-${SPARKFLOW_VERSION:-}}"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die() { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

bold "Sparkflow installer"

# ---------- Prerequisites ----------
bold "Checking your computer"
OS="$(uname)"
case "$OS" in
  Darwin) ok "macOS $(sw_vers -productVersion) ($(uname -m))" ;;
  Linux) warn "Linux: Expo builds work, the iOS Simulator features don't" ;;
  *) die "Unsupported system: $OS (macOS or Linux)" ;;
esac

for tool in curl tar shasum; do has "$tool" || die "$tool is required"; done

if [ "$OS" = "Darwin" ]; then
  if xcode-select -p >/dev/null 2>&1; then
    ok "Xcode command line tools"
  else
    xcode-select --install >/dev/null 2>&1 || true
    die "Xcode command line tools are missing: finish the installation that just opened, then run this again"
  fi
  if xcrun simctl help >/dev/null 2>&1; then
    ok "Xcode with iOS Simulator"
  else
    warn "Full Xcode not found (App Store): Expo builds work, the iOS Simulator view needs it"
  fi
fi

if has node; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$NODE_MAJOR" -ge 20 ] || die "Node $(node -v) is too old: Sparkflow needs 20+ (brew install node)"
  ok "Node $(node -v)"
else
  die "Node.js 20+ is required: brew install node (or https://nodejs.org)"
fi
has npm || die "npm is required (it comes with Node)"
has git || die "git is required (xcode-select --install)"
ok "npm $(npm -v), git"

if has cloudflared; then
  ok "cloudflared"
elif has brew; then
  warn "cloudflared missing: installing it with Homebrew"
  brew install cloudflared >/dev/null && ok "cloudflared installed"
else
  die "cloudflared is required to reach the hosted site: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
fi
has watchman && ok "watchman" || warn "watchman not found (optional, faster reloads): brew install watchman"

# ---------- Release ----------
bold "Downloading"
if [ -n "$WANTED" ]; then
  TAG="$WANTED"
  case "$TAG" in v*) ;; *) TAG="v$TAG" ;; esac
else
  TAG="$( (curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null || true) | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)"
  [ -n "$TAG" ] || die "No Sparkflow release is published yet (https://github.com/$REPO/releases): try again in a few minutes"
fi
ASSET="sparkflow-$TAG.tar.gz"
URL="${SPARKFLOW_TARBALL_URL:-https://github.com/$REPO/releases/download/$TAG}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "  $TAG from GitHub Releases…"
curl -fL --progress-bar "$URL/$ASSET" -o "$TMP/$ASSET" || die "Couldn't download $TAG ($URL/$ASSET)"
curl -fsSL "$URL/$ASSET.sha256" -o "$TMP/$ASSET.sha256" || die "Couldn't download the checksum of $TAG"
(cd "$TMP" && shasum -a 256 -c "$ASSET.sha256" >/dev/null) || die "Checksum mismatch: the download is corrupted"
ok "$TAG ($(du -h "$TMP/$ASSET" | cut -f1 | tr -d ' '), checksum verified)"

# ---------- Install ----------
bold "Installing in $HOME_DIR"
DEST="$HOME_DIR/versions/$TAG"
rm -rf "$DEST"
mkdir -p "$DEST" "$HOME_DIR/data" "$BIN_DIR"
tar -xzf "$TMP/$ASSET" -C "$DEST"

cd "$DEST"
echo "  Installing dependencies (a few minutes the first time)…"
npm ci --no-audit --no-fund --loglevel=error >/dev/null || die "npm ci failed in $DEST"
ok "Server dependencies"
npm --prefix templates/expo-base ci --no-audit --no-fund --loglevel=error >/dev/null || die "Installing the Expo template failed"
ok "Expo template"
npx --yes playwright install chromium >/dev/null 2>&1 || die "Installing Playwright's Chromium failed"
ok "Chromium for screenshots"

# Settings and API key are shared by every version.
[ -f "$HOME_DIR/.env" ] || cp .env.example "$HOME_DIR/.env" 2>/dev/null || touch "$HOME_DIR/.env"
ln -sfn "$HOME_DIR/.env" "$DEST/.env"

ln -sfn "$DEST" "$HOME_DIR/current"
chmod +x "$DEST/bin/sparkflow"
ln -sfn "$HOME_DIR/current/bin/sparkflow" "$BIN_DIR/sparkflow"
ok "sparkflow → $BIN_DIR/sparkflow"

# Older versions: keep the previous one for a quick rollback.
ls -1t "$HOME_DIR/versions" | tail -n +3 | while read -r old; do rm -rf "$HOME_DIR/versions/$old"; done

bold "Sparkflow $TAG is installed"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) warn "$BIN_DIR is not in your PATH: echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.zshrc && source ~/.zshrc" ;;
esac
echo "  Start it:  sparkflow"
echo "  API key:   $HOME_DIR/.env (MODEL_API_KEY=…), demo mode without it"
echo "  Check:     sparkflow doctor"
