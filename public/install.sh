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

# Missing tools are installed for you, without sudo: with Homebrew when it's there, otherwise the
# official builds go to ~/.sparkflow/tools (the sparkflow command puts it on its PATH).
TOOLS="$HOME_DIR/tools"
mkdir -p "$TOOLS/bin"
export PATH="$TOOLS/bin:$TOOLS/node/bin:$PATH"
ARCH="$(uname -m)"
case "$ARCH" in arm64 | aarch64) NARCH=arm64 ;; x86_64 | amd64) NARCH=x64 ;; *) die "Unsupported processor: $ARCH" ;; esac
PLATFORM="$(echo "$OS" | tr '[:upper:]' '[:lower:]')"

node_ok() { has node && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; }

install_node() {
  if has brew; then
    brew install node >/dev/null 2>&1 && return
  fi
  # Latest Node 22 LTS from nodejs.org, checked against its published SHA-256.
  local base="https://nodejs.org/dist/latest-v22.x" line file
  line="$(curl -fsSL "$base/SHASUMS256.txt" | grep " node-v.*-$PLATFORM-$NARCH.tar.gz$")" || die "Couldn't find a Node build for $PLATFORM-$NARCH"
  file="${line##* }"
  curl -fL --progress-bar "$base/$file" -o "$TMP_TOOLS/$file" || die "Couldn't download Node"
  (cd "$TMP_TOOLS" && echo "$line" | shasum -a 256 -c - >/dev/null) || die "Node download is corrupted"
  rm -rf "$TOOLS/node" && mkdir -p "$TOOLS/node"
  tar -xzf "$TMP_TOOLS/$file" -C "$TOOLS/node" --strip-components 1
}

install_cloudflared() {
  if has brew; then
    brew install cloudflared >/dev/null 2>&1 && return
  fi
  local arch=$([ "$NARCH" = x64 ] && echo amd64 || echo arm64)
  local url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-$PLATFORM-$arch"
  if [ "$PLATFORM" = darwin ]; then
    curl -fL --progress-bar "$url.tgz" -o "$TMP_TOOLS/cloudflared.tgz" || die "Couldn't download cloudflared"
    tar -xzf "$TMP_TOOLS/cloudflared.tgz" -C "$TOOLS/bin"
  else
    curl -fL --progress-bar "$url" -o "$TOOLS/bin/cloudflared" || die "Couldn't download cloudflared"
  fi
  chmod +x "$TOOLS/bin/cloudflared"
}

TMP_TOOLS="$(mktemp -d)"
if node_ok; then
  ok "Node $(node -v)"
else
  warn "Node 20+ missing$(has node && echo " (found $(node -v))"): installing it"
  install_node
  node_ok || die "Node installation failed"
  ok "Node $(node -v) installed"
fi
has npm || die "npm is missing next to Node"
has git || die "git is required (xcode-select --install)"
ok "npm $(npm -v), git"

if has cloudflared; then
  ok "cloudflared"
else
  warn "cloudflared missing: installing it"
  install_cloudflared
  has cloudflared || die "cloudflared installation failed"
  ok "cloudflared installed"
fi

if has watchman; then
  ok "watchman"
elif has brew; then
  warn "watchman missing: installing it (faster reloads)"
  brew install watchman >/dev/null 2>&1 && ok "watchman installed" || warn "watchman couldn't be installed (optional)"
else
  warn "watchman not found (optional, faster reloads)"
fi
rm -rf "$TMP_TOOLS"

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
# The version installed so far: its dependencies are reused when they haven't changed.
PREV="$(cd "$HOME_DIR/current" 2>/dev/null && pwd -P || true)"
if [ -n "$PREV" ] && [ "$PREV" = "$(cd "$DEST" 2>/dev/null && pwd -P || true)" ]; then
  # Reinstalling the same version: keep the old copy aside until the new one is ready.
  rm -rf "$DEST.prev" && mv "$DEST" "$DEST.prev" && PREV="$DEST.prev"
fi
rm -rf "$DEST"
mkdir -p "$DEST" "$HOME_DIR/data" "$BIN_DIR"
tar -xzf "$TMP/$ASSET" -C "$DEST"

# node_modules of `dir` from the previous version when its package-lock.json is identical (an
# instant APFS clone on macOS), otherwise a clean npm ci.
deps() {
  local dir="$1" label="$2"
  if [ -n "$PREV" ] && [ -d "$PREV/$dir/node_modules" ] && cmp -s "$PREV/$dir/package-lock.json" "$DEST/$dir/package-lock.json"; then
    cp -cR "$PREV/$dir/node_modules" "$DEST/$dir/" 2>/dev/null || cp -R "$PREV/$dir/node_modules" "$DEST/$dir/"
    ok "$label (unchanged, reused)"
  else
    echo "  Installing $label (a few minutes the first time)…"
    npm --prefix "$DEST/$dir" ci --no-audit --no-fund --loglevel=error >/dev/null || die "Installing $label failed"
    ok "$label"
  fi
}
cd "$DEST"
deps . "Server dependencies"
deps templates/expo-base "Expo template"
npx --yes playwright install chromium >/dev/null 2>&1 || die "Installing Playwright's Chromium failed"
ok "Chromium for screenshots"
rm -rf "$DEST.prev"

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
