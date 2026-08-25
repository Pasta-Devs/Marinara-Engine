#!/data/data/com.termux/files/usr/bin/bash
# ──────────────────────────────────────────────
# Marinara Engine — Start Script (Termux / Android)
# ──────────────────────────────────────────────
set -e

MARINARA_TERMUX_LOG_DIR="$HOME/.marinara-engine/logs"
MARINARA_TERMUX_LOG_FILE=""
MARINARA_TERMUX_LOG_TEE_PID=""
if mkdir -p "$MARINARA_TERMUX_LOG_DIR"; then
    if chmod 700 "$MARINARA_TERMUX_LOG_DIR" 2>/dev/null; then
        find "$MARINARA_TERMUX_LOG_DIR" -type f -name 'server-*.log' -mtime +14 -delete 2>/dev/null || true
        MARINARA_TERMUX_LOG_FILE="$MARINARA_TERMUX_LOG_DIR/server-$(date '+%Y%m%d-%H%M%S')-$$.log"
        if command -v tee >/dev/null 2>&1 && touch "$MARINARA_TERMUX_LOG_FILE" && chmod 600 "$MARINARA_TERMUX_LOG_FILE" 2>/dev/null; then
            exec 3>&1 4>&2
            exec > >(tee -a "$MARINARA_TERMUX_LOG_FILE") 2>&1
            MARINARA_TERMUX_LOG_TEE_PID=$!
            echo "  [OK] Persistent launcher/server log: $MARINARA_TERMUX_LOG_FILE"
        else
            echo "  [WARN] Could not create a restrictively permissioned Termux session log." >&2
            rm -f "$MARINARA_TERMUX_LOG_FILE"
            MARINARA_TERMUX_LOG_FILE=""
        fi
    else
        echo "  [WARN] Could not restrict permissions on $MARINARA_TERMUX_LOG_DIR; this session will not have a persistent log." >&2
    fi
else
    echo "  [WARN] Could not create $MARINARA_TERMUX_LOG_DIR; this session will not have a persistent log." >&2
fi

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   Marinara Engine  —  Termux Launcher    ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# Navigate to script directory
cd "$(dirname "$0")"

# APK-managed installs provision a per-install secret in Termux-private
# storage. The server uses it to keep unrelated Android apps from inheriting
# loopback trust; manual Termux installs simply continue without this setting.
MARINARA_ANDROID_SECRET_FILE="${MARINARA_ANDROID_SECRET_FILE:-$HOME/.marinara-engine/android-secret}"
MARINARA_ANDROID_SECRET_REQUIRED=0
if [ -f "$MARINARA_ANDROID_SECRET_FILE" ]; then
    MARINARA_ANDROID_SECRET_REQUIRED=1
    if [ -z "${MARINARA_ANDROID_SECRET:-}" ]; then
        IFS= read -r MARINARA_ANDROID_SECRET < "$MARINARA_ANDROID_SECRET_FILE" || true
    fi
fi
if [ -n "${MARINARA_ANDROID_SECRET:-}" ]; then
    if [ "${#MARINARA_ANDROID_SECRET}" -ne 64 ] || [[ "$MARINARA_ANDROID_SECRET" == *[!0-9a-fA-F]* ]]; then
        echo "  [ERROR] The Android local-auth secret is invalid. Re-run setup from the Marinara Android app."
        if [ "$MARINARA_ANDROID_SECRET_REQUIRED" = "1" ]; then
            exit 1
        fi
        unset MARINARA_ANDROID_SECRET
    else
        chmod 600 "$MARINARA_ANDROID_SECRET_FILE" 2>/dev/null || true
        export MARINARA_ANDROID_SECRET
    fi
elif [ "$MARINARA_ANDROID_SECRET_REQUIRED" = "1" ]; then
    echo "  [ERROR] The Android local-auth secret is empty. Re-run setup from the Marinara Android app."
    exit 1
fi

SKIP_UPDATE=0
for arg in "$@"; do
    case "$arg" in
        --skip-update|--no-update)
            SKIP_UPDATE=1
            ;;
        -h|--help)
            echo "Usage: ./start-termux.sh [--skip-update]"
            echo ""
            echo "  ./start-termux.sh               Check for updates, then start Marinara Engine"
            echo "  ./start-termux.sh --skip-update Start the current local install without checking for updates"
            exit 0
            ;;
        *)
            echo "  [ERROR] Unknown option: $arg"
            echo "          Run ./start-termux.sh --help for usage."
            exit 1
            ;;
    esac
done

# ── Ensure required Termux packages ──
for pkg_name in git; do
    if ! dpkg -s "$pkg_name" &> /dev/null; then
        echo "  [..] Installing $pkg_name..."
        pkg install -y -o Dpkg::Options::="--force-confold" "$pkg_name" 2>/dev/null || true
    fi
done

# ── Fix platform detection for native binaries ──
# Node.js 24+ on Termux reports process.platform = "android", but Termux uses
# the Linux kernel and Linux ARM64 native binaries work perfectly. Tell pnpm to
# install both android AND linux optional dependencies so build tools like
# rollup, lightningcss, and tailwindcss oxide resolve correctly.
# Run early so the auto-update's pnpm install also benefits.
NODE_PLAT=$(node -e "process.stdout.write(process.platform)" 2>/dev/null || echo "")
if [ "$NODE_PLAT" = "android" ]; then
    NPMRC_MARKER="# termux-supported-architectures"
    if ! grep -q "$NPMRC_MARKER" .npmrc 2>/dev/null; then
        NODE_ARCH=$(node -e "process.stdout.write(process.arch)" 2>/dev/null || echo "")
        echo "  [OK] Detected Android/Termux (${NODE_ARCH:-unknown}) — enabling Linux binaries"
        {
            echo "$NPMRC_MARKER"
            echo "supportedArchitectures.os[]=current"
            echo "supportedArchitectures.os[]=linux"
            echo "supportedArchitectures.cpu[]=current"
            [ -n "$NODE_ARCH" ] && echo "supportedArchitectures.cpu[]=$NODE_ARCH"
        } >> .npmrc
        # Force pnpm to re-resolve optional deps on next install
        TERMUX_FORCE_INSTALL=1
    fi
    # Ensure wasm32 is supported (required for sharp fallback on some Android devices)
    if ! grep -q "supportedArchitectures.cpu\[\]=wasm32" .npmrc 2>/dev/null; then
        echo "supportedArchitectures.cpu[]=wasm32" >> .npmrc
        TERMUX_FORCE_INSTALL=1
    fi
fi

# ── Check Node.js ──
if ! command -v node &> /dev/null || ! node -v &> /dev/null; then
    echo "  [..] Node.js not found or broken — installing via pkg..."
    pkg install -y -o Dpkg::Options::="--force-confold" nodejs-lts
fi

if ! NODE_VERSION=$(node -v 2>/dev/null | cut -d'.' -f1 | tr -d 'v'); then
    echo "  [ERR] Node.js is still not working after install."
    echo "        Try:  pkg upgrade && pkg install nodejs-lts"
    exit 1
fi

if [ -z "$NODE_VERSION" ]; then
    echo "  [ERR] Could not determine Node.js version."
    echo "        Try:  pkg upgrade && pkg install nodejs-lts"
    exit 1
fi

echo "  [OK] Node.js $(node -v) found"

if [ "$NODE_VERSION" -lt 24 ]; then
    echo "  [..] Node.js 24 LTS or newer is required. You have v${NODE_VERSION}; upgrading nodejs-lts..."
    pkg upgrade -y -o Dpkg::Options::="--force-confold" nodejs-lts || pkg install -y -o Dpkg::Options::="--force-confold" nodejs-lts
    if ! NODE_VERSION=$(node -v 2>/dev/null | cut -d'.' -f1 | tr -d 'v'); then
        echo "  [ERR] Node.js is still not working after upgrade."
        echo "        Try:  pkg upgrade && pkg install nodejs-lts"
        exit 1
    fi
    if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 24 ]; then
        echo "  [ERR] Node.js 24 LTS or newer is required. Current version: $(node -v 2>/dev/null || echo unknown)"
        echo "        Try:  pkg upgrade && pkg install nodejs-lts"
        exit 1
    fi
    echo "  [OK] Node.js $(node -v) ready"
fi

# Large profiles can exceed Node's conservative mobile heap limit while the
# file-backed store serializes them. Keep an explicit operator limit, otherwise
# choose a bounded default from the profile size and available device memory.
has_explicit_node_heap_limit() {
    local node_options_value="${NODE_OPTIONS:-}"
    NODE_OPTIONS= NODE_OPTIONS_VALUE="$node_options_value" node <<'NODE_OPTIONS_PARSER'
const input = process.env.NODE_OPTIONS_VALUE ?? "";
const tokens = [];
let token = "";
let quote = null;
let escaped = false;
for (const character of input) {
  if (escaped) {
    token += character;
    escaped = false;
  } else if (character === "\\" && quote !== "'") {
    escaped = true;
  } else if (quote) {
    if (character === quote) quote = null;
    else token += character;
  } else if (character === '"' || character === "'") {
    quote = character;
  } else if (/\s/u.test(character)) {
    if (token) tokens.push(token);
    token = "";
  } else {
    token += character;
  }
}
if (escaped) token += "\\";
if (token) tokens.push(token);

const heapOption = /^--max(?:-|_)old(?:-|_)space(?:-|_)size(?:=(.*))?$/u;
const hasHeapLimit = tokens.some((value, index) => {
  const match = heapOption.exec(value);
  if (!match) return false;
  const size = match[1] ?? tokens[index + 1] ?? "";
  return /^\d+$/u.test(size) && Number(size) > 0;
});
process.exit(hasHeapLimit ? 0 : 1);
NODE_OPTIONS_PARSER
}

resolve_default_node_heap_mb() {
    local profile_storage_kib="${1:-0}"
    local device_memory_kib="${2:-0}"
    case "$profile_storage_kib" in *[!0-9]*|"") profile_storage_kib=0 ;; esac
    case "$device_memory_kib" in *[!0-9]*|"") device_memory_kib=0 ;; esac

    # Allow about 512 MiB above the on-disk structured profile, rounded to a
    # stable 128 MiB step. Media lives outside storage and does not inflate it.
    local heap_mb=$(( (profile_storage_kib + 1023) / 1024 + 512 ))
    heap_mb=$(( (heap_mb + 127) / 128 * 128 ))
    [ "$heap_mb" -lt 1024 ] && heap_mb=1024
    [ "$heap_mb" -gt 1536 ] && heap_mb=1536

    # On smaller phones, retain at least the safe 1 GiB baseline but avoid
    # granting a large profile more than roughly one quarter of physical RAM.
    if [ "$device_memory_kib" -gt 0 ]; then
        local device_cap_mb=$(( device_memory_kib / 1024 / 4 / 128 * 128 ))
        if [ "$device_cap_mb" -ge 1024 ] && [ "$heap_mb" -gt "$device_cap_mb" ]; then
            heap_mb="$device_cap_mb"
        fi
    fi
    printf '%s' "$heap_mb"
}

load_launcher_setting() {
    local setting_name="$1"
    local setting_value
    if setting_value=$(node scripts/read-launcher-env.mjs .env "$setting_name"); then
        printf -v "$setting_name" '%s' "$setting_value"
        export "$setting_name"
    fi
}

# Read only settings used by this launcher. The server loads every other .env
# value itself. Node parses these as inert dotenv data; no shell code is sourced.
if [ -f .env ]; then
    for setting_name in AUTO_UPDATE_ENABLED PORT HOST SSL_CERT SSL_KEY AUTO_OPEN_BROWSER DATA_DIR; do
        load_launcher_setting "$setting_name"
    done
fi

if ! has_explicit_node_heap_limit; then
    MARINARA_TERMUX_DATA_DIR="${DATA_DIR:-./data}"
    case "$MARINARA_TERMUX_DATA_DIR" in
        /*) MARINARA_TERMUX_STORAGE_DIR="$MARINARA_TERMUX_DATA_DIR/storage" ;;
        *) MARINARA_TERMUX_STORAGE_DIR="$PWD/packages/server/$MARINARA_TERMUX_DATA_DIR/storage" ;;
    esac
    MARINARA_TERMUX_PROFILE_STORAGE_KIB=$(du -sk "$MARINARA_TERMUX_STORAGE_DIR" 2>/dev/null | awk '{print $1}' || true)
    MARINARA_TERMUX_DEVICE_MEMORY_KIB=$(awk '/^MemTotal:/ { print $2; exit }' /proc/meminfo 2>/dev/null || true)
    MARINARA_TERMUX_HEAP_MB=$(resolve_default_node_heap_mb "$MARINARA_TERMUX_PROFILE_STORAGE_KIB" "$MARINARA_TERMUX_DEVICE_MEMORY_KIB")
    NODE_OPTIONS="${NODE_OPTIONS:+${NODE_OPTIONS} }--max-old-space-size=${MARINARA_TERMUX_HEAP_MB}"
    export NODE_OPTIONS
    echo "  [OK] Node.js heap limit set to ${MARINARA_TERMUX_HEAP_MB} MiB for this profile and device"
fi

AUTO_UPDATE_ENABLED_NORMALIZED=$(printf '%s' "${AUTO_UPDATE_ENABLED:-true}" | tr '[:upper:]' '[:lower:]' | tr -d '\r ')
case "$AUTO_UPDATE_ENABLED_NORMALIZED" in
  0|false|no|off) AUTO_UPDATE_DISABLED=1 ;;
  *) AUTO_UPDATE_DISABLED=0 ;;
esac

# ── Check pnpm ──
PNPM_VERSION=""
PNPM_DESCRIPTOR=""
PNPM_RUNNER="pnpm"
CURRENT_PNPM_VERSION=""

run_pnpm() {
    if [ "$PNPM_RUNNER" = "corepack" ]; then
        corepack "pnpm@${PNPM_DESCRIPTOR}" --config.trustPolicy=off --config.confirmModulesPurge=false "$@"
    elif [ "$PNPM_RUNNER" = "npx" ]; then
        npx --yes "pnpm@${PNPM_VERSION}" --config.trustPolicy=off --config.confirmModulesPurge=false "$@"
    else
        pnpm --config.trustPolicy=off --config.confirmModulesPurge=false "$@"
    fi
}

prune_pnpm_store() {
    # The Android install deliberately keeps its pnpm store inside the checkout.
    # Old releases otherwise accumulate there indefinitely and can consume several
    # gigabytes even though the built application itself is comparatively small.
    echo "  [..] Reclaiming dependency cache space from older releases..."
    if ! run_pnpm store prune >/dev/null 2>&1; then
        echo "  [WARN] Could not prune the pnpm store; continuing without removing cached packages."
    fi
}

install_workspace_dependencies() {
    # Avoid --force here. On constrained Android devices it recreates the entire
    # virtual store and may download optional binaries for platforms we cannot run.
    # Termux provides a global libvips but no Android NDK; Sharp must use its
    # supported WebAssembly fallback rather than attempting a native source build.
    SHARP_IGNORE_GLOBAL_LIBVIPS=1 run_pnpm install --frozen-lockfile --prefer-offline
}

resolve_pnpm_runner() {
    PNPM_DESCRIPTOR=$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).packageManager?.replace(/^pnpm@/, '') || ''" 2>/dev/null || true)
    if [ -z "$PNPM_DESCRIPTOR" ]; then
        echo "  [ERROR] Could not read the pinned pnpm descriptor from package.json."
        return 1
    fi
    PNPM_VERSION=${PNPM_DESCRIPTOR%%+*}
    if [ -z "$PNPM_VERSION" ]; then
        echo "  [ERROR] The pinned pnpm descriptor in package.json has no version."
        return 1
    fi
    PNPM_RUNNER="pnpm"
    CURRENT_PNPM_VERSION=""

    if command -v corepack &> /dev/null; then
        echo "  [..] Aligning pnpm to ${PNPM_VERSION} via Corepack..."
        CURRENT_PNPM_VERSION=$(corepack "pnpm@${PNPM_DESCRIPTOR}" --version 2>/dev/null || true)
        if [ "$CURRENT_PNPM_VERSION" = "$PNPM_VERSION" ]; then
            PNPM_RUNNER="corepack"
        else
            CURRENT_PNPM_VERSION=""
        fi
    fi

    if [ -z "$CURRENT_PNPM_VERSION" ] && command -v pnpm &> /dev/null; then
        CURRENT_PNPM_VERSION=$(pnpm --version 2>/dev/null || true)
        if [ "$CURRENT_PNPM_VERSION" = "$PNPM_VERSION" ]; then
            echo "  [..] Using installed pnpm ${CURRENT_PNPM_VERSION}"
        else
            if [ -n "$CURRENT_PNPM_VERSION" ]; then
                echo "  [..] Installed pnpm ${CURRENT_PNPM_VERSION} does not match required ${PNPM_VERSION}; trying a pinned temporary runner..."
            fi
            CURRENT_PNPM_VERSION=""
        fi
    fi

    if [ -z "$CURRENT_PNPM_VERSION" ]; then
        echo "  [..] Using temporary pnpm ${PNPM_VERSION} via npx..."
        CURRENT_PNPM_VERSION=$(npx --yes "pnpm@${PNPM_VERSION}" --version 2>/dev/null || true)
        if [ "$CURRENT_PNPM_VERSION" = "$PNPM_VERSION" ]; then
            PNPM_RUNNER="npx"
        else
            CURRENT_PNPM_VERSION=""
        fi
    fi

    if [ -z "$CURRENT_PNPM_VERSION" ]; then
        echo "  [ERROR] Failed to make pnpm ${PNPM_VERSION} available."
        return 1
    fi
    echo "  [OK] pnpm ${CURRENT_PNPM_VERSION} ready"
}

resolve_pnpm_runner || exit 1

restore_stashed_changes() {
    if [ "$STASHED" != "1" ] || [ -z "$STASH_REF" ]; then
        return 0
    fi

    if git stash apply -q "$STASH_REF" 2>/dev/null; then
        git stash drop -q "$STASH_REF" 2>/dev/null || true
        return 0
    fi

    echo "  [WARN] Auto-update could not reapply your local changes cleanly."
    echo "         Your changes are preserved in ${STASH_REF}."
    echo "         Review them with: git stash show -p ${STASH_REF}"
    echo "         Reapply them manually with: git stash pop ${STASH_REF}"
    git reset --hard HEAD >/dev/null 2>&1 || true
    return 1
}

has_git_worktree_changes() {
    ! git diff --quiet 2>/dev/null \
        || ! git diff --cached --quiet 2>/dev/null \
        || [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]
}

# Drop untracked leftovers in the source trees (files a failed checkout could not
# delete after a channel switch); they break tsc. This is working-tree repair,
# not an update, so it runs even when auto-update is disabled -- and before
# "stash push -u", which would otherwise capture the stale file and restore it
# again after every update. Not quiet: git prints "Removing <path>" only when it
# deletes something.
CLEAN_FAILED=0
if [ -d ".git" ]; then
    if ! git clean -fd -- packages/shared/src packages/server/src packages/client/src 2>/dev/null; then
        CLEAN_FAILED=1
    fi
fi

# ── Auto-update from Git ──
if [ "$SKIP_UPDATE" = "1" ]; then
    echo "  [OK] Skipping update check; starting the current local install."
elif [ "$AUTO_UPDATE_DISABLED" = "1" ]; then
    echo "  [OK] Automatic Engine updates disabled by AUTO_UPDATE_ENABLED=false."
    node scripts/check-launcher-update.mjs
elif [ -d ".git" ]; then
    echo "  [..] Checking for updates..."
    OLD_HEAD=$(git rev-parse HEAD 2>/dev/null)
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || true)
    TARGET_BRANCH="main"
    if [ "$CURRENT_BRANCH" = "staging" ]; then
        TARGET_BRANCH="staging"
    elif [ -z "$CURRENT_BRANCH" ]; then
        git fetch origin \
            "+refs/heads/main:refs/remotes/origin/main" \
            "+refs/heads/staging:refs/remotes/origin/staging" \
            --quiet 2>/dev/null || true
        if git merge-base --is-ancestor HEAD origin/staging 2>/dev/null \
            && ! git merge-base --is-ancestor HEAD origin/main 2>/dev/null; then
            TARGET_BRANCH="staging"
        fi
    fi
    TARGET_REF="origin/${TARGET_BRANCH}"
    if ! git fetch origin "+refs/heads/${TARGET_BRANCH}:refs/remotes/origin/${TARGET_BRANCH}" --quiet 2>/dev/null; then
        echo "  [WARN] Could not check for updates (no internet?). Continuing with current version."
    elif [ "$OLD_HEAD" = "$(git rev-parse "$TARGET_REF" 2>/dev/null || true)" ]; then
        echo "  [OK] Already up to date"
    else
        TARGET_HEAD=$(git rev-parse "$TARGET_REF" 2>/dev/null || true)
        # Stash local changes, including untracked non-ignored files, so the update doesn't fail
        STASHED=0
        STASH_REF=""
        SKIP_UPDATE_FOR_LOCAL_CHANGES=0
        DATA_SNAPSHOT_READY=0
        # Never auto-move onto a build whose storage format predates the data
        # on disk - it would silently show empty chat history (#4708). Checked
        # BEFORE the snapshot: a blocked target stays blocked on every launch,
        # and re-copying the whole data directory each time serves nothing.
        if [ -n "$TARGET_HEAD" ]; then
            # Exit 2 = real format block; any other failure means the check
            # itself could not run. Both skip the update (fail-safe), but the
            # user must be able to tell the two apart. The || capture keeps a
            # non-zero status from killing the launcher under set -e.
            CHECK_TARGET_STATUS=0
            node scripts/protect-launcher-data.mjs check-target "$TARGET_HEAD" || CHECK_TARGET_STATUS=$?
            if [ "$CHECK_TARGET_STATUS" -eq 2 ]; then
                SKIP_UPDATE_FOR_LOCAL_CHANGES=1
                echo "  [WARN] Skipping auto-update: the target version is older than your data format."
            elif [ "$CHECK_TARGET_STATUS" -ne 0 ]; then
                SKIP_UPDATE_FOR_LOCAL_CHANGES=1
                echo "  [WARN] Skipping auto-update: could not verify the target's storage format."
            fi
        else
            # No resolvable target commit: nothing to verify, and the update
            # steps below could not use it either — skip before the snapshot.
            SKIP_UPDATE_FOR_LOCAL_CHANGES=1
            echo "  [WARN] Skipping auto-update: could not resolve the update target."
        fi
        if [ "$SKIP_UPDATE_FOR_LOCAL_CHANGES" != "1" ]; then
            if node scripts/protect-launcher-data.mjs snapshot; then
                DATA_SNAPSHOT_READY=1
            else
                SKIP_UPDATE_FOR_LOCAL_CHANGES=1
                echo "  [WARN] Could not create an update snapshot. Skipping auto-update to protect your data."
            fi
        fi
        if [ "$SKIP_UPDATE_FOR_LOCAL_CHANGES" != "1" ] && [ "$CLEAN_FAILED" = "1" ]; then
            # A leftover we could not delete would be captured by "stash push -u"
            # and restored afterwards, making the broken tree permanent.
            SKIP_UPDATE_FOR_LOCAL_CHANGES=1
            echo "  [WARN] Could not clear stale files under packages/*/src. Skipping auto-update so they are not stashed and restored."
        fi
        if [ "$SKIP_UPDATE_FOR_LOCAL_CHANGES" != "1" ] && has_git_worktree_changes; then
            if git stash push -u -q -m "auto-stash before update" 2>/dev/null; then
                STASHED=1
                STASH_REF=$(git stash list -1 --format=%gd 2>/dev/null || true)
            else
                SKIP_UPDATE_FOR_LOCAL_CHANGES=1
                echo "  [WARN] Could not stash local changes. Skipping auto-update to avoid overwriting them."
            fi
        fi
        UPDATE_LOG=$(mktemp "${TMPDIR:-/tmp}/marinara-update.XXXXXX")
        UPDATED_TO_TARGET=0
        if [ "$SKIP_UPDATE_FOR_LOCAL_CHANGES" = "1" ]; then
            UPDATED_TO_TARGET=0
        elif [ -z "$CURRENT_BRANCH" ]; then
            if git checkout --detach "$TARGET_HEAD" >"$UPDATE_LOG" 2>&1; then
                UPDATED_TO_TARGET=1
            elif git reset --hard "$TARGET_HEAD" >"$UPDATE_LOG" 2>&1; then
                UPDATED_TO_TARGET=1
            fi
        elif git merge --ff-only "$TARGET_REF" >"$UPDATE_LOG" 2>&1; then
            UPDATED_TO_TARGET=1
        elif [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ] || [ "$CURRENT_BRANCH" = "staging" ]; then
            echo "  [..] Fast-forward failed; resetting the installed checkout to the latest ${TARGET_BRANCH} commit..."
            if git reset --hard "$TARGET_HEAD" >"$UPDATE_LOG" 2>&1; then
                UPDATED_TO_TARGET=1
            fi
        fi
        if [ "$UPDATED_TO_TARGET" = "1" ]; then
            NEW_HEAD=$(git rev-parse HEAD 2>/dev/null)
            if [ "$STASHED" = "1" ]; then
                restore_stashed_changes || true
            fi
            if [ "$NEW_HEAD" != "$TARGET_HEAD" ]; then
                echo "  [WARN] Update did not land on ${TARGET_REF}. Continuing with current version."
            else
                echo "  [OK] Updated to $(git log -1 --format='%h %s' 2>/dev/null)"
                if ! resolve_pnpm_runner; then
                    PNPM_RESOLUTION_FAILED=1
                else
                    prune_pnpm_store
                    echo "  [..] Refreshing dependencies..."
                    install_workspace_dependencies
                    rm -rf packages/shared/dist packages/server/dist packages/client/dist
                    rm -f packages/shared/tsconfig.tsbuildinfo packages/server/tsconfig.tsbuildinfo packages/client/tsconfig.tsbuildinfo
                fi
            fi
        elif [ "$SKIP_UPDATE_FOR_LOCAL_CHANGES" != "1" ]; then
            echo "  [WARN] Could not update to ${TARGET_REF}. Continuing with current version."
            if [ -s "$UPDATE_LOG" ]; then
                echo "         Git reported:"
                sed 's/^/         /' "$UPDATE_LOG"
            fi
            if [ "$STASHED" = "1" ]; then
                restore_stashed_changes || true
            fi
        fi
        rm -f "$UPDATE_LOG"
    fi
fi

if [ "${DATA_SNAPSHOT_READY:-0}" = "1" ] && ! node scripts/protect-launcher-data.mjs restore-if-missing; then
    echo "  [ERROR] User data verification failed after the update attempt. Startup stopped to avoid creating empty data."
    exit 1
fi
if [ "${PNPM_RESOLUTION_FAILED:-0}" = "1" ]; then
    exit 1
fi

# ── Guard: validate workspace package.json files ──
# A previous failed stash-pop or interrupted pnpm add can leave conflict markers
# in package.json files, causing pnpm install to fail with JSON parse errors.
for _pj in package.json packages/shared/package.json packages/server/package.json packages/client/package.json; do
    if [ -f "$_pj" ] && ! node -e "JSON.parse(require('fs').readFileSync('$_pj','utf8'))" 2>/dev/null; then
        echo "  [WARN] $_pj is corrupted — restoring from git"
        git checkout -- "$_pj" 2>/dev/null || true
    fi
done

# ── Detect stale dist (source updated but dist not rebuilt) ──
if [ -f "packages/shared/dist/constants/defaults.js" ]; then
    SOURCE_VER=$(node -p "require('./package.json').version" 2>/dev/null || true)
    DIST_VER=$(node -e "try{const m=require('./packages/shared/dist/constants/defaults.js');console.log(m.APP_VERSION)}catch{}" 2>/dev/null || true)
    SOURCE_COMMIT=$(git rev-parse --short=12 HEAD 2>/dev/null || true)
    DIST_COMMIT=$(node -e "try{const m=require('./packages/server/dist/config/build-meta.json');console.log(m.commit || '')}catch{}" 2>/dev/null || true)
    TERMUX_REBUILD_REQUIRED=0
    if [ -n "$SOURCE_VER" ] && [ -n "$DIST_VER" ] && [ "$SOURCE_VER" != "$DIST_VER" ]; then
        echo "  [WARN] Version mismatch: source v$SOURCE_VER but dist has v$DIST_VER"
        TERMUX_REBUILD_REQUIRED=1
    fi
    if [ -n "$SOURCE_COMMIT" ] && [ "$SOURCE_COMMIT" != "$DIST_COMMIT" ]; then
        echo "  [WARN] Build commit mismatch: source $SOURCE_COMMIT but dist has ${DIST_COMMIT:-<missing>}"
        TERMUX_REBUILD_REQUIRED=1
    fi
    if [ "$TERMUX_REBUILD_REQUIRED" = "1" ]; then
        echo "  [..] Rebuilding once to apply the update..."
        rm -rf packages/shared/dist packages/server/dist packages/client/dist
        rm -f packages/shared/tsconfig.tsbuildinfo packages/server/tsconfig.tsbuildinfo packages/client/tsconfig.tsbuildinfo
    fi
fi

# ── Install dependencies ──
if [ ! -d "node_modules" ] || [ "$TERMUX_FORCE_INSTALL" = "1" ] || ! node scripts/check-workspace-install.mjs >/dev/null 2>&1; then
    echo ""
    echo "  [..] Installing dependencies${TERMUX_FORCE_INSTALL:+ (refreshing for platform fix)}..."
    echo "       This may take several minutes on mobile."
    echo ""
    prune_pnpm_store
    install_workspace_dependencies
fi

# ── Build if needed ──
if [ ! -f "packages/shared/dist/constants/defaults.js" ]; then
    echo "  [..] Building shared types..."
    run_pnpm --filter @marinara-engine/shared build
fi
if [ ! -f "packages/server/dist/index.js" ]; then
    echo "  [..] Building server..."
    run_pnpm --filter @marinara-engine/server build
fi
if [ ! -f "packages/client/dist/index.html" ]; then
    echo "  [..] Building client..."
    # Skip tsc type-check on Termux — it OOMs on low-memory devices.
    # Skip PWA service worker — terser minifier OOMs on low-memory devices.
    # Vite doesn't need tsc output (tsconfig has noEmit: true).
    if ! SKIP_PWA=1 run_pnpm --filter @marinara-engine/client exec vite build 2>&1; then
        echo "  [WARN] Vite build failed — native binaries may not match Node.js $(node -v)."
        echo "  [..] Ensuring WASM fallback for rollup is installed and retrying..."
        run_pnpm install --frozen-lockfile --prefer-offline --filter @marinara-engine/client 2>/dev/null || true
        SKIP_PWA=1 run_pnpm --filter @marinara-engine/client exec vite build
    fi
fi

export NODE_ENV=production
export PORT=${PORT:-7860}
export HOST=${HOST:-0.0.0.0}

if [ -n "$SSL_CERT" ] && [ -n "$SSL_KEY" ]; then
  PROTOCOL=https
else
  PROTOCOL=http
fi

BROWSER_HOST="$HOST"
case "$BROWSER_HOST" in
  ""|"0.0.0.0"|"::") BROWSER_HOST="127.0.0.1" ;;
esac

LOCAL_BROWSER_PATH=""
if [ -n "${MARINARA_ANDROID_SECRET:-}" ]; then
  LOCAL_BROWSER_PATH="/android-login"
fi

AUTO_OPEN_BROWSER_VALUE="${AUTO_OPEN_BROWSER:-true}"
case "${AUTO_OPEN_BROWSER_VALUE,,}" in
  0|false|no|off) AUTO_OPEN_BROWSER_ENABLED=0 ;;
  *) AUTO_OPEN_BROWSER_ENABLED=1 ;;
esac

# ── Detect IP address for LAN access ──
LOCAL_IP=$(ip -4 addr show wlan0 2>/dev/null | grep 'inet ' | sed 's/.*inet \([0-9.]*\).*/\1/' || echo "")
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -n 1 || echo "")
fi

# ── Start ──
echo ""
echo "  ══════════════════════════════════════════"
echo "    Starting Marinara Engine on ${PROTOCOL}://${HOST}:${PORT}"
if [ "$BROWSER_HOST" != "$HOST" ]; then
echo "    Local browser URL: ${PROTOCOL}://${BROWSER_HOST}:${PORT}${LOCAL_BROWSER_PATH}"
fi
if [ -n "$LOCAL_IP" ]; then
echo "    LAN access: ${PROTOCOL}://${LOCAL_IP}:${PORT}"
fi
echo ""
echo "    Open the URL above in your mobile browser."
echo "    Press Ctrl+C to stop"
echo "  ══════════════════════════════════════════"
echo ""

# Open in Termux browser if available (no-op if not)
if [ "$AUTO_OPEN_BROWSER_ENABLED" = "1" ] && command -v termux-open-url &> /dev/null; then
    (sleep 3 && termux-open-url "${PROTOCOL}://${BROWSER_HOST}:${PORT}${LOCAL_BROWSER_PATH}") &
elif [ "$AUTO_OPEN_BROWSER_ENABLED" != "1" ]; then
    echo "  [OK] Auto-open disabled (AUTO_OPEN_BROWSER=${AUTO_OPEN_BROWSER_VALUE})"
fi

# Keep Android from suspending the Termux process while the local server is
# running. Release the lock on every launcher exit, including Ctrl+C.
TERMUX_WAKE_LOCK_ACQUIRED=0
release_termux_wake_lock() {
    if [ "$TERMUX_WAKE_LOCK_ACQUIRED" = "1" ]; then
        if ! termux-wake-unlock >/dev/null 2>&1; then
            echo "  [WARN] Could not release the Android wake lock."
        fi
    fi
}
trap release_termux_wake_lock EXIT

if command -v termux-wake-lock &> /dev/null && command -v termux-wake-unlock &> /dev/null; then
    if termux-wake-lock >/dev/null 2>&1; then
        TERMUX_WAKE_LOCK_ACQUIRED=1
        echo "  [OK] Android wake lock acquired for background reliability"
    else
        echo "  [WARN] Could not acquire an Android wake lock; background execution may pause."
    fi
else
    echo "  [WARN] Termux wake-lock commands are unavailable; background execution may pause."
fi

# Start server
cd packages/server
# Preserve Node's real exit status. The launcher's session-wide tee has already
# made update, build, and server output durable for the next support report.
set +e
node dist/index.js
MARINARA_SERVER_STATUS=$?
set -e
if [ "$MARINARA_SERVER_STATUS" -ne 0 ]; then
    echo "  [ERROR] Marinara Engine server exited with status $MARINARA_SERVER_STATUS." >&2
fi
if [ -n "$MARINARA_TERMUX_LOG_TEE_PID" ]; then
    # Close the pipe before waiting so tee sees EOF and flushes the final lines.
    exec 1>&3 2>&4 3>&- 4>&-
    set +e
    wait "$MARINARA_TERMUX_LOG_TEE_PID"
    MARINARA_TERMUX_LOG_TEE_STATUS=$?
    set -e
    if [ "$MARINARA_TERMUX_LOG_TEE_STATUS" -ne 0 ]; then
        echo "  [WARN] Persistent Termux logging failed with status $MARINARA_TERMUX_LOG_TEE_STATUS." >&2
    fi
fi
exit "$MARINARA_SERVER_STATUS"
