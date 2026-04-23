# macOS / Linux Installation Guide

## Prerequisites

You need **Node.js** and **Git** installed. pnpm is handled automatically by the shell launcher.

**Install Node.js v20+:**

| Platform              | Command                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| macOS                 | `brew install node` or download from [nodejs.org](https://nodejs.org/en/download)               |
| Linux (Ubuntu/Debian) | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo bash - && sudo apt install -y nodejs` |
| Linux (Fedora)        | `sudo dnf install -y nodejs`                                                                    |
| Linux (Arch)          | `sudo pacman -S nodejs npm`                                                                     |

**Install Git:**

| Platform              | Command                                                                          |
| --------------------- | -------------------------------------------------------------------------------- |
| macOS                 | `brew install git` or install Xcode Command Line Tools: `xcode-select --install` |
| Linux (Ubuntu/Debian) | `sudo apt install -y git`                                                        |
| Linux (Fedora)        | `sudo dnf install -y git`                                                        |
| Linux (Arch)          | `sudo pacman -S git`                                                             |

Verify both are installed:

```bash
node -v        # should show v20 or higher
git --version  # should show git version 2.x+
```

## Quick Start (Launcher)

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd Marinara-Engine
chmod +x start.sh
./start.sh
```

`start.sh` handles the rest: it aligns pnpm to the repo-pinned version, installs dependencies, builds the app, ensures the database schema is up to date, and opens the app in your browser.

When started from a git checkout, the launcher will:

1. **Auto-update** from Git if a `.git` folder is detected
2. Check that Node.js and the repo-pinned pnpm version are installed
3. Install all dependencies on first run
4. Build the application
5. Ensure the database schema is up to date
6. Load `.env`, resolve the final local URL, start the server, and open `http://127.0.0.1:<PORT>` in your browser by default

Set `AUTO_OPEN_BROWSER=false` in `.env` to skip the automatic browser launch.

## Manual Setup

If you prefer to run commands yourself without the launcher:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd Marinara-Engine
pnpm install
pnpm build
pnpm db:push
pnpm start
```

Then open **<http://127.0.0.1:7860>**. Everything runs locally.

> `pnpm start` binds to `127.0.0.1` by default. To allow LAN access, set `HOST=0.0.0.0` in `.env` first.

## Accessing from Another Device

Want to use Marinara Engine from your phone, tablet, or another computer? See the [FAQ — LAN access](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) guide.

## Updating

### Automatic (Launcher)

When you launch Marinara Engine via `./start.sh` from a git checkout, the launcher automatically:

1. Pulls the latest code from GitHub with `git pull`
2. Detects whether the checkout changed
3. Reinstalls dependencies and rebuilds when needed
4. Starts the app on the current version

### In-App Update Check

Go to **Settings → Advanced → Updates** and click **Check for Updates**. If a new version is available, click **Apply Update** to pull, rebuild, and restart the server automatically.

### Manual Update

If you use a git checkout without the launcher or the in-app updater:

```bash
git fetch origin main
git merge --ff-only origin/main
pnpm install
pnpm build
pnpm db:push
```

Then restart the server.

---

## See Also

- [Configuration Reference](../CONFIGURATION.md) — environment variables and `.env` setup
- [Troubleshooting](../TROUBLESHOOTING.md) — common issues and fixes
