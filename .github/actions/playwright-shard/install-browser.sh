#!/usr/bin/env bash
# Install one Playwright browser and the Ubuntu packages it needs.
#
# `playwright install --with-deps` downloads about 140 MB of packages for WebKit (22 MB for
# Chromium) from the runner's Ubuntu mirror. Some runners get that mirror at under 120 kB/s
# while the Actions cache and the Playwright CDN stay fast, and the download then used up to
# 45 minutes of a shard's 40-minute budget. So the first install on a runner image keeps the
# .deb files it downloaded for the Actions cache, and later shards on that image install those
# files without the mirror.
#
# Usage: install-browser.sh <chromium|webkit> <cache folder> [mirror limit in seconds]
set -euo pipefail

browser=$1
debs=$2
# Normal installs take under 2 minutes. Past 10 the slowest shards (about 30 minutes of tests)
# can no longer finish in the 40-minute budget, so setup fails and says why.
mirror_limit=${3:-600}
archives=${APT_ARCHIVES:-/var/cache/apt/archives}

shopt -s nullglob
cached=("$debs"/*.deb)

if ((${#cached[@]} > 0)); then
  # The cache key names the runner image, browser and Playwright version, so these are exactly
  # the packages the first install on this image needed. The image ships apt's package lists,
  # and apt downloads a package from the mirror rather than use a local file of the same version,
  # so apt gets an empty lists folder and can only install these files. (--no-download would not
  # do it: apt then hands dpkg the local files by relative path and fails.)
  no_lists=$(mktemp -d)
  if sudo apt-get install --yes --no-install-recommends -o Dir::State::Lists="$no_lists" "${cached[@]}"; then
    exec pnpm exec playwright install "$browser"
  fi
  echo "::warning::The cached $browser packages did not install, so they are downloaded again."
fi

# Empty apt's own cache first, so only this install's packages are copied for the cache.
sudo apt-get clean
status=0
timeout "$mirror_limit" pnpm exec playwright install --with-deps "$browser" || status=$?
if ((status == 124)); then
  echo "::error::Installing $browser and its Ubuntu packages took over $((mirror_limit / 60)) minutes, too long for this shard to finish in its budget, so no tests ran. The runner's package mirror is slow; re-run the job."
fi
((status == 0)) || exit "$status"

downloaded=("$archives"/*.deb)
if ((${#cached[@]} == 0 && ${#downloaded[@]} > 0)); then
  mkdir -p "$debs"
  cp "${downloaded[@]}" "$debs"/
  echo "save=true" >>"$GITHUB_OUTPUT"
fi
