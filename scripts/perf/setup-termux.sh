#!/usr/bin/env bash
# Termux QC: run this checkout the way Android users do, in real Termux (Termux's own Node.js, packages, Android libc
# and paths) inside Docker, with Marinara's own start-termux.sh. Catches install, build and launch problems that only
# happen on Termux, without an Android device or emulator. Uses termux/termux-docker (Termux's official image).
#
# One command, safe to re-run (the Termux home is kept in a Docker volume, so later runs only rebuild what changed):
#   scripts/perf/setup-termux.sh                 copy this checkout into Termux, run start-termux.sh --skip-update,
#                                                wait until the server answers on http://localhost:7861
#   scripts/perf/setup-termux.sh --port 7862     another port (the container shares this machine's network)
#   scripts/perf/setup-termux.sh --arch x86_64   x86_64 Termux (Chromebooks, BlueStacks and other x86 Android).
#                                                Default aarch64, what phones and tablets run; on an x86 machine it
#                                                runs through CPU emulation (qemu), so the first build is slow
#                                                (about 10 min); an ARM machine (GitHub ubuntu-24.04-arm) runs it natively.
#   scripts/perf/setup-termux.sh --fresh         start from a new Termux home (like a first install)
#   scripts/perf/setup-termux.sh --shell         open a Termux shell in the container
#   scripts/perf/setup-termux.sh --stop          stop the container (keeps the Termux home volume)
#
# Afterwards the server is a normal local server, so drive it with the phone/tablet checks:
#   scripts/perf/setup-webkit.sh http://localhost:7861      (iPhone / iPad: WebKit)
#   scripts/perf/setup-android.sh http://localhost:7861     (Android Chrome; needs /dev/kvm)
#
# Logs: $TERMUX_QC_DIR (default /tmp/termux-qc)/launch-<arch>.log. Behind a TLS-inspecting proxy, set
# TERMUX_QC_CA_FILE to its CA bundle (NODE_EXTRA_CA_CERTS or SSL_CERT_FILE are used when set).
# Termux's package mirror must be reachable: packages-cf.termux.dev (allow it in sandboxed cloud environments).
#
# Limits: this is Termux on a PC kernel, not on Android. Android-only things are not covered: the phantom process
# killer, battery savers, storage permissions, the Android APK's Termux hand-off, and real phone speed.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
STATE="${TERMUX_QC_DIR:-/tmp/termux-qc}"
ARCH=aarch64
PORT=7861
ACTION=start
FRESH=0
TIMEOUT_MIN="${TERMUX_QC_TIMEOUT_MIN:-60}"
MIRROR="${TERMUX_QC_MIRROR:-https://packages-cf.termux.dev/apt/termux-main}"

while [ $# -gt 0 ]; do
  case "$1" in
    --arch) ARCH="$2"; shift ;;
    --port) PORT="$2"; shift ;;
    --fresh) FRESH=1 ;;
    --shell) ACTION=shell ;;
    --stop) ACTION=stop ;;
    -h | --help) sed -n '2,27p' "$0"; exit 0 ;;
    *) echo "Unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
case "$ARCH" in aarch64 | x86_64 | arm | i686) ;; *) echo "--arch must be aarch64, x86_64, arm or i686" >&2; exit 2 ;; esac

NAME="marinara-termux-$ARCH"
VOLUME="marinara-termux-home-$ARCH"
IMAGE="termux/termux-docker:$ARCH"
HOME_DIR=/data/data/com.termux/files/home
PREFIX=/data/data/com.termux/files/usr
LOG="$STATE/launch-$ARCH.log"
mkdir -p "$STATE"
log() { printf '[termux-qc] %s\n' "$*"; }
command -v docker >/dev/null || { echo "Docker is required (https://docs.docker.com/engine/install/)" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker is installed but not running (try: sudo dockerd &, or start Docker Desktop)" >&2; exit 1; }
tx() { docker exec -i -u system "$NAME" "$PREFIX/bin/bash" -lc "$1"; }

if [ "$ACTION" = stop ]; then
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  log "stopped (Termux home kept in volume $VOLUME; --fresh removes it)"
  exit 0
fi

# 1. CPU emulation for a foreign architecture (an x86 PC running aarch64 Termux).
host="$(uname -m)"
native=0
case "$ARCH/$host" in aarch64/aarch64 | aarch64/arm64 | x86_64/x86_64 | arm/aarch64 | i686/x86_64) native=1 ;; esac
if [ "$native" = 0 ]; then
  qemu_arch="$ARCH"; [ "$ARCH" = i686 ] && qemu_arch=i386
  if ! [ -e "/proc/sys/fs/binfmt_misc/qemu-$qemu_arch" ]; then
    log "registering $ARCH CPU emulation (qemu, one time per boot)"
    docker run --privileged --rm tonistiigi/binfmt --install "$qemu_arch" >"$STATE/binfmt.log" 2>&1 || {
      # No Docker Hub access for that image: Ubuntu's qemu-user-static does the same.
      SUDO=""; [ "$(id -u)" = 0 ] || SUDO="sudo"
      $SUDO apt-get install -y -qq qemu-user-static >>"$STATE/binfmt.log" 2>&1 || true
      [ -d /proc/sys/fs/binfmt_misc ] && ! [ -e /proc/sys/fs/binfmt_misc/register ] &&
        $SUDO mount -t binfmt_misc binfmt_misc /proc/sys/fs/binfmt_misc 2>/dev/null || true
      conf="/usr/lib/binfmt.d/qemu-$qemu_arch.conf"
      [ -f "$conf" ] && $SUDO sh -c "cat '$conf' > /proc/sys/fs/binfmt_misc/register" 2>>"$STATE/binfmt.log" || true
    }
    [ -e "/proc/sys/fs/binfmt_misc/qemu-$qemu_arch" ] ||
      { echo "could not set up $ARCH emulation, see $STATE/binfmt.log (or use --arch $host)" >&2; exit 1; }
  fi
fi

# 2. The container (Termux's home lives in a volume so dependencies survive restarts).
[ "$FRESH" = 1 ] && { docker rm -f "$NAME" >/dev/null 2>&1 || true; docker volume rm "$VOLUME" >/dev/null 2>&1 || true; }
if [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" != true ]; then
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  CA_FILE="${TERMUX_QC_CA_FILE:-${NODE_EXTRA_CA_CERTS:-${SSL_CERT_FILE:-}}}"
  args=(-d --name "$NAME" --network host -v "$VOLUME:$HOME_DIR")
  [ "$native" = 0 ] && args+=(--platform "linux/$([ "$ARCH" = aarch64 ] && echo arm64 || echo "$ARCH")")
  for var in HTTPS_PROXY https_proxy HTTP_PROXY http_proxy NO_PROXY no_proxy; do
    [ -n "${!var:-}" ] && args+=(-e "$var=${!var}")
  done
  [ -n "$CA_FILE" ] && [ -f "$CA_FILE" ] && args+=(-v "$CA_FILE:/termux-qc-ca.crt:ro")
  # Docker Hub limits anonymous downloads per IP (shared CI and cloud IPs hit it); Google's mirror of it doesn't.
  if ! docker pull -q "$IMAGE" >/dev/null 2>&1 && ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    docker pull -q "mirror.gcr.io/$IMAGE" >/dev/null 2>&1 && docker tag "mirror.gcr.io/$IMAGE" "$IMAGE" ||
      { echo "could not download $IMAGE (Docker Hub rate limit? try again in a few minutes)" >&2; exit 1; }
  fi
  docker run "${args[@]}" "$IMAGE" sleep infinity >/dev/null
  # The image finishes its own setup on first start; the volume needs Termux's user to own it.
  docker exec "$NAME" chown system:system "$HOME_DIR"
  for _ in $(seq 120); do tx 'true' >/dev/null 2>&1 && break; sleep 1; done
  log "container $NAME up ($ARCH$([ "$native" = 0 ] && echo ", emulated"))"
fi

if [ "$ACTION" = shell ]; then
  exec docker exec -it -u system -w "$HOME_DIR/Marinara-Engine" "$NAME" "$PREFIX/bin/bash" -l
fi

# 3. Termux packages, like docs/installation/android-termux.md (pkg upgrade, then git and nodejs-lts).
if ! tx 'command -v node && command -v git' >/dev/null 2>&1; then
  log "installing Termux packages (git, nodejs-lts; one time)"
  tx "set -e
    if [ -f /termux-qc-ca.crt ] && ! grep -q termux-qc \$PREFIX/etc/tls/cert.pem; then
      { echo '# termux-qc'; cat /termux-qc-ca.crt; } >> \$PREFIX/etc/tls/cert.pem
    fi
    echo 'deb $MIRROR stable main' > \$PREFIX/etc/apt/sources.list
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -q
    apt-get -y -q -o Dpkg::Options::=--force-confold full-upgrade
    apt-get -y -q install git nodejs-lts" >"$STATE/packages-$ARCH.log" 2>&1 ||
    { tail -20 "$STATE/packages-$ARCH.log" >&2; echo "Termux package install failed, see $STATE/packages-$ARCH.log (is $MIRROR reachable?)" >&2; exit 1; }
fi
log "$(tx 'echo "Termux $(uname -m), Node $(node -v), $(git --version)"')"

# 4. This checkout (tracked and new files, not node_modules or other ignored files) into ~/Marinara-Engine.
log "copying this checkout into Termux"
tx 'mkdir -p ~/Marinara-Engine'
(cd "$ROOT" && git ls-files -z -co --exclude-standard | tar --null -T - -cf - 2>/dev/null) |
  docker exec -i -u system "$NAME" "$PREFIX/bin/tar" -C "$HOME_DIR/Marinara-Engine" -xf -
# The launcher's update check reads git; a copy has no .git, and --skip-update skips it anyway.

# 5. Start it with the real launcher and wait for the server.
# (The [s] keeps pkill/pgrep from matching their own command line.)
tx "pkill -f '[s]tart-termux.sh'; pkill -f '[r]un-server.mjs'; true" || true
CA_ENV=""
tx 'grep -q termux-qc $PREFIX/etc/tls/cert.pem' 2>/dev/null &&
  CA_ENV="npm_config_cafile=$PREFIX/etc/tls/cert.pem SSL_CERT_FILE=$PREFIX/etc/tls/cert.pem NODE_EXTRA_CA_CERTS=$PREFIX/etc/tls/cert.pem"
docker exec -d -u system "$NAME" "$PREFIX/bin/bash" -lc \
  "cd ~/Marinara-Engine && env PORT=$PORT HOST=127.0.0.1 $CA_ENV ./start-termux.sh --skip-update > ~/termux-qc-launch.log 2>&1"
log "running start-termux.sh (log: $LOG; first run installs and builds, $([ "$native" = 0 ] && echo "about 10 min emulated" || echo "a few minutes"))"
start=$(date +%s)
while :; do
  docker exec -u system "$NAME" cat "$HOME_DIR/termux-qc-launch.log" >"$LOG" 2>/dev/null || true
  if curl -fs -m 3 -o /dev/null "http://127.0.0.1:$PORT/api/health" || curl -fs -m 3 -o /dev/null "http://127.0.0.1:$PORT/"; then
    log "server up in Termux after $(( $(date +%s) - start ))s: http://localhost:$PORT"
    exit 0
  fi
  if ! tx "pgrep -f '[s]tart-termux.sh' >/dev/null"; then
    tail -40 "$LOG" >&2
    echo "start-termux.sh stopped before the server answered (full log: $LOG)" >&2
    exit 1
  fi
  if [ $(( $(date +%s) - start )) -gt $(( TIMEOUT_MIN * 60 )) ]; then
    tail -20 "$LOG" >&2
    echo "the server did not answer within $TIMEOUT_MIN min (TERMUX_QC_TIMEOUT_MIN; full log: $LOG)" >&2
    exit 1
  fi
  sleep 5
done
