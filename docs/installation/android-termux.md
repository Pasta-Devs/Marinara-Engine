# Android (Termux) Installation Guide

This guide shows you how to run Marinara Engine on an Android phone or tablet. Marinara runs inside Termux, a free Linux environment for Android. You can set it up the easy way with the Android app, or by hand in the Termux terminal.

## What Termux and F-Droid are

Termux is a free app that gives your phone a small Linux system and a command line. Marinara Engine needs it because Marinara is a Linux server, not a native Android app.

F-Droid is a free, open-source app store for Android. Marinara's automatic setup downloads the stable F-Droid build of Termux. Termux also has a separate experimental Google Play build; if it is already installed, Marinara recognizes its official signer, but F-Droid remains the recommended path for this guide.

Install Termux from F-Droid here: [Termux on F-Droid](https://f-droid.org/en/packages/com.termux/). Do not mix Termux or its plugin apps from different sources because their signatures must match. See [Termux's official installation notes](https://github.com/termux/termux-app#installation) for the source-specific details.

## Install with the Android app (APK)

The easiest path uses the Marinara Engine Android app. An APK is an Android app install file. This app is a small helper: it sets up Termux for you, then opens Marinara once the local server is running. It still needs Termux to do the real work, so Android will ask you to approve a few system prompts. Installing the pre-built APK does not require a signing key, password, local-access secret, or `CSRF_TRUSTED_ORIGINS` change. The app generates and exchanges its private localhost credential automatically. Do not add `null` to `CSRF_TRUSTED_ORIGINS`; it is intentionally treated as unset and is not needed by the APK handshake.

1. Tap [Download the latest Android APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk).
2. Install the APK, then open the app.
3. Tap **Install / Start Marinara**.
4. If Termux is not installed yet, approve Android's install prompts so the app can download and install Termux from F-Droid.
5. When Android asks, grant the **Run commands in Termux environment** permission.
6. If Termux blocks the setup, the app copies an `allow-external-apps` command for you. Paste that command into Termux once, then tap **Install / Start Marinara** again.
7. Wait while Termux installs the dependencies and builds Marinara. The first build takes a few minutes.
8. Return to the Marinara Engine app when Termux finishes. The app connects and signs in automatically once the local server is ready.

If you prefer a home-screen icon that opens Marinara like a normal app, this same Android app provides it. It is a wrapper around the Termux server, so the server must be set up first. It cannot skip Android's install and permission prompts, but it does not ask you to configure any Marinara installation secret.

## Install manually in Termux

If you would rather not use the app, you can install Marinara by hand. Open Termux and paste this one command:

```
pkg update -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

This one command does five things:

1. Updates the Termux packages.
2. Installs Git and Node.js. Marinara supports Node.js versions 24, 25, and 26.
3. Downloads Marinara Engine, unless it is already installed.
4. Makes the launcher (the `start-termux.sh` script) runnable.
5. Runs the launcher for the first time.

The launcher installs the app's dependencies, builds Marinara on your device, and starts the local server. It also upgrades Node.js for you if your version is too old. The first run is slow because it builds the app. Later runs are much faster.

When it finishes, open this address in your Android browser:

```
http://127.0.0.1:7860
```

Marinara listens on the port set by `PORT` (the network port the app uses). The default is 7860. If you set a different `PORT`, use that number instead.

Tip: to get an app-like icon, open your browser menu and choose the option that adds Marinara to your home screen. The exact menu name differs between browsers.

## Start Marinara again

After the first setup, you do not repeat the install. Open Termux and run:

```
cd Marinara-Engine
./start-termux.sh
```

The launcher checks for updates, then starts Marinara. To start your current copy without checking GitHub, add `--skip-update`:

```
cd Marinara-Engine
./start-termux.sh --skip-update
```

The launcher also removes unreferenced packages from its local pnpm cache during dependency updates. This keeps old releases from accumulating several gigabytes on the phone; it does not touch Marinara chats, settings, or other user data.

## Access from another device

By default, the launcher makes Marinara reachable on your local network. This means a laptop or another phone on the same Wi-Fi can open it. For step-by-step instructions on finding the right address, see the [Frequently Asked Questions](../FAQ.md).

## Updating

Each time you run the launcher (`./start-termux.sh`), it checks GitHub for a newer version and updates before it starts. So the simple way to stay current is to just start Marinara normally.

To start your installed copy without updating, use the skip flag:

```
./start-termux.sh --skip-update
```

To keep the installed Engine version across launches, add `AUTO_UPDATE_ENABLED=false` to the project `.env`. This does not disable manual update commands or **Settings → Advanced → Updates**.

You can also check for updates inside the app. Open **Settings**, go to the **Advanced** tab, and open the **Updates** section. Click **Check for Updates** to see if a newer release exists. The in-app **Apply Update** button is off by default and needs setup. For how to enable and use it, see [Upgrading Marinara Engine](../UPGRADING.md).

## Related guides

- [Marinara Engine Installation](../INSTALLATION.md)
- [iOS / iPadOS PWA Guide](ios-pwa.md)
- [Upgrading Marinara Engine](../UPGRADING.md)
- [Frequently Asked Questions](../FAQ.md)
