/**
 * Left over from 1.307 and 1.309 (Capability API 1.311).
 *
 *   - An item's use may put conditions on its own reader (`appliesSelf`): a scroll of Sunbeam leaves
 *     the mote in its reader's hand.
 *   - A creature's action may be aimed only at the dying (`dyingOnly`), kill a target that fails its
 *     save (`slaysOnFailedSave`) and give its maker health for each (`healsOnSlay`): a will-o'-wisp's
 *     Consume Life, which also ends its invisibility.
 *   - A condition's rule may end it when its holder moves or acts (`endsWhenHolder`), however it was
 *     put on, sheet included: Hide in Plain Sight's camouflage.
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
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-leftovers-306-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 306);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const scrollUse = (extra: Record<string, unknown> = {}) => ({
    kind: "attack",
    budget: "action",
    range: 60,
    autoHit: true,
    amount: { flat: 2 },
    damageType: "radiant",
    concentration: true,
    appliesSelf: [{ condition: "mote", duration: { rounds: 10 } }],
    ...extra,
  });
  const scroll = (use: Record<string, unknown>) => ({
    id: "sunbeam-scroll",
    label: "Scroll of Sunbeam",
    item: { category: "gear", use },
  });
  const consumeLife = {
    id: "consume_life",
    name: "Consume Life",
    budget: "bonus",
    reach: 5,
    autoHit: true,
    dyingOnly: true,
    save: { save: "con_save", difficulty: 10, onSuccess: "negates" },
    slaysOnFailedSave: true,
    healsOnSlay: { flat: 10 },
  };
  const wisp = {
    id: "wisp",
    label: "Will-o'-Wisp",
    creature: {
      tier: "cr_2",
      health: 22,
      defense: 19,
      initiativeModifier: 0,
      actions: [
        {
          id: "invisibility",
          name: "Invisibility",
          budget: "action",
          self: true,
          concentration: true,
          applies: [{ condition: "invisible", duration: { rounds: 100 }, endsWhenHolder: { uses: ["consume_life"] } }],
        },
        { id: "shock", name: "Shock", budget: "action", autoHit: true, reach: 5, damage: { flat: 10 } },
        consumeLife,
      ],
    },
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "mote", label: "Mote" }, { id: "camouflaged", label: "Camouflaged" });
    doc.combat.conditions.push(
      { condition: "mote", effects: [] },
      { condition: "camouflaged", effects: [], endsWhenHolder: { moves: true, acts: true } },
    );
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [scroll(scrollUse())] });
    doc.catalogs.push({ id: "fey", label: "Fey", holds: "creatures", entries: [structuredClone(wisp)] });
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
  const optionsOf = (state: RulesetEncounterState, actorId: string) => {
    state.turn = state.order.indexOf(actorId);
    const actor = rulesetCombatant(state, actorId)!;
    for (const key of Object.keys(actor.budgets)) actor.budgets[key] = 9;
    return rulesetCombatOptions(definition, state, actorId);
  };
  const choose = (
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    targetIds: string[],
    extra: Record<string, unknown> = {},
  ): RulesetCombatStep => {
    const option = optionsOf(state, actorId).find((one) => one.label === label || one.id === label);
    assert.ok(option, `no ${label} for ${actorId}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds, ...extra },
      roll,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const holds = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, id)!).includes(condition);
  const sheet = (hp = 30) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      fields: { level: 5, ac: 10, speed: 30, hp_max: hp },
    });
  const grid = { width: 12, height: 5, tiles: Array.from({ length: 5 }, () => Array(12).fill("plains")) } as never;

  // ── A scroll of Sunbeam ──
  {
    const item = definition.catalogs!.find((one) => one.id === "gear")!.entries![0]!.item as RulesetCatalogItem;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "reader",
          name: "Reader",
          side: "party",
          build: sheet(),
          live: {},
          items: [{ item, quantity: 1, worn: false, name: "Scroll of Sunbeam" }],
        },
        {
          id: "a",
          name: "A",
          side: "enemy",
          block: { health: 50, defense: 5, initiativeModifier: 0, speed: 30, actions: [] },
        },
      ],
      board: { grid, placements: { reader: { x: 2, y: 2 }, a: { x: 4, y: 2 } } },
    });
    state.order = ["reader", "a"];
    state.turn = 0;
    const label = optionsOf(state, "reader").find((one) => one.label.includes("Sunbeam"))!.label;
    const read = choose(state, "reader", label, ["a"]);
    const mote = rulesetCombatant(read.state, "reader")!.tracked.find((one) => one.condition === "mote");
    assert.ok(mote, "the mote is on its reader");
    assert.equal(mote.concentration, true, "held by the reading's concentration");
    assert.equal(holds(read.state, "a", "mote"), false, "and not on its target");
    assert.ok(
      of(read.events, "damage").some((one) => one.targetId === "a"),
      "the first beam lands",
    );
  }

  // ── Consume Life ──
  {
    const block = rulesetCreatureBlock(definition, definition.catalogs!.find((one) => one.id === "fey")!.entries![0]);
    assert.ok(block);
    const fight = () => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        combatants: [
          { id: "hero", name: "Hero", side: "party", build: sheet(10), live: {} },
          { id: "friend", name: "Friend", side: "party", build: sheet(), live: {} },
          { id: "wisp", name: "Will-o'-Wisp", side: "enemy", block },
        ],
        board: { grid, placements: { hero: { x: 3, y: 2 }, friend: { x: 3, y: 3 }, wisp: { x: 4, y: 2 } } },
      });
      state.order = ["wisp", "hero", "friend"];
      state.turn = 0;
      return state;
    };
    const consume = (state: RulesetEncounterState) =>
      optionsOf(state, "wisp").find((one) => one.label === "Consume Life")!;
    let state = fight();
    assert.deepEqual(rulesetOptionTargets(definition, state, "wisp", consume(state)), [], "nobody is dying yet");
    state = choose(state, "wisp", "Invisibility", []).state;
    state = choose(state, "wisp", "Shock", ["hero"]).state;
    const hero = rulesetCombatant(state, "hero")!;
    assert.ok(hero.down && !hero.defeated, "the hero is dying");
    assert.deepEqual(rulesetOptionTargets(definition, state, "wisp", consume(state)), ["hero"], "only the dying");
    // Hurt by its own Shock first so that the heal shows.
    rulesetCombatant(state, "wisp")!.health!.value = 5;
    // A save made: nothing.
    d20 = 20;
    const spared = choose(structuredClone(state), "wisp", "Consume Life", ["hero"]);
    assert.equal(rulesetCombatant(spared.state, "hero")!.defeated, false, "a made save spares it");
    assert.equal(rulesetCombatant(spared.state, "wisp")!.health!.value, 5, "and feeds nothing");
    assert.equal(holds(spared.state, "wisp", "invisible"), false, "using it ends the invisibility all the same");
    // Even where a made save leaves the rest of it standing, only a failed one kills.
    const standing = structuredClone(state);
    const action = rulesetCombatant(standing, "wisp")!.actions.find((one) => one.label === "Consume Life")!;
    action.save = { ...action.save!, onSuccess: "none" };
    assert.equal(
      rulesetCombatant(choose(standing, "wisp", "Consume Life", ["hero"]).state, "hero")!.defeated,
      false,
      "a made save spares it whatever else it says",
    );
    // A save failed: dead, and the wisp fed.
    d20 = 1;
    const eaten = choose(state, "wisp", "Consume Life", ["hero"]);
    assert.equal(rulesetCombatant(eaten.state, "hero")!.defeated, true, "a failed save kills");
    assert.ok(of(eaten.events, "slain").some((one) => one.targetId === "hero"));
    assert.equal(rulesetCombatant(eaten.state, "wisp")!.health!.value, 15, "the wisp regains 10");
    assert.ok(of(eaten.events, "heal").some((one) => one.targetId === "wisp" && one.amount === 10));
  }

  // ── Camouflage wears off ──
  {
    const fight = () => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        combatants: [
          { id: "ranger", name: "Ranger", side: "party", build: sheet(), live: { conditions: ["camouflaged"] } },
          {
            id: "foe",
            name: "Foe",
            side: "enemy",
            block: {
              health: 50,
              defense: 5,
              initiativeModifier: 0,
              speed: 30,
              actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { flat: 1 } }],
            },
          },
        ],
        board: { grid, placements: { ranger: { x: 2, y: 2 }, foe: { x: 3, y: 2 } } },
      });
      state.order = ["ranger", "foe"];
      state.turn = 0;
      return state;
    };
    const state = fight();
    assert.ok(holds(state, "ranger", "camouflaged"), "camouflaged from the sheet");
    const hidden = choose(state, "ranger", "standard:hide", []);
    assert.ok(holds(hidden.state, "ranger", "camouflaged"), "hiding is what it is for");
    optionsOf(hidden.state, "ranger");
    const walked = applyRulesetCombatChoice(
      definition,
      hidden.state,
      { actorId: "ranger", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 2, y: 4 } },
      roll,
    );
    assert.equal(of(walked.events, "refused").length, 0, JSON.stringify(walked.events));
    assert.equal(holds(walked.state, "ranger", "camouflaged"), false, "a step ends it");
    assert.ok(
      !(rulesetCombatant(walked.state, "ranger")!.sheet!.live.conditions ?? []).includes("camouflaged"),
      "off the sheet too",
    );
    const struck = choose(fight(), "ranger", "standard:dodge", []);
    assert.equal(holds(struck.state, "ranger", "camouflaged"), false, "so does an action");
  }

  // ── Refusals ──
  refusedDoc(
    fiveE((doc) => {
      doc.catalogs.find((one: { id: string }) => one.id === "gear").entries = [
        scroll(scrollUse({ appliesSelf: [{ condition: "nope", duration: { rounds: 1 } }] })),
      ];
    }),
    /Unknown condition "nope"/,
  );
  const withWisp = (change: (action: Record<string, unknown>) => void) =>
    fiveE((doc) => {
      change(doc.catalogs.find((one: { id: string }) => one.id === "fey").entries[0].creature.actions[2]);
    });
  refusedDoc(
    withWisp((action) => {
      delete action.save;
    }),
    /"slaysOnFailedSave" follows the action's own save/,
  );
  refusedDoc(
    withWisp((action) => {
      delete action.slaysOnFailedSave;
    }),
    /"healsOnSlay" is given back for a target slain/,
  );
  refusedDoc(
    fiveE((doc) => {
      doc.combat.conditions.find((one: { condition: string }) => one.condition === "camouflaged").endsWhenHolder = {};
    }),
    /Say what ends it/,
  );

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
      "A ruleset with an item use that puts conditions on its reader, creature actions that slay the dying, or conditions a rule ends when their holder moves or acts requires schemaVersion 2 and capabilityApi 1.311 or newer";
    const base = () => JSON.parse(fiveEText) as Record<string, any>;
    const withEntries = (doc: Record<string, any>, catalog: Record<string, unknown>) => {
      doc.catalogs.push(catalog);
      return doc;
    };
    const itemDoc = () => {
      const doc = base();
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      return doc;
    };
    const plainScroll = scroll(scrollUse({ appliesSelf: undefined, concentration: undefined }));
    const quietWisp = structuredClone(wisp) as Record<string, any>;
    quietWisp.creature.actions = quietWisp.creature.actions.slice(1, 2);
    const ruled = base();
    ruled.combat.conditions[0].endsWhenHolder = { moves: true };
    for (const doc of [
      withEntries(itemDoc(), { id: "gear", label: "Gear", holds: "items", entries: [scroll(scrollUse())] }),
      withEntries(base(), { id: "fey", label: "Fey", holds: "creatures", entries: [wisp] }),
      ruled,
    ]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(310) as never, doc), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(311) as never, doc), gate);
    }
    for (const doc of [
      base(),
      withEntries(itemDoc(), { id: "gear", label: "Gear", holds: "items", entries: [plainScroll] }),
      withEntries(base(), { id: "fey", label: "Fey", holds: "creatures", entries: [quietWisp] }),
    ]) {
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(310) as never, doc), gate, "nothing new, no gate");
    }
  }

  console.log(
    "Leftovers 306: a scroll of Sunbeam's mote on its reader, a will-o'-wisp's Consume Life at the dying only, killing on a failed save and feeding it, camouflage gone on a step or an action; refusals; gated at 1.311.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
