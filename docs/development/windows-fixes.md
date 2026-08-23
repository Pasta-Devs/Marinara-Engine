# Windows Fixes

## Storage writer lease fails to self-heal after a crash

**Status:** Fixed
**Commit:** `4e31da50d`
**Affected file:** `packages/server/src/db/file-backed-store.ts`

### Symptom

After a crash or a forced shutdown, the server refuses to start and fails during
bootstrap with a `StorageWriterLeaseError`:

```
StorageWriterLeaseError: Another Marinara Engine process (PID 24836, host
DESKTOP-6IIDMB4) may be using C:\...\packages\server\data\storage. Close it
before retrying. If it no longer exists, verify every process is stopped and
remove only C:\...\packages\server\data\storage\.writer-lease.
```

The referenced PID is already dead, and no process is actually using the data
directory, yet startup is still blocked until the `.writer-lease` directory is
removed by hand.

### Root cause

Marinara guards the local data directory with a **writer lease** so that two
processes never silently overwrite the same storage. When a process exits without
releasing its lease (crash, kill), the next startup is *supposed* to detect the
stale lease and reclaim it automatically — but only when the lease's recorded
**host id** matches the current machine's host id.

The host id was computed as:

```
sha256(hostname + machineId + MAC addresses)
```

On Linux, `machineId` comes from the stable `/etc/machine-id`. **Windows has no
`/etc/machine-id`**, so the host id effectively fell back to the network **MAC
addresses**. MAC addresses are volatile: Hyper-V, VPN, and Wi-Fi adapters appear
and disappear between runs. When the set of adapters changed between the crash and
the next start, the computed host id drifted, the `sameHost` check failed, and the
automatic stale-lease reclamation was skipped — even though the recorded PID was
provably exited. The user was then forced to delete `.writer-lease` manually.

### Fix

Derive the host identity from a **stable machine identifier** on Windows: the
registry value `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` (the Windows
equivalent of `/etc/machine-id`). MAC addresses are now used only as a last-resort
fallback when no stable identifier is available at all.

```ts
function readWindowsMachineGuid(): string | undefined {
  if (process.platform !== "win32") return undefined;
  try {
    const output = execFileSync(
      "reg",
      ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      { encoding: "utf8", timeout: 2000, windowsHide: true },
    );
    const match = output.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
    const guid = match?.[1]?.trim();
    return guid ? guid : undefined;
  } catch {
    return undefined;
  }
}
```

The host-id computation now prefers a stable id and only falls back to MACs when
none exists. Mixing volatile MACs into the hash whenever they exist would still let
the host id drift as adapters come and go, so they are excluded when a stable id is
present.

```ts
const stableId = machineId ?? windowsMachineId;
if (stableId) {
  return createHash("sha256")
    .update([CURRENT_HOSTNAME, stableId].join("\n"))
    .digest("hex");
}
// Fallback: MAC addresses only when no stable machine id exists.
const macs = Object.values(networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .map((entry) => entry.mac.toLowerCase())
  .filter((mac) => mac !== "00:00:00:00:00:00")
  .sort();
if (macs.length === 0) return null;
return createHash("sha256").update([CURRENT_HOSTNAME, ...macs].join("\n")).digest("hex");
```

Because the host id is now stable across reboots and adapter changes, a stale lease
left behind by an exited process on the same machine is reclaimed automatically on
the next start — no manual `.writer-lease` deletion needed.

### Verification

- **End-to-end crash test:** force-killed a running server (leaving its lease
  behind), restarted, and confirmed the log line
  `[file-storage] Reclaimed the writer lease after confirming its same-host PID
  exited.` — the exact failure scenario now self-heals.
- Server boots and serves `HTTP 200` on `http://127.0.0.1:7860`; the lease carries
  the new stable host id.
- Host id is deterministic across repeated invocations and sourced from the
  `MachineGuid`.
- `pnpm check` (TypeScript + ESLint + localization) passes.
- `pnpm regression:storage-writer-lock` passes.

### One-time migration note

A lease written by an older build uses the legacy MAC-based host id, which will not
match the new `MachineGuid`-based host id. If you upgrade while a stale lease from
the old format is present, remove the `.writer-lease` directory once. All leases
written from this fix onward are stable and self-healing.

## Launcher update snapshot fails with `EPERM: operation not permitted, symlink`

**Status:** Fixed
**Commit:** `7561a226`
**Affected files:** `scripts/protect-launcher-data.mjs`,
`scripts/regressions/launcher-update.regression.mjs`

### Symptom

Starting the app with `start.bat` prints an error during the update check and
then skips the auto-update entirely:

```
[..] Checking for updates...
  [ERROR] Could not protect launcher data: EPERM: operation not permitted,
  symlink 'C:\...\packages\server\node_modules' ->
  'C:\...\.marinara-engine-update-backups\.incomplete-update-...\data\capability-packages\node_modules'
 [WARN] Could not create an update snapshot. Skipping auto-update to protect your data.
```

The app still starts normally afterwards — the launcher's safe fallback aborts
only the update, never the startup. The error only appears once the capability
package runtime has run at least once, which is why earlier starts never showed it.

### Root cause

Two pieces interact here:

1. On server startup, the capability package runtime links installed packages into
   the host dependency tree by creating a **junction** inside the data directory
   (`packages/server/src/services/capability-packages/capability-module-runtime.service.ts`):

   ```ts
   await symlink(serverNodeModules, link, process.platform === "win32" ? "junction" : "dir");
   ```

   This creates `data/capability-packages/node_modules` → `packages/server/node_modules`.

2. Before a git auto-update, `start.bat` snapshots the user data directory via
   `node scripts/protect-launcher-data.mjs snapshot` so it can be restored if the
   update goes wrong. The snapshot used `fs.cp` to copy the whole data directory:

   ```js
   await cp(dataDir, resolve(incompleteDir, "data"), {
     recursive: true,
     preserveTimestamps: true,
     errorOnExist: true,
   });
   ```

   By default `fs.cp` recreates symbolic links at the destination via `fs.symlink`.
   **On Windows, `fs.symlink` requires elevated privileges or Developer Mode**, so
   recreating the junction inside the backup threw `EPERM`. The error aborted the
   entire snapshot, and the launcher skipped the auto-update to protect the data.

The junction only exists after the capability runtime has started once, which is why
the error did not appear on fresh installs or before that first run.

### Fix

Skip symbolic links when copying the data directory, for both the snapshot and the
restore path. The links point at runtime artifacts that the server recreates on
every startup — they are not user data. Dereferencing them instead would bloat
every backup with a full copy of `node_modules`.

```js
// The data directory can contain symbolic links, e.g. the capability-packages
// node_modules junction that the server recreates on every startup. fs.cp
// would try to recreate them via fs.symlink, which fails on Windows without
// elevated privileges (EPERM) and aborted the whole update snapshot;
// dereferencing them instead would bloat every backup with node_modules.
// Links point at runtime artifacts, not user data, so snapshots skip them.
async function skipSymbolicLinks(sourcePath) {
  return !(await lstat(sourcePath)).isSymbolicLink();
}
```

```js
await cp(dataDir, resolve(incompleteDir, "data"), {
  recursive: true,
  preserveTimestamps: true,
  errorOnExist: true,
  filter: skipSymbolicLinks,
});
```

The same `filter` is applied in `restoreLauncherDataIfMissing` so restoring a
backup that contains links (e.g. created on Linux/macOS) cannot fail either.

### Verification

- **Regression test** added to `scripts/regressions/launcher-update.regression.mjs`:
  the fixture creates a real junction inside the data directory (junctions do not
  need admin rights, matching what the server does), then asserts the snapshot
  succeeds, skips the link, and still preserves the user data files.
- **Real snapshot** against the actual local data directory containing the junction:
  `[OK] Protected user data at ...`, and the backup contains the data files but not
  the `node_modules` junction.
- `pnpm check` (TypeScript + ESLint + localization) passes.
- `pnpm regression:story-bundle` and the launcher regression both pass.
