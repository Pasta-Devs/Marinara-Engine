import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LATEST_RELEASE_URL,
  checkForLauncherUpdate,
  getVersionFromReleaseUrl,
  isNewerStableVersion,
} from "../check-launcher-update.mjs";
import {
  resolveLauncherDataDir,
  restoreLauncherDataIfMissing,
  snapshotLauncherData,
} from "../protect-launcher-data.mjs";
import { workspaceLockfileMatches } from "../check-workspace-install.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const releaseUrl = "https://github.com/Pasta-Devs/Marinara-Engine/releases/tag/v2.3.4";

assert.equal(getVersionFromReleaseUrl(releaseUrl), "2.3.4");
assert.equal(getVersionFromReleaseUrl(LATEST_RELEASE_URL), null);
assert.equal(getVersionFromReleaseUrl("https://example.com/releases/tag/v9.9.9"), null);
assert.equal(isNewerStableVersion("2.3.3", "2.3.4"), true);
assert.equal(isNewerStableVersion("2.3.4", "2.3.4"), false);
assert.equal(isNewerStableVersion("2.4.0", "2.3.4"), false);
assert.equal(isNewerStableVersion("development", "2.3.4"), false);

const reminder = await checkForLauncherUpdate({
  currentVersion: "2.3.3",
  fetchImpl: async (url, options) => {
    assert.equal(url, LATEST_RELEASE_URL);
    assert.equal(options.method, "HEAD");
    assert.equal(options.redirect, "follow");
    return { ok: true, url: releaseUrl };
  },
});
assert.match(reminder, /Marinara Engine v2\.3\.4 is available/);
assert.match(reminder, /installed: v2\.3\.3/);
assert.match(reminder, /Automatic updates are disabled/);
assert.match(reminder, new RegExp(releaseUrl.replaceAll(".", "\\.")));

const currentReminder = await checkForLauncherUpdate({
  currentVersion: "2.3.4",
  fetchImpl: async () => ({ ok: true, url: releaseUrl }),
});
assert.equal(currentReminder, null);

const unavailableReminder = await checkForLauncherUpdate({
  currentVersion: "2.3.3",
  fetchImpl: async () => ({ ok: false, url: LATEST_RELEASE_URL }),
});
assert.equal(unavailableReminder, null);

function assertPosixReminderRouting(launcherName) {
  const launcherSource = readFileSync(join(repositoryRoot, launcherName), "utf8");
  const updateBlockStart = launcherSource.indexOf("# ── Auto-update from Git ──");
  assert.notEqual(updateBlockStart, -1, `${launcherName} must define its update decision block`);

  const updateBlock = launcherSource.slice(updateBlockStart);
  const skipBranch = updateBlock.indexOf('if [ "$SKIP_UPDATE" = "1" ]; then');
  const disabledBranch = updateBlock.indexOf('elif [ "$AUTO_UPDATE_DISABLED" = "1" ]; then');
  const reminderInvocation = updateBlock.indexOf("node scripts/check-launcher-update.mjs");
  const enabledUpdateBranch = updateBlock.indexOf('elif [ -d ".git" ]; then');

  assert.ok(skipBranch >= 0, `${launcherName} must handle --skip-update first`);
  assert.ok(disabledBranch > skipBranch, `${launcherName} must keep the reminder after --skip-update`);
  assert.ok(
    reminderInvocation > disabledBranch,
    `${launcherName} must invoke the reminder only after automatic updates are found disabled`,
  );
  assert.ok(
    enabledUpdateBranch > reminderInvocation,
    `${launcherName} must keep the reminder out of the automatic-update-enabled branch`,
  );
  assert.equal(
    updateBlock.match(/node scripts\/check-launcher-update\.mjs/gu)?.length,
    1,
    `${launcherName} must have exactly one reminder invocation`,
  );
}

assertPosixReminderRouting("start.sh");
assertPosixReminderRouting("start-termux.sh");

const windowsLauncherSource = readFileSync(join(repositoryRoot, "start.bat"), "utf8");
assert.match(windowsLauncherSource, /check-launcher-update\.mjs/u);

for (const launcherName of ["start.sh", "start-termux.sh", "start.bat"]) {
  const launcherSource = readFileSync(join(repositoryRoot, launcherName), "utf8");
  assert.doesNotMatch(launcherSource, /pnpm install --force/u, `${launcherName} must not force dependency reinstalls`);
  assert.match(launcherSource, /install --frozen-lockfile --prefer-offline/u);
  assert.match(launcherSource, /protect-launcher-data\.mjs snapshot/u);
  assert.match(launcherSource, /protect-launcher-data\.mjs restore-if-missing/u);
}

const devSource = readFileSync(join(repositoryRoot, "scripts/dev.mjs"), "utf8");
assert.match(devSource, /check-workspace-install\.mjs/u);
assert.match(devSource, /\["install", "--frozen-lockfile"\]/u);

const fixtureRoot = mkdtempSync(join(tmpdir(), "marinara-launcher-data-"));
const fixtureBackupRoot = resolve(fixtureRoot, "..", `${basename(fixtureRoot)}-backups`);
try {
  const installFixtureRoot = join(fixtureRoot, "install-check");
  const installedLockfileDir = join(installFixtureRoot, "node_modules", ".pnpm");
  mkdirSync(installedLockfileDir, { recursive: true });
  assert.equal(workspaceLockfileMatches(installFixtureRoot), false);

  writeFileSync(join(installFixtureRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(join(installedLockfileDir, "lock.yaml"), "lockfileVersion: '9.0'\n");
  assert.equal(workspaceLockfileMatches(installFixtureRoot), true);

  writeFileSync(join(installFixtureRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\r\n");
  assert.equal(workspaceLockfileMatches(installFixtureRoot), true);

  writeFileSync(join(installFixtureRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\r");
  assert.equal(workspaceLockfileMatches(installFixtureRoot), true);

  writeFileSync(join(installedLockfileDir, "lock.yaml"), "lockfileVersion: '8.0'\n");
  assert.equal(workspaceLockfileMatches(installFixtureRoot), false);

  const defaultDataDir = await resolveLauncherDataDir({ root: fixtureRoot, env: {} });
  mkdirSync(defaultDataDir, { recursive: true });
  writeFileSync(join(defaultDataDir, "characters.json"), '{"name":"Preserved"}\n');

  const snapshot = await snapshotLauncherData({
    root: fixtureRoot,
    backupRoot: fixtureBackupRoot,
    env: {},
    now: new Date("2026-07-23T12:00:00.000Z"),
  });
  assert.equal(snapshot.created, true);

  rmSync(defaultDataDir, { recursive: true, force: true });
  const restore = await restoreLauncherDataIfMissing({ root: fixtureRoot, backupRoot: fixtureBackupRoot, env: {} });
  assert.equal(restore.restored, true);
  assert.equal(readFileSync(join(defaultDataDir, "characters.json"), "utf8"), '{"name":"Preserved"}\n');

  writeFileSync(join(fixtureRoot, ".env"), "DATA_DIR=../custom-data\n");
  assert.equal(
    await resolveLauncherDataDir({ root: fixtureRoot, env: {} }),
    resolve(fixtureRoot, "packages/server", "../custom-data"),
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
  rmSync(fixtureBackupRoot, { recursive: true, force: true });
}

// Issue #3997 — the run-directly guard must build its comparison URL with
// pathToFileURL. new URL(process.argv[1], "file:") parses a Windows drive
// prefix such as "D:" as the URL scheme, so fileURLToPath threw
// ERR_INVALID_URL_SCHEME at module load and the launcher skipped the update
// snapshot on Windows.
for (const script of ["scripts/protect-launcher-data.mjs", "scripts/read-launcher-env.mjs"]) {
  const source = readFileSync(resolve(repositoryRoot, script), "utf8");
  assert.doesNotMatch(
    source,
    /new URL\(process\.argv/u,
    `${script} must not parse process.argv[1] with new URL(..., "file:")`,
  );
  assert.match(
    source,
    /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/u,
    `${script} must compare import.meta.url against pathToFileURL(process.argv[1])`,
  );
}
{
  const { spawnSync } = await import("node:child_process");
  // Running the script directly must evaluate the guard without throwing and
  // reach main(), which rejects missing arguments with its usage error.
  const direct = spawnSync(process.execPath, [resolve(repositoryRoot, "scripts/protect-launcher-data.mjs")], {
    encoding: "utf8",
  });
  assert.equal(direct.status, 1, "Direct execution must reach main() and fail with the usage error");
  assert.match(direct.stderr + direct.stdout, /Usage: node scripts\/protect-launcher-data\.mjs/u);
  assert.doesNotMatch(direct.stderr, /ERR_INVALID_URL_SCHEME/u);
}

console.log("Launcher update reminder regressions passed.");
