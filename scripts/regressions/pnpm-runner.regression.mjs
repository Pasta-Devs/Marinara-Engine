import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { removeLegacyPnpmStore, resolvePlaywrightProjectStdio, resolvePnpmRunner } from "../pnpm-runner.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const nativeRunner = resolvePnpmRunner({
  environment: { npm_config_user_agent: "pnpm/12.15.0", npm_execpath: process.execPath },
});
assert.deepEqual(
  nativeRunner,
  { command: process.execPath, args: [] },
  "Native pnpm must execute directly, not as Node source",
);
assert.equal(spawnSync(nativeRunner.command, [...nativeRunner.args, "--version"]).status, 0);
const nativeCli = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("../pnpm-runner.mjs", import.meta.url)), "--version"],
  {
    encoding: "utf8",
    env: { ...process.env, npm_config_user_agent: "pnpm/12.15.0", npm_execpath: process.execPath },
  },
);
assert.equal(nativeCli.status, 0, nativeCli.stderr);
assert.equal(
  nativeCli.stdout.trim(),
  process.version,
  "Nested scripts reuse the native runner instead of a global pnpm",
);
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
      npm_execpath:
        "C:\\Users\\runner\\AppData\\Local\\pnpm\\.tools\\@pnpm+exe\\10.34.5\\node_modules\\@pnpm\\exe\\pnpm.exe",
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
  resolvePnpmRunner({
    platform: "linux",
    execPath: "/usr/local/bin/node",
    environment: {
      npm_config_user_agent: "pnpm/10.34.5 npm/? node/v24.15.0 linux x64",
      npm_execpath: "/opt/pnpm/pnpm",
    },
  }),
  { command: "/usr/local/bin/node", args: ["/opt/pnpm/pnpm"] },
  "POSIX must keep reusing an extensionless pnpm CLI path with the current Node process.",
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

// pnpm 12 keeps the checkout's store in .pnpm-store/v11; the pnpm 10 store beside it is dead weight.
const storeRoot = mkdtempSync(join(tmpdir(), "marinara-legacy-store-"));
try {
  for (const layout of ["v10/files/00", "v11/files/00"])
    mkdirSync(join(storeRoot, ".pnpm-store", layout), { recursive: true });
  assert.equal(removeLegacyPnpmStore(storeRoot, {}), false, "Without a pnpm user agent nothing is removed.");
  assert.equal(
    removeLegacyPnpmStore(storeRoot, { npm_config_user_agent: "pnpm/10.34.5 npm/? node/v24.15.0 linux x64" }),
    false,
    "A pnpm 10 install still uses its v10 store.",
  );
  assert.ok(existsSync(join(storeRoot, ".pnpm-store", "v10")));
  assert.equal(
    removeLegacyPnpmStore(storeRoot, { npm_config_user_agent: "pnpm/12.15.0 npm/? node/? linux x64" }),
    true,
    "A pnpm 12 install reclaims the stranded pnpm 10 store.",
  );
  assert.ok(!existsSync(join(storeRoot, ".pnpm-store", "v10")));
  assert.ok(existsSync(join(storeRoot, ".pnpm-store", "v11", "files", "00")), "The live v11 store stays.");
  assert.equal(
    removeLegacyPnpmStore(storeRoot, { npm_config_user_agent: "pnpm/12.15.0 npm/? node/? linux x64" }),
    false,
  );
} finally {
  rmSync(storeRoot, { recursive: true, force: true });
}
const nativeDepsSource = readFileSync(join(repositoryRoot, "scripts", "ensure-native-deps.mjs"), "utf8");
assert.match(nativeDepsSource, /removeLegacyPnpmStore\(repoRoot\)/u, "The root postinstall reclaims the v10 store.");
// Termux drops the v10 store before installing, so both stores never have to fit at once. The launcher runs
// under set -e, so a store it cannot remove, like a prune that fails, is a warning and startup goes on.
const termuxLauncherSource = readFileSync(join(repositoryRoot, "start-termux.sh"), "utf8");
const pruneStart = termuxLauncherSource.indexOf("prune_pnpm_store() {");
const pruneEnd = termuxLauncherSource.indexOf("\ninstall_workspace_dependencies()", pruneStart);
assert.ok(pruneStart >= 0 && pruneEnd > pruneStart, "start-termux.sh must define prune_pnpm_store");
const termuxStoreRoot = mkdtempSync(join(tmpdir(), "marinara-termux-store-"));
const runTermuxPrune = (stubs) => {
  mkdirSync(join(termuxStoreRoot, ".pnpm-store", "v10", "files"), { recursive: true });
  writeFileSync(join(termuxStoreRoot, "pnpm-calls"), "");
  const script = `set -e\n${termuxLauncherSource.slice(pruneStart, pruneEnd)}\n${stubs}\nprune_pnpm_store\necho startup-continued`;
  const result = spawnSync("bash", ["-c", script], { cwd: termuxStoreRoot, encoding: "utf8" });
  assert.equal(result.status, 0, `prune_pnpm_store must not stop startup:\n${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /startup-continued/u);
  return { output: result.stdout, pnpmCalls: readFileSync(join(termuxStoreRoot, "pnpm-calls"), "utf8") };
};
try {
  const recordPnpm = 'run_pnpm() { echo "$*" >> pnpm-calls; }';
  let run = runTermuxPrune(recordPnpm);
  assert.ok(!existsSync(join(termuxStoreRoot, ".pnpm-store", "v10")), "Termux removes the v10 store.");
  assert.equal(run.pnpmCalls, "store prune\n");
  assert.doesNotMatch(run.output, /\[WARN\]/u);
  run = runTermuxPrune(`rm() { return 1; }\n${recordPnpm}`);
  assert.match(run.output, /\[WARN\] Could not remove the pnpm 10 dependency cache/u);
  assert.equal(run.pnpmCalls, "store prune\n", "The store is still pruned after a failed removal.");
  run = runTermuxPrune("run_pnpm() { return 1; }");
  assert.match(run.output, /\[WARN\] Could not prune the pnpm store/u);
} finally {
  rmSync(termuxStoreRoot, { recursive: true, force: true });
}

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
