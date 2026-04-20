# Run from Source (All Platforms)

## Prerequisites

You need **Node.js** and **Git** installed before running Marinara Engine. pnpm is handled automatically by the shell launchers, which align to the repo-pinned version even if a different global pnpm is already installed, or you can install it yourself for manual setup.

**Install Node.js v20+:**

| Platform              | How to Install                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Windows               | Download the installer from [nodejs.org](https://nodejs.org/en/download) and run it             |
| macOS                 | `brew install node` or download from [nodejs.org](https://nodejs.org/en/download)               |
| Linux (Ubuntu/Debian) | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo bash - && sudo apt install -y nodejs` |
| Linux (Fedora)        | `sudo dnf install -y nodejs`                                                                    |
| Linux (Arch)          | `sudo pacman -S nodejs npm`                                                                     |

**Install Git:**

| Platform              | How to Install                                                                      |
| --------------------- | ----------------------------------------------------------------------------------- |
| Windows               | Download from [git-scm.com](https://git-scm.com/download/win) and run the installer |
| macOS                 | `brew install git` or install Xcode Command Line Tools: `xcode-select --install`    |
| Linux (Ubuntu/Debian) | `sudo apt install -y git`                                                           |
| Linux (Fedora)        | `sudo dnf install -y git`                                                           |
| Linux (Arch)          | `sudo pacman -S git`                                                                |

Verify both are installed:

```bash
node -v        # should show v20 or higher
git --version  # should show git version 2.x+
```

## Quick Start (Launchers)

**Windows:**

```bat
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd Marinara-Engine
start.bat
```

**macOS / Linux:**

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd Marinara-Engine
chmod +x start.sh
./start.sh
```

**Android (Termux):**

Install [Termux](https://f-droid.org/en/packages/com.termux/) from F-Droid (the Play Store version is outdated), then run:

```bash
pkg update && pkg install -y git nodejs-lts && git clone https://github.com/Pasta-Devs/Marinara-Engine.git && cd Marinara-Engine && chmod +x start-termux.sh && ./start-termux.sh
```

The Termux launcher downloads the prebuilt SQLite native module when available, installs dependencies, builds the app, and starts the server at `http://127.0.0.1:<PORT>` using the resolved `PORT` value from `.env` or the default `7860`. First run takes a few minutes on mobile. After that, run `./start-termux.sh` to start again.

If you also want a dedicated Android app shell, see [android/README.md](../../android/README.md). The APK is a WebView wrapper around the Termux-served app; it does not replace the server.

> **Tip:** Install the PWA from your browser's "Add to Home Screen" prompt for a more native feel.

When started from a git checkout, the shell launchers will:

1. **Auto-update** from Git if a `.git` folder is detected
2. Check that Node.js and the repo-pinned pnpm version are installed
3. Install all dependencies on first run
4. Build the application
5. Ensure the database schema is up to date
6. Load `.env`, resolve the final local URL, start the server, and open `http://127.0.0.1:<PORT>` in your browser by default

Set `AUTO_OPEN_BROWSER=false` in `.env` to skip the automatic browser launch. This applies to the shell launchers (`start.bat`, `start.sh`, and `start-termux.sh`) only. The Android wrapper uses its own WebView.

## Manual Setup

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd marinara-engine
pnpm install
pnpm build
pnpm db:push
pnpm start
```

Then open **<http://127.0.0.1:7860>**. Everything runs locally.

Bare `pnpm start` binds to `127.0.0.1` by default. If you want LAN access without using a launcher, set `HOST=0.0.0.0` first.
