// Regression: the Windows taskbar shortcut migration must read .lnk targets
// under non-ASCII install paths (PowerShell 5.1 stdout is OEM-encoded unless
// forced to UTF-8), so a start.bat shortcut in C:\Users\José is still migrated.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = readFileSync(
  new URL("../../packages/server/src/services/setup/taskbar-shortcut-migration.ts", import.meta.url),
  "utf8",
);
assert.match(source, /\[Console\]::OutputEncoding = \[System\.Text\.Encoding\]::UTF8/u);
assert.equal(source.match(/PS_UTF8_OUTPUT \+/gu)?.length, 2, "both shortcut readers must force UTF-8 output");
assert.match(source, /Buffer\.concat\(stdoutChunks\)\.toString\("utf8"\)/u);
const prefix = source.match(/const PS_UTF8_OUTPUT = "([^"]+)";/u)?.[1];
assert.ok(prefix, "PS_UTF8_OUTPUT constant missing");

const psArgs = (command: string) => ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command];

if (process.platform === "win32") {
  // The prefix the module uses must make PowerShell emit UTF-8 on a pipe.
  const echo = spawnSync("powershell.exe", psArgs(`${prefix}Write-Output $env:B56_TEXT`), {
    env: { ...process.env, B56_TEXT: "José-Müller" },
    windowsHide: true,
    timeout: 120_000,
  });
  assert.equal(echo.status, 0, `powershell failed: ${echo.stderr}`);
  assert.equal(echo.stdout.toString("utf8").trim(), "José-Müller");
}

// End-to-end migration of a real .lnk. Opt-in because PowerShell cold start can
// exceed the module's 5s per-hop timeout on a loaded machine.
if (process.platform === "win32" && process.env.MARINARA_B56_E2E === "1") {
  process.env.LOG_LEVEL = process.env.B56_LOG ?? "silent";
  const root = mkdtempSync(join(tmpdir(), "marinara-b56-"));
  try {
    const installDir = join(root, "Jos\u00e9-M\u00fcller", "Marinara-Engine");
    mkdirSync(installDir, { recursive: true });
    const startBat = join(installDir, "start.bat");
    const launcherExe = join(installDir, "MarinaraLauncher.exe");
    writeFileSync(startBat, "@echo off\r\n");
    writeFileSync(launcherExe, "");
    const lnk = join(root, "Marinara Engine.lnk");
    const create = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK); $s.TargetPath = $env:TGT; $s.Save()",
      ],
      { env: { ...process.env, LNK: lnk, TGT: startBat }, windowsHide: true },
    );
    assert.equal(create.status, 0, `could not create test shortcut: ${create.stderr}`);

    // Keep the migration away from the real user's Start Menu and Desktop.
    process.env.APPDATA = join(root, "appdata");
    process.env.USERPROFILE = join(root, "profile");
    process.env.MARINARA_LAUNCHER_TEST_LNKS = lnk;

    const { migrateTaskbarShortcuts } = await import(
      "../../packages/server/src/services/setup/taskbar-shortcut-migration.js"
    );
    // The placeholder launcher is an empty file, so the final AUMID stamp step
    // cannot spawn it (EFTYPE). The rewrite we care about happens before that.
    await migrateTaskbarShortcuts(installDir).catch((err: NodeJS.ErrnoException) => {
      if (err?.code !== "EFTYPE") throw err;
    });

    const read = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK).TargetPath",
      ],
      { env: { ...process.env, LNK: lnk }, windowsHide: true },
    );
    const target = read.stdout.toString("utf8").trim();
    assert.equal(target.toLowerCase(), launcherExe.toLowerCase(), "shortcut under a non-ASCII path was not migrated");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log("server-hunt-b56 regression passed");
