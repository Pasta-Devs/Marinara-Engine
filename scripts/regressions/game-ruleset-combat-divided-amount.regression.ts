/**
 * An amount multiplied and split among those an area catches (Capability API 1.593): a Wand of
 * Wonder's gems.
 *
 *   - `amountTimes: 10`: the 1d4 is rolled once and multiplied.
 *   - `dividedAmong: "caught"`: the total split evenly, rounded down, among everybody caught.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-divided-amount-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 593);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const gems = {
    id: "gems",
    label: "Gems",
    rows: [{ list: "spells", values: { name: "Gems", level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      targets: "enemy",
      budget: "action",
      range: 120,
      area: { shape: "burst", size: 10 },
      friendlyFire: false,
      amount: { dice: "1d4" },
      amountTimes: 10,
      dividedAmong: "caught",
      damageType: "bludgeoning",
    },
  };
  const document = (edit: (mechanics: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const entry = structuredClone(gems) as Record<string, any>;
    edit(entry.mechanics);
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [entry] });
    return doc;
  };
  const result = parseRulesetDefinition(document());
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  const definition: RulesetDefinition = result.definition;
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const foe = (): RulesetStatBlock =>
    ({ health: 200, defense: 10, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const throwAt = (foes: Record<string, { x: number; y: number }>) => {
    const width = 30;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 3,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 16, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        ...Object.keys(foes).map((id) => ({ id, name: id, side: "enemy" as const, block: foe() })),
      ],
      board: {
        grid: { width, height: 3, tiles: Array.from({ length: 3 }, () => Array(width).fill("plains")) } as never,
        placements: { mage: { x: 0, y: 1 }, ...foes },
      },
    });
    state.order = ["mage", ...Object.keys(foes)];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Gems");
    assert.ok(option, "offered");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option!.id, targetIds: [], at: { x: 10, y: 1 } } as never,
      (sides) => (sides === 4 ? 3 : 10),
    );
    return Object.fromEntries(
      step.events
        .filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage")
        .map((one) => [one.targetId, one.amount]),
    );
  };

  // ── Two caught: 3 × 10 = 30, 15 each; one standing far off untouched ──
  assert.deepEqual(throwAt({ a: { x: 10, y: 1 }, b: { x: 11, y: 1 }, far: { x: 25, y: 1 } }), { a: 15, b: 15 });
  // ── Four caught: 30 / 4, rounded down to 7 each ──
  assert.deepEqual(throwAt({ a: { x: 10, y: 1 }, b: { x: 11, y: 1 }, c: { x: 10, y: 0 }, d: { x: 10, y: 2 } }), {
    a: 7,
    b: 7,
    c: 7,
    d: 7,
  });
  // ── One caught: all 30 ──
  assert.deepEqual(throwAt({ a: { x: 10, y: 1 } }), { a: 30 });

  // ── Refusals ──
  const refused = (edit: (mechanics: Record<string, any>) => void, pattern: RegExp) => {
    const parsed = parseRulesetDefinition(document(edit));
    assert.equal(parsed.ok, false, `should be refused: ${pattern}`);
    if (!parsed.ok) assert.match(parsed.issues.join("; "), pattern);
  };
  refused((mechanics) => delete mechanics.area, /"dividedAmong" splits among those an "area" catches/);
  refused(
    (mechanics) => (mechanics.save = { save: "dex_save", onSuccess: "half" }),
    /A split amount is rolled with no attack roll or save/,
  );
  refused((mechanics) => delete mechanics.amount, /"amountTimes" multiplies "amount"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an amount multiplied or split among those an area catches (amountTimes, dividedAmong) requires schemaVersion 2 and capabilityApi 1.593 or newer";
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(592) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(593) as never, document()), gate);
  }

  console.log(
    "Divided amount: 1d4 × 10 gems split evenly, rounded down, among those the area catches; refusals; gated at 1.593.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
