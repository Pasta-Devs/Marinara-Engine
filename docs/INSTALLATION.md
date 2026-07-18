# Guksu Motor Installation

This guide helps you pick the right way to install Guksu Motor for your device. Guksu runs on your own machine, so your chats and data stay local. Each platform below has its own step by step guide, linked from the table.

## Choose your platform

Pick the guide that matches the device you want to run Guksu on.

| Platform | Installation guide |
|---|---|
| Windows | [Windows installation](installation/windows.md) |
| macOS or Linux | [macOS and Linux installation](installation/macos-linux.md) |
| Docker or Podman | [Container installation](installation/containers.md) |
| Android phone or tablet | [Android (Termux) installation](installation/android-termux.md) |
| iPhone or iPad | [iOS and iPadOS](installation/ios-pwa.md) |

A few things to know before you pick:

- On **iPhone or iPad**, Guksu does not run the server itself. You run the server on a computer, a home server, or an Android device. Then you open it in Safari on your iPhone or iPad. The iOS guide explains this.
- On **Android**, Guksu runs inside **Termux**. Termux is a free app that gives Android a small Linux environment. The release APK just helps you set Termux up.

## Which should I pick

If you are new to this and want the least setup, choose one of these:

- On **Windows**, use the **Windows installer**. It downloads and sets up everything for you and adds a desktop shortcut.
- On **macOS**, **Linux**, or a home server, use **Docker**. One command runs the app. The image already contains Node.js, every dependency, and a built copy of the app. You skip installing Node.js and building the app yourself.

If you are comfortable with a terminal and may want to edit the code, run from source instead. "Run from source" means you download the code and build the app on your machine. The **Windows**, **macOS and Linux**, and **Android (Termux)** guides all cover this path.

## Minimal system notes

- You need a computer or device that can run a server: Windows, macOS, Linux, or Android.
- To run from source, you need **Node.js** version 24 and **Git**. Node.js runs the app, and Git downloads and updates the code. The per platform guides link to both downloads.
- **Docker** and **Podman** installs do not need Node.js. The recommended Compose setup still uses Git to download the project files. The container guide covers this.
- By default, the app runs on your own machine at this address:

```text
http://127.0.0.1:7860
```

- The address `127.0.0.1` means your own computer, and `7860` is the default port. To reach Guksu from your phone or another device on your network, see the [FAQ](FAQ.md) for LAN access.

## Where to go after install

Once Guksu is running and open in your browser, read [Getting Started with Guksu Motor](home/welcome.md). It walks you through your first steps: adding a connection, making or importing a character, and starting a chat.

To keep your install up to date later, see [Upgrading Guksu Motor](UPGRADING.md).

## Related guides

- [Windows installation](installation/windows.md)
- [macOS and Linux installation](installation/macos-linux.md)
- [Container installation](installation/containers.md)
- [Android (Termux) installation](installation/android-termux.md)
- [iOS and iPadOS](installation/ios-pwa.md)
- [Upgrading Guksu Motor](UPGRADING.md)
- [Getting Started with Guksu Motor](home/welcome.md)
