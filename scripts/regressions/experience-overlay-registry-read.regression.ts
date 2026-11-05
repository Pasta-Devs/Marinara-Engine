// An Experience's ruleset overlays (Capability API 1.355) when the installed packages can't be read: the
// overlays are left out, and one warn line says the registry could not be read, so a broken registry is
// told apart from an install with no overlays.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-overlay-registry-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { logger } = await import("../../packages/server/src/lib/logger.js");
const { capabilityPackageManager } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

const warnings: unknown[][] = [];
const warn = logger.warn.bind(logger);
logger.warn = ((...args: unknown[]) => {
  warnings.push(args);
}) as typeof logger.warn;

try {
  // No registry yet (a fresh install): no overlays and nothing to warn about.
  assert.deepEqual(await capabilityPackageManager.experienceRulesetOverlays(), []);
  assert.equal(warnings.length, 0);

  // A truncated registry: still no overlays, and one line naming why.
  mkdirSync(join(dataDir, "capability-packages"), { recursive: true });
  writeFileSync(join(dataDir, "capability-packages", "installed.json"), '{"schemaVersion":1,"packages":[');
  assert.deepEqual(await capabilityPackageManager.experienceRulesetOverlays(), []);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0]![0] instanceof Error);
  assert.match(String(warnings[0]![1]), /installed packages could not be read; their overlays are left out/u);
} finally {
  logger.warn = warn;
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("Overlay registry read: a registry that won't read leaves the overlays out with one line saying so.");
