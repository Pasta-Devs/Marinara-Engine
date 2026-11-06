/**
 * The target's choice of save (Capability API 1.724): a bulette's Deadly Leap.
 *
 *   - A save with `or` is made with whichever of the two its target is better at, by a creature's
 *     action and by a catalog entry alike, and the log names the one made.
 *   - Import refusals and the install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-save-or-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 724);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const shove = (or: unknown = "dex_save") =>
    ({
      id: "shove",
      label: "Shove",
      rows: [{ list: "spells", values: { name: "Shove", level: 0, prepared: true } }],
      mechanics: {
        kind: "attack",
        autoHit: true,
        damageType: "force",
        range: 60,
        amount: { flat: 10 },
        save: { save: "str_save", onSuccess: "half", ...(or ? { or } : {}) },
      },
    }) as unknown as RulesetCatalogEntry;
  const fiveE = (or?: unknown): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [shove(or)] });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE("dex_save"));
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = (saves: Record<string, number>, actions: unknown[] = []): RulesetStatBlock =>
    ({ health: 100, defense: 5, initiativeModifier: 0, speed: 30, saves, actions }) as unknown as RulesetStatBlock;
  const leap = {
    id: "leap",
    name: "Deadly Leap",
    budget: "action",
    reach: 5,
    autoHit: true,
    damage: { count: 0, sides: 0, flat: 10 },
    save: { save: "str_save", or: "dex_save", difficulty: 16, onSuccess: "half" },
  };

  // ── A spell: a nimble foe makes Dexterity, a strong one Strength ──
  for (const [saves, made, success] of [
    [{ str_save: 1, dex_save: 8 }, "dex_save", true],
    [{ str_save: 8, dex_save: 1 }, "str_save", true],
    [{ str_save: 1, dex_save: 1 }, "str_save", false],
  ] as const) {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        { id: "ogre", name: "Ogre", side: "enemy", block: block(saves) },
      ],
    });
    state.order = ["wizard", "ogre"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Shove");
    assert.ok(option, "no Shove");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: option.id, targetIds: ["ogre"] },
      () => 10,
    );
    assert.deepEqual(
      of(step.events, "save").map((one) => [one.save, one.success]),
      [[made, success]],
      JSON.stringify(saves),
    );
  }

  // ── A creature's leap: the same choice ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "bulette", name: "Bulette", side: "enemy", block: block({}, [leap]) },
        { id: "rogue", name: "Rogue", side: "party", block: block({ str_save: 0, dex_save: 7 }) },
      ],
    });
    state.order = ["bulette", "rogue"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "bulette").find((one) => one.label === "Deadly Leap");
    assert.ok(option, "no Deadly Leap");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "bulette", optionId: option.id, targetIds: ["rogue"] },
      () => 10,
    );
    assert.deepEqual(
      of(step.events, "save").map((one) => [one.save, one.success]),
      [["dex_save", true]],
    );
  }

  // ── Refusals and the install gate ──
  {
    refused(fiveE("luck_save"), /Unknown save "luck_save"/);
    const creatureDoc = fiveE();
    const beasts = (creatureDoc.catalogs as Record<string, any>[]).find((catalog) => catalog.holds === "creatures")!;
    beasts.entries[0].creature.actions.push({ ...leap, save: { ...leap.save, or: "luck_save" } });
    refused(creatureDoc, /Unknown save "luck_save"/);
    const gate =
      "A ruleset with a save its target may make with another (save.or) requires schemaVersion 2 and capabilityApi 1.724 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(723) as never, fiveE("dex_save")), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(724) as never, fiveE("dex_save")), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(723) as never, fiveE(null)), gate);
  }

  console.log(
    "Deadly Leap: a save with `or` is made with the better of the two, by a spell and a creature; gated at 1.724.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
