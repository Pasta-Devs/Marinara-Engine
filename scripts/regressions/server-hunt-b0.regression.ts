// server-hunt batch 0: .env hot reload must classify keys by their effective
// value. A timeout key in .env that .env.timeouts.json overrides used to be
// reported as Updated (with a false restart-required warning) on every
// unrelated .env edit, because the reload compared the JSON value in
// process.env against the .env line and then applySavedRequestTimeouts()
// wrote the JSON value straight back.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b0-"));
const envPath = join(tempDir, ".env");
const PROBE = "MARINARA_HUNT_B0_PROBE";
const SHELL_PROBE = "MARINARA_HUNT_B0_SHELL_PROBE";
const saved: Record<string, string | undefined> = {};
for (const key of ["MARINARA_ENV_FILE", "DATA_DIR", "LOG_LEVEL", "IMAGE_GEN_TIMEOUT_MS", PROBE, SHELL_PROBE]) {
  saved[key] = process.env[key];
}
process.env.MARINARA_ENV_FILE = envPath;
process.env.DATA_DIR = join(tempDir, "data");
process.env.LOG_LEVEL = "silent";
delete process.env.IMAGE_GEN_TIMEOUT_MS;
delete process.env[PROBE];
process.env[SHELL_PROBE] = "from-shell";

writeFileSync(envPath, `IMAGE_GEN_TIMEOUT_MS=600000\n${PROBE}=one\n${SHELL_PROBE}=from-file\n`);

try {
  const runtime = await import("../../packages/server/src/config/runtime-config.js");
  assert.equal(process.env.IMAGE_GEN_TIMEOUT_MS, "600000", "boot applies the .env timeout");
  assert.equal(process.env[SHELL_PROBE], "from-shell", "boot keeps the inherited value (dotenv does not override)");

  const settings = { ...runtime.getRequestTimeoutSettings(), images: 1200 };
  runtime.saveRequestTimeoutSettings(settings);
  assert.equal(process.env.IMAGE_GEN_TIMEOUT_MS, "1200000", "saved timeouts override .env");

  // Unrelated .env edit.
  writeFileSync(envPath, `IMAGE_GEN_TIMEOUT_MS=600000\n${PROBE}=two\n${SHELL_PROBE}=from-file\n`);
  const diff = runtime.reloadRuntimeEnv();
  assert.deepEqual(diff.updated.sort(), [PROBE, SHELL_PROBE].sort(), "only effective changes are reported as updated");
  assert.ok(diff.unchanged.includes("IMAGE_GEN_TIMEOUT_MS"), "a timeout overridden by the saved JSON stays unchanged");
  assert.equal(process.env.IMAGE_GEN_TIMEOUT_MS, "1200000", "saved timeout still wins after reload");
  assert.equal(process.env[PROBE], "two", "the edited key is applied");
  assert.equal(process.env[SHELL_PROBE], "from-file", "reload keeps applying .env lines (existing semantics)");

  // Second unrelated edit: nothing flaps.
  writeFileSync(envPath, `IMAGE_GEN_TIMEOUT_MS=600000\n${PROBE}=two\n${SHELL_PROBE}=from-file\n# note\n`);
  const quiet = runtime.reloadRuntimeEnv();
  assert.deepEqual(quiet.updated, [], "a comment-only edit reports no updated keys");
  assert.deepEqual(quiet.added, []);
  assert.deepEqual(quiet.removed, []);

  // Adding and removing still work.
  writeFileSync(envPath, `IMAGE_GEN_TIMEOUT_MS=600000\n`);
  const shrink = runtime.reloadRuntimeEnv();
  assert.deepEqual(shrink.removed.sort(), [PROBE, SHELL_PROBE].sort());
  assert.equal(process.env[PROBE], undefined);
  writeFileSync(envPath, `IMAGE_GEN_TIMEOUT_MS=600000\n${PROBE}=three\n`);
  const grow = runtime.reloadRuntimeEnv();
  assert.deepEqual(grow.added, [PROBE]);
  assert.equal(process.env[PROBE], "three");

  console.log("server-hunt-b0 regression passed");
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
