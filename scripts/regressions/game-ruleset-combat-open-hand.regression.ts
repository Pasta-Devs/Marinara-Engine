/**
 * Open Hand Technique (Capability API 1.248).
 *
 *   - A `hit` moment's `budget`: only a hit by a strike paid for from that budget opens it, so the
 *     riders answer Flurry of Blows' strikes and no other unarmed strike.
 *   - A reaction's `oneOf`: of the holder's answers sharing it, one is taken per hit; the next hit
 *     offers them all again.
 *   - The three riders: a Dexterity save or prone, a Strength save or pushed, no reactions.
 *   - A hit the target's own answer (a Parry) turned into a miss offers the riders nothing to ride.
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
  RULESET_PASS_OPTION,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-open-hand-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 243);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const martialArts = {
    id: "martial-arts",
    label: "Martial Arts",
    rows: [{ list: "features", values: { name: "Martial Arts" } }],
    mechanics: {
      kind: "utility",
      grantsStrike: { budget: "bonus", names: ["Unarmed Strike"], afterAttack: true },
    },
  };
  const flurry = {
    id: "flurry-of-blows",
    label: "Flurry of Blows",
    rows: [
      { list: "features", values: { name: "Flurry of Blows" } },
      { list: "counters", values: { name: "Ki", max: 5, recharge: "short" } },
    ],
    mechanics: {
      kind: "utility",
      targets: "self",
      budget: "bonus",
      usesOf: "Ki",
      afterAttack: true,
      gives: [{ budget: "flurry", count: 2 }],
      grantsStrike: { budget: "flurry", names: ["Unarmed Strike"] },
    },
  };
  const onFlurry = { on: "hit", by: "self", budget: "flurry", at: "target", oneOf: "open-hand" };
  const topple = {
    id: "open-hand-topple",
    label: "Open Hand: Topple",
    rows: [{ list: "features", values: { name: "Open Hand: Topple" } }],
    mechanics: {
      kind: "debuff",
      free: true,
      reaction: onFlurry,
      save: { save: "dex_save", onSuccess: "none" },
      applies: [{ condition: "prone", duration: { rounds: 100 } }],
    },
  };
  const shove = {
    id: "open-hand-push",
    label: "Open Hand: Push",
    rows: [{ list: "features", values: { name: "Open Hand: Push" } }],
    mechanics: {
      kind: "debuff",
      free: true,
      reaction: onFlurry,
      save: { save: "str_save", onSuccess: "none" },
      push: 15,
    },
  };
  const shaken = {
    id: "open-hand-shaken",
    label: "Open Hand: No Reactions",
    rows: [{ list: "features", values: { name: "Open Hand: No Reactions" } }],
    mechanics: {
      kind: "debuff",
      free: true,
      reaction: onFlurry,
      applies: [{ condition: "unreacting", duration: { rounds: 1, at: "turn-start", of: "source" } }],
    },
  };
  const features = [martialArts, flurry, topple, shove, shaken] as unknown as RulesetCatalogEntry[];
  const riders = ["Open Hand: Topple", "Open Hand: Push", "Open Hand: No Reactions"];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.economy.budgets.push({ id: "flurry", label: "Flurry", per: "turn", count: 0 });
    doc.sheet.live.conditions.push({ id: "unreacting", label: "Unreacting" });
    doc.combat.conditions.push({ condition: "unreacting", effects: ["cannot-react"] });
    Object.assign(
      doc.combat.abilities.find((one: { list: string }) => one.list === "features"),
      { saveDifficulty: { derived: "spell_save_dc" } },
    );
    doc.catalogs.push({
      id: "monk",
      label: "Monk",
      feeds: ["features", "counters"],
      entries: structuredClone(features),
    });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  // Hits a defense of 5 with the monk's +7, and fails a save against their DC 14 with no bonus.
  const roll = (sides: number) => (sides === 20 ? 5 : 3);
  const block = (): RulesetStatBlock =>
    ({ health: 200, defense: 5, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const rows = (list: string) =>
    features.flatMap((entry) =>
      rowsFromCatalogEntry("monk", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const fight = (foe: RulesetStatBlock = block()): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "monk",
          name: "Monk",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 18, con: 12, int: 10, wis: 16, cha: 8 },
            fields: { level: 9, ac: 17, speed: 45, hp_max: 60, spellcasting_ability: "wis" },
            lists: {
              attacks: [
                { name: "Unarmed Strike", ability: "dex", proficient: true, bonus: 0, damage: "1d6", reach: 5 },
              ],
              features: rows("features"),
              counters: rows("counters"),
            },
          }),
          live: {},
          catalogs: { monk: features },
        },
        { id: "foe", name: "Foe", side: "enemy", block: foe },
      ],
    });
    state.order = ["monk", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id = "monk") => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const choose = (state: RulesetEncounterState, optionId: string, targetIds: string[] = []) => {
    const step = applyRulesetCombatChoice(definition, state, { actorId: "monk", optionId, targetIds }, roll);
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    delete who(step.state).strikesLeft;
    return step;
  };
  const take = (state: RulesetEncounterState, label: string, budget?: string, targetIds = ["foe"]) => {
    const menu = rulesetCombatOptions(definition, state, "monk");
    const option = menu.find((one) => one.label === label && (budget === undefined || one.budget === budget));
    assert.ok(option, `no ${label}@${budget}: ${menu.map((one) => `${one.label}@${one.budget}`)}`);
    return choose(state, option.id, label === "Flurry of Blows" ? ["monk"] : targetIds);
  };
  const answers = (state: RulesetEncounterState) =>
    rulesetWindowOptions(definition, state, "monk").map((one) => one.label);
  const answer = (state: RulesetEncounterState, label: string) => {
    const option = rulesetWindowOptions(definition, state, "monk").find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${answers(state)}`);
    return choose(state, option.id);
  };
  const pass = (state: RulesetEncounterState) => choose(state, RULESET_PASS_OPTION);
  const flurried = () => take(take(fight(), "Unarmed Strike", "action").state, "Flurry of Blows").state;
  const holds = (state: RulesetEncounterState) => rulesetCombatConditions(definition, who(state, "foe"));

  // ── Only a strike Flurry of Blows paid for opens the riders ──
  {
    const attack = take(fight(), "Unarmed Strike", "action");
    assert.equal(attack.state.window, undefined, "the attack action's own strike");
    const bonus = take(attack.state, "Unarmed Strike", "bonus");
    assert.equal(bonus.state.window, undefined, "Martial Arts' bonus strike");
    const first = take(flurried(), "Unarmed Strike", "flurry");
    assert.equal(first.state.window?.trigger.kind, "hit");
    assert.deepEqual(answers(first.state), riders);
  }

  // ── One rider per hit; the next hit offers all three again ──
  {
    const first = take(flurried(), "Unarmed Strike", "flurry");
    const toppled = answer(first.state, "Open Hand: Topple");
    assert.equal(of(toppled.events, "save")[0]?.save, "dex_save");
    assert.equal(toppled.state.window, undefined, "the other two went with it");
    assert.deepEqual(holds(toppled.state), ["prone"]);
    const second = take(toppled.state, "Unarmed Strike", "flurry");
    assert.deepEqual(answers(second.state), riders);
    const pushed = answer(second.state, "Open Hand: Push");
    assert.equal(of(pushed.events, "save")[0]?.save, "str_save");
    assert.equal(pushed.state.window, undefined);
    // A pass takes none of them.
    const passed = pass(take(flurried(), "Unarmed Strike", "flurry").state);
    assert.deepEqual(holds(passed.state), []);
  }

  // ── No reactions until the monk's next turn ──
  {
    const first = take(flurried(), "Unarmed Strike", "flurry");
    const shook = answer(first.state, "Open Hand: No Reactions");
    assert.deepEqual(holds(shook.state), ["unreacting"]);
  }

  // ── A hit its target's Parry turns into a miss takes no rider (cheap-GM playtest 2026-10-26: Open
  //    Hand Technique knocked a captain prone on a hit his Parry then turned into a miss) ──
  {
    const total = take(flurried(), "Unarmed Strike", "flurry").state.window?.trigger;
    assert.ok(total?.kind === "hit");
    // Hit exactly at its defense: two more, and the same roll misses.
    const parrier = {
      ...block(),
      defense: total.total,
      actions: [
        {
          id: "parry",
          name: "Parry",
          budget: "reaction",
          self: true,
          reaction: { on: "hit" },
          applies: [{ condition: "parrying", duration: { rounds: 1 }, endsAfter: "attacked" }],
        },
      ],
    } as unknown as RulesetStatBlock;
    const foeAnswers = (state: RulesetEncounterState) => rulesetWindowOptions(definition, state, "foe");
    const foePasses = (state: RulesetEncounterState) =>
      state.window
        ? applyRulesetCombatChoice(
            definition,
            state,
            { actorId: "foe", optionId: RULESET_PASS_OPTION, targetIds: [] },
            roll,
          ).state
        : state;
    // The attack action's own strike hits too, and the foe lets that one through.
    const hitParrier = () =>
      take(
        take(foePasses(take(fight(parrier), "Unarmed Strike", "action").state), "Flurry of Blows").state,
        "Unarmed Strike",
        "flurry",
      );
    const struck = hitParrier();
    assert.equal(struck.state.window?.waiting[0], "foe", "the one hit answers before the hit's maker");
    const parry = foeAnswers(struck.state).find((one) => one.label === "Parry");
    assert.ok(parry, `the foe can parry: ${foeAnswers(struck.state).map((one) => one.label)}`);
    const parried = applyRulesetCombatChoice(
      definition,
      struck.state,
      { actorId: "foe", optionId: parry.id, targetIds: [] },
      roll,
    );
    assert.deepEqual(answers(parried.state), [], "no rider on a hit that now misses");
    assert.equal(parried.state.window, undefined, "the window closes with nothing left to answer");
    assert.ok(!holds(parried.state).includes("prone"), "the parried foe is not knocked down");
    assert.equal(of(parried.events, "recheck")[0]?.outcome, "miss");
    // Not parried, the hit stands and the riders are offered.
    const unparried = applyRulesetCombatChoice(
      definition,
      hitParrier().state,
      { actorId: "foe", optionId: RULESET_PASS_OPTION, targetIds: [] },
      roll,
    );
    assert.deepEqual(answers(unparried.state), riders);
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
    const reaction = (doc: Record<string, any>) =>
      doc.catalogs.find((one: { id: string }) => one.id === "monk").entries[2].mechanics.reaction;
    refused((doc) => (reaction(doc).budget = "nothing"), /Unknown budget "nothing"/);
    refused((doc) => (reaction(doc).on = "aimed"), /"budget" narrows a hit, so it is on a "hit" moment/);
    refused((doc) => delete reaction(doc).by, /"oneOf" picks among answers to its holder's own hit/);
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
      "A ruleset with answers to a hit by a strike from one budget, or one answer of a group per hit, requires schemaVersion 2 and capabilityApi 1.248 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [
      { reaction: { on: "hit", by: "self", budget: "flurry" } },
      { reaction: { on: "hit", by: "self", oneOf: "open-hand" } },
    ]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(247, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(248, document), gate);
    }
    // A mechanics' own budget is older than this.
    const older = structuredClone(without);
    older.extra = { entry: { budget: "bonus", reaction: { on: "hit", by: "self" } } };
    assert.notEqual(issue(247, older), gate);
    assert.notEqual(issue(247, without), gate);
    assert.equal(issue(247, without, new Map([["monk.json", { entries: [topple] }]])), gate);
  }

  console.log(
    "Ruleset open hand: only Flurry of Blows' strikes open Open Hand Technique, one of its three riders per hit (prone, pushed, no reactions); gated at 1.248.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
