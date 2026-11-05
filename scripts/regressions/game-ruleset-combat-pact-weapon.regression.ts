/**
 * A weapon put in hand, and what amends it (Capability API 1.306).
 *
 *   - `conjures`: used, one of its melee weapons (picked as its mode) is in its user's hand for the
 *     rest of the fight, with proficiency where it says and its blows magical; or a held magic weapon
 *     that `binds` matches becomes it. Another use replaces it, a bound one going back as it was. 5e's
 *     Pact of the Blade.
 *   - Amends of the conjuring entry reach its weapon: `damagePlus` (Lifedrinker's necrotic, at least
 *     1) and `strikes` (Thirsting Blade's two attacks).
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetThingsToDrop,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";
import { rulesetOptionLabel } from "../../packages/client/src/lib/ruleset-combat-menu.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-pact-weapon-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 301);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const weapon = (dice: string, type: string, extra: Record<string, unknown> = {}) => ({
    category: "weapon",
    slots: { hands: 1 },
    attack: {
      budget: "action",
      toHit: { abilities: ["str"], proficiency: { const: 0 } },
      damage: { dice, abilities: ["str"], type },
      ...extra,
    },
  });
  const gear = [
    { id: "longsword", label: "Longsword", item: weapon("1d8", "slashing") },
    { id: "greataxe", label: "Greataxe", item: weapon("1d12", "slashing") },
    { id: "bow", label: "Bow", item: weapon("1d8", "piercing", { range: { normal: 80, long: 320 } }) },
    { id: "rope", label: "Rope", item: { category: "gear" } },
    // Thrown, and struck with in reach (1.308).
    { id: "dagger", label: "Dagger", item: weapon("1d4", "piercing", { reach: 5, range: { normal: 20, long: 60 } }) },
  ];
  const feature = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "features", values: { name: id[0]!.toUpperCase() + id.slice(1) } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const pact = feature("pact", {
    kind: "utility",
    budget: "bonus",
    conjures: {
      items: ["gear/longsword", "gear/greataxe"],
      proficient: true,
      qualities: ["magical"],
      binds: { tags: ["magic"] },
    },
  });
  const lifedrinker = feature("lifedrinker", {
    kind: "utility",
    amends: [{ entry: "features/pact", damagePlus: { add: { abilityMod: "cha" }, type: "necrotic", atLeast: 1 } }],
  });
  const thirsting = feature("thirsting", { kind: "utility", amends: [{ entry: "features/pact", strikes: 2 }] });
  const features = [pact, lifedrinker, thirsting];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = {
      categories: [
        { id: "weapon", label: "Weapon" },
        { id: "gear", label: "Gear" },
      ],
      tags: [
        { id: "magic", label: "Magic" },
        { id: "magical", label: "Magical" },
      ],
      slots: [{ id: "hands", label: "Hands", count: 2 }],
    };
    doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: structuredClone(gear) });
    doc.catalogs.push({ id: "features", label: "Features", feeds: ["features"], entries: structuredClone(features) });
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
  const flameTongue: RulesetSheetItem = {
    item: { ...weapon("2d6", "slashing"), tags: ["magic"] } as unknown as RulesetCatalogItem,
    quantity: 1,
    worn: true,
    name: "Flame Tongue",
  };
  const plainDagger: RulesetSheetItem = {
    item: weapon("1d4", "piercing") as unknown as RulesetCatalogItem,
    quantity: 1,
    worn: true,
    name: "Dagger",
  };
  const fight = (
    held: RulesetCatalogEntry[],
    cha = 16,
    items: RulesetSheetItem[] = [],
    allies: boolean = false,
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 15,
      combatants: [
        {
          id: "lock",
          name: "Lock",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 10, cha },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "cha" },
            lists: { features: held.flatMap((entry) => rowsFromCatalogEntry("features", entry).map((row) => row.row)) },
          }),
          live: {},
          items,
          catalogs: { features },
        },
        {
          id: "a",
          name: "A",
          side: "enemy",
          block: {
            health: 300,
            defense: 5,
            initiativeModifier: 0,
            speed: 30,
            actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
          },
        },
        // Somebody left standing, so the fight goes on past its warlock.
        ...(allies
          ? [
              {
                id: "b",
                name: "B",
                side: "party" as const,
                build: rulesetSheetBuildSchema.parse({
                  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                  fields: { level: 5, ac: 12, speed: 30, hp_max: 300 },
                }),
                live: {},
              },
            ]
          : []),
      ],
      board: {
        grid: { width: 10, height: 5, tiles: Array.from({ length: 5 }, () => Array(10).fill("plains")) } as never,
        placements: { lock: { x: 2, y: 2 }, a: { x: 3, y: 2 }, ...(allies ? { b: { x: 5, y: 2 } } : {}) },
      },
    });
    state.order = allies ? ["lock", "a", "b"] : ["lock", "a"];
    state.turn = 0;
    return state;
  };
  const take = (
    state: RulesetEncounterState,
    label: string,
    extra: Record<string, unknown> = {},
  ): RulesetCombatStep => {
    state.turn = 0;
    const lock = rulesetCombatant(state, "lock")!;
    for (const key of Object.keys(lock.budgets)) lock.budgets[key] = 9;
    const option = rulesetCombatOptions(definition, state, "lock").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "lock", optionId: option.id, targetIds: [], ...extra },
      () => 15,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const conjure = (state: RulesetEncounterState, item: string) => {
    const option = rulesetCombatOptions(definition, state, "lock").find((one) => one.label === "Pact")!;
    const mode = option.modes!.find((one) => one.label === item);
    assert.ok(mode, `no ${item} to conjure`);
    return take(state, "Pact", { mode: mode.id });
  };
  const actionOf = (state: RulesetEncounterState, label: string) =>
    rulesetCombatant(state, "lock")!.actions.find((one) => one.label === label && one.kind !== "switch");

  // ── Put in hand, picked as it is used ──
  {
    const state = fight([pact]);
    const option = rulesetCombatOptions(definition, state, "lock").find((one) => one.label === "Pact")!;
    assert.deepEqual(
      option.modes!.map((one) => one.label),
      ["Longsword", "Greataxe"],
      "its weapons, and nothing held to bind",
    );
    assert.equal(actionOf(state, "Longsword"), undefined, "nothing in hand yet");
    assert.ok(refusedStep(state, "Pact"), "it is not used without saying which");
    const step = conjure(state, "Longsword");
    const event = step.events.find((one) => one.type === "conjured");
    assert.deepEqual(event && { label: event.label, item: event.item }, { label: "Pact", item: "Longsword" });
    const sword = actionOf(step.state, "Longsword")!;
    assert.ok(sword, "a longsword in hand");
    assert.equal(sword.entry, "features/pact");
    // Strength +2 and proficiency +3 at 5th level, where the weapon itself says it is not proficient.
    assert.equal(sword.toHit, 5);
    assert.deepEqual(sword.damage!.qualities, ["magical"]);
    // Struck with, it hits.
    const hit = take(step.state, "Longsword", { targetIds: ["a"] });
    assert.ok(hit.events.some((one) => one.type === "damage" && one.targetId === "a"));
    // Another use puts another in its place.
    const axe = conjure(step.state, "Greataxe");
    assert.equal(actionOf(axe.state, "Longsword"), undefined, "the longsword is gone");
    assert.ok(actionOf(axe.state, "Greataxe"));
  }

  // ── Dismissed for nothing, and gone with its maker (1.308) ──
  {
    const state = fight([pact], 16, [flameTongue]);
    const dismissOf = (at: RulesetEncounterState) =>
      rulesetCombatOptions(definition, at, "lock").find((one) => one.dismiss);
    assert.equal(dismissOf(state), undefined, "nothing to dismiss yet");
    const sword = conjure(state, "Longsword");
    const dismiss = dismissOf(sword.state);
    assert.ok(dismiss, "dismissing is offered");
    assert.equal(dismiss.label, "Longsword");
    assert.equal(dismiss.budget, undefined, "for no action");
    const t = ((key: string, values: { item: string }) => `${key}:${values.item}`) as never;
    assert.equal(rulesetOptionLabel(dismiss, t), "game.combat.ruleset.menu.dismiss:Longsword");
    const gone = take(sword.state, "Longsword", { optionId: dismiss.id });
    assert.equal(actionOf(gone.state, "Longsword"), undefined, "dismissed");
    assert.equal(dismissOf(gone.state), undefined);
    assert.deepEqual(rulesetCombatant(gone.state, "lock")!.conjured, {});
    const event = gone.events.find((one) => one.type === "conjured");
    assert.deepEqual(event && { item: event.item, gone: event.gone }, { item: "Longsword", gone: true });
    // A bound weapon dismissed is what it was.
    const bound = conjure(fight([pact], 16, [flameTongue]), "Flame Tongue");
    const back = take(bound.state, "Flame Tongue", { optionId: dismissOf(bound.state)!.id });
    assert.ok(actionOf(back.state, "Flame Tongue"), "still held");
    assert.equal(actionOf(back.state, "Flame Tongue")!.entry, undefined, "and no longer the pact's");
    // A thrown weapon is a melee weapon too.
    const withDagger = parsed(
      fiveE((doc) => {
        doc.catalogs
          .find((one: { id: string }) => one.id === "features")
          .entries[0].mechanics.conjures.items.push("gear/dagger");
      }),
    );
    assert.ok(withDagger);
    // Its maker dead, it is gone.
    const dying = conjure(fight([pact], 16, [], true), "Longsword");
    const lock = rulesetCombatant(dying.state, "lock")!;
    const foe = rulesetCombatant(dying.state, "a")!;
    foe.actions.push({
      id: "kill",
      kind: "block",
      label: "Kill",
      budget: "action",
      targets: { side: "enemy", count: 1 },
      autoHit: true,
      damage: { count: 0, sides: 0, flat: 500 },
    } as never);
    // Down and dying, it is still in hand; hurt while dying until dead, it is not.
    let killed = { state: dying.state, events: [] as RulesetCombatStep["events"] };
    for (let blow = 0; blow < 4 && !rulesetCombatant(killed.state, "lock")!.defeated; blow++) {
      killed.state.turn = 1;
      const striker = rulesetCombatant(killed.state, "a")!;
      for (const key of Object.keys(striker.budgets)) striker.budgets[key] = 9;
      killed = applyRulesetCombatChoice(
        definition,
        killed.state,
        { actorId: "a", optionId: "kill", targetIds: ["lock"] },
        () => 15,
      );
      if (blow === 0) assert.ok(actionOf(killed.state, "Longsword"), "kept while dying");
    }
    assert.ok(rulesetCombatant(killed.state, "lock")!.defeated, "dead");
    assert.equal(actionOf(killed.state, "Longsword"), undefined, "gone with its maker");
  }

  // ── Bound out of the fight, by the weapon a sheet note names (1.309) ──
  {
    const ritualDoc = fiveE((doc) => {
      doc.sheet.live.text.push({ id: "pact_bound", label: "Pact weapon", maxLength: 80 });
      doc.catalogs.find((one: { id: string }) => one.id === "features").entries[0].mechanics.conjures.boundIn =
        "pact_bound";
    });
    const ritual = parsed(ritualDoc);
    const ritualFeatures = ritual.catalogs!.find((one) => one.id === "features")!.entries!;
    const second: RulesetSheetItem = { ...flameTongue, name: "Frost Brand" };
    const modes = (note: string | undefined) => {
      const state = createRulesetEncounter({
        definition: ritual,
        seed: 1,
        roller: () => 15,
        combatants: [
          {
            id: "lock",
            name: "Lock",
            side: "party",
            build: rulesetSheetBuildSchema.parse({
              abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
              fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "cha" },
              lists: { features: rowsFromCatalogEntry("features", pact).map((row) => row.row) },
            }),
            live: note === undefined ? {} : { text: { pact_bound: note } },
            items: [flameTongue, second],
            catalogs: { features: ritualFeatures },
          },
          { id: "a", name: "A", side: "enemy", block: { health: 30, defense: 5, initiativeModifier: 0, actions: [] } },
        ],
      });
      state.order = ["lock", "a"];
      state.turn = 0;
      return rulesetCombatOptions(ritual, state, "lock")
        .find((one) => one.label === "Pact")!
        .modes!.map((one) => one.label);
    };
    assert.deepEqual(modes(undefined), ["Longsword", "Greataxe"], "nothing bound yet");
    assert.deepEqual(modes(" FROST brand "), ["Longsword", "Greataxe", "Frost Brand"], "only the one named");
    assert.deepEqual(modes("Rope"), ["Longsword", "Greataxe"], "a name it does not hold binds nothing");
    refusedDoc(
      fiveE((doc) => {
        doc.catalogs.find((one: { id: string }) => one.id === "features").entries[0].mechanics.conjures.boundIn =
          "nowhere";
      }),
      /Unknown live text "nowhere"/,
    );
    refusedDoc(
      fiveE((doc) => {
        const conjures = doc.catalogs.find((one: { id: string }) => one.id === "features").entries[0].mechanics
          .conjures;
        delete conjures.binds;
        conjures.boundIn = "concentration";
      }),
      /"boundIn" names the weapon "binds" binds/,
    );
    const gate =
      "A ruleset with hiding that needs camouflage or a wall, attacks unhindered by not seeing, surprise from a hidden start, or a weapon bound out of the fight requires schemaVersion 2 and capabilityApi 1.309 or newer";
    const manifest = (minor: number) =>
      ({
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
      }) as never;
    assert.equal(getCapabilityPackageInstallIssue(manifest(308), ritualDoc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(309), ritualDoc), gate);
  }

  // ── Lifedrinker and Thirsting Blade ride on it ──
  {
    const sword = (held: RulesetCatalogEntry[], cha?: number) =>
      actionOf(conjure(fight(held, cha), "Longsword").state, "Longsword")!;
    assert.deepEqual(
      sword([pact, lifedrinker]).damage!.plus,
      [{ count: 0, sides: 0, flat: 3, type: "necrotic" }],
      "Charisma +3 necrotic",
    );
    assert.equal(sword([pact, lifedrinker], 8).damage!.plus![0]!.flat, 1, "never less than 1");
    assert.equal(sword([pact]).damage!.plus, undefined);
    assert.equal(sword([pact, thirsting]).strikes, 2, "two attacks");
    assert.equal(sword([pact]).strikes, undefined);
  }

  // ── A held magic weapon bound to the pact, and given back ──
  {
    const state = fight([pact, lifedrinker], 16, [flameTongue, plainDagger]);
    const option = rulesetCombatOptions(definition, state, "lock").find((one) => one.label === "Pact")!;
    assert.deepEqual(
      option.modes!.map((one) => one.label),
      ["Longsword", "Greataxe", "Flame Tongue"],
      "a held magic weapon, and not a plain one",
    );
    assert.equal(actionOf(state, "Flame Tongue")!.damage!.plus, undefined, "not the pact's yet");
    const bound = conjure(state, "Flame Tongue");
    const tongue = actionOf(bound.state, "Flame Tongue")!;
    assert.equal(tongue.entry, "features/pact");
    assert.equal(tongue.damage!.plus![0]!.type, "necrotic", "Lifedrinker on the bound weapon");
    assert.equal(
      rulesetCombatant(bound.state, "lock")!.actions.filter(
        (one) => one.label === "Flame Tongue" && one.kind !== "switch",
      ).length,
      1,
      "the same weapon, not two",
    );
    const after = conjure(bound.state, "Longsword");
    assert.equal(actionOf(after.state, "Flame Tongue")!.damage!.plus, undefined, "given back as it was");
    assert.equal(actionOf(after.state, "Flame Tongue")!.entry, undefined);
    assert.ok(actionOf(after.state, "Longsword"));
  }

  // ── Played by the Engine, it binds the weapon that hits hardest, once ──
  {
    const bestiary = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creatures = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!;
    const build = rulesetSheetBuildSchema.parse({
      abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 80, spellcasting_ability: "cha" },
      lists: { features: rowsFromCatalogEntry("features", pact).map((row) => row.row) },
    });
    const built = createRulesetFight({
      definition,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "foe", name: "Foe", creature: `${creatures.id}/${creatures.entries![0]!.id}` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build } }],
      playerName: null,
      live: {},
      items: () => [flameTongue],
      partyCatalogs: { features },
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const unit = (id: string, name: string, side: "player" | "enemy") => ({
      id,
      name,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 3,
      skills: [],
    });
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("ada", "Ada", "player")],
      enemies: [unit("foe", "Foe", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    // A foe that lasts, so turns after the first are played too.
    const foe = state.rulesetFight!.encounter.combatants.find((one) => one.id === "foe")!;
    foe.health = { value: 5000, max: 5000, temp: 0 };
    syncRulesetCombatants(definition, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "control", unitId: "ada", controller: "ai" }).ok);
    for (let guard = 0; guard < 8 && !state.outcome; guard++) {
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    }
    const conjured = state.rulesetFight!.events.filter((entry) => entry.event.type === "conjured");
    assert.equal(conjured.length, 1, "once");
    assert.equal((conjured[0]!.event as { item: string }).item, "Flame Tongue", "the 2d6 one");
  }

  // ── Let fall, and gone once left far off for a minute (1.480) ──
  {
    const conjures = (pact.mechanics as { conjures: Record<string, unknown> }).conjures;
    conjures.vanishes = { beyond: 5, rounds: 10 };
    try {
      parsed(fiveE());
      const state = conjure(fight([pact], 16, [], true), "Longsword").state;
      const lock = rulesetCombatant(state, "lock")!;
      const things = rulesetThingsToDrop(lock, { slots: ["hands"] });
      assert.deepEqual(
        things.map((one) => [one.key, one.label]),
        [[`conjured:${Object.keys(lock.conjured!)[0]}`, "Longsword"]],
        "a pact weapon falls from the hand",
      );
      assert.deepEqual(rulesetThingsToDrop(lock, { tags: ["magic"] }), [], "it is no magic item");
      lock.dropped = things;
      assert.ok(
        !rulesetCombatOptions(definition, state, "lock").some(
          (one) => one.label === "Longsword" && !one.pickUp && !one.dismiss,
        ),
        "not struck with where it lies",
      );
      assert.ok(
        rulesetCombatOptions(definition, state, "lock").some((one) => one.dismiss),
        "still dismissed",
      );
      // Picked up again from beside it.
      const pickUp = rulesetCombatOptions(definition, state, "lock").find((one) => one.pickUp)!;
      const back = applyRulesetCombatChoice(
        definition,
        structuredClone(state),
        { actorId: "lock", optionId: pickUp.id, targetIds: [] },
        () => 15,
      );
      assert.ok(
        rulesetCombatOptions(definition, back.state, "lock").some(
          (one) => one.label === "Longsword" && !one.pickUp && !one.dismiss,
        ),
      );
      // Walked away from, it lasts its minute and no more.
      lock.x = 8;
      let at = state;
      const round = () => {
        at.turn = at.order.indexOf("b");
        at = applyRulesetCombatChoice(
          definition,
          at,
          { actorId: "b", optionId: "end-turn", targetIds: [] },
          () => 15,
        ).state;
        assert.equal(at.order[at.turn], "lock");
      };
      for (let count = 0; count < 10; count += 1) round();
      const made = (one: RulesetEncounterState) => Object.keys(rulesetCombatant(one, "lock")!.conjured ?? {}).length;
      assert.equal(made(at), 1, "ten turns far off: still there");
      round();
      assert.equal(made(at), 0, "gone after a minute");
      assert.deepEqual(rulesetCombatant(at, "lock")!.dropped ?? [], [], "from where it lay, too");
      // Back beside it, the count starts over.
      const near = conjure(fight([pact], 16, [], true), "Longsword").state;
      const holder = rulesetCombatant(near, "lock")!;
      holder.dropped = rulesetThingsToDrop(holder, { slots: ["hands"] });
      holder.x = 8;
      at = near;
      for (let count = 0; count < 6; count += 1) round();
      rulesetCombatant(at, "lock")!.x = 3;
      round();
      rulesetCombatant(at, "lock")!.x = 8;
      for (let count = 0; count < 6; count += 1) round();
      assert.equal(made(at), 1, "the minute counts from when it was last near");
    } finally {
      delete conjures.vanishes;
    }
  }

  // ── Refusals ──
  {
    const withFeature = (mechanics: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "features")
          .entries.push(feature("odd", mechanics));
      });
    refusedDoc(
      withFeature({ kind: "attack", amount: { flat: 1 }, conjures: { items: ["gear/longsword"] } }),
      /conjures/,
    );
    refusedDoc(withFeature({ kind: "utility", conjures: { items: ["gear/rope"] } }), /"gear\/rope" is not a weapon/);
    refusedDoc(
      withFeature({ kind: "utility", conjures: { items: ["gear/bow"] } }),
      /"gear\/bow" is not a melee weapon/,
    );
    refusedDoc(
      withFeature({ kind: "utility", conjures: { items: ["gear/nothing"] } }),
      /"gear\/nothing" is not a weapon/,
    );
    refusedDoc(
      withFeature({ kind: "utility", conjures: { items: ["nowhere/sword"] } }),
      /Unknown entry "nowhere\/sword"/,
    );
    refusedDoc(withFeature({ kind: "utility", amends: [{ entry: "features/pact" }] }), /damagePlus/);
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
      "A ruleset with weapons put in hand, or amends that add damage of a type or strikes, requires schemaVersion 2 and capabilityApi 1.306 or newer";
    for (const entry of [pact, lifedrinker, thirsting]) {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.push({ id: "features", label: "Features", feeds: ["features"], entries: [entry] });
      assert.equal(getCapabilityPackageInstallIssue(manifest(305) as never, doc), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(306) as never, doc), gate);
    }
    // Gone once left far off (1.480).
    const vanishing = JSON.parse(fiveEText) as Record<string, any>;
    const left = structuredClone(pact) as unknown as { mechanics: { conjures: Record<string, unknown> } };
    left.mechanics.conjures.vanishes = { beyond: 5, rounds: 10 };
    vanishing.catalogs.push({ id: "features", label: "Features", feeds: ["features"], entries: [left] });
    const later =
      "A ruleset whose conjured weapons are gone once left lying far off (conjures vanishes) requires schemaVersion 2 and capabilityApi 1.480 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(479) as never, vanishing), later);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(480) as never, vanishing), later);
  }

  console.log(
    "Pact weapon: a weapon of its user's choice in hand, proficient and magical, or a held magic one bound, given back when replaced; Lifedrinker and Thirsting Blade on it; refusals; gated at 1.306.",
  );

  function refusedStep(state: RulesetEncounterState, label: string) {
    const option = rulesetCombatOptions(definition, state, "lock").find((one) => one.label === label)!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "lock", optionId: option.id, targetIds: [] },
      () => 15,
    );
    return step.events.find((one) => one.type === "refused");
  }
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
