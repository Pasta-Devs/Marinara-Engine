// Exercise the production entrypoint: a PID-targeted interrupt must reach the
// server even with a TTY, and duplicate terminal signals must not cut off close.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const serverRequire = createRequire(join(root, "packages/server/package.json"));
const dir = mkdtempSync(join(tmpdir(), "marinara-signal-shutdown-"));
const probe = createServer();
await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
const address = probe.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise<void>((done) => probe.close(() => done()));
// PID-targeted kill is forceful on Windows. Exercise its actual console delivery instead.
if (process.platform === "win32") {
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(root, "scripts/regressions/fixtures/windows-console-shutdown.ps1"),
        "-Root",
        root,
        "-Loader",
        pathToFileURL(serverRequire.resolve("tsx/esm")).href,
        "-DataDir",
        dir,
        "-Port",
        String(port),
      ],
      { stdio: "inherit", timeout: 45_000 },
    );
  } catch (error) {
    for (const name of ["progress.log", "stdout.log", "stderr.log"]) {
      try {
        process.stderr.write(`Windows console fixture ${name}:\n${readFileSync(join(dir, name), "utf8")}\n`);
      } catch {
        // A failure before process creation may leave no redirected output.
      }
    }
    throw error;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  process.exit(0);
}
const child = spawn(
  process.execPath,
  [
    // The CI runner has pipes, not a terminal; emulate its isTTY branch without
    // introducing a PTY dependency. Signals themselves target real process IDs.
    "--import",
    "data:text/javascript,Object.defineProperty(process.stdin,'isTTY',{value:true})",
    join(root, "scripts/run-server.mjs"),
    "--import",
    pathToFileURL(serverRequire.resolve("tsx/esm")).href,
    join(root, "packages/server/src/index.ts"),
  ],
  {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dir,
      FILE_STORAGE_DIR: join(dir, "storage"),
      NODE_ENV: "production",
      MARINARA_LITE: "true",
      LOG_LEVEL: "info",
      LOG_DISABLE_REQUEST_LOGGING: "false",
      AUTO_CREATE_DEFAULT_CONNECTION: "false",
      AUTO_OPEN_BROWSER: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});
const exited = new Promise<number | null>((done) => child.once("exit", done));
const deadline = setTimeout(() => child.kill("SIGKILL"), 20_000);
let serverPid: number | undefined;
let socket: ReturnType<typeof createConnection> | undefined;
async function waitFor(predicate: () => boolean, timeout = 8_000) {
  const started = Date.now();
  while (!predicate() && Date.now() - started < timeout && child.exitCode === null)
    await new Promise((done) => setTimeout(done, 25));
  assert.ok(predicate(), output);
}
try {
  await waitFor(() => output.includes("Marinara Engine server listening"));
  const readyLine = output.split("\n").find((line) => line.includes("Marinara Engine server listening"))!;
  serverPid = JSON.parse(readyLine).pid;
  assert.ok(serverPid);
  // Hold an actual in-flight request so both interrupts arrive while app.close
  // is pending; its existing deadline severs the socket and lets storage flush.
  socket = createConnection({ host: "127.0.0.1", port });
  socket.on("error", () => undefined);
  await new Promise<void>((done) => socket!.once("connect", done));
  socket.write(
    "POST /api/chats HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 10000\r\n\r\n{",
  );
  await waitFor(() => output.includes('"msg":"incoming request"'));
  child.kill("SIGINT");
  await waitFor(() => output.includes("Received SIGINT; shutting down"), 2_000);
  process.kill(serverPid, "SIGINT");
  assert.equal(await exited, 0, "A graceful server shutdown must not become a launcher error");
  assert.ok(output.includes("Shutdown complete"), `Repeated interrupts must finish graceful close: ${output}`);
  assert.ok(!output.includes("forcing exit now"), output);
  assert.throws(() => process.kill(serverPid!, 0), "No server may survive the launcher");
} finally {
  socket?.destroy();
  child.kill("SIGTERM");
  if (serverPid) {
    try {
      process.kill(serverPid, "SIGTERM");
    } catch {
      /* already stopped */
    }
  }
  await exited;
  clearTimeout(deadline);
  rmSync(dir, { recursive: true, force: true });
}
console.log("Production server PID-targeted TTY interrupt and duplicate-signal graceful shutdown passed.");

// A hung-up PTY returns EIO on stdout; an isTTY stub over pipes cannot test
// the logger's exit flush or the session stamp after the terminal disappears.
for (const nodeEnv of ["production", "development"]) {
  for (const mode of ["hangup", "signal", "busy-hangup"]) {
    execFileSync(
      "python3",
      [
        join(root, "scripts/regressions/fixtures/posix-terminal-shutdown.py"),
        root,
        process.execPath,
        pathToFileURL(serverRequire.resolve("tsx/esm")).href,
        mode,
        nodeEnv,
      ],
      { stdio: "inherit", timeout: 40_000 },
    );
  }
}
console.log("Real POSIX terminal hangup flushed confirmed saves, released the lease, and stamped a clean exit.");
