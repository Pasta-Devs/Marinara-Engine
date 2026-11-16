#!/usr/bin/env bash
# WebKit QC setup: real Safari engine (WebKitGTK) for phone / tablet checks in a Linux container.
#
# Chrome, even with CPU throttling, does not reproduce iPhone/iPad slowness (Nov 2026: tab switches that cost
# 150-250 ms in WebKit cost nothing in Chromium). Use this for every phone/tablet speed or layout check.
#
# One command, safe to re-run (a second run takes about a second):
#   scripts/perf/setup-webkit.sh [appUrl]         install if needed, start everything, smoke test appUrl
#                                                 (default http://localhost:7860; skipped if nothing answers)
#   scripts/perf/setup-webkit.sh --restart        restart the WebDriver ("Maximum number of active sessions")
#   scripts/perf/setup-webkit.sh --stop           stop Xvfb, the WebDriver and the touch proxy
#   scripts/perf/setup-webkit.sh --no-smoke       start everything, skip the smoke test
#
# What runs afterwards (logs in $WEBKIT_QC_DIR, default /tmp/webkit-qc):
#   Xvfb               display :99 (WEBKIT_QC_DISPLAY), 1600x1400
#   WebKitWebDriver    http://127.0.0.1:4444 (WEBKIT_QC_DRIVER_PORT)
#   touch proxy        http://127.0.0.1:7899 -> appUrl (WEBKIT_QC_PROXY_PORT). Adds a small same-origin script
#                      that makes the page see an iPhone / iPad (touch media queries in JS, maxTouchPoints,
#                      iOS user agent), so the app picks its real phone/tablet layout. Pick the device with
#                      ?webkit_qc=phone|tablet on the first load (remembered in a cookie).
#
# Driving pages: scripts/perf/webkit-qc.mjs (no npm dependencies). It opens the app as phone or tablet with
# Show tap timings on, clicks with real WebDriver clicks, screenshots and reads the tap timings box:
#   node scripts/perf/webkit-qc.mjs smoke [appUrl] [--out dir]
#   node scripts/perf/webkit-qc.mjs taps --device tablet --tap '[aria-label="Library"]' --tap ... [appUrl]
# or import { openDevice } from "./webkit-qc.mjs" in your own script.
#
# Limits: CSS media queries (hover/pointer) can't be faked from a page, so CSS-only touch rules (for example
# the held-still Home stars) behave like a mouse device. Paint goes through software GL, so "smooth" and long
# frames read higher than on a real iPad; compare before/after runs, not absolute numbers.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="${WEBKIT_QC_DIR:-/tmp/webkit-qc}"
DISPLAY_NUM="${WEBKIT_QC_DISPLAY:-99}"
DRIVER_PORT="${WEBKIT_QC_DRIVER_PORT:-4444}"
PROXY_PORT="${WEBKIT_QC_PROXY_PORT:-7899}"
APP_URL="http://localhost:7860"
SMOKE=1
ACTION=start

for arg in "$@"; do
  case "$arg" in
    --restart) ACTION=restart ;;
    --stop) ACTION=stop ;;
    --no-smoke) SMOKE=0 ;;
    -h | --help) sed -n '2,32p' "$0"; exit 0 ;;
    -*) echo "Unknown option $arg" >&2; exit 2 ;;
    *) APP_URL="${arg%/}" ;;
  esac
done

mkdir -p "$STATE"
log() { printf '[webkit-qc] %s\n' "$*"; }
SUDO=""
[ "$(id -u)" = 0 ] || SUDO="sudo"

kill_pidfile() {
  local file="$STATE/$1.pid"
  if [ -f "$file" ]; then
    kill "$(cat "$file")" 2>/dev/null || true
    rm -f "$file"
  fi
}

driver_up() { curl -fsS -m 2 "http://127.0.0.1:$DRIVER_PORT/status" 2>/dev/null | grep -q '"ready" *: *true'; }
proxy_target() { curl -fsS -m 2 "http://127.0.0.1:$PROXY_PORT/__webkit-qc/target" 2>/dev/null || true; }

stop_driver() {
  kill_pidfile driver
  pkill -f "WebKitWebDriver --port=$DRIVER_PORT" 2>/dev/null || true
  # Browsers left over from crashed sessions keep the "Maximum number of active sessions" error alive.
  pkill -f "MiniBrowser.*--automation" 2>/dev/null || true
  for _ in $(seq 20); do driver_up || break; sleep 0.1; done
}

if [ "$ACTION" = stop ]; then
  stop_driver
  kill_pidfile proxy
  kill_pidfile xvfb
  log "stopped"
  exit 0
fi

# 1. Packages (only when something is missing).
need=()
command -v Xvfb >/dev/null || need+=(xvfb)
command -v WebKitWebDriver >/dev/null || need+=(webkit2gtk-driver)
# Fonts so text isn't tofu (emoji in names, Japanese/Chinese in packs).
dpkg -s fonts-noto-color-emoji >/dev/null 2>&1 || need+=(fonts-noto-color-emoji)
dpkg -s fonts-noto-cjk >/dev/null 2>&1 || need+=(fonts-noto-cjk)
if [ "${#need[@]}" -gt 0 ]; then
  log "installing ${need[*]} (one time per machine, ~1-2 min)"
  export DEBIAN_FRONTEND=noninteractive
  if ! $SUDO apt-get install -y -qq --no-install-recommends "${need[@]}" >"$STATE/apt.log" 2>&1; then
    $SUDO apt-get update -qq >>"$STATE/apt.log" 2>&1
    $SUDO apt-get install -y -qq --no-install-recommends "${need[@]}" >>"$STATE/apt.log" 2>&1 ||
      { echo "apt-get install failed, see $STATE/apt.log" >&2; exit 1; }
  fi
fi
command -v node >/dev/null || { echo "node is required (>= 18)" >&2; exit 1; }

# 2. Virtual display.
if ! [ -e "/tmp/.X11-unix/X$DISPLAY_NUM" ] || ! pgrep -f "Xvfb :$DISPLAY_NUM" >/dev/null; then
  rm -f "/tmp/.X$DISPLAY_NUM-lock" "/tmp/.X11-unix/X$DISPLAY_NUM"
  nohup Xvfb ":$DISPLAY_NUM" -screen 0 1600x1400x24 -nolisten tcp >"$STATE/xvfb.log" 2>&1 &
  echo $! >"$STATE/xvfb.pid"
  for _ in $(seq 50); do [ -e "/tmp/.X11-unix/X$DISPLAY_NUM" ] && break; sleep 0.1; done
  log "Xvfb started on :$DISPLAY_NUM"
fi

# 3. WebDriver.
[ "$ACTION" = restart ] && stop_driver
if ! driver_up; then
  stop_driver
  # MiniBrowser's toolbar keeps the window wider than a phone; this GTK style lets it shrink to 375 px.
  mkdir -p "$STATE/xdg/gtk-3.0"
  cat >"$STATE/xdg/gtk-3.0/gtk.css" <<'CSS'
headerbar, toolbar, box, entry, button, label, image { min-width: 0; min-height: 0; padding: 0; margin: 0; }
entry { min-width: 8px; }
CSS
  # Sandbox off: container kernels usually refuse the user namespaces bubblewrap needs.
  DISPLAY=":$DISPLAY_NUM" XDG_CONFIG_HOME="$STATE/xdg" WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 WEBKIT_FORCE_SANDBOX=0 \
    LIBGL_ALWAYS_SOFTWARE=1 GDK_BACKEND=x11 NO_AT_BRIDGE=1 \
    nohup WebKitWebDriver --port="$DRIVER_PORT" >"$STATE/driver.log" 2>&1 &
  echo $! >"$STATE/driver.pid"
  for _ in $(seq 50); do driver_up && break; sleep 0.1; done
  driver_up || { echo "WebKitWebDriver did not start, see $STATE/driver.log" >&2; exit 1; }
  log "WebKitWebDriver on http://127.0.0.1:$DRIVER_PORT"
fi

# 4. Touch proxy (restarted when the app URL changes).
if [ "$(proxy_target)" != "$APP_URL" ]; then
  kill_pidfile proxy
  pkill -f "webkit-qc.mjs proxy .*--port $PROXY_PORT" 2>/dev/null || true
  nohup node "$HERE/webkit-qc.mjs" proxy "$APP_URL" --port "$PROXY_PORT" >"$STATE/proxy.log" 2>&1 &
  echo $! >"$STATE/proxy.pid"
  for _ in $(seq 50); do [ "$(proxy_target)" = "$APP_URL" ] && break; sleep 0.1; done
  [ "$(proxy_target)" = "$APP_URL" ] || { echo "touch proxy did not start, see $STATE/proxy.log" >&2; exit 1; }
  log "touch proxy http://127.0.0.1:$PROXY_PORT -> $APP_URL"
fi

log "ready: driver http://127.0.0.1:$DRIVER_PORT, app via http://127.0.0.1:$PROXY_PORT"

# 5. Smoke test against the running app.
if [ "$SMOKE" = 1 ]; then
  if curl -fs -m 3 -o /dev/null "$APP_URL/"; then
    node "$HERE/webkit-qc.mjs" smoke "$APP_URL" --out "$STATE/smoke"
  else
    log "no app answering at $APP_URL, smoke test skipped (start the server, then re-run this script)"
  fi
fi
