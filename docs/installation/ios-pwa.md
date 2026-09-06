# iOS / iPadOS PWA Guide

This guide shows how to use Marinara Engine on an iPhone or iPad. iOS and iPadOS cannot run the Marinara server themselves. Instead, you connect to a server on another device and save it to your Home Screen as a web app.

## iOS runs the server on another device

Marinara Engine has two parts: a server that does the real work, and a web app that you view in a browser. On iPhone and iPad, Apple does not let the server run on the device. So you run the server somewhere else, then open it from Safari on your iPhone or iPad.

The server can run on any of these:

- A Windows PC (see [Windows Installation Guide](windows.md)).
- A Mac or Linux machine (see [macOS / Linux Installation Guide](macos-linux.md)).
- An Android phone with Termux (see [Android (Termux) Installation Guide](android-termux.md)).
- A Docker or Podman container (see [Run via Container](containers.md)).

Your iPhone or iPad reaches that server over the network. This is the same idea as opening any website, except the website is your own Marinara server.

## Connect from Safari

Follow these steps once the server is running on the host device.

1. Make sure the host device and your iPhone or iPad are on the same network, or are both on the same Tailscale network. LAN means your local network, like your home Wi-Fi. Tailscale is a free tool that links your devices in a private network over the internet.
2. Find the host server address. It looks like the example below. Replace `<host-ip>` with the host device's LAN or Tailscale IP address. The default port is `7860`.

```
http://<host-ip>:7860
```

3. Open **Safari** on your iPhone or iPad.
4. Type that address into the Safari address bar and go to it.
5. You should see the Marinara home screen load in the browser.

If the page does not load, or you get a password prompt, see the Troubleshooting section below. The server owner controls network access and passwords. Those server settings live in the [Remote Access guide](../REMOTE_ACCESS.md), not on your iPhone or iPad.

## Add to Home Screen

You can save Marinara as a PWA so it opens like a normal app. PWA means Progressive Web App, a website that runs in its own window with its own Home Screen icon.

1. Open your Marinara server in **Safari** (see the steps above).
2. Tap the Share button. It is the square icon with an arrow pointing up.
3. Scroll down the share sheet and tap **Add to Home Screen**.
4. Change the name if you want, then tap **Add**.
5. You should now see a Marinara icon on your Home Screen.

Tap that icon to open Marinara in its own window, without the Safari address bar.

## HTTPS note

PWAs behave most reliably over HTTPS. HTTPS means a secure, encrypted web connection, shown by `https://` at the start of the address.

Plain HTTP over your LAN still works in Safari for normal use. But some iOS or iPadOS versions limit standalone PWA behavior for a plain `http://` address. If that happens, serve Marinara over HTTPS.

Tailscale gives each device a stable private address and improves reachability, but Tailscale alone does not change an `http://` address into HTTPS. Use a Tailscale setup that explicitly serves HTTPS, or ask the server owner to put Marinara behind HTTPS.

These options are explained in the [Remote Access guide](../REMOTE_ACCESS.md). If a plain HTTP address gives you trouble as a Home Screen app, keep it as a Safari bookmark instead.

## Clearing and reinstalling the PWA

Sometimes Safari keeps showing an older version of the app, or the saved web app gets stuck. Reinstalling the Home Screen app usually fixes this.

1. Press and hold the Marinara icon on your Home Screen.
2. Tap the option to remove or delete the app, then confirm.
3. Open the **Settings** app on your iPhone or iPad.
4. Tap **Safari**. On newer iOS and iPadOS versions, it may be under **Apps**, then **Safari**.
5. Tap **Advanced**, then tap **Website Data**.
6. Find the entry for your Marinara host address. If you do not see it, tap **Show All Sites**.
7. Swipe left on that entry, then tap **Delete**. This removes the old saved files for that server.
8. Open Marinara again in **Safari** using the steps in Connect from Safari.
9. Add it to your Home Screen again using the steps in Add to Home Screen.

Your chats, characters, and settings are stored on the server, not on your iPhone or iPad. Reinstalling the Home Screen app does not delete them.

## Troubleshooting

**The page will not load in Safari.** Check that the server is still running on the host device. Check that both devices are on the same network or Tailscale. Confirm the IP address and the port `7860` are correct. For deeper network help, see the [Remote Access guide](../REMOTE_ACCESS.md) and [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

**Safari asks for a username and password.** The server owner turned on password protection for remote devices. Get the username and password from whoever runs the server. The setup is covered in the [Remote Access guide](../REMOTE_ACCESS.md).

**Safari keeps showing an old build.** Reload the page first. If it still looks old, follow the Clearing and reinstalling the PWA steps above.

**The Home Screen app closes or turns blank during generation.** Reopen it and return to the chat. You do not need to restart a healthy server. Automatic chat replies and Illustrator-only manual or retried image requests keep running on the server after a lost browser connection. The reopened chat checks for unfinished work and refreshes saved messages and gallery images when it finishes. **Stop** still cancels the selected chat's generation. If the blank screen keeps returning, report your Support Diagnostics and whether reopening restores the chat; this recovery does not diagnose or prevent every iOS browser failure.

**A red banner says saves will silently fail.** This is a network trust warning from the server, not an iPhone or iPad problem. The server owner needs to trust your address. See the [Remote Access guide](../REMOTE_ACCESS.md) and [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

**Privileged actions are blocked.** Some maintenance actions need an admin secret from the server owner. On your iPhone or iPad, you save that value in **Settings**, then **Advanced**, then **Admin Access**. The [Remote Access guide](../REMOTE_ACCESS.md) explains what the admin secret is and how to get one.

## Related guides

- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
- [Frequently Asked Questions](../FAQ.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
- [Android (Termux) Installation Guide](android-termux.md)
