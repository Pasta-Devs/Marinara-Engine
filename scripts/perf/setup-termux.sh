#!/usr/bin/env bash
# Termux QC: run this checkout the way Android users do, in real Termux (Termux's own Node.js, packages, Android libc
# and paths) inside Docker, with Marinara's own start-termux.sh. Catches install, update, build and launch problems that
# only happen on Termux, without an Android device or emulator. Uses termux/termux-docker (Termux's official image).
#
# One command, safe to re-run (the Termux home is kept in a Docker volume, so later runs only rebuild what changed):
#   scripts/perf/setup-termux.sh                 copy this checkout into Termux, run start-termux.sh --skip-update,
#                                                wait until the server answers on http://localhost:7861
#   scripts/perf/setup-termux.sh --from latest   update instead of installing: install a release the way users do
#                                                (a clone of main), give it a character, then let that release's own
#                                                start-termux.sh update it to this checkout, and check the server
#                                                runs the new build and the character is still there. Takes a tag
#                                                (--from v2.5.1) or "latest" (the newest release)
#   scripts/perf/setup-termux.sh --memory 4g     cap the container's memory like a phone's RAM (start-termux.sh sizes
#                                                Node's heap from it); emulated runs need more than a phone would
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
# Logs: $TERMUX_QC_DIR (default /tmp/termux-qc)/launch-<arch>.log (and update-<arch>.log with --from). Behind a
# TLS-inspecting proxy, set TERMUX_QC_CA_FILE to its CA bundle (NODE_EXTRA_CA_CERTS or SSL_CERT_FILE are used when set).
# Termux's package mirror must be reachable: packages-cf.termux.dev (allow it in sandboxed cloud environments).
#
# Like Android, the container refuses hard links ("Permission denied"); pnpm can't install a local folder dependency
# without them (#9530).
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
FROM=""
MEMORY=""
TIMEOUT_MIN="${TERMUX_QC_TIMEOUT_MIN:-60}"
MIRROR="${TERMUX_QC_MIRROR:-https://packages-cf.termux.dev/apt/termux-main}"
REPO_URL="${TERMUX_QC_REPO:-https://github.com/Pasta-Devs/Marinara-Engine.git}"

while [ $# -gt 0 ]; do
  case "$1" in
    --arch) ARCH="$2"; shift ;;
    --port) PORT="$2"; shift ;;
    --from) FROM="$2"; shift ;;
    --memory) MEMORY="$2"; shift ;;
    --fresh) FRESH=1 ;;
    --shell) ACTION=shell ;;
    --stop) ACTION=stop ;;
    -h | --help) sed -n '2,34p' "$0"; exit 0 ;;
    *) echo "Unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
case "$ARCH" in aarch64 | x86_64 | arm | i686) ;; *) echo "--arch must be aarch64, x86_64, arm or i686" >&2; exit 2 ;; esac
[ -z "$MEMORY" ] || [[ "$MEMORY" =~ ^[0-9]+[mMgG]$ ]] || { echo "--memory takes a size such as 4g or 3072m" >&2; exit 2; }

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
[ -z "$FROM" ] || command -v node >/dev/null || { echo "--from needs Node.js on this machine to read the server's replies" >&2; exit 1; }
# Android has no /bin/sh or /usr/bin/env. On a phone the Termux app preloads termux-exec, which runs those #! lines with
# Termux's own programs (pnpm's bin shims start with #!/bin/sh); the image doesn't, so every command here does.
exec_env=()
find_termux_exec() {
  local lib
  lib="$(docker exec -u system "$NAME" "$PREFIX/bin/sh" -c \
    "ls $PREFIX/lib/libtermux-exec-ld-preload.so $PREFIX/lib/libtermux-exec.so 2>/dev/null | head -1" || true)"
  exec_env=()
  [ -z "$lib" ] || exec_env=(-e "LD_PRELOAD=$lib")
}
tx() { docker exec -i -u system ${exec_env[@]+"${exec_env[@]}"} "$NAME" "$PREFIX/bin/bash" -lc "$1"; }

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
# Android doesn't let apps create hard links (SELinux answers EACCES, "Permission denied"); Linux does. This syscall
# filter refuses them the same way. It replaces Docker's default filter, which is fine for a throwaway container that
# runs only this checkout and Termux.
SECCOMP='{"defaultAction":"SCMP_ACT_ALLOW","syscalls":[{"names":["link","linkat"],"action":"SCMP_ACT_ERRNO","errnoRet":13}]}'
# The memory cap and the filter are set when the container is created, so a different --memory or filter (including
# a container from before the filter) needs a new container.
CONFIG="memory=$MEMORY seccomp=$SECCOMP"
if [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" = true ] &&
  [ "$(docker inspect -f '{{index .Config.Labels "termux-qc-config"}}' "$NAME" 2>/dev/null)" != "$CONFIG" ]; then
  log "recreating the container (--memory ${MEMORY:-none}, hard links refused); the Termux home volume stays"
  docker rm -f "$NAME" >/dev/null 2>&1 || true
fi
if [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" != true ]; then
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  CA_FILE="${TERMUX_QC_CA_FILE:-${NODE_EXTRA_CA_CERTS:-${SSL_CERT_FILE:-}}}"
  args=(-d --name "$NAME" --network host -v "$VOLUME:$HOME_DIR" --label "termux-qc-config=$CONFIG")
  printf '%s\n' "$SECCOMP" >"$STATE/android-seccomp.json"
  args+=(--security-opt "seccomp=$STATE/android-seccomp.json")
  [ "$native" = 0 ] && args+=(--platform "linux/$([ "$ARCH" = aarch64 ] && echo arm64 || echo "$ARCH")")
  for var in HTTPS_PROXY https_proxy HTTP_PROXY http_proxy NO_PROXY no_proxy; do
    [ -n "${!var:-}" ] && args+=(-e "$var=${!var}")
  done
  [ -n "$CA_FILE" ] && [ -f "$CA_FILE" ] && args+=(-v "$CA_FILE:/termux-qc-ca.crt:ro")
  if [ -n "$MEMORY" ]; then
    # In a container /proc/meminfo shows this machine's RAM, and start-termux.sh sizes Node's heap from it, so the
    # container gets one that shows the cap (Docker allows mounting over /proc/meminfo, as LXCFS does).
    kib=$(( ${MEMORY%[mMgG]} * $(case "${MEMORY: -1}" in [gG]) echo 1048576 ;; *) echo 1024 ;; esac) ))
    printf 'MemTotal: %s kB\nMemFree: %s kB\nMemAvailable: %s kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n' \
      "$kib" "$kib" "$kib" >"$STATE/meminfo-$ARCH"
    args+=(--memory "$MEMORY" --memory-swap "$MEMORY" -v "$STATE/meminfo-$ARCH:/proc/meminfo:ro")
  fi
  # Docker Hub limits anonymous downloads per IP (shared CI and cloud IPs hit it); Google's mirror of it doesn't.
  if ! docker pull -q "$IMAGE" >/dev/null 2>&1 && ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    docker pull -q "mirror.gcr.io/$IMAGE" >/dev/null 2>&1 && docker tag "mirror.gcr.io/$IMAGE" "$IMAGE" ||
      { echo "could not download $IMAGE (Docker Hub rate limit? try again in a few minutes)" >&2; exit 1; }
  fi
  docker run "${args[@]}" "$IMAGE" sleep infinity >/dev/null
  # The image finishes its own setup on first start; the volume needs Termux's user to own it.
  docker exec "$NAME" chown system:system "$HOME_DIR"
  for _ in $(seq 120); do tx 'true' >/dev/null 2>&1 && break; sleep 1; done
  log "container $NAME up ($ARCH$([ "$native" = 0 ] && echo ", emulated")${MEMORY:+, $MEMORY memory})"
fi

if [ "$ACTION" = shell ]; then
  find_termux_exec
  exec docker exec -it -u system ${exec_env[@]+"${exec_env[@]}"} -w "$HOME_DIR/Marinara-Engine" "$NAME" "$PREFIX/bin/bash" -l
fi

# 3. Termux packages, like docs/installation/android-termux.md (pkg upgrade, then git and nodejs-lts).
if ! tx 'command -v node && command -v git && ls $PREFIX/lib/libtermux-exec*.so' >/dev/null 2>&1; then
  log "installing Termux packages (git, nodejs-lts, termux-exec; one time)"
  tx "set -e
    if [ -f /termux-qc-ca.crt ] && ! grep -q termux-qc \$PREFIX/etc/tls/cert.pem; then
      { echo '# termux-qc'; cat /termux-qc-ca.crt; } >> \$PREFIX/etc/tls/cert.pem
    fi
    echo 'deb $MIRROR stable main' > \$PREFIX/etc/apt/sources.list
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -q
    apt-get -y -q -o Dpkg::Options::=--force-confold full-upgrade
    apt-get -y -q install git nodejs-lts termux-exec" >"$STATE/packages-$ARCH.log" 2>&1 ||
    { tail -20 "$STATE/packages-$ARCH.log" >&2; echo "Termux package install failed, see $STATE/packages-$ARCH.log (is $MIRROR reachable?)" >&2; exit 1; }
fi
find_termux_exec
[ ${#exec_env[@]} -gt 0 ] || { echo "termux-exec is missing from the container (see $STATE/packages-$ARCH.log)" >&2; exit 1; }
log "$(tx 'echo "Termux $(uname -m), Node $(node -v), $(git --version), ${LD_PRELOAD##*/}"')"

CA_ENV=""
tx 'grep -q termux-qc $PREFIX/etc/tls/cert.pem' 2>/dev/null &&
  CA_ENV="npm_config_cafile=$PREFIX/etc/tls/cert.pem SSL_CERT_FILE=$PREFIX/etc/tls/cert.pem NODE_EXTRA_CA_CERTS=$PREFIX/etc/tls/cert.pem"

# Copies this checkout (tracked and new files, not node_modules or other ignored files) into a Termux folder.
copy_checkout() {
  tx "mkdir -p ~/$1"
  (cd "$ROOT" && git ls-files -z -co --exclude-standard | tar --null -T - -cf - 2>/dev/null) |
    docker exec -i -u system "$NAME" "$PREFIX/bin/tar" -C "$HOME_DIR/$1" -xf -
}

# Stops Marinara in the container and waits until its port is free.
# (The [s] keeps pkill/pgrep from matching their own command line.)
stop_marinara() {
  tx "pkill -f '[s]tart-termux.sh'; pkill -f '[r]un-server.mjs'; pkill -f '[p]ackages/server/dist'; true" || true
  for _ in $(seq 60); do
    curl -fs -m 2 -o /dev/null "http://127.0.0.1:$PORT/api/health" || return 0
    sleep 1
  done
  echo "the server on port $PORT did not stop" >&2
  exit 1
}

# Starts the real launcher in ~/Marinara-Engine with the given arguments (and $launch_env) and waits for the server.
launch_env=""
launch() {
  local launch_log="$1"
  shift
  stop_marinara
  docker exec -d -u system "${exec_env[@]}" "$NAME" "$PREFIX/bin/bash" -lc \
    "cd ~/Marinara-Engine && env PORT=$PORT HOST=127.0.0.1 $CA_ENV $launch_env ./start-termux.sh $* > ~/termux-qc-launch.log 2>&1"
  log "running start-termux.sh $* (log: $launch_log; a first install or an update builds, $([ "$native" = 0 ] && echo "about 10 min emulated" || echo "a few minutes"))"
  local start
  start=$(date +%s)
  while :; do
    docker exec -u system "$NAME" cat "$HOME_DIR/termux-qc-launch.log" >"$launch_log" 2>/dev/null || true
    if curl -fs -m 3 -o /dev/null "http://127.0.0.1:$PORT/api/health" || curl -fs -m 3 -o /dev/null "http://127.0.0.1:$PORT/"; then
      log "server up in Termux after $(( $(date +%s) - start ))s: http://localhost:$PORT"
      return 0
    fi
    if ! tx "pgrep -f '[s]tart-termux.sh' >/dev/null"; then
      tail -40 "$launch_log" >&2
      echo "start-termux.sh stopped before the server answered (full log: $launch_log)" >&2
      exit 1
    fi
    if [ $(( $(date +%s) - start )) -gt $(( TIMEOUT_MIN * 60 )) ]; then
      tail -20 "$launch_log" >&2
      echo "the server did not answer within $TIMEOUT_MIN min (TERMUX_QC_TIMEOUT_MIN; full log: $launch_log)" >&2
      exit 1
    fi
    sleep 5
  done
}

# Prints one field of the JSON on stdin (a character's `data` may arrive as a JSON string).
json_field() {
  node -e 'let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      let value = JSON.parse(s);
      for (const key of process.argv[1].split(".")) value = typeof value === "string" ? JSON.parse(value)[key] : value?.[key];
      process.stdout.write(value == null ? "" : String(value));
    });' "$1"
}

if [ -z "$FROM" ]; then
  # 4. This checkout into ~/Marinara-Engine. The launcher's update check reads git; a copy has no .git, and
  # --skip-update skips it anyway.
  # The folder starts over (dependencies download again) when its leftovers are unknown: a folder an update check left
  # is a git clone of the release, whose launcher would clean this checkout's new files from packages/*/src as stray,
  # and a folder copied before the copied-files list existed may hold another branch's files.
  stop_marinara
  # (.termux-qc-files.txt is the list's earlier, newline-separated name.)
  tx '[ -f ~/.termux-qc-files ] && [ ! -d ~/Marinara-Engine/.git ] || rm -rf ~/Marinara-Engine ~/.termux-qc-files ~/.termux-qc-files.txt'
  log "copying this checkout into Termux"
  # Leave nothing behind from an earlier copy either (another branch's files would end up in the build): delete the
  # files the last copy brought that this checkout no longer has. Dependencies, builds and data stay, so later runs
  # stay quick. The lists are NUL-separated, so every file name survives the trip unchanged.
  (cd "$ROOT" && git ls-files -z -co --exclude-standard | LC_ALL=C sort -zu) >"$STATE/files-$ARCH"
  tx 'cat > ~/.termux-qc-files.new' <"$STATE/files-$ARCH"
  tx 'mkdir -p ~/Marinara-Engine && cd ~/Marinara-Engine
    if [ -f ~/.termux-qc-files ]; then
      LC_ALL=C comm -z -23 ~/.termux-qc-files ~/.termux-qc-files.new | while IFS= read -r -d "" f; do rm -f -- "$f"; done
    fi
    mv ~/.termux-qc-files.new ~/.termux-qc-files'
  copy_checkout Marinara-Engine
  # 5. Start it with the real launcher and wait for the server.
  launch "$LOG" --skip-update
  exit 0
fi

# 4. Update mode. A local stand-in for GitHub serves the release as main, the way users clone it; after the release is
# running with a character in it, this checkout becomes the next commit on main, and the release's own
# start-termux.sh updates to it like it does for users.
UPDATE_LOG="$STATE/update-$ARCH.log"
if [ "$FROM" = latest ]; then
  FROM="$(git ls-remote --tags --refs "$REPO_URL" 'v*' | sed 's#.*refs/tags/##' |
    grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 || true)"
  [ -n "$FROM" ] || { echo "could not find the latest release tag at $REPO_URL" >&2; exit 1; }
fi
log "installing $FROM the way users do, then updating it to this checkout"
stop_marinara
tx "set -e
  rm -rf ~/Marinara-Engine ~/termux-qc-origin.git ~/termux-qc-target ~/.termux-qc-files ~/.termux-qc-files.txt
  git init -q --bare -b main ~/termux-qc-origin.git
  cd ~/termux-qc-origin.git
  git config receive.shallowUpdate true
  git fetch -q --depth 1 '$REPO_URL' 'refs/tags/$FROM:refs/tags/$FROM'
  git update-ref refs/heads/main '$FROM^{commit}'
  git clone -q ~/termux-qc-origin.git ~/Marinara-Engine" >"$UPDATE_LOG" 2>&1 ||
  { tail -20 "$UPDATE_LOG" >&2; echo "could not install $FROM (see $UPDATE_LOG)" >&2; exit 1; }

# The release's own update check finds main unchanged. Installing it is only the setup, so it gets the 2 GiB heap from
# the workaround users were given: a release can need more than the launcher's default to build (v2.5.2's shared
# type-check does, #8902). The update below runs with the launcher's own settings.
launch_env="NODE_OPTIONS=--max-old-space-size=2048"
launch "$STATE/launch-$ARCH-$FROM.log"
launch_env=""
character_name="Termux QC update check"
character_id="$(curl -fsS -m 60 -H "Origin: http://127.0.0.1:$PORT" -H 'Content-Type: application/json' \
  -d "{\"data\":{\"name\":\"$character_name\"}}" "http://127.0.0.1:$PORT/api/characters" | json_field id)"
[ -n "$character_id" ] || { echo "could not create a character on $FROM" >&2; exit 1; }
log "created a character on $FROM ($character_id)"
stop_marinara

log "publishing this checkout as the next commit on main"
copy_checkout termux-qc-target
# add -f: the folder holds only files this checkout tracks or would track, some of them under ignored paths.
target="$(tx "set -e
  cd ~/termux-qc-target
  git init -q -b main .
  git fetch -q --depth 1 ~/termux-qc-origin.git main
  git update-ref refs/heads/main FETCH_HEAD
  git add -A -f
  git -c user.name=termux-qc -c user.email=termux-qc@localhost commit -q --allow-empty -m 'This checkout (termux-qc)'
  git push -q ~/termux-qc-origin.git main
  git rev-parse HEAD" 2>>"$UPDATE_LOG")" ||
  { tail -20 "$UPDATE_LOG" >&2; echo "could not publish this checkout (see $UPDATE_LOG)" >&2; exit 1; }

launch "$LOG"
head="$(tx 'git -C ~/Marinara-Engine rev-parse HEAD')"
if [ "$head" != "$target" ]; then
  tail -40 "$LOG" >&2
  echo "start-termux.sh from $FROM did not update to this checkout: HEAD is $head, expected $target (full log: $LOG)" >&2
  exit 1
fi
built="$(curl -fsS -m 30 "http://127.0.0.1:$PORT/api/health" | json_field commit)"
if [ -z "$built" ] || [ "${target#"$built"}" = "$target" ]; then
  echo "the server is not running this checkout's build: it reports commit '$built', expected $target" >&2
  exit 1
fi
kept="$(curl -fsS -m 30 "http://127.0.0.1:$PORT/api/characters/$character_id" | json_field data.name)"
if [ "$kept" != "$character_name" ]; then
  echo "the character created on $FROM did not survive the update (got '$kept')" >&2
  exit 1
fi
log "update from $FROM worked: the server runs this checkout's build ($built) and kept the character from $FROM"
