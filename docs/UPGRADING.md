# Upgrading Marinara Engine

Update Marinara Engine to a newer version, check for updates in the app, and go back if something breaks. Your chats and settings are kept when you upgrade.

## Which update method is mine?

| How you installed | How to update |
| --- | --- |
| Windows installer or `start.bat` | Close Marinara and open it again. See [Windows](#windows). |
| macOS or Linux | Run `./start.sh` again. See [macOS and Linux](#macos-and-linux). |
| Docker or Podman | Pull the new image and restart. See [Docker or Podman](#docker-or-podman). |
| Android app | Update the APK, then tap **Install / Start Marinara**. See [Android (Termux)](#android-termux). |
| iPhone or iPad | Update the server device. See [iPhone and iPad](#iphone-and-ipad). |

## Back up first

Make a backup before any large jump, and always before you might go back to an older version.

1. Open **Settings**.
2. Go to the **Advanced** tab.
3. Find the **Backup & Export** section.
4. Click **Download Backup**.
5. Save the `.zip` file somewhere safe.

The button shows **Creating backup…** while it works. When it finishes, your browser saves a `.zip` of your data. For restoring, see [Backing Up and Restoring Marinara](data/backup-and-restore.md).

## Upgrade by platform

Pick the section that matches how you installed Marinara. A git copy is a copy installed with the Git tool, which includes the Windows installer and any `git clone`.

### Windows

The launcher updates Marinara when you start it.

1. Close Marinara Engine.
2. Open it again from the desktop or Start Menu shortcut, or run `start.bat`.

The launcher fetches the latest code, reinstalls what changed, rebuilds and starts the new version. If you changed the code yourself, it sets your changes aside and puts them back after the update. If it cannot, it keeps your current version and prints a note. It copies your data before it updates, and it skips an update that would land on a version older than your data (see [Downgrading to an older version](#downgrading-to-an-older-version)).

To skip the update once, run `start.bat --skip-update`. To keep your installed version across launches, set `AUTO_UPDATE_ENABLED=false` in the project `.env`. This turns off only automatic updates. Manual commands and **Settings → Advanced → Check for Updates** still work.

If the launcher says Node.js is too old, install Node.js 24 LTS (Long Term Support, the recommended stable release), then start Marinara again. You can also download the newest installer from the GitHub Releases page and run it.

### macOS and Linux

1. Close Marinara Engine.
2. Run the launcher from your Marinara folder.

```bash
./start.sh
```

The launcher fetches the latest code, reinstalls changed dependencies, rebuilds and starts the new version. Use `./start.sh --skip-update` to skip it once, or `AUTO_UPDATE_ENABLED=false` in `.env` to turn off automatic updates. If Node.js is too old, install Node.js 24 LTS and run the launcher again.

### Docker or Podman

Containers update by pulling a new image, not through the launcher. Make a backup, then run this from the folder that holds your Compose file.

```bash
docker compose pull && docker compose up -d
```

With Podman, use `podman compose` instead. Release images are `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` and `:latest`, plus matching `-lite` tags. A pull does not touch your data in the `marinara-data` volume. See [Container installation](installation/containers.md).

### Android (Termux)

Termux is the Android app that runs a small Linux system for Marinara. Its launcher updates Marinara each time you run it.

1. Open Termux.
2. Run the launcher.

```bash
cd Marinara-Engine
./start-termux.sh
```

The launcher updates the code, upgrades Node.js if needed, rebuilds and starts the server. If an update breaks something and you want to stay on your current copy, add `--skip-update`. To turn off automatic updates, set `AUTO_UPDATE_ENABLED=false` in the project `.env`.

If you use the Android app (APK), [download the latest APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) and open it so Android updates the app. Then open Marinara Engine and tap **Install / Start Marinara** to update and start the Termux copy. An update never asks you for signing credentials or a secret.

### iPhone and iPad

These devices do not run the server. The Home Screen icon is a PWA, a website saved to the Home Screen that opens like an app.

1. Update the computer, container host or Android device that runs your Marinara server. Use its section above.
2. Reload the Home Screen app or the Safari tab.

If Safari keeps showing an older build, reinstall the PWA. See [Clearing and reinstalling the PWA](installation/ios-pwa.md#clearing-and-reinstalling-the-pwa).

### Manual update (git copy, no launcher)

Use this if you run a git copy with `pnpm start` instead of the launcher. Run these from the Marinara folder.

1. Fetch the latest stable code.

```bash
git fetch origin +refs/heads/main:refs/remotes/origin/main
```

2. Move to it.

```bash
git merge --ff-only origin/main || git checkout --detach origin/main
```

3. Reinstall dependencies, rebuild and start.

```bash
pnpm install --force --frozen-lockfile
pnpm build
pnpm start
```

For the staging (tester) version, run these two commands in place of steps 1 and 2:

```bash
git fetch origin +refs/heads/staging:refs/remotes/origin/staging
git checkout -B staging origin/staging
```

> **Warning:** Staging builds are pre-release tester builds. Back up your data before you use them.

## Update from inside the app

Marinara can check GitHub for a newer version. Some installs can also apply the update from the browser.

1. Open **Settings**.
2. Go to the **Advanced** tab.
3. Find the **Updates** section.

### Pick a release channel

**Release Channel** sets which builds you follow.

- **Latest Stable:** tagged `vX.Y.Z` releases. This is the normal choice.
- **Staging/UAT:** pre-release tester builds, which may be unfinished. Choosing it shows the warning "Staging builds are pre-release tester builds. Back up your app data before applying them."

When you pick a different channel in a browser on the server's own computer, the update button reads **Switch to** followed by the channel name. It works even when ordinary in-app updates are off, and shows **Switching…** while it runs. Remote devices cannot do this unless they meet the **Apply Update** conditions below.

### Check for Updates

Click **Check for Updates**. The button shows **Checking…** while it works. Below it you see your **Release** version, your **Build** commit code and, when known, your **Branch**.

- If you are current, a green row says "You're on the latest" with your version.
- If a newer release exists, a card shows "vX.Y.Z available" with a **Release notes** link.
- If a git copy is behind, the card shows "N commits behind". A commit is one saved change in the code, so the count can include unreleased work.

The release check is cached for about 15 minutes and the commit count for about 5 minutes, so a second click right away may show the same numbers.

If the check fails, you see "Could not check for updates. Try again later." This usually means a network or GitHub problem.

### Apply Update

**Apply Update** updates a git copy from the browser. It appears only when all of these are true:

- The install is a git copy. Containers and other installs cannot apply this way.
- The branch is `main`, `master` or `staging`, or a detached checkout. A copy on any other branch counts as a development checkout and Marinara refuses.
- The server owner set `UPDATES_APPLY_ENABLED=true` in the server `.env` file.
- `UPDATES_APPLY_DISABLED` is not set. It blocks every apply, including the channel switch, and developer launchers set it.

You do not need the admin secret to apply from the computer that runs the server. Open Marinara at `http://127.0.0.1:7860` or `http://localhost:7860`.

Two settings change this:

- An address served by a reverse proxy or tunnel counts as another device. `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false` makes those visitors count as local, including for the local admin-secret bypass. Keep it on for a public proxy or tunnel.
- `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true` makes even local requests need the secret.

Applying from another device is off by default. It needs all three of these:

- `UPDATES_ALLOW_REMOTE_APPLY=true` in the server `.env`.
- `ADMIN_SECRET` set in the server `.env`. This is a second password for risky actions.
- The same secret saved on your device in **Settings → Advanced → Admin Access**.

Click **Apply Update**. The button shows **Updating…** while the server fetches the code, reinstalls, rebuilds and shuts down. Then you see "Update applied successfully. Please relaunch the app to use the new version." Start Marinara again to finish.

If it did not work: when **Apply Update** is missing, Marinara shows why.

- Container installs show the image tag and the command `docker compose pull && docker compose up -d` to run on the host.
- Git copies with apply turned off show a manual command you can copy.
- Other installs show a **Download** link to the GitHub release.

## Refresh the app in your browser

**Refresh App** is in the same **Updates** section. It does not update the server. It removes the service worker (a small script your browser uses to load the app fast) and clears the browser caches, then reloads the page. Your chats and settings stay.

Use it when the app looks old or blank after the server already updated. The button shows **Refreshing…** while it works.

## Your data and optional downloads

Upgrading replaces the app code, not your data folder or the `marinara-data` volume. Your chats, characters, personas, lorebooks, presets, connections and settings stay in place. To see where the data lives, read [Backing Up and Restoring Marinara](data/backup-and-restore.md).

- **Optional packages.** When you upgrade from a version that bundled first-party agents, maps, calls or Conversation games, the first start downloads their matching optional packages. Your selections, settings and history stay. Keep the server online for that first start. If the download source cannot be reached, Marinara tries again on the next start and does not delete anything.
- **Guide language.** If you use a downloaded documentation language (**Settings → General → Documentation Language**), the first start after an update refreshes it. If it cannot be reached, Marinara keeps your installed pack, shows missing guides in English and tries again on the next start.
- **Interface language.** UI language packs are a separate, manual download. On the first upgrade from bundled translations, the interface returns to English. Choose your language again in **Settings → General → Language**. Later updates keep downloaded packs. Use **Refresh language pack** for new translations. Missing translations show English.

## Updating from 2.5.0

The steps above are the same. A few changes affect a server that other devices or people use. Open the details if that is you.

<details>
<summary>Changes for shared servers</summary>

- **A reverse proxy or tunnel on the same computer.** Visitors that nginx, Caddy, Cloudflare Tunnel, Tailscale Serve or ngrok pass to Marinara now count as remote. Without a login they see the setup page, and backups and other protected actions need the admin secret. See [Reverse proxies and tunnels on the same computer](REMOTE_ACCESS.md#reverse-proxies-and-tunnels-on-the-same-computer).
- **Tailscale login bypass.** Direct connections to this computer's Tailscale address still skip the login. Other connections from `100.64.0.0/10` no longer skip it, and Tailscale Serve and Funnel visitors need a login. See [Tailscale and Docker bypass](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Docker with a password or an allowlist.** With a login set (an app login or Basic Auth), the browser on the host computer is now asked for it too. The same happens with `TRUSTED_AUTH_PROXY`, unless the proxy is the one that connects. With only `IP_ALLOWLIST` set, the host browser is refused unless you list the container's gateway, so use a login. See [Tailscale and Docker bypass](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Chats and profiles moved to another install.** A chat log, settings profile or full profile no longer carries its **Discord Mirror**, **DeepLX URL**, **DeepL API Key** or **Intiface URL** to a different install. Enter them again there. Your own profiles, and a full profile restored on the same install, keep them.
- **Locked out after updating?** See [Locked out after updating](REMOTE_ACCESS.md#locked-out-after-updating).

</details>

## Downgrading to an older version

Going back is not always possible. Newer versions save data in a newer storage format, and a build refuses data in a format newer than it knows. Current builds use storage format 10. Formats 8, 9 and 10 added MMD avatars, connection account links and GLB/FBX avatars. A build that knows only an older format cannot open data saved in them.

The launcher skips an auto-update that would land on an incompatible version, and the in-app updater refuses to apply one. To go back to an older build, stop Marinara and restore a full backup made before you upgraded. The chat-file conversion command below cannot convert MMD avatar settings. Do not change the format number by hand.

If your data is older than storage format 8, a one-command conversion can put chat files back in the old layout. See [Chats show no messages after switching to an older version](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version).

### Going back to 2.5.0

Version 2.5.0 cannot open data upgraded to storage format 8 or newer. Use a backup made before the upgrade.

With older data that 2.5.0 can open, it does not know what newer features added: some connection settings, the details used to regenerate chat images, and parts of game checkpoints, ruleset clocks and scene videos. When 2.5.0 saves a chat or a connection, for example when you send a message, play a game turn, make an image or change a connection, it drops that newer data from the whole chat or connection. Updating again does not bring it back.

To return to exactly where you were, make a backup before you update. See [Back up first](#back-up-first).

## If an upgrade fails

Most failures come from an old Node.js, a partial download or a stale browser cache.

- If the launcher says Node.js is too old, install Node.js 24 LTS and start again.
- If the app looks broken after the server updated, click **Refresh App**.
- If a git copy cannot update cleanly, use the [manual update](#manual-update-git-copy-no-launcher) commands.

For error messages and fixes, see [Troubleshooting Marinara Engine](TROUBLESHOOTING.md).

## Related guides

- [Backing Up and Restoring Marinara](data/backup-and-restore.md)
- [Troubleshooting Marinara Engine](TROUBLESHOOTING.md)
- [Windows Installation Guide](installation/windows.md)
- [macOS / Linux Installation Guide](installation/macos-linux.md)
- [Run via Container (Docker / Podman)](installation/containers.md)
- [Android (Termux) Installation Guide](installation/android-termux.md)
- [iOS / iPadOS PWA Guide](installation/ios-pwa.md)
