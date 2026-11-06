/**
 * Targets each within a distance of the first (Capability API 1.594): 5e's Chain Lightning.
 *
 *   - `targetsWithinFirst: 30`: two leaps 60 feet apart, either side of the first, are allowed.
 *   - One 35 feet from the first is refused as standing too far, as `targetsWithin` refuses the pair
 *     60 feet apart.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-targets-near-first-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 594);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const chain = {
    id: "chain",
    label: "Chain",
    rows: [{ list: "spells", values: { name: "Chain", level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      targets: "enemy",
      budget: "action",
      range: 150,
      targetCount: 4,
      targetsWithinFirst: 30,
      save: { save: "dex_save", onSuccess: "half" },
      amount: { dice: "10d8" },
      damageType: "lightning",
    },
  };
  const document = (edit: (mechanics: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const entry = structuredClone(chain) as Record<string, any>;
    edit(entry.mechanics);
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [entry] });
    return doc;
  };
  const definitionOf = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const foe = (): RulesetStatBlock =>
    ({ health: 200, defense: 10, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const cast = (definition: RulesetDefinition, targetIds: string[]) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const foes: Record<string, { x: number; y: number }> = {
      first: { x: 15, y: 1 },
      left: { x: 9, y: 1 },
      right: { x: 21, y: 1 },
      far: { x: 22, y: 1 },
    };
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
            fields: { level: 11, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "int" },
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
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Chain");
    assert.ok(option, "offered");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option!.id, targetIds } as never,
      () => 3,
    );
    const refused = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "refused" }> => one.type === "refused",
    );
    if (refused) return refused.reason;
    return step.events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage")
      .map((one) => one.targetId)
      .sort();
  };
  const definition = definitionOf(document());

  // ── Two leaps 60 feet apart, each 30 feet from the first: all three struck ──
  assert.deepEqual(cast(definition, ["first", "left", "right"]), ["first", "left", "right"]);
  // ── One 35 feet from the first is too far ──
  assert.equal(cast(definition, ["first", "left", "far"]), "targets-apart");
  // ── Named first, the far one is the first: the others measured from it ──
  assert.equal(cast(definition, ["far", "right", "left"]), "targets-apart");
  assert.deepEqual(cast(definition, ["far", "right"]), ["far", "right"]);
  // ── Held to each other instead, the pair 60 feet apart is refused ──
  const pairwise = definitionOf(
    document((mechanics) => {
      delete mechanics.targetsWithinFirst;
      mechanics.targetsWithin = 30;
    }),
  );
  assert.equal(cast(pairwise, ["first", "left", "right"]), "targets-apart");

  // ── Refusals ──
  {
    const parsed = parseRulesetDefinition(document((mechanics) => (mechanics.targetsWithin = 30)));
    assert.equal(parsed.ok, false);
    if (!parsed.ok)
      assert.match(parsed.issues.join("; "), /"targetsWithinFirst" and "targetsWithin" each say how near/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with targets each within a distance of the first (targetsWithinFirst) requires schemaVersion 2 and capabilityApi 1.594 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(593) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(594) as never, document()), gate);
  }

  console.log(
    "Targets near the first: leaps 60 feet apart either side of the first allowed, one 35 feet off refused; gated at 1.594.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
