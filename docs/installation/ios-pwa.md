# iOS / iPadOS PWA Guide

Use Marinara Engine on an iPhone or iPad. Apple does not let the Marinara server run on these devices, so you open a server that runs on another device in Safari. Then you can save it to your Home Screen as a PWA. A PWA (Progressive Web App) is a website that opens in its own window, like an app.

## Quick path

1. Install and start Marinara on a computer, home server or Android phone (see the list below). Keep it running.
2. Set a login on that computer. See [Remote Access](../REMOTE_ACCESS.md#option-1-login-recommended).
3. Find the computer's IP address (see below).
4. On your iPhone or iPad, open **Safari** and go to `http://` followed by that IP address and `:7860`.

Do not use `127.0.0.1` on your iPhone or iPad. That address means the iPhone itself.

## Where the server runs

The server can run on:

- A Windows PC: [Windows Installation Guide](windows.md).
- A Mac or Linux computer: [macOS / Linux Installation Guide](macos-linux.md).
- An Android phone with Termux: [Android (Termux) Installation Guide](android-termux.md).
- A Docker or Podman container: [Run via Container](containers.md).

## Connect from Safari

Before you start: the server must be running and allow your device in, usually with a login. See [Remote Access](../REMOTE_ACCESS.md).

1. Put the server device and your iPhone or iPad on the same network, such as your home Wi-Fi. To connect from elsewhere, use Tailscale, a free tool that links your devices in a private network over the internet.
2. Find the server device's IP address. On the server computer, run one command in a terminal (a window where you type commands) and read the address, which looks like `192.168.1.42`.

   - Windows (Command Prompt): `ipconfig`. Read the **IPv4 Address**.
   - Linux: `hostname -I`.
   - macOS: `ipconfig getifaddr en0`.

3. Open **Safari** and go to this address. Replace `<host-ip>` with that IP address. The default port is `7860`.

```text
http://<host-ip>:7860
```

4. The Marinara home screen loads.

If you see a sign-in page, sign in with the server's username and password. If you see a setup page, type the one-time setup code from the server's log and choose a username and password. See [Remote Access](../REMOTE_ACCESS.md).

If it did not work: check that the server is still running and that both devices are on the same network or Tailscale. Check the IP address and port. See [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Add to Home Screen

1. Open your Marinara server in **Safari**.
2. Tap the Share button, the square icon with an arrow pointing up.
3. Scroll down the share sheet and tap **Add to Home Screen**.
4. Change the name if you want, then tap **Add**.

A Marinara icon appears on your Home Screen. Tap it to open Marinara in its own window, without the Safari address bar.

## Use HTTPS if the app misbehaves

A PWA works best over HTTPS, a secure connection that starts with `https://`. A plain `http://` address works in Safari. Some iOS and iPadOS versions limit a Home Screen app on a plain `http://` address. If that happens, serve Marinara over HTTPS, or keep it as a Safari bookmark.

Tailscale alone does not make an address HTTPS. Use a Tailscale setup that serves HTTPS, or ask the server owner to put Marinara behind HTTPS. See [Remote Access](../REMOTE_ACCESS.md#serving-over-https).

## Clearing and reinstalling the PWA

Safari sometimes keeps an older version of the app, or the saved app gets stuck. Reinstalling it usually fixes this. Your chats, characters and settings are on the server, so reinstalling does not delete them.

1. Press and hold the Marinara icon on your Home Screen.
2. Tap the option to remove the app, then confirm.
3. Open the **Settings** app on your iPhone or iPad.
4. Tap **Safari**. On newer iOS and iPadOS versions, it may be under **Apps**, then **Safari**.
5. Tap **Advanced**, then **Website Data**.
6. Find the entry for your Marinara address. If you do not see it, tap **Show All Sites**.
7. Swipe left on the entry and tap **Delete**.
8. Open Marinara in **Safari** again and add it to the Home Screen again, using the steps above.

## Troubleshooting

**The page will not load in Safari.** Check that the server is running, that both devices are on the same network or Tailscale, and that the IP address and port `7860` are right. See [Remote Access](../REMOTE_ACCESS.md) and [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

**Safari shows a sign-in or setup page after an update.**

- Sign in on `/login` with the server's username and password.
- If no login exists, type the one-time setup code from the server log on the setup page.
- If the server prints no code, set the login on the server device under **Settings → Advanced → Access**.
- A **403** can mean your iPhone is not in `IP_ALLOWLIST`. The server owner changes that list.
- The PWA cannot reset the server login. The server owner runs `node scripts/reset-login.mjs` in the Marinara folder on the server (in Docker: `docker exec <container> node scripts/reset-login.mjs`), or changes a login set in `.env`.

See [Locked out after updating](../REMOTE_ACCESS.md#locked-out-after-updating).

**Safari keeps showing an old build.** Reload the page. If it still looks old, reinstall the PWA with the steps above.

**The Home Screen app closes or turns blank during generation.** Reopen it and return to the chat. A healthy server keeps working: chat replies and Illustrator image requests keep running on the server, and the reopened chat refreshes when they finish. **Stop** still cancels the generation in the selected chat. If the blank screen keeps coming back, report it with your Support Diagnostics.

**A red banner says saves will silently fail.** This is a network trust warning from the server, not a problem with your iPhone or iPad. The server owner needs to trust your address. See [Remote Access](../REMOTE_ACCESS.md#why-is-my-save-blocked-csrf).

**Privileged actions are blocked.** Some maintenance actions need the admin secret (a second password) from the server owner. Save it on your iPhone or iPad in **Settings → Advanced → Admin Access**. See [Remote Access](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).

## Related guides

- [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md)
- [Frequently Asked Questions](../FAQ.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
- [Android (Termux) Installation Guide](android-termux.md)
