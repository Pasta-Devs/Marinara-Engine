/**
 * Maze, Expeditious Retreat, a casting's choices made again, and the hammer's +4 (Capability API 1.313).
 *
 *   - `dismisses.turns`: sent away, it still takes its turns, on which it may only try the way back;
 *     `checkEnds` is that way: a check of `combat.checks` against a number, which a creature that
 *     `passes` makes without a roll. 5e's Maze and its minotaur.
 *   - `takes`: standard actions taken with a use. Expeditious Retreat Dashes as it is cast.
 *   - `repeats.group`: entries of one group are one casting's choices, each offered again while any is
 *     concentrated on. Eyebite's asleep and panicked.
 *   - An ability `add` with `max` goes on top of every `set` up to its most. `binds.needsWorn`: an
 *     item bound only with one of each group worn, and unbound when one comes off. A Hammer of
 *     Thunderbolts with a belt of giant strength and the gauntlets.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  evaluateRulesetSheet,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  rulesetSheetItems,
  supportedCapabilityApi,
  applyGameInventoryOps,
  wearGameInventoryStack,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-leftovers-308-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 308);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, level: number, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
      mechanics: { cost: [{ pool: `slots_${level}`, amount: 1 }], ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const maze = spell("maze", "Maze", 5, {
    kind: "debuff",
    range: 60,
    autoHit: true,
    concentration: true,
    applies: [
      {
        condition: "mazed",
        duration: { rounds: 100 },
        checkEnds: { check: "intellect", difficulty: 20, passes: { types: ["monstrosity"] } },
      },
    ],
    dismisses: { while: "mazed", turns: true },
  });
  const retreat = spell("retreat", "Expeditious Retreat", 1, {
    kind: "buff",
    targets: "self",
    concentration: true,
    takes: ["dash"],
    appliesSelf: [{ condition: "retreating", duration: { rounds: 100 } }],
  });
  const eyebite = (id: string, label: string, condition: string) =>
    spell(id, label, 5, {
      kind: "debuff",
      range: 60,
      concentration: true,
      repeats: { budget: "action", notSaved: true, group: "eyebite" },
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition, duration: { rounds: 10 } }],
    });
  const asleep = eyebite("eyebite-asleep", "Eyebite: Asleep", "dozing");
  const panicked = eyebite("eyebite-panicked", "Eyebite: Panicked", "panicked");
  const spells = [maze, retreat, asleep, panicked];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "mazed", label: "Mazed" },
      { id: "retreating", label: "Retreating" },
      { id: "dozing", label: "Dozing" },
      { id: "panicked", label: "Panicked" },
    );
    doc.combat.conditions.push(
      { condition: "mazed", effects: [] },
      { condition: "retreating", effects: [], grants: { budget: "bonus", standard: ["dash"] } },
      { condition: "dozing", effects: [] },
      { condition: "panicked", effects: [] },
    );
    doc.combat.checks.push({ id: "intellect", label: "Intelligence", value: { abilityMod: "int" } });
    doc.combat.creatureTypes = {
      types: ["humanoid", "monstrosity"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  let d20 = 1;
  const roll = (sides: number) => (sides === 20 ? d20 : 1);
  const fields: Record<string, number> = { level: 11, ac: 12, speed: 30, hp_max: 60 };
  for (let level = 1; level <= 5; level++) fields[`slots_max_${level}`] = 4;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
    fields: { ...fields, spellcasting_ability: "int" },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const foe = (id: string, type = "humanoid") => ({
    id,
    name: id.toUpperCase(),
    side: "enemy" as const,
    block: {
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      type,
      checks: { intellect: 2 },
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { flat: 1 } }],
    } as unknown as RulesetStatBlock,
  });
  const fight = (foes = [foe("a"), foe("b")]): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [{ id: "mage", name: "Mage", side: "party", build, live: {}, catalogs: { spells } }, ...foes],
      board: {
        grid: { width: 20, height: 5, tiles: Array.from({ length: 5 }, () => Array(20).fill("plains")) } as never,
        placements: Object.fromEntries([
          ["mage", { x: 2, y: 2 }],
          ...foes.map((one, at) => [one.id, { x: 4 + at, y: 2 }]),
        ]),
      },
    });
    state.order = ["mage", ...foes.map((one) => one.id)];
    state.turn = 0;
    return state;
  };
  const optionsOf = (state: RulesetEncounterState, actorId: string) => {
    state.turn = state.order.indexOf(actorId);
    const actor = rulesetCombatant(state, actorId)!;
    for (const key of Object.keys(actor.budgets)) actor.budgets[key] = 9;
    return rulesetCombatOptions(definition, state, actorId);
  };
  const choose = (
    state: RulesetEncounterState,
    actorId: string,
    find: (one: { id: string; label: string }) => boolean,
    targetIds: string[],
  ): RulesetCombatStep => {
    const option = optionsOf(state, actorId).find(find);
    assert.ok(option, `no option for ${actorId}: ${optionsOf(state, actorId).map((one) => one.label)}`);
    const step = applyRulesetCombatChoice(definition, state, { actorId, optionId: option.id, targetIds }, roll);
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const cast = (state: RulesetEncounterState, label: string, targetIds: string[]) =>
    choose(state, "mage", (one) => one.label === label && !one.id.endsWith(":again"), targetIds);
  const holds = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatant(state, id)!.tracked.some((one) => one.condition === condition);

  // ── Maze ──
  {
    const mazed = cast(fight(), "Maze", ["a"]).state;
    const a = rulesetCombatant(mazed, "a")!;
    assert.equal(a.away?.turns, true, "away, still taking turns");
    assert.ok(holds(mazed, "a", "mazed"));
    // The mage's turn ends: the mazed creature's turn comes, offering only the way back.
    mazed.turn = 0;
    let step = advanceRulesetTurn(definition, mazed, roll);
    assert.equal(step.state.order[step.state.turn], "a", "its turn still comes");
    const menu = rulesetCombatOptions(definition, step.state, "a");
    assert.deepEqual(
      menu.map((one) => one.kind),
      ["standard", "end-turn"],
      "only the way back, or ending the turn",
    );
    assert.equal(menu[0]!.label, "Try to end Mazed");
    // 1 + 2 is short of 20: still lost.
    d20 = 1;
    const lostState = structuredClone(step.state);
    // Nobody named to pass, nobody passes.
    delete rulesetCombatant(lostState, "a")!.tracked.find((one) => one.condition === "mazed")!.checkEnds!.passes;
    const lost = applyRulesetCombatChoice(
      definition,
      lostState,
      { actorId: "a", optionId: menu[0]!.id, targetIds: [] },
      roll,
    );
    const failed = of(lost.events, "checkEnded")[0]!;
    assert.ok(failed, JSON.stringify(lost.events));
    assert.deepEqual(
      { total: failed.total, success: failed.success, difficulty: failed.difficulty },
      { total: 3, success: false, difficulty: 20 },
    );
    assert.equal(rulesetCombatant(lost.state, "a")!.defeated, true, "still away");
    // 18 + 2 makes it: back.
    d20 = 18;
    const out = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "a", optionId: menu[0]!.id, targetIds: [] },
      roll,
    );
    assert.ok(of(out.events, "checkEnded")[0]!.success);
    assert.equal(holds(out.state, "a", "mazed"), false);
    assert.equal(rulesetCombatant(out.state, "a")!.defeated, false, "back in the fight");
    assert.equal(rulesetCombatant(out.state, "a")!.away, undefined);
    assert.equal(rulesetCombatant(step.state, "mage")!.concentrating?.label, "Maze", "held while it is lost");
    assert.equal(rulesetCombatant(lost.state, "mage")!.concentrating?.label, "Maze", "still held after a failed try");
    assert.equal(rulesetCombatant(out.state, "mage")!.concentrating, null, "out of the maze, the spell ends");
    // A minotaur finds its way without a roll.
    d20 = 1;
    const bull = cast(fight([foe("m", "monstrosity"), foe("b")]), "Maze", ["m"]).state;
    bull.turn = 0;
    step = advanceRulesetTurn(definition, bull, roll);
    const way = rulesetCombatOptions(definition, step.state, "m")[0]!;
    const free = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "m", optionId: way.id, targetIds: [] },
      roll,
    );
    assert.equal(of(free.events, "checkEnded")[0]!.automatic, true);
    assert.equal(rulesetCombatant(free.state, "m")!.defeated, false);
    assert.equal(rulesetCombatant(free.state, "mage")!.concentrating, null, "a minotaur's way out ends it too");
    // A banishment without turns is still stepped over.
    const banished = cast(fight(), "Maze", ["a"]).state;
    delete rulesetCombatant(banished, "a")!.away!.turns;
    banished.turn = 0;
    assert.equal(advanceRulesetTurn(definition, banished, roll).state.order[1], "a");
    assert.notEqual(
      advanceRulesetTurn(definition, banished, roll).state.order[
        advanceRulesetTurn(definition, banished, roll).state.turn
      ],
      "a",
      "away without turns, skipped",
    );
  }

  // ── Expeditious Retreat ──
  {
    const state = fight();
    const before = rulesetCombatant(state, "mage")!.movementLeft;
    const step = cast(state, "Expeditious Retreat", ["mage"]);
    const mage = rulesetCombatant(step.state, "mage")!;
    assert.ok(
      of(step.events, "standard").some((one) => one.action === "dash"),
      "it Dashes as it is cast",
    );
    assert.equal(mage.flags.dashed, true);
    assert.ok((mage.movementLeft ?? 0) > (before ?? 0), `more to walk: ${before} -> ${mage.movementLeft}`);
    assert.ok(holds(step.state, "mage", "retreating"));
    const later = optionsOf(step.state, "mage");
    assert.ok(
      later.some((one) => one.id === "standard:dash@bonus"),
      `a bonus-action Dash while it holds: ${later.map((one) => one.id)}`,
    );
  }

  // ── Eyebite's choices ──
  {
    d20 = 20;
    const first = cast(fight(), "Eyebite: Asleep", ["a"]);
    assert.equal(holds(first.state, "a", "dozing"), false, "A saved");
    const panic = optionsOf(first.state, "mage").find(
      (one) => one.label === "Eyebite: Panicked" && one.id.endsWith(":again"),
    );
    assert.ok(panic, "another choice of the same casting is offered again");
    assert.deepEqual(rulesetOptionTargets(definition, first.state, "mage", panic), ["b"], "never at who saved");
    d20 = 1;
    const second = choose(first.state, "mage", (one) => one.id === panic.id, ["b"]);
    assert.ok(holds(second.state, "b", "panicked"));
    assert.ok(!of(second.events, "concentration").some((one) => one.state === "started"), "still the first casting");
    // A save made against another choice of it counts against the casting too.
    d20 = 20;
    const third = cast(fight([foe("a"), foe("b"), foe("c")]), "Eyebite: Asleep", ["a"]);
    const otherChoice = optionsOf(third.state, "mage").find(
      (one) => one.label === "Eyebite: Panicked" && one.id.endsWith(":again"),
    )!;
    const savedAgain = choose(third.state, "mage", (one) => one.id === otherChoice.id, ["b"]);
    const asleepAgain = optionsOf(savedAgain.state, "mage").find(
      (one) => one.label === "Eyebite: Asleep" && one.id.endsWith(":again"),
    )!;
    assert.deepEqual(rulesetOptionTargets(definition, savedAgain.state, "mage", asleepAgain), ["c"]);
  }

  // ── The hammer's +4, and the binding that needs a belt and gauntlets ──
  {
    const piece = (slot: string, abilities: Record<string, unknown>, binds: Record<string, unknown> | false = {}) => ({
      category: "gear",
      slots: { [slot]: 1 },
      ...(binds ? { binds } : {}),
      worn: { abilities },
    });
    const needsWorn = [{ anyOf: ["gear/belt-hill", "gear/belt-storm"] }, { anyOf: ["gear/gauntlets"] }];
    const gearDefinition = parsed(
      fiveE((doc) => {
        doc.items = {
          categories: [{ id: "gear", label: "Gear" }],
          slots: ["hands", "waist", "arms", "head"].map((id) => ({ id, label: id, count: 1 })),
          binding: { label: "Attuned", max: { const: 5 } },
        };
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          entries: [
            { id: "hammer", label: "Hammer", item: piece("hands", { str: { add: 4, max: 30 } }, { needsWorn }) },
            { id: "belt-hill", label: "Hill Belt", item: piece("waist", { str: { set: 21 } }) },
            { id: "belt-storm", label: "Storm Belt", item: piece("waist", { str: { set: 29 } }) },
            { id: "gauntlets", label: "Gauntlets", item: piece("arms", { str: { set: 19 } }) },
            { id: "ioun", label: "Ioun", item: piece("head", { str: { add: 2, max: 20 } }) },
          ],
        });
      }),
    );
    const gearCatalog = gearDefinition.catalogs!.find((catalog) => catalog.id === "gear")!;
    const book = rulesetItemBook(gearDefinition, { gear: gearCatalog.entries! });
    const stack = (id: string, worn = true, holder?: string): GameInventoryStack => ({
      id,
      name: id,
      item: `gear/${id}`,
      quantity: 1,
      ...(worn ? { equipped: true as const, bound: true as const } : {}),
      ...(holder ? { holder } : {}),
    });
    const str = (stacks: GameInventoryStack[], base = 10) =>
      evaluateRulesetSheet(
        gearDefinition,
        rulesetSheetBuildSchema.parse({ ...build, abilities: { ...build.abilities, str: base } }),
        { pools: [], tracks: [], items: rulesetSheetItems(book, stacks, undefined) },
      ).abilityScores.str;
    assert.equal(str([stack("hammer"), stack("belt-hill"), stack("gauntlets")]), 25, "21 and 4 on top");
    assert.equal(str([stack("hammer"), stack("belt-storm"), stack("gauntlets")]), 30, "29 and 4, held to 30");
    assert.equal(str([stack("hammer", false), stack("belt-hill"), stack("gauntlets")]), 21, "the hammer itself worn");
    // Bound by some other road with the gauntlets gone, it still does nothing.
    assert.equal(str([stack("hammer"), stack("belt-hill")]), 21, "no gauntlets, not attuned");
    assert.equal(
      str([stack("hammer"), stack("belt-hill"), stack("gauntlets", true, "Sam")]),
      21,
      "worn by somebody else",
    );
    assert.equal(str([stack("hammer"), stack("belt-hill"), stack("gauntlets", false)]), 21, "carried, not worn");
    assert.equal(str([stack("ioun")], 19), 20, "an ioun stone to at most 20");
    assert.equal(str([stack("ioun")], 20), 20);
    assert.equal(str([stack("ioun"), stack("belt-hill")], 10), 21, "a belt's 21 stays");
    assert.equal(str([stack("ioun")], 21), 21, "a score above its most is not lowered");

    // Binding it needs one of each group worn, bound where it binds.
    const loose = (...ids: string[]) => ids.map((id) => ({ ...stack(id, id !== "hammer"), equipped: true as const }));
    assert.deepEqual(wearGameInventoryStack(loose("hammer", "belt-hill"), "hammer", "bind", undefined, book), {
      refused: "needs-worn",
    });
    const elsewhere = [...loose("hammer", "belt-hill"), stack("gauntlets", true, "Sam")];
    assert.deepEqual(wearGameInventoryStack(elsewhere, "hammer", "bind", undefined, book), { refused: "needs-worn" });
    const unattunedBelt = loose("hammer", "belt-hill", "gauntlets").map((one) =>
      one.id === "belt-hill" ? { ...one, bound: undefined } : one,
    ) as GameInventoryStack[];
    assert.deepEqual(wearGameInventoryStack(unattunedBelt, "hammer", "bind", undefined, book), {
      refused: "needs-worn",
    });
    const attuned = wearGameInventoryStack(
      loose("hammer", "belt-storm", "gauntlets"),
      "hammer",
      "bind",
      undefined,
      book,
    );
    assert.ok(attuned && "stacks" in attuned);
    assert.equal(attuned.stacks.find((one) => one.id === "hammer")!.bound, true);
    // Taking off either ends it.
    const offAgain = wearGameInventoryStack(attuned.stacks, "gauntlets", "unequip", undefined, book);
    assert.ok(offAgain && "stacks" in offAgain);
    assert.equal(
      offAgain.stacks.find((one) => one.id === "hammer")!.bound,
      undefined,
      "unbound with the gauntlets off",
    );
    // A cursed hammer stays bound with its gauntlets off, as the player cannot unbind it by hand.
    const cursedBook = {
      ...book,
      actor: "player" as const,
      itemOf: (item: string) => {
        const found = book.itemOf(item);
        return found && item === "gear/hammer" ? { ...found, binds: { ...found.binds, cursed: true } } : found;
      },
    };
    const cursedOff = wearGameInventoryStack(attuned.stacks, "gauntlets", "unequip", undefined, cursedBook);
    assert.ok(cursedOff && "stacks" in cursedOff);
    assert.equal(cursedOff.stacks.find((one) => one.id === "hammer")!.bound, true, "the curse holds");
    const unbelted = wearGameInventoryStack(attuned.stacks, "belt-storm", "unbind", undefined, book);
    assert.ok(unbelted && "stacks" in unbelted);
    assert.equal(unbelted.stacks.find((one) => one.id === "hammer")!.bound, undefined, "unbound with the belt unbound");
    const given = applyGameInventoryOps(attuned.stacks, [{ op: "give", id: "belt-storm", to: "Sam" }], undefined, book);
    assert.equal(given.stacks.find((one) => one.id === "hammer")!.bound, undefined, "unbound with the belt given away");
    const kept = applyGameInventoryOps(
      attuned.stacks,
      [{ op: "rename", id: "belt-storm", name: "Belt" }],
      undefined,
      book,
    );
    assert.equal(kept.stacks.find((one) => one.id === "hammer")!.bound, true, "nothing came off");
  }

  // ── Refusals ──
  const withSpell = (entry: RulesetCatalogEntry) =>
    fiveE((doc) => {
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "spells").entries.push(entry);
    });
  refusedDoc(
    withSpell(
      spell("odd", "Odd", 1, {
        kind: "debuff",
        range: 60,
        autoHit: true,
        applies: [{ condition: "mazed", duration: { rounds: 1 }, checkEnds: { check: "nope", difficulty: 10 } }],
      }),
    ),
    /Unknown contest check "nope"/,
  );
  refusedDoc(withSpell(spell("odd", "Odd", 1, { kind: "buff", targets: "self", takes: ["help"] })), /takes/);
  refusedDoc(
    fiveE((doc) => {
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          {
            id: "hammer",
            label: "Hammer",
            item: { category: "gear", binds: { needsWorn: [{ anyOf: ["Belt"] }] } },
          },
        ],
      });
    }),
    /<catalog>\/<entry>/,
  );
  const needing = (anyOf: string[]) =>
    fiveE((doc) => {
      doc.items = { categories: [{ id: "gear", label: "Gear" }], binding: { label: "Attuned", max: { const: 3 } } };
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          { id: "hammer", label: "Hammer", item: { category: "gear", binds: { needsWorn: [{ anyOf }] } } },
          { id: "belt", label: "Belt", item: { category: "gear", binds: {} } },
        ],
      });
    });
  parsed(needing(["gear/belt"]));
  refusedDoc(needing(["gear/sash"]), /Unknown item "gear\/sash"/);
  refusedDoc(needing(["gear/hammer"]), /not itself/);

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
      "A ruleset with a creature sent away that still takes turns, a condition ended by a check, standard actions taken with a use, a casting's choices made again, an ability add capped, or an item bound only with others worn requires schemaVersion 2 and capabilityApi 1.313 or newer";
    const docWith = (entries: unknown[]) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
      return doc;
    };
    const itemDoc = (abilities: unknown) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [{ id: "x", label: "X", item: { category: "gear", worn: { abilities } } }],
      });
      return doc;
    };
    const bindDoc = (binds: unknown) => {
      const doc = itemDoc({ str: { set: 19 } });
      doc.catalogs.at(-1).entries[0].item.binds = binds;
      return doc;
    };
    const plainMaze = structuredClone(maze) as Record<string, any>;
    delete plainMaze.mechanics.applies[0].checkEnds;
    const noTurns = structuredClone(plainMaze);
    noTurns.mechanics.dismisses = { while: "mazed" };
    const onlyCheck = structuredClone(maze) as Record<string, any>;
    onlyCheck.mechanics.dismisses = { while: "mazed" };
    const plainEyebite = structuredClone(asleep) as Record<string, any>;
    delete plainEyebite.mechanics.repeats.group;
    const plainRetreat = structuredClone(retreat) as Record<string, any>;
    delete plainRetreat.mechanics.takes;
    for (const doc of [
      docWith([maze]),
      docWith([plainMaze]),
      docWith([onlyCheck]),
      docWith([asleep]),
      docWith([retreat]),
      itemDoc({ str: { add: 2, max: 20 } }),
      bindDoc({ needsWorn: [{ anyOf: ["gear/x"] }] }),
    ]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(312) as never, doc), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(313) as never, doc), gate);
    }
    for (const doc of [
      docWith([noTurns]),
      docWith([plainEyebite, plainRetreat]),
      itemDoc({ str: { add: 2 } }),
      bindDoc({ cursed: true }),
    ]) {
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(312) as never, doc), gate, "nothing new, no gate");
    }
  }

  console.log(
    "Leftovers 308: Maze keeps its turns for an Intelligence check out (a minotaur's free), Expeditious Retreat Dashes on the cast and on bonus actions, Eyebite's other choice made again, the hammer's +4 only with belt and gauntlets; refusals; gated at 1.313.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
