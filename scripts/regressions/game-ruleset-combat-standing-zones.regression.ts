/**
 * Zones set up before a fight, standing as it starts (Capability API 1.462).
 *
 *   - Entries that say `beforeFight` are never on the fight menu.
 *   - Set up before the fight: paid for off the sheet, put down between the caster and the nearest
 *     foe or where they stand; a hidden one put down unsaid; an unknown one left out and said.
 *   - A foe walking into the glyph set up beforehand sets it off.
 *   - An area that holds whoever is in it, set up where its caster stands, goes over their foes.
 *   - The install gate.
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
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetStandingAtStart,
  supportedCapabilityApi,
  RULESET_MOVE_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-standing-zones-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 462);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  // Glyph of Warding's explosive runes, small: 20 fire to everybody within 5 feet, a Dex save for half.
  const glyphMechanics = (zone: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
    kind: "attack",
    area: { shape: "burst", size: 5 },
    range: 150,
    amount: { flat: 20 },
    damageType: "fire",
    cost: [{ pool: "slots_1", amount: 1 }],
    save: { save: "dex_save", onSuccess: "half" },
    beforeFight: true,
    zone: { rounds: 1000, triggers: [], detonates: { entered: true, within: 5 }, ...zone },
    ...extra,
  });
  const glyph = spell("glyph", glyphMechanics({ hidden: { check: "investigate" } }));
  const plainglyph = spell("plainglyph", glyphMechanics());
  const spells = [glyph, plainglyph];
  const fiveE = (entries: RulesetCatalogEntry[] = spells): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push(
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
      { id: "investigate", label: "Investigation", value: { skillMod: "investigation" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look" };
    doc.combat.standard.push("search");
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const block: RulesetStatBlock = {
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    saves: { dex_save: -10 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
  } as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 24,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(24).fill("plains")),
  });
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: roll,
    combatants: [
      {
        id: "mage",
        name: "Mage",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
          fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
          lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        catalogs: { spells },
      },
      { id: "a", name: "A", side: "enemy", block },
      { id: "b", name: "B", side: "enemy", block },
    ],
    board: { grid: grid(), placements: { mage: { x: 2, y: 7 }, a: { x: 14, y: 7 }, b: { x: 20, y: 7 } } },
  });
  state.order = state.combatants.map((one) => one.id);
  state.turn = 0;
  const who = (s: RulesetEncounterState, id: string) => rulesetCombatant(s, id)!;
  const slots = (s: RulesetEncounterState) =>
    readRulesetLive(definition, who(s, "mage").sheet!.build, who(s, "mage").sheet!.live).pools.find(
      (pool) => pool.key === "slots_1",
    )!.value;

  // ── Never on the fight menu ──
  const labels = rulesetCombatOptions(definition, state, "mage").map((one) => one.label);
  assert.ok(!labels.includes("Glyph") && !labels.includes("Plainglyph"), labels.join(", "));

  // ── Set up before the fight ──
  const before = slots(state);
  const stood = rulesetStandingAtStart(definition, state, [
    { casterId: "mage", entry: "Plainglyph", at: "between" },
    { casterId: "mage", entry: "glyph", at: "self" },
    { casterId: "mage", entry: "Nope" },
  ]);
  assert.equal(stood.skipped.length, 1);
  assert.match(stood.skipped[0]!, /Nope/);
  const zones = who(stood.state, "mage").zones ?? [];
  assert.deepEqual(
    zones.map((zone) => [zone.label, zone.at]),
    [
      ["Plainglyph", { x: 8, y: 7 }],
      ["Glyph", { x: 2, y: 7 }],
    ],
    "between the mage and A, and where the mage stands",
  );
  assert.equal(slots(stood.state), before - 2, "both paid off the sheet");
  const said = stood.state.opening.filter((one) => one.type === "zone").map((one) => one.label);
  assert.deepEqual(said, ["Plainglyph"], "the hidden one is put down unsaid");
  assert.equal(slots(state), before, "the state handed in is left as it was");

  // ── A walks into the glyph set up beforehand ──
  {
    const next = structuredClone(stood.state);
    next.turn = next.order.indexOf("a");
    who(next, "a").movementLeft = 10;
    const to: RulesetCombatCell = { x: 9, y: 7 };
    const step = applyRulesetCombatChoice(
      definition,
      next,
      { actorId: "a", optionId: RULESET_MOVE_OPTION, targetIds: [], to },
      roll,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    assert.ok(
      step.events.some((one) => one.type === "zone" && one.outcome === "detonated" && one.label === "Plainglyph"),
      JSON.stringify(step.events.filter((one) => one.type === "zone")),
    );
    assert.ok(rulesetCombatHealth(definition, definition.combat!, who(step.state, "a")).value < 100);
  }

  // ── An area that holds whoever is in it, set up "where they stand" beside a friend, goes down over
  // their foes instead (laptop 2026-10-25: a story Entangle held the whole party) ──
  {
    const entangle = spell("entangle", {
      kind: "debuff",
      area: { shape: "box", size: 20 },
      range: 90,
      cost: [{ pool: "slots_1", amount: 1 }],
      save: { save: "str_save", onSuccess: "negates" },
      applies: [{ condition: "restrained", duration: { rounds: 10 } }],
      zone: { rounds: 10, triggers: [], terrain: { difficult: true } },
    });
    const withEntangle = parsed(fiveE([...spells, entangle]));
    const mage = state.combatants.find((one) => one.id === "mage")!;
    const fresh = createRulesetEncounter({
      definition: withEntangle,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            ...mage.sheet!.build,
            lists: {
              spells: [...spells, entangle].flatMap((entry) =>
                rowsFromCatalogEntry("spells", entry).map((row) => row.row),
              ),
            },
          }),
          catalogs: { spells: [...spells, entangle] },
        },
        { id: "friend", name: "Friend", side: "party", block },
        { id: "a", name: "A", side: "enemy", block },
        { id: "b", name: "B", side: "enemy", block },
      ],
      board: {
        grid: grid(),
        placements: { mage: { x: 2, y: 7 }, friend: { x: 3, y: 7 }, a: { x: 14, y: 7 }, b: { x: 20, y: 7 } },
      },
    });
    const set = rulesetStandingAtStart(withEntangle, fresh, [{ casterId: "mage", entry: "Entangle", at: "self" }]);
    assert.deepEqual(set.skipped, []);
    const placed = (who(set.state, "mage").zones ?? []).find((zone) => zone.label === "Entangle");
    assert.deepEqual(placed?.at, { x: 14, y: 7 }, JSON.stringify(placed));
    // Alone, it would still hold its own caster.
    const alone = structuredClone(fresh);
    alone.combatants = alone.combatants.filter((one) => one.id !== "friend");
    alone.order = alone.order.filter((id) => id !== "friend");
    const lone = rulesetStandingAtStart(withEntangle, alone, [{ casterId: "mage", entry: "Entangle", at: "self" }]);
    const own = (who(lone.state, "mage").zones ?? []).find((zone) => zone.label === "Entangle");
    assert.deepEqual(own?.at, { x: 14, y: 7 }, "it holds the caster too, so it still goes over the foes");
    // Put down between them, where it would catch nobody, it goes onto the foes (laptop 2026-10-25:
    // a story Entangle a cell short of the wolves).
    const between = rulesetStandingAtStart(withEntangle, fresh, [{ casterId: "mage", entry: "Entangle" }]);
    const short = (who(between.state, "mage").zones ?? []).find((zone) => zone.label === "Entangle");
    assert.deepEqual(short?.at, { x: 14, y: 7 }, JSON.stringify(short));
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries are set up before a fight only (beforeFight) requires schemaVersion 2 and capabilityApi 1.462 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(461) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(462) as never, fiveE()), gate);
  }

  console.log(
    "Standing zones: beforeFight entries stay off the menu; set up before the fight they are paid for and put down, a hidden one unsaid, and a foe walking in sets one off; gated at 1.462.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
