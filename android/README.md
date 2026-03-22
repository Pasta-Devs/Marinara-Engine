# Marinara Engine — Android APK

A lightweight Android WebView wrapper that provides a native app experience for Marinara Engine running on Termux.

## How It Works

The APK is a thin client shell — it opens a WebView pointed at `http://localhost:7860` where the Marinara Engine server runs. The server itself still runs in Termux.

**Flow:** Start server in Termux → Open the Marinara Engine app

## Features

- Native app icon on home screen
- Full-screen standalone experience (no browser chrome)
- Automatic retry when server isn't ready yet
- File upload support (character cards, images, etc.)
- Back button navigates within the app
- External links open in your default browser

## Building the APK

### Prerequisites

- **Java 17+** — `brew install openjdk@17` (macOS) or `pkg install openjdk-17` (Termux)
- **Android SDK** — Set `ANDROID_HOME` environment variable
- **Gradle** — `brew install gradle` (macOS) or `pkg install gradle` (Termux)

### Build

```bash
cd android

# Debug APK (for testing)
./build-apk.sh

# Release APK
./build-apk.sh release
```

The APK will be at:

- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release: `app/build/outputs/apk/release/app-release-unsigned.apk`

### Install

```bash
# Via ADB
adb install app/build/outputs/apk/debug/app-debug.apk

# Or transfer the APK file to your phone and open it
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

1. Start Marinara Engine in Termux:

   ```bash
   ./start-termux.sh
   ```

2. Open the **Marinara Engine** app from your home screen
3. The app will show "Connecting…" until the server is ready, then load automatically

## Pre-built APK

Pre-built APKs are available on the [Releases](https://github.com/nicholasgriffintn/marinara-engine/releases) page. Download and install — no build tools needed.
