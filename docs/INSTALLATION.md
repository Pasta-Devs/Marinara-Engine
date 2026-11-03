# Marinara Engine Installation

Marinara runs on your own device, so your chats and data stay with you. Pick the guide for your device below.

## Choose your platform

| Your device | Guide |
| --- | --- |
| Windows | [Windows installation](installation/windows.md) |
| macOS or Linux | [macOS and Linux installation](installation/macos-linux.md) |
| Docker or Podman | [Container installation](installation/containers.md) |
| Android phone or tablet | [Download the APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk), then read the [Android installation guide](installation/android-termux.md) |
| iPhone or iPad | [iOS and iPadOS](installation/ios-pwa.md) |

## Which one should I pick?

- **Windows:** use the Windows installer. It sets up everything and adds a desktop shortcut.
- **Android:** use the APK. Open the downloaded file, then tap **Install / Start Marinara** in the app.
- **macOS, Linux or a home server:** use Docker. One command runs the app, and you do not install Node.js or build anything.
- **iPhone or iPad:** Marinara cannot run the server on these devices. Run it on a computer, a home server or an Android device, then open it in Safari. The iOS guide explains how.
- **You want to edit the code:** run from source. This means you download the code and build the app on your device. The Windows, macOS and Linux, and Android guides all cover it.

On Android, Marinara runs inside **Termux**, a free Android app that gives your phone a small Linux system. The APK sets Termux up for you.

## What you need

- To run from source: **Node.js** 24, 25 or 26, and **Git**. Node.js runs the app. Git downloads the code and updates it. The platform guides link to both downloads.
- For Docker or Podman: no Node.js. The recommended Compose setup uses Git once, to download the project files.

## Open Marinara

When Marinara is running, open this address in a browser on the same device:

```text
http://127.0.0.1:7860
```

`127.0.0.1` means this device and `7860` is the default port. The launchers also let other devices on your network reach Marinara, but they stay blocked until you set a login. To open Marinara from another device, see [Remote Access](REMOTE_ACCESS.md) and the [FAQ](FAQ.md).

## After you install

Read [Getting Started with Marinara Engine](home/welcome.md) to add a connection, make or import a character and start a chat. To update later, see [Upgrading Marinara Engine](UPGRADING.md).

## Related guides

- [Windows installation](installation/windows.md)
- [macOS and Linux installation](installation/macos-linux.md)
- [Container installation](installation/containers.md)
- [Android (Termux) installation](installation/android-termux.md)
- [iOS and iPadOS](installation/ios-pwa.md)
- [Upgrading Marinara Engine](UPGRADING.md)
- [Getting Started with Marinara Engine](home/welcome.md)
