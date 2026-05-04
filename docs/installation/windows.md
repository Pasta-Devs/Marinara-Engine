# Windows Installation Guide

## Method 1: Windows Installer (Recommended)

Download the latest Installer from the [Releases](https://github.com/Pasta-Devs/Marinara-Engine/releases) page and run it.

The installer lets you choose the install folder, checks for Node.js and Git, aligns pnpm to the repo-pinned version even if an older global pnpm is already installed, clones the repo, installs dependencies, builds the app, and creates desktop and Start Menu shortcuts with the Marinara icon.

The installer creates a git-based checkout, so it auto-updates the same way as a manual clone when launched through the Start Menu shortcut or `start.bat`.

## Method 2: Run from Source

### Prerequisites

You need **Node.js** and **Git** installed.

**Install Node.js v24 LTS+:**

Download the installer from [nodejs.org](https://nodejs.org/en/download) and run it.

**Install Git:**

Download from [git-scm.com](https://git-scm.com/download/win) and run the installer.

Verify both are installed:

```bat
node -v        :: should show v24 or higher
git --version  :: should show git version 2.x+
```

### Quick Start (Launcher)

```bat
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd Marinara-Engine
start.bat
```

`start.bat` handles the rest: it aligns pnpm to the repo-pinned version, installs dependencies, builds the app, prepares local file-backed storage, and opens the app in your browser.

### Manual Setup

If you prefer to run commands yourself without the launcher:

```bat
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd Marinara-Engine
pnpm install
pnpm build
pnpm start
```

Then open **<http://127.0.0.1:7860>**. Everything runs locally.

> `pnpm start` binds to `127.0.0.1` by default. To allow LAN access, set `HOST=0.0.0.0` in `.env` first.

## Accessing from Another Device

Want to use Marinara Engine from your phone, tablet, or another computer? See the [FAQ — LAN access](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) guide.

## Updating

### Automatic (Launcher / Installer)

When you launch Marinara Engine via the Start Menu shortcut or `start.bat` from a git checkout, the launcher automatically:

1. Fetches the latest code from GitHub and fast-forwards to `origin/main`
2. Detects whether the checkout changed
3. Temporarily stashes tracked local changes if needed, then reapplies them
4. Reinstalls dependencies and rebuilds when needed
5. Starts the app on the current version

This applies to both manual clones and installs created by the Windows installer.

### In-App Update Check

Go to **Settings → Advanced → Updates** and click **Check for Updates**. If a new version is available, click **Apply Update** to pull and rebuild from within the app. When it finishes, relaunch Marinara Engine from the shortcut or `start.bat` to start the updated build.

### Manual Update

If you use a git checkout without the launcher or the in-app updater:

```bat
git fetch origin main
git merge --ff-only origin/main
pnpm install
pnpm build
```

Then restart the server.

---

## See Also

- [Configuration Reference](../CONFIGURATION.md) — environment variables and `.env` setup
- [Troubleshooting](../TROUBLESHOOTING.md) — common issues and fixes
