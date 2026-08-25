import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HEAP_PRESSURE_REMINDER_INTERVAL_MS,
  HEAP_PRESSURE_THRESHOLD_PERCENT,
  captureHeapSnapshot,
  evaluateHeapPressure,
  type HeapPressureState,
} from "../../packages/server/src/services/heap-monitor.js";
import { formatServerMemory, formatSupportDiagnostics } from "../../packages/client/src/lib/support-diagnostics";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// ── captureHeapSnapshot sanity ──
const snapshot = captureHeapSnapshot();
assert.ok(snapshot.heapUsedMB > 0, "a running process must report live heap");
assert.ok(snapshot.heapLimitMB > snapshot.heapUsedMB, "the heap limit must exceed current usage in this test process");
assert.ok(
  snapshot.heapUsedPercent >= 0 && snapshot.heapUsedPercent <= 100,
  "heap percentage must be a 0-100 value",
);
assert.ok(snapshot.rssMB >= snapshot.heapUsedMB, "RSS includes the JS heap and must not be smaller than it");

// ── evaluateHeapPressure state machine ──
// Warn exactly once on crossing, stay quiet inside the reminder window, remind
// after it elapses, and log recovery exactly once on the way back down. This is
// the anti-spam contract that keeps the Termux session log readable (#5506).
const state: HeapPressureState = { underPressure: false, lastWarnedAt: 0 };
const t0 = 1_000_000;
const below = HEAP_PRESSURE_THRESHOLD_PERCENT - 1;
const above = HEAP_PRESSURE_THRESHOLD_PERCENT;

assert.equal(evaluateHeapPressure(state, below, t0), "none", "below threshold must stay silent");
assert.equal(evaluateHeapPressure(state, above, t0), "warn", "crossing the threshold must warn once");
assert.equal(evaluateHeapPressure(state, above, t0 + 1_000), "none", "staying under pressure must not spam");
assert.equal(
  evaluateHeapPressure(state, above, t0 + HEAP_PRESSURE_REMINDER_INTERVAL_MS - 1),
  "none",
  "no reminder before the reminder interval elapses",
);
assert.equal(
  evaluateHeapPressure(state, above, t0 + HEAP_PRESSURE_REMINDER_INTERVAL_MS),
  "remind",
  "a reminder fires once the interval elapses",
);
assert.equal(
  evaluateHeapPressure(state, above, t0 + HEAP_PRESSURE_REMINDER_INTERVAL_MS + 1_000),
  "none",
  "the reminder resets its own clock",
);
assert.equal(
  evaluateHeapPressure(state, below, t0 + HEAP_PRESSURE_REMINDER_INTERVAL_MS + 2_000),
  "recovered",
  "dropping below the threshold must log recovery once",
);
assert.equal(
  evaluateHeapPressure(state, below, t0 + HEAP_PRESSURE_REMINDER_INTERVAL_MS + 3_000),
  "none",
  "recovery is logged only once",
);
// A fresh crossing after recovery warns again (not remind): the episode restarts.
assert.equal(
  evaluateHeapPressure(state, above, t0 + HEAP_PRESSURE_REMINDER_INTERVAL_MS + 4_000),
  "warn",
  "a new pressure episode after recovery must warn again",
);

// ── formatServerMemory ──
assert.equal(
  formatServerMemory({ heapUsedMB: 842, heapLimitMB: 1024, heapUsedPercent: 82, rssMB: 1210 }),
  "842 MB / 1024 MB heap (82%), 1210 MB RSS",
);
assert.equal(formatServerMemory(null), null, "a missing snapshot must fall through to Unavailable");
assert.equal(formatServerMemory(undefined), null, "old servers without the field must fall through");
assert.equal(
  formatServerMemory({ heapUsedMB: Number.NaN, heapLimitMB: 1024, heapUsedPercent: 82, rssMB: 1210 }),
  null,
  "malformed numbers must not produce a NaN diagnostics line",
);

// ── the diagnostics paste carries the line ──
const diagnosticsText = formatSupportDiagnostics({
  version: "0.0.0",
  build: "0.0.0+test",
  commit: "abc",
  serverOs: "TestOS",
  serverMemory: formatServerMemory({ heapUsedMB: 900, heapLimitMB: 1024, heapUsedPercent: 88, rssMB: 1300 }),
  clientOs: "TestClient",
  browser: "TestAgent",
  gpu: "TestGPU",
  connectionName: null,
  connectionProvider: null,
  model: null,
});
assert.match(
  diagnosticsText,
  /Server memory: 900 MB \/ 1024 MB heap \(88%\), 1300 MB RSS/u,
  "Support Diagnostics must include the server memory line",
);
assert.match(
  formatSupportDiagnostics({
    version: "0.0.0",
    build: "0.0.0+test",
    commit: null,
    serverOs: "TestOS",
    serverMemory: null,
    clientOs: "TestClient",
    browser: "TestAgent",
    gpu: "TestGPU",
    connectionName: null,
    connectionProvider: null,
    model: null,
  }),
  /Server memory: Unavailable/u,
  "an old server without memory telemetry must show Unavailable, not crash",
);

// ── source pins: the wiring stays in place ──
const appSource = readFileSync(join(repositoryRoot, "packages/server/src/app.ts"), "utf8").replace(/\r\n/gu, "\n");
assert.match(
  appSource,
  /memory: captureHeapSnapshot\(\)/u,
  "/api/health must report the heap snapshot",
);
const indexSource = readFileSync(join(repositoryRoot, "packages/server/src/index.ts"), "utf8").replace(/\r\n/gu, "\n");
assert.match(indexSource, /const heapMonitor = startHeapMonitor\(\)/u, "the server must start the heap monitor");
assert.match(indexSource, /heapMonitor\.stop\(\)/u, "shutdown must stop the heap monitor");

console.log("Heap telemetry regression checks passed.");
