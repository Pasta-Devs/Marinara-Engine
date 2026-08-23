# Upgrading Marinara Engine

This guide shows you how to update Marinara Engine to a newer version. It covers every install type, the in-app update tools, and what to do if an upgrade fails. Your chats and settings are kept when you upgrade.

## Your data is preserved

Upgrading Marinara Engine does not delete your data. Your chats, characters, personas, lorebooks, presets, connections, and settings all stay in place.

Marinara keeps your data in a local data folder on the machine that runs the server. Docker and Podman keep it in the `marinara-data` volume. Updating only replaces the app code, not this data folder or volume.

When upgrading from a version that bundled first-party agents, maps, calls, or Conversation games, the first start downloads their matching optional packages from the official catalog. Existing chat selections, agent settings, stored runtime data, and history are preserved. Keep the server online for that first start. If the catalog cannot be reached, Marinara retries the migration the next time it starts instead of deleting or disabling your stored configuration.

If you use a downloaded documentation language (**Settings** → **General** → **Documentation Language**), the first start after an update also checks that language pack for changes and refreshes it automatically. If the download source cannot be reached, Marinara keeps your installed pack (any guides missing from it show in English) and tries again on the next start. Your language choice is never reset by an update.

To learn where your data lives and how to save a copy, see [Backing Up and Restoring Marinara](data/backup-and-restore.md).

## Back up first

Upgrades are safe, but a backup is cheap insurance. Make one before any large jump between versions.

1. Open **Settings**.
2. Go to the **Advanced** tab.
3. Find the **Backup & Export** section.
4. Click **Download Backup**.
5. Save the `.zip` file somewhere safe.

You should see the button change to **Creating backup…** while it works. When it finishes, your browser saves a `.zip` archive of your data.

Full steps for backups and restoring are in [Backing Up and Restoring Marinara](data/backup-and-restore.md).

## Upgrade by platform

Pick the section that matches how you installed Marinara. A "git checkout" below means a copy installed with the Git tool. A "clone" is a downloaded copy made with Git.

### Windows

If you used the Windows installer or a git checkout, the launcher updates you automatically.

1. Close Marinara Engine.
2. Open it again from the Start Menu shortcut, or run `start.bat`.

The launcher fetches the latest code, reinstalls what changed, rebuilds the app, and starts the new version. This works for both the installer and a manual clone.

For one launch, run `start.bat --skip-update`. To keep the installed Engine version across launches, set `AUTO_UPDATE_ENABLED=false` in the project `.env`. This only disables automatic Engine updates; manual commands and **Settings → Advanced → Check for Updates** remain available.

If the launcher says Node.js is too old, install Node.js 24 LTS, then start Marinara again. LTS means Long Term Support, the recommended stable release of Node.js.

You can also download the newest installer from the GitHub Releases page and run it. It uses the same git-based path, so future updates still run through the launcher.

### macOS and Linux

Close Marinara Engine, then run the launcher from your Marinara folder.

```bash
./start.sh
```

The launcher fetches the latest code, reinstalls changed dependencies, rebuilds, and starts the new version.

Use `./start.sh --skip-update` for one launch, or set `AUTO_UPDATE_ENABLED=false` in `.env` for a persistent opt-out. Manual update commands and the in-app update controls remain available.

If it says Node.js is too old, install Node.js 24 LTS, then run the launcher again.

### Docker or Podman

Container installs update by pulling a new image, not through the launcher. Run this from the folder that holds your Compose file.

```bash
docker compose down && docker compose pull && docker compose up -d
```

For Podman, use the same commands with `podman`.

```bash
podman compose down && podman compose pull && podman compose up -d
```

Release images are published as `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` and `:latest`, plus matching `-lite` tags. Pull `:latest` or the newest version tag unless you want to stay on an older release on purpose. Your data in the `marinara-data` volume is not touched by a pull.

### Android (Termux)

Termux is a terminal and Linux environment for Android. Its launcher updates Marinara each time you run it.

1. Open Termux.
2. Run the launcher.

```bash
cd Marinara-Engine
./start-termux.sh
```

The launcher updates the code, upgrades Node.js when needed, rebuilds, and starts the local server.

If an update is broken and you need to stay on your current copy, skip the update check instead.

```bash
cd Marinara-Engine
./start-termux.sh --skip-update
```

For a persistent opt-out, set `AUTO_UPDATE_ENABLED=false` in the project `.env`. This affects only launcher-managed Engine updates; manual updates and the in-app update controls remain available.

If you use the Android app icon (the APK), [download the latest APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) and open the downloaded file so Android updates the wrapper itself. Then open Marinara Engine and tap **Install / Start Marinara** to update and start the Termux copy behind it. The app preserves and exchanges its private localhost credential automatically; an update never asks you for signing credentials or that secret.

### iPhone and iPad

iPhone and iPad do not run the Marinara server. They open a server that runs on another device through Safari. The copy on your Home Screen is a PWA, short for Progressive Web App. A PWA is a website you add to your Home Screen so it opens like an app.

1. Update the computer, Docker host, or Android device that actually runs your Marinara server. Use that device's section above.
2. Reload the Home Screen PWA or the Safari tab on your iPhone or iPad.

If Safari keeps showing an older build after the host is updated, reset the cached copy.

1. Remove the Home Screen icon.
2. Clear Safari website data for the Marinara host.
3. Add it to the Home Screen again.

## Checking for and applying updates in the app

Marinara can check GitHub for a newer version from inside the app. Some installs can also apply the update from the browser.

1. Open **Settings**.
2. Go to the **Advanced** tab.
3. Find the **Updates** section.

### Release Channel

The **Release Channel** dropdown picks which builds you track. It has two choices.

- **Latest Stable**: tracks tagged `vX.Y.Z` releases. This is the normal choice for most users.
- **Staging/UAT**: tracks pre-release tester builds. These may be unfinished. Back up your data before you use them.

Choosing **Staging/UAT** shows a warning: "Staging builds are pre-release tester builds. Back up your app data before applying them."

Switching channels is treated as a deliberate choice. When you pick a different channel from a browser on the machine that runs the server, the update button changes to **Switch to** followed by the channel name, and it works even when ordinary in-app updates are turned off. It shows **Switching…** while it runs. Normal same-channel updates still need the setup described under Apply Update below, and remote devices always do.

### Check for Updates

Click **Check for Updates**. The button shows **Checking…** while it works.

Below the button you see your **Release** version and your **Build** commit code. A **Branch** line also appears when the branch is known.

- If you are current, a green check row says "You're on the latest ... target" with your version.
- If a newer version exists, a card shows "vX.Y.Z available" with a **Release notes** link.
- On a git install that is simply behind, the card shows "N commits behind" instead. A commit is one saved change in the code, so this count can include unreleased work.

Update check results are cached. The release version check is cached for about 15 minutes. The "commits behind" count is cached for about 5 minutes. Clicking **Check for Updates** again right away may show the same numbers.

### Apply Update

The **Apply Update** button appears only when your install can update itself from the browser. This needs both of the following.

- A git-based install (Docker and packaged installs cannot apply this way).
- The server owner set `UPDATES_APPLY_ENABLED=true` in the server `.env` file. An `.env` file holds server settings.

If you click **Apply Update** on the machine that runs the server, this is all you need. No secret is required there.

Applying from a different device is off by default. It needs all three of the following.

- The server owner set `UPDATES_ALLOW_REMOTE_APPLY=true` in `.env`.
- The server owner set `ADMIN_SECRET` (a password for protected actions) in `.env`.
- You saved that same secret in **Settings -> Advanced -> Admin Access** on your device.

When you click **Apply Update**, the button shows **Updating...**. The server fetches the new code, reinstalls dependencies, rebuilds, and then shuts down. You then see: "Update applied successfully. Please relaunch the app to use the new version." Start Marinara again to finish.

If **Apply Update** is not available, Marinara shows why and what to do instead.

- Container installs show the image tag and the `docker compose pull && docker compose up -d` command to run on the host.
- Git installs with apply turned off show a manual update command you can copy.
- Other installs show a **Download** link to the GitHub release.

If the check itself fails, you see: "Could not check for updates. Try again later." This usually means a network or GitHub problem, so try again in a moment.

## The Refresh App button

The **Refresh App** button sits in the same **Updates** section. It is not a server update. It only refreshes the app in your current browser.

**Refresh App** unregisters the service worker and clears the browser caches, then reloads the page. A service worker is a small script your browser uses to load the app fast and offline. Your stored chats, settings, and other local data stay intact.

Use **Refresh App** when the app looks stale or shows a blank screen after an update, but the server is already running the new version. It fixes a stuck web page. It does not change the server code, so it is not a substitute for a real upgrade.

The button shows **Refreshing…** while it works, then the app reloads.

## Downgrading to an older version

Upgrades are always safe, but going backwards is not always possible directly. Newer versions of Marinara store chat messages in a newer on-disk format, and a version older than your data's format cannot read it. To protect your chat history, the launcher skips auto-updates that would land on an incompatible version, and the in-app updater refuses to apply one.

If you need an older version anyway, a one-command conversion puts your data back in the old format first. See [Chats show no messages after switching to an older version](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version) for the steps.

## If an upgrade fails

Most upgrade problems come from an old Node.js version, a partial download, or a stale browser cache.

- If the launcher reports Node.js is too old, install Node.js 24 LTS and start again.
- If the app looks broken after the server updated, try the **Refresh App** button above.
- If a git install cannot update cleanly, run your platform's manual update commands shown in that install guide.

For error messages and step-by-step fixes, see [Troubleshooting Marinara Engine](TROUBLESHOOTING.md).

## Related guides

- [Backing Up and Restoring Marinara](data/backup-and-restore.md)
- [Troubleshooting Marinara Engine](TROUBLESHOOTING.md)
- [Windows Installation Guide](installation/windows.md)
- [macOS / Linux Installation Guide](installation/macos-linux.md)
- [Run via Container (Docker / Podman)](installation/containers.md)
- [Android (Termux) Installation Guide](installation/android-termux.md)
- [iOS / iPadOS PWA Guide](installation/ios-pwa.md)
