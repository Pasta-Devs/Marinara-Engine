#!/usr/bin/env bash
# Vivaldi for QC: download the newest stable Vivaldi for Linux and unpack it (no root, no system install), so the UI
# check and Playwright scripts can drive the real Vivaldi browser. Vivaldi is built on Chromium, so Playwright
# launches it with chromium.launch({ executablePath }). kolache uses Vivaldi, and Home bugs have shown up there
# that headless Chromium never showed (Nov 17 widget shake, Nov 19 giant widgets).
#
#   scripts/perf/setup-vivaldi.sh          install (or update) and print the browser path
#   scripts/perf/setup-vivaldi.sh --path   print the path only (empty and exit 1 when not installed)
#
# Installs into $VIVALDI_QC_DIR (default ~/.cache/marinara-qc/vivaldi). Needs repo.vivaldi.com reachable.
# Linux x86_64 only (the same .deb Vivaldi ships); on a Mac or Windows point VIVALDI_PATH at your own copy.
set -euo pipefail
DIR="${VIVALDI_QC_DIR:-$HOME/.cache/marinara-qc/vivaldi}"
BIN="$DIR/opt/vivaldi/vivaldi-bin"
if [ "${1:-}" = "--path" ]; then
  [ -x "$BIN" ] && echo "$BIN" && exit 0
  exit 1
fi
REPO="https://repo.vivaldi.com/stable/deb"
LATEST="$(curl -fsS -m 60 "$REPO/dists/stable/main/binary-amd64/Packages" |
  awk '/^Package: vivaldi-stable$/{p=1} p&&/^Version:/{v=$2} p&&/^Filename:/{print v" "$2; p=0}' | sort -V | tail -1)"
VERSION="${LATEST%% *}"
FILE="${LATEST#* }"
if [ -z "$VERSION" ]; then
  echo "Could not read Vivaldi's package list from $REPO" >&2
  exit 1
fi
if [ -x "$BIN" ] && [ "$(cat "$DIR/version" 2>/dev/null)" = "$VERSION" ]; then
  echo "$BIN"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Downloading Vivaldi $VERSION" >&2
curl -fsS -m 600 -o "$TMP/vivaldi.deb" "$REPO/$FILE"
rm -rf "$DIR"
mkdir -p "$DIR"
dpkg-deb -x "$TMP/vivaldi.deb" "$DIR"
echo "$VERSION" >"$DIR/version"
"$BIN" --version >&2 || echo "Vivaldi is unpacked but does not start; missing system libraries? Try: apt-get install -y libnss3 libgbm1 libasound2t64" >&2
echo "$BIN"
