/**
 * Forbiddance's choices and its bar on teleporting in (Capability API 1.753): "creatures can't
 * teleport into the area ... Choose one or more of the following: celestials, elementals, fey,
 * fiends, and undead ... the creature takes 5d10 radiant or necrotic damage (your choice when you
 * cast this spell)". And a creature of up to 16 actions (Capability API 1.754): the vampire's.
 *
 *   - `zone.forbids.teleport: "into"` bars everybody from teleporting into the zone, whoever it works
 *     on; teleporting within it or out of it stays allowed.
 *   - `kindChoice: "many"`: the kinds named as it is cast are what its zone strikes, in place of its
 *     `targetTypes`; named none, its own.
 *   - `damageTypeChoice`: the damage type, picked as a mode, that it and its zone deal; cast with none
 *     picked, the first it offers.
 *   - Set up before a fight with `kinds` and `mode`; with no mode, the first type, said.
 *   - Refusals and the install gates.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetStandingAtStart,
  rulesetTeleportCells,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zone-forbiddance-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 754);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const ward = (extra: Record<string, unknown> = {}, zone: Record<string, unknown> = {}) => ({
    kind: "attack",
    area: { shape: "burst", size: 10 },
    range: 60,
    amount: { dice: "5d10" },
    damageType: "radiant",
    damageTypeChoice: ["radiant", "necrotic"],
    kindChoice: "many",
    targetTypes: { is: { types: ["fiend", "undead"] } },
    zone: { rounds: 600, triggers: ["enter", "turn-start"], atCast: false, forbids: { teleport: "into" }, ...zone },
    ...extra,
  });
  const misty = spell("misty", "Misty", { kind: "utility", teleport: { distance: 30 } });
  const fiveE = (mechanics: Record<string, unknown> = ward()): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        spell("ward", "Ward", mechanics),
        spell("forbiddance", "Forbiddance", { ...mechanics, beforeFight: true }),
        misty,
      ],
    });
    doc.combat.creatureTypes = {
      types: ["humanoid", "fiend", "undead"].map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) })),
      default: "humanoid",
    };
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
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = (type: string): RulesetStatBlock =>
    ({ health: 60, defense: 10, initiativeModifier: 0, speed: 30, actions: [], type }) as unknown as RulesetStatBlock;
  // A d20 of 15, every other die a 3: 5d10 is 15.
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 11, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "imp", name: "Imp", side: "enemy", block: block("fiend") },
        { id: "zombie", name: "Zombie", side: "enemy", block: block("undead") },
        { id: "thug", name: "Thug", side: "enemy", block: block("humanoid") },
      ],
      board: {
        grid: { width: 16, height: 9, tiles: Array.from({ length: 9 }, () => Array(16).fill("plains")) },
        // The ward centred on (8,4) holds (6..10, 2..6): all three foes stand in it.
        placements: { cleric: { x: 2, y: 4 }, imp: { x: 8, y: 4 }, zombie: { x: 8, y: 5 }, thug: { x: 8, y: 3 } },
      },
    });
    state.order = ["cleric", "imp", "zombie", "thug"];
    state.turn = 0;
    rulesetCombatant(state, "cleric")!.budgets.action = 1;
    return state;
  };
  const wardOption = (state: RulesetEncounterState) => {
    const option = rulesetCombatOptions(definition, state, "cleric").find((one) => one.label === "Ward");
    assert.ok(option, "offered");
    return option;
  };
  const cast = (extra: Partial<RulesetCombatChoice>) => {
    const state = fight();
    const option = wardOption(state);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cleric", optionId: option.id, targetIds: [], at: { x: 8, y: 4 }, ...extra },
      roll,
    );
  };
  // Every foe's turn begun in turn, and the damage each took there.
  const struck = (from: RulesetEncounterState) => {
    let state = from;
    const taken: Record<string, string[]> = {};
    for (const id of ["cleric", "imp", "zombie", "thug"]) {
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: id, optionId: "end-turn", targetIds: [] },
        roll,
      );
      state = step.state;
      for (const event of of(step.events, "damage")) {
        (taken[event.targetId] ??= []).push(`${event.amount} ${event.damageType ?? ""}`.trim());
      }
    }
    return taken;
  };

  // ── Its choices as offered ──
  {
    const option = wardOption(fight());
    assert.deepEqual(
      option.modes?.map((mode) => [mode.id, mode.label]),
      [
        ["damage-radiant", "Radiant"],
        ["damage-necrotic", "Necrotic"],
      ],
    );
    assert.deepEqual(
      option.kindsOf?.map((kind) => kind.id),
      ["fiend", "undead"],
      "only among the kinds its targetTypes names",
    );
  }

  // ── Cast against fiends, in necrotic: only the imp is struck, in necrotic ──
  {
    const step = cast({ mode: "damage-necrotic", kinds: ["fiend"] });
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    const zone = rulesetCombatant(step.state, "cleric")!.zones![0]!;
    assert.deepEqual(zone.strikesIs, { types: ["fiend"] });
    assert.equal(zone.damageType, "necrotic");
    assert.deepEqual(struck(step.state), { imp: ["15 necrotic"] });
  }
  // ── Against both ──
  {
    const step = cast({ mode: "damage-radiant", kinds: ["fiend", "undead"] });
    assert.deepEqual(struck(step.state), { imp: ["15 radiant"], zombie: ["15 radiant"] });
  }
  // ── Named none: whom its own targetTypes say ──
  {
    const step = cast({ mode: "damage-radiant" });
    assert.equal(rulesetCombatant(step.state, "cleric")!.zones![0]!.strikesIs, undefined);
    assert.deepEqual(struck(step.state), { imp: ["15 radiant"], zombie: ["15 radiant"] });
  }
  // ── Named no damage type: the first it offers (Ruleset 0.431: a cast with none struck nobody) ──
  {
    const step = cast({});
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    assert.equal(rulesetCombatant(step.state, "cleric")!.zones![0]!.damageType, "radiant");
    assert.deepEqual(struck(step.state), { imp: ["15 radiant"], zombie: ["15 radiant"] });
  }
  // ── Refused: a type or kind it does not offer, no kind at all, one twice ──
  for (const [extra, why] of [
    [{ mode: "damage-fire" }, "a type it does not offer"],
    [{ mode: "damage-radiant", kinds: ["dragon"] }, "a kind it does not offer"],
    [{ mode: "damage-radiant", kinds: ["humanoid"] }, "a kind its targetTypes leaves out"],
    [{ mode: "damage-radiant", kinds: [] }, "no kind"],
    [{ mode: "damage-radiant", kinds: ["fiend", "fiend"] }, "one twice"],
  ] as const) {
    const step = cast(extra as Partial<RulesetCombatChoice>);
    assert.equal(of(step.events, "refused").length, 1, why);
    assert.equal(rulesetCombatant(step.state, "cleric")!.zones, undefined, why);
  }

  // ── Nobody teleports into it; within it and out of it they may ──
  {
    const { state } = cast({ mode: "damage-radiant", kinds: ["fiend"] });
    const cells = (s: RulesetEncounterState) => {
      const cleric = rulesetCombatant(s, "cleric")!;
      return new Set(
        rulesetTeleportCells(definition, s, cleric, cleric.actions.find((one) => one.label === "Misty")!.teleport!).map(
          (cell) => `${cell.x},${cell.y}`,
        ),
      );
    };
    // The cleric is no fiend, and still may not teleport in.
    const outside = cells(state);
    assert.ok(outside.has("5,4"), "beside it");
    assert.ok(!outside.has("6,4") && !outside.has("9,6") && !outside.has("10,2"), "never into it");
    const inside = structuredClone(state);
    Object.assign(rulesetCombatant(inside, "cleric")!, { x: 10, y: 4 });
    const from = cells(inside);
    assert.ok(from.has("9,4") && from.has("6,6"), "within it");
    assert.ok(from.has("13,4"), "and out of it");
  }

  // ── Set up before a fight: its kinds and its damage type as named ──
  {
    const stood = rulesetStandingAtStart(definition, fight(), [
      { casterId: "cleric", entry: "Forbiddance", at: "between", kinds: ["Undead"], mode: "necrotic" },
    ]);
    assert.deepEqual(stood.skipped, []);
    const zone = rulesetCombatant(stood.state, "cleric")!.zones![0]!;
    assert.deepEqual(zone.strikesIs, { types: ["undead"] });
    assert.equal(zone.damageType, "necrotic");
    assert.equal(zone.label, "Forbiddance");
  }
  // ── With no damage type named, the first, and said; a kind it cannot strike, said ──
  {
    const stood = rulesetStandingAtStart(definition, fight(), [
      { casterId: "cleric", entry: "Forbiddance", at: "between", kinds: ["Fiend", "Humanoid"] },
    ]);
    assert.match(stood.skipped.join(" "), /Forbiddance was given no damage type, so it deals radiant/);
    assert.match(stood.skipped.join(" "), /cannot be set against "Humanoid"/);
    const zone = rulesetCombatant(stood.state, "cleric")!.zones![0]!;
    assert.equal(zone.damageType, "radiant");
    assert.deepEqual(zone.strikesIs, { types: ["fiend"] });
  }

  // ── A creature of up to 16 actions (1.754) ──
  const creature = (count: number) => {
    const doc = fiveE();
    const bestiary = doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures");
    const first = structuredClone(bestiary.entries[0]);
    const action = first.creature.actions[0];
    first.id = "many-armed";
    first.label = "Many-armed";
    first.creature.actions = Array.from({ length: count }, (_, index) => ({
      ...action,
      id: `strike_${index}`,
      name: `Strike ${index}`,
    }));
    delete first.creature.sequences;
    bestiary.entries.push(first);
    return doc;
  };
  parsed(creature(16));
  refused(creature(17), /16/);

  // ── Refusals ──
  refused(fiveE(ward({ zone: undefined })), /"kindChoice": "many" goes with "zone"/);
  refused(fiveE(ward({ damageTypeChoice: ["radiant", "gloom"] })), /Unknown damage type "gloom"/);
  refused(fiveE(ward({ damageTypeChoice: ["radiant", "Radiant"] })), /named twice/);
  refused(fiveE(ward({ kindChoice: true })), /"damageTypeChoice" is picked as a mode/);
  refused(fiveE(ward({}, { forbids: { teleport: "out" } })), /teleport/);

  // ── The install gates ──
  {
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
    const gate =
      'A ruleset with a zone nobody teleports into (forbids.teleport "into"), kinds its zone strikes named as it is cast (kindChoice "many") or a damage type named as it is cast (damageTypeChoice) requires schemaVersion 2 and capabilityApi 1.753 or newer';
    const { damageTypeChoice: _type, kindChoice: _kinds, ...plain } = ward();
    assert.equal(getCapabilityPackageInstallIssue(manifest(752) as never, fiveE()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(752) as never, fiveE(ward({ damageTypeChoice: undefined }))),
      gate,
      "the kinds alone",
    );
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(752) as never, fiveE(ward({ kindChoice: undefined }))),
      gate,
      "the damage type alone",
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(752) as never, fiveE(plain)), gate, "teleporting in alone");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(753) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(752) as never, JSON.parse(fiveEText)), gate);
    const many =
      "A ruleset with a creature of more than 12 actions requires schemaVersion 2 and capabilityApi 1.754 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(753) as never, creature(13)), many);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(754) as never, creature(13)), many);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(753) as never, creature(12)), many);
  }

  console.log(
    "Forbiddance: nobody teleports into its ward, within and out of it they may; it strikes the kinds named as it is cast (its own when none), in the damage type picked as a mode, cast or set up beforehand; gated at 1.753; a creature of 16 actions at 1.754.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
