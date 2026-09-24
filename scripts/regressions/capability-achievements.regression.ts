import assert from "node:assert/strict";
import { capabilityPackageManifestSchema, capabilityPermissionSchema } from "../../packages/shared/src/index.js";
import { createCapabilityAchievementHost } from "../../packages/server/src/services/capability-packages/capability-achievement-host.service.js";
import {
  capabilityAchievementDefinitions,
  isCapabilityAchievementOwnedBy,
  readCapabilityAchievementProgress,
  registerCapabilityAchievements,
  releaseCapabilityAchievements,
} from "../../packages/server/src/services/capability-packages/capability-achievement-registry.service.js";

const source = { packageId: "noodle", packageName: "Noodle", packageVersion: "1.2.0" };
releaseCapabilityAchievements("noodle");
releaseCapabilityAchievements("other");

assert.ok(capabilityPermissionSchema.options.includes("achievements"));

// ── The declared API version keeps an achievements package off an Engine without the API ──
const manifest = {
  schemaVersion: 2 as const,
  id: "noodle",
  name: "Noodle",
  version: "1.0.0",
  engine: { min: "2.4.0", maxExclusive: "3.0.0" },
  kind: ["agent"],
  capabilityApi: { major: 1, minor: 36 },
  builtAgainst: { engineVersion: "2.4.6", engineCommit: "a".repeat(40) },
  entrypoints: { server: "server.mjs" },
  files: [{ path: "server.mjs", sha256: "b".repeat(64), bytes: 10 }],
  permissions: ["achievements"],
};
assert.doesNotThrow(() => capabilityPackageManifestSchema.parse(manifest));
assert.throws(
  () => capabilityPackageManifestSchema.parse({ ...manifest, capabilityApi: { major: 1, minor: 35 } }),
  /permission requires schemaVersion 2 and capabilityApi 1\.36 or newer/,
);

// ── Ids are namespaced, art resolves to the package asset route ──
const release = registerCapabilityAchievements(source, [
  { id: "first_run", title: "First Run", description: "Ran once.", iconPath: "art/first run.png" },
  { id: "ten_runs", title: "Ten Runs", description: "Ran ten times.", target: 10, readProgress: () => 4 },
  {
    id: "broken",
    title: "Broken",
    description: "Callback throws.",
    target: 1,
    readProgress: () => {
      throw new Error("boom");
    },
  },
]);
const definitions = capabilityAchievementDefinitions("noodle");
assert.deepEqual(
  definitions.map((item) => item.id),
  ["noodle.first_run", "noodle.ten_runs", "noodle.broken"],
);
assert.equal(definitions[0]!.iconUrl, "/api/capability-packages/noodle/assets/art/first%20run.png?v=1.2.0");
assert.equal(definitions[0]!.icon, "trophy");
assert.equal(definitions[0]!.category, "milestone");
assert.deepEqual(definitions[0]!.source, source);

// ── A failing progress callback reports zero instead of failing the panel ──
const progress = await readCapabilityAchievementProgress();
assert.equal(progress.get("noodle.ten_runs"), 4);
assert.equal(progress.get("noodle.broken"), 0);

// ── One package cannot claim another's id, or a built-in one ──
assert.throws(
  () =>
    registerCapabilityAchievements({ ...source, packageId: "other", packageName: "Other" }, [
      { id: "x", title: "X", description: "X" },
      { id: "x", title: "X", description: "X" },
    ]),
  /registered twice/,
);
assert.equal(capabilityAchievementDefinitions("other").length, 0, "a rejected batch registers nothing");
assert.throws(
  () => registerCapabilityAchievements(source, [{ id: "Bad Id", title: "X", description: "X" }]),
  /invalid/,
);
assert.throws(
  () => registerCapabilityAchievements(source, [{ id: "zero", title: "X", description: "X", target: 0 }]),
  /positive whole number/,
);

// ── The host only touches badges the calling package owns, and only with the permission ──
assert.ok(isCapabilityAchievementOwnedBy("noodle", "noodle.first_run"));
assert.ok(!isCapabilityAchievementOwnedBy("other", "noodle.first_run"));
const foreign = createCapabilityAchievementHost(undefined, "other", ["achievements"]);
await assert.rejects(() => foreign.unlock("noodle.first_run"), /does not own/);
await assert.rejects(() => foreign.isUnlocked("diligent_student"), /does not own/);
const unpermitted = createCapabilityAchievementHost(undefined, "noodle", []);
await assert.rejects(() => unpermitted.unlock("first_run"), /"achievements" permission/);
await assert.rejects(() => unpermitted.list(), /"achievements" permission/);

// ── Release drops the definitions ──
release();
assert.equal(capabilityAchievementDefinitions("noodle").length, 0);

console.log("capability achievements regression passed");
