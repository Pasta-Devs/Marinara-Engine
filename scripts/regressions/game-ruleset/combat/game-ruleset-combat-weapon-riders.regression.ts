/**
 * Weapon riders and areas that catch everybody (Capability API 1.192).
 *
 *   - An item attack's `ignoresResistance`: a vorpal sword's slashing through resistance, resistance to
 *     everything included, while a clause of another kind is still halved.
 *   - A slay's `saved`: a mace of disruption's fiend or undead that makes the save is frightened of the
 *     wielder instead, on the wielder's clock.
 *   - `othersWhileMarked`: while an oathbow's sworn enemy stands, every other weapon rolls with
 *     disadvantage, or only the ranged ones.
 *   - Off a board, an area names people on either side unless it spares its own.
 *   - Import refusals, and the install gate.
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
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-weapon-riders-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 187);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.sheet.live.conditions.push({ id: "sworn", label: "Sworn" }, { id: "stoneskin", label: "Stoneskin" });
    doc.combat.conditions.push({ condition: "sworn" }, { condition: "stoneskin", effects: ["resist-all"] });
    doc.combat.creatureTypes = {
      types: ["humanoid", "undead", "fiend"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const burst = spell("burst", {
    kind: "attack",
    range: 60,
    area: { shape: "burst", size: 10 },
    amount: { flat: 3 },
    damageType: "fire",
    save: { save: "dex_save", onSuccess: "half" },
  });
  const careful = spell("careful", {
    kind: "attack",
    range: 60,
    area: { shape: "burst", size: 10 },
    friendlyFire: false,
    amount: { flat: 3 },
    damageType: "fire",
    save: { save: "dex_save", onSuccess: "half" },
  });
  const bolt = spell("bolt", { kind: "attack", attackRoll: true, range: 120, amount: { flat: 3 }, damageType: "fire" });
  const spells = [burst, careful, bolt];
  const definition = parse(
    document((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    }),
  );
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 18, con: 10, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 100, spellcasting_ability: "wis", slots_max_1: 9 },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const weapon = (name: string, attack: Record<string, unknown>) =>
    ({
      name,
      quantity: 1,
      worn: true,
      item: {
        category: "gear",
        slots: { hands: 1 },
        attack: {
          budget: "action",
          toHit: { abilities: ["str"] },
          damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
          ...attack,
        },
      } as RulesetCatalogItem,
    }) as RulesetSheetItem;
  const vorpal = weapon("Vorpal", { ignoresResistance: true, plus: [{ dice: "1d6", type: "fire" }] });
  const plain = weapon("Plain", { plus: [{ dice: "1d6", type: "fire" }] });
  const disruption = weapon("Disruption", {
    damage: { dice: "1d6", abilities: ["str"], type: "bludgeoning" },
    slay: [
      {
        is: { types: ["undead", "fiend"] },
        healthAtMost: 1000,
        save: { save: "wis_save", difficulty: 15 },
        saved: [{ condition: "frightened", duration: { rounds: 1, of: "source" } }],
      },
    ],
  });
  const ranged = {
    toHit: { abilities: ["dex"] },
    damage: { dice: "1d8", abilities: ["dex"], type: "piercing" },
    range: { normal: 150, long: 600 },
  };
  const oathbow = weapon("Oathbow", {
    ...ranged,
    othersWhileMarked: { condition: "sworn", mode: "disadvantage" },
  });
  const pickyBow = weapon("Picky bow", {
    ...ranged,
    othersWhileMarked: { condition: "sworn", mode: "disadvantage", ranged: true },
  });
  const longbow = weapon("Longbow", ranged);
  const sword = weapon("Sword", {});
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 200,
      defense: 5,
      initiativeModifier: -20,
      saves: { wis_save: -20, dex_save: 0 },
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 5, damage: { count: 1, sides: 4, flat: 0 } }],
      ...extra,
    }) as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 30,
    height: 10,
    tiles: Array.from({ length: 10 }, () => Array(30).fill("plains")),
  });
  const roller = (sides: number) => (sides === 20 ? 10 : 2);
  const fight = (items: RulesetSheetItem[], foes: Record<string, Partial<RulesetStatBlock>> = { foe: {} }) => {
    const placements: Record<string, { x: number; y: number }> = { hero: { x: 2, y: 5 } };
    Object.keys(foes).forEach((id, index) => (placements[id] = { x: 3, y: 5 - index }));
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, items, catalogs: { spells } },
        ...Object.entries(foes).map(([id, extra]) => ({ id, name: id, side: "enemy" as const, block: block(extra) })),
      ],
      board: { grid: grid(), placements },
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const optionOf = (state: RulesetEncounterState, actor: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actor).find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return option;
  };
  const act = (state: RulesetEncounterState, label: string, target = "foe") => {
    who(state, "hero").budgets.action = 1;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: optionOf(state, "hero", label).id, targetIds: [target] },
      roller,
    );
    Object.assign(state, step.state);
    return step.events;
  };
  const damageOf = (events: RulesetCombatEvent[], type: string) =>
    events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage")
      .filter((one) => one.damageType === type)
      .reduce((total, one) => total + one.dealt, 0);
  const modeOf = (events: RulesetCombatEvent[]) => {
    const event = events.find((one) => one.type === "attack");
    assert.ok(event && event.type === "attack");
    return event.mode;
  };
  const tracked = (state: RulesetEncounterState, id: string, condition: string) =>
    who(state, id).tracked.find((entry) => entry.condition === condition);

  // ── A vorpal sword: slashing through resistance ──
  {
    const resists = { resist: ["slashing", "fire"] };
    // 2 on the d8, +4 Strength; 2 on the d6 of fire.
    assert.equal(damageOf(act(fight([plain], { foe: resists }), "Plain"), "slashing"), 3, "halved");
    const cut = act(fight([vorpal], { foe: resists }), "Vorpal");
    assert.equal(damageOf(cut, "slashing"), 6, "whole");
    assert.equal(damageOf(cut, "fire"), 1, "its fire is still halved");
    const stone = fight([vorpal]);
    who(stone, "foe").tracked.push({ condition: "stoneskin", rounds: null });
    assert.equal(damageOf(act(stone, "Vorpal"), "slashing"), 6, "resistance to everything too");
    const stonePlain = fight([plain]);
    who(stonePlain, "foe").tracked.push({ condition: "stoneskin", rounds: null });
    assert.equal(damageOf(act(stonePlain, "Plain"), "slashing"), 3);
    // Immunity is not resistance.
    assert.equal(damageOf(act(fight([vorpal], { foe: { immune: ["slashing"] } }), "Vorpal"), "slashing"), 0);
  }

  // ── A mace of disruption: a made save frightens instead ──
  {
    const saves = fight([disruption], { foe: { type: "undead", saves: { wis_save: 20 } } });
    const events = act(saves, "Disruption");
    assert.ok(!events.some((one) => one.type === "defeated"), "spared");
    const fright = tracked(saves, "foe", "frightened");
    assert.ok(fright, "frightened instead");
    assert.equal(fright.source, "hero", "of the wielder");
    assert.equal(fright.clockOf, "source", "on the wielder's clock");
    assert.equal(fright.rounds, 2, "to the end of the wielder's next turn");
    // A save that would end it early is rolled against the slay's own number, and against the mace.
    assert.equal(fright.difficulty, 15);
    assert.deepEqual(fright.action, ["item:0", "Disruption"]);
    const fails = fight([disruption], { foe: { type: "undead" } });
    assert.ok(
      act(fails, "Disruption").some((one) => one.type === "defeated" && one.actorId === "foe"),
      "destroyed",
    );
    assert.equal(tracked(fails, "foe", "frightened"), undefined, "and nothing else");
    const beast = fight([disruption], { foe: { saves: { wis_save: 20 } } });
    act(beast, "Disruption");
    assert.equal(tracked(beast, "foe", "frightened"), undefined, "not one it could destroy");
  }

  // ── An oathbow: every other weapon, while the sworn enemy stands ──
  {
    // A bow is shot from afar: next to a foe it would roll with disadvantage anyway.
    const away = (state: RulesetEncounterState) => {
      who(state, "foe").x = 8;
      who(state, "other").x = 8;
      return state;
    };
    const marked = (items: RulesetSheetItem[], far = false) => {
      const state = fight(items, { foe: {}, other: {} });
      who(state, "foe").tracked.push({ condition: "sworn", source: "hero", rounds: null });
      return far ? away(state) : state;
    };
    assert.equal(modeOf(act(marked([oathbow, sword]), "Sword", "other")), "disadvantage", "a sword");
    assert.equal(modeOf(act(marked([oathbow, longbow], true), "Longbow", "other")), "disadvantage", "a bow");
    assert.equal(modeOf(act(away(fight([oathbow, longbow], { foe: {}, other: {} })), "Longbow", "other")), "normal");
    assert.equal(modeOf(act(marked([oathbow, sword]), "Sword", "foe")), "disadvantage", "even at the sworn");
    assert.equal(modeOf(act(marked([oathbow], true), "Oathbow", "other")), "normal", "not the oathbow itself");
    assert.equal(modeOf(act(fight([oathbow, sword], { foe: {}, other: {} }), "Sword", "other")), "normal", "unsworn");
    // A spell is no weapon.
    assert.equal(modeOf(act(marked([oathbow], true), "Bolt", "other")), "normal", "a spell attack");
    // Gone, it frees the rest.
    const slain = marked([oathbow, sword]);
    who(slain, "foe").defeated = true;
    assert.equal(modeOf(act(slain, "Sword", "other")), "normal", "the sworn enemy fell");
    // Somebody else's mark is not the wielder's.
    const theirs = fight([oathbow, sword], { foe: {}, other: {} });
    who(theirs, "foe").tracked.push({ condition: "sworn", source: "somebody", rounds: null });
    assert.equal(modeOf(act(theirs, "Sword", "other")), "normal");
    // Only the ranged ones.
    assert.equal(modeOf(act(marked([pickyBow, sword]), "Sword", "other")), "normal", "a sword is not ranged");
    assert.equal(modeOf(act(marked([pickyBow, longbow], true), "Longbow", "other")), "disadvantage");
  }

  // ── Off a board, an area names either side ──
  {
    const breath = { id: "breath", name: "Breath", budget: "action", area: { shape: "cone", size: 15 } };
    const offBoard = (friendlyFire?: boolean) => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller,
        bestiary: { spells },
        combatants: [
          { id: "hero", name: "Hero", side: "party", build, catalogs: { spells } },
          { id: "friend", name: "Friend", side: "party", build },
          {
            id: "dragon",
            name: "Dragon",
            side: "enemy",
            block: block({
              actions: [
                {
                  ...breath,
                  area: { ...breath.area, ...(friendlyFire === undefined ? {} : { friendlyFire }) },
                  save: { save: "dex_save", difficulty: 15, onSuccess: "half" },
                  damage: { count: 2, sides: 6, flat: 0, type: "fire" },
                  targetCount: 3,
                } as never,
              ],
            }),
          },
          { id: "kobold", name: "Kobold", side: "enemy", block: block() },
        ],
      });
      return state;
    };
    const targetsOf = (state: RulesetEncounterState, actor: string, label: string) => {
      state.turn = state.order.indexOf(actor);
      return rulesetOptionTargets(definition, state, actor, optionOf(state, actor, label)).sort();
    };
    assert.deepEqual(targetsOf(offBoard(), "dragon", "Breath"), ["friend", "hero", "kobold"], "its own kobold too");
    assert.deepEqual(targetsOf(offBoard(false), "dragon", "Breath"), ["friend", "hero"], "unless it spares them");
    const breathed = offBoard();
    breathed.turn = breathed.order.indexOf("dragon");
    const step = applyRulesetCombatChoice(
      definition,
      breathed,
      { actorId: "dragon", optionId: "breath", targetIds: ["hero", "kobold"] },
      roller,
    );
    assert.ok(
      step.events.some((one) => one.type === "damage" && one.targetId === "kobold"),
      "and it lands",
    );
    assert.deepEqual(
      targetsOf(offBoard(), "hero", "Burst"),
      ["dragon", "friend", "kobold"],
      "a spell too, never its caster",
    );
    assert.deepEqual(targetsOf(offBoard(), "hero", "Careful"), ["dragon", "kobold"]);
  }

  // ── Refusals ──
  {
    const withItem = (attack: Record<string, unknown>) =>
      document((doc) => {
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          entries: [{ id: "w", label: "W", item: weapon("W", attack).item }],
        });
      });
    refused(
      withItem({ slay: [{ healthAtMost: 5, saved: [{ condition: "frightened", duration: "instant" }] }] }),
      /needs a "save" to make/,
    );
    refused(
      withItem({
        slay: [
          {
            healthAtMost: 5,
            save: { save: "wis_save", difficulty: 15 },
            saved: [{ condition: "awed", duration: "instant" }],
          },
        ],
      }),
      /Unknown condition "awed"/,
    );
    refused(withItem({ othersWhileMarked: { condition: "vowed", mode: "disadvantage" } }), /Unknown condition "vowed"/);
    refused(
      document((doc) => {
        doc.combat.attackRoll.advantage = false;
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          entries: [
            {
              id: "w",
              label: "W",
              item: weapon("W", { othersWhileMarked: { condition: "sworn", mode: "disadvantage" } }).item,
            },
          ],
        });
      }),
      /never rolls twice/,
    );
  }

  // ── The gate ──
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
      "A ruleset with weapons that ignore resistance, slays that frighten on a made save, or weapons that hinder their wielder's others while a mark stands requires schemaVersion 2 and capabilityApi 1.192 or newer";
    const withItem = (attack: Record<string, unknown>) => {
      const doc = JSON.parse(fiveE);
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [{ id: "w", label: "W", item: weapon("W", attack).item }],
      });
      return doc;
    };
    for (const [label, doc] of [
      ["ignores resistance", withItem({ ignoresResistance: true })],
      [
        "saved",
        withItem({
          slay: [
            {
              healthAtMost: 5,
              save: { save: "wis_save", difficulty: 15 },
              saved: [{ condition: "frightened", duration: "instant" }],
            },
          ],
        }),
      ],
      ["others while marked", withItem({ othersWhileMarked: { condition: "poisoned", mode: "disadvantage" } })],
    ] as const) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(191) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(192) as never, doc), gate, label);
    }
    // A 1.187 slay is not this minor's.
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(191) as never,
        withItem({ slay: [{ healthAtMost: 5, save: { save: "wis_save", difficulty: 15 } }] }),
      ),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(191) as never, JSON.parse(fiveE)), gate, "plain 5e");
  }

  console.log(
    "Ruleset weapon riders: a vorpal sword cuts through resistance, a mace of disruption frightens what it fails to destroy, an oathbow hinders its wielder's other weapons while its sworn enemy stands, and off a board an area may catch either side.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
