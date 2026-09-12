// #5506 diagnostics: the session heartbeat/postmortem. An externally killed
// Termux server leaves no in-process trace, so the NEXT startup is the
// witness: a silent file-only heartbeat plus an exit stamp lets startup
// classify the previous session's fate and surface it in Support
// Diagnostics. HARD CONSTRAINTS (maintainer calls + adversarial review):
//   1. console-silent at runtime - users read the console for other things;
//   2. never claim a shutdown nobody observed ("unknown" is a real answer);
//   3. an ending the server logged itself (crash, update/settings restart) is
//      never reported as an external kill.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");
const flatten = (source: string) => source.replace(/\s+/gu, " ");

// ── Functional: real module against a temp DATA_DIR ─────────────────────────
const dataDir = mkdtempSync(join(tmpdir(), "marinara-postmortem-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;
try {
  const {
    classifyPreviousSession,
    finalizeSessionExit,
    getPreviousSessionStatus,
    getUncleanExitHistory,
    noteSessionExitKind,
    processIsAlive,
    readUncleanExitHistory,
    startSessionPostmortem,
  } = await import("../../packages/server/src/lib/session-postmortem.js");

  // The history file is parsed from disk: anything that is not an array of
  // plausible records reads as empty rather than throwing on spread.
  assert.deepEqual(readUncleanExitHistory({ not: "an array" }), []);
  assert.deepEqual(readUncleanExitHistory(null), []);
  assert.deepEqual(readUncleanExitHistory("[]"), []);
  assert.deepEqual(readUncleanExitHistory([{ junk: true }, 7]), []);
  assert.equal(readUncleanExitHistory([{ lastSeenAt: "2026-09-01T00:00:00.000Z", pid: 5 }]).length, 1);

  const deadPid = () => false;
  const livePid = () => true;
  const previousBeat = {
    pid: 4242,
    bootId: "boot-a",
    startedAt: "2026-09-01T10:00:00.000Z",
    lastBeatAt: "2026-09-01T13:30:00.000Z",
    rssMiB: 119.3,
    heapUsedMiB: 83.4,
  };

  // An unstamped beat whose owner is gone is the kill signal: uptime math,
  // memory at death, and boot-id reboot detection all ride the record.
  const killed = classifyPreviousSession(previousBeat, "boot-b", "2026-09-02T08:00:00.000Z", deadPid);
  assert.equal(killed.status, "unclean");
  assert.equal(killed.status === "unclean" && killed.record.rebootedSince, true);
  assert.equal(killed.status === "unclean" && killed.record.uptimeMs, 3.5 * 60 * 60 * 1000);
  assert.equal(killed.status === "unclean" && killed.record.rssMiB, 119.3);
  const sameBoot = classifyPreviousSession(previousBeat, "boot-a", "now", deadPid);
  assert.equal(sameBoot.status === "unclean" && sameBoot.record.rebootedSince, false);
  const unknownBoot = classifyPreviousSession({ ...previousBeat, bootId: null }, "boot-a", "now", deadPid);
  assert.equal(unknownBoot.status === "unclean" && unknownBoot.record.rebootedSince, null);

  // NEVER CLAIM AN UNOBSERVED SHUTDOWN: a missing or unreadable record, and a
  // record whose owner is still running (a restart's detached child racing
  // its parent, or two servers sharing one DATA_DIR), are "unknown".
  assert.equal(classifyPreviousSession(null, "boot-a", "now", deadPid).status, "unknown");
  assert.equal(classifyPreviousSession(previousBeat, "boot-a", "now", livePid).status, "unknown");
  // The record is parsed from disk, so its shape is a claim: truncated,
  // hand-edited, or type-confused records degrade to "unknown" rather than
  // fabricating an ending or a death.
  for (const malformed of [
    { pid: 1 },
    { ...previousBeat, pid: "4242" },
    { ...previousBeat, pid: 0 },
    { ...previousBeat, startedAt: "not-a-date" },
    { ...previousBeat, lastBeatAt: undefined },
    { ...previousBeat, rssMiB: "119" },
    { ...previousBeat, bootId: 7 },
    { ...previousBeat, exitKind: "banana" },
    "a string",
    42,
  ]) {
    const status = classifyPreviousSession(malformed, "boot-a", "now", deadPid);
    assert.equal(status.status, "unknown", `malformed record must be unknown: ${JSON.stringify(malformed)}`);
  }

  // OBSERVED ENDINGS ARE NAMED, NEVER CALLED KILLS: clean shutdown, an
  // app-level crash (the server logged it), and the update / settings restart
  // paths each report themselves.
  for (const exitKind of ["clean", "crash", "restart", "forced"] as const) {
    const ended = classifyPreviousSession({ ...previousBeat, exitKind }, "boot-b", "now", deadPid);
    assert.equal(ended.status, "ended");
    assert.equal(ended.status === "ended" && ended.exitKind, exitKind);
  }

  // Round trip through the real filesystem, which uses the REAL liveness
  // probe: a literal pid could belong to an unrelated live process and
  // classify as "unknown", so spawn a child, wait for it to exit, and use its
  // (now dead) pid. The liveness assertion doubles as a probe test.
  const deadChild = spawnSync(process.execPath, ["-e", ""]);
  const deadChildPid = deadChild.pid;
  assert.ok(deadChildPid, "the probe child must report a pid");
  assert.equal(processIsAlive(deadChildPid), false, "the probe child must have exited before this check");
  mkdirSync(join(dataDir, "diagnostics"), { recursive: true });
  writeFileSync(
    join(dataDir, "diagnostics", "session-heartbeat.json"),
    JSON.stringify({ ...previousBeat, pid: deadChildPid }),
  );
  // A history file that is valid JSON but the wrong shape must not disable
  // tracking: spreading a non-array would throw and skip the heartbeat setup.
  writeFileSync(join(dataDir, "diagnostics", "unclean-exits.json"), JSON.stringify({ not: "an array" }));
  const status = startSessionPostmortem();
  assert.equal(status.status, "unclean");
  assert.equal(getPreviousSessionStatus().status, "unclean");
  assert.equal(getUncleanExitHistory().length, 1);
  assert.equal(JSON.parse(readFileSync(join(dataDir, "diagnostics", "unclean-exits.json"), "utf8")).length, 1);

  // The live beat replaced the old file and carries no ending yet.
  const liveBeat = JSON.parse(readFileSync(join(dataDir, "diagnostics", "session-heartbeat.json"), "utf8"));
  assert.equal(liveBeat.pid, process.pid);
  assert.equal(liveBeat.exitKind, undefined);

  // OWNERSHIP HANDOFF: a restart's detached child claims the heartbeat while
  // the parent is still exiting. The parent must NOT stamp its ending over
  // the successor's live beat - doing so would make the next startup read the
  // successor's session as an ended restart and miss a later kill of it.
  const successorBeat = { ...previousBeat, pid: process.pid + 1, exitKind: undefined };
  writeFileSync(join(dataDir, "diagnostics", "session-heartbeat.json"), JSON.stringify(successorBeat));
  finalizeSessionExit(0);
  const afterHandoff = JSON.parse(readFileSync(join(dataDir, "diagnostics", "session-heartbeat.json"), "utf8"));
  assert.equal(afterHandoff.pid, successorBeat.pid, "the exiting parent must not clobber the successor's beat");
  assert.equal(afterHandoff.exitKind, undefined, "the successor's session must still read as live");

  // The exit stamp names the ending when we DO still own the record; an
  // unflagged non-zero exit is treated as a crash rather than called clean.
  const stampRun = startSessionPostmortem();
  assert.ok(stampRun);
  noteSessionExitKind("restart");
  finalizeSessionExit(0);
  const stamped = JSON.parse(readFileSync(join(dataDir, "diagnostics", "session-heartbeat.json"), "utf8"));
  assert.equal(stamped.pid, process.pid);
  assert.equal(stamped.exitKind, "restart");
  assert.equal(classifyPreviousSession(stamped, "boot-x", "now", deadPid).status, "ended");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}

// ── Source pins ─────────────────────────────────────────────────────────────
const postmortemSource = readSource("packages/server/src/lib/session-postmortem.ts");
const postmortemFlat = flatten(postmortemSource);
// Console-silent at runtime: the ONLY console call in the whole module is the
// single startup warn plus the unavailable-warn, both inside
// startSessionPostmortem - the heartbeat and the exit stamp print nothing.
const intervalBody = postmortemFlat.match(/heartbeatTimer = setInterval\(\(\) => \{(.*?)\}, HEARTBEAT_INTERVAL_MS\);/u);
assert.ok(intervalBody, "the heartbeat interval must exist");
for (const forbidden of [/logger\./u, /console\./u, /process\.stdout/u]) {
  assert.doesNotMatch(intervalBody![1]!, forbidden, "the heartbeat must stay silent at runtime");
}
// Matched against the UNFLATTENED source: flatten() strips the newlines this
// body pattern needs, which silently made this assertion dead code.
const finalizeBody = postmortemSource.match(
  /export function finalizeSessionExit\(exitCode: number\) \{([\s\S]*?)^\}/mu,
);
assert.ok(finalizeBody, "finalizeSessionExit must exist");
assert.doesNotMatch(finalizeBody[1]!, /logger\.|console\.|process\.stdout/u, "the exit stamp must stay silent");
assert.equal(
  (postmortemSource.match(/\blogger\.(?:trace|debug|info|warn|error|fatal)\(/gu) ?? []).length,
  2,
  "exactly two console surfaces: the startup postmortem line and the unavailable warning",
);
// The heartbeat never keeps the process alive, and beats are written
// atomically so a mid-write kill cannot corrupt the previous beat.
assert.match(postmortemFlat, /heartbeatTimer\.unref\(\);/u);
assert.match(postmortemFlat, /writeFileSync\(tmp, JSON\.stringify\(value\)\); renameSync\(tmp, path\);/u);
// "unknown" is never collapsed into a clean shutdown.
assert.match(postmortemFlat, /return \{ status: "unknown", reason: "no readable record of a previous session" \};/u);
assert.match(postmortemFlat, /return \{ status: "unknown", reason: "another server instance is using this data/u);

// The stamp rides process exit, so every deliberate ending is covered without
// each exit path remembering; the crash handlers name themselves.
const indexSource = flatten(readSource("packages/server/src/index.ts"));
assert.match(indexSource, /process\.once\("exit", \(code\) => \{ finalizeSessionExit\(code\); \}\);/u);
assert.equal(
  (indexSource.match(/noteSessionExitKind\("crash"\)/gu) ?? []).length,
  2,
  "both fatal handlers (uncaughtException, unhandledRejection) must name the crash",
);
assert.match(indexSource, /startFreezeDetector\(\); startSessionPostmortem\(\);/u);

// The two deliberate restart paths name themselves, so an in-app update or a
// settings restart is never reported as an Android kill. The stamp must land
// BEFORE close begins - #5838's shutdown deadline can force-exit a stuck
// close, and a stamp written after it would never be written at all.
assert.match(
  flatten(readSource("packages/server/src/routes/updates.routes.ts")),
  /noteSessionExitKind\("restart"\);.*?armShutdownDeadline\(app, "update restart"\); await app\.close\(\);/u,
  "updates route: stamp, then deadline, then close",
);
assert.match(
  flatten(readSource("packages/server/src/routes/admin.routes.ts")),
  /noteSessionExitKind\("restart"\); await app\.close\(\);/u,
  "admin route: stamp directly before close (no stage-2 deadline - it spawns the relaunch child after close)",
);

const appSource = flatten(readSource("packages/server/src/app.ts"));
assert.match(
  appSource,
  /previousSession: getPreviousSessionStatus\(\), uncleanExitCount: getUncleanExitHistory\(\)\.length,/u,
);

const clientFormat = flatten(readSource("packages/client/src/lib/support-diagnostics.ts"));
// The report never renders an unknown fate as a clean shutdown, and the
// unclean-exit COUNT is reported even when the last session ended normally.
assert.match(clientFormat, /if \(previous === undefined\) return "Unavailable";/u);
assert.match(clientFormat, /if \(previous\.status === "unknown"\) return `unknown - \$\{previous\.reason\}`;/u);
assert.match(clientFormat, /Sessions ended without shutdown: /u);
assert.doesNotMatch(clientFormat, /: "shut down cleanly" \}/u);

console.log("Termux postmortem regression passed.");
