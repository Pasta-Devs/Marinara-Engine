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
const packageManifest = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));
const pinnedPnpmDescriptor = packageManifest.packageManager?.split("@")[1];
const pinnedPnpmVersion = pinnedPnpmDescriptor?.split("+")[0];

assert.equal(pinnedPnpmVersion, "10.34.5", "The workspace must pin the patched pnpm release");
assert.equal(packageManifest.engines?.pnpm, ">=10.34.5", "Affected pnpm releases must fail before installation");
assert.equal(
  pinnedPnpmDescriptor,
  "10.34.5+sha512.a4ee05f2f73658255bd6a89859c065a45c28a57daefae2c893a168ee2b73168c37b91e83e57ea67654ad03f03031746430e8bce38e362e042605fb8abc80192e",
  "Corepack must verify the exact pnpm 10.34.5 release tarball",
);

const workspaceSource = readFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8");
assert.match(
  workspaceSource,
  /^managePackageManagerVersions: true$/mu,
  "Plain pnpm fallbacks must delegate project commands to the packageManager pin",
);

for (const descriptorBearingPath of [
  "packages/server/src/routes/updates.routes.ts",
  "win/installer/installer.nsi",
]) {
  const descriptorBearingSource = readFileSync(join(repositoryRoot, descriptorBearingPath), "utf8");
  assert.ok(
    descriptorBearingSource.includes(pinnedPnpmDescriptor),
    `${descriptorBearingPath} must keep its compiled fallback aligned with package.json`,
  );
}

for (const versionBearingPath of [
  ".github/workflows/prealpha-platform-builds.yml",
  "Dockerfile.lite",
  "win/installer/installer.nsi",
]) {
  const versionBearingSource = readFileSync(join(repositoryRoot, versionBearingPath), "utf8");
  assert.ok(
    versionBearingSource.includes(pinnedPnpmVersion),
    `${versionBearingPath} must keep its derived version aligned with package.json`,
  );
}

for (const dynamicDescriptorPath of ["start-local.bat", "start.bat", "win/installer/install.bat"]) {
  const dynamicDescriptorSource = readFileSync(join(repositoryRoot, dynamicDescriptorPath), "utf8");
  assert.match(
    dynamicDescriptorSource,
    /packageManager\?\.replace\(\/\^\^pnpm@\//u,
    `${dynamicDescriptorPath} must preserve the anchored packageManager check through cmd parsing`,
  );
  assert.match(
    dynamicDescriptorSource,
    /set "PNPM_VERSION="[\s\S]*if not defined PNPM_VERSION/u,
    `${dynamicDescriptorPath} must reject descriptors that do not contain a version`,
  );
  assert.ok(
    !dynamicDescriptorSource.includes(pinnedPnpmDescriptor),
    `${dynamicDescriptorPath} must read the canonical descriptor instead of duplicating it`,
  );
}

for (const runtimePath of [
  ".github/workflows/prealpha-platform-builds.yml",
  "Dockerfile.lite",
  "packages/server/src/routes/updates.routes.ts",
  "start-local.bat",
  "start-termux.sh",
  "start.bat",
  "start.sh",
  "win/installer/install.bat",
  "win/installer/installer.nsi",
]) {
  const runtimeSource = readFileSync(join(repositoryRoot, runtimePath), "utf8");
  assert.doesNotMatch(runtimeSource, /10\.33\.2/u, `${runtimePath} must not retain the affected pnpm pin`);
}

const windowsInstallerSource = readFileSync(join(repositoryRoot, "win/installer/installer.nsi"), "utf8");
assert.match(
  windowsInstallerSource,
  /pnpm --version \| %SystemRoot%\\System32\\findstr\.exe \/x \/l \/c:\$\{PNPM_VERSION\}/u,
  "The Windows installer must reject a global pnpm version that differs from the repository pin",
);
assert.equal(
  windowsInstallerSource.match(/confirmModulesPurge=false install --force --frozen-lockfile/gu)?.length,
  6,
  "Every NSIS installer dependency path must preserve the frozen lockfile",
);

const batchInstallerSource = readFileSync(join(repositoryRoot, "win/installer/install.bat"), "utf8");
const batchInstallerDeps = batchInstallerSource.indexOf(":deps");
const batchInstallerDescriptorLookup = batchInstallerSource.indexOf("packageManager?.replace", batchInstallerDeps);
const batchInstallerInstall = batchInstallerSource.indexOf(
  "call :run_pnpm install --force --frozen-lockfile",
  batchInstallerDescriptorLookup,
);
assert.ok(batchInstallerDeps >= 0, "The batch installer must define its dependency-install phase");
assert.ok(
  batchInstallerDescriptorLookup > batchInstallerDeps,
  "The batch installer must read the pnpm descriptor from the checked-out release",
);
assert.ok(
  batchInstallerInstall > batchInstallerDescriptorLookup,
  "The batch installer must resolve the checked-out descriptor before its frozen dependency install",
);

const troubleshootingSource = readFileSync(join(repositoryRoot, "docs/TROUBLESHOOTING.md"), "utf8");
assert.match(troubleshootingSource, /npm install -g pnpm@10\.34\.5/u);
assert.match(
  troubleshootingSource,
  /Expected version: >=10\.34\.5[\s\S]*Got: 10\.33\.2/u,
  "Troubleshooting must explain the intentional one-time fail-closed handoff",
);

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
  assert.match(launcherSource, /does not match required/u, `${launcherName} must reject a mismatched global pnpm`);
  assert.doesNotMatch(launcherSource, /10\.33\.2/u, `${launcherName} must not retain the affected pnpm pin`);
}

for (const launcherName of ["start.sh", "start-termux.sh"]) {
  const launcherSource = readFileSync(join(repositoryRoot, launcherName), "utf8");
  const updateSuccess = launcherSource.indexOf('echo "  [OK] Updated to');
  const refreshedRunner = launcherSource.indexOf("if ! resolve_pnpm_runner; then", updateSuccess);
  const refreshedInstall = launcherSource.indexOf("install_workspace_dependencies", refreshedRunner);
  const resolutionFailure = launcherSource.indexOf("PNPM_RESOLUTION_FAILED=1", updateSuccess);
  const dataRestore = launcherSource.indexOf("restore-if-missing", resolutionFailure);
  const resolutionAbort = launcherSource.indexOf('if [ "${PNPM_RESOLUTION_FAILED:-0}" = "1" ]', dataRestore);

  assert.ok(updateSuccess >= 0, `${launcherName} must identify a successful checkout update`);
  assert.ok(refreshedRunner > updateSuccess, `${launcherName} must reload the pnpm pin after updating the checkout`);
  assert.ok(
    refreshedInstall > refreshedRunner,
    `${launcherName} must refresh the pnpm runner before its first post-update dependency install`,
  );
  assert.ok(resolutionFailure > updateSuccess, `${launcherName} must record a post-update pnpm resolution failure`);
  assert.ok(dataRestore > resolutionFailure, `${launcherName} must restore protected data after resolution failure`);
  assert.ok(resolutionAbort > dataRestore, `${launcherName} must abort only after protected data is restored`);
}

{
  const updateSuccess = windowsLauncherSource.indexOf("echo  [OK] Updated to latest version");
  const refreshedRunner = windowsLauncherSource.indexOf("call :resolve_pnpm_runner", updateSuccess);
  const refreshedInstall = windowsLauncherSource.indexOf(
    "call :run_pnpm install --frozen-lockfile --prefer-offline",
    refreshedRunner,
  );
  const resolutionFailure = windowsLauncherSource.indexOf('set "PNPM_RESOLUTION_FAILED=1"', updateSuccess);
  const dataRestore = windowsLauncherSource.indexOf("restore-if-missing", resolutionFailure);
  const resolutionAbort = windowsLauncherSource.indexOf(
    'if "!PNPM_RESOLUTION_FAILED!"=="1"',
    dataRestore,
  );

  assert.ok(updateSuccess >= 0, "start.bat must identify a successful checkout update");
  assert.ok(refreshedRunner > updateSuccess, "start.bat must reload the pnpm pin after updating the checkout");
  assert.ok(
    refreshedInstall > refreshedRunner,
    "start.bat must refresh the pnpm runner before its first post-update dependency install",
  );
  assert.ok(resolutionFailure > updateSuccess, "start.bat must record a post-update pnpm resolution failure");
  assert.ok(dataRestore > resolutionFailure, "start.bat must restore protected data after resolution failure");
  assert.ok(resolutionAbort > dataRestore, "start.bat must abort only after protected data is restored");
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
