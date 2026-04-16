#!/usr/bin/env bash
# Install apple-docs CLI from the latest GitHub release.
# Usage: curl -fsSL https://raw.githubusercontent.com/ethan-huo/apple-docs/main/install.sh | bash
set -euo pipefail

REPO="ethan-huo/apple-docs"
INSTALL_DIR="${APPLE_DOCS_INSTALL_DIR:-$HOME/.local/bin}"

# Resolve version — accept explicit arg or fetch latest tag.
if [ "${1:-}" != "" ]; then
  tag="v${1#v}"
else
  tag=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d '"' -f 4)
fi

if [ -z "$tag" ]; then
  echo "error: failed to resolve release tag" >&2
  exit 1
fi

url="https://github.com/$REPO/releases/download/$tag/apple-docs.tar.gz"
echo "Installing apple-docs $tag to $INSTALL_DIR ..."

mkdir -p "$INSTALL_DIR"
curl -fsSL "$url" | tar -xz -C "$INSTALL_DIR"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun runtime not found — installing ..."
  curl -fsSL https://bun.sh/install | bash
fi

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) echo "hint: add $INSTALL_DIR to your PATH if it is not already" ;;
esac

echo "done: $(command -v apple-docs 2>/dev/null || echo "$INSTALL_DIR/apple-docs")"
