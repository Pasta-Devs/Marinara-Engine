import { spawn, spawnSync } from "node:child_process";
import { basename } from "node:path";

function parseIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const SERVER_PORT = parseIntegerEnv("PORT", 7860);
const SERVER_HEALTH_URL = `http://127.0.0.1:${SERVER_PORT}/api/health`;
const HEALTH_TIMEOUT_MS = parseIntegerEnv("DEV_SERVER_READY_TIMEOUT_MS", 120_000);

const pnpmCliPath = process.env.npm_execpath;
const npmUserAgent = process.env.npm_config_user_agent ?? "";
const useCurrentPnpm =
  Boolean(pnpmCliPath) && (npmUserAgent.startsWith("pnpm/") || basename(pnpmCliPath ?? "").startsWith("pnpm"));
const pnpmCommand = useCurrentPnpm ? process.execPath : "pnpm";
const pnpmBaseArgs = useCurrentPnpm && pnpmCliPath ? [pnpmCliPath] : [];
const children = new Set();
let shuttingDown = false;

function spawnPnpm(args, options = {}) {
  const child = spawn(pnpmCommand, [...pnpmBaseArgs, ...args], {
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

function runPnpm(args) {
  return new Promise((resolve, reject) => {
    const child = spawnPnpm(args);
    child.once("exit", (code, signal) => {
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
    if (child.killed || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill(signal);
    }
  }
}

async function waitForServer() {
  const startedAt = Date.now();
  let lastError = null;
  while (!shuttingDown && Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    try {
      const response = await fetch(SERVER_HEALTH_URL, {
        signal: AbortSignal.timeout(1_500),
      });
      if (response.ok) return Date.now() - startedAt;
      lastError = new Error(`HTTP ${response.status}`);
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

process.on("SIGINT", () => stopChildren("SIGINT"));
process.on("SIGTERM", () => stopChildren("SIGTERM"));

try {
  await runPnpm(["build:shared"]);

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
