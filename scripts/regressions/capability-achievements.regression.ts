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
assert.deepEqual(progress.get("noodle.ten_runs"), { count: 4, target: 10 });
assert.deepEqual(progress.get("noodle.broken"), { count: 0, target: 1 });

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

// ── A target needs a count, and a count needs a target ──
assert.throws(
  () => registerCapabilityAchievements(source, [{ id: "no_count", title: "X", description: "X", target: 10 }]),
  /target and readProgress together/,
);
assert.throws(
  () =>
    registerCapabilityAchievements(source, [{ id: "no_target", title: "X", description: "X", readProgress: () => 1 }]),
  /target and readProgress together/,
);

// ── Progress can be read for one package, and a callback that reads again does not recurse ──
let nestedCalls = 0;
const releaseOther = registerCapabilityAchievements({ ...source, packageId: "other", packageName: "Other" }, [
  {
    id: "loop",
    title: "Loop",
    description: "Reads progress from inside its own callback.",
    target: 5,
    readProgress: async () => {
      nestedCalls += 1;
      const inner = await readCapabilityAchievementProgress("other");
      assert.equal(inner.has("other.loop"), false, "a package already reading must be skipped");
      return 2;
    },
  },
]);
const onlyOther = await readCapabilityAchievementProgress("other");
assert.deepEqual([...onlyOther.keys()], ["other.loop"]);
assert.deepEqual(onlyOther.get("other.loop"), { count: 2, target: 5 });
assert.equal(nestedCalls, 1);
releaseOther();

// ── The per-package limit counts earlier calls too ──
const many = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}_${index}`, title: "X", description: "X" }));
const limitSource = { ...source, packageId: "limit", packageName: "Limit" };
const releaseFirst = registerCapabilityAchievements(limitSource, many("a", 20));
assert.throws(() => registerCapabilityAchievements(limitSource, many("b", 13)), /at most 32/);
const releaseReplace = registerCapabilityAchievements(limitSource, many("a", 20));
assert.equal(capabilityAchievementDefinitions("limit").length, 20, "replacing ids does not count twice");
releaseReplace();
releaseFirst();

// ── A count from a superseded registration is discarded ──
let finishSlowRead: (value: number) => void = () => {};
const slowSource = { ...source, packageId: "slow", packageName: "Slow" };
const releaseOld = registerCapabilityAchievements(slowSource, [
  {
    id: "count",
    title: "X",
    description: "X",
    target: 5,
    readProgress: () => new Promise<number>((resolve) => (finishSlowRead = resolve)),
  },
]);
const pendingRead = readCapabilityAchievementProgress("slow");
releaseOld();
const releaseNew = registerCapabilityAchievements(slowSource, [
  { id: "count", title: "X", description: "X", target: 50, readProgress: () => 1 },
]);
finishSlowRead(49);
assert.equal((await pendingRead).has("slow.count"), false, "a stale count must not reach the new target");
releaseNew();

// ── A count keeps the target it was read against, even if its badge is replaced before the
//    whole read settles (badge A finishes, badge B is still pending, A is replaced) ──
let finishB: (value: number) => void = () => {};
const boundSource = { ...source, packageId: "bound", packageName: "Bound" };
const releaseA = registerCapabilityAchievements(boundSource, [
  { id: "a", title: "A", description: "A", target: 10, readProgress: () => 3 },
]);
const releaseB = registerCapabilityAchievements(boundSource, [
  { id: "b", title: "B", description: "B", target: 5, readProgress: () => new Promise<number>((r) => (finishB = r)) },
]);
const boundRead = readCapabilityAchievementProgress("bound");
await new Promise((resolve) => setImmediate(resolve));
releaseA();
const releaseA2 = registerCapabilityAchievements(boundSource, [
  { id: "a", title: "A", description: "A", target: 2, readProgress: () => 3 },
]);
finishB(1);
assert.deepEqual(
  (await boundRead).get("bound.a"),
  { count: 3, target: 10 },
  "the count must carry the old target, so it cannot meet the new, lower one",
);
releaseA2();
releaseB();

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
