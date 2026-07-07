// ──────────────────────────────────────────────
// Updates: Check for new versions and apply updates
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { logger } from "../lib/logger.js";
import { APP_VERSION } from "@marinara-engine/shared";
import { execFile } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { promisify } from "util";
import {
  getMonorepoRoot,
  isDockerRuntime,
  isUpdatesApplyEnabled,
  isUpdatesRemoteApplyAllowed,
} from "../config/runtime-config.js";
import { getBuildCommit, getBuildLabel } from "../config/build-info.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";

const execFileAsync = promisify(execFile);

const GITHUB_REPO = "Pasta-Devs/Marinara-Engine";
const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;
const GITHUB_TAGS_API = `${GITHUB_API_BASE}/git/matching-refs/tags/v`;
const GITHUB_RELEASE_BY_TAG_API = (tag: string) => `${GITHUB_API_BASE}/releases/tags/${tag}`;
const UPDATE_REMOTE = "origin";
type UpdateChannel = "stable" | "staging";
type UpdateChannelInfo = {
  id: UpdateChannel;
  label: string;
  branch: "main" | "staging";
  targetRef: string;
  fetchRef: string;
  warning?: string;
};
const UPDATE_CHANNELS: Record<UpdateChannel, UpdateChannelInfo> = {
  stable: {
    id: "stable",
    label: "Latest Stable",
    branch: "main",
    targetRef: `${UPDATE_REMOTE}/main`,
    fetchRef: `+refs/heads/main:refs/remotes/${UPDATE_REMOTE}/main`,
  },
  staging: {
    id: "staging",
    label: "Staging/UAT",
    branch: "staging",
    targetRef: `${UPDATE_REMOTE}/staging`,
    fetchRef: `+refs/heads/staging:refs/remotes/${UPDATE_REMOTE}/staging`,
    warning: "Staging builds are pre-release tester builds. Back up your app data before applying them.",
  },
};
const DEFAULT_PNPM_VERSION = "10.33.2";
const PNPM_NONINTERACTIVE_ARGS = ["--config.trustPolicy=off", "--config.confirmModulesPurge=false"];
const PNPM_UPDATE_INSTALL_ARGS = ["install", "--force", "--frozen-lockfile"];
const MANUAL_PNPM_COMMAND = `corepack pnpm@${DEFAULT_PNPM_VERSION}`;
const DOCKER_IMAGE = "ghcr.io/pasta-devs/marinara-engine";
const MANUAL_GIT_UPDATE_COMMAND =
  `git fetch origin +refs/heads/main:refs/remotes/origin/main && (git merge --ff-only origin/main || git checkout --detach origin/main) && ${MANUAL_PNPM_COMMAND} --config.trustPolicy=off --config.confirmModulesPurge=false install --force --frozen-lockfile && ${MANUAL_PNPM_COMMAND} --filter @marinara-engine/shared build && ${MANUAL_PNPM_COMMAND} --filter @marinara-engine/server --filter @marinara-engine/client --parallel run build && ${MANUAL_PNPM_COMMAND} start`;
const DOCKER_UPDATE_COMMAND = "docker compose pull && docker compose up -d";
const ANDROID_APK_NOTICE =
  "> [!IMPORTANT]\n" +
  "> **Android APK notice:** The APK is a Termux bootstrap + WebView shell, not a native Android server build. It opens an already-running local Marinara server, and on first launch it can download Termux from F-Droid, hand it to Android's installer, and start Marinara through Termux after Android permission prompts.";

// ── Cached release info (15-min TTL) ──
let cachedRelease: {
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string;
} | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 15 * 60_000;

// ── Cached commit-level check (5-min TTL) ──
const cachedCommitsBehindByChannel = new Map<UpdateChannel, { commitsBehind: number | null; timestamp: number }>();
const COMMIT_CHECK_TTL_MS = 5 * 60_000;

type InstallType = "git" | "docker" | "standalone";
type ServerPlatform = "windows" | "macos" | "linux" | "android-termux" | "unknown";
type ClientPlatform = "ios" | "android" | "desktop" | "unknown";
type ApplyUnavailableReason = "disabled" | "unsupported-install" | "container-install" | null;

/** Detect whether this install is a git repo. */
function isGitInstall(): boolean {
  const monorepoRoot = getMonorepoRoot();
  return existsSync(resolve(monorepoRoot, ".git"));
}

function getInstallType(gitInstall: boolean): InstallType {
  if (gitInstall) return "git";
  if (isDockerRuntime() || existsSync("/.dockerenv")) return "docker";
  return "standalone";
}

function getServerPlatform(): ServerPlatform {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "android":
      return "android-termux";
    default:
      return "unknown";
  }
}

function getClientPlatform(userAgentHeader: string | string[] | undefined): ClientPlatform {
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader.join(" ") : (userAgentHeader ?? "");
  if (!userAgent) return "unknown";
  if (/\b(iPhone|iPad|iPod)\b/i.test(userAgent)) return "ios";
  if (/\bAndroid\b/i.test(userAgent)) return "android";
  return "desktop";
}

function getGitLauncherCommand(platform: ServerPlatform) {
  switch (platform) {
    case "windows":
      return "start.bat";
    case "android-termux":
      return "./start-termux.sh";
    case "macos":
    case "linux":
      return "./start.sh";
    default:
      return MANUAL_GIT_UPDATE_COMMAND;
  }
}

async function gitCommandSucceeds(root: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync("git", args, { cwd: root, timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function isDetachedStagingCheckout(root: string): Promise<boolean> {
  const isOnStagingHistory = await gitCommandSucceeds(root, [
    "merge-base",
    "--is-ancestor",
    "HEAD",
    UPDATE_CHANNELS.staging.targetRef,
  ]);
  if (!isOnStagingHistory) return false;
  const isOnStableHistory = await gitCommandSucceeds(root, [
    "merge-base",
    "--is-ancestor",
    "HEAD",
    UPDATE_CHANNELS.stable.targetRef,
  ]);
  return !isOnStableHistory;
}

async function getUpdateChannelForCheckout(root: string, branch: string | null | undefined) {
  if (branch === UPDATE_CHANNELS.staging.branch) return UPDATE_CHANNELS.staging;
  if (!branch && (await isDetachedStagingCheckout(root))) return UPDATE_CHANNELS.staging;
  return UPDATE_CHANNELS.stable;
}

function getManualGitApplyCommand(
  channel = UPDATE_CHANNELS.stable,
  platform: ServerPlatform = "unknown",
  pnpmCommand = MANUAL_PNPM_COMMAND,
) {
  const checkoutCommand =
    channel.id === "staging"
      ? `git show-ref --verify --quiet refs/heads/${channel.branch} && (git checkout ${channel.branch} && git merge --ff-only ${channel.targetRef}) || git checkout -b ${channel.branch} ${channel.targetRef}`
      : `(git merge --ff-only ${channel.targetRef} || git checkout --detach ${channel.targetRef})`;
  const buildCommand =
    platform === "android-termux"
      ? `${pnpmCommand} --filter @marinara-engine/shared build && ${pnpmCommand} --filter @marinara-engine/server build && ${pnpmCommand} --filter @marinara-engine/client build`
      : `${pnpmCommand} --filter @marinara-engine/shared build && ${pnpmCommand} --filter @marinara-engine/server --filter @marinara-engine/client --parallel run build`;
  return `git fetch ${UPDATE_REMOTE} ${channel.fetchRef} && ${checkoutCommand} && ${pnpmCommand} --config.trustPolicy=off --config.confirmModulesPurge=false ${PNPM_UPDATE_INSTALL_ARGS.join(" ")} && ${buildCommand}`;
}

function getManualUpdateCommand(installType: InstallType, platform: ServerPlatform, channel = UPDATE_CHANNELS.stable) {
  if (installType === "docker") return DOCKER_UPDATE_COMMAND;
  if (installType === "git" && channel.id === "staging") {
    return getManualGitApplyCommand(channel, platform);
  }
  if (installType === "git") return getGitLauncherCommand(platform);
  return null;
}

function getManualUpdateHint(installType: InstallType, platform: ServerPlatform, channel = UPDATE_CHANNELS.stable) {
  if (installType === "docker") {
    return "Pull the published container image and restart the container. Versioned tags are published from vX.Y.Z release tags.";
  }
  if (installType === "git" && channel.id === "staging") {
    return "Staging is a tester branch. Make a profile backup first, then apply from the browser or run the command below from the repo checkout.";
  }
  if (installType === "git") {
    const launcher = getGitLauncherCommand(platform);
    return `Relaunch Marinara with ${launcher} to let the platform launcher fetch the current checkout's update branch, install dependencies, rebuild, and start the new version.`;
  }
  return "Download the release asset or update the host install manually, then restart Marinara.";
}

async function fetchUpdateRef(root: string, channel = UPDATE_CHANNELS.stable) {
  await execFileAsync("git", ["fetch", UPDATE_REMOTE, channel.fetchRef, "--quiet"], {
    cwd: root,
    timeout: 15_000,
  });
}

async function resolveGitRef(root: string, ref: string, shortLength?: number): Promise<string | null> {
  const args = ["rev-parse"];
  if (shortLength != null) {
    args.push(`--short=${shortLength}`);
  }
  args.push(ref);

  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: root,
      timeout: 5_000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function getCurrentBranch(root: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
      cwd: root,
      timeout: 5_000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function checkoutOrCreateUpdateBranch(root: string, channel: UpdateChannelInfo): Promise<void> {
  const branchRef = `refs/heads/${channel.branch}`;
  const branchExists = await gitCommandSucceeds(root, ["show-ref", "--verify", "--quiet", branchRef]);
  if (branchExists) {
    await execFileAsync("git", ["checkout", channel.branch], {
      cwd: root,
      timeout: 60_000,
    });
    await execFileAsync("git", ["merge", "--ff-only", channel.targetRef], {
      cwd: root,
      timeout: 60_000,
    });
    return;
  }
  await execFileAsync("git", ["checkout", "-b", channel.branch, channel.targetRef], {
    cwd: root,
    timeout: 60_000,
  });
}

async function hasTrackedChanges(root: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--short", "--untracked-files=no"], {
      cwd: root,
      timeout: 5_000,
    });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** Check how many commits behind the selected update channel the local HEAD is. Returns 0 if up to date, null on error. */
async function getCommitsBehind(channel = UPDATE_CHANNELS.stable): Promise<number | null> {
  if (!isGitInstall()) return null;
  const root = getMonorepoRoot();
  try {
    // Fetch the tracked auto-update target (no checkout).
    await fetchUpdateRef(root, channel);
    const { stdout } = await execFileAsync("git", ["rev-list", "--count", `HEAD..${channel.targetRef}`], {
      cwd: root,
      timeout: 5_000,
    });
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return null;
  }
}

/** Compare semver strings. Returns true if b > a. */
function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const a = parse(current);
  const b = parse(latest);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (bv > av) return true;
    if (bv < av) return false;
  }
  return false;
}

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const left = parse(a);
  const right = parse(b);

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const lv = left[i] ?? 0;
    const rv = right[i] ?? 0;
    if (lv > rv) return 1;
    if (lv < rv) return -1;
  }

  return 0;
}

function normalizeTag(tag: string) {
  return tag.replace(/^v/, "");
}

function isStableVersionTag(tag: string) {
  return /^v\d+\.\d+\.\d+$/.test(tag.trim());
}

function buildFallbackRelease(tag: string) {
  return {
    latestVersion: normalizeTag(tag),
    releaseUrl: `${GITHUB_REPO_URL}/releases/tag/${tag}`,
    releaseNotes: ANDROID_APK_NOTICE,
    publishedAt: "",
  };
}

function withAndroidApkNotice(notes: string) {
  if (/Android APK notice|not a standalone Marinara Engine app|requires Termux/i.test(notes)) {
    return notes;
  }

  return notes.trim() ? `${ANDROID_APK_NOTICE}\n\n${notes}` : ANDROID_APK_NOTICE;
}

function buildRequestHeaders() {
  return {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": `MarinaraEngine/${APP_VERSION}`,
  };
}

function getPinnedPnpmVersion(root: string): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8")) as {
      packageManager?: string;
    };
    return pkg.packageManager?.split("@")[1] || DEFAULT_PNPM_VERSION;
  } catch {
    return DEFAULT_PNPM_VERSION;
  }
}

type PnpmRunner = {
  command: string;
  prefixArgs: string[];
};

async function resolvePinnedPnpmRunner(root: string): Promise<PnpmRunner> {
  const pnpmVersion = getPinnedPnpmVersion(root);
  const shell = process.platform === "win32";

  try {
    const { stdout } = await execFileAsync("corepack", [`pnpm@${pnpmVersion}`, "--version"], {
      cwd: root,
      timeout: 20_000,
      shell,
    });
    if (stdout.trim() === pnpmVersion) {
      return { command: "corepack", prefixArgs: [`pnpm@${pnpmVersion}`] };
    }
  } catch {
    // Fall through to an already-installed pnpm. Some older Corepack builds
    // cannot resolve newer pnpm package signatures, but a user's global pnpm
    // may still be perfectly capable of installing this workspace.
  }

  try {
    const { stdout } = await execFileAsync("pnpm", ["--version"], {
      cwd: root,
      timeout: 10_000,
      shell,
    });
    if (stdout.trim() === pnpmVersion) {
      return { command: "pnpm", prefixArgs: [] };
    }
  } catch {
    // Fall through to npx.
  }

  try {
    const { stdout } = await execFileAsync("npx", ["--yes", `pnpm@${pnpmVersion}`, "--version"], {
      cwd: root,
      timeout: 60_000,
      shell,
    });
    if (stdout.trim() === pnpmVersion) {
      return { command: "npx", prefixArgs: ["--yes", `pnpm@${pnpmVersion}`] };
    }
  } catch {
    // Fall through to the user-facing error below.
  }

  throw new Error(
    `Could not start pnpm ${pnpmVersion}. Enable Corepack, install pnpm manually, or run the update manually.`,
  );
}

async function runPinnedPnpm(root: string, args: string[], timeout: number) {
  const runner = await resolvePinnedPnpmRunner(root);
  await execFileAsync(runner.command, [...runner.prefixArgs, ...PNPM_NONINTERACTIVE_ARGS, ...args], {
    cwd: root,
    timeout,
    shell: process.platform === "win32",
  });
  return { runner, pnpmVersion: getPinnedPnpmVersion(root) };
}

async function runPinnedBuild(root: string) {
  await runPinnedPnpm(root, ["--filter", "@marinara-engine/shared", "build"], 120_000);
  if (process.platform === "android") {
    await runPinnedPnpm(root, ["--filter", "@marinara-engine/server", "build"], 300_000);
    await runPinnedPnpm(root, ["--filter", "@marinara-engine/client", "build"], 300_000);
    return;
  }
  await runPinnedPnpm(
    root,
    ["--filter", "@marinara-engine/server", "--filter", "@marinara-engine/client", "--parallel", "run", "build"],
    300_000,
  );
}

async function resolveLatestReleaseFromGitHub(signal: AbortSignal) {
  const tagsRes = await fetch(GITHUB_TAGS_API, {
    headers: buildRequestHeaders(),
    signal,
  });

  if (!tagsRes.ok) {
    throw new Error(`GitHub tags API returned ${tagsRes.status}`);
  }

  const tagRefs = (await tagsRes.json()) as Array<{ ref?: string }>;
  const latestTag = tagRefs
    .map((entry) => entry.ref?.split("/").pop()?.trim() ?? "")
    .filter(isStableVersionTag)
    .sort(compareVersions)
    .at(-1);

  if (!latestTag) {
    throw new Error("No stable vX.Y.Z tags were found on GitHub");
  }

  const releaseRes = await fetch(GITHUB_RELEASE_BY_TAG_API(latestTag), {
    headers: buildRequestHeaders(),
    signal,
  });

  if (!releaseRes.ok) {
    return buildFallbackRelease(latestTag);
  }

  const release = (await releaseRes.json()) as {
    html_url?: string;
    body?: string;
    published_at?: string;
  };

  return {
    latestVersion: normalizeTag(latestTag),
    releaseUrl: release.html_url ?? `${GITHUB_REPO_URL}/releases/tag/${latestTag}`,
    releaseNotes: withAndroidApkNotice(release.body ?? ""),
    publishedAt: release.published_at ?? "",
  };
}

type ApplyUpdateBody = {
  confirm?: boolean;
  channel?: UpdateChannel;
  currentVersion?: string;
  currentBuild?: string | null;
  currentCommit?: string | null;
  targetRef?: string;
  targetCommit?: string;
};

async function resolveUpdateChannel(
  root: string,
  value: unknown,
  currentBranch?: string | null,
): Promise<UpdateChannelInfo> {
  if (value === "staging") return UPDATE_CHANNELS.staging;
  if (value === "stable") return UPDATE_CHANNELS.stable;
  return getUpdateChannelForCheckout(root, currentBranch);
}

function serializeUpdateChannels() {
  return Object.values(UPDATE_CHANNELS).map((channel) => ({
    id: channel.id,
    label: channel.label,
    branch: channel.branch,
    targetRef: channel.targetRef,
    warning: channel.warning ?? null,
  }));
}

function buildReleasePayload(release: NonNullable<typeof cachedRelease>) {
  const releaseTag = `v${release.latestVersion}`;
  return {
    ...release,
    releaseTag,
    dockerImage: DOCKER_IMAGE,
    dockerImageTag: `${DOCKER_IMAGE}:${release.latestVersion}`,
    dockerLiteImageTag: `${DOCKER_IMAGE}:${release.latestVersion}-lite`,
  };
}

function getApplyAvailability(installType: InstallType, platform: ServerPlatform, channel = UPDATE_CHANNELS.stable) {
  const enabled = isUpdatesApplyEnabled();
  if (installType === "docker") {
    return {
      applyAvailable: false,
      updatesApplyEnabled: enabled,
      applyUnavailableReason: "container-install" as ApplyUnavailableReason,
      manualUpdateCommand: getManualUpdateCommand(installType, platform, channel),
      manualUpdateHint: getManualUpdateHint(installType, platform, channel),
    };
  }
  if (installType !== "git") {
    return {
      applyAvailable: false,
      updatesApplyEnabled: enabled,
      applyUnavailableReason: "unsupported-install" as ApplyUnavailableReason,
      manualUpdateCommand: getManualUpdateCommand(installType, platform, channel),
      manualUpdateHint: getManualUpdateHint(installType, platform, channel),
    };
  }
  if (!enabled) {
    return {
      applyAvailable: false,
      updatesApplyEnabled: false,
      applyUnavailableReason: "disabled" as ApplyUnavailableReason,
      manualUpdateCommand: getManualUpdateCommand(installType, platform, channel),
      manualUpdateHint: getManualUpdateHint(installType, platform, channel),
    };
  }
  return {
    applyAvailable: true,
    updatesApplyEnabled: true,
    applyUnavailableReason: null,
    manualUpdateCommand: null,
    manualUpdateHint: null,
  };
}

export async function updatesRoutes(app: FastifyInstance) {
  // ── Check for updates ──
  // GET /api/updates/check
  // Fetches the newest stable Git tag from GitHub, then hydrates it
  // with matching release metadata when that release exists.
  // For git installs, also checks if the local commit is behind the selected update channel.
  app.get("/check", async (req, reply) => {
    const now = Date.now();
    const currentCommit = getBuildCommit();
    const currentBuild = getBuildLabel();
    const gitInstall = isGitInstall();
    const installType = getInstallType(gitInstall);
    const serverPlatform = getServerPlatform();
    const clientPlatform = getClientPlatform(req.headers["user-agent"]);
    const root = getMonorepoRoot();
    const currentBranch = gitInstall ? await getCurrentBranch(root) : null;
    const channel = await resolveUpdateChannel(
      root,
      (req.query as { channel?: unknown } | undefined)?.channel,
      currentBranch,
    );
    const applyAvailability = getApplyAvailability(installType, serverPlatform, channel);

    // Check commits behind for git installs
    let commitsBehind: number | null = null;
    if (gitInstall) {
      const cached = cachedCommitsBehindByChannel.get(channel.id);
      if (cached && now - cached.timestamp < COMMIT_CHECK_TTL_MS) {
        commitsBehind = cached.commitsBehind;
      } else {
        commitsBehind = await getCommitsBehind(channel);
        cachedCommitsBehindByChannel.set(channel.id, { commitsBehind, timestamp: now });
      }
    }

    // Return cached release info if fresh
    if (cachedRelease && now - cacheTimestamp < CACHE_TTL_MS) {
      const versionUpdate = isNewerVersion(APP_VERSION, cachedRelease.latestVersion);
      return {
        currentVersion: APP_VERSION,
        currentCommit,
        currentBuild,
        channel: channel.id,
        channelLabel: channel.label,
        currentBranch,
        channels: serializeUpdateChannels(),
        ...buildReleasePayload(cachedRelease),
        updateAvailable: (channel.id === "stable" && versionUpdate) || (commitsBehind != null && commitsBehind > 0),
        versionUpdate: channel.id === "stable" ? versionUpdate : false,
        commitsBehind: commitsBehind ?? 0,
        installType,
        serverPlatform,
        clientPlatform,
        ...applyAvailability,
        targetRef: channel.targetRef,
        targetCommit: gitInstall ? await resolveGitRef(root, channel.targetRef) : null,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        cachedRelease = await resolveLatestReleaseFromGitHub(controller.signal);
      } finally {
        clearTimeout(timeout);
      }
      cacheTimestamp = now;

      const versionUpdate = isNewerVersion(APP_VERSION, cachedRelease.latestVersion);
      return {
        currentVersion: APP_VERSION,
        currentCommit,
        currentBuild,
        channel: channel.id,
        channelLabel: channel.label,
        currentBranch,
        channels: serializeUpdateChannels(),
        ...buildReleasePayload(cachedRelease),
        updateAvailable: (channel.id === "stable" && versionUpdate) || (commitsBehind != null && commitsBehind > 0),
        versionUpdate: channel.id === "stable" ? versionUpdate : false,
        commitsBehind: commitsBehind ?? 0,
        installType,
        serverPlatform,
        clientPlatform,
        ...applyAvailability,
        targetRef: channel.targetRef,
        targetCommit: gitInstall ? await resolveGitRef(root, channel.targetRef) : null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({
        error: `Failed to check for updates: ${message}`,
        currentVersion: APP_VERSION,
        currentCommit,
        currentBuild,
        channel: channel.id,
        channelLabel: channel.label,
        currentBranch,
        channels: serializeUpdateChannels(),
        updateAvailable: commitsBehind != null && commitsBehind > 0,
        commitsBehind: commitsBehind ?? 0,
        installType,
        serverPlatform,
        clientPlatform,
        ...applyAvailability,
      });
    }
  });

  // ── Apply update (git installs only) ──
  // POST /api/updates/apply
  // Fast-forwards to the selected update channel, installs, rebuilds, then signals the process to restart.
  app.post<{ Body: ApplyUpdateBody }>("/apply", async (req, reply) => {
    const gitInstall = isGitInstall();
    const installType = getInstallType(gitInstall);
    const serverPlatform = getServerPlatform();
    const root = getMonorepoRoot();
    const currentBranch = gitInstall ? await getCurrentBranch(root) : null;
    const channel = await resolveUpdateChannel(root, req.body?.channel, currentBranch);

    if (!gitInstall) {
      const manualUpdateCommand = getManualUpdateCommand(installType, serverPlatform, channel);
      return reply.status(400).send({
        error: "Auto-update apply is unavailable for this install type",
        message:
          installType === "docker"
            ? `Container installs cannot update themselves from inside the browser. Run: ${DOCKER_UPDATE_COMMAND}`
            : "Auto-update is only available for git-based installs. Download the latest release or update the host manually.",
        installType,
        serverPlatform,
        applyUnavailableReason: installType === "docker" ? "container-install" : "unsupported-install",
        manualUpdateCommand,
        manualUpdateHint: getManualUpdateHint(installType, serverPlatform, channel),
      });
    }

    if (!isUpdatesApplyEnabled()) {
      return reply.status(403).send({
        error: "Auto-update apply is disabled for this install",
        message: `Update manually with: ${getManualUpdateCommand("git", serverPlatform, channel) ?? getGitLauncherCommand(serverPlatform)}. Advanced git installs can enable server-side update application with UPDATES_APPLY_ENABLED=true.`,
        installType: "git",
        serverPlatform,
        applyUnavailableReason: "disabled",
        manualUpdateCommand: getManualUpdateCommand("git", serverPlatform, channel),
        manualUpdateHint: getManualUpdateHint("git", serverPlatform, channel),
      });
    }

    if (
      !requirePrivilegedAccess(req, reply, {
        feature: "Update apply",
        loopbackOnly: !isUpdatesRemoteApplyAllowed(),
      })
    ) {
      return;
    }

    try {
      const body = req.body ?? {};
      if (body.confirm !== true) {
        return reply.status(400).send({ error: "Must send { confirm: true } to apply an update" });
      }
      if (body.currentVersion !== APP_VERSION) {
        return reply.status(409).send({ error: "Current version confirmation does not match the running server" });
      }
      const buildCommit = getBuildCommit();
      if (buildCommit && body.currentCommit && body.currentCommit !== buildCommit) {
        return reply.status(409).send({ error: "Current commit confirmation does not match the running server" });
      }
      if (body.targetRef && body.targetRef !== channel.targetRef) {
        return reply.status(400).send({ error: `Update target ref must be ${channel.targetRef}` });
      }

      const oldHead = await resolveGitRef(root, "HEAD");
      if (!oldHead) {
        throw new Error("Could not read the current git commit.");
      }

      await fetchUpdateRef(root, channel);
      const targetHead = await resolveGitRef(root, channel.targetRef);
      if (!targetHead) {
        throw new Error(`Could not resolve ${channel.targetRef}.`);
      }
      if (!body.targetCommit || body.targetCommit !== targetHead) {
        return reply.status(409).send({
          error: "Update target commit confirmation does not match the latest checked target",
          expectedTargetCommit: targetHead,
        });
      }

      // Step 0: stash local tracked changes so the update does not fail.
      let stashed = false;
      try {
        if (await hasTrackedChanges(root)) {
          await execFileAsync("git", ["stash", "push", "-q", "-m", "auto-stash before update"], {
            cwd: root,
            timeout: 10_000,
          });
          stashed = true;
        }
      } catch {
        /* clean tree — nothing to stash */
      }

      // Step 1: move to the latest selected channel commit.
      // Installer-created release checkouts are shallow detached HEADs, so
      // they cannot reliably merge a remote-tracking branch. A detached
      // checkout is expected there; normal main-branch clones still fast-forward.
      const shouldAttachStagingBranch = channel.id === "staging" && currentBranch !== channel.branch;
      if (oldHead !== targetHead || shouldAttachStagingBranch) {
        try {
          if (channel.id === "staging") {
            if (currentBranch === channel.branch) {
              await execFileAsync("git", ["merge", "--ff-only", channel.targetRef], {
                cwd: root,
                timeout: 60_000,
              });
            } else {
              await checkoutOrCreateUpdateBranch(root, channel);
            }
          } else if (currentBranch === channel.branch) {
            await execFileAsync("git", ["merge", "--ff-only", channel.targetRef], {
              cwd: root,
              timeout: 60_000,
            });
          } else {
            await execFileAsync("git", ["checkout", "--detach", targetHead], {
              cwd: root,
              timeout: 60_000,
            });
          }
        } catch (mergeErr) {
          if (stashed)
            await execFileAsync("git", ["stash", "pop", "-q"], { cwd: root, timeout: 10_000 }).catch(() => {});
          const branchLabel = currentBranch ? ` branch "${currentBranch}"` : " current checkout";
          const message = mergeErr instanceof Error ? mergeErr.message : String(mergeErr);
          throw new Error(`Could not update the${branchLabel} to ${channel.targetRef}: ${message}`);
        }
      }

      // Restore stashed changes after successful pull
      if (stashed) {
        await execFileAsync("git", ["stash", "pop", "-q"], { cwd: root, timeout: 10_000 }).catch(() => {});
      }

      const newHead = await resolveGitRef(root, "HEAD");
      if (!newHead) {
        throw new Error("Could not read the updated git commit.");
      }
      if (newHead !== targetHead) {
        throw new Error(`Update target mismatch: expected ${channel.targetRef} at ${targetHead}, got ${newHead}.`);
      }

      const alreadyUpToDate = oldHead === targetHead;

      // If HEAD already matches the target channel, check if the source actually differs
      // from the running build (e.g. previous update pulled code but failed to build,
      // or the running dist is from a stale commit).
      if (alreadyUpToDate) {
        const currentCommitHash = getBuildCommit();
        const sourceCommit = await resolveGitRef(root, "HEAD", 12);

        // If the commit we're running matches HEAD and version matches, truly up to date
        if (sourceCommit && currentCommitHash && sourceCommit === currentCommitHash) {
          try {
            const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
            if ((pkg.version as string) === APP_VERSION) {
              return { status: "already_up_to_date", message: "Already on the latest version." };
            }
          } catch {
            return { status: "already_up_to_date", message: "Already on the latest version." };
          }
        }
        // Otherwise, source differs from running build — need to rebuild
      }

      // Step 2: pnpm install
      await runPinnedPnpm(root, PNPM_UPDATE_INSTALL_ARGS, 180_000);

      // Step 3: Rebuild all packages
      await runPinnedBuild(root);

      // Step 4: Signal exit so the user can relaunch with the new version.
      // Send response first, then schedule exit.
      const result = {
        status: "updated",
        message: "Update applied successfully. Please relaunch the app to use the new version.",
      };

      // Give Fastify time to flush the response and clear the file-backed
      // store's write-back debounce window (SAVE_DEBOUNCE_MS = 750ms), then
      // shut down GRACEFULLY so pending dirty tables reach disk before exit.
      setTimeout(() => {
        void (async () => {
          try {
            // Mirror index.ts shutdown() (and the onClose hook in app.ts):
            // app.close() runs Fastify onClose -> closeDB() -> fileStore.close()
            // -> flush(true), plus stops the sidecar. A bare process.exit(0)
            // bypasses onClose/beforeExit and silently drops debounced writes.
            await app.close();
            logger.info("[Update] Shutting down after update...");
            process.exit(0);
          } catch (err) {
            // Flush/close failed: log it (process is being torn down for a
            // user-initiated relaunch, so still exit 0 rather than signal a
            // crash to any supervisor).
            logger.error(err, "[Update] Graceful shutdown failed; exiting anyway");
            process.exit(0);
          }
        })();
      }, 1_000);

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const pnpmVersion = getPinnedPnpmVersion(root);
      const manualPnpmCommand = `corepack pnpm@${pnpmVersion}`;
      return reply.status(500).send({
        error: `Update failed: ${message}`,
        hint: `You can try running the update manually: ${getManualGitApplyCommand(channel, serverPlatform, manualPnpmCommand)}. If Corepack cannot launch pnpm ${pnpmVersion}, install the pinned version with npm install -g pnpm@${pnpmVersion} and rerun the command.`,
      });
    }
  });
}
