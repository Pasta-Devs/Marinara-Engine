// #4706: the sandbox IPC previously cost ~80 timer wakeups plus a flash write
// per second per running server extension, from boot. These regressions pin
// the adaptive-polling contracts:
//   - the per-MESSAGE size-cap semantics that make burst-after-silence safe
//     (several legal messages batched across an idle gap must not be killed
//     as one oversized message),
//   - the cadence constants and their floors (no high-frequency idle timer
//     can quietly return; heartbeat/staleness keep the same missed-beat
//     multiple),
//   - the host/runner constant pairing (the runner is a standalone .mjs that
//     cannot import server modules — the values are inlined there and pinned
//     here byte-for-byte),
//   - and a live end-to-end pass of the REAL runner under plain node:
//     handshake, log delivery, input pickup after silence, and clean stop.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { appendFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractProtocolLines,
  resolveSandboxPollDelay,
  SANDBOX_HEARTBEAT_INTERVAL_MS,
  SANDBOX_HEARTBEAT_STALE_MS,
  SANDBOX_HOST_IDLE_POLL_MS,
  SANDBOX_HOT_POLL_MS,
  SANDBOX_HOT_WINDOW_MS,
  SANDBOX_RUNNER_IDLE_POLL_MS,
  SANDBOX_WATCHDOG_INTERVAL_MS,
  shouldGrantSandboxResumeGrace,
} from "../../packages/server/src/services/extensions/sandbox-protocol.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CAP = 64;
const extensionRuntimeSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/server/src/services/extensions/personal-server-extension-runtime.ts"),
  "utf8",
);

assert.match(extensionRuntimeSource, /const tickGeneration = \+\+watchdogTickGeneration/u);
assert.match(
  extensionRuntimeSource,
  /if \(tickGeneration !== watchdogTickGeneration \|\| active\.expectedStop\) return;/u,
  "a delayed watchdog sample must not apply after a newer tick starts",
);

// ── Per-message cap semantics ──

const legalBurst = Buffer.from("aaaa\nbbbb\ncccc\n".repeat(20));
assert.ok(legalBurst.byteLength > CAP, "precondition: the burst exceeds the cap in total");
const burst = extractProtocolLines(legalBurst, CAP);
assert.equal(burst.oversized, false, "a burst of individually-legal messages is NOT one oversized message");
assert.equal(burst.lines.length, 60, "every message in the burst is extracted");
assert.equal(burst.rest.byteLength, 0, "nothing left over after a clean burst");

const oversizedComplete = extractProtocolLines(Buffer.from(`${"x".repeat(CAP + 1)}\nok\n`), CAP);
assert.equal(oversizedComplete.oversized, true, "a single complete message over the cap is oversized");

const oversizedResidual = extractProtocolLines(Buffer.from("y".repeat(CAP + 1)), CAP);
assert.equal(oversizedResidual.oversized, true, "an incomplete message already over the cap is oversized");

const partial = extractProtocolLines(Buffer.from("first\nsecond-par"), CAP);
assert.equal(partial.oversized, false);
assert.deepEqual(partial.lines, ["first"]);
assert.equal(partial.rest.toString("utf8"), "second-par", "the residual carries the incomplete message");
const continued = extractProtocolLines(Buffer.concat([partial.rest, Buffer.from("t\n")]), CAP);
assert.deepEqual(continued.lines, ["second-part"], "a message split across reads reassembles from the residual");

const blanks = extractProtocolLines(Buffer.from("\n\na\n\nb\n"), CAP);
assert.deepEqual(blanks.lines, ["a", "b"], "empty lines are dropped, order preserved");

// ── Cadence decisions and floors ──

assert.equal(
  resolveSandboxPollDelay({ now: 10_000, lastActivityAt: 0, settled: false, idlePollMs: 1_000 }),
  SANDBOX_HOT_POLL_MS,
  "an unsettled handshake always polls hot",
);
assert.equal(
  resolveSandboxPollDelay({ now: 10_000, lastActivityAt: 8_000, settled: true, idlePollMs: 1_000 }),
  SANDBOX_HOT_POLL_MS,
  "recent traffic keeps the hot cadence",
);
assert.equal(
  resolveSandboxPollDelay({ now: 10_000, lastActivityAt: 1_000, settled: true, idlePollMs: 1_000 }),
  1_000,
  "stale traffic drops to the idle cadence",
);

assert.ok(SANDBOX_HOST_IDLE_POLL_MS >= 1_000, "the host idle poll must stay human-timescale (#4706)");
assert.ok(SANDBOX_RUNNER_IDLE_POLL_MS >= 250, "the runner idle poll must not reintroduce a 25ms idle timer");
assert.ok(SANDBOX_HEARTBEAT_INTERVAL_MS >= 5_000, "heartbeat writes must stay at most one per 5s");
assert.equal(
  SANDBOX_HEARTBEAT_STALE_MS,
  5 * SANDBOX_HEARTBEAT_INTERVAL_MS,
  "the unresponsive threshold keeps the original five-missed-beats multiple",
);
assert.ok(SANDBOX_WATCHDOG_INTERVAL_MS >= 1_000, "the watchdog must not return to a 250ms cadence");
assert.equal(shouldGrantSandboxResumeGrace(2_000, 0), false, "two watchdog intervals do not imply suspension");
assert.equal(shouldGrantSandboxResumeGrace(2_001, 0), true, "a delayed watchdog tick grants resume grace");

// ── Host/runner constant pairing + no fixed-interval polling ──

const runnerSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/server/src/assets/personal-extension-runner.mjs"),
  "utf8",
);
function runnerConstant(name: string): number {
  const match = runnerSource.match(new RegExp(`const ${name} = ([0-9_]+);`));
  assert.ok(match, `runner must define ${name}`);
  return Number(match![1].replace(/_/g, ""));
}
assert.equal(runnerConstant("HOT_POLL_MS"), SANDBOX_HOT_POLL_MS, "runner hot cadence matches the host contract");
assert.equal(runnerConstant("IDLE_POLL_MS"), SANDBOX_RUNNER_IDLE_POLL_MS, "runner idle cadence matches");
assert.equal(runnerConstant("HOT_WINDOW_MS"), SANDBOX_HOT_WINDOW_MS, "runner hot window matches");
assert.equal(
  runnerConstant("HEARTBEAT_INTERVAL_MS"),
  SANDBOX_HEARTBEAT_INTERVAL_MS,
  "runner heartbeat cadence matches",
);
// The forbidden shape is pinned by exact substring (regex negated classes
// cannot cross the ")" inside "() => void ..." — a lesson from this file's own
// review), and the REQUIRED shape is pinned positively: the chains must exist
// and their delay expressions must actually consult the idle constants.
assert.ok(
  !runnerSource.includes("setInterval(() => void pollInput()"),
  "the runner must not poll its input file on a fixed interval",
);
assert.match(
  runnerSource,
  /inputTimer = setTimeout\(/u,
  "the runner input poll must be a self-scheduling chain that reassigns its stored handle",
);
assert.match(
  runnerSource,
  /HOT_WINDOW_MS \? HOT_POLL_MS : IDLE_POLL_MS/u,
  "the runner's delay expression must actually fall back to the idle cadence",
);
const runtimeSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/server/src/services/extensions/personal-server-extension-runtime.ts"),
  "utf8",
);
assert.ok(
  !runtimeSource.includes("setInterval(() => void pollOutput()"),
  "the host must not poll the output file on a fixed interval",
);
assert.match(
  runtimeSource,
  /active\.outputPoller = setTimeout\(/u,
  "the host output poll must be a self-scheduling chain that reassigns its stored handle",
);
assert.match(
  runtimeSource,
  /idlePollMs: SANDBOX_HOST_IDLE_POLL_MS/u,
  "the host's delay resolution must actually consult the idle constant",
);

// ── Live end-to-end: the real runner under plain node ──

const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function waitForLine(path: string, predicate: (line: string) => boolean, timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const content = await readFile(path, "utf8").catch(() => "");
    const line = content.split("\n").find(predicate);
    if (line) return line;
    await sleep(50);
  }
  return null;
}

const sandboxDir = mkdtempSync(join(tmpdir(), "marinara-ipc-"));
const inputPath = join(sandboxDir, "input.jsonl");
const outputPath = join(sandboxDir, "output.jsonl");
const heartbeatPath = join(sandboxDir, "heartbeat");
writeFileSync(inputPath, "");
writeFileSync(outputPath, "");
writeFileSync(heartbeatPath, "");
const runnerPath = join(REPOSITORY_ROOT, "packages/server/src/assets/personal-extension-runner.mjs");
const child = spawn(process.execPath, [runnerPath, inputPath, outputPath, heartbeatPath], {
  stdio: ["ignore", "ignore", "pipe"],
});
let stderr = "";
child.stderr?.on("data", (chunk: Buffer) => {
  stderr += chunk.toString("utf8");
});
// Registered immediately so cleanup can await the real close event instead of
// guessing with a fixed delay — the child may still hold protocol-file
// handles, and rmSync on Windows refuses open files.
const childClosed = new Promise<void>((resolveClosed) => {
  if (child.exitCode !== null) {
    resolveClosed();
    return;
  }
  child.once("close", () => resolveClosed());
});

try {
  await appendFile(
    inputPath,
    `${JSON.stringify({
      type: "start",
      id: "ipc-regression",
      name: "IPC Regression",
      contentHash: "test",
      source: 'marinara.log.info("runner-alive");',
    })}\n`,
  );
  assert.ok(
    await waitForLine(outputPath, (line) => line.includes('"ready"'), 10_000),
    `the runner completes the start handshake (stderr: ${stderr.slice(0, 300)})`,
  );
  assert.ok(
    await waitForLine(outputPath, (line) => line.includes("runner-alive"), 10_000),
    "extension log output reaches the output file",
  );

  // Let the hot window lapse so the next message exercises the IDLE cadence,
  // then require pickup comfortably within one idle interval plus slack.
  await sleep(SANDBOX_HOT_WINDOW_MS + 500);
  const sentAt = Date.now();
  await appendFile(inputPath, `${JSON.stringify({ type: "stop" })}\n`);
  assert.ok(
    await waitForLine(outputPath, (line) => line.includes('"stopped"'), 10_000),
    "a stop sent after a silence is acknowledged",
  );
  const stopLatency = Date.now() - sentAt;
  assert.ok(
    stopLatency < SANDBOX_RUNNER_IDLE_POLL_MS * 4 + 1_000,
    `stop pickup after silence took ${stopLatency}ms — idle cadence should bound this near ${SANDBOX_RUNNER_IDLE_POLL_MS}ms`,
  );

  const exitCode = await new Promise<number | null>((resolveExit) => {
    if (child.exitCode !== null) {
      resolveExit(child.exitCode);
      return;
    }
    const timer = setTimeout(() => resolveExit(child.exitCode), 5_000);
    child.once("close", (code) => {
      clearTimeout(timer);
      resolveExit(code);
    });
  });
  assert.equal(exitCode, 0, `the runner exits cleanly after stop (stderr: ${stderr.slice(0, 300)})`);

  console.info("Extension IPC regressions passed.");
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  await Promise.race([childClosed, sleep(5_000)]);
  rmSync(sandboxDir, { recursive: true, force: true });
}
