import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = mkdtempSync(join(tmpdir(), "marinara-dev-launcher-"));
const fixtureDevPath = join(fixtureRoot, "dev.mjs");
const fixtureCliPath = join(fixtureRoot, "fake-pnpm.mjs");
const fixtureWorkerPath = join(fixtureRoot, "worker.mjs");

copyFileSync(join(repositoryRoot, "scripts/dev.mjs"), fixtureDevPath);
copyFileSync(join(repositoryRoot, "scripts/pnpm-runner.mjs"), join(fixtureRoot, "pnpm-runner.mjs"));
writeFileSync(
  join(fixtureRoot, "check-workspace-install.mjs"),
  "export function getWorkspaceInstallProblems() { return []; }\n",
);
writeFileSync(
  join(fixtureRoot, "dev-shared-build.mjs"),
  'export function resolveDevSharedBuildScript() { return "build"; }\n',
);
writeFileSync(
  fixtureCliPath,
  `import { appendFileSync } from "node:fs";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
appendFileSync(process.env.FIXTURE_LOG_PATH, JSON.stringify(args) + "\\n");
appendFileSync(process.env.FIXTURE_PID_PATH, String(process.pid) + "\\n");
const role = args.includes("@marinara-engine/server")
  ? "server"
  : args.includes("@marinara-engine/client")
    ? "client"
    : null;
if (!role) process.exit(0);
const worker = spawn(process.execPath, [process.env.FIXTURE_WORKER_PATH, role], { stdio: "inherit" });
worker.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
setInterval(() => {}, 1_000);
`,
);
writeFileSync(
  fixtureWorkerPath,
  `import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const role = process.argv[2];
appendFileSync(process.env.FIXTURE_PID_PATH, String(process.pid) + "\\n");
if (role === "server") {
  createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", version: "fixture", build: "fixture-build" }));
  }).listen(Number(process.env.PORT), "127.0.0.1");
} else {
  setInterval(() => {}, 1_000);
}
`,
);

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function waitUntil(predicate, message, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(50);
  }
  throw new Error(message);
}

async function listen(server) {
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return address.port;
}

async function reservePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

function fetchHealth(port, timeoutMs = 500) {
  return fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function assertHealthEndpointUnavailable(port) {
  const signal = AbortSignal.timeout(1_000);
  await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`, { signal }), () => !signal.aborted);
}

function readLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/u).filter(Boolean);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err?.code === "ESRCH") return false;
    throw err;
  }
}

function launchFixture(port, name) {
  const logPath = join(fixtureRoot, `${name}.log`);
  const pidPath = join(fixtureRoot, `${name}.pids`);
  const child = spawn(process.execPath, [fixtureDevPath], {
    cwd: fixtureRoot,
    env: {
      ...process.env,
      PORT: String(port),
      DEV_SKIP_SHARED_BUILD: "true",
      DEV_SERVER_READY_TIMEOUT_MS: "4000",
      npm_execpath: fixtureCliPath,
      npm_config_user_agent: "pnpm/fixture",
      FIXTURE_LOG_PATH: logPath,
      FIXTURE_PID_PATH: pidPath,
      FIXTURE_WORKER_PATH: fixtureWorkerPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  return { child, logPath, pidPath, output: () => ({ stdout, stderr }) };
}

function waitForExit(child, timeoutMs = 8_000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return Promise.race([
    new Promise((resolveExit) => child.once("exit", (code, signal) => resolveExit({ code, signal }))),
    delay(timeoutMs).then(() => {
      throw new Error(`Launcher process ${child.pid} did not exit`);
    }),
  ]);
}

async function stopLauncher(run, signal = "SIGTERM") {
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/pid", String(run.child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    run.child.kill(signal);
  }
  const exit = await waitForExit(run.child);
  if (process.platform !== "win32") {
    assert.deepEqual(
      exit,
      { code: signal === "SIGHUP" ? 129 : 143, signal: null },
      `${signal} should preserve the launcher's conventional exit code`,
    );
  }
  return exit;
}

function forceStopRun(run) {
  for (const rawPid of readLines(run.pidPath)) {
    const pid = Number(rawPid);
    if (!Number.isInteger(pid) || pid <= 1 || !isProcessAlive(pid)) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill.exe", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      try {
        process.kill(-pid, "SIGKILL");
      } catch (err) {
        if (err?.code !== "ESRCH") process.kill(pid, "SIGKILL");
      }
    }
  }
  if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill("SIGKILL");
}

const runs = [];
const servers = [];
try {
  const ownedPort = await reservePort();
  const ownedRun = launchFixture(ownedPort, "owned");
  runs.push(ownedRun);
  await waitUntil(async () => {
    try {
      const response = await fetchHealth(ownedPort);
      return (
        response.ok && (await response.json()).build === "fixture-build" && readLines(ownedRun.pidPath).length >= 4
      );
    } catch {
      return false;
    }
  }, "Fixture launcher did not start both process trees");
  const ownedPids = readLines(ownedRun.pidPath).map(Number);
  await stopLauncher(ownedRun);
  await waitUntil(
    () => ownedPids.every((pid) => !isProcessAlive(pid)),
    `Launcher shutdown left descendants alive: ${ownedPids.filter(isProcessAlive).join(", ")}`,
  );
  await assertHealthEndpointUnavailable(ownedPort);

  if (process.platform !== "win32") {
    const hangupPort = await reservePort();
    const hangupRun = launchFixture(hangupPort, "hangup");
    runs.push(hangupRun);
    await waitUntil(async () => {
      try {
        const response = await fetchHealth(hangupPort);
        return response.ok && readLines(hangupRun.pidPath).length >= 4;
      } catch {
        return false;
      }
    }, "Fixture launcher did not start both process trees before terminal hangup");
    const hangupPids = readLines(hangupRun.pidPath).map(Number);
    await stopLauncher(hangupRun, "SIGHUP");
    await waitUntil(
      () => hangupPids.every((pid) => !isProcessAlive(pid)),
      `Terminal hangup left descendants alive: ${hangupPids.filter(isProcessAlive).join(", ")}`,
    );
    await assertHealthEndpointUnavailable(hangupPort);
  }

  const reusableServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", version: "fixture", build: "existing-build" }));
  });
  servers.push(reusableServer);
  const reusablePort = await listen(reusableServer);
  const reusableRun = launchFixture(reusablePort, "reusable");
  runs.push(reusableRun);
  await waitUntil(
    () => readLines(reusableRun.logPath).some((line) => line.includes("@marinara-engine/client")),
    "Launcher did not start the client while reusing a healthy server",
  );
  const reusableInvocations = readLines(reusableRun.logPath);
  assert.ok(
    reusableInvocations.every((line) => !line.includes("@marinara-engine/server")),
    "A verified Marinara health response must prevent a duplicate server",
  );
  assert.match(reusableRun.output().stdout, /Reusing it and starting the client/u);
  await stopLauncher(reusableRun);
  const reusedHealth = await fetch(`http://127.0.0.1:${reusablePort}/api/health`);
  assert.equal(reusedHealth.ok, true, "Launcher shutdown must not stop a server it did not start");
  await new Promise((resolveClose) => reusableServer.close(resolveClose));

  const unrelatedServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
  });
  servers.push(unrelatedServer);
  const unrelatedPort = await listen(unrelatedServer);
  const unrelatedRun = launchFixture(unrelatedPort, "unrelated");
  runs.push(unrelatedRun);
  const unrelatedExit = await waitForExit(unrelatedRun.child);
  assert.equal(unrelatedExit.code, 1, "An unrelated service on the server port must fail preflight");
  assert.deepEqual(readLines(unrelatedRun.logPath), [], "Invalid health must not start either Marinara process");
  assert.match(unrelatedRun.output().stderr, /occupied or unavailable/u);
  assert.match(unrelatedRun.output().stderr, /not a Marinara Engine health response/u);
  await new Promise((resolveClose) => unrelatedServer.close(resolveClose));

  console.log("Dev launcher process regression checks passed.");
} finally {
  for (const run of runs) forceStopRun(run);
  for (const server of servers) {
    if (server.listening) server.close();
  }
  rmSync(fixtureRoot, { recursive: true, force: true });
}
