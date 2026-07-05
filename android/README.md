# Marinara Engine - Android APK

The Android app is a Termux bootstrap + WebView shell for Marinara Engine. It is not a native Android server build, but it can help launch the Termux setup flow and then opens the local Marinara server in a fullscreen WebView.

> **Android permission reality:** Android does not allow an ordinary APK to silently install another app or run commands inside Termux without user approval. First launch may still ask the user to install Termux, grant **Run commands in Termux environment** permission, and enable Termux external commands.

## How It Works

- If Marinara Engine is already running in Termux, the APK opens `http://127.0.0.1:<PORT>` inside a fullscreen WebView. The default build-time port is `7860`.
- If the server is not running, the APK shows bootstrap actions: **Install / Start Marinara**, **Get Termux manually**, and **Retry connection**.
- **Install / Start Marinara** downloads the current suggested Termux APK from F-Droid when Termux is missing, hands it to Android's package installer, then continues setup after the user approves the install.
- After Termux is installed, **Install / Start Marinara** uses Termux's `RUN_COMMAND` integration to run the Marinara Termux installer command. This requires the Android **Run commands in Termux environment** permission to be granted to Marinara Engine, and `allow-external-apps=true` to be enabled in Termux.
- If Termux blocks external commands, the APK copies the required `allow-external-apps` command to the clipboard and opens Termux so the user can paste it once.
- The server, launcher updates, and `AUTO_OPEN_BROWSER` behavior are still owned by the Termux launcher, not by this APK.
- Release and versioning policy follows the main repo docs in [../CONTRIBUTING.md](../CONTRIBUTING.md): root `package.json` is canonical, Android `versionName` should match the app version, and `versionCode` must increase for every shipped APK.
- If you build the APK with a non-default port, Termux must use the same `PORT` value in `.env`.

**Fast path:** install the APK, open it, tap **Install / Start Marinara**, approve Android/Termux prompts, wait for the Termux launcher to finish, then return to the Marinara Engine app.

**Manual fallback:** install Termux from F-Droid, paste the fresh-Termux command below so it creates/updates the Marinara folder, then open the Marinara Engine Android app.

## Features

- Native app icon on the home screen
- Full-screen app-like experience without browser chrome
- First-run bootstrap actions for Termux install/start handoff
- Automatic retry while the local server is still starting
- File upload support for character cards, images, and similar assets
- Back button navigation inside the WebView
- External links open in your default browser
- Android backup is disabled for the wrapper app, and the WebView disallows file URL access and mixed-content loading.

## Building the APK

### Prerequisites

- **Java 17+** — `brew install openjdk@17` (macOS) or `pkg install openjdk-17` (Termux)
- **Android SDK** — Set the `ANDROID_HOME` environment variable
- **Gradle** — `brew install gradle` (macOS) or `pkg install gradle` (Termux)

### Build

```bash
cd android

# Debug APK (for testing)
./build-apk.sh

# Release APK
./build-apk.sh release

# Optional: build against a different local server port
MARINARA_PORT=9000 ./build-apk.sh
```

Build outputs:

- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release: `app/build/outputs/apk/release/app-release.apk` (signed with your `ANDROID_SIGNING_*` keystore when set, otherwise debug-signed)

### Install

```bash
# Via ADB
adb install app/build/outputs/apk/debug/app-debug.apk

# Or transfer the APK file to your phone and open it there
```

## Building on Termux (on-device)

You can build the APK directly on your Android device:

```bash
# Install prerequisites
pkg install openjdk-17 gradle

# Set ANDROID_HOME (adjust if your SDK is elsewhere)
export ANDROID_HOME=$HOME/android-sdk

# Build
cd android
./build-apk.sh
```

## Usage

### Bootstrap Path

1. Install the APK from the GitHub Release.
2. Open **Marinara Engine**.
3. If the server is not running, tap **Install / Start Marinara**.
4. If Termux is missing, approve Android's install prompts so Marinara can install the F-Droid Termux APK.
5. If Android asks for **Run commands in Termux environment**, grant it.
6. If Termux blocks external commands, paste the copied `allow-external-apps` command in Termux once, then tap **Install / Start Marinara** again.
7. Wait for Termux to finish installing dependencies, building Marinara Engine, and starting the local server.
8. Return to **Marinara Engine**. The WebView shell connects automatically once the server is ready.

### Manual Path

On a fresh Termux install, paste this command first:

```bash
pkg update -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

After Marinara has been installed once, start it again in Termux:

```bash
cd "$HOME/Marinara-Engine"
./start-termux.sh
```

To skip the update check and start the already-installed local copy, run `./start-termux.sh --skip-update`.

Then open the **Marinara Engine** app from your home screen. The app shows "Connecting..." until the local server is ready, then loads automatically.

Because the APK points at `http://127.0.0.1:<PORT>`, it only works while the Marinara Engine server is running on the same Android device and using the same port value.

## Pre-built APKs

When maintainers attach them to a tagged release, pre-built APKs are available on the main [Releases](https://github.com/Pasta-Devs/Marinara-Engine/releases) page.

Release APKs include the bootstrap controls above. They still rely on Termux for the local Linux/Node runtime, and Android still requires the user-visible permission handoff before the APK can ask Termux to install or start Marinara Engine.
