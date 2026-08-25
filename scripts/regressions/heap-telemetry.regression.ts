import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HEAP_PRESSURE_RECOVERY_PERCENT,
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
assert.equal(
  snapshot.heapUsedPercent,
  Math.min(100, Math.round((snapshot.heapUsedMB / snapshot.heapLimitMB) * 100)),
  "the percentage must be used/limit, not merely something in range",
);
assert.ok(snapshot.rssMB >= snapshot.heapUsedMB, "RSS includes the JS heap and must not be smaller than it");

// ── evaluateHeapPressure state machine ──
// The anti-spam contract that keeps the Termux session log readable (#5506):
// warn on crossing, remind at most every reminder interval, hysteresis between
// the warn (85) and recovery (80) thresholds, and a global rate limit so NO
// oscillation pattern can emit more than one pressure line and one recovery
// line per reminder interval.
assert.ok(
  HEAP_PRESSURE_RECOVERY_PERCENT < HEAP_PRESSURE_THRESHOLD_PERCENT,
  "recovery must sit strictly below the warn threshold (hysteresis)",
);
const state: HeapPressureState = { underPressure: false, announced: false, lastWarnedAt: 0 };
const t0 = 1_000_000;
const REMIND = HEAP_PRESSURE_REMINDER_INTERVAL_MS;
const above = HEAP_PRESSURE_THRESHOLD_PERCENT;
const band = HEAP_PRESSURE_THRESHOLD_PERCENT - 1; // inside the hysteresis band
const below = HEAP_PRESSURE_RECOVERY_PERCENT - 1; // true recovery

assert.equal(evaluateHeapPressure(state, band, t0), "none", "the band is silent before any pressure");
assert.equal(evaluateHeapPressure(state, above, t0), "warn", "crossing the threshold must warn once");
assert.equal(evaluateHeapPressure(state, above, t0 + 1_000), "none", "staying under pressure must not spam");
assert.equal(
  evaluateHeapPressure(state, band, t0 + 2_000),
  "none",
  "dipping into the hysteresis band is neither recovery nor a new episode",
);
assert.equal(
  evaluateHeapPressure(state, above, t0 + REMIND - 1),
  "none",
  "no reminder before the reminder interval elapses",
);
assert.equal(evaluateHeapPressure(state, above, t0 + REMIND), "remind", "a reminder fires once the interval elapses");
assert.equal(evaluateHeapPressure(state, above, t0 + REMIND + 1_000), "none", "the reminder resets its own clock");
assert.equal(
  evaluateHeapPressure(state, below, t0 + REMIND + 2_000),
  "recovered",
  "dropping below the recovery threshold must log recovery once",
);
assert.equal(evaluateHeapPressure(state, below, t0 + REMIND + 3_000), "none", "recovery is logged only once");

// Threshold flap (85/84/85/84…): the dip stays inside the band, so the flap
// produces no lines at all between reminders.
const flapNearThreshold: HeapPressureState = { underPressure: false, announced: false, lastWarnedAt: 0 };
const flapNearLines: string[] = [];
for (let minute = 0; minute < 30; minute += 1) {
  const percent = minute % 2 === 0 ? above : band;
  const action = evaluateHeapPressure(flapNearThreshold, percent, t0 + minute * 60_000);
  if (action !== "none") flapNearLines.push(action);
}
assert.deepEqual(
  flapNearLines,
  ["warn", "remind", "remind"],
  "a saw-tooth across the warn threshold must log only the warn plus spaced reminders",
);

// Wide flap (86/79/86/79…): crossing the FULL hysteresis span still cannot
// exceed one pressure line + one recovery line per reminder interval, and no
// unmatched recovery line is ever emitted for a silent episode.
const flapWide: HeapPressureState = { underPressure: false, announced: false, lastWarnedAt: 0 };
const windowCounts = new Map<number, { pressure: number; recovered: number }>();
let lastWideAction: string = "none";
for (let minute = 0; minute < 90; minute += 1) {
  const percent = minute % 2 === 0 ? above + 1 : below;
  const action = evaluateHeapPressure(flapWide, percent, t0 + minute * 60_000);
  const window = Math.floor((minute * 60_000) / REMIND);
  const counts = windowCounts.get(window) ?? { pressure: 0, recovered: 0 };
  if (action === "warn" || action === "remind") counts.pressure += 1;
  if (action === "recovered") {
    assert.notEqual(lastWideAction, "none", "recovery must only follow an announced pressure line");
    counts.recovered += 1;
  }
  if (action !== "none") lastWideAction = action;
  windowCounts.set(window, counts);
}
for (const [window, counts] of windowCounts) {
  assert.ok(counts.pressure <= 1, `window ${window}: at most one pressure line under wide oscillation`);
  assert.ok(counts.recovered <= 1, `window ${window}: at most one recovery line under wide oscillation`);
}

// A genuinely new episode after quiet recovery warns loudly again once the
// rate-limit window has passed.
const fresh: HeapPressureState = { underPressure: false, announced: false, lastWarnedAt: 0 };
assert.equal(evaluateHeapPressure(fresh, above, t0), "warn");
assert.equal(evaluateHeapPressure(fresh, below, t0 + 60_000), "recovered");
assert.equal(
  evaluateHeapPressure(fresh, above, t0 + REMIND + 60_000),
  "warn",
  "a new episode outside the rate-limit window must warn again",
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
const monitorSource = readFileSync(
  join(repositoryRoot, "packages/server/src/services/heap-monitor.ts"),
  "utf8",
).replace(/\r\n/gu, "\n");
assert.match(
  monitorSource,
  /if \(action === "warn" \|\| action === "remind"\) \{\s*logPressure\(snapshot\);/u,
  "warn and remind actions must both emit the pressure log line",
);
assert.match(
  monitorSource,
  /try \{[\s\S]{0,700}evaluateHeapPressure\(state, snapshot\.heapUsedPercent, performance\.now\(\)\)/u,
  "the tick must run inside try/catch and use a monotonic clock",
);

console.log("Heap telemetry regression checks passed.");
