import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePlaywrightProjectStdio, resolvePnpmRunner } from "../scripts/pnpm-runner.mjs";
import { resetPlaywrightData } from "./global-setup.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = resolve(repoRoot, ".tmp/playwright-data");
const children = new Set();
let shuttingDown = false;

function parsePort(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : fallback;
}

const desktopClientPort = parsePort("PLAYWRIGHT_CLIENT_PORT", 5178);
const desktopServerPort = parsePort("PLAYWRIGHT_SERVER_PORT", 7971);
const mobileClientPort = parsePort("PLAYWRIGHT_MOBILE_CLIENT_PORT", 5179);
const mobileServerPort = parsePort("PLAYWRIGHT_MOBILE_SERVER_PORT", 7972);

const pnpmRunner = resolvePnpmRunner();
const playwrightProjectStdio = resolvePlaywrightProjectStdio();

function spawnChild(command, args, env = process.env, stdio = "inherit") {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env,
    stdio,
    windowsHide: true,
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

function runPnpm(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnChild(pnpmRunner.command, [...pnpmRunner.args, ...args]);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
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

function startProject(name, clientPort, serverPort) {
  const dataDir = resolve(dataRoot, name);
  mkdirSync(dataDir, { recursive: true });
  const child = spawnChild(
    process.execPath,
    [resolve(repoRoot, "scripts/dev.mjs")],
    {
      ...process.env,
      DATA_DIR: dataDir,
      DEV_SKIP_SHARED_BUILD: "true",
      MARINARA_ENV_FILE: resolve(dataDir, ".env"),
      PORT: String(serverPort),
      VITE_PORT: String(clientPort),
    },
    playwrightProjectStdio,
  );
  child.once("exit", (code, signal) => {
    if (shuttingDown) return;
    stopChildren();
    process.exitCode = code ?? (signal ? 1 : 0);
  });
  return child;
}

async function waitForUrl(url) {
  const timeoutMs = Number.parseInt(process.env.DEV_SERVER_READY_TIMEOUT_MS ?? "180000", 10);
  const startedAt = Date.now();
  let lastError = null;
  while (!shuttingDown && Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown error");
  throw new Error(`Playwright server did not become ready at ${url} (${detail})`);
}

process.on("SIGINT", () => stopChildren("SIGINT"));
process.on("SIGTERM", () => stopChildren("SIGTERM"));

// CI shards set PLAYWRIGHT_ONLY_PROJECT to boot just the server pair their
// Playwright project talks to (#5637) — no test reaches across to the other
// pair's ports. Unset (local runs) keeps the boot-both behavior.
const onlyProject = ["desktop", "mobile"].includes(process.env.PLAYWRIGHT_ONLY_PROJECT?.trim())
  ? process.env.PLAYWRIGHT_ONLY_PROJECT.trim()
  : null;

try {
  resetPlaywrightData();
  await runPnpm(["--filter", "@marinara-engine/shared", "build:preserve"]);
  if (onlyProject !== "desktop") {
    startProject("mobile", mobileClientPort, mobileServerPort);
    await waitForUrl(`http://127.0.0.1:${mobileClientPort}`);
  }
  if (onlyProject !== "mobile") {
    startProject("desktop", desktopClientPort, desktopServerPort);
  }
} catch (error) {
  stopChildren();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
