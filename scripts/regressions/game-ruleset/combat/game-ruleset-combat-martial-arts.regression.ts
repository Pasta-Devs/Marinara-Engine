/**
 * Martial Arts, Flurry of Blows and Ki-Empowered Strikes (Capability API 1.242).
 *
 *   - `attackRows`, held: the rows it names hit and deal damage with the best of their own ability
 *     and its `abilities`, roll its die (by monk level) where that is the better, and carry its
 *     `qualities`, while its `when` holds.
 *   - `grantsStrike`, held: one strike with another budget once the attack's own is spent, only
 *     with the attacks it names and, with `afterAttack`, only after the attack action.
 *   - `afterAttack` on an entry: Flurry of Blows is offered only after the attack action; it gives
 *     two of a count-0 budget its own `grantsStrike` spends on unarmed strikes.
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
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-martial-arts-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 237);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const monkWeapons = ["Unarmed Strike", "Shortsword"];
  const martialArts = {
    id: "martial-arts",
    label: "Martial Arts",
    rows: [{ list: "features", values: { name: "Martial Arts" } }],
    mechanics: {
      kind: "utility",
      attackRows: [
        {
          names: monkWeapons,
          abilities: ["str", "dex"],
          die: {
            from: { field: "level" },
            table: [
              [1, 4],
              [5, 6],
              [11, 8],
              [17, 10],
            ],
          },
          // Standing in for "no armor and no shield": a sheet value the fight reads.
          when: { value: { field: "hp_max" }, atMost: 100 },
        },
      ],
      grantsStrike: { budget: "bonus", names: ["Unarmed Strike"], afterAttack: { names: monkWeapons } },
    },
  };
  const kiStrikes = {
    id: "ki-empowered-strikes",
    label: "Ki-Empowered Strikes",
    rows: [{ list: "features", values: { name: "Ki-Empowered Strikes" } }],
    mechanics: { kind: "utility", attackRows: [{ names: ["unarmed strike"], qualities: ["magical"] }] },
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
  const features = [martialArts, kiStrikes, flurry] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.economy.budgets.push({ id: "flurry", label: "Flurry", per: "turn", count: 0 });
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
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const block = (): RulesetStatBlock =>
    ({ health: 200, defense: 5, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const row = (name: string, damage: string, type: string) => ({
    name,
    ability: "str",
    proficient: true,
    bonus: 0,
    damage,
    damage_type: type,
    reach: 5,
  });
  const rows = (list: string) =>
    features.flatMap((entry) =>
      rowsFromCatalogEntry("monk", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const fight = (fields: Record<string, number> = {}, held = features): RulesetEncounterState => {
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
            abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
            fields: { level: 5, ac: 15, speed: 40, hp_max: 40, ...fields },
            lists: {
              attacks: [
                row("Unarmed Strike", "1", "bludgeoning"),
                row("Shortsword", "1d6", "piercing"),
                row("Greatsword", "2d6", "slashing"),
              ],
              features: held === features ? rows("features") : [],
              counters: held === features ? rows("counters") : [],
            },
          }),
          live: {},
          catalogs: { monk: features },
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    state.order = ["monk", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState) => rulesetCombatant(state, "monk")!;
  const attack = (state: RulesetEncounterState, label: string) =>
    who(state).actions.find((one) => one.label === label)!;
  const menu = (state: RulesetEncounterState) => rulesetCombatOptions(definition, state, "monk");
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const take = (state: RulesetEncounterState, label: string, targetIds = ["foe"]) => {
    const option = menu(state).find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${menu(state).map((one) => `${one.label}@${one.budget}`)}`);
    const step = applyRulesetCombatChoice(definition, state, { actorId: "monk", optionId: option.id, targetIds }, roll);
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    // One strike a spend: what the list buys in hand is not this test's.
    delete who(step.state).strikesLeft;
    return step;
  };
  const offered = (state: RulesetEncounterState) => menu(state).map((one) => `${one.label}@${one.budget ?? "free"}`);

  // ── The rows: Dexterity and the martial arts die where they are the better; magical fists ──
  {
    const state = fight();
    const fist = attack(state, "Unarmed Strike");
    assert.equal(fist.ability, "dex");
    assert.equal(fist.toHit, 3 + 3, "Dexterity +3 and proficiency +3");
    assert.deepEqual(
      [fist.damage!.count, fist.damage!.sides, fist.damage!.flat, fist.damage!.qualities],
      [1, 6, 3, ["magical"]],
      "1d6 + 3 in place of 1 + 0, and magical",
    );
    const sword = attack(state, "Shortsword");
    assert.deepEqual([sword.toHit, sword.damage!.count, sword.damage!.sides, sword.damage!.flat], [6, 1, 6, 3]);
    assert.equal(sword.damage!.qualities, undefined, "Ki-Empowered Strikes is fists only");
    const great = attack(state, "Greatsword");
    assert.deepEqual([great.ability, great.toHit, great.damage!.count, great.damage!.flat], ["str", 3, 2, 0]);
    // At 1st level the die is a d4: the shortsword's own d6 stays.
    const low = fight({ level: 1 });
    assert.deepEqual([attack(low, "Unarmed Strike").damage!.sides, attack(low, "Shortsword").damage!.sides], [4, 6]);
    // While its `when` does not hold, nothing changes but the qualities.
    const armored = fight({ hp_max: 200 });
    assert.deepEqual([attack(armored, "Unarmed Strike").toHit, attack(armored, "Unarmed Strike").damage!.flat], [3, 1]);
    // Without the entries, the rows are as written.
    const plain = fight({}, []);
    assert.equal(attack(plain, "Unarmed Strike").toHit, 3);
  }

  // ── Before the attack action: no bonus strike, no Flurry ──
  {
    const state = fight();
    who(state).budgets.action = 0;
    const before = offered(state);
    assert.ok(!before.some((one) => one.startsWith("Unarmed Strike")), before.join(", "));
    assert.ok(!before.some((one) => one.startsWith("Flurry")), before.join(", "));
  }

  // ── After attacking with a monk weapon: one bonus unarmed strike, or Flurry ──
  {
    const attacked = take(fight(), "Shortsword").state;
    assert.deepEqual(who(attacked).flags.attackAction, ["Shortsword"]);
    const after = offered(attacked);
    assert.ok(after.includes("Unarmed Strike@bonus"), after.join(", "));
    assert.ok(!after.some((one) => one.startsWith("Shortsword") || one.startsWith("Greatsword")), after.join(", "));
    assert.ok(after.includes("Flurry of Blows@bonus"), after.join(", "));
    const bonus = take(attacked, "Unarmed Strike");
    assert.equal(who(bonus.state).budgets.bonus, 0);
    assert.equal(of(bonus.events, "attack").length, 1);
    // A strike the grant paid for is not the attack action.
    assert.deepEqual(who(bonus.state).flags.attackAction, ["Shortsword"]);

    // Flurry: a ki, the bonus action, and two unarmed strikes on its own budget.
    const flurried = take(attacked, "Flurry of Blows", ["monk"]);
    assert.equal(who(flurried.state).budgets.flurry, 2);
    assert.equal(who(flurried.state).budgets.bonus, 0);
    assert.deepEqual(
      offered(flurried.state).filter((one) => one.startsWith("Unarmed")),
      ["Unarmed Strike@flurry"],
    );
    const first = take(flurried.state, "Unarmed Strike");
    const second = take(first.state, "Unarmed Strike");
    assert.equal(who(second.state).budgets.flurry, 0);
    assert.ok(!offered(second.state).some((one) => one.startsWith("Unarmed")), offered(second.state).join(", "));
  }

  // ── After attacking with a greatsword: Flurry, but not Martial Arts' bonus strike ──
  {
    const attacked = take(fight(), "Greatsword").state;
    const after = offered(attacked);
    assert.ok(!after.includes("Unarmed Strike@bonus"), after.join(", "));
    assert.ok(after.includes("Flurry of Blows@bonus"), after.join(", "));
  }

  // ── A new turn forgets the attack action ──
  {
    const attacked = take(fight(), "Shortsword").state;
    const end = menu(attacked).find((one) => one.kind === "end-turn")!;
    const foeTurn = applyRulesetCombatChoice(
      definition,
      attacked,
      { actorId: "monk", optionId: end.id, targetIds: [] },
      roll,
    );
    const foeEnd = rulesetCombatOptions(definition, foeTurn.state, "foe").find((one) => one.kind === "end-turn")!;
    const back = applyRulesetCombatChoice(
      definition,
      foeTurn.state,
      { actorId: "foe", optionId: foeEnd.id, targetIds: [] },
      roll,
    );
    assert.equal(who(back.state).flags.attackAction, undefined);
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
    const entry = (doc: Record<string, any>, id: string) =>
      doc.catalogs.at(-1).entries.find((one: { id: string }) => one.id === id).mechanics;
    refused((doc) => (entry(doc, "martial-arts").attackRows[0].abilities = ["agility"]), /Unknown ability "agility"/);
    refused((doc) => (entry(doc, "martial-arts").grantsStrike.budget = "swift"), /Unknown budget "swift"/);
    refused(
      (doc) => (entry(doc, "ki-empowered-strikes").attackRows = [{ names: ["Unarmed Strike"] }]),
      /changes something/,
    );
    refused((doc) => (entry(doc, "martial-arts").attackRows[0].die.from = { field: "nope" }), /nope/);
    refused(
      (doc) =>
        doc.combat.conditions.push({
          condition: "prone",
          effects: [],
          grants: { budget: "bonus", names: ["Unarmed Strike"] },
        }),
      /narrow "attacks"/,
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
      "A ruleset with entries that change attack rows, grant strikes or come only after the attack action, or granted attacks narrowed by name or to after it, requires schemaVersion 2 and capabilityApi 1.242 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [
      { mechanics: { attackRows: [{ names: ["Unarmed Strike"], qualities: ["magical"] }] } },
      { mechanics: { grantsStrike: { budget: "bonus" } } },
      { mechanics: { afterAttack: true } },
      { grants: { budget: "bonus", attacks: true, names: ["Unarmed Strike"] } },
      { grants: { budget: "bonus", attacks: true, afterAttack: true } },
    ]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(241, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(242, document), gate);
    }
    assert.notEqual(issue(241, without), gate);
    assert.equal(issue(241, without, new Map([["monk.json", { entries: [flurry] }]])), gate);
  }

  console.log(
    "Ruleset martial arts: held entries change named attack rows (best ability, a better die, qualities), grant a bonus strike after the attack action, and Flurry gives two unarmed strikes; gated at 1.242.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
