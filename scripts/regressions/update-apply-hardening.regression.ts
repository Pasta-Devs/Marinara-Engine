import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isChannelCheckoutBranch,
  isGitUpdateApplyAllowed,
} from "../../packages/server/src/services/updates/update-apply-policy.js";
import { getManualGitApplyCommand, getManualUpdateHint } from "../../packages/server/src/routes/updates.routes.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// ── #5646: the hard-disable wins over every apply path ──
assert.equal(
  isGitUpdateApplyAllowed({
    updatesApplyEnabled: true,
    localChannelSwitchRequested: true,
    updatesApplyHardDisabled: true,
  }),
  false,
  "UPDATES_APPLY_DISABLED must beat the enabled flag AND the loopback channel-switch bypass",
);
assert.equal(
  isGitUpdateApplyAllowed({ updatesApplyEnabled: true, localChannelSwitchRequested: false }),
  true,
  "the opt-in enabled flag must keep working when not hard-disabled",
);
assert.equal(
  isGitUpdateApplyAllowed({ updatesApplyEnabled: false, localChannelSwitchRequested: true }),
  true,
  "the loopback channel-switch bypass must keep working when not hard-disabled",
);
assert.equal(
  isGitUpdateApplyAllowed({ updatesApplyEnabled: false, localChannelSwitchRequested: false }),
  false,
  "no flag, no switch, no apply",
);

// ── #5646: development branches are not channel branches ──
for (const branch of ["main", "master", "staging"]) {
  assert.equal(isChannelCheckoutBranch(branch), true, `${branch} is a channel branch`);
}
assert.equal(isChannelCheckoutBranch(null), true, "detached checkouts stay allowed (stable launcher pins them)");
assert.equal(isChannelCheckoutBranch(undefined), true, "unknown branch state must not block ordinary installs");
assert.equal(isChannelCheckoutBranch(""), true, "empty branch output reads as detached");
for (const branch of ["fix/5641-guarded-cache-writers", "feat/thing", "staging-experiment"]) {
  assert.equal(isChannelCheckoutBranch(branch), false, `${branch} is a development checkout`);
}

// ── #5645: the manual command is a complete recipe that starts with cd ──
const stagingChannel = {
  id: "staging",
  branch: "staging",
  targetRef: "origin/staging",
  fetchRef: "+refs/heads/staging:refs/remotes/origin/staging",
  // The route's channel objects carry more fields; the command builder only
  // reads the four above.
} as never;

const windowsCommand = getManualGitApplyCommand(stagingChannel, "windows", "corepack pnpm", "D:\\Marinara-Engine");
assert.ok(
  windowsCommand.startsWith('cd /d "D:\\Marinara-Engine" && '),
  "the Windows recipe must lead with a drive-crossing cd into the detected install folder",
);
const linuxCommand = getManualGitApplyCommand(stagingChannel, "linux", "corepack pnpm", "/home/user/marinara");
assert.ok(linuxCommand.startsWith('cd "/home/user/marinara" && '), "POSIX recipes must lead with a plain quoted cd");
for (const command of [windowsCommand, linuxCommand]) {
  assert.match(command, /git fetch /u, "the recipe must still fetch");
  assert.match(command, /--filter @marinara-engine\/shared build/u, "the recipe must still build");
}
assert.ok(
  !getManualGitApplyCommand(stagingChannel, "linux", "corepack pnpm", null).startsWith("cd "),
  "a null root must fall back to the bare command instead of a broken cd",
);

// ── #5645: Windows users are told which shell can actually run it ──
const windowsHint = getManualUpdateHint("git", "windows", stagingChannel);
assert.match(windowsHint, /Command Prompt/u, "the Windows hint must name a shell that accepts && chains");
assert.match(windowsHint, /PowerShell/u, "the Windows hint must warn about the default shell");
const linuxHint = getManualUpdateHint("git", "linux", stagingChannel);
assert.ok(!/PowerShell/u.test(linuxHint), "POSIX platforms must not carry the Windows shell warning");
const windowsStableHint = getManualUpdateHint("git", "windows");
assert.match(
  windowsStableHint,
  /\.\/start\.bat/u,
  "the Git Bash instruction for the stable recipe must include ./start.bat - bash does not resolve a bare batch file",
);

// A failed leading cd (or fetch) must abort the staging recipe outright: the
// alternation is parenthesized so its || can only capture the show-ref probe,
// never a cd/fetch failure falling through into checkout -b in the wrong cwd.
assert.match(
  windowsCommand,
  / && \(git show-ref --verify --quiet [^&]+ && \(git checkout [^)]+\) \|\| git checkout -b [^)]+\) && /u,
  "the staging alternation must be scoped in parentheses",
);

// ── source pins: the wiring stays in place ──
const devLauncherSource = readFileSync(join(repositoryRoot, "scripts/dev.mjs"), "utf8").replace(/\r\n/gu, "\n");
assert.match(
  devLauncherSource,
  /process\.env\.UPDATES_APPLY_DISABLED = "true"/u,
  "pnpm dev must hard-disable server-side update application (#5646)",
);
const e2eLauncherSource = readFileSync(join(repositoryRoot, "e2e/start-servers.mjs"), "utf8").replace(/\r\n/gu, "\n");
assert.match(
  e2eLauncherSource,
  /UPDATES_APPLY_DISABLED: "true"/u,
  "the e2e servers must hard-disable server-side update application (#5646)",
);
const updatesRoutesSource = readFileSync(
  join(repositoryRoot, "packages/server/src/routes/updates.routes.ts"),
  "utf8",
).replace(/\r\n/gu, "\n");
assert.match(
  updatesRoutesSource,
  /const applyHardDisabled = isUpdatesApplyHardDisabled\(\);\s*const devBranchCheckout = !isChannelCheckoutBranch\(currentBranch\);\s*if \(applyHardDisabled \|\| devBranchCheckout\) \{/u,
  "the apply route must hard-refuse BEFORE the ordinary gate so no bypass can reach a dev checkout",
);
assert.match(
  updatesRoutesSource,
  /"hard-disabled"[\s\S]{0,80}"dev-branch"/u,
  "the reason union must carry both refusal reasons",
);
assert.match(
  updatesRoutesSource,
  /gitInstall \? currentBranch : null/u,
  "the check route must thread the branch into the availability preview (#5646)",
);
assert.match(
  updatesRoutesSource,
  /if \(hardDisabled \|\| !isChannelCheckoutBranch\(currentBranch\)\)/u,
  "the preview must use the apply route's refusal precedence (hard-disabled first)",
);
const settingsPanelSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/panels/SettingsPanel.tsx"),
  "utf8",
).replace(/\r\n/gu, "\n");
assert.match(
  settingsPanelSource,
  /applyUnavailableReason === "hard-disabled"/u,
  "the client must explain the hard-disabled refusal instead of suggesting UPDATES_APPLY_ENABLED=true",
);
assert.match(
  settingsPanelSource,
  /applyUnavailableReason === "dev-branch"/u,
  "the client must explain the development-branch refusal",
);

console.log("Update-apply hardening regression checks passed.");
