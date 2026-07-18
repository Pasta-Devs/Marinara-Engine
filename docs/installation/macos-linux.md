# macOS / Linux Installation Guide

This guide shows you how to install and run Guksu Motor on macOS or Linux. You will install two required tools, start the app with the shell launcher, and learn how to update it later. Guksu Motor (called Guksu after this) runs entirely on your own computer.

## Prerequisites

You need two free tools installed before you start:

- **Node.js**: the program that runs Guksu. Install version 24, 25, or 26 (version 24 is the recommended LTS release).
- **Git**: the tool that downloads Guksu and fetches updates.

You do not need to install pnpm yourself. pnpm is the package manager Guksu uses to fetch its parts. The shell launcher installs the correct pnpm version for you.

### Install on macOS

The easiest way is Homebrew. This one command installs both tools:

```bash
brew install node git
```

If you do not use Homebrew, download the Node.js installer from https://nodejs.org. Then install Git with the Xcode command line tools:

```bash
xcode-select --install
```

### Install on Linux

Use your distribution's package manager. On Ubuntu or Debian the default Node.js is often older than version 24. Add the newer NodeSource release first:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
```

Then install Node.js and Git:

```bash
sudo apt install -y nodejs git
```

On Fedora:

```bash
sudo dnf install -y nodejs git
```

On Arch:

```bash
sudo pacman -S nodejs npm git
```

### Verify the tools

Check that both tools are ready. Run this command:

```bash
node -v
```

You should see `v24` or a higher number. Then run this command:

```bash
git --version
```

You should see a version like `git version 2.40` or higher. If either command reports "command not found", the tool is not installed correctly.

## Quick start with the launcher

The launcher script `start.sh` is the recommended way to run Guksu. It installs everything, builds the app, and opens it in your browser.

1. Download Guksu. Run this command:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Move into the new folder. Run this command:

```bash
cd Marinara-Engine
```

3. Make the launcher runnable. Run this command:

```bash
chmod +x start.sh
```

4. Start Guksu. Run this command:

```bash
./start.sh
```

The first run takes a few minutes because it downloads and builds everything. When it finishes, Guksu opens in your browser at http://127.0.0.1:7860. The number 7860 is the default port, which is the doorway the app uses on your computer.

If your browser does not open on its own, open it yourself and go to that same address.

### What the launcher does each time

Every time you run `./start.sh` from a Git download, the launcher will:

1. Check for a newer version and update itself if one is found.
2. Confirm that Node.js and the correct pnpm version are ready.
3. Install any missing parts.
4. Rebuild the app when the code has changed.
5. Prepare local storage for your data.
6. Start the server and open the app in your browser.

### Turning off the automatic browser open

By default the launcher opens your browser for you. To stop this, create a file named `.env` in the Guksu folder and add this line:

```bash
AUTO_OPEN_BROWSER=false
```

A `.env` file is a plain text file that holds your settings, one per line. A small starter `.env` looks like this:

```bash
PORT=7860
AUTO_OPEN_BROWSER=true
```

`PORT` sets the address port (7860 by default). By default the launcher also lets other devices on your LAN reach the server. LAN means local area network, the network in your home or office. Guksu still blocks those devices until you set up a password or another access option. The [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md) guide shows you how.

## Manual setup

Most users should use the launcher above. If you prefer to run each step yourself, follow these commands instead. For manual setup you need pnpm available. Node.js 24 includes Corepack, but Node.js 25 does not.

1. On Node.js 24, turn on pnpm through Corepack:

```bash
corepack enable pnpm
```

On Node.js 25 or 26, install the user-provided Corepack package first, then turn on pnpm:

```bash
npm install --global corepack
corepack enable pnpm
```

2. Download Guksu. Run this command:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

3. Move into the folder. Run this command:

```bash
cd Marinara-Engine
```

4. Install the parts. Run this command:

```bash
pnpm install --force
```

5. Build the app. Run this command:

```bash
pnpm build
```

6. Start the server. Run this command:

```bash
pnpm start
```

Now open http://127.0.0.1:7860 in your browser. With `pnpm start` the server listens only on your own computer by default. Everything runs locally, and your data storage is prepared on the first start.

### If the install fails on Linux

Some Linux systems reject very long file paths during install. If you see an error containing `ERR_PNPM_ENAMETOOLONG`, remove the half-finished folders and start again from the launcher. Run this command:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Then run this command:

```bash
./start.sh
```

## Optional background remover

Guksu can remove the background from character sprite images. A sprite is a character picture used in Roleplay and Game modes. Native transparency and built-in adaptive matte cleanup work without this download. Install the extra AI remover only if you also need a fallback for sprites made against detailed scenery, shadows, or other non-flat backgrounds; it downloads large files.

The extra tool is a Python program. Installing it creates a Python venv (a virtual environment, a private folder that holds Python packages). It also downloads PyTorch, a machine learning library. Finally it downloads the U2Net models, the files that find the subject in an image.

To install it once, run this command from the Guksu folder:

```bash
pnpm backgroundremover:install
```

On macOS, Python version 3.11 is the most reliable choice. Install it first with Homebrew:

```bash
brew install python@3.11
```

Then run the install command again:

```bash
pnpm backgroundremover:install
```

To let the launcher install this tool for you on the next launch, add this line to your `.env` file:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Updating

When you start Guksu with `./start.sh` from a Git download, the launcher checks for a newer version. It updates itself automatically before it starts. Your chats, characters, and settings are kept.

Run `./start.sh --skip-update` to skip one check. To keep the installed Engine version across launches, add `AUTO_UPDATE_ENABLED=false` to `.env`. You can still check or update manually from **Settings → Advanced → Updates** or with Git commands.

You can also check from inside the app. Open **Settings**, go to the **Advanced** tab, and find the **Updates** section. Click **Check for Updates** to see if a newer release exists. The **Apply Update** button is turned off by default. To turn it on, set a few server options. Then save an admin secret under **Settings**, **Advanced**, **Admin Access**. If you do not turn it on, just relaunch with `./start.sh` to update.

For the full update steps, including how to back up first and how to switch release channels, see the upgrading guide linked below.

## Key terms

- **pnpm**: the package manager Guksu uses to download and organize its parts.
- **Corepack**: a helper included with Node.js that turns on pnpm.
- **LAN**: local area network, the private network in your home or office.
- **.env**: a plain text settings file in the Guksu folder, one setting per line.
- **venv**: a Python virtual environment, a private folder that holds Python packages.
- **PyTorch**: a machine learning library used by the optional background remover.
- **U2Net**: the model files the background remover uses to find the subject in an image.

## Related guides

- [Guksu Motor Installation](../INSTALLATION.md): pick the right install method for your device.
- [Upgrading Guksu Motor](../UPGRADING.md): full update and backup steps for every platform.
- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md): set up a password so other devices can reach Guksu.
- [Troubleshooting Guksu Motor](../TROUBLESHOOTING.md): fixes for install and startup problems.
