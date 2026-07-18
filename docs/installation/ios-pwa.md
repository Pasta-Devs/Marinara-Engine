# iOS / iPadOS PWA Guide

This guide shows how to use Guksu Motor on an iPhone or iPad. iOS and iPadOS cannot run the Guksu server themselves. Instead, you connect to a server on another device and save it to your Home Screen as a web app.

## iOS runs the server on another device

Guksu Motor has two parts: a server that does the real work, and a web app that you view in a browser. On iPhone and iPad, Apple does not let the server run on the device. So you run the server somewhere else, then open it from Safari on your iPhone or iPad.

The server can run on any of these:

- A Windows PC (see [Windows Installation Guide](windows.md)).
- A Mac or Linux machine (see [macOS / Linux Installation Guide](macos-linux.md)).
- An Android phone with Termux (see [Android (Termux) Installation Guide](android-termux.md)).
- A Docker or Podman container (see [Run via Container](containers.md)).

Your iPhone or iPad reaches that server over the network. This is the same idea as opening any website, except the website is your own Guksu server.

## Connect from Safari

Follow these steps once the server is running on the host device.

1. Make sure the host device and your iPhone or iPad are on the same network, or are both on the same Tailscale network. LAN means your local network, like your home Wi-Fi. Tailscale is a free tool that links your devices in a private network over the internet.
2. Find the host server address. It looks like the example below. Replace `<host-ip>` with the host device's LAN or Tailscale IP address. The default port is `7860`.

```
http://<host-ip>:7860
```

3. Open **Safari** on your iPhone or iPad.
4. Type that address into the Safari address bar and go to it.
5. You should see the Guksu home screen load in the browser.

If the page does not load, or you get a password prompt, see the Troubleshooting section below. The server owner controls network access and passwords. Those server settings live in the [Remote Access guide](../REMOTE_ACCESS.md), not on your iPhone or iPad.

## Add to Home Screen

You can save Guksu as a PWA so it opens like a normal app. PWA means Progressive Web App, a website that runs in its own window with its own Home Screen icon.

1. Open your Guksu server in **Safari** (see the steps above).
2. Tap the Share button. It is the square icon with an arrow pointing up.
3. Scroll down the share sheet and tap **Add to Home Screen**.
4. Change the name if you want, then tap **Add**.
5. You should now see a Guksu icon on your Home Screen.

Tap that icon to open Guksu in its own window, without the Safari address bar.

## HTTPS note

PWAs behave most reliably over HTTPS. HTTPS means a secure, encrypted web connection, shown by `https://` at the start of the address.

Plain HTTP over your LAN still works in Safari for normal use. But some iOS or iPadOS versions limit standalone PWA behavior for a plain `http://` address. If that happens, serve Guksu over HTTPS.

Tailscale gives each device a stable private address and improves reachability, but Tailscale alone does not change an `http://` address into HTTPS. Use a Tailscale setup that explicitly serves HTTPS, or ask the server owner to put Guksu behind HTTPS.

These options are explained in the [Remote Access guide](../REMOTE_ACCESS.md). If a plain HTTP address gives you trouble as a Home Screen app, keep it as a Safari bookmark instead.

## Clearing and reinstalling the PWA

Sometimes Safari keeps showing an older version of the app, or the saved web app gets stuck. Reinstalling the Home Screen app usually fixes this.

1. Press and hold the Guksu icon on your Home Screen.
2. Tap the option to remove or delete the app, then confirm.
3. Open the **Settings** app on your iPhone or iPad.
4. Tap **Safari**. On newer iOS and iPadOS versions, it may be under **Apps**, then **Safari**.
5. Tap **Advanced**, then tap **Website Data**.
6. Find the entry for your Guksu host address. If you do not see it, tap **Show All Sites**.
7. Swipe left on that entry, then tap **Delete**. This removes the old saved files for that server.
8. Open Guksu again in **Safari** using the steps in Connect from Safari.
9. Add it to your Home Screen again using the steps in Add to Home Screen.

Your chats, characters, and settings are stored on the server, not on your iPhone or iPad. Reinstalling the Home Screen app does not delete them.

## Troubleshooting

**The page will not load in Safari.** Check that the server is still running on the host device. Check that both devices are on the same network or Tailscale. Confirm the IP address and the port `7860` are correct. For deeper network help, see the [Remote Access guide](../REMOTE_ACCESS.md) and [Troubleshooting Guksu Motor](../TROUBLESHOOTING.md).

**Safari asks for a username and password.** The server owner turned on password protection for remote devices. Get the username and password from whoever runs the server. The setup is covered in the [Remote Access guide](../REMOTE_ACCESS.md).

**Safari keeps showing an old build.** Reload the page first. If it still looks old, follow the Clearing and reinstalling the PWA steps above.

**A red banner says saves will silently fail.** This is a network trust warning from the server, not an iPhone or iPad problem. The server owner needs to trust your address. See the [Remote Access guide](../REMOTE_ACCESS.md) and [Troubleshooting Guksu Motor](../TROUBLESHOOTING.md).

**Privileged actions are blocked.** Some maintenance actions need an admin secret from the server owner. On your iPhone or iPad, you save that value in **Settings**, then **Advanced**, then **Admin Access**. The [Remote Access guide](../REMOTE_ACCESS.md) explains what the admin secret is and how to get one.

## Related guides

- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
- [Frequently Asked Questions](../FAQ.md)
- [Troubleshooting Guksu Motor](../TROUBLESHOOTING.md)
- [Android (Termux) Installation Guide](android-termux.md)
