/**
 * Reckless Attack and Brutal Critical (Capability API 1.247).
 *
 *   - `beforeAttack`: an entry offered only on its holder's own turn before they have attacked in it.
 *   - A change to attacks narrowed by `attacks` (weapon or spell) and `blow` (melee or ranged), with
 *     `ability`: Reckless Attack's advantage on melee weapon attacks with Strength, and attacks
 *     against the barbarian rolled with advantage until their next turn.
 *   - A damage change's `criticalDice`: on a critical only, more of the blow's own dice, not doubled.
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
  rulesetAttackMode,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-reckless-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 242);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const reckless = {
    id: "reckless-attack",
    label: "Reckless Attack",
    rows: [{ list: "features", values: { name: "Reckless Attack" } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      free: true,
      beforeAttack: true,
      applies: [
        { condition: "reckless", duration: { rounds: 1 } },
        { condition: "exposed", duration: { rounds: 1, at: "turn-start" } },
      ],
    },
  };
  const features = [reckless] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "reckless", label: "Reckless" },
      { id: "exposed", label: "Exposed" },
      { id: "brutal", label: "Brutal" },
      { id: "focused", label: "Focused" },
      { id: "steady", label: "Steady" },
    );
    doc.combat.conditions.push(
      {
        condition: "reckless",
        effects: [],
        modifiers: [{ to: "attacks", mode: "advantage", ability: "str", attacks: "weapon", blow: "melee" }],
      },
      { condition: "exposed", effects: ["attacks-against-advantage"] },
      {
        condition: "brutal",
        effects: [],
        modifiers: [{ to: "damage", criticalDice: 1, attacks: "weapon", blow: "melee" }],
      },
      { condition: "focused", effects: [], modifiers: [{ to: "attacks", flat: 10, attacks: "spell" }] },
      { condition: "steady", effects: [], modifiers: [{ to: "attacks", flat: 3, blow: "ranged" }] },
    );
    doc.catalogs.push({ id: "barbarian", label: "Barbarian", feeds: ["features"], entries: structuredClone(features) });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  let d20 = 15;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const block = (defense = 5): RulesetStatBlock =>
    ({
      health: 80,
      defense,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 0, reach: 5, damage: { count: 0, sides: 0, flat: 1 } },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (defense = 5): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "barb",
          name: "Barb",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 18, dex: 14, con: 16, int: 8, wis: 10, cha: 8 },
            fields: { level: 9, ac: 15, speed: 40, hp_max: 90 },
            lists: {
              attacks: [
                { name: "Greataxe", ability: "str", proficient: true, bonus: 0, damage: "1d12", reach: 5 },
                {
                  name: "Longbow",
                  ability: "dex",
                  proficient: true,
                  bonus: 0,
                  damage: "1d8",
                  range: 150,
                  long_range: 600,
                },
                { name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 },
                { name: "Javelin", ability: "str", proficient: true, bonus: 0, damage: "1d6", range: 30 },
              ],
              features: features.flatMap((entry) =>
                rowsFromCatalogEntry("barbarian", entry).flatMap((one) => (one.list === "features" ? [one.row] : [])),
              ),
            },
          }),
          live: {},
          catalogs: { barbarian: features },
        },
        { id: "foe", name: "Foe", side: "enemy", block: block(defense) },
      ],
    });
    state.order = ["barb", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id = "barb") => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const option = (state: RulesetEncounterState, label: string, actorId = "barb") =>
    rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
  const take = (state: RulesetEncounterState, label: string, targetIds: string[], actorId = "barb") => {
    const found = option(state, label, actorId);
    assert.ok(found, `no ${label}`);
    const step = applyRulesetCombatChoice(definition, state, { actorId, optionId: found.id, targetIds }, roll);
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const end = (state: RulesetEncounterState, actorId: string) =>
    applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId,
        optionId: rulesetCombatOptions(definition, state, actorId).find((one) => one.kind === "end-turn")!.id,
        targetIds: [],
      },
      roll,
    ).state;
  const mode = (state: RulesetEncounterState, label: string, actorId = "barb", targetId = "foe") =>
    rulesetAttackMode(definition, definition.combat!, who(state, actorId), who(state, targetId), {
      state,
      optionId: option(state, label, actorId)!.id,
    });
  const holds = (state: RulesetEncounterState) => rulesetCombatConditions(definition, who(state));

  // ── Reckless Attack: chosen before the first attack, never after ──
  {
    const state = fight();
    assert.ok(option(state, "Reckless Attack"));
    const attacked = take(state, "Greataxe", ["foe"]).state;
    assert.equal(option(attacked, "Reckless Attack"), undefined, "after an attack it is too late");
    // Not on somebody else's turn either.
    const theirs = fight();
    theirs.turn = 1;
    assert.equal(option(theirs, "Reckless Attack"), undefined);
  }

  // ── Advantage on melee weapon attacks with Strength; attacks against the barbarian too ──
  {
    const reckless = take(fight(), "Reckless Attack", ["barb"]).state;
    assert.deepEqual(holds(reckless).sort(), ["exposed", "reckless"]);
    assert.equal(mode(reckless, "Greataxe"), "advantage");
    assert.equal(mode(reckless, "Dagger"), "normal", "a Dexterity attack");
    assert.equal(mode(reckless, "Longbow"), "normal", "no melee blow");
    assert.equal(mode(reckless, "Javelin"), "normal", "a Strength blow from afar");
    assert.equal(mode(fight(), "Greataxe"), "normal");
    // The barbarian's turn ends: their own advantage goes; attacks against them keep it.
    const theirTurn = end(reckless, "barb");
    assert.deepEqual(holds(theirTurn), ["exposed"]);
    assert.equal(mode(theirTurn, "Claw", "foe", "barb"), "advantage");
    // Until the barbarian's next turn.
    const back = end(theirTurn, "foe");
    assert.deepEqual(holds(back), []);
  }

  // ── Changes to attacks narrowed by kind: the menu's chance and the roll read the same ──
  {
    const narrowed = (condition: string) => {
      const state = fight(25);
      who(state).tracked.push({ condition, rounds: null });
      return state;
    };
    const chance = (state: RulesetEncounterState, label: string) => option(state, label)!.forecast!.hitChance;
    const total = (state: RulesetEncounterState, label: string) =>
      of(take(state, label, ["foe"]).events, "attack")[0]!.total;
    // A spell's change leaves weapons alone.
    assert.equal(chance(narrowed("focused"), "Greataxe"), chance(fight(25), "Greataxe"));
    assert.equal(total(narrowed("focused"), "Greataxe"), total(fight(25), "Greataxe"));
    // A change to blows from afar reaches the bow and the thrown javelin, not the axe.
    assert.equal(total(narrowed("steady"), "Greataxe"), total(fight(25), "Greataxe"));
    assert.equal(total(narrowed("steady"), "Longbow"), total(fight(25), "Longbow") + 3);
    assert.ok(chance(narrowed("steady"), "Longbow")! > chance(fight(25), "Longbow")!);
    assert.equal(chance(narrowed("steady"), "Greataxe"), chance(fight(25), "Greataxe"));
  }

  // ── Brutal Critical: one more weapon die on a critical, not doubled; nothing on a plain hit ──
  {
    const brutal = () => {
      const state = fight();
      who(state).tracked.push({ condition: "brutal", rounds: null });
      return state;
    };
    const hp = (state: RulesetEncounterState) =>
      rulesetCombatHealth(definition, definition.combat!, who(state, "foe")).value;
    d20 = 20;
    const critical = take(brutal(), "Greataxe", ["foe"]);
    assert.equal(80 - hp(critical.state), 3 + 3 + 4 + 3, "2d12 + 4, then 1d12");
    const plainCritical = take(fight(), "Greataxe", ["foe"]);
    assert.equal(80 - hp(plainCritical.state), 3 + 3 + 4);
    const bow = take(brutal(), "Longbow", ["foe"]);
    assert.equal(80 - hp(bow.state), 3 + 3 + 2, "a bow is no melee blow");
    d20 = 15;
    assert.equal(80 - hp(take(brutal(), "Greataxe", ["foe"]).state), 3 + 4);
  }

  // ── Import refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const rule = (doc: Record<string, any>, id: string) =>
      doc.combat.conditions.find((one: { condition: string }) => one.condition === id).modifiers[0];
    refused((doc) => (rule(doc, "brutal").to = "attacks"), /"criticalDice" changes the damage a blow deals only/);
    refused((doc) => (rule(doc, "reckless").to = "saves"), /"blow" narrows damage, attacks or defense only/);
    refused((doc) => (rule(doc, "brutal").criticalDice = 9), /criticalDice/);
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
      "A ruleset with uses offered only before the holder's first attack, changes to attacks narrowed to a kind of blow, or more dice on a critical requires schemaVersion 2 and capabilityApi 1.247 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [
      { mechanics: { beforeAttack: true } },
      { modifiers: [{ to: "attacks", mode: "advantage", blow: "melee" }] },
      { modifiers: [{ to: "attacks", flat: 1, attacks: "weapon" }] },
      { modifiers: [{ to: "damage", criticalDice: 1 }] },
    ]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(246, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(247, document), gate);
    }
    // A damage change narrowed to a blow is older than this.
    const older = structuredClone(without);
    older.extra = { entry: { modifiers: [{ to: "damage", flat: 2, blow: "melee" }] } };
    assert.notEqual(issue(246, older), gate);
    assert.notEqual(issue(246, without), gate);
    assert.equal(issue(246, without, new Map([["barbarian.json", { entries: [reckless] }]])), gate);
  }

  console.log(
    "Ruleset reckless: Reckless Attack before the first attack gives advantage on Strength melee weapon attacks this turn and to attacks against the barbarian until their next, and Brutal Critical adds a weapon die to criticals; gated at 1.247.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
