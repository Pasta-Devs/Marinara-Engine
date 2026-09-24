// ──────────────────────────────────────────────
// Taskbar Shortcut Migration (Windows-only)
// ──────────────────────────────────────────────
// Re-points the user's Start Menu and Desktop "Marinara Engine" shortcuts at
// the bundled MarinaraLauncher.exe and stamps an AppUserModelID on the .lnk,
// so that pinning the shortcut to the taskbar groups the running console
// under the pinned icon (instead of spawning a separate generic cmd entry).
//
// Idempotent: if a shortcut already targets the launcher we skip it. Only
// shortcuts that currently point at *this* install's start.bat are touched —
// other Marinara installs and unrelated shortcuts are left alone.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { logger } from "../../lib/logger.js";

const AUMID = "Pasta-Devs.MarinaraEngine";
const SHORTCUT_TITLE = "Marinara Engine";

// Hard timeout per child-process hop. The migration is scheduled after the
// server starts listening, and child processes are async so slow shortcut COM
// calls cannot block Fastify startup.
const SPAWN_TIMEOUT_MS = 5_000;

// Windows PowerShell 5.1 writes redirected stdout in the OEM code page, so a
// non-ASCII install path (for example C:\Users\José) would come back garbled
// and never match. Force UTF-8 output for the commands whose stdout we parse.
const PS_UTF8_OUTPUT = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ";

type ChildRunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

function runChild(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<ChildRunResult> {
  return new Promise((resolveResult) => {
    let settled = false;
    let timedOut = false;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timeout: NodeJS.Timeout | undefined;
    let killFallback: NodeJS.Timeout | undefined;

    const finish = (status: number | null) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (killFallback) clearTimeout(killFallback);
      // Decode once after collecting everything so multibyte sequences split
      // across chunks are not corrupted.
      resolveResult({
        status,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        timedOut,
      });
    };

    const child = spawn(command, args, {
      env: options.env,
      windowsHide: true,
    });

    timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
      killFallback = setTimeout(() => {
        finish(null);
      }, 1_000);
      killFallback.unref?.();
    }, options.timeoutMs ?? SPAWN_TIMEOUT_MS);
    timeout.unref?.();

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.from(chunk));
    });
    child.on("error", () => {
      finish(null);
    });
    child.on("close", (code) => {
      finish(timedOut ? null : code);
    });
  });
}

async function readShortcutTarget(lnkPath: string): Promise<string | null> {
  const cmd =
    PS_UTF8_OUTPUT +
    "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK); " +
    "Write-Output $s.TargetPath";
  const res = await runChild(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd],
    {
      env: { ...process.env, LNK: lnkPath },
    },
  );
  if (res.status !== 0) return null;
  return res.stdout.trim() || null;
}

function pathsEqual(a: string, b: string): boolean {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase();
}

async function rewriteShortcut(
  lnkPath: string,
  exe: string,
  args: string,
  workDir: string,
  icon: string,
): Promise<boolean> {
  const cmd =
    "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK); " +
    "$s.TargetPath = $env:EXE; " +
    "$s.Arguments = $env:ARGS; " +
    "$s.WorkingDirectory = $env:WD; " +
    "$s.IconLocation = $env:ICON; " +
    "$s.Save()";
  const res = await runChild(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd],
    {
      env: { ...process.env, LNK: lnkPath, EXE: exe, ARGS: args, WD: workDir, ICON: icon },
    },
  );
  return res.status === 0;
}

async function readShortcutIconLocation(lnkPath: string): Promise<string | null> {
  const cmd =
    PS_UTF8_OUTPUT +
    "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK); " +
    "Write-Output $s.IconLocation";
  const res = await runChild(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd],
    {
      env: { ...process.env, LNK: lnkPath },
    },
  );
  if (res.status !== 0) return null;
  return res.stdout.trim() || null;
}

async function repairShortcutIcon(lnkPath: string, icon: string): Promise<boolean> {
  const cmd =
    "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK); " +
    "$s.IconLocation = $env:ICON; " +
    "$s.Save()";
  const res = await runChild(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd],
    {
      env: { ...process.env, LNK: lnkPath, ICON: icon },
    },
  );
  return res.status === 0;
}

async function stampAumid(launcherExe: string, lnkPath: string): Promise<boolean> {
  const res = await runChild(launcherExe, ["--stamp-lnk", lnkPath, AUMID]);
  return res.status === 0;
}

export async function migrateTaskbarShortcuts(installDir: string): Promise<void> {
  if (process.platform !== "win32") return;

  const launcherExe = join(installDir, "MarinaraLauncher.exe");
  if (!existsSync(launcherExe)) {
    logger.debug("Taskbar migration: MarinaraLauncher.exe not present, skipping");
    return;
  }

  const startBat = join(installDir, "start.bat");
  if (!existsSync(startBat)) {
    logger.debug("Taskbar migration: start.bat not present, skipping");
    return;
  }

  const appData = process.env.APPDATA;
  const userProfile = process.env.USERPROFILE;
  const candidates: string[] = [];
  if (appData) {
    candidates.push(
      join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Marinara Engine", "Marinara Engine.lnk"),
    );
  }
  if (userProfile) {
    candidates.push(join(userProfile, "Desktop", "Marinara Engine.lnk"));
  }
  // Test-only escape hatch — comma/semicolon-delimited extra .lnk paths to consider.
  const extra = process.env.MARINARA_LAUNCHER_TEST_LNKS;
  if (extra) {
    for (const p of extra
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      candidates.push(p);
    }
  }

  // Icon source — sourced from win/installer/ subfolder which is always tracked
  // in the repo. Earlier versions used a tracked copy at the repo root, but
  // that collided with the untracked copy that the original installer wrote to
  // $INSTDIR — blocking git pull for existing users. Sourcing from the
  // subfolder avoids the path that the installer uses at the install root.
  const iconPath = join(installDir, "win", "installer", "app-icon.ico");
  // Older migrations targeted the icon at <installDir>/installer/app-icon.ico
  // (before the win/ reorganization). Self-heal recognizes that path and
  // repairs it to the new location.
  const legacyIconPath = join(installDir, "installer", "app-icon.ico");
  const iconLocation = `${iconPath},0`;
  const argsLine = `${AUMID} "${startBat}" "${SHORTCUT_TITLE}"`;
  const workDir = installDir;

  for (const lnk of candidates) {
    if (!existsSync(lnk)) continue;

    const currentTarget = await readShortcutTarget(lnk);
    if (!currentTarget) {
      logger.warn("Taskbar migration: could not read target for %s, skipping", lnk);
      continue;
    }

    if (pathsEqual(currentTarget, launcherExe)) {
      // Already migrated. Self-heal the IconLocation if it points at a path
      // that no longer exists OR at the legacy installer/ path that the
      // win/ reorganization moved. Either way, repoint at the canonical
      // win/installer/app-icon.ico.
      const currentIcon = await readShortcutIconLocation(lnk);
      const currentIconPath = (currentIcon ?? "").replace(/,\d+$/, "");
      const isLegacyPath = currentIconPath ? pathsEqual(currentIconPath, legacyIconPath) : false;
      const isMissing = currentIconPath ? !existsSync(currentIconPath) : false;
      if ((isLegacyPath || isMissing) && existsSync(iconPath)) {
        if (await repairShortcutIcon(lnk, iconLocation)) {
          logger.info("Repaired taskbar shortcut icon: %s", lnk);
        } else {
          logger.warn("Taskbar migration: failed to repair icon on %s", lnk);
        }
      } else {
        logger.debug("Taskbar migration: %s already targets the launcher, skipping", lnk);
      }
      continue;
    }

    if (!pathsEqual(currentTarget, startBat)) {
      logger.debug("Taskbar migration: %s targets %s (not this install), skipping", lnk, currentTarget);
      continue;
    }

    if (!(await rewriteShortcut(lnk, launcherExe, argsLine, workDir, iconLocation))) {
      logger.warn("Taskbar migration: failed to rewrite %s", lnk);
      continue;
    }

    if (!(await stampAumid(launcherExe, lnk))) {
      logger.warn("Taskbar migration: failed to stamp AUMID on %s", lnk);
      continue;
    }

    logger.info("Migrated taskbar shortcut: %s", lnk);
  }
}
