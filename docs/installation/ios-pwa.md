# iOS / iPadOS PWA Guide

Marinara Engine does not run the local server directly on iOS or iPadOS. Use one of the desktop, Docker, Linux, macOS, Windows, or Android Termux install paths to run the server, then open that server from Safari on your iPhone or iPad.

## Wrapper Status

iPhone and iPad currently use the Safari PWA path. A one-tap jailbroken/sideloaded iOS bootstrap wrapper is still future work because it needs a separate iOS package, a local terminal/runtime strategy, and device-specific permission handling. The Android APK bootstrap does not apply to iOS.

## Connect from Safari

1. Start Marinara Engine on the host device.
2. If the iPhone or iPad is a different device, make sure the server is bound to `0.0.0.0`. The shell launchers do this by default; manual `pnpm start` users can set `HOST=0.0.0.0` in `.env`.
3. Open Safari and visit `http://<host-ip>:7860`, replacing `<host-ip>` with the host device's LAN or Tailscale address.
4. For ordinary LAN clients, configure `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` on the server. Tailscale clients are trusted by default unless `BYPASS_AUTH_TAILSCALE=false` is set.
5. For privileged actions from iOS, set `ADMIN_SECRET` on the server and save the same value in **Settings → Advanced → Admin Access**.

## Add to Home Screen

In Safari, open the Share sheet and choose **Add to Home Screen**. HTTPS gives the most reliable PWA behavior. Plain HTTP LAN access still works in Safari for normal use, but if your iOS version refuses standalone PWA behavior for that address, keep it bookmarked or put Marinara behind HTTPS.

## Updating

Update the server through the platform guide used by the host device. The iOS PWA loads the updated client from that server after a reload.

You can open **Settings → Advanced → Updates** from iPhone or iPad to check the host server version. **Apply Update** updates the host server, not the iPhone shell itself, and only works when the host is a git install with `UPDATES_APPLY_ENABLED=true`, `UPDATES_ALLOW_REMOTE_APPLY=true`, `ADMIN_SECRET` set on the server, and the same secret saved in **Settings → Advanced → Admin Access**. Docker hosts show the container pull command instead.

If Safari keeps showing an older build, remove the Home Screen icon, clear Safari website data for the Marinara host, then add it again.

## See Also

- [FAQ — LAN access](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device)
- [Remote Access](../REMOTE_ACCESS.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
