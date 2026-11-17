#!/usr/bin/env bash
# Android QC setup: a real Android emulator with real Chrome, for phone / tablet checks of Android browsers (the
# Android APK's WebView is the same Chromium engine). The Termux install itself is checked by setup-termux.sh.
#
# Needs hardware virtualisation (/dev/kvm): a Linux PC, or a GitHub Actions ubuntu runner (see
# .github/workflows/android-qc.yml). Cloud containers without /dev/kvm can't boot Android at a usable speed; use
# scripts/perf/setup-termux.sh there to check the Termux install and launch, and the WebKit check for layout.
#
# One command, safe to re-run (a second run takes a few seconds):
#   scripts/perf/setup-android.sh [appUrl]      install if needed, boot the emulator, start ChromeDriver, smoke test
#                                               appUrl (default http://localhost:7860, a server on THIS machine; the
#                                               emulator reaches it through adb reverse, so it is localhost there too,
#                                               the same address Termux users open)
#   scripts/perf/setup-android.sh --stop        stop ChromeDriver and the emulator
#   scripts/perf/setup-android.sh --no-smoke    boot everything, skip the smoke test
#
# What runs afterwards (logs in $ANDROID_QC_DIR, default /tmp/android-qc):
#   emulator           AVD "marinara-qc" (Android $ANDROID_QC_API, Google APIs, x86_64), headless, Pixel 7 screen
#   ChromeDriver       http://127.0.0.1:9515 (ANDROID_QC_DRIVER_PORT), matched to the emulator's Chrome version
#
# Driving pages: scripts/perf/android-qc.mjs (no npm dependencies), the same commands as webkit-qc.mjs:
#   node scripts/perf/android-qc.mjs smoke [appUrl] [--out dir]
#   node scripts/perf/android-qc.mjs taps --device tablet --tap '[aria-label="Library"]' [appUrl]
#
# Limits: the emulator runs on a PC processor, so tap timings read faster than a mid-range phone. Compare runs before
# and after a change, not absolute numbers (the same rule as the WebKit check). Chrome on the emulator image is the
# version Google shipped with it, usually older than Chrome on a real phone. Don't run Termux in this emulator: it is
# x86_64 and real phones are arm64 (setup-termux.sh checks Termux).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="${ANDROID_QC_DIR:-/tmp/android-qc}"
API="${ANDROID_QC_API:-35}"
DRIVER_PORT="${ANDROID_QC_DRIVER_PORT:-9515}"
AVD="marinara-qc"
IMAGE="system-images;android-$API;google_apis;x86_64"
APP_URL="http://localhost:7860"
SMOKE=1
ACTION=start

for arg in "$@"; do
  case "$arg" in
    --stop) ACTION=stop ;;
    --no-smoke) SMOKE=0 ;;
    -h | --help) sed -n '2,28p' "$0"; exit 0 ;;
    -*) echo "Unknown option $arg" >&2; exit 2 ;;
    *) APP_URL="${arg%/}" ;;
  esac
done

mkdir -p "$STATE"
log() { printf '[android-qc] %s\n' "$*"; }
SUDO=""
[ "$(id -u)" = 0 ] || SUDO="sudo"

# Android SDK: reuse one if the machine has it (GitHub runners do), else install into $STATE/sdk.
if [ -z "${ANDROID_HOME:-}" ] || ! [ -d "${ANDROID_HOME}" ]; then
  export ANDROID_HOME="${ANDROID_SDK_ROOT:-$STATE/sdk}"
fi
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_AVD_HOME="$STATE/avd"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export ADB="$ANDROID_HOME/platform-tools/adb"

driver_up() { curl -fsS -m 2 "http://127.0.0.1:$DRIVER_PORT/status" 2>/dev/null | grep -q '"ready" *: *true'; }
booted() { [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; }

if [ "$ACTION" = stop ]; then
  [ -f "$STATE/driver.pid" ] && kill "$(cat "$STATE/driver.pid")" 2>/dev/null || true
  rm -f "$STATE/driver.pid"
  [ -x "$ADB" ] && "$ADB" emu kill >/dev/null 2>&1 || true
  log "stopped"
  exit 0
fi

if ! [ -r /dev/kvm ] || ! [ -w /dev/kvm ]; then
  cat >&2 <<EOF
[android-qc] /dev/kvm is missing or not usable here, so Android can't boot at a usable speed.
  - Cloud containers and most CI sandboxes have no KVM. Run the GitHub workflow "Android QC" instead
    (.github/workflows/android-qc.yml), or use scripts/perf/setup-termux.sh to check the Termux install and launch.
  - On your own Linux PC: enable virtualisation (VT-x / AMD-V) in the BIOS, then
    sudo usermod -aG kvm \$USER (log out and in), or on a GitHub runner add the udev rule from android-qc.yml.
EOF
  exit 3
fi

# 1. Packages and SDK parts (only when something is missing).
need=()
command -v java >/dev/null || need+=(openjdk-17-jre-headless)
command -v unzip >/dev/null || need+=(unzip)
command -v curl >/dev/null || need+=(curl)
if [ "${#need[@]}" -gt 0 ]; then
  log "installing ${need[*]} (one time per machine)"
  export DEBIAN_FRONTEND=noninteractive
  { $SUDO apt-get update -qq && $SUDO apt-get install -y -qq --no-install-recommends "${need[@]}"; } >"$STATE/apt.log" 2>&1 ||
    { echo "apt-get install failed, see $STATE/apt.log" >&2; exit 1; }
fi
command -v node >/dev/null || { echo "node is required (>= 18)" >&2; exit 1; }

if ! command -v sdkmanager >/dev/null; then
  log "downloading the Android command-line tools"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  curl -fsSL -o "$STATE/cmdline-tools.zip" \
    "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_QC_CMDLINE_TOOLS:-11076708}_latest.zip"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest" "$STATE/cmdline-tools"
  unzip -q "$STATE/cmdline-tools.zip" -d "$STATE"
  mv "$STATE/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi
if ! [ -x "$ANDROID_HOME/emulator/emulator" ] || ! [ -x "$ADB" ] || ! [ -d "$ANDROID_HOME/system-images/android-$API/google_apis/x86_64" ]; then
  log "installing the emulator and the Android $API image (one time, ~2 GB)"
  yes | sdkmanager --licenses >"$STATE/sdk.log" 2>&1 || true
  sdkmanager --install platform-tools emulator "$IMAGE" >>"$STATE/sdk.log" 2>&1 ||
    { echo "sdkmanager failed, see $STATE/sdk.log" >&2; exit 1; }
fi

# 2. The emulator.
if ! [ -d "$ANDROID_AVD_HOME/$AVD.avd" ]; then
  mkdir -p "$ANDROID_AVD_HOME"
  echo no | avdmanager create avd -n "$AVD" -k "$IMAGE" -d pixel_7 --force >"$STATE/avd.log" 2>&1 ||
    { echo "avdmanager failed, see $STATE/avd.log" >&2; exit 1; }
  # A phone-sized amount of memory; no hardware keyboard, so the on-screen keyboard shows like on a phone.
  cat >>"$ANDROID_AVD_HOME/$AVD.avd/config.ini" <<'INI'
disk.dataPartition.size=4G
hw.ramSize=4096
hw.keyboard=no
INI
fi
if ! booted; then
  log "booting the emulator (about 1 minute, longer the first time)"
  nohup emulator -avd "$AVD" -no-window -no-audio -no-boot-anim -no-snapshot-save -gpu swiftshader_indirect \
    -accel on -cores "${ANDROID_QC_CORES:-4}" >"$STATE/emulator.log" 2>&1 &
  echo $! >"$STATE/emulator.pid"
  "$ADB" wait-for-device
  for _ in $(seq 300); do booted && break; sleep 1; done
  booted || { echo "the emulator did not finish booting, see $STATE/emulator.log" >&2; exit 1; }
  "$ADB" shell settings put global window_animation_scale 1 >/dev/null
  "$ADB" shell svc power stayon true >/dev/null 2>&1 || true
  "$ADB" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
  "$ADB" shell wm dismiss-keyguard >/dev/null 2>&1 || true
  log "emulator up: $("$ADB" shell getprop ro.build.version.release | tr -d '\r') (API $API)"
fi

# 3. Chrome and a matching ChromeDriver.
CHROME_VERSION="$("$ADB" shell dumpsys package com.android.chrome | sed -n 's/.*versionName=\([0-9.]*\).*/\1/p' | head -1)"
[ -n "$CHROME_VERSION" ] || { echo "Chrome is not on the emulator image ($IMAGE)" >&2; exit 1; }
MAJOR="${CHROME_VERSION%%.*}"
# Chrome reads its command line (no first-run screens) only when it is the debug app on a non-rooted image.
"$ADB" shell am set-debug-app --persistent com.android.chrome >/dev/null 2>&1 || true
DRIVER_BIN="$STATE/chromedriver-$MAJOR/chromedriver"
if ! [ -x "$DRIVER_BIN" ]; then
  log "downloading ChromeDriver $MAJOR for Chrome $CHROME_VERSION"
  mkdir -p "$STATE/chromedriver-$MAJOR"
  if [ "$MAJOR" -ge 115 ]; then
    url="$(curl -fsSL https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone-with-downloads.json |
      node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s).milestones[process.argv[1]];const d=m?.downloads?.chromedriver?.find(x=>x.platform==="linux64");process.stdout.write(d?.url??"")})' "$MAJOR")"
    [ -n "$url" ] || { echo "no ChromeDriver download for Chrome $MAJOR" >&2; exit 1; }
    curl -fsSL -o "$STATE/chromedriver.zip" "$url"
    unzip -q -o -j "$STATE/chromedriver.zip" '*/chromedriver' -d "$STATE/chromedriver-$MAJOR"
  else
    version="$(curl -fsSL "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_$MAJOR")"
    curl -fsSL -o "$STATE/chromedriver.zip" "https://chromedriver.storage.googleapis.com/$version/chromedriver_linux64.zip"
    unzip -q -o "$STATE/chromedriver.zip" chromedriver -d "$STATE/chromedriver-$MAJOR"
  fi
  chmod +x "$DRIVER_BIN"
fi
if ! driver_up; then
  [ -f "$STATE/driver.pid" ] && kill "$(cat "$STATE/driver.pid")" 2>/dev/null || true
  PATH="$ANDROID_HOME/platform-tools:$PATH" nohup "$DRIVER_BIN" --port="$DRIVER_PORT" >"$STATE/driver.log" 2>&1 &
  echo $! >"$STATE/driver.pid"
  for _ in $(seq 50); do driver_up && break; sleep 0.1; done
  driver_up || { echo "ChromeDriver did not start, see $STATE/driver.log" >&2; exit 1; }
  log "ChromeDriver $MAJOR on http://127.0.0.1:$DRIVER_PORT (Chrome $CHROME_VERSION on the emulator)"
fi

# 4. Point the emulator at the app.
PORT="$(node -e 'const u=new URL(process.argv[1]);process.stdout.write(u.port||(u.protocol==="https:"?"443":"80"))' "$APP_URL")"
# The emulator's localhost:PORT is this machine's localhost:PORT.
"$ADB" reverse "tcp:$PORT" "tcp:$PORT" >/dev/null

log "ready: ChromeDriver http://127.0.0.1:$DRIVER_PORT, the emulator opens the app at http://localhost:$PORT"

# 5. Smoke test.
if [ "$SMOKE" = 1 ]; then
  if curl -fs -m 5 -o /dev/null "http://127.0.0.1:$PORT/"; then
    node "$HERE/android-qc.mjs" smoke "http://localhost:$PORT" --out "$STATE/smoke"
  else
    log "no app answering at http://127.0.0.1:$PORT, smoke test skipped (start the server, then re-run this script)"
  fi
fi
