# Troubleshooting

Common issues and fixes for Marinara Engine. Platform-specific installation problems are also covered in each [installation guide](INSTALLATION.md).

---

## Windows: `EPERM: operation not permitted` when installing pnpm

If you see an error like `EPERM: operation not permitted, open 'C:\Program Files\nodejs\yarnpkg'` or a corepack signature verification failure, corepack could not write to `C:\Program Files\nodejs\`.

**Fix — pick one:**

1. **Run as Administrator** — Right-click your terminal (CMD or PowerShell), select "Run as administrator", then run `start.bat` again.
2. **Install pnpm manually** — Run `npm install -g pnpm`, then run `start.bat` again.
3. **Update corepack** — Run `npm install -g corepack`, `corepack enable`, and `corepack prepare pnpm@10.30.3 --activate` in an Administrator terminal.

---

## Data Seems Missing After an Update

If your chats or presets appear to be missing after updating, **do not delete any data folders yet**. Recent path changes can make the app open a different SQLite file without erasing the old one.

Check both local data locations:

1. `packages/server/data/`
2. `data/`

Look for `marinara-engine.db` plus any `-wal` and `-shm` companion files. The server logs the resolved `DATA_DIR` and database path on startup to help identify which file is active.

---

## App Not Loading on Mobile / Another Device

If you're accessing Marinara Engine from a phone or tablet on the same network and it won't connect:

- Make sure the server is bound to `0.0.0.0`, not `127.0.0.1`. The shell launchers (`start.sh`, `start-termux.sh`) default to `0.0.0.0`. If you started manually with `pnpm start`, set `HOST=0.0.0.0` in `.env` first.
- Verify both devices are on the same Wi-Fi network.
- Check that no firewall is blocking port `7860` (or your configured `PORT`).

See the [LAN / mobile access FAQ](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) for full setup details.

---

## Server Starts but Browser Shows a Blank Page

- Clear the browser cache or do a hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`).
- If you're using the PWA, unregister the service worker in DevTools → Application → Service Workers, then reload.
- Confirm the client was built successfully — run `pnpm build` and check for errors.

---

## Database Errors on Startup

If you see Prisma or Drizzle migration errors:

```bash
pnpm db:push
```

This ensures the database schema matches the current codebase. It is safe to run multiple times.

---

## Container: Permission Denied on Volume Mount

If a Docker or Podman container fails with permission errors on the data volume:

- **SELinux (Fedora, RHEL):** Add the `:Z` suffix to the volume mount — e.g., `-v marinara-data:/app/data:Z`.
- **Rootless Podman:** Make sure the host directory is owned by your user, or use a named volume instead of a bind mount.

---

## Still Stuck?

- Check the [open issues](https://github.com/Pasta-Devs/Marinara-Engine/issues) on GitHub.
- [Join the Discord](https://discord.com/invite/KdAkTg94ME) for community help.
- File a [bug report](https://github.com/Pasta-Devs/Marinara-Engine/issues/new?template=issue_report.md) with your OS, Node.js version, and the full error output.
