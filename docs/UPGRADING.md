# Upgrading to v2.0.0

This guide is for users coming from Marinara Engine v1.6.1 or older.

Before updating, stop the running server and make a backup from **Settings -> Advanced -> Backups** if you can. v2.0.0 keeps the same local data model, but the release changes a lot of UI, agent, prompt, and import/export code, so a backup is the least dramatic insurance policy.

## Windows

If you installed with the Windows installer, close Marinara Engine and launch it again from the Start Menu shortcut. The launcher runs `start.bat`, fetches the released `main` branch, aligns pnpm, reinstalls dependencies when needed, rebuilds, and starts v2.0.0.

If the launcher says Node.js is too old, install Node.js 24 LTS or newer, then launch Marinara Engine again.

You can also download and run the v2.0.0 installer from the GitHub Release. It uses the same git-based install path, so future updates still happen through the launcher.

## macOS and Linux

Close Marinara Engine and run:

```bash
./start.sh
```

The launcher fetches the current update branch, fast-forwards normal clones or moves detached release checkouts to the released code, reinstalls dependencies when needed, rebuilds, and starts v2.0.0. Local `staging` branches follow `origin/staging`; all other launcher checkouts follow stable `origin/main`.

If it says Node.js is too old, install Node.js 24 LTS or newer, then run `./start.sh` again.

## Docker or Podman

From the folder with your Compose file, run:

```bash
docker compose pull && docker compose up -d
```

Tagged images are published as `ghcr.io/pasta-devs/marinara-engine:2.0.0`, `:2.0`, `:2`, `:latest`, plus matching `-lite` tags.

## Android

### Existing Termux Install

Open Termux and run:

```bash
cd ~/Marinara-Engine
./start-termux.sh
```

The Termux launcher updates the repo, upgrades Node.js through `nodejs-lts` when needed, refreshes mobile native/wasm dependencies, rebuilds, and starts the local server.

### Release APK Fast Path

1. Download the v2.0.0 Android APK from GitHub Releases.
2. Install and open **Marinara Engine**.
3. Tap **Install / Start Marinara**.
4. If Termux is missing, approve Android's install prompts so Marinara can download and install the F-Droid Termux APK.
5. Approve **Run commands in Termux environment** if Android asks.
6. If Termux blocks external commands, paste the copied `allow-external-apps` command into Termux once, then tap **Install / Start Marinara** again.
7. Wait for Termux to finish installing/building, then return to Marinara Engine. The APK keeps retrying until the local server is ready.

If Android blocks the Termux setup launch completely, the APK copies a full Marinara setup command. Open Termux, paste that copied command, wait for it to start the server, then return to the APK.

Android does not allow an ordinary APK to silently install Termux or run Termux commands without user confirmation. The v2.0.0 APK reduces the setup to taps and Android permission prompts, but those prompts cannot be removed.

## iPhone and iPad

For v2.0.0, iPhone and iPad use the Safari PWA path. Update the computer, Docker host, or Android Termux device that actually runs the Marinara server, then reload the iOS Home Screen app or Safari tab.

An Android APK cannot run on iOS, including jailbroken iPhones. A one-tap jailbroken/sideloaded iOS bootstrap would need a separate `.ipa` or jailbreak package plus an iOS-compatible local runtime strategy; that wrapper is not included in v2.0.0.

If Safari keeps showing an older build after the host is updated, remove the Home Screen icon, clear Safari website data for the Marinara host, then add it again.
