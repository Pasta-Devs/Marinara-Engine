// Closing the terminal window hangs up the whole launcher job (#6183): the
// server must treat SIGHUP as a graceful shutdown, and it must finish that
// shutdown with a dead stdout - a hung-up pty answers every write with EIO,
// and Pino's exit-time flush would otherwise retry a buffered line forever,
// until the launcher's ten-second SIGKILL backstop. Stage 1 hangs up a
// pipe-backed launcher job the way a shell does (every POSIX platform).
// Stage 2 hangs up a real pty through python3 - the only shape that reaches
// the EIO path, and the one users actually produce.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (process.platform === "win32") {
  console.log("Terminal hangup shutdown lane skipped: POSIX signal semantics only.");
  process.exit(0);
}

const root = resolve(import.meta.dirname, "../..");
const serverRequire = createRequire(join(root, "packages/server/package.json"));
const loader = pathToFileURL(serverRequire.resolve("tsx/esm")).href;
const launcher = join(root, "scripts/run-server.mjs");
const entry = join(root, "packages/server/src/index.ts");
const READY_LINE = "Marinara Engine server listening";

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
  const address = probe.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((done) => probe.close(() => done()));
  return port;
}

function serverEnv(dir: string, port: number): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    DATA_DIR: dir,
    FILE_STORAGE_DIR: join(dir, "storage"),
    NODE_ENV: "production",
    MARINARA_LITE: "true",
    // The lane asserts on the info-level shutdown lines, and their buffered
    // bytes are exactly what Pino's exit flush retries against a dead pty.
    LOG_LEVEL: "info",
    LOG_DISABLE_REQUEST_LOGGING: "false",
    AUTO_CREATE_DEFAULT_CONNECTION: "false",
    AUTO_OPEN_BROWSER: "false",
  };
}

function leaseDir(dir: string) {
  return join(dir, "storage", ".writer-lease");
}

function sessionExitKind(dir: string): string | undefined {
  const beat = JSON.parse(readFileSync(join(dir, "diagnostics", "session-heartbeat.json"), "utf8")) as {
    exitKind?: string;
  };
  return beat.exitKind;
}

function processIsGone(pid: number) {
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

async function waitFor(predicate: () => boolean, timeoutMs: number, detail: () => string) {
  const started = Date.now();
  while (!predicate() && Date.now() - started < timeoutMs) await new Promise((done) => setTimeout(done, 25));
  assert.ok(predicate(), detail());
}

// ── Stage 1: hang up a pipe-backed launcher job ─────────────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), "marinara-hangup-pipe-"));
  const port = await freePort();
  // detached: the launcher gets its own process group, so the hangup can be
  // delivered to the whole job at once - launcher and server - like a shell
  // does when its terminal closes.
  const child = spawn(process.execPath, [launcher, "--import", loader, entry], {
    env: serverEnv(dir, port),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  const exited = new Promise<number | null>((done) => child.once("exit", done));
  const killJob = (signal: NodeJS.Signals) => {
    try {
      process.kill(-child.pid!, signal);
    } catch {
      /* already gone */
    }
  };
  const deadline = setTimeout(() => killJob("SIGKILL"), 25_000);
  // Only a newline-terminated ready record counts: a pipe chunk boundary can
  // split the line, and a partial record must not be parsed.
  const readyRecord = () => {
    const lines = output.split("\n");
    const index = lines.findIndex((line) => line.includes(READY_LINE));
    return index >= 0 && index < lines.length - 1 ? lines[index] : undefined;
  };
  try {
    await waitFor(
      () => readyRecord() !== undefined && existsSync(leaseDir(dir)),
      15_000,
      () => output,
    );
    const serverPid = (JSON.parse(readyRecord()!) as { pid: number }).pid;
    assert.ok(serverPid);
    killJob("SIGHUP");
    const launcherExit = await exited;
    assert.ok(output.includes("Received SIGHUP; shutting down Marinara Engine"), output);
    assert.ok(output.includes("Shutdown complete"), `A hangup must finish the graceful close: ${output}`);
    assert.ok(!output.includes("forcing exit now"), output);
    assert.equal(launcherExit, 0, `A graceful hangup shutdown must not become a launcher error: ${output}`);
    assert.ok(!existsSync(leaseDir(dir)), "The writer lease must be released by the hangup shutdown");
    assert.equal(sessionExitKind(dir), "clean", "The session must be stamped as a clean exit, not a force-quit");
    await waitFor(
      () => processIsGone(serverPid),
      5_000,
      () => "No server may survive the launcher",
    );
  } finally {
    clearTimeout(deadline);
    killJob("SIGKILL");
    await exited;
    rmSync(dir, { recursive: true, force: true });
  }
}
console.log("Pipe-backed launcher job hangup completed a graceful shutdown.");

// ── Stage 2: hang up a real pty ─────────────────────────────────────────────
// python3 forks the launcher onto a fresh pty as its session leader, waits for
// the server, then closes the pty master: the kernel hangs the pty up and
// signals the launcher, which relays SIGHUP to a server whose stdout now
// answers EIO. The report carries the launcher's exit status and how long the
// job took to end after the hangup.
const PTY_HARNESS = `
import json, os, pty, select, signal, sys, time
node, launcher, loader, entry = sys.argv[1:5]
pid, master = pty.fork()
if pid == 0:
    os.execv(node, [node, launcher, "--import", loader, entry])
out = b""
deadline = time.time() + 30
while b"${READY_LINE}" not in out and time.time() < deadline:
    ready, _, _ = select.select([master], [], [], 0.2)
    if not ready:
        continue
    try:
        chunk = os.read(master, 65536)
    except OSError:
        chunk = b""
    if not chunk:
        break
    out += chunk
if b"${READY_LINE}" not in out:
    sys.stderr.write(out.decode("utf8", "replace")[-4000:])
    sys.exit(2)
time.sleep(0.5)
started = time.time()
os.close(master)
# Poll instead of blocking: a job that never ends must be reported, not waited on.
reaped = 0
while time.time() - started < 20:
    reaped, status = os.waitpid(pid, os.WNOHANG)
    if reaped:
        break
    time.sleep(0.05)
timed_out = reaped == 0
if timed_out:
    os.killpg(pid, signal.SIGKILL)
    _, status = os.waitpid(pid, 0)
print(json.dumps({"timedOut": timed_out, "launcherExit": None if timed_out else os.waitstatus_to_exitcode(status), "shutdownMs": round((time.time() - started) * 1000)}))
`;

const pythonAvailable = spawnSync("python3", ["-c", "import pty, os, select"], { stdio: "ignore" }).status === 0;
if (!pythonAvailable) {
  console.log("Real pty hangup stage skipped: python3 with the pty module is unavailable on this machine.");
} else {
  const dir = mkdtempSync(join(tmpdir(), "marinara-hangup-pty-"));
  const port = await freePort();
  const harness = join(dir, "hangup.py");
  writeFileSync(harness, PTY_HARNESS);
  try {
    const result = spawnSync("python3", [harness, process.execPath, launcher, loader, entry], {
      env: serverEnv(dir, port),
      encoding: "utf8",
      timeout: 60_000,
    });
    assert.equal(result.status, 0, `The pty harness failed: ${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(result.stdout.trim().split("\n").pop()!) as {
      timedOut: boolean;
      launcherExit: number | null;
      shutdownMs: number;
    };
    assert.ok(!report.timedOut, "The job never ended after the hangup; the pty harness had to kill it");
    assert.ok(
      report.shutdownMs < 8_000,
      `The job took ${report.shutdownMs} ms to end after the hangup: a shutdown that waits on the launcher's SIGKILL backstop is one that never stamped its exit`,
    );
    assert.equal(
      report.launcherExit,
      0,
      `A graceful hangup shutdown must not become a launcher error (${JSON.stringify(report)})`,
    );
    assert.ok(!existsSync(leaseDir(dir)), "The writer lease must be released even though the terminal is gone");
    assert.equal(sessionExitKind(dir), "clean", "The session must be stamped clean with the terminal gone");
    console.log(`Real pty hangup completed a graceful shutdown in ${report.shutdownMs} ms.`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
console.log("Terminal hangup graceful shutdown passed.");
