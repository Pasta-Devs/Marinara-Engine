# Updating Existing Installs

Git-based installs update automatically. If you launch Marinara Engine via `start.sh`, `start.bat`, or `start-termux.sh` from a git checkout, the launcher:

1. Pulls the latest code from GitHub with `git pull`
2. Detects whether the checkout changed
3. Reinstalls dependencies and rebuilds when needed
4. Starts the app on the current version

This includes installs created by the Windows installer, because the installer clones the repository and keeps the `.git` directory.

In-app update checks use the newest GitHub `v*` tag and matching release metadata when available. If you use Docker, the app shows the pull command instead of updating automatically. Docker images are published from `v*` tags.

## In-App Update Check

Go to **Settings → Advanced → Updates** and click **Check for Updates**. If a new version is available:

- **Git installs** — Click **Apply Update** to pull, rebuild, and restart the server automatically.
- **Docker** — The UI shows the command to run: `docker compose pull && docker compose up -d`.

## Manual Update

If you use a git checkout without the shell launchers or the in-app updater:

```bash
git fetch origin main
git merge --ff-only origin/main
pnpm install
pnpm build
pnpm db:push
```

Then restart the server.
