# Marinara Engine Installation

Marinara runs on your own device. Pick the guide for your device below.

## Choose your platform

| Your device | Guide |
| --- | --- |
| Windows | [Windows installation](installation/windows.md) |
| macOS or Linux | [macOS and Linux installation](installation/macos-linux.md) |
| Docker or Podman | [Container installation](installation/containers.md) |
| Android phone or tablet | [Android installation guide](installation/android-termux.md) |
| iPhone or iPad | [iOS and iPadOS](installation/ios-pwa.md) |

## Which one should I pick?

- **Windows:** use the Windows installer. It sets up everything and adds a desktop shortcut.
- **Android:** [download the APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Open the downloaded file, then tap **Install / Start Marinara** in the app.
- **macOS, Linux or a home server:** pick one. The native guide runs Marinara straight on your computer with a launcher script. Docker needs no Node.js and builds nothing, but you install Docker first.
- **iPhone or iPad:** Marinara cannot run the server on these devices. Run it on a computer, a home server or an Android device, then open it in Safari. The iOS guide explains how.
- **You want to edit the code:** run from source. This means you download the code and build the app on your device. The Windows, macOS and Linux, and Android guides all cover it.

On Android, Marinara runs inside **Termux**, a free Android app that gives your phone a small Linux system. The APK sets Termux up for you.

## What you need

- To run from source: **Node.js** 24, 25 or 26, and **Git**. Node.js runs the app. Git downloads the code and updates it. The platform guides link to both downloads.
- For Docker or Podman: no Node.js. The recommended Compose setup uses Git once, to download the project files.

## Open Marinara

When Marinara is running, open this address in a browser on the same device. Do not use it from another device.

```text
http://127.0.0.1:7860
```

`127.0.0.1` means this device. `7860` is the default port, the number the app listens on. The launchers (the scripts that start Marinara) also let other devices on your network reach it, but they stay blocked until you set a login. A Docker or Podman install only answers on this device until you change its port line; see [Containers](installation/containers.md#open-marinara-from-another-device).

## Open Marinara on your phone

1. Install and start Marinara on a computer, home server or Android phone.
   With Docker or Podman, first follow [Open Marinara from another device](installation/containers.md#open-marinara-from-another-device).
2. Set a login there. See [Remote Access](REMOTE_ACCESS.md#option-1-login-recommended).
3. Find that device's IP address. The [FAQ](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) shows how.
4. On your phone, open `http://` followed by the IP address and `:7860`.

For an iPhone, see [iOS and iPadOS](installation/ios-pwa.md).

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
