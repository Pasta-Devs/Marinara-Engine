# Android (Termux) Installation Guide

Run Marinara Engine on an Android phone or tablet. Marinara runs inside Termux, a free app that gives your phone a small Linux system. You can set it up with the Marinara Android app (easiest) or by hand in Termux.

## About Termux and F-Droid

Marinara is a Linux server, not a native Android app, so it needs Termux to run. F-Droid is a free, open-source app store. The Android app's setup downloads the stable F-Droid build of Termux. Termux also has an experimental Google Play build. If it is already installed, Marinara accepts it, but this guide recommends F-Droid.

Install Termux from [Termux on F-Droid](https://f-droid.org/en/packages/com.termux/). Do not mix Termux or its plugin apps from different sources, because their signatures must match. See [Termux's official installation notes](https://github.com/termux/termux-app#installation).

## Install with the Android app

The Marinara Engine Android app is a small helper. It sets up Termux, then opens Marinara when the local server is running. Android asks you to approve a few system prompts on the way.

1. Tap [Download the latest Android APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). An APK is an Android app install file.
2. Install the APK, then open the app.
3. Tap **Install / Start Marinara**.
4. If Termux is not installed, approve Android's install prompts so the app can install it from F-Droid.
5. When Android asks, grant the **Run commands in Termux environment** permission.
6. If Termux blocks the setup, the app copies an `allow-external-apps` command. Paste it into Termux once, then tap **Install / Start Marinara** again.
7. Wait while Termux installs the dependencies and builds Marinara. The first build takes a few minutes.
8. Return to the Marinara Engine app when Termux finishes. It connects and signs in by itself when the server is ready.

To use your browser instead, select **Open in browser** on the app's launcher. The app remembers the choice, and sign-in is automatic there too.

The pre-built APK needs no signing key, password or `CSRF_TRUSTED_ORIGINS` change. The app creates its own private localhost credential. Do not add `null` to `CSRF_TRUSTED_ORIGINS`.

If it did not work: tap **Install / Start Marinara** again after you fix the prompt that blocked it. If the app cannot open localhost, update the APK and tap **Install / Start Marinara**. See [Android localhost login help](../TROUBLESHOOTING.md#android-localhost-opens-the-login-page-or-returns-401503).

## Install by hand in Termux

Use this if you do not want the app. Open Termux and paste this one command:

```text
pkg upgrade -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

The command does five things:

1. Upgrades all Termux packages. Termux does not support upgrading only some packages: a newer Node.js cannot start with older Termux libraries. If it asks whether to keep a configuration file, press Enter to keep yours.
2. Installs Git and Node.js. Marinara supports Node.js 24, 25 and 26.
3. Downloads Marinara, unless it is already there.
4. Makes the launcher (`start-termux.sh`) runnable.
5. Runs the launcher.

The launcher installs the dependencies, builds Marinara on your device and starts the local server. It upgrades Node.js if your version is too old. The first run is slow. Later runs are faster.

When it finishes, open this address in your Android browser:

```text
http://127.0.0.1:7860
```

If you set a different `PORT`, use that number. To get an app-like icon, use your browser's menu option that adds the page to the home screen. The name differs between browsers.

## Start and stop Marinara

With the app, open it and tap **Install / Start Marinara** if the server is stopped. It reuses a running server. To switch between the app and your browser, use **Open in browser** on the launcher, then **Retry connection**. From inside the app, go back to the launcher with **Settings → General → App Behavior → Open Android launcher (app or browser)**. Do not reuse an expired one-time browser link from your history.

With a manual install, open Termux and run:

```bash
cd Marinara-Engine
./start-termux.sh
```

To stop the server, press <kbd>Ctrl</kbd>+<kbd>C</kbd> in Termux.

## Update Marinara

Each time you run `./start-termux.sh`, the launcher checks GitHub for a newer version and updates before it starts. To start without updating, add `--skip-update`. For more options and the APK update steps, see [Upgrading Marinara Engine](../UPGRADING.md#android-termux).

The launcher also removes unused packages from its local pnpm cache during updates. This stops old releases from filling several gigabytes of storage. It does not touch your chats or settings.

## Open Marinara from another device

The launcher lets other devices on your Wi-Fi reach Marinara, but it blocks them until you set a login. See the [FAQ](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) and [Remote Access](../REMOTE_ACCESS.md).

If another device cannot sign in after an update, see [Locked out after updating](../REMOTE_ACCESS.md#locked-out-after-updating). In Termux, you can remove the app login with this command:

```bash
cd "$HOME/Marinara-Engine" && pnpm reset-login
```

## Build notes

- The low-memory build includes all required client assets.
- Sharp's WebAssembly image fallback is installed automatically and kept through updates. You do not need a separate Android Sharp version.

## Related guides

- [Marinara Engine Installation](../INSTALLATION.md)
- [iOS / iPadOS PWA Guide](ios-pwa.md)
- [Upgrading Marinara Engine](../UPGRADING.md)
- [Frequently Asked Questions](../FAQ.md)
