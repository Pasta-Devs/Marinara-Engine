import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePlaywrightProjectStdio, resolvePnpmRunner } from "../pnpm-runner.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const windowsNode = "C:\\Program Files\\nodejs\\node.exe";
const windowsPnpmCli =
  "C:\\Users\\runner\\AppData\\Local\\pnpm\\.tools\\pnpm\\10.34.5\\node_modules\\pnpm\\bin\\pnpm.cjs";
const windowsComSpec = "C:\\Windows\\System32\\cmd.exe";

assert.deepEqual(
  resolvePnpmRunner({
    platform: "win32",
    execPath: windowsNode,
    environment: { npm_config_user_agent: "pnpm/10.34.5 npm/? node/v24.15.0 win32 x64", npm_execpath: windowsPnpmCli },
  }),
  { command: windowsNode, args: [windowsPnpmCli] },
  "A pnpm invocation with its JavaScript CLI must keep using the current Node process.",
);

assert.deepEqual(
  resolvePnpmRunner({
    platform: "win32",
    execPath: windowsNode,
    environment: { ComSpec: windowsComSpec, npm_config_user_agent: "pnpm/10.34.5 npm/? node/v24.15.0 win32 x64" },
  }),
  { command: windowsComSpec, args: ["/d", "/s", "/c", "pnpm"] },
  "Windows must invoke pnpm through ComSpec when pnpm's CLI path is unavailable; Node cannot directly run pnpm.CMD.",
);

assert.deepEqual(
  resolvePnpmRunner({
    platform: "win32",
    execPath: windowsNode,
    environment: {
      ComSpec: windowsComSpec,
      npm_config_user_agent: "pnpm/10.34.5 npm/? node/v24.15.0 win32 x64",
      npm_execpath: "C:\\Users\\runner\\AppData\\Local\\pnpm\\.tools\\@pnpm+exe\\10.34.5\\node_modules\\@pnpm\\exe\\pnpm.exe",
    },
  }),
  { command: windowsComSpec, args: ["/d", "/s", "/c", "pnpm"] },
  "Standalone Windows pnpm installs expose a native pnpm.exe as npm_execpath; Node cannot execute that binary, so fall back to ComSpec.",
);

assert.deepEqual(
  resolvePnpmRunner({
    platform: "linux",
    execPath: "/usr/local/bin/node",
    environment: { npm_config_user_agent: "pnpm/10.34.5 npm/? node/v24.15.0 linux x64" },
  }),
  { command: "pnpm", args: [] },
  "POSIX keeps the direct pnpm fallback.",
);

assert.deepEqual(
  resolvePlaywrightProjectStdio("win32"),
  ["ignore", "inherit", "inherit"],
  "Windows Playwright project children must not inherit Playwright's piped stdin while preserving output.",
);
assert.equal(
  resolvePlaywrightProjectStdio("linux"),
  "inherit",
  "POSIX Playwright project children keep inherited stdio.",
);

async function reservePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

function stopTree(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

async function waitForOutput(state, expected, child, timeoutMs = 10_000) {
  if (state.output.includes(expected)) return;
  await new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${expected}. Output:\n${state.output}`));
    }, timeoutMs);
    const onOutput = () => {
      if (!state.output.includes(expected)) return;
      cleanup();
      resolvePromise();
    };
    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`Process exited with ${signal ?? code} before ${expected}. Output:\n${state.output}`));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      state.listeners.delete(onOutput);
      child.off("exit", onExit);
    };
    state.listeners.add(onOutput);
    child.once("exit", onExit);
  });
}

async function verifyDirectDevInheritsPipedStdin() {
  if (process.platform !== "win32") {
    console.log("Skipping Windows direct-dev stdin probe on non-Windows.");
    return;
  }

  const fixtureDirectory = mkdtempSync(join(tmpdir(), "marinara-pnpm-runner-"));
  const fakePnpmPath = join(fixtureDirectory, "pnpm.mjs");
  const marker = `direct-dev-marker-${process.pid}`;
  const port = await reservePort();
  const fakePnpmSource = `
import { createServer } from "node:http";
const marker = process.env.MARINARA_PNPM_RUNNER_MARKER;
const isServer = process.argv.includes("@marinara-engine/server");
if (!isServer) {
  process.stdout.write("FAKE_PNPM_CLIENT_READY\\n");
  setInterval(() => {}, 1_000);
} else {
  let healthResponse;
  let receivedMarker = false;
  const respondWhenReady = () => {
    if (!healthResponse || !receivedMarker) return;
    healthResponse.end(JSON.stringify({ status: "ok", version: "test", build: "test" }));
    healthResponse = undefined;
  };
  const server = createServer((request, response) => {
    if (request.url !== "/api/health") {
      response.statusCode = 404;
      response.end();
      return;
    }
    healthResponse = response;
    respondWhenReady();
  });
  process.stdin.on("data", (data) => {
    if (!data.toString().includes(marker)) return;
    receivedMarker = true;
    process.stdout.write("FAKE_PNPM_SERVER_RECEIVED_MARKER\\n");
    respondWhenReady();
  });
  server.listen(Number(process.env.PORT), "127.0.0.1", () => process.stdout.write("FAKE_PNPM_SERVER_READY\\n"));
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  setInterval(() => {}, 1_000);
}
`;
  writeFileSync(fakePnpmPath, fakePnpmSource);

  const child = spawn(process.execPath, [join(repositoryRoot, "scripts", "dev.mjs")], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      DEV_SKIP_SHARED_BUILD: "true",
      DEV_SERVER_READY_TIMEOUT_MS: "8000",
      MARINARA_PNPM_RUNNER_MARKER: marker,
      PORT: String(port),
      npm_config_user_agent: "pnpm/10.34.5 npm/? node/v24.15.0 win32 x64",
      npm_execpath: fakePnpmPath,
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const state = { listeners: new Set(), output: "" };
  const recordOutput = (chunk) => {
    state.output += chunk.toString();
    for (const listener of state.listeners) listener();
  };
  child.stdout.on("data", recordOutput);
  child.stderr.on("data", recordOutput);

  try {
    await waitForOutput(state, "FAKE_PNPM_SERVER_READY", child);
    child.stdin.write(`${marker}\n`);
    await waitForOutput(state, "FAKE_PNPM_SERVER_RECEIVED_MARKER", child);
    await waitForOutput(state, "FAKE_PNPM_CLIENT_READY", child);
  } finally {
    stopTree(child);
    if (child.exitCode === null) await once(child, "exit");
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
}

await verifyDirectDevInheritsPipedStdin();
console.log("pnpm runner regressions passed.");
