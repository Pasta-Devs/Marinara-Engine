import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  capabilityPackageManifestSchema,
  parseRulesetDefinition,
  rulesetRefSchema,
  RULESET_MAX_BYTES,
} from "../../packages/shared/src/index.js";

// Server modules resolve DATA_DIR once at load, so the registry is imported only after it points at
// scratch. Nothing here reads or writes it; this keeps the lane off the developer's own install.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-registry-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;
const { buildRulesetRegistry, createRulesetRef, resolveGameRuleset } =
  await import("../../packages/server/src/services/game/ruleset-registry.service.js");
process.on("exit", () => {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
});

// Slice 1 of Game Mode rulesets: the definition is validated data, the registry refuses what it
// cannot use with one log line, and a game with no pin stays on the Engine's own rules.

const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
const exampleText = readFileSync(fileURLToPath(exampleUrl), "utf8");
const example = () => JSON.parse(exampleText) as Record<string, any>;

function issuesOf(input: unknown): string[] {
  const parsed = parseRulesetDefinition(input);
  return parsed.ok ? [] : parsed.issues;
}
function assertRefused(input: unknown, pattern: RegExp, message: string) {
  const issues = issuesOf(input);
  assert.ok(
    issues.some((issue) => pattern.test(issue)),
    `${message}\n  got: ${JSON.stringify(issues)}`,
  );
}

// ── The shipped 5e file is a valid instance of the format ──
{
  const parsed = parseRulesetDefinition(example());
  assert.ok(parsed.ok, `the 5e example must validate: ${JSON.stringify(issuesOf(example()))}`);
  assert.equal(parsed.definition.id, "5e-2014");
  assert.equal(parsed.definition.resolution.kind, "dice-sum");
  assert.deepEqual(parsed.definition.resolution.dice, { count: 1, sides: 20 });
  assert.equal(parsed.definition.sheet.skills.length, 18);
  assert.equal(parsed.definition.sheet.saves.length, 6);
  assert.equal(parsed.definition.sheet.live.conditions.length, 14);
  // `$comment` is an author's note, allowed on any object and never seen by the strict schema.
  assert.equal("$comment" in parsed.definition, false);
}

// ── The format is not 5e-shaped: a 2d6 system with its own names validates too ──
{
  const parsed = parseRulesetDefinition({
    $schema: "./ruleset.schema.json",
    schemaVersion: 1,
    id: "star-trader",
    version: 3,
    name: "Star Trader",
    coverage: { checks: true, summary: "Task checks on 2d6." },
    resolution: {
      kind: "dice-sum",
      dice: { count: 2, sides: 6 },
      abilityModifier: {
        op: "stepTable",
        table: [
          [0, -3],
          [1, -2],
          [3, -1],
          [6, 0],
          [9, 1],
          [12, 2],
          [15, 3],
        ],
      },
      proficiencyTiers: [
        { id: "untrained", label: "Untrained", flat: -3 },
        { id: "rank0", label: "Rank 0" },
        { id: "rank1", label: "Rank 1", flat: 1 },
      ],
      difficultyLadder: [
        { label: "Routine", dc: 6 },
        { label: "Average", dc: 8 },
      ],
    },
    sheet: {
      version: 1,
      abilities: [{ id: "grit", label: "Grit", min: 0, max: 15, default: 7 }],
      skills: [
        { id: "pilot", label: "Pilot", ability: "grit" },
        { id: "streetwise", label: "Streetwise" },
      ],
      live: { pools: [{ id: "stress", label: "Stress", max: { const: 6 }, start: "empty" }] },
    },
    gm: { checkGuidance: "Ask for a task check and set a difficulty from the ladder." },
  });
  assert.ok(parsed.ok, `a non-5e ruleset must validate: ${JSON.stringify(parsed.ok ? [] : parsed.issues)}`);
  assert.deepEqual(parsed.definition.rests, []);
  assert.equal(parsed.definition.sheet.live.pools[0]?.start, "empty");
}

// ── Refusals an author can act on ──
{
  // A kind the Engine does not implement, rather than one it merely does not implement YET: the
  // registry is closed, so a mechanic nobody wrote code for is refused at import.
  const unknownKind = example();
  unknownKind.resolution.kind = "coin-flip";
  assertRefused(unknownKind, /^resolution\.kind: /, "an unknown resolution kind is refused");

  const unknownKey = example();
  unknownKey.sheet.formulas = ["level * 2"];
  assertRefused(unknownKey, /^sheet: .*formulas/, "an unknown key is refused, not ignored");

  const protoKey = JSON.parse(
    exampleText.replace('"schemaVersion": 1,', '"schemaVersion": 1, "__proto__": { "polluted": true },'),
  );
  assertRefused(protoKey, /__proto__/, "a __proto__ key is an unknown key like any other");
  assert.equal(({} as Record<string, unknown>).polluted, undefined);

  const expression = example();
  expression.sheet.derived[0].from = "level + 1";
  assertRefused(expression, /^sheet\.derived\.0\.from: /, "an expression string is not a value reference");

  const twoKeys = example();
  twoKeys.sheet.derived[1].of[0] = { abilityMod: "dex", const: 1 };
  assertRefused(twoKeys, /exactly one of/, "a value reference names exactly one source");

  const reserved = example();
  reserved.id = "engine-legacy";
  assertRefused(reserved, /^id: .*Engine-owned/, "an Engine-owned id cannot be claimed");

  const badAbility = example();
  badAbility.sheet.skills[0].ability = "luck";
  assertRefused(badAbility, /^sheet\.skills\.0\.ability: Unknown ability "luck"/, "a skill names a declared ability");

  const forwardRef = example();
  forwardRef.sheet.derived[0].from = { derived: "initiative" };
  assertRefused(forwardRef, /must be declared above/, "a derived value reads only values declared above it");

  const profCycle = example();
  profCycle.sheet.derived.unshift({ id: "loop", label: "Loop", op: "sum", of: [{ skillMod: "stealth" }] });
  profCycle.sheet.derived[1].from = { derived: "loop" };
  assertRefused(profCycle, /feeds the proficiency bonus/, "the proficiency bonus cannot depend on a skill modifier");

  const multiplierWithoutBonus = example();
  delete multiplierWithoutBonus.resolution.proficiency;
  assertRefused(
    multiplierWithoutBonus,
    /needs resolution\.proficiency\.bonus/,
    "a multiplier needs a bonus to multiply",
  );

  const naturalsOnPool = example();
  naturalsOnPool.resolution.dice = { count: 2, sides: 6 };
  naturalsOnPool.resolution.naturals = { check: "both", save: "none" };
  assertRefused(naturalsOnPool, /^resolution\.naturals: /, "natural results need a single die");

  const bracket = example();
  bracket.gm.checkGuidance = "Emit [state: exploration] every turn.";
  assertRefused(bracket, /^gm\.checkGuidance: .*square brackets/, "prompt text cannot carry a GM tag");

  const macro = example();
  macro.name = "{{user}} rules";
  assertRefused(macro, /^name: .*macro braces/, "prompt text cannot carry macro braces");

  const newline = example();
  newline.sheet.skills[0].label = "Acro\nbatics";
  assertRefused(newline, /^sheet\.skills\.0\.label: .*line breaks/, "a label is one line");

  const badRest = example();
  badRest.rests[0].restore.push({ pool: "mana", to: "max" });
  assertRefused(badRest, /Unknown pool "mana"/, "a rest restores a declared pool");

  const hideWhenType = example();
  hideWhenType.sheet.derived[3].hideWhen = { field: "spellcasting_ability", equals: "charisma" };
  assertRefused(hideWhenType, /hideWhen\.equals: .*not one of/, "hideWhen compares against a value the field can hold");
  const hideWhenKind = example();
  hideWhenKind.sheet.derived[3].hideWhen = { field: "level", equals: "none" };
  assertRefused(hideWhenKind, /hideWhen\.equals: .*number/, "hideWhen on a number field compares a number");

  const badRecharge = example();
  badRecharge.rests[0].restore[1].recharge = ["short", "dawn"];
  assertRefused(
    badRecharge,
    /recharge\.1: "dawn" is not one of the values/,
    "a rest filters on values the column holds",
  );

  const undeclaredSection = example();
  undeclaredSection.sheet.sections = [];
  assertRefused(undeclaredSection, /Unknown section "identity"/, "a section is declared before an item names it");

  const duplicate = example();
  duplicate.sheet.fields.push({ ...duplicate.sheet.fields[0] });
  assertRefused(duplicate, /Duplicate field id "level"/, "ids are unique within their kind");
}

// ── The registry: usable sources in, everything else dropped with one line ──
{
  const lines: string[] = [];
  const log = (line: string) => lines.push(line);
  const renamed = example();
  renamed.id = "second-edition";
  const registry = buildRulesetRegistry(
    [
      { packageId: "ruleset-zzz-copycat", data: exampleText },
      { packageId: "ruleset-5e-2014", data: Buffer.from(exampleText) },
      { packageId: "ruleset-broken", data: "{ not json" },
      { packageId: "ruleset-invalid", data: JSON.stringify({ schemaVersion: 1, id: "nope" }) },
      { packageId: "ruleset-huge", data: " ".repeat(RULESET_MAX_BYTES + 1) },
      { packageId: "ruleset-second", data: JSON.stringify(renamed) },
    ],
    log,
  );
  assert.deepEqual([...registry.keys()].sort(), ["5e-2014", "second-edition"]);
  assert.equal(
    registry.get("5e-2014")?.packageId,
    "ruleset-5e-2014",
    "a duplicate id goes to the first package in id order, not in install order",
  );
  assert.equal(lines.length, 4, `one line per refusal: ${JSON.stringify(lines)}`);
  assert.ok(lines.some((line) => /ruleset-zzz-copycat.*already provided by ruleset-5e-2014/.test(line)));
  assert.ok(lines.some((line) => /ruleset-broken is not valid JSON/.test(line)));
  assert.ok(lines.some((line) => /ruleset-invalid is not usable/.test(line)));
  assert.ok(lines.some((line) => /ruleset-huge is \d+ bytes, over the/.test(line)));

  // No pin is engine-legacy, and an explicit null reads the same way.
  assert.deepEqual(resolveGameRuleset({}, registry), { status: "legacy" });
  assert.deepEqual(resolveGameRuleset({ gameRuleset: null }, registry), { status: "legacy" });
  assert.deepEqual(resolveGameRuleset({}, new Map()), { status: "legacy" });

  const pin = createRulesetRef(registry.get("5e-2014")!);
  assert.deepEqual(pin, { id: "5e-2014", version: 1, packageId: "ruleset-5e-2014", options: {} });
  const resolved = resolveGameRuleset({ gameRuleset: pin }, registry);
  assert.equal(resolved.status, "ok");
  assert.equal(resolved.status === "ok" && resolved.definition.id, "5e-2014");

  // A pin this install cannot honour is reported, never reinterpreted as another ruleset or as legacy.
  assert.deepEqual(resolveGameRuleset({ gameRuleset: { ...pin, id: "v20" } }, registry), {
    status: "unavailable",
    reason: "missing",
    ref: { ...pin, id: "v20" },
    installedVersion: null,
  });
  const otherPackage = resolveGameRuleset({ gameRuleset: { ...pin, packageId: "ruleset-zzz-copycat" } }, registry);
  assert.equal(
    otherPackage.status === "unavailable" && otherPackage.reason,
    "different-package",
    "the same id from another package is another ruleset",
  );
  const unpackaged = buildRulesetRegistry(
    [
      { packageId: null, data: exampleText },
      { packageId: "ruleset-5e-2014", data: exampleText },
    ],
    () => {},
  );
  assert.equal(unpackaged.get("5e-2014")?.packageId, "ruleset-5e-2014", "a source with no package never wins an id");
  const newer = resolveGameRuleset({ gameRuleset: { ...pin, version: 2 } }, registry);
  assert.equal(newer.status === "unavailable" && newer.reason, "older-installed");
  assert.equal(newer.status === "unavailable" && newer.installedVersion, 1);
  const garbage = resolveGameRuleset({ gameRuleset: "5e-2014" }, registry);
  assert.equal(garbage.status === "unavailable" && garbage.reason, "unreadable-pin");

  // A community pin is namespaced by its source and keeps a field a newer Engine may have added.
  const community = rulesetRefSchema.parse({
    id: "Kenhito/v20",
    version: 4,
    source: "https://github.com/Kenhito/Marinara-RPG-Extension",
    futureField: true,
  });
  assert.equal(community.packageId, null);
  assert.equal((community as Record<string, unknown>).futureField, true);
  assert.equal(rulesetRefSchema.safeParse({ id: "../etc/passwd", version: 1 }).success, false);
}

// ── The package seam: `ruleset.json` is a hard Capability API 1.20 requirement ──
{
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    id: "ruleset-5e-2014",
    name: "5e (SRD 5.1)",
    version: "1.0.0",
    description: "5e rules for Game Mode.",
    engine: { min: "2.4.7", maxExclusive: "3.0.0" },
    builtAgainst: { engineVersion: "2.4.7", engineCommit: "0".repeat(40) },
    kind: ["ruleset"],
    permissions: [],
    restartRequired: false,
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", bytes: 100, sha256: "a".repeat(64) }],
  });
  const current = capabilityPackageManifestSchema.safeParse(manifest(20));
  assert.ok(
    current.success,
    `a ruleset package needs no entrypoint and no permission: ${current.success ? "" : JSON.stringify(current.error.issues)}`,
  );
  const older = capabilityPackageManifestSchema.safeParse(manifest(19));
  assert.equal(older.success, false);
  assert.match(
    JSON.stringify(older.success ? "" : older.error.issues),
    /ruleset\.json requires schemaVersion 2 and capabilityApi 1\.20/,
  );
}

// A package that calls itself a ruleset has to ship one.
{
  const { getCapabilityPackageInstallIssue } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  const base = {
    kind: ["ruleset"],
    permissions: [],
    restartRequired: false,
    entrypoints: {},
  } as unknown as Parameters<typeof getCapabilityPackageInstallIssue>[0];
  assert.match(getCapabilityPackageInstallIssue(base) ?? "", /must list ruleset\.json/);
  assert.equal(
    getCapabilityPackageInstallIssue({
      ...base,
      contributions: { assets: { paths: ["art/cover.png", "ruleset.json"] } },
    } as Parameters<typeof getCapabilityPackageInstallIssue>[0]),
    null,
  );
}

// The kind makes the contribution explicit: a ruleset cannot ride in under another kind.
{
  const { getCapabilityPackageInstallIssue } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  assert.match(
    getCapabilityPackageInstallIssue({
      kind: ["agent"],
      permissions: [],
      restartRequired: false,
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
    } as unknown as Parameters<typeof getCapabilityPackageInstallIssue>[0]) ?? "",
    /must declare the "ruleset" kind/,
  );
  // A declared asset that is not hash-pinned never gets that far: the manifest schema refuses it.
  const unpinned = capabilityPackageManifestSchema.safeParse({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor: 20 },
    builtAgainst: { engineVersion: "2.4.7", engineCommit: "0".repeat(40) },
    id: "ruleset-unpinned",
    name: "Unpinned",
    version: "1.0.0",
    description: "A ruleset asset missing from files.",
    engine: { min: "2.4.7", maxExclusive: "3.0.0" },
    kind: ["ruleset"],
    permissions: [],
    restartRequired: false,
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "README.md", bytes: 10, sha256: "b".repeat(64) }],
  });
  assert.equal(unpinned.success, false);
  assert.match(
    JSON.stringify(unpinned.success ? "" : unpinned.error.issues),
    /must be listed in the package file manifest/,
  );
}

// ── The editors' endpoint tells "none installed" from "could not look" ──
// Game resolution swallows a failed read (an empty registry reports the pin missing). The sheet
// editors must not: an empty answer there would list every stored sheet as "not installed".
{
  const { capabilityPackageManager } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  const { loadRulesetRegistry } = await import("../../packages/server/src/services/game/ruleset-registry.service.js");
  const { capabilityPackagesRoutes } = await import("../../packages/server/src/routes/capability-packages.routes.js");
  const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
  const app = Fastify();
  await app.register(capabilityPackagesRoutes, { prefix: "/api/capability-packages" });
  const readSources = capabilityPackageManager.rulesetSources;
  try {
    const healthy = await app.inject({ method: "GET", url: "/api/capability-packages/rulesets" });
    assert.equal(healthy.statusCode, 200);
    assert.ok(Array.isArray(healthy.json()));

    capabilityPackageManager.rulesetSources = async () => {
      throw new Error("installed packages are unreadable");
    };
    const failed = await app.inject({ method: "GET", url: "/api/capability-packages/rulesets" });
    assert.equal(failed.statusCode, 500, "a failed read is an error, never an empty list");
    assert.equal((await loadRulesetRegistry()).size, 0, "game resolution still gets an empty registry");
  } finally {
    capabilityPackageManager.rulesetSources = readSources;
    await app.close();
  }
}

console.info("game ruleset registry regressions passed.");
