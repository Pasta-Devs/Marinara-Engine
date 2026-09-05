// #5838: bounded graceful shutdown. Field case: SteamOS earlyoom sent SIGTERM
// and app.close() took 39 s waiting on a phone's open SSE connection - past
// earlyoom's ~10 s window (and Docker's), an orderly stop becomes a SIGKILL
// that drops the store's debounced writes. The deadline severs connections at
// 4 s so close can reach the flush, and force-exits at 8 s if close is stuck
// in the flush itself. Both behaviors are observed functionally in child
// processes - a lane cannot host a process.exit in-process.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const serverRequire = createRequire(join(repositoryRoot, "packages/server/package.json"));
const tsxCli = serverRequire.resolve("tsx/cli");
const helperUrl = pathToFileURL(join(repositoryRoot, "packages/server/src/lib/shutdown-deadline.ts")).href;

function runChild(body: string, timeoutMs: number) {
  const dir = mkdtempSync(join(tmpdir(), "shutdown-deadline-"));
  const script = join(dir, "child.ts");
  writeFileSync(script, body);
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [tsxCli, script], {
    cwd: repositoryRoot,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
    // The children assert on logger.warn output, so their log level must not
    // inherit the invoking user's LOG_LEVEL (a documented knob) or the repo
    // .env - dotenv never overrides pre-set variables, so these win. And
    // NODE_ENV=production selects pino's synchronous stdout path instead of
    // the pino-pretty worker thread, which can drop lines emitted right
    // before process.exit().
    env: { ...process.env, LOG_LEVEL: "warn", NODE_ENV: "production" },
  });
  rmSync(dir, { recursive: true, force: true });
  return { ...result, elapsedMs: Date.now() - startedAt };
}

// Budget arithmetic: the lane runner gives this whole file 30 s. Each child
// carries an 8 s in-child hang sentinel (exit 7) inside a 9 s spawnSync
// timeout, so even three worst-case children (27 s) report their own
// assertion messages before the runner would kill the lane tree bare.

// ── Stage 2: a close stuck past the force deadline exits 0 on its own ───────
{
  const child = runChild(
    `import { armShutdownDeadline } from ${JSON.stringify(helperUrl)};
setInterval(() => {}, 1_000); // a hung close keeps the event loop alive
armShutdownDeadline({ server: { closeAllConnections() {} } }, "lane stage2", {
  connectionDeadlineMs: 100,
  forceExitDeadlineMs: 400,
});
// If the deadline never fires, this converts the hang into a distinct code.
setTimeout(() => process.exit(7), 8_000);
`,
    9_000,
  );
  assert.equal(child.status, 0, `stage-2 force exit must exit 0 (got ${child.status}; stderr: ${child.stderr})`);
  assert.ok(child.elapsedMs < 7_500, `force exit must beat the 8 s hang sentinel (took ${child.elapsedMs} ms)`);
  assert.match(child.stdout, /forcing exit now/u, "the force exit is announced in the log");
}

// ── Stage 1 fires first and actually severs connections ─────────────────────
{
  const child = runChild(
    `import { armShutdownDeadline } from ${JSON.stringify(helperUrl)};
setInterval(() => {}, 1_000);
armShutdownDeadline(
  // A severed-connections close "completes": exiting 3 here proves stage 1
  // ran, and ran BEFORE the distant stage-2 exit(0) could.
  { server: { closeAllConnections() { process.exit(3); } } },
  "lane stage1",
  { connectionDeadlineMs: 100, forceExitDeadlineMs: 20_000 },
);
setTimeout(() => process.exit(7), 8_000);
`,
    9_000,
  );
  assert.equal(
    child.status,
    3,
    `stage 1 must sever connections before stage 2 (got ${child.status}; stderr: ${child.stderr})`,
  );
  assert.match(child.stdout, /severing open connections/u);
}

// ── An explicit exit preempts the armed watchdogs without delay ─────────────
// The force-exit timer is deliberately ref'd (a hung close with an empty loop
// must not let Node exit "clean" before the forced stamp is written), so the
// no-delay guarantee comes from callers exiting explicitly after close - the
// contract this child proves.
{
  const child = runChild(
    `import { armShutdownDeadline } from ${JSON.stringify(helperUrl)};
armShutdownDeadline({ server: { closeAllConnections() {} } }, "lane explicit-exit", {
  connectionDeadlineMs: 60_000,
  forceExitDeadlineMs: 120_000,
});
// Mirrors every production caller: close finished, exit explicitly.
process.exit(0);
`,
    9_000,
  );
  assert.equal(child.status, 0);
  assert.ok(child.elapsedMs < 7_500, `explicit exit must preempt the ref'd watchdog (took ${child.elapsedMs} ms)`);
}

// ── Source pins: every unbounded close path stays armed ─────────────────────
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");
const indexTs = readSource("packages/server/src/index.ts");
assert.match(
  indexTs,
  /isShuttingDown = true;[^]*?armShutdownDeadline\(app, signal\);[^]*?await app\.close\(\);/u,
  "signal shutdown arms the deadline before awaiting close",
);
const updatesRoutes = readSource("packages/server/src/routes/updates.routes.ts");
assert.match(
  updatesRoutes,
  /armShutdownDeadline\(app, "update restart"\);\s*\n\s*await app\.close\(\);/u,
  "the update restart arms the deadline before awaiting close",
);
// admin.routes.ts is deliberately NOT armed with stage 2: it spawns the
// relaunch child only AFTER close, so a blind force exit would leave the
// server down; its own closeAllConnections timer remains its protection.
const adminRoutes = readSource("packages/server/src/routes/admin.routes.ts");
assert.match(adminRoutes, /closeAllConnections\(\);\s*\n\s*\}, GRACEFUL_RESTART_TIMEOUT_MS\);/u);
assert.doesNotMatch(adminRoutes, /armShutdownDeadline/u);
const helper = readSource("packages/server/src/lib/shutdown-deadline.ts");
assert.match(helper, /SHUTDOWN_CONNECTION_DEADLINE_MS = 4_000;/u);
assert.match(helper, /SHUTDOWN_FORCE_EXIT_DEADLINE_MS = 8_000;/u);
assert.match(helper, /connectionTimer\.unref\(\);/u);
// The force-exit watchdog must stay referenced: with an empty event loop an
// unref'd timer never fires, Node exits naturally, and the postmortem stamps
// "clean" for a close that may have skipped the flush.
assert.doesNotMatch(helper, /forceExitTimer\.unref\(\)/u);
// A forced exit may have truncated the flush, so it must never be stamped
// "clean": the honest kind is written before the exit, and the exit hook
// persists it.
assert.match(helper, /noteSessionExitKind\("forced"\);\s*process\.exit\(0\);/u);
const postmortem = readSource("packages/server/src/lib/session-postmortem.ts");
assert.match(postmortem, /"clean" \| "crash" \| "restart" \| "forced"/u);
const clientDiagnostics = readSource("packages/client/src/lib/support-diagnostics.ts");
assert.match(
  clientDiagnostics,
  /forced: "was stopped before its shutdown could finish/u,
  "the client renders the forced ending in plain words instead of falling back to raw text",
);

console.log("Shutdown deadline regressions passed.");
