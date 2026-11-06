# macOS / Linux Installation Guide

Install Marinara Engine on a Mac or a Linux computer and start it with the `start.sh` launcher. Marinara then runs on your own computer.

## Before you start

You need two tools:

- **Node.js** 24, 25 or 26. Node.js runs Marinara. Version 24 is the recommended LTS (Long Term Support) release.
- **Git**. Git downloads Marinara and fetches updates.

You do not need to install pnpm (the tool that installs the app's parts). The launcher sets up the right version.

### Install Node.js and Git on macOS

With Homebrew, one command installs both:

```bash
brew install node git
```

Without Homebrew, download the Node.js installer from [nodejs.org](https://nodejs.org). Then install Git with the Xcode command line tools:

```bash
xcode-select --install
```

### Install Node.js and Git on Linux

Use your package manager. On Ubuntu or Debian, the default Node.js is often older than version 24, so add the NodeSource release first:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
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

### Check the tools

```bash
node -v
git --version
```

`node -v` must show `v24` or higher. If either command says "command not found", the tool is not installed correctly.

## Install and start Marinara

1. Open a terminal, a window where you type commands. On a Mac, press <kbd>Cmd</kbd>+<kbd>Space</kbd>, type Terminal and press Enter. On Linux, open your Terminal app.
2. Download Marinara.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Open the new folder.

   ```bash
   cd Marinara-Engine
   ```

4. Start Marinara with the launcher, the script that sets up and starts it.

   ```bash
   ./start.sh
   ```

The first run takes a few minutes while it downloads and builds everything. The terminal shows progress, then `Press Ctrl+C to stop`. Marinara opens in your browser at `http://127.0.0.1:7860`. If the browser does not open, go to that address yourself.

If it did not work:

- `permission denied`: run `chmod +x start.sh`, then `./start.sh` again.
- `[ERROR] Node.js 24 LTS or newer is required`: your Node.js is too old. Install a newer version, then run `./start.sh` again.

## Start and stop Marinara

- **Start again:** run `./start.sh` from the Marinara folder. If Marinara is already running, it reopens it in your browser.
- **Stop:** press <kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal.

Each time you run `./start.sh` from a Git download, the launcher:

1. Checks for a newer version and updates if it finds one.
2. Checks Node.js and the right pnpm version.
3. Installs missing parts and rebuilds the app if the code changed.
4. Starts the server and opens your browser.

## Change launcher settings

Launcher settings live in a `.env` file in the Marinara folder. A `.env` file is a plain text file with one setting per line. To stop the launcher from opening your browser, add this line:

```bash
AUTO_OPEN_BROWSER=false
```

`PORT` sets the port, the number after the colon in the address (7860 by default). The launcher lets other devices on your local network reach Marinara, but it blocks them until you set a login. See [Remote Access](../REMOTE_ACCESS.md).

## Update Marinara

Running `./start.sh` updates Marinara first. Your chats, characters and settings stay in place. If you changed the code yourself, the launcher sets your changes aside and puts them back after the update. For skipping an update, the in-app **Apply Update** button and manual commands, see [Upgrading Marinara Engine](../UPGRADING.md#macos-and-linux).

## Manual setup without the launcher

Most people should use the launcher. To run each step yourself, you need pnpm. Node.js 24 includes Corepack, a tool that turns on pnpm. Node.js 25 does not.

1. On Node.js 24, turn on pnpm:

   ```bash
   corepack enable pnpm
   ```

   On Node.js 25 or 26, install Corepack first:

   ```bash
   npm install --global corepack
   corepack enable pnpm
   ```

2. Download Marinara.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Open its folder.

   ```bash
   cd Marinara-Engine
   ```

4. Install the parts, build the app and start the server.

   ```bash
   pnpm install --force
   pnpm build
   pnpm start
   ```

5. Open `http://127.0.0.1:7860`.

With `pnpm start`, the server listens only on your own computer. To let other devices connect, add `HOST=0.0.0.0` to `.env` and restart.

## Optional: background remover

Marinara asks for transparent backgrounds on generated sprites (character pictures) and cleans flat backgrounds by itself. As a fallback for detailed scenery or shadows, you can install the optional AI background remover. It sets up a Python venv (a private folder for Python packages) and downloads large files: PyTorch (a machine learning library) and the U2Net models (files that find the subject of an image).

1. On macOS, Python 3.11 works best. Install it first. Python 3.9 to 3.11 works.

   ```bash
   brew install python@3.11
   ```

2. From the Marinara folder, run:

   ```bash
   pnpm backgroundremover:install
   ```

To let the launcher install it on the next launch, add this line to `.env`:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## If something goes wrong

On some Linux systems, install fails with an error that contains `ERR_PNPM_ENAMETOOLONG` (file paths too long). Remove the half-finished folders and run the launcher again:

```bash
rm -rf node_modules .pnpm .pnpm-store
./start.sh
```

For more fixes, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Marinara Engine Installation](../INSTALLATION.md)
- [Upgrading Marinara Engine](../UPGRADING.md)
- [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
