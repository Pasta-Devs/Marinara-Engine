// Exercise the production entrypoint: a PID-targeted interrupt must reach the
// server even with a TTY, and duplicate terminal signals must not cut off close.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
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
const child = spawn(
  process.execPath,
  [
    // The CI runner has pipes, not a terminal; emulate its isTTY branch without
    // introducing a PTY dependency. Signals themselves target real process IDs.
    "--import",
    "data:text/javascript,Object.defineProperty(process.stdin,'isTTY',{value:true})",
    join(root, "scripts/run-server.mjs"),
    "--import",
    serverRequire.resolve("tsx/esm"),
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
  assert.equal(await exited, 130, "The launcher should retain its signal exit code");
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
