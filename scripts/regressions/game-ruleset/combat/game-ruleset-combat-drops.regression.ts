/**
 * More forced behavior (Capability API 1.266).
 *
 *   - `behavior.drops`: Fear's "drops whatever it is holding" as the condition goes on (a sheet's
 *     worn items in a hand, a shield's share of its defense with them), and Command's "drop" as the
 *     holder's turn starts (a stat block's actions carrying a tag); what fell is picked up from where
 *     it lies, once a turn for nothing or for the budget named, and does nothing until it is.
 *   - `onlyWhenStuck: "any"`: a turn that starts with nowhere to walk is its holder's own.
 *   - `saveEnds.unseen`: Fear's save, rolled only out of the caster's line of sight.
 *   - `behavior.keepsOut`: Turn Undead's "can't willingly move to a space within 30 feet of you".
 *   - `applies.destroysUpTo`: Destroy Undead, by threat tier and the caster's level.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_MOVE_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetDefenseAgainst,
  rulesetOpportunityAttack,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import { rulesetOptionLabel } from "../../../../packages/client/src/lib/ruleset-combat-menu.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-drops-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 261);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const conditionsOf = (doc: Record<string, any>, id: string) =>
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === id);
  const turnSpell = {
    id: "turn",
    label: "Turn",
    rows: [{ list: "spells", values: { name: "Turn", level: 0, prepared: true } }],
    mechanics: {
      kind: "debuff",
      range: 60,
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [
        {
          condition: "kept",
          duration: { rounds: 10 },
          destroysUpTo: [{ tier: "cr_1_4" }, { tier: "cr_1", when: { value: { field: "level" }, atLeast: 8 } }],
        },
      ],
    },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = {
      categories: [
        { id: "weapon", label: "Weapon" },
        { id: "shield", label: "Shield" },
        { id: "gear", label: "Gear" },
      ],
      tags: [{ id: "held", label: "Held" }],
      stats: [{ id: "ac_bonus", label: "AC bonus", type: "number", min: 0, max: 10 }],
      slots: [{ id: "hands", label: "Hands", count: 2 }],
    };
    // Defense is what is worn: the shield's 2 and the cloak's 1.
    doc.combat.defense = { itemStat: { from: "worn", pick: "sum", stat: "ac_bonus", default: 0 } };
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [structuredClone(turnSpell)] });
    for (const [id, label] of [
      ["afraid", "Frightened (Fear)"],
      ["dropping", "Commanded: Drop"],
      ["kept", "Turned"],
      ["kept_loose", "Kept off"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      {
        condition: "afraid",
        effects: [],
        behavior: {
          only: ["move", "dash"],
          moves: "away",
          onlyWhenStuck: "any",
          drops: { slots: ["hands"], at: "applied" },
        },
      },
      {
        condition: "dropping",
        effects: [],
        behavior: { only: [], drops: { tags: ["held"], at: "turn-start", pickUp: "action" } },
      },
      { condition: "kept", effects: [], behavior: { only: ["move", "dash"], moves: "away", keepsOut: 30 } },
      { condition: "kept_loose", effects: [], behavior: { only: ["move"], keepsOut: 30 } },
    );
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
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
  const definition = parsed(document());
  const combat = definition.combat!;
  const spells = definition.catalogs!.find((entry) => entry.id === "spells")!.entries!;
  const buildAt = (level: number) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 14, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
      fields: { level, ac: 14, speed: 30, hp_max: 40, spellcasting_ability: "wis" },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  const held = (name: string, item: Record<string, unknown>): RulesetSheetItem =>
    ({ item: item as unknown as RulesetCatalogItem, quantity: 1, worn: true, name }) as RulesetSheetItem;
  const sword = held("Longsword", {
    category: "weapon",
    slots: { hands: 1 },
    attack: {
      budget: "action",
      toHit: { abilities: ["str"] },
      damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
    },
  });
  const shield = held("Shield", {
    category: "shield",
    slots: { hands: 1 },
    stats: { ac_bonus: 2 },
    worn: { modifiers: [{ to: "defense", flat: 1 }] },
  });
  // A dagger in the pack, not in a hand, stays put; a wand in a hand falls with its use.
  const dagger = { ...held("Dagger", { category: "weapon", slots: { hands: 1 } }), worn: false };
  const wand = held("Wand", {
    category: "gear",
    slots: { hands: 1 },
    use: {
      kind: "attack",
      budget: "action",
      range: 20,
      attackRoll: true,
      toHit: { abilities: ["dex"] },
      amount: { dice: "1d6" },
      damageType: "fire",
    },
  });
  const cloak = held("Cloak", { category: "gear", stats: { ac_bonus: 1 } });
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    saves: { wis_save: 0 },
    actions: [
      { name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } },
      { name: "Sword", budget: "action", toHit: 4, damage: { count: 2, sides: 6, flat: 0 }, qualities: ["held"] },
      {
        name: "Scare",
        budget: "action",
        range: 60,
        save: { save: "wis_save", difficulty: 30, onSuccess: "negates" },
        applies: [
          {
            condition: "afraid",
            duration: "until-save",
            saveEnds: { save: "wis_save", at: "turn-end", unseen: true },
          },
        ],
      },
    ],
    ...extra,
  });
  // Faces by die size, then 10 for anything left.
  let faces: Record<number, number[]> = {};
  const roll = (sides: number) => faces[sides]?.shift() ?? 10;
  const row = (width: number, walls: number[] = [], height = 1) => ({
    width,
    height,
    tiles: Array.from({ length: height }, () =>
      Array.from({ length: width }, (_, x) => (walls.includes(x) ? "wall" : "plains")),
    ),
    elevation: Array.from({ length: height }, () => Array(width).fill(0)),
  });
  const fight = (
    places: Record<string, number | { x: number; y: number }>,
    options: {
      walls?: number[];
      level?: number;
      foes?: Record<string, Partial<RulesetStatBlock>>;
      width?: number;
      height?: number;
    } = {},
  ): RulesetEncounterState => {
    const foes = options.foes ?? { foe: {} };
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: buildAt(options.level ?? 5),
          live: {},
          items: [sword, shield, cloak, dagger, wand],
          catalogs: { spells },
        },
        ...Object.entries(foes).map(([id, extra]) => ({
          id,
          name: id,
          side: "enemy" as const,
          block: block(extra),
        })),
      ],
      board: {
        grid: row(options.width ?? 12, options.walls, options.height) as never,
        placements: Object.fromEntries(
          Object.entries(places).map(([id, at]) => [id, typeof at === "number" ? { x: at, y: 0 } : at]),
        ),
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const step = (state: RulesetEncounterState, choice: RulesetCombatChoice) =>
    applyRulesetCombatChoice(definition, state, choice, roll);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const done = step(state, choice);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const refusedAs = (state: RulesetEncounterState, choice: RulesetCombatChoice) =>
    of(step(state, choice).events, "refused")[0]?.reason;
  const menu = (state: RulesetEncounterState, id: string) => rulesetCombatOptions(definition, state, id);
  const ids = (state: RulesetEncounterState, id: string) => menu(state, id).map((option) => option.id);
  const optionNamed = (state: RulesetEncounterState, id: string, label: string) =>
    menu(state, id).find((option) => option.label === label);
  const defenseOf = (state: RulesetEncounterState, id: string) =>
    rulesetDefenseAgainst(definition, combat, state, who(state, id), undefined).defense;
  const cellsOf = (state: RulesetEncounterState, id: string) =>
    menu(state, id)
      .find((option) => option.id === RULESET_MOVE_OPTION)
      ?.cells?.map((cell) => cell.x)
      .sort((a, b) => a - b) ?? [];
  /** The foe scares the hero, from the foe's own turn. */
  const scared = (state: RulesetEncounterState) => {
    state.turn = state.order.indexOf("foe");
    const scare = optionNamed(state, "foe", "Scare")!;
    return act(state, { actorId: "foe", optionId: scare.id, targetIds: ["hero"] });
  };

  // ── Fear: what is in the hands falls as it lands; a shield's defense goes with it ──
  {
    const state = fight({ hero: 2, foe: 6 });
    // The shield's 2 and what it does while worn, 1, beside the cloak's 1.
    assert.equal(defenseOf(state, "hero"), 4);
    assert.deepEqual(who(state, "hero").heldDefense, { 1: 2 });
    assert.ok(ids(state, "hero").includes("use:4"), ids(state, "hero").join(", "));
    const done = scared(state);
    assert.ok(has(done.state, "hero", "afraid"));
    const fell = of(done.events, "letFall");
    assert.equal(fell.length, 1);
    assert.deepEqual(fell[0]!.labels, ["Longsword", "Shield", "Wand"], "the cloak is in no hand, the dagger packed");
    assert.equal(fell[0]!.condition, "afraid");
    assert.deepEqual(
      who(done.state, "hero").dropped?.map((thing) => [thing.key, thing.at?.x]),
      [
        ["item:0", 2],
        ["item:1", 2],
        ["item:4", 2],
      ],
    );
    assert.equal(defenseOf(done.state, "hero"), 1, "the shield's 3 lies on the ground");
    // Freed of the fear, nothing dropped is theirs but to pick up.
    const calm = fight({ hero: 2, foe: 6 });
    who(calm, "hero").dropped = structuredClone(who(done.state, "hero").dropped);
    const calmIds = ids(calm, "hero");
    assert.equal(calmIds.includes("use:4") || calmIds.includes("item:0"), false, calmIds.join(", "));
    assert.equal(refusedAs(calm, { actorId: "hero", optionId: "use:4", targetIds: ["foe"] }), "dropped");
    assert.ok(calmIds.includes("pickup:item:4"), calmIds.join(", "));
    // The hero's own turn, in the open with the foe in sight: only away, no pick-up, no sword.
    const hero = act(done.state, { actorId: "foe", optionId: "end-turn", targetIds: [] }).state;
    assert.equal(who(hero, "hero").flags.stuck, false);
    assert.deepEqual(ids(hero, "hero").sort(), [RULESET_MOVE_OPTION, "end-turn", "standard:dash"].sort());
    assert.equal(refusedAs(hero, { actorId: "hero", optionId: "item:0", targetIds: ["foe"] }), "dropped");
    // Seen by the foe, the turn-end save is not rolled.
    const ended = act(hero, { actorId: "hero", optionId: "end-turn", targetIds: [] });
    assert.equal(
      of(ended.events, "save").filter((one) => one.actorId === "hero").length,
      0,
      "no save in the caster's sight",
    );
    assert.ok(has(ended.state, "hero", "afraid"));
    // Nobody on the ground strikes in passing with a dropped weapon either.
    assert.equal(rulesetOpportunityAttack(who(ended.state, "hero")), null);
  }

  // ── Fear, cornered out of sight: the turn is the hero's own; one free pick-up; the save rolls ──
  {
    const state = fight({ hero: 1, foe: 6 }, { walls: [0, 2] });
    // Out of sight behind the wall, the foe cannot scare it: put it on as if it had.
    const open = fight({ hero: 1, foe: 6 });
    const done = scared(open);
    const hero = who(state, "hero");
    hero.tracked = structuredClone(who(done.state, "hero").tracked);
    hero.dropped = structuredClone(who(done.state, "hero").dropped);
    state.turn = state.order.indexOf("foe");
    const turn = act(state, { actorId: "foe", optionId: "end-turn", targetIds: [] }).state;
    assert.equal(who(turn, "hero").flags.stuck, true);
    const offered = ids(turn, "hero");
    assert.ok(offered.includes("pickup:item:0") && offered.includes("pickup:item:1"), offered.join(", "));
    assert.ok(offered.includes("standard:dodge"), "its turn is free");
    const pick = menu(turn, "hero").find((option) => option.id === "pickup:item:1")!;
    assert.equal(pick.kind, "item");
    assert.equal(pick.pickUp, true);
    assert.equal(pick.label, "Shield");
    assert.equal(pick.budget, undefined);
    const t = ((key: string, values: any) => `${key}:${values.item}`) as any;
    assert.equal(rulesetOptionLabel(pick as never, t), "game.combat.ruleset.menu.pickUp:Shield");
    const picked = act(turn, { actorId: "hero", optionId: "pickup:item:1", targetIds: [] });
    assert.deepEqual(of(picked.events, "pickedUp"), [{ type: "pickedUp", actorId: "hero", label: "Shield" }]);
    assert.equal(defenseOf(picked.state, "hero"), 4);
    assert.deepEqual(
      who(picked.state, "hero").dropped?.map((thing) => thing.key),
      ["item:0", "item:4"],
    );
    assert.equal(ids(picked.state, "hero").includes("pickup:item:0"), false, "one free pick-up a turn");
    assert.equal(refusedAs(picked.state, { actorId: "hero", optionId: "pickup:item:0", targetIds: [] }), "no-budget");
    // Out of the foe's sight, the save is rolled as the turn ends, and a 10 against 30 fails.
    const ended = act(picked.state, { actorId: "hero", optionId: "end-turn", targetIds: [] });
    assert.equal(of(ended.events, "save").filter((one) => one.actorId === "hero").length, 1);
  }

  // ── Command: drop, as the holder's turn starts; picking up costs the action, from where it lies ──
  {
    const state = fight({ hero: 2, foe: 4 });
    who(state, "foe").tracked.push({ condition: "dropping", rounds: 1, source: "hero" });
    assert.equal(rulesetOpportunityAttack(who(state, "foe"))?.label, "Sword");
    const turn = act(state, { actorId: "hero", optionId: "end-turn", targetIds: [] });
    const fell = of(turn.events, "letFall");
    assert.deepEqual(
      fell.map((one) => one.labels),
      [["Sword"]],
    );
    assert.deepEqual(ids(turn.state, "foe"), ["end-turn"]);
    assert.equal(rulesetOpportunityAttack(who(turn.state, "foe"))?.label, "Claw");
    // Once Command has run out, the sword is still on the floor.
    const later = structuredClone(turn.state);
    who(later, "foe").tracked = [];
    const sword = who(later, "foe").actions.find((one) => one.label === "Sword")!;
    assert.equal(ids(later, "foe").includes(sword.id), false);
    assert.equal(refusedAs(later, { actorId: "foe", optionId: sword.id, targetIds: ["hero"] }), "dropped");
    const pick = menu(later, "foe").find((option) => option.pickUp)!;
    assert.equal(pick.id, `pickup:${sword.id}`);
    assert.equal(pick.budget, "action");
    // Walked off, it is not in reach.
    const away = structuredClone(later);
    who(away, "foe").x = 7;
    assert.equal(
      menu(away, "foe").some((option) => option.pickUp),
      false,
    );
    assert.equal(refusedAs(away, { actorId: "foe", optionId: pick.id, targetIds: [] }), "unreachable");
    const beside = structuredClone(later);
    who(beside, "foe").x = 5;
    assert.ok(menu(beside, "foe").some((option) => option.pickUp));
    const picked = act(later, { actorId: "foe", optionId: pick.id, targetIds: [] });
    assert.equal(who(picked.state, "foe").dropped, undefined);
    assert.equal(who(picked.state, "foe").budgets.action, 0, "the action paid for it");
    assert.equal(rulesetOpportunityAttack(who(picked.state, "foe"))?.label, "Sword");
    // Nothing tagged to drop, nothing falls.
    const bare = fight({ hero: 2, foe: 4 }, { foes: { foe: { actions: [block().actions[0]!] } } });
    who(bare, "foe").tracked.push({ condition: "dropping", rounds: 1, source: "hero" });
    assert.deepEqual(of(act(bare, { actorId: "hero", optionId: "end-turn", targetIds: [] }).events, "letFall"), []);
  }

  // ── Kept out of 30 feet: only somewhere past the ring while there is anywhere past it ──
  {
    const state = fight({ hero: 0, foe: 2 });
    who(state, "foe").tracked.push({ condition: "kept", rounds: 10, source: "hero" });
    state.turn = 1;
    assert.deepEqual(cellsOf(state, "foe"), [7, 8]);
    assert.equal(
      refusedAs(state, { actorId: "foe", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 0 } }),
      "unreachable",
    );
    // Nowhere past the ring in reach: anywhere further off.
    const slow = fight({ hero: 0, foe: 2 }, { foes: { foe: { speed: 10 } } });
    who(slow, "foe").tracked.push({ condition: "kept", rounds: 10, source: "hero" });
    slow.turn = 1;
    assert.deepEqual(cellsOf(slow, "foe"), [3, 4]);
    // Without "away": no step nearer while inside the ring, and it ends past it.
    const loose = fight({ hero: 0, foe: 3 });
    who(loose, "foe").tracked.push({ condition: "kept_loose", rounds: 10, source: "hero" });
    loose.turn = 1;
    assert.deepEqual(cellsOf(loose, "foe"), [7, 8, 9]);
    const inside = fight({ hero: 3, foe: 4 }, { width: 8, walls: [7] });
    who(inside, "foe").tracked.push({ condition: "kept_loose", rounds: 10, source: "hero" });
    inside.turn = 1;
    assert.deepEqual(cellsOf(inside, "foe"), [5, 6], "nowhere past the ring: still only further off");
    // On open ground with nowhere past the ring, never a step that is not further off.
    const wide = fight({ hero: { x: 5, y: 1 }, foe: { x: 6, y: 1 } }, { height: 3 });
    who(wide, "foe").tracked.push({ condition: "kept_loose", rounds: 10, source: "hero" });
    wide.turn = 1;
    const spots = menu(wide, "foe").find((option) => option.id === RULESET_MOVE_OPTION)!.cells!;
    assert.ok(spots.length > 0 && spots.every((cell) => cell.x > 6), JSON.stringify(spots));
  }

  // ── Destroy Undead: by threat tier, read off the caster's level ──
  {
    const cast = (level: number, tier: string | undefined, save?: number) => {
      const state = fight({ hero: 0, foe: 3 }, { level, foes: { foe: tier ? { tier } : {} } });
      if (save !== undefined) faces = { 20: [save] };
      const option = optionNamed(state, "hero", "Turn")!;
      return act(state, { actorId: "hero", optionId: option.id, targetIds: ["foe"] });
    };
    const small = cast(5, "cr_1_4");
    assert.deepEqual(
      of(small.events, "slain").map((one) => [one.targetId, one.label]),
      [["foe", "Turn"]],
    );
    assert.equal(who(small.state, "foe").defeated, true);
    assert.equal(has(small.state, "foe", "kept"), false);
    const bigger = cast(5, "cr_1");
    assert.deepEqual(of(bigger.events, "slain"), []);
    assert.ok(has(bigger.state, "foe", "kept"));
    assert.equal(of(cast(8, "cr_1").events, "slain").length, 1, "at 8th level, CR 1 too");
    assert.deepEqual(of(cast(8, "cr_2").events, "slain"), []);
    assert.deepEqual(of(cast(8, undefined).events, "slain"), [], "no tier, never destroyed");
    // A made save destroys nothing.
    const saved = cast(8, "cr_1_4", 20);
    faces = {};
    assert.deepEqual(of(saved.events, "slain"), []);
    assert.equal(who(saved.state, "foe").defeated, false);
  }

  // ── Import ──
  {
    refused(
      document((doc) => (conditionsOf(doc, "afraid").behavior.drops.slots = ["tail"])),
      /Unknown slot "tail"/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "dropping").behavior.drops.tags = ["nope"])),
      /Unknown item tag "nope"/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "dropping").behavior.drops.pickUp = "free_hand")),
      /Unknown budget "free_hand"/,
    );
    refused(
      document((doc) => delete conditionsOf(doc, "dropping").behavior.drops.tags),
      /"drops" names "slots", "tags" or both/,
    );
    refused(
      document((doc) => (doc.catalogs.at(-1).entries[0].mechanics.applies[0].destroysUpTo[0].tier = "cr_99")),
      /Unknown threat tier "cr_99"/,
    );
    refused(
      document(
        (doc) => (doc.catalogs.at(-1).entries[0].mechanics.applies[0].destroysUpTo[1].when.value = { field: "nope" }),
      ),
      /nope/,
    );
    refused(
      document((doc) => delete doc.combat.threat),
      /This ruleset has no threat tiers to destroy by/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "afraid").behavior.onlyWhenStuck = "all")),
      /onlyWhenStuck/,
    );
  }

  // ── The install gate ──
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
      "A ruleset with a condition that drops what its holder holds, keeps them out of a ring, frees a turn begun stuck, a save rolled only out of sight, or a condition that destroys by threat tier, requires schemaVersion 2 and capabilityApi 1.266 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const only = (keep: (doc: Record<string, any>) => void) =>
      document((doc) => {
        doc.catalogs.at(-1).entries[0].mechanics.applies[0].destroysUpTo = undefined;
        delete doc.catalogs.at(-1).entries[0].mechanics.applies[0].destroysUpTo;
        for (const id of ["afraid", "dropping", "kept", "kept_loose"]) {
          const behavior = conditionsOf(doc, id).behavior;
          delete behavior.drops;
          delete behavior.keepsOut;
          if (behavior.onlyWhenStuck === "any") delete behavior.onlyWhenStuck;
        }
        keep(doc);
      });
    const plain = only(() => {});
    assert.notEqual(issue(265, plain), gate, "nothing of 1.266 left");
    const cases: Array<[string, (doc: Record<string, any>) => void]> = [
      ["drops", (doc) => (conditionsOf(doc, "kept").behavior.drops = { slots: ["hands"], at: "applied" })],
      ["keepsOut", (doc) => (conditionsOf(doc, "kept").behavior.keepsOut = 30)],
      ["onlyWhenStuck any", (doc) => (conditionsOf(doc, "kept").behavior.onlyWhenStuck = "any")],
      [
        "unseen",
        (doc) =>
          doc.catalogs.at(-1).entries.push({
            id: "fear",
            label: "Fear",
            rows: [{ list: "spells", values: { name: "Fear", level: 0, prepared: true } }],
            mechanics: {
              kind: "debuff",
              range: 30,
              applies: [
                {
                  condition: "afraid",
                  duration: "until-save",
                  saveEnds: { save: "wis_save", at: "turn-end", unseen: true },
                },
              ],
            },
          }),
      ],
      [
        "destroysUpTo",
        (doc) => (doc.catalogs.at(-1).entries[0].mechanics.applies[0].destroysUpTo = [{ tier: "cr_1_4" }]),
      ],
    ];
    for (const [name, keep] of cases) {
      const doc = only(keep);
      parsed(doc);
      assert.equal(issue(265, doc), gate, name);
      assert.notEqual(issue(266, doc), gate, name);
    }
    assert.notEqual(issue(265, without), gate);
    assert.equal(
      issue(265, without, new Map([["extra.json", { applies: [{ condition: "x", destroysUpTo: [] }] }]])),
      gate,
    );
  }

  console.log(
    "Ruleset drops: Fear lets fall what is in the hands (a shield's defense with it), Command's drop falls as the turn starts, picked up from where it lies once a turn or for an action; a turn begun stuck is free; Fear's save only out of sight; kept out of 30 feet; Destroy Undead by tier and level; gated at 1.266.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
