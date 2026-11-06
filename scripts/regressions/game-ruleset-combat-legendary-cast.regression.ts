/**
 * Legendary casts (Capability API 1.284).
 *
 *   - `casting` on a creature's signature action: a lich's Cantrip (`cantripsOnly`) and a sphinx's
 *     Cast a Spell, offered between turns as each of its spells its own turn would offer, aimed the
 *     same way (a target, a cell), uses spent as they always are, points spent for the cast.
 *   - A Counterspell answers it as it answers any cast, and the window it was bought in is asked on
 *     once everything it opened has closed: the next turn begins, the lich's own budgets untouched.
 *   - Nothing of it on the creature's own turn; a refused aim moves nothing.
 *   - The director buys one when its spell is worth the points.
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
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  RULESET_PASS_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
  defaultRulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-legendary-cast-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 279);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, level: number, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const spells = [
    spell("bolt", 0, { kind: "attack", autoHit: true, range: 120, amount: { flat: 6 }, damageType: "fire" }),
    spell("spark", 0, {
      kind: "attack",
      autoHit: true,
      range: 120,
      area: { shape: "burst", size: 5 },
      amount: { flat: 3 },
      damageType: "lightning",
    }),
    spell("glare", 0, {
      kind: "attack",
      autoHit: true,
      range: 120,
      amount: { flat: 2 },
      damageType: "psychic",
      seen: true,
    }),
    spell("flare", 1, { kind: "attack", autoHit: true, range: 120, amount: { flat: 10 }, damageType: "radiant" }),
    spell("brace", 3, {
      kind: "utility",
      budget: "reaction",
      cost: [{ pool: "slots_3", amount: 1 }],
      reaction: { on: "aimed", cancels: true },
    }),
    spell("counter", 3, {
      kind: "utility",
      budget: "reaction",
      range: 60,
      cost: [{ pool: "slots_3", amount: 1 }],
      reaction: { on: "used", cancels: true, against: { catalogs: ["spells"] } },
    }),
  ];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (edit: (doc: Record<string, any>) => void, message: RegExp) => {
    const result = parseRulesetDefinition(fiveE(edit));
    assert.equal(result.ok, false, `expected a refusal matching ${message}`);
    assert.ok(
      !result.ok && result.issues.some((issue) => message.test(issue)),
      !result.ok ? result.issues.join("; ") : "",
    );
  };
  const definition = parsed(fiveE());
  const sheet = (withCounter: boolean, also: string[] = [], hp = 60) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
      fields: { level: 9, ac: 12, speed: 30, hp_max: hp, spellcasting_ability: "int", slots_max_3: 2 },
      lists: {
        spells: spells
          .filter((entry) => (withCounter && entry.id === "counter") || also.includes(entry.id))
          .flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
      },
    });
  const touch = { id: "touch", name: "Touch", budget: "action", toHit: 9, reach: 5, damage: { count: 1, sides: 6 } };
  const cantrip = {
    id: "cantrip",
    name: "Cantrip",
    budget: "action",
    signature: { cost: 1 },
    casting: { cantripsOnly: true },
  };
  const cast = { id: "cast", name: "Cast a Spell", budget: "action", signature: { cost: 3 }, casting: {} };
  const lich = (): RulesetStatBlock =>
    ({
      health: 135,
      defense: 17,
      initiativeModifier: 0,
      speed: 30,
      signaturePoints: 3,
      spellcasting: {
        toHit: 12,
        saveDifficulty: 20,
        spells: [
          { entry: "spells/bolt" },
          { entry: "spells/spark" },
          { entry: "spells/glare" },
          { entry: "spells/flare", level: 1, uses: { per: "day", count: 1 } },
        ],
      },
      actions: [touch, cantrip, cast],
    }) as unknown as RulesetStatBlock;
  const grid: TacticalGrid = {
    width: 30,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array.from({ length: 30 }, () => "plains")),
  };
  const fight = (options: { counter?: boolean; brace?: boolean; frail?: boolean } = {}) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "fighter",
          name: "Fighter",
          side: "party",
          build: sheet(false, options.brace ? ["brace"] : [], options.frail ? 5 : 60),
          live: {},
          ...(options.brace ? { catalogs: { spells } } : {}),
        },
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: sheet(options.counter ?? false),
          live: {},
          catalogs: { spells },
        },
        { id: "lich", name: "Lich", side: "enemy", block: lich() },
      ],
      board: {
        grid,
        placements: { fighter: { x: 4, y: 7 }, mage: { x: 12, y: 2 }, lich: { x: 20, y: 7 } },
      },
    });
    state.order = ["fighter", "mage", "lich"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const hurt = (step: RulesetCombatStep, id: string) =>
    step.events
      .filter((one) => one.type === "damage" && one.targetId === id)
      .reduce((total, one) => total + (one.type === "damage" ? one.dealt : 0), 0);
  const between = (state: RulesetEncounterState) => {
    const ended = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "fighter", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(ended.state.window?.kind, "signature");
    return ended.state;
  };
  const menu = (state: RulesetEncounterState) => rulesetWindowOptions(definition, state, "lich");
  const buy = (state: RulesetEncounterState, optionId: string, extra: Record<string, unknown> = {}) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "lich", optionId, targetIds: [], window: state.window!.id, ...extra },
      roll,
    );

  // ── What is offered: cantrips for the Cantrip, every spell for Cast a Spell ──
  {
    const state = between(fight());
    const ids = menu(state).map((one) => one.id);
    assert.ok(ids.includes("cantrip>spells/bolt") && ids.includes("cantrip>spells/spark"), ids.join());
    assert.ok(!ids.includes("cantrip>spells/flare"), "no first-level spell for a cantrip");
    assert.ok(!ids.some((id) => id.endsWith(">touch")), "nothing that is not a spell");
    assert.ok(ids.includes("cast>spells/flare") && ids.includes("cast>spells/bolt"), ids.join());
    const bolt = menu(state).find((one) => one.id === "cantrip>spells/bolt")!;
    assert.deepEqual(bolt.signature, { cost: 1, points: 3 });
    assert.equal(bolt.budget, undefined, "points, not a budget");
    assert.deepEqual(bolt.targets, { side: "enemy", count: 1 }, "aimed as on its turn");
    assert.ok(menu(state).find((one) => one.id === "cantrip>spells/spark")!.area, "a shape to aim");
  }

  // ── Aimed by the spell's own rules: nobody it cannot see for a spell that needs sight (cloud
  //    re-test 2026-10-26: a Hold Person bought with points picked an invisible halfling four times) ──
  {
    const state = between(fight());
    who(state, "fighter").hiding = { from: ["lich"] } as never;
    const glare = menu(state).find((one) => one.id === "cantrip>spells/glare")!;
    assert.deepEqual(rulesetOptionTargets(definition, state, "lich", glare), ["mage"], "not the hidden fighter");
  }

  // ── A cantrip at the fighter: the next turn begins, the lich's own turn untouched ──
  {
    const state = between(fight());
    who(state, "lich").budgets.action = 1;
    const step = buy(state, "cantrip>spells/bolt", { targetIds: ["fighter"] });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hurt(step, "fighter"), 6);
    assert.ok(step.events.some((one) => one.type === "signature" && one.label === "Bolt" && one.left === 2));
    assert.equal(step.state.window, undefined, "the window is done");
    assert.equal(step.state.order[step.state.turn], "mage", "and the next turn begins");
    assert.equal(who(step.state, "lich").signature!.points, 2);
    assert.equal(who(step.state, "lich").budgets.action, 1, "its own budgets as they were");
  }

  // ── A burst cantrip on a cell ──
  {
    const step = buy(between(fight()), "cantrip>spells/spark", { at: { x: 4, y: 7 } });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hurt(step, "fighter"), 3);
    assert.equal(step.state.order[step.state.turn], "mage");
  }

  // ── Cast a Spell: a use spent as always, all three points ──
  {
    const step = buy(between(fight()), "cast>spells/flare", { targetIds: ["fighter"] });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hurt(step, "fighter"), 10);
    assert.equal(who(step.state, "lich").signature!.points, 0);
    const lichSpell = who(step.state, "lich").actions.find((one) => one.id === "spells/flare")!;
    assert.ok(lichSpell, "the spell is the lich's own");
    // Its one use a day is gone: the next window offers it no more.
    const later = structuredClone(step.state);
    who(later, "lich").signature!.points = 3;
    later.turn = 0;
    const again = between(later);
    assert.ok(!menu(again).some((one) => one.id === "cast>spells/flare"), "used up");
  }

  // ── A Counterspell answers it, and the turn still changes after ──
  {
    const state = between(fight({ counter: true }));
    const step = buy(state, "cantrip>spells/bolt", { targetIds: ["fighter"] });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(step.state.window?.kind, "reaction", "the mage is asked");
    assert.deepEqual(step.state.window?.waiting, ["mage"]);
    assert.ok(step.state.window?.outer, "holding the window it was bought in");
    assert.equal(step.state.order[step.state.turn], "fighter", "still between the fighter's turn and the next");
    assert.equal(who(step.state, "lich").signature!.points, 2, "paid as it was cast");
    // Countered.
    const counter = rulesetWindowOptions(definition, step.state, "mage").find((one) => one.label === "Counter");
    assert.ok(counter, "the mage may counter");
    const countered = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "mage", optionId: counter!.id, targetIds: [], window: step.state.window!.id },
      roll,
    );
    assert.equal(refused(countered), undefined, JSON.stringify(refused(countered)));
    assert.equal(hurt(countered, "fighter"), 0, "called off");
    assert.equal(countered.state.window, undefined);
    assert.equal(countered.state.order[countered.state.turn], "mage", "the next turn begins");
    // Let go by.
    const passed = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "mage", optionId: RULESET_PASS_OPTION, targetIds: [] },
      roll,
    );
    assert.equal(hurt(passed, "fighter"), 6, "it lands");
    assert.equal(passed.state.window, undefined);
    assert.equal(passed.state.order[passed.state.turn], "mage");
  }

  // ── A chain of answers, counter then the target's own, and the turn still changes after ──
  {
    const state = between(fight({ counter: true, brace: true }));
    const step = buy(state, "cantrip>spells/bolt", { targetIds: ["fighter"] });
    assert.deepEqual(step.state.window?.waiting, ["mage"]);
    const passed = applyRulesetCombatChoice(
      definition,
      step.state,
      { actorId: "mage", optionId: RULESET_PASS_OPTION, targetIds: [] },
      roll,
    );
    assert.deepEqual(passed.state.window?.waiting, ["fighter"], "then the fighter, aimed at");
    assert.ok(passed.state.window?.outer, "holding the same window");
    const landed = applyRulesetCombatChoice(
      definition,
      passed.state,
      { actorId: "fighter", optionId: RULESET_PASS_OPTION, targetIds: [] },
      roll,
    );
    assert.equal(hurt(landed, "fighter"), 6);
    assert.equal(landed.state.window, undefined);
    assert.equal(landed.state.order[landed.state.turn], "mage", "the next turn begins");
  }

  // ── A cast that drops the last of the party says nothing of an end while they roll to live (laptop
  //    pass 8 2026-10-26), and never says it twice ──
  {
    const state = fight({ frail: true });
    who(state, "mage").defeated = true;
    const step = buy(between(state), "cantrip>spells/bolt", { targetIds: ["fighter"] });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(step.events.filter((one) => one.type === "outcome").length, 0, "still rolling to live");
    assert.equal(who(step.state, "fighter").dying, true);
  }

  // ── Refused aims move nothing; nothing of it on its own turn ──
  {
    const state = between(fight());
    const bad = buy(state, "cantrip>spells/bolt", { targetIds: ["lich"] });
    assert.ok(refused(bad), "not at itself");
    assert.equal(refused(bad)!.type === "refused" && refused(bad)!.optionId, "cantrip>spells/bolt");
    assert.equal(bad.state, state, "nothing moved");
    const own = fight();
    own.turn = 2;
    const ids = rulesetCombatOptions(definition, own, "lich").map((one) => one.id);
    assert.ok(!ids.some((id) => id.startsWith("cantrip") || id.startsWith("cast")), ids.join());
    assert.ok(ids.includes("spells/bolt"), "its spells are its own turn's as ever");
  }

  // ── The director buys a cantrip between turns ──
  {
    const withLich = parsed(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
        const entry = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
        entry.id = "lich";
        entry.label = "Lich";
        entry.creature.signaturePoints = 3;
        entry.creature.spellcasting = { toHit: 12, spells: [{ entry: "spells/bolt" }] };
        entry.creature.actions = [{ ...touch, damage: { dice: "1d4" } }, cantrip];
        creatures.entries.push(entry);
      }),
    );
    const bestiary = Object.fromEntries(
      (withLich.catalogs ?? []).flatMap((catalog) => (catalog.entries ? [[catalog.id, catalog.entries]] : [])),
    );
    const creaturesId = (withLich.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const built = createRulesetFight({
      definition: withLich,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "lich", name: "Lich", creature: `${creaturesId}/lich` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(withLich) } }],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
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
      enemies: [unit("lich", "Lich", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    syncRulesetCombatants(withLich, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(withLich, state, { type: "control", unitId: "ada", controller: "ai" }).ok);
    for (let guard = 0; guard < 8 && !state.outcome; guard++) {
      assert.ok(commandRulesetCombatDirector(withLich, state, { type: "continue" }).ok);
    }
    const events = state.rulesetFight!.events.map((entry) => entry.event);
    const bought = events.findIndex(
      (event) =>
        event.type === "signature" && event.actorId === "lich" && String(event.optionId).startsWith("cantrip>"),
    );
    assert.ok(bought >= 0, `the lich bought a cantrip: ${JSON.stringify(events.map((event) => event.type))}`);
    assert.ok(
      events.slice(bought).some((event) => event.type === "damage" && event.targetId === "ada"),
      "and it struck Ada",
    );
  }

  // ── Nor a cantrip that only helps ability checks, again and again on itself (cloud caster bosses
  // 2026-10-26: a priest's legendary Cantrip started Guidance 27 times in one fight) ──
  {
    const withGuide = parsed(
      fiveE((doc) => {
        doc.catalogs
          .find((one: { id: string }) => one.id === "spells")
          .entries.push(
            spell("guide", 0, {
              kind: "buff",
              targets: "ally",
              range: 0,
              concentration: true,
              applies: [{ condition: "guided", duration: { rounds: 10 } }],
            }),
          );
        doc.sheet.live.conditions.push({ id: "guided", label: "Guided", pickable: false });
        doc.combat.conditions.push({ condition: "guided", modifiers: [{ to: "checks", dice: "1d4", rescue: true }] });
        const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
        const entry = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
        entry.id = "lich";
        entry.label = "Lich";
        entry.creature.signaturePoints = 3;
        entry.creature.spellcasting = { toHit: 12, spells: [{ entry: "spells/guide" }] };
        entry.creature.actions = [{ ...touch, damage: { dice: "1d4" } }, cantrip];
        creatures.entries.push(entry);
      }),
    );
    const bestiary = Object.fromEntries(
      (withGuide.catalogs ?? []).flatMap((catalog) => (catalog.entries ? [[catalog.id, catalog.entries]] : [])),
    );
    const creaturesId = (withGuide.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const built = createRulesetFight({
      definition: withGuide,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "lich", name: "Lich", creature: `${creaturesId}/lich` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(withGuide) } }],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
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
      enemies: [unit("lich", "Lich", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    syncRulesetCombatants(withGuide, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(withGuide, state, { type: "control", unitId: "ada", controller: "ai" }).ok);
    for (let guard = 0; guard < 8 && !state.outcome; guard++) {
      assert.ok(commandRulesetCombatDirector(withGuide, state, { type: "continue" }).ok);
    }
    const said = JSON.stringify(state.rulesetFight!.events.map((entry) => entry.event));
    assert.doesNotMatch(said, /Cantrip: Guide|"label":"Guide"/, "no Guide cast");
  }

  // ── Import refusals ──
  {
    const withCreature = (action: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [
          {
            id: "d",
            label: "D",
            creature: {
              health: 10,
              defense: 10,
              initiativeModifier: 0,
              speed: 30,
              tier: "cr_0",
              signaturePoints: 3,
              actions: [{ id: "a", name: "A", budget: "action", ...action }],
            },
          },
        ],
      });
    };
    parsed(fiveE(withCreature({ signature: { cost: 1 }, casting: { cantripsOnly: true } })));
    parsed(fiveE(withCreature({ signature: { cost: 3 }, casting: {} })));
    refusedDoc(withCreature({ casting: {} }), /A cast is bought with points between turns/);
    refusedDoc(
      withCreature({ signature: { cost: 1 }, casting: {}, damage: { dice: "1d6" }, toHit: 4 }),
      /A cast is the spell it casts, so it carries no/,
    );
    refusedDoc(withCreature({ signature: { cost: 1 }, casting: { only: "cantrips" } }), /only/);
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
    const gate = "A ruleset with a legendary cast requires schemaVersion 2 and capabilityApi 1.284 or newer";
    const doc = fiveE((doc) =>
      doc.catalogs.push({ id: "x", label: "X", entries: [{ id: "a", label: "A", creature: { actions: [cantrip] } }] }),
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(283) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(284) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(283) as never, fiveE()), gate, "the plain 5e example");
    // A builder's stamp of a "casting" column is not one.
    const stamp = fiveE((doc) => (doc.sheet.stampExample = { stamp: { casting: { fromWithin: "ability" } } }));
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(283) as never, stamp), gate, "a casting stamp");
  }

  console.log(
    "Ruleset legendary casts: a lich casts a cantrip between turns and a sphinx any spell, aimed and paid as on its own turn; a Counterspell answers it and the next turn still begins.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
