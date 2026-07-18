# Windows Installation Guide

This guide shows you how to install Guksu Motor on Windows. You can use the one click installer (the easy path) or set it up from source. It also covers system requirements, optional features, and how to update later.

## System requirements

Guksu Motor runs on your own Windows PC. You need the following:

- Windows 10 or Windows 11 (64 bit).
- A few gigabytes of free disk space for the app and its dependencies.
- An internet connection during install (to download code and packages).

Both install methods need two tools. The installer can fetch them for you. For the source method you install them yourself:

- **Node.js** version 24, 25, or 26. Node.js runs the app. Version 24 is the recommended LTS release. LTS means Long Term Support, a stable version.
- **Git**. Git downloads the code and lets the app update itself later.

pnpm is the package manager that installs the app's parts. If you use the installer or the **start.bat** launcher, you do not need to install pnpm yourself. Both fetch the correct pnpm version through Corepack, a pnpm helper included with Node.js, or through a temporary download. Only the manual setup without the launcher needs the `pnpm` command on your system. That section includes the install step.

## Method 1: Windows installer (recommended)

The installer is the easiest way to start. It checks for Node.js and Git, helps you install them if they are missing, downloads the app, builds it, and creates shortcuts.

Follow these steps:

1. Open the Guksu Motor releases page in your browser.

```text
https://github.com/Pasta-Devs/Marinara-Engine/releases
```

2. Download the latest Windows installer file from that page.
3. Run the installer and follow the on screen prompts. If Node.js or Git are missing, let the installer install them.
4. Choose the install folder when asked, or accept the default.
5. Wait for the installer to download the app and build it. This can take a few minutes.
6. When it finishes, double click the new desktop shortcut to launch Guksu Motor.

Your browser should open to the app after a short delay. If it does not open on its own, open your browser and go to this address:

```text
http://127.0.0.1:7860
```

The installer sets up a Git based copy of the app. This means it can update itself the next time you launch it. See the Updating section below.

If your antivirus warns you about the installer, this is a known false alarm. The installer downloads Node.js and Git, and some antivirus tools flag that behavior. Only run the installer if you downloaded it from the official releases page linked above.

## Method 2: Install from source

Use this method if you prefer to run the commands yourself, or if you want the tester (staging) version.

### Step 1: Install Node.js and Git

1. Download the Node.js installer from the official site and run it.

```text
https://nodejs.org/en/download
```

2. Download the Git installer from the official site and run it.

```text
https://git-scm.com/download/win
```

3. Open a new Command Prompt window. Check that Node.js is version 24, 25, or 26:

```bat
node -v
```

4. Check that Git is installed:

```bat
git --version
```

You should see a version number for each command. If a command is not found, close and reopen Command Prompt, or reinstall the missing tool.

### Step 2: Download the code and launch

The launcher script named **start.bat** does the setup for you. It picks the correct pnpm version, installs dependencies, builds the app, and opens your browser.

1. Download the code with Git:

```bat
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Enter the new folder:

```bat
cd Marinara-Engine
```

3. Optional: switch to the tester version. The download starts on the stable version. If you want the tester (staging) version instead, run this command before the first launch. Skip this step if you want the stable version. Back up your data before using tester builds.

```bat
git checkout staging
```

After this switch, the launcher keeps you on the tester version when it updates.

4. Run the launcher:

```bat
start.bat
```

The first launch takes a few minutes because it installs and builds everything. When it is ready, your browser opens to the app at `http://127.0.0.1:7860`. To start the app again later, run **start.bat** from the same folder.

The launcher opens the app to your local network by default, so other devices on your network can reach it. See Accessing from another device below.

### Manual setup without the launcher

If you want to run each command yourself instead of using **start.bat**, do this from inside the `Marinara-Engine` folder.

1. Install pnpm. This path does not use the launcher, so the `pnpm` command must exist on your system. The `npm` command comes with Node.js. Run this once:

```bat
npm install -g pnpm
```

2. Install dependencies:

```bat
pnpm install --force
```

3. Build the app:

```bat
pnpm build
```

4. Start the server:

```bat
pnpm start
```

5. Open the app in your browser:

```text
http://127.0.0.1:7860
```

Everything runs on your own computer. With this manual method the app listens on `127.0.0.1`, which means only this computer can reach it. To let other devices on your network connect, create a file named `.env` in the `Marinara-Engine` folder. Add this line to it, then restart the server:

```env
HOST=0.0.0.0
```

## Optional: AI sprite background removal

Guksu Motor requests native transparency for generated still sprites and has built-in adaptive matte cleanup for flat chroma and older white backgrounds. You can also install an optional tool called `backgroundremover` as a fallback for detailed scenery and other non-flat backgrounds. It is optional because it downloads large machine learning files.

To use it you first need Python. Install Python 3.11 from the official site, then run the install command from the `Marinara-Engine` folder:

```text
https://www.python.org/downloads/windows/
```

Run the installer step:

```bat
pnpm backgroundremover:install
```

This creates a private Python folder (a venv) under your data folder. Guksu Motor then uses it automatically for sprite cleanup. A venv is a self contained Python setup that does not affect the rest of your system.

You can also let **start.bat** install the tool for you on the next launch. Add this line to your `.env` file:

```env
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Accessing from another device

You can open Guksu Motor from your phone, tablet, or another computer on the same network. For the setup steps and the security options, see the [Frequently Asked Questions](../FAQ.md) guide.

## Updating Guksu Motor

Your chats, characters, and settings stay in place when you update. Guksu Motor offers three ways to update on Windows.

### Automatic updates with the launcher

When you launch the app with the desktop shortcut or **start.bat** from a Git based copy, the launcher checks for updates first. If a newer version exists, it downloads the changes, reinstalls dependencies, rebuilds the app, and then starts. This works for both installer setups and manual clones.

Run `start.bat --skip-update` to skip one check. To keep the installed Engine version across launches, add `AUTO_UPDATE_ENABLED=false` to `.env`. Manual checks, in-app apply, and manual Git updates remain available.

If you have unsaved local changes to the code, the launcher tries to set them aside safely. It puts them back after updating. If it cannot, it keeps your current version and prints a note.

### In-app updates

You can also check for updates inside the app.

1. Open **Settings**.
2. Go to the **Advanced** tab.
3. Find the **Updates** section.
4. Pick a channel in **Release Channel**. Choose **Latest Stable** for the normal version, or **Staging/UAT** for early tester builds. Back up your data before using tester builds.
5. Click **Check for Updates**. The app tells you if a newer version is available.

The **Apply Update** button is turned off by default for safety. Applying the update from inside the app needs extra setup. In your `.env` file, set the following values:

```env
UPDATES_APPLY_ENABLED=true
ADMIN_SECRET=your-own-secret-value
```

Then open **Settings**, go to the **Advanced** tab, find **Admin Access**, and paste the same secret value there. After that, the **Apply Update** button becomes available.

If you open the app from an iPhone or iPad that connects to this Windows PC, **Apply Update** updates this Windows server. Remote apply also needs one more value in `.env`:

```env
UPDATES_ALLOW_REMOTE_APPLY=true
```

If you do not enable in-app apply, just relaunch the app with the shortcut or **start.bat** to update.

### Manual update

If you use a Git copy without the launcher, you can update by hand. Run these from the `Marinara-Engine` folder.

1. Get the latest stable code:

```bat
git fetch origin +refs/heads/main:refs/remotes/origin/main
```

2. Move to the latest stable version:

```bat
git merge --ff-only origin/main || git checkout --detach origin/main
```

3. Reinstall dependencies:

```bat
pnpm install --force
```

4. Rebuild the app:

```bat
pnpm build
```

5. Start the server again:

```bat
pnpm start
```

For tester builds, use the staging branch instead. Run these two commands in place of steps 1 and 2 above. Then continue with the install and build steps:

```bat
git fetch origin +refs/heads/staging:refs/remotes/origin/staging
```

```bat
git checkout -B staging origin/staging
```

## If something goes wrong

If the install or launch fails, first make sure Node.js is version 24, 25, or 26 and that Git is installed. If your antivirus blocks the installer or the download, that is a known false alarm as noted above.

For more fixes, see the [Troubleshooting Guksu Motor](../TROUBLESHOOTING.md) guide.

## Related guides

- [Guksu Motor Installation](../INSTALLATION.md): pick the right install method for your device.
- [Upgrading Guksu Motor](../UPGRADING.md): more detail on keeping the app up to date.
- [Troubleshooting Guksu Motor](../TROUBLESHOOTING.md): fixes for common problems.
- [Frequently Asked Questions](../FAQ.md): quick answers, including network access.
