// #4707: the .env hot-reload watcher must not stat-poll every 2s — it now
// uses an event-driven directory watch (30s stat-poll only as a fallback) and
// honors MARINARA_ENV_WATCH=0. These regressions drive the REAL watcher
// against a temp env file and pin:
//   - event-driven latency (a change lands in well under the old 2s poll,
//     proving the fs.watch path is active rather than the fallback),
//   - atomic-replace survival (rename-over-the-file, which detaches naive
//     file-level watchers — the reason the watch targets the parent dir),
//   - the disappeared-file cleanup path,
//   - stop() actually stopping,
//   - the MARINARA_ENV_WATCH opt-out with reloadNow() still working.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROBE_KEY = "MARINARA_ENV_WATCHER_REGRESSION_PROBE";
const tempDir = mkdtempSync(join(tmpdir(), "marinara-env-watcher-"));
const envPath = join(tempDir, ".env");
const originalEnvFile = process.env.MARINARA_ENV_FILE;
const originalEnvWatch = process.env.MARINARA_ENV_WATCH;
process.env.MARINARA_ENV_FILE = envPath;
delete process.env.MARINARA_ENV_WATCH;
delete process.env[PROBE_KEY];

function restoreEnv(key: string, original: string | undefined) {
  if (original === undefined) delete process.env[key];
  else process.env[key] = original;
}

const { ENV_WATCH_DEBOUNCE_MS, ENV_WATCH_FALLBACK_POLL_MS, isEnvWatchDisabled, resolveEnvWatchMode, startEnvWatcher } =
  await import("../../../packages/server/src/config/env-watcher.js");

// Importing env-watcher pulls in runtime-config, whose import-time load
// AUTO-CREATES the env file (ensureEnvFileExists writes a header). Remove it
// so the missing-file branch below genuinely runs — without this, the
// "created .env" case would silently degrade into an in-place overwrite.
if (existsSync(envPath)) unlinkSync(envPath);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<number> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return Date.now() - startedAt;
    await sleep(50);
  }
  return -1;
}

try {
  // ── Opt-out parsing ──
  assert.equal(isEnvWatchDisabled(undefined), false, "unset keeps the watcher on");
  assert.equal(isEnvWatchDisabled("1"), false, "1 keeps the watcher on");
  assert.equal(isEnvWatchDisabled("yes"), false, "unrecognized values keep the watcher on");
  assert.equal(isEnvWatchDisabled("0"), true, "0 disables");
  assert.equal(isEnvWatchDisabled("false"), true, "false disables");
  assert.equal(isEnvWatchDisabled(" OFF "), true, "off disables (trimmed, case-insensitive)");
  assert.equal(isEnvWatchDisabled("no"), true, "no disables");
  assert.equal(resolveEnvWatchMode(undefined), "watch", "default mode is event-driven watching");
  assert.equal(resolveEnvWatchMode("1"), "watch", "explicit on is event-driven watching");
  assert.equal(resolveEnvWatchMode(" POLL "), "poll", "poll forces the stat-poll path (trimmed, case-insensitive)");
  assert.equal(resolveEnvWatchMode("0"), "off", "0 resolves to off");

  // ── #4707 contract: the fallback poll is human-timescale, not 2s ──
  assert.ok(
    ENV_WATCH_FALLBACK_POLL_MS >= 30_000,
    "the stat-poll fallback must not reintroduce a high-frequency idle timer",
  );

  // ── Live cycle on the real watcher (env file does not exist yet) ──
  const watcher = startEnvWatcher();
  try {
    await sleep(ENV_WATCH_DEBOUNCE_MS);

    assert.equal(existsSync(envPath), false, "precondition: the env file must NOT exist before the creation test");
    writeFileSync(envPath, `${PROBE_KEY}=alpha\n`);
    const createLatency = await waitFor(() => process.env[PROBE_KEY] === "alpha", 10_000);
    assert.notEqual(createLatency, -1, "a created .env is picked up");
    // Event-driven means debounce + slack. The ceiling scales with the
    // debounce constant, carries CI headroom, and sits far below both the
    // waitFor budget above and the 30s fallback poll — so it can actually
    // fire, and a pass still proves events (not polling) drove the pickup.
    const eventLatencyCeilingMs = Math.max(2_000, ENV_WATCH_DEBOUNCE_MS * 20);
    assert.ok(
      createLatency < eventLatencyCeilingMs,
      `pickup latency ${createLatency}ms is not event-driven (ceiling ${eventLatencyCeilingMs}ms; fallback is ${ENV_WATCH_FALLBACK_POLL_MS}ms)`,
    );

    writeFileSync(envPath, `${PROBE_KEY}=beta\n`);
    assert.notEqual(
      await waitFor(() => process.env[PROBE_KEY] === "beta", 10_000),
      -1,
      "an in-place edit is picked up",
    );

    // Atomic replace: editors write a new inode and rename it over the file.
    // A file-level watcher detaches here; the directory watch must survive.
    const stagedPath = join(tempDir, ".env.tmp-swap");
    writeFileSync(stagedPath, `${PROBE_KEY}=gamma\n`);
    renameSync(stagedPath, envPath);
    assert.notEqual(
      await waitFor(() => process.env[PROBE_KEY] === "gamma", 10_000),
      -1,
      "an atomic replace (rename over the env file) is picked up",
    );

    unlinkSync(envPath);
    assert.notEqual(
      await waitFor(() => process.env[PROBE_KEY] === undefined, 10_000),
      -1,
      "deleting the .env clears the keys it had loaded",
    );

    watcher.stop();
    writeFileSync(envPath, `${PROBE_KEY}=after-stop\n`);
    await sleep(ENV_WATCH_DEBOUNCE_MS * 4);
    assert.equal(process.env[PROBE_KEY], undefined, "a stopped watcher no longer applies changes");
    unlinkSync(envPath);
  } finally {
    watcher.stop();
  }

  // ── Disabled mode: no watching, but manual reload still works ──
  process.env.MARINARA_ENV_WATCH = "0";
  const disabled = startEnvWatcher();
  try {
    writeFileSync(envPath, `${PROBE_KEY}=epsilon\n`);
    await sleep(ENV_WATCH_DEBOUNCE_MS * 4);
    assert.equal(process.env[PROBE_KEY], undefined, "a disabled watcher applies nothing on its own");
    const diff = disabled.reloadNow();
    assert.ok(diff && diff.added.includes(PROBE_KEY), "manual reloadNow still reads the file while disabled");
    assert.equal(process.env[PROBE_KEY], "epsilon", "manual reload applied the value");
  } finally {
    disabled.stop();
    restoreEnv("MARINARA_ENV_WATCH", originalEnvWatch);
  }

  console.info("Env watcher regressions passed.");
} finally {
  delete process.env[PROBE_KEY];
  restoreEnv("MARINARA_ENV_FILE", originalEnvFile);
  restoreEnv("MARINARA_ENV_WATCH", originalEnvWatch);
  rmSync(tempDir, { recursive: true, force: true });
}
