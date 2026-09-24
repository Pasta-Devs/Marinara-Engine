// Shutdown safety. By default every signal, repeat and runtime stop behaves
// exactly as before. Opt-in: SHUTDOWN_WINDOWS_CONSOLE_SIGNALS routes every
// Windows console stop request to the graceful path, SHUTDOWN_FORCE_EXIT_ON_REPEAT
// lets a deliberate keypress repeat force exit while duplicate delivery and
// repeated SIGHUP/SIGTERM do not, and SHUTDOWN_RUNTIME_STOP_BUDGET_MS keeps a
// hung runtime stop from holding the file store close (flush plus writer lease
// release) back.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const dataDir = mkdtempSync(join(tmpdir(), "marinara-shutdown-safety-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";

const signals = await import("../../packages/server/src/lib/shutdown-signals.js");
const steps = await import("../../packages/server/src/lib/shutdown-steps.js");
const deadline = await import("../../packages/server/src/lib/shutdown-deadline.js");

for (const name of [
  "SHUTDOWN_WINDOWS_CONSOLE_SIGNALS",
  "SHUTDOWN_FORCE_EXIT_ON_REPEAT",
  "SHUTDOWN_RUNTIME_STOP_BUDGET_MS",
  "SHUTDOWN_EARLY_FLUSH",
]) {
  delete process.env[name];
}

// 0. Defaults are the signals index.ts always handled and no runtime stop budget.
assert.deepEqual(signals.shutdownSignalsFor("win32").sort(), ["SIGINT", "SIGTERM"], "default Windows signals");
assert.deepEqual(signals.shutdownSignalsFor("linux").sort(), ["SIGHUP", "SIGINT", "SIGTERM"]);
assert.equal(signals.runtimeStopBudgetFor("SIGINT", "win32"), Number.POSITIVE_INFINITY, "default waits for stops");
assert.equal(signals.runtimeStopBudgetFor("SIGTERM", "linux"), Number.POSITIVE_INFINITY);
assert.equal(steps.getRuntimeStopBudgetMs(), Number.POSITIVE_INFINITY);
process.env.SHUTDOWN_WINDOWS_CONSOLE_SIGNALS = "true";
assert.deepEqual(signals.shutdownSignalsFor("win32").sort(), ["SIGBREAK", "SIGHUP", "SIGINT", "SIGTERM"]);
delete process.env.SHUTDOWN_WINDOWS_CONSOLE_SIGNALS;
process.env.SHUTDOWN_RUNTIME_STOP_BUDGET_MS = "99999";
assert.equal(signals.runtimeStopBudgetFor("SIGTERM", "linux"), 2_500, "the configured budget is capped");
delete process.env.SHUTDOWN_RUNTIME_STOP_BUDGET_MS;
{
  // Default controller: every repeat is ignored, however late, as before.
  let clock = 0;
  const forced: string[] = [];
  const controller = signals.createShutdownSignalController({
    onShutdown: () => undefined,
    forceExit: (signal) => forced.push(signal),
    now: () => clock,
  });
  assert.equal(controller.handle("SIGINT"), "shutdown");
  clock += 10_000;
  assert.equal(controller.handle("SIGINT"), "duplicate", "default: a late second Ctrl+C does not force");
  assert.deepEqual(forced, []);
}
{
  // Unbounded (default) runtime stops are awaited in full.
  const result = await steps.runShutdownStepsWithin(
    [{ name: "slow", run: () => new Promise((done) => setTimeout(done, 150)) }],
    Number.POSITIVE_INFINITY,
  );
  assert.deepEqual(result.timedOut, [], "default: a slow stop is waited for");
  assert.equal(result.records[0]?.outcome, "ok");
}

// 1. Opt-in: Windows console events map to SIGINT, SIGBREAK and SIGHUP (window close).
assert.deepEqual(signals.shutdownSignalsFor("win32", true).sort(), ["SIGBREAK", "SIGHUP", "SIGINT", "SIGTERM"]);
assert.deepEqual(signals.shutdownSignalsFor("linux", true).sort(), ["SIGHUP", "SIGINT", "SIGTERM"]);
assert.deepEqual(signals.shutdownDeadlinesFor("SIGHUP", "win32"), signals.WINDOWS_CONSOLE_CLOSE_DEADLINES);
assert.deepEqual(signals.shutdownDeadlinesFor("SIGHUP", "linux"), {});
assert.deepEqual(signals.shutdownDeadlinesFor("SIGINT", "win32"), {});
assert.ok(
  signals.WINDOWS_CONSOLE_CLOSE_DEADLINES.forceExitDeadlineMs < 5_000,
  "console close must finish inside the Windows termination window",
);
// With a budget configured (the maximum the setting allows), every stop path
// leaves the store close its reserve after the connection cut and the runtime
// stop budget, before the forced exit.
for (const [signal, platform] of [
  ["SIGHUP", "win32"],
  ["SIGINT", "win32"],
  ["SIGTERM", "linux"],
  ["SIGHUP", "linux"],
] as const) {
  const limits = signals.shutdownDeadlinesFor(signal, platform);
  const connection = limits.connectionDeadlineMs ?? deadline.SHUTDOWN_CONNECTION_DEADLINE_MS;
  const forceExit = limits.forceExitDeadlineMs ?? deadline.SHUTDOWN_FORCE_EXIT_DEADLINE_MS;
  const budget = signals.runtimeStopBudgetFor(signal, platform, 2_500);
  assert.ok(
    connection + budget + steps.STORE_CLOSE_RESERVE_MS <= forceExit,
    `${signal} on ${platform}: ${connection} + ${budget} + ${steps.STORE_CLOSE_RESERVE_MS} ms must fit in ${forceExit} ms`,
  );
}
assert.ok(signals.runtimeStopBudgetFor("SIGHUP", "win32", 2_000) < 2_000, "console close is tighter");
assert.equal(signals.runtimeStopBudgetFor("SIGINT", "win32", 2_000), 2_000);
// index.ts applies the per-signal budget before closing.
assert.match(
  readFileSync(join(root, "packages/server/src/index.ts"), "utf8"),
  /setRuntimeStopBudgetMs\(runtimeStopBudgetFor\(signal\)\);[^]*?await app\.close\(\);/u,
);
// The early flush is opt-in, and a failure is not logged a second time (the
// store already logged it at error level and the store close retries it).
assert.match(
  readFileSync(join(root, "packages/server/src/index.ts"), "utf8"),
  /if \(isShutdownEarlyFlushEnabled\(\)\) \{(?:\s*\/\/[^\n]*\n)*\s*void flushDB\(\)\.catch\(\(\) => \{\}\);/u,
);

// 2. Opt-in signal controller: duplicates ignored, deliberate repeat forces exit once.
{
  let clock = 1_000;
  const started: string[] = [];
  const forced: string[] = [];
  const controller = signals.createShutdownSignalController({
    forceExitOnRepeat: true,
    onShutdown: (signal) => started.push(signal),
    forceExit: (signal) => forced.push(signal),
    now: () => clock,
    repeatGraceMs: 1_500,
  });
  assert.equal(controller.shuttingDown, false);
  assert.equal(controller.handle("SIGINT"), "shutdown");
  assert.equal(controller.shuttingDown, true);
  clock += 50;
  assert.equal(controller.handle("SIGINT"), "duplicate", "process-group plus launcher delivery must not force");
  clock += 1_600;
  // A terminal tab closing after Ctrl+C, or a supervisor repeating SIGTERM, must not cut the flush short.
  assert.equal(controller.handle("SIGHUP"), "duplicate", "a late SIGHUP is not a keypress");
  assert.equal(controller.handle("SIGTERM"), "duplicate", "a repeated SIGTERM is not a keypress");
  assert.deepEqual(forced, []);
  assert.equal(controller.handle("SIGINT"), "forced", "a second Ctrl+C after the grace window forces exit");
  assert.equal(controller.handle("SIGINT"), "duplicate", "force runs once");
  assert.deepEqual(started, ["SIGINT"]);
  assert.deepEqual(forced, ["SIGINT"]);
}
{
  let clock = 0;
  const forced: string[] = [];
  const controller = signals.createShutdownSignalController({
    forceExitOnRepeat: true,
    onShutdown: () => undefined,
    forceExit: (signal) => forced.push(signal),
    now: () => clock,
  });
  controller.handle("SIGHUP");
  clock += 5_000;
  assert.equal(controller.handle("SIGBREAK"), "forced", "Ctrl+Break after a console close forces exit");
  assert.deepEqual(forced, ["SIGBREAK"]);
}

// 2b. A signal while another close is already running must not start a second
// close; a deliberate keypress can still force the exit.
{
  let clock = 0;
  let crashClosing = true;
  const started: string[] = [];
  const forced: string[] = [];
  const controller = signals.createShutdownSignalController({
    forceExitOnRepeat: true,
    alreadyStopping: () => crashClosing,
    onShutdown: (signal) => started.push(signal),
    forceExit: (signal) => forced.push(signal),
    now: () => clock,
  });
  assert.equal(controller.handle("SIGTERM"), "duplicate", "a signal during a crash close is a duplicate");
  assert.equal(controller.handle("SIGHUP"), "duplicate");
  assert.deepEqual(started, [], "no second (exit 0) close during a crash close");
  clock += 5_000;
  assert.equal(controller.handle("SIGINT"), "forced", "a deliberate Ctrl+C can still force the (nonzero) exit");
  assert.deepEqual(forced, ["SIGINT"]);
  crashClosing = false;
}
{
  const source = readFileSync(join(root, "packages/server/src/index.ts"), "utf8");
  // shutdown() itself refuses to run while any close is in progress ...
  assert.match(
    source,
    /const shutdown = async \(signal: NodeJS\.Signals\) => \{(?:\s*\/\/[^\n]*\n)*\s*if \(isShuttingDown\) \{[^}]*return;\s*\}\s*isShuttingDown = true;/u,
    "shutdown() must keep its isShuttingDown guard",
  );
  // ... so the controller needs no alreadyStopping hook in index.ts: only the
  // controller calls shutdown(), and its own first-signal state covers repeats.
  assert.doesNotMatch(source, /alreadyStopping:/u);
}

// 3. Installed listeners route real process signal events through the controller.
{
  const seen: string[] = [];
  const before = process.listenerCount("SIGBREAK");
  process.env.SHUTDOWN_WINDOWS_CONSOLE_SIGNALS = "true";
  const uninstall = signals.installShutdownSignalHandlers(
    { handle: (signal) => (seen.push(signal), "shutdown"), shuttingDown: false },
    "win32",
  );
  delete process.env.SHUTDOWN_WINDOWS_CONSOLE_SIGNALS;
  assert.equal(process.listenerCount("SIGBREAK"), before + 1);
  process.emit("SIGBREAK" as NodeJS.Signals);
  process.emit("SIGHUP" as NodeJS.Signals);
  uninstall();
  assert.equal(process.listenerCount("SIGBREAK"), before);
  assert.deepEqual(seen, ["SIGBREAK", "SIGHUP"]);
}

// 4. Bounded runtime stops: hung and failing steps are reported, not awaited forever.
{
  const started = Date.now();
  const result = await steps.runShutdownStepsWithin(
    [
      { name: "ok", run: async () => undefined },
      { name: "hung", run: () => new Promise(() => undefined) },
      {
        name: "boom",
        run: async () => {
          throw new Error("stop failed");
        },
      },
    ],
    200,
  );
  assert.ok(Date.now() - started < 1_500, "budget must bound the stop phase");
  assert.deepEqual(result.timedOut, ["hung"]);
  assert.deepEqual(
    result.failed.map((entry) => entry.name),
    ["boom"],
  );
  assert.deepEqual(
    result.records.map((record) => [record.stage, record.outcome, record.reason]),
    [
      ["ok", "ok", undefined],
      ["hung", "failed", "timeout"],
      ["boom", "failed", undefined],
    ],
    "one record per step, in order",
  );
  const hung = result.records.find((record) => record.stage === "hung");
  assert.equal(hung?.timeoutMs, 200, "a timed-out record carries timeoutMs");
  assert.equal("budgetMs" in (hung ?? {}), false);
}

// 4b. A timed-out stop that rejects later is caught by the step wrapper: it
// must not surface as an unhandledRejection (which the fatal handler would turn
// into exit 1, replacing an admin restart's exit code), and its error is still logged.
{
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  const late: Array<[string, string]> = [];
  process.on("unhandledRejection", onUnhandled);
  try {
    const result = await steps.runShutdownStepsWithin(
      [
        {
          name: "late-fail",
          run: () => new Promise((_, reject) => setTimeout(() => reject(new Error("late stop failure")), 150)),
        },
      ],
      50,
      { onLateFailure: (name, reason) => late.push([name, (reason as Error).message]) },
    );
    assert.deepEqual(result.timedOut, ["late-fail"]);
    assert.deepEqual(result.failed, [], "the late failure is not reported as an in-budget failure");
    await new Promise((done) => setTimeout(done, 300));
    assert.deepEqual(unhandled, [], "a late stop failure is not an unhandled rejection");
    assert.deepEqual(late, [["late-fail", "late stop failure"]], "the late stop failure is logged, not lost");
    // The default reporter (a logger.warn line) must not throw either.
    await steps.runShutdownStepsWithin(
      [
        {
          name: "late-fail-default",
          run: () => new Promise((_, reject) => setTimeout(() => reject(new Error("x")), 60)),
        },
      ],
      20,
    );
    await new Promise((done) => setTimeout(done, 120));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
}

// 4c. Every managed child process is a named, budgeted shutdown step, not only the main
// sidecar: the decision and utility sidecars are separate processes with their own stops.
{
  const appSource = readFileSync(new URL("../../packages/server/src/app.ts", import.meta.url), "utf8");
  for (const [name, stop] of [
    ["sidecar", "sidecarProcessService.stop()"],
    ["decisionSidecar", "decisionProcessService.stop()"],
    ["utilitySidecar", "utilitySidecarService.stop()"],
  ]) {
    assert.ok(
      appSource.includes(`{ name: "${name}", run: () => ${stop} }`),
      `app.ts stops ${name} as a named shutdown step`,
    );
  }
}

// 5. Behavioural: a real app whose runtime stop hangs still runs closeDB on close.
try {
  const { buildApp } = await import("../../packages/server/src/app.js");
  const { getDB, getFileStoreStats } = await import("../../packages/server/src/db/connection.js");
  const { STORAGE_WRITER_LEASE_FILENAME } = await import("../../packages/server/src/db/file-backed-store.js");
  const { appSettings } = await import("../../packages/server/src/db/schema/index.js");
  const { capabilityModuleRuntime } =
    await import("../../packages/server/src/services/capability-packages/capability-module-runtime.service.js");

  const app = await buildApp();
  await app.ready();
  const db = await getDB();
  await db
    .insert(appSettings)
    .values({ key: "shutdown-safety-probe", value: "saved", updatedAt: new Date().toISOString() });
  const lease = join(dataDir, "storage", STORAGE_WRITER_LEASE_FILENAME);
  assert.ok(existsSync(lease), "the running store holds the writer lease");
  assert.notEqual(getFileStoreStats(), null);
  // Simulate a capability package runtime whose cleanup never returns.
  capabilityModuleRuntime.stop = () => new Promise<void>(() => undefined);

  // The per-signal budget (index.ts sets it before close) is what onClose honours.
  const budgetMs = 600;
  steps.setRuntimeStopBudgetMs(budgetMs);
  const started = Date.now();
  try {
    await app.close();
  } finally {
    steps.setRuntimeStopBudgetMs();
  }
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= budgetMs - 50, `close waited out the runtime stop budget (took ${elapsed} ms)`);
  assert.ok(elapsed < budgetMs + 3_000, `close must not wait on a hung worker stop (took ${elapsed} ms)`);
  // Only closeDB() does these: the store controller is dropped and the writer lease released.
  assert.equal(getFileStoreStats(), null, "closeDB ran after the timed-out stop");
  assert.equal(existsSync(lease), false, "the writer lease was released by the store close");
  const rows = await readStoredSetting(join(dataDir, "storage"));
  assert.equal(rows, "saved", "the pending save is on disk");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

async function readStoredSetting(storageDir: string): Promise<string | undefined> {
  const { encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.js");
  const shard = join(storageDir, "tables", "app_settings", `${encodeShardKey("shutdown-safety-probe")}.json`);
  if (!existsSync(shard)) return undefined;
  const rows = JSON.parse(readFileSync(shard, "utf8")) as Array<{ key: string; value: string }>;
  return rows.find((row) => row.key === "shutdown-safety-probe")?.value;
}

console.log("Shutdown safety regression passed.");
process.exit(0);
