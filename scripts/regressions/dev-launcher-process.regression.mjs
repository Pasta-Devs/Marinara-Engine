import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { constants, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = mkdtempSync(join(tmpdir(), "marinara-dev-launcher-"));
// dev.mjs reads the repository's .env one folder up, so it lives in scripts/ here too.
const fixtureScriptsRoot = join(fixtureRoot, "scripts");
mkdirSync(fixtureScriptsRoot);
const fixtureDevPath = join(fixtureScriptsRoot, "dev.mjs");
const fixtureCliPath = join(fixtureRoot, "fake-pnpm.mjs");
const fixtureWorkerPath = join(fixtureRoot, "worker.mjs");

copyFileSync(join(repositoryRoot, "scripts/dev.mjs"), fixtureDevPath);
copyFileSync(join(repositoryRoot, "scripts/pnpm-runner.mjs"), join(fixtureScriptsRoot, "pnpm-runner.mjs"));
copyFileSync(join(repositoryRoot, "scripts/read-launcher-env.mjs"), join(fixtureScriptsRoot, "read-launcher-env.mjs"));
writeFileSync(
  join(fixtureScriptsRoot, "check-workspace-install.mjs"),
  "export function getWorkspaceInstallProblems() { return []; }\n",
);
writeFileSync(
  join(fixtureScriptsRoot, "dev-shared-build.mjs"),
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
  throw new Error(typeof message === "function" ? message() : message);
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
  const environment = { ...process.env, PORT: String(port) };
  // null: leave PORT unexported, so only the fixture's .env names the port.
  if (port === null) delete environment.PORT;
  delete environment.MARINARA_ENV_FILE;
  const child = spawn(process.execPath, [fixtureDevPath], {
    cwd: fixtureRoot,
    env: {
      ...environment,
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

// The stopped launcher and its trees must be gone, or a leftover keeps the launcher's output pipe open.
async function assertRunStopped(run, message) {
  const pids = readLines(run.pidPath).map(Number);
  await waitUntil(
    () => pids.every((pid) => !isProcessAlive(pid)),
    () => `${message}: ${pids.filter(isProcessAlive).join(", ")}`,
  );
}

// #8601: cleanup must reach every recorded process. A fake pnpm is its group's leader, but a worker is not,
// so killing "-worker" fails with ESRCH; and a group outlives its dead leader, so a dead pid is still tried.
function forceStopRun(run) {
  for (const rawPid of readLines(run.pidPath)) {
    const pid = Number(rawPid);
    if (!Number.isInteger(pid) || pid <= 1) continue;
    if (process.platform === "win32") {
      if (isProcessAlive(pid)) spawnSync("taskkill.exe", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
      continue;
    }
    for (const target of [-pid, pid]) {
      if (target > 0 && !isProcessAlive(target)) continue;
      try {
        process.kill(target, "SIGKILL");
      } catch (err) {
        if (err?.code !== "ESRCH") throw err;
      }
    }
  }
  if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill("SIGKILL");
  // A process that escaped anyway must not hold this script open by its share of the launcher's output.
  run.child.stdout.destroy();
  run.child.stderr.destroy();
}

const runs = [];
const servers = [];

function cleanUp() {
  for (const run of runs) forceStopRun(run);
  for (const server of servers) {
    if (server.listening) server.close();
  }
  rmSync(fixtureRoot, { recursive: true, force: true });
}

// A stop from the launcher regression runner (a timeout or Ctrl+C) still cleans up: each fixture launcher and
// fake pnpm leads its own process group, which a stop sent to this script's group does not reach.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    cleanUp();
    process.exit(128 + constants.signals[signal]);
  });
}

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
  await stopLauncher(ownedRun);
  await assertRunStopped(ownedRun, "Launcher shutdown left descendants alive");
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
    await stopLauncher(hangupRun, "SIGHUP");
    await assertRunStopped(hangupRun, "Terminal hangup left descendants alive");
    await assertHealthEndpointUnavailable(hangupPort);
  }

  // PORT only in .env: the health check must poll it and the server child must be handed it.
  const envFilePort = await reservePort();
  writeFileSync(
    join(fixtureRoot, ".env"),
    `PORT=${envFilePort}
`,
  );
  const envFileRun = launchFixture(null, "env-file");
  runs.push(envFileRun);
  await waitUntil(async () => {
    try {
      const response = await fetchHealth(envFilePort);
      // Four pids: both fake pnpm processes and both workers. Stopping while a worker is still being
      // started can leave it behind (#8601).
      return response.ok && readLines(envFileRun.pidPath).length >= 4;
    } catch {
      return false;
    }
  }, "Launcher did not start its server on the PORT from .env");
  assert.ok(envFileRun.output().stdout.includes(`127.0.0.1:${envFilePort}/api/health`), envFileRun.output().stdout);
  assert.ok(
    readLines(envFileRun.logPath).some((line) => line.includes("@marinara-engine/client")),
    "Launcher did not start the client after the server on the PORT from .env",
  );
  await stopLauncher(envFileRun);
  await assertRunStopped(envFileRun, "Launcher shutdown with PORT from .env left descendants alive");
  rmSync(join(fixtureRoot, ".env"));

  const reusableServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", version: "fixture", build: "existing-build" }));
  });
  servers.push(reusableServer);
  const reusablePort = await listen(reusableServer);
  const reusableRun = launchFixture(reusablePort, "reusable");
  runs.push(reusableRun);
  // Two pids: the client's fake pnpm and its worker. The log line alone is written before the worker
  // starts, and a stop in that gap left the worker running and this script waiting on it (#8601).
  await waitUntil(
    () =>
      readLines(reusableRun.logPath).some((line) => line.includes("@marinara-engine/client")) &&
      readLines(reusableRun.pidPath).length >= 2,
    "Launcher did not start the client while reusing a healthy server",
  );
  const reusableInvocations = readLines(reusableRun.logPath);
  assert.ok(
    reusableInvocations.every((line) => !line.includes("@marinara-engine/server")),
    "A verified Marinara health response must prevent a duplicate server",
  );
  assert.match(reusableRun.output().stdout, /Reusing it and starting the client/u);
  await stopLauncher(reusableRun);
  await assertRunStopped(reusableRun, "Launcher shutdown while reusing a server left descendants alive");
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
  cleanUp();
}
