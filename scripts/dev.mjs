import { spawn, spawnSync } from "node:child_process";
import { getWorkspaceInstallProblems } from "./check-workspace-install.mjs";
import { resolveDevSharedBuildScript } from "./dev-shared-build.mjs";
import { resolvePnpmRunner } from "./pnpm-runner.mjs";

function parseIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const SERVER_PORT = parseIntegerEnv("PORT", 7860);
const SERVER_HEALTH_URL = `http://127.0.0.1:${SERVER_PORT}/api/health`;
const HEALTH_TIMEOUT_MS = parseIntegerEnv("DEV_SERVER_READY_TIMEOUT_MS", 120_000);
const SHARED_BUILD_SCRIPT = resolveDevSharedBuildScript();

const pnpmRunner = resolvePnpmRunner();

// This server boots from the developer's working repo. Hard-refuse server-side
// update application (#5646): without this, a loopback browser tab's channel
// switch could stash local changes, move HEAD, and force-rebuild the checkout
// underneath the running dev/e2e session. Children inherit this environment.
process.env.UPDATES_APPLY_DISABLED = "true";

const children = new Set();
let shuttingDown = false;

function spawnPnpm(args, options = {}) {
  const child = spawn(pnpmRunner.command, [...pnpmRunner.args, ...args], {
    stdio: "inherit",
    windowsHide: true,
    detached: process.platform !== "win32",
    ...options,
  });
  children.add(child);
  return child;
}

function runPnpm(args) {
  return new Promise((resolve, reject) => {
    const child = spawnPnpm(args);
    child.once("exit", (code, signal) => {
      children.delete(child);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`pnpm ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });
}

function stopChildren(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      try {
        process.kill(-child.pid, signal);
      } catch (err) {
        if (err?.code !== "ESRCH") child.kill(signal);
      }
    }
  }
}

async function fetchMarinaraHealth() {
  const response = await fetch(SERVER_HEALTH_URL, {
    signal: AbortSignal.timeout(1_500),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const health = await response.json();
  if (
    !health ||
    typeof health !== "object" ||
    health.status !== "ok" ||
    typeof health.version !== "string" ||
    typeof health.build !== "string"
  ) {
    throw new Error("the port answered, but it was not a Marinara Engine health response");
  }
  return health;
}

function hasErrorCode(error, expectedCode, seen = new Set()) {
  if (!error || typeof error !== "object" || seen.has(error)) return false;
  seen.add(error);
  if (error.code === expectedCode) return true;
  if (hasErrorCode(error.cause, expectedCode, seen)) return true;
  return (
    Array.isArray(error.errors) && error.errors.some((nestedError) => hasErrorCode(nestedError, expectedCode, seen))
  );
}

async function waitForServer() {
  const startedAt = Date.now();
  let lastError = null;
  while (!shuttingDown && Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    try {
      await fetchMarinaraHealth();
      return Date.now() - startedAt;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (shuttingDown) {
    throw new Error(`Server process exited before it became ready at ${SERVER_HEALTH_URL}`);
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown error");
  throw new Error(`Server did not become ready at ${SERVER_HEALTH_URL} within ${HEALTH_TIMEOUT_MS}ms (${detail})`);
}

process.on("SIGINT", () => {
  process.exitCode = 130;
  stopChildren("SIGINT");
});
process.on("SIGTERM", () => {
  process.exitCode = 143;
  stopChildren("SIGTERM");
});
process.on("SIGHUP", () => {
  process.exitCode = 129;
  stopChildren("SIGTERM");
});

try {
  const installProblems = getWorkspaceInstallProblems();
  if (installProblems.length > 0) {
    console.log(`[dev] Workspace dependencies are missing or stale: ${installProblems.join(", ")}. Synchronizing...`);
    await runPnpm(["install", "--frozen-lockfile"]);
    const remainingProblems = getWorkspaceInstallProblems();
    if (remainingProblems.length > 0) {
      throw new Error(
        `Workspace dependency validation still fails after pnpm install. Missing: ${remainingProblems.join(", ")}`,
      );
    }
  }

  if (process.env.DEV_SKIP_SHARED_BUILD !== "true") {
    await runPnpm(["--filter", "@marinara-engine/shared", SHARED_BUILD_SCRIPT]);
  }

  let existingServer = null;
  try {
    existingServer = await fetchMarinaraHealth();
  } catch (err) {
    if (!hasErrorCode(err, "ECONNREFUSED")) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[dev] Cannot start the server because ${SERVER_HEALTH_URL} is occupied or unavailable (${detail}).`,
        { cause: err },
      );
    }
    // Nothing is listening, so start this session's server below.
  }

  if (existingServer) {
    console.log(
      `[dev] Marinara Engine ${existingServer.build} is already running at ${SERVER_HEALTH_URL}. ` +
        "Reusing it and starting the client.",
    );
  } else {
    const server = spawnPnpm(["--filter", "@marinara-engine/server", "dev"]);
    server.once("exit", (code, signal) => {
      if (!shuttingDown) {
        stopChildren();
        process.exitCode = code ?? (signal ? 1 : 0);
      }
    });

    console.log(`[dev] Waiting for server at ${SERVER_HEALTH_URL}...`);
    const readyMs = await waitForServer();
    console.log(`[dev] Server ready in ${readyMs}ms; starting client.`);
  }

  const client = spawnPnpm(["--filter", "@marinara-engine/client", "dev"]);
  client.once("exit", (code, signal) => {
    if (!shuttingDown) {
      stopChildren();
      process.exitCode = code ?? (signal ? 1 : 0);
    }
  });
} catch (err) {
  stopChildren();
  console.error(err instanceof Error ? err.message : err);
  if (process.exitCode === undefined) {
    process.exitCode = 1;
  }
}
