#!/bin/bash
# Finder may not inherit the user's terminal PATH. Check standard Node locations.
set -eu
PACKAGE_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
GARMIN_NODE=""
for candidate in "$(command -v node || true)" /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -n "$candidate" ] && [ -x "$candidate" ] && "$candidate" -e 'const [major,minor]=process.versions.node.split(".").map(Number); process.exit(major>22 || major===22 && minor>=12 ? 0 : 1)'; then
    GARMIN_NODE="$candidate"
    break
  fi
done
if [ -z "$GARMIN_NODE" ]; then
  echo "Install Node.js 22.12 or newer from https://nodejs.org, then open this installer again."
  read -r -p "Press Return to close. "
  exit 1
fi
if [ "${1:-}" = "--check" ]; then exec "$GARMIN_NODE" "$PACKAGE_DIR/dist/cli.js" --version; fi
if ! "$GARMIN_NODE" "$PACKAGE_DIR/dist/cli.js" install-plugin; then
  echo "Installation did not complete. Your existing plugins have been preserved."
  read -r -p "Press Return to close. "
  exit 1
fi
read -r -p "Press Return to close. "
