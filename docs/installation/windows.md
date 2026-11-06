# Windows Installation Guide

Install Marinara Engine on a Windows PC with the installer (the fewest steps) or from source. Marinara then runs on your own PC.

## Before you start

You need Windows 10 or Windows 11 (64-bit), a few gigabytes of free disk space and an internet connection for the install. The installer recommends about 2.5 GB free.

You also need two tools:

- **Node.js** 24, 25 or 26. Node.js runs the app. Version 24 is the recommended LTS (Long Term Support) release.
- **Git**. Git downloads the code and lets Marinara update itself.

If you use the installer, skip installing them: it fetches both for you. If you install from source, you install them yourself. You do not need to install pnpm (the tool that installs the app's parts). The installer and `start.bat` set it up.

## Install with the Windows installer

1. Open the [Marinara Engine releases page](https://github.com/Pasta-Devs/Marinara-Engine/releases).
2. Download the latest Windows installer. It is named `Marinara-Engine-Installer-` followed by the version.
3. Run the installer. If Windows shows "Windows protected your PC", choose **More info**, then **Run anyway**, but only for a file from the releases page.
4. Follow the prompts. If Node.js or Git is missing, let the installer install it.
5. Choose the install folder, or accept the default (`%LOCALAPPDATA%\Marinara-Engine`).
6. Wait while it downloads and builds the app. A progress list shows each step. This takes a few minutes.
7. When it says the installation is complete, double-click the **Marinara Engine** desktop shortcut.

A console window (a black text window) opens and shows progress. Your browser then opens Marinara. If it does not, go to `http://127.0.0.1:7860`.

The installer makes a Git copy of the latest stable release, so Marinara can update itself on every launch.

> **Tip:** Some antivirus tools flag the installer because it downloads Node.js and Git. Run the installer only if you got it from the releases page above.

## Start and stop Marinara

- **Start:** double-click the desktop shortcut or the Start Menu entry. From a source install, run `start.bat` in the Marinara folder.
- **Stop:** the shortcut opens a console window. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> in it.

If Marinara is already running, the shortcut reopens it in your browser.

## Install from source

Use this method if you prefer to run commands yourself, or if you want the staging (tester) version.

1. Install [Node.js](https://nodejs.org/en/download) and [Git for Windows](https://git-scm.com/download/win).
2. Open a new Command Prompt window (a text window where you type commands).
3. Check both tools. `node -v` must show version 24, 25 or 26.

   ```bat
   node -v
   git --version
   ```

   If a command is not found, close and reopen Command Prompt, or reinstall the missing tool.

4. Download the code.

   ```bat
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

5. Open its folder.

   ```bat
   cd Marinara-Engine
   ```

6. Optional: switch to the staging version before the first launch. Skip this to stay on stable. Back up your data before you use staging.

   ```bat
   git checkout staging
   ```

   The launcher then keeps you on staging when it updates.

7. Run the launcher, the script that sets up and starts Marinara.

   ```bat
   start.bat
   ```

The first launch takes a few minutes while it installs and builds everything. A console window shows progress. Your browser opens Marinara when it is ready. To start again later, run `start.bat` from the same folder.

If it did not work: `[ERROR] Node.js 24 LTS or newer is required` means your Node.js is too old. Install Node.js 24 or newer from [nodejs.org](https://nodejs.org), then run `start.bat` again.

### Manual setup without the launcher

This path needs the `pnpm` command. Run these from inside the `Marinara-Engine` folder.

1. Install pnpm once.

   ```bat
   npm install -g pnpm
   ```

2. Install the dependencies (the parts the app needs), build the app and start the server.

   ```bat
   pnpm install --force
   pnpm build
   pnpm start
   ```

3. Open `http://127.0.0.1:7860`.

With `pnpm start`, only this PC can reach Marinara. To let other devices connect, create a file named `.env` in the `Marinara-Engine` folder, add this line and restart the server.

```env
HOST=0.0.0.0
```

## Open Marinara from another device

The installer, its shortcut and `start.bat` let other devices on your network reach Marinara, but it blocks them until you set a login. For the steps, see [Remote Access](../REMOTE_ACCESS.md) and the [FAQ](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device).

## Update Marinara

Each time you start Marinara from the shortcut or `start.bat`, the launcher checks for updates, installs them, rebuilds and starts. Your chats, characters and settings stay in place. If you changed the code yourself, the launcher sets your changes aside and puts them back after the update. If it cannot, it keeps your current version and prints a note. For the in-app **Apply Update** button, skipping an update and manual commands, see [Upgrading Marinara Engine](../UPGRADING.md#windows).

## Find your data or uninstall

Your data is in the `packages\server\data` folder inside the Marinara folder. To uninstall, open the Start Menu entry **Uninstall Marinara Engine**. The uninstaller asks whether to delete your data too. Choose **No** to keep it for a later reinstall. See [Backing Up and Restoring Marinara](../data/backup-and-restore.md).

## Optional: AI sprite background removal

Marinara asks for transparent backgrounds on generated sprites and cleans flat backgrounds by itself. As a fallback for detailed scenery, you can install the optional `backgroundremover` tool. It downloads large machine learning files, so it is off by default.

1. Install Python 3.11 from [python.org](https://www.python.org/downloads/windows/). Python 3.9 to 3.11 works.
2. Run this from the `Marinara-Engine` folder.

   ```bat
   pnpm backgroundremover:install
   ```

This creates a private Python folder (a venv) under your data folder. Marinara uses it automatically.

To let `start.bat` install it on the next launch, add this line to your `.env` file:

```env
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## If something goes wrong

Check that Node.js is version 24, 25 or 26 and that Git is installed. For more fixes, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Marinara Engine Installation](../INSTALLATION.md)
- [Upgrading Marinara Engine](../UPGRADING.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
- [Frequently Asked Questions](../FAQ.md)
