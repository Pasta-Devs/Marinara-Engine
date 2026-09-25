// Engine process control: status, lock, quiet wait, stop, build, start, deploy. Process lookup and start/stop are in
// proc.mjs (Windows and POSIX paths).
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import {
  AGENT,
  BACKUP_DIR,
  INSTANCE,
  IS_WINDOWS,
  LOCK_FILE,
  PORT,
  REPO,
  RUN_DIR,
  SERVER_DIR,
} from "./config.mjs";
import { health } from "./api.mjs";
import { lastStartupReady, secondsSinceLastGeneration } from "./logs.mjs";
import { clearPidFile, engineRoot, isAlive, looksLikeEngine, listenerProcess, startDetached, stopTree, tail, writePidFile } from "./proc.mjs";
import { SANDBOX_LOG, startSandboxProcess } from "./sandbox.mjs";
import { record, sleep, stamp } from "./util.mjs";

const run = promisify(execFile);
const PACKAGES = ["shared", "server", "client"];
const KEEP_DIST_BACKUPS = 5;
const LIVE_OUT_LOG = join(RUN_DIR, "live-server.out.log");
const LIVE_ERR_LOG = join(RUN_DIR, "live-server.err.log");

export const engineProcess = (port = PORT) => listenerProcess(port);

// ------------------------------------------------------------------ lock

const LOCK_STALE_MS = 45 * 60_000;

export function readLock() {
  if (!existsSync(LOCK_FILE)) return null;
  try {
    const lock = JSON.parse(readFileSync(LOCK_FILE, "utf8"));
    // A lock older than 45 minutes is abandoned (a crashed agent), not held.
    if (!(Date.now() - Date.parse(lock.at) <= LOCK_STALE_MS)) return { ...lock, stale: true };
    return lock;
  } catch {
    // An unreadable lock (a write cut short) is judged by its file time, so it neither frees the lock at once nor
    // blocks it forever.
    try {
      const at = statSync(LOCK_FILE).mtimeMs;
      return { agent: "unknown (unreadable lock file)", at: new Date(at).toISOString(), purpose: "unknown", stale: Date.now() - at > LOCK_STALE_MS };
    } catch {
      return null;
    }
  }
}

/** Identifies this server process as the lock owner. Two clients with the same agent name still get two tokens. */
const SESSION = `${AGENT}:${process.pid}:${randomUUID()}`;

const lockBody = (purpose) =>
  JSON.stringify({ agent: AGENT, session: SESSION, at: new Date().toISOString(), purpose, pid: process.pid });

/** The operation that holds the lock in this process. MCP clients can run tools concurrently in one session. */
let activeOperation = null;

/**
 * Take the engine lock. The file is created with the exclusive flag, so of two sessions racing for a free (or stale)
 * lock exactly one wins. A second operation in this same session is refused while the first holds it.
 */
export function acquireLock(purpose) {
  if (activeOperation) throw new Error(`this server is already running "${activeOperation}"; wait for it to finish`);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const held = readLock();
    if (held?.session === SESSION) {
      writeFileSync(LOCK_FILE, lockBody(purpose));
      activeOperation = purpose;
      return;
    }
    if (held && !held.stale) {
      throw new Error(`engine lock held by ${held.agent} since ${held.at} for "${held.purpose}"; wait or ask them`);
    }
    // Remove a stale lock only if it is still the same stale lock, then race for the file like everyone else.
    if (held?.stale && readLock()?.session === held.session) rmSync(LOCK_FILE, { force: true });
    try {
      writeFileSync(LOCK_FILE, lockBody(purpose), { flag: "wx" });
      activeOperation = purpose;
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  const held = readLock();
  throw new Error(`engine lock held by ${held?.agent ?? "another session"}; wait or ask them`);
}

/** Keep a held lock fresh during long steps, so it is never mistaken for an abandoned one. */
export function refreshLock() {
  const held = readLock();
  if (held?.session === SESSION) writeFileSync(LOCK_FILE, lockBody(held.purpose));
}

export function releaseLock() {
  activeOperation = null;
  if (readLock()?.session === SESSION) rmSync(LOCK_FILE, { force: true });
}

// ------------------------------------------------------------------ status

async function git(args) {
  try {
    const { stdout } = await run("git", ["-C", REPO, ...args], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    return stdout.trim();
  } catch (error) {
    return `git error: ${error.message.split("\n")[0]}`;
  }
}

export async function gitSummary() {
  const [branch, head, status, upstream] = await Promise.all([
    git(["branch", "--show-current"]),
    git(["log", "--oneline", "-5"]),
    git(["status", "--short"]),
    git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]),
  ]);
  const dirty = status ? status.split("\n") : [];
  return { branch, recentCommits: head.split("\n"), dirtyCount: dirty.length, dirty: dirty.slice(0, 60), aheadBehind: upstream };
}

function distInfo() {
  return Object.fromEntries(
    PACKAGES.map((pkg) => {
      const dir = join(REPO, "packages", pkg, "dist");
      return [pkg, existsSync(dir) ? new Date(statSync(dir).mtimeMs).toISOString() : null];
    }),
  );
}

/** The engine's own startup summary: /api/health `startup` when the build has it, else the last startup.ready line. */
function startupSummary(healthBody) {
  const s = healthBody?.startup ?? lastStartupReady();
  if (!s || typeof s !== "object") return null;
  return {
    bootId: s.bootId ?? null,
    readyAfterMs: s.elapsedMs ?? null,
    at: s.time ? new Date(s.time).toISOString() : undefined,
    runtime: s.buildIntegrity?.runtime ?? s.runtime ?? null,
    buildStale: s.buildIntegrity?.stale ?? s.buildStale ?? null,
    failedPhases: s.phases?.failed ?? [],
    slowestPhases: (s.phases?.slowest ?? []).slice(0, 3),
    failedPackages: s.packages?.failed ?? [],
  };
}

export async function status() {
  const body = await health();
  const proc = await engineProcess().catch(() => null);
  return {
    port: PORT,
    online: body !== null,
    version: body?.build ?? body?.version ?? null,
    startup: startupSummary(body),
    process: proc
      ? {
          pid: proc.pid,
          started: proc.started,
          chain: proc.chain.map((p) => `${p.pid} ${p.name ?? "?"}: ${String(p.cmd ?? "").slice(0, 160)}`),
        }
      : null,
    secondsSinceLastGeneration: secondsSinceLastGeneration(),
    lock: readLock(),
    dist: distInfo(),
    git: await gitSummary(),
  };
}

// ------------------------------------------------------------------ stop / start

/** Wait until no player generation has happened for `quietSeconds` (bounded by `maxWaitSeconds`). */
export async function waitForQuiet(quietSeconds, maxWaitSeconds) {
  const deadline = Date.now() + maxWaitSeconds * 1000;
  for (;;) {
    const since = secondsSinceLastGeneration();
    if (since === null || since >= quietSeconds) return { waited: true, secondsQuiet: since };
    if (Date.now() > deadline) return { waited: false, secondsQuiet: since };
    refreshLock();
    await sleep(15_000);
  }
}

/** Stop the engine on `port`: the whole tree from the run-server supervisor (or launcher) down to the server. */
export async function stopEngine(port = PORT) {
  const proc = await engineProcess(port);
  const portHealth = () =>
    health({ base: `http://127.0.0.1:${port}/api`, origin: `http://127.0.0.1:${port}`, timeoutMs: 3000 });
  if (!proc) {
    // The process lookup (lsof / ss / netstat / PID file) can miss a running engine; never call that "not running".
    if (await portHealth()) {
      throw new Error(`the engine answers /api/health on port ${port} but its process could not be found; stop it yourself`);
    }
    return { stopped: false, reason: "not running" };
  }
  if (!looksLikeEngine(proc, port)) {
    throw new Error(
      proc.chain[0]?.cmd == null
        ? `port ${port} is held by PID ${proc.pid}, which could not be identified as the engine; stop it yourself`
        : `port ${port} is held by a process that does not look like the engine: ${String(proc.chain[0].cmd).slice(0, 200)}`,
    );
  }
  const top = engineRoot(proc);
  const exited = await stopTree(top.pid, { watchPid: proc.pid });
  if (!exited || (await portHealth())) {
    throw new Error(`engine PID ${proc.pid} did not exit within 60 s`);
  }
  clearPidFile(port);
  return { stopped: true, pid: proc.pid, stoppedTree: top.pid };
}

async function waitForHealth(timeoutSeconds, pid, errLog) {
  const started = Date.now();
  const deadline = started + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    if (await health({ timeoutMs: 5000 })) return Math.round((Date.now() - started) / 1000);
    if (pid && !isAlive(pid)) {
      throw new Error(`engine process ${pid} exited during startup. Output tail:\n${tail(errLog)}`);
    }
    await sleep(3000);
  }
  if (pid && isAlive(pid)) await stopTree(pid);
  throw new Error(`engine did not answer /api/health within ${timeoutSeconds} s and was stopped; see ${errLog}`);
}

/**
 * Launch the server the way the launchers' final step does: in packages/server,
 * `node ../../scripts/run-server.mjs dist/index.js` (the run-server supervisor keeps in-app restarts working; the
 * server reads the repo .env itself). Never through start.bat / start.sh: both run
 * `git clean -fd -- packages/*\/src` before launching, which deletes untracked source files.
 */
export async function startEngine(timeoutSeconds = 720) {
  if (await health({ timeoutMs: 5000 })) return { started: false, reason: "already running" };
  if (INSTANCE === "sandbox") {
    const pid = await startSandboxProcess();
    return { started: true, instance: "sandbox", pid, afterSeconds: await waitForHealth(timeoutSeconds, pid, SANDBOX_LOG) };
  }
  if (!existsSync(join(SERVER_DIR, "dist", "index.js"))) throw new Error("packages/server/dist/index.js is missing; build first");
  const pid = await startDetached({
    cwd: SERVER_DIR,
    args: ["../../scripts/run-server.mjs", "dist/index.js"],
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORT), AUTO_OPEN_BROWSER: "false" },
    outLog: LIVE_OUT_LOG,
    errLog: LIVE_ERR_LOG,
    windowsStartProcess: true,
  });
  writePidFile(PORT, pid);
  return { started: true, pid, afterSeconds: await waitForHealth(timeoutSeconds, pid, LIVE_ERR_LOG), output: RUN_DIR };
}

// ------------------------------------------------------------------ pnpm / tsc / regressions

/** corepack's own script next to the running node, so the default command needs no shell on Windows. */
const COREPACK_JS = join(dirname(process.execPath), "node_modules", "corepack", "dist", "corepack.js");

function pnpmCommand() {
  const parts = (process.env.MARINARA_DEV_PNPM || "corepack pnpm").trim().split(/\s+/);
  if (parts[0] === "corepack" && existsSync(COREPACK_JS)) {
    return { file: process.execPath, prefix: [COREPACK_JS, ...parts.slice(1)], shell: false };
  }
  // Anything else is a .cmd shim on Windows, which Node only runs through a shell: allow plain words and paths only.
  if (IS_WINDOWS && !parts.every((part) => /^[A-Za-z0-9_@.:/\\-]+$/.test(part))) {
    throw new Error("MARINARA_DEV_PNPM may only contain a command and plain arguments (no shell characters or spaces in paths)");
  }
  return { file: parts[0], prefix: parts.slice(1), shell: IS_WINDOWS };
}

async function pnpm(args, timeoutMs = 15 * 60_000) {
  let command;
  try {
    command = pnpmCommand();
  } catch (error) {
    return { ok: false, output: error.message };
  }
  const { file, prefix, shell } = command;
  try {
    const { stdout, stderr } = await run(file, [...prefix, ...args], {
      cwd: REPO,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      shell,
    });
    return { ok: true, output: `${stdout}\n${stderr}` };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ""}\n${error.stderr ?? ""}\n${error.message}` };
  }
}

/** src/**\/*.ts files (not .d.ts or tests) with no matching dist .js: a build that "succeeded" but did not emit. */
function missingServerOutputs() {
  const missing = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(SERVER_DIR, "src", dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") && !/\.(test|spec)\.ts$/.test(entry.name)) {
        if (!existsSync(join(SERVER_DIR, "dist", rel.replace(/\.ts$/, ".js")))) missing.push(rel);
      }
    }
  };
  walk("");
  return missing;
}

function pruneDistBackups() {
  const old = readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith("dist-"))
    .sort()
    .slice(0, -KEEP_DIST_BACKUPS);
  for (const name of old) rmSync(join(BACKUP_DIR, name), { recursive: true, force: true });
}

/** Build packages in dependency order. Every touched dist is backed up first and restored if any build fails. */
export async function build(packages) {
  const wanted = PACKAGES.filter((pkg) => packages.includes(pkg) || packages.includes("all"));
  if ((wanted.includes("server") || wanted.includes("client")) && !wanted.includes("shared")) wanted.unshift("shared");
  const backup = join(BACKUP_DIR, `dist-${stamp()}`);
  for (const pkg of wanted) {
    const dist = join(REPO, "packages", pkg, "dist");
    if (existsSync(dist)) cpSync(dist, join(backup, pkg), { recursive: true });
  }
  const results = [];
  for (const pkg of wanted) {
    refreshLock();
    // A stale tsconfig.tsbuildinfo (for example after a dist restore) makes tsc decide everything is up to date and
    // emit nothing, which produces a dist missing new files. Always build from scratch.
    rmSync(join(REPO, "packages", pkg, "tsconfig.tsbuildinfo"), { force: true });
    const result = await pnpm(["--filter", `@marinara-engine/${pkg}`, "build"]);
    if (result.ok && pkg === "server") {
      const missing = missingServerOutputs();
      if (missing.length) {
        result.ok = false;
        result.output += `\nserver dist is missing ${missing.length} compiled file(s), e.g. ${missing.slice(0, 5).join(", ")}`;
      }
    }
    results.push({ pkg, ok: result.ok, tail: result.output.trim().split("\n").slice(-15).join("\n") });
    if (!result.ok) {
      for (const done of wanted) {
        const saved = join(backup, done);
        const dist = join(REPO, "packages", done, "dist");
        if (existsSync(saved)) {
          rmSync(dist, { recursive: true, force: true });
          cpSync(saved, dist, { recursive: true });
          rmSync(join(REPO, "packages", done, "tsconfig.tsbuildinfo"), { force: true });
        }
      }
      return { ok: false, backup, results, restored: true };
    }
  }
  pruneDistBackups();
  return { ok: true, backup, results };
}

function tscPath(pkgDir) {
  for (const base of [pkgDir, REPO]) {
    const candidate = join(base, "node_modules", "typescript", "bin", "tsc");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("typescript is not installed in the repo; run pnpm install first");
}

export async function typecheck(pkg) {
  const targets = pkg === "all" ? ["server", "client"] : [pkg];
  const results = [];
  // shared's emitted types feed the other packages. Rebuilding its dist is a write that a concurrent build or
  // restart also makes, so it takes the engine lock for the build only (not for tsc).
  acquireLock("typecheck: rebuild shared");
  let shared;
  try {
    shared = await pnpm(["--filter", "@marinara-engine/shared", "build"]);
  } finally {
    releaseLock();
  }
  if (!shared.ok) return [{ pkg: "shared(build)", ok: false, errors: shared.output.split("\n").slice(-30) }];
  for (const target of targets) {
    const cwd = join(REPO, "packages", target);
    try {
      await run(process.execPath, [tscPath(cwd), "--noEmit", "-p", "."], {
        cwd,
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024,
        timeout: 10 * 60_000,
      });
      results.push({ pkg: target, ok: true, errors: [] });
    } catch (error) {
      const lines = String(error.stdout ?? "").split("\n").filter((l) => l.includes("error TS"));
      results.push({ pkg: target, ok: false, errorCount: lines.length, errors: lines.slice(0, 60), note: lines.length ? undefined : String(error.message).slice(0, 500) });
    }
  }
  return results;
}

export async function regressions(filter, timeoutMs = 20 * 60_000) {
  const args = ["scripts/run-regressions.mjs", ...(filter ? ["--filter", filter] : [])];
  let output;
  let runError = null;
  try {
    const { stdout, stderr } = await run(process.execPath, args, {
      cwd: REPO,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 256 * 1024 * 1024,
    });
    output = `${stdout}\n${stderr}`;
  } catch (error) {
    output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    // Why the runner did not finish cleanly: a failing script (non-zero exit), a timeout kill or a spawn error.
    runError = error.killed
      ? `the run was stopped after ${Math.round(timeoutMs / 1000)} s (timeout)`
      : typeof error.code === "number"
        ? `exit code ${error.code}`
        : String(error.message).split("\n")[0];
  }
  const lines = output.split("\n");
  const passed = lines.filter((l) => /\] PASSED/.test(l));
  const failed = lines.filter((l) => /\] FAILED/.test(l)).map((l) => l.replace(/^.*regressions[\\/]/, "").trim());
  const assertions = lines
    .filter((l) => /AssertionError|Error:|error TS|expected|actual:/.test(l) && !/"level":\d0/.test(l))
    .slice(0, 60)
    .map((l) => l.slice(0, 400));
  const summary = lines.find((l) => l.startsWith("Regression summary")) ?? null;
  // ok only when the runner finished, printed its summary and reported no failures.
  const ok = !runError && summary !== null && failed.length === 0;
  return { ok, ...(runError ? { runError } : {}), summary, passed: passed.length, failed, failureDetail: assertions };
}

// ------------------------------------------------------------------ deploy

/** Full restart: lock, optional quiet wait, stop, optional build, start, activity log. Relaunches the old build if a build fails. */
export async function deploy({ packages, waitQuiet, quietSeconds, maxWaitSeconds, reason }) {
  // Rebuilding changes the shared dist, so it always takes the lock; a sandbox-only restart does not.
  const needsLock = INSTANCE === "live" || packages.length > 0;
  if (needsLock) acquireLock(`restart (${INSTANCE}): ${reason}`);
  if (INSTANCE === "sandbox") waitQuiet = false;
  const steps = [];
  const action = packages.length ? "deploy" : "restart";
  try {
    if (waitQuiet) {
      const quiet = await waitForQuiet(quietSeconds, maxWaitSeconds);
      steps.push({ step: "quiet", ...quiet });
      if (!quiet.waited) throw new Error(`no ${quietSeconds} s quiet window within ${maxWaitSeconds} s; someone is playing`);
    }
    steps.push({ step: "stop", ...(await stopEngine()) });
    // A start that found an engine already answering did not relaunch anything, so the restart did not happen.
    const start = async () => {
      const started = await startEngine();
      steps.push({ step: "start", ...started });
      if (!started.started) throw new Error(`the engine was not relaunched (${started.reason ?? "unknown reason"})`);
    };
    if (packages.length) {
      const built = await build(packages);
      steps.push({ step: "build", ...built });
      await start();
      if (!built.ok) throw new Error("build failed; the previous build was restored and relaunched");
    } else {
      await start();
    }
    record(action, { instance: INSTANCE, reason, packages, ok: true });
    return { ok: true, steps };
  } catch (error) {
    record(action, { instance: INSTANCE, reason, packages, ok: false, error: error.message });
    if (!(await health({ timeoutMs: 5000 })) && steps.some((s) => s.step === "stop" && s.stopped)) {
      try {
        steps.push({ step: "recover-start", ...(await startEngine()) });
      } catch (startError) {
        steps.push({ step: "recover-start", error: startError.message });
      }
    }
    return { ok: false, error: error.message, steps };
  } finally {
    if (needsLock) releaseLock();
  }
}
