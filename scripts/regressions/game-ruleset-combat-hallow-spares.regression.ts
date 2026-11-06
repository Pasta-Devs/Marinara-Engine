/**
 * Kinds left out of a ward, and an inside set by a tag (Capability API 1.666): 5e's Hallow, "You can
 * exclude one or more of those types of creatures from this effect", and its extra effect on
 * "creatures that follow a specific deity or leader".
 *
 *   - Set up before a fight with `spares`, the kinds named are no longer kept out; the rest still are.
 *   - A kind it does not keep out cannot be left out, and says so.
 *   - With `tag`, what it does inside works only on those who carry that tag.
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
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetKeptBy,
  rulesetSheetBuildSchema,
  rulesetStandingAtStart,
  supportedCapabilityApi,
  RULESET_MOVE_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hallow-spares-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  assert.ok(supportedCapabilityApi.minor >= 666);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hallow = {
    id: "hallow",
    label: "Hallow",
    rows: [{ list: "spells", values: { name: "Hallow", level: 1, prepared: true } }],
    mechanics: {
      kind: "utility",
      area: { shape: "burst", size: 5 },
      range: 60,
      save: { save: "cha_save", onSuccess: "negates" },
      zone: {
        rounds: 600,
        triggers: [],
        keepsOut: { is: { types: ["fiend", "undead"] } },
        inside: { conditions: ["frightened"] },
      },
    },
  } as unknown as RulesetCatalogEntry;
  const doc = JSON.parse(fiveEText) as Record<string, any>;
  doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [hallow] });
  doc.combat.creatureTypes = {
    types: ["humanoid", "fiend", "undead"].map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) })),
    default: "humanoid",
  };
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  const definition: RulesetDefinition = result.definition;
  const block = (type: string, tags?: string[]): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
      type,
      ...(tags ? { tags } : {}),
    }) as unknown as RulesetStatBlock;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: (sides) => (sides === 20 ? 15 : 3),
    combatants: [
      {
        id: "cleric",
        name: "Cleric",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
          fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        catalogs: { spells: entries },
      },
      { id: "imp", name: "Imp", side: "enemy", block: block("fiend") },
      { id: "zombie", name: "Zombie", side: "enemy", block: block("undead") },
      { id: "acolyte", name: "Acolyte", side: "enemy", block: block("humanoid", ["follower"]) },
      { id: "thug", name: "Thug", side: "enemy", block: block("humanoid") },
    ],
    board: {
      grid: { width: 16, height: 9, tiles: Array.from({ length: 9 }, () => Array(16).fill("plains")) },
      placements: {
        cleric: { x: 2, y: 4 },
        imp: { x: 9, y: 1 },
        zombie: { x: 9, y: 7 },
        acolyte: { x: 12, y: 3 },
        thug: { x: 12, y: 5 },
      },
    },
  });
  state.order = ["cleric", "imp", "zombie", "acolyte", "thug"];
  state.turn = 0;
  const kept = (s: RulesetEncounterState, id: string) =>
    rulesetKeptBy(definition, s, rulesetCombatant(s, id)!).length > 0;

  // ── Fiends left out of the ward; the undead still kept out ──
  {
    const stood = rulesetStandingAtStart(definition, state, [
      { casterId: "cleric", entry: "Hallow", at: "self", spares: ["Fiend"] },
    ]);
    assert.deepEqual(stood.skipped, []);
    assert.deepEqual(rulesetCombatant(stood.state, "cleric")!.zones![0]!.keptOutSpares, ["fiend"]);
    assert.equal(kept(stood.state, "imp"), false, "the fiend is left out");
    assert.equal(kept(stood.state, "zombie"), true, "the undead is not");
    // With nothing left out, both are kept out.
    const plain = rulesetStandingAtStart(definition, state, [{ casterId: "cleric", entry: "Hallow", at: "self" }]);
    assert.equal(kept(plain.state, "imp"), true);
  }

  // ── A kind it does not keep out cannot be left out ──
  {
    const stood = rulesetStandingAtStart(definition, state, [
      { casterId: "cleric", entry: "Hallow", at: "self", spares: ["humanoid"] },
    ]);
    assert.match(stood.skipped.join(" "), /does not keep "humanoid" out/);
    assert.equal(rulesetCombatant(stood.state, "cleric")!.zones![0]!.keptOutSpares, undefined);
  }

  // ── What it does inside, only on followers ──
  {
    const stood = rulesetStandingAtStart(definition, state, [
      { casterId: "cleric", entry: "Hallow", at: "self", tag: "follower" },
    ]);
    assert.deepEqual(stood.skipped, []);
    const zone = rulesetCombatant(stood.state, "cleric")!.zones![0]!;
    assert.deepEqual(zone.insideIs, { tags: ["follower"] });
    const walk = (id: string) => {
      const s = structuredClone(stood.state);
      s.turn = s.order.indexOf(id);
      rulesetCombatant(s, id)!.movementLeft = 12;
      const step = applyRulesetCombatChoice(
        definition,
        s,
        { actorId: id, optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 3, y: 4 } },
        (sides) => (sides === 20 ? 2 : 3),
      );
      assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
      return rulesetActiveConditions(
        definition,
        definition.combat!,
        rulesetCombatant(step.state, id)!,
        step.state,
      ).some((one) => one.condition === "frightened");
    };
    assert.equal(walk("acolyte"), true, "a follower");
    assert.equal(walk("thug"), false, "not a follower");
  }

  console.log(
    "Hallow spares: kinds left out of its ward as it was set up stay out of it, the rest kept out; its inside on a tag only; at 1.666.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
