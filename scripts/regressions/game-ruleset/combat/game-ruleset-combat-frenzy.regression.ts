/**
 * Berserker Frenzy (Capability API 1.239).
 *
 *   - A combat condition's `grants.melee`: the one strike its granted budget pays for is made only
 *     with a weapon that strikes in reach, and a thrown one only within its reach (swung, not
 *     thrown): Frenzy's melee weapon attack as a bonus action.
 *   - `onEnd.tracks`: tracks moved as it ends, however it ends: Frenzy's level of exhaustion when the
 *     rage it is linked to is over.
 *   - The mode choice is two entries: Rage, and Frenzied Rage, which puts on both and spends one of
 *     Rage's uses (`usesOf`), its counter row, having none of its own.
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
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-frenzy-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 234);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const feature = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({ id, label, rows: [{ list: "features", values: { name: label } }], mechanics }) as unknown as RulesetCatalogEntry;
  const rage = {
    ...feature("rage", "Rage", {
      kind: "buff",
      targets: "self",
      budget: "bonus",
      applies: [{ condition: "raging", duration: { rounds: 10 } }],
    }),
    rows: [
      { list: "features", values: { name: "Rage" } },
      { list: "counters", values: { name: "Rage", max: 2, recharge: "long" } },
    ],
  } as unknown as RulesetCatalogEntry;
  const frenzied = feature("frenzied-rage", "Frenzied Rage", {
    kind: "buff",
    usesOf: "Rage",
    targets: "self",
    budget: "bonus",
    applies: [
      { condition: "raging", duration: { rounds: 10 } },
      { condition: "frenzied", duration: { rounds: 10 }, endsWith: "raging" },
    ],
  });
  const rages = [rage, frenzied];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({
      id: "rages",
      label: "Rages",
      feeds: ["features", "counters"],
      entries: structuredClone(rages),
    });
    doc.sheet.live.conditions.push({ id: "raging", label: "Raging" }, { id: "frenzied", label: "Frenzied" });
    doc.combat.conditions.push(
      { condition: "raging", effects: [] },
      {
        condition: "frenzied",
        effects: [],
        grants: { budget: "bonus", attacks: true, melee: true },
        onEnd: { tracks: [{ track: "exhaustion", by: 1 }] },
      },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const block = (): RulesetStatBlock =>
    ({ health: 40, defense: 5, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const weapon = (name: string, extra: Record<string, unknown>) => ({
    name,
    ability: "str",
    proficient: true,
    bonus: 0,
    damage: "1d6",
    damage_type: "slashing",
    ...extra,
  });
  const rows = (list: string) =>
    rages.flatMap((entry) =>
      rowsFromCatalogEntry("rages", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const fight = (board = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "brute",
          name: "Brute",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 18, dex: 12, con: 16, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 14, speed: 30, hp_max: 40 },
            lists: {
              attacks: [
                weapon("Greataxe", { reach: 5 }),
                weapon("Handaxe", { reach: 5, range: 20, long_range: 60 }),
                weapon("Longbow", { range: 150, long_range: 600 }),
              ],
              features: rows("features"),
              counters: rows("counters"),
            },
          }),
          live: {},
          catalogs: { rages },
        },
        { id: "near", name: "Near", side: "enemy", block: block() },
        { id: "far", name: "Far", side: "enemy", block: block() },
      ],
      ...(board
        ? {
            board: {
              grid: {
                width: 10,
                height: 10,
                tiles: Array.from({ length: 10 }, () => Array(10).fill("plains")),
              } as TacticalGrid,
              placements: { brute: { x: 2, y: 2 }, near: { x: 3, y: 2 }, far: { x: 6, y: 2 } },
            },
          }
        : {}),
    });
    state.order = ["brute", "near", "far"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const menu = (state: RulesetEncounterState) => rulesetCombatOptions(definition, state, "brute");
  const use = (state: RulesetEncounterState, label: string, targetIds = ["brute"]) => {
    const option = menu(state).find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${menu(state).map((one) => one.label)}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "brute", optionId: option.id, targetIds },
      roll,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  // The action spent, what is left on the menu is what the bonus budget may still buy.
  const afterAction = (state: RulesetEncounterState) => {
    who(state, "brute").budgets.action = 0;
    who(state, "brute").budgets.bonus = 1;
    return menu(state);
  };
  const weapons = ["Greataxe", "Handaxe", "Longbow"];

  // ── Frenzied: a melee strike on the bonus budget; a plain rage gives none ──
  {
    const plain = use(fight(), "Rage").state;
    assert.deepEqual(rulesetCombatConditions(definition, who(plain, "brute")), ["raging"]);
    assert.deepEqual(
      afterAction(plain).filter((one) => weapons.includes(one.label)),
      [],
    );
    const step = use(fight(), "Frenzied Rage");
    assert.deepEqual(rulesetCombatConditions(definition, who(step.state, "brute")).sort(), ["frenzied", "raging"]);
    const offered = afterAction(step.state).filter((one) => weapons.includes(one.label));
    assert.deepEqual(
      offered.map((one) => [one.label, one.budget, one.oneStrike]),
      [
        ["Greataxe", "bonus", true],
        ["Handaxe", "bonus", true],
      ],
    );
    // Swung, the handaxe is held to its reach; the greataxe has nothing else.
    assert.deepEqual(offered.find((one) => one.label === "Handaxe")!.range, { normal: 0 });
    assert.equal(offered.find((one) => one.label === "Greataxe")!.range, undefined);
    // While the action is there, the weapons are the action's as ever, the bow too.
    who(step.state, "brute").budgets.action = 1;
    assert.deepEqual(
      menu(step.state)
        .filter((one) => weapons.includes(one.label))
        .map((one) => one.budget),
      ["action", "action", "action"],
    );
  }

  // ── Frenzied Rage spends Rage's uses: two of either, and both are gone ──
  {
    const once = use(fight(), "Frenzied Rage").state;
    who(once, "brute").budgets.bonus = 1;
    const twice = use(once, "Rage").state;
    who(twice, "brute").budgets.bonus = 1;
    const left = menu(twice).map((one) => one.label);
    assert.ok(!left.includes("Rage") && !left.includes("Frenzied Rage"), left.join(", "));
    const plain = use(fight(), "Rage").state;
    who(plain, "brute").budgets.bonus = 1;
    assert.ok(
      menu(plain).some((one) => one.label === "Frenzied Rage"),
      "one use is left",
    );
  }

  // ── On a board: the frenzied handaxe reaches only who is beside them ──
  {
    const state = use(fight(true), "Frenzied Rage").state;
    const handaxe = afterAction(state).find((one) => one.label === "Handaxe")!;
    assert.deepEqual(rulesetOptionTargets(definition, state, "brute", handaxe), ["near"]);
    const refused = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "brute", optionId: handaxe.id, targetIds: ["far"] },
      roll,
    );
    assert.deepEqual(
      of(refused.events, "refused").map((one) => one.reason),
      ["out-of-reach"],
    );
    const struck = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "brute", optionId: handaxe.id, targetIds: ["near"] },
      roll,
    );
    assert.equal(of(struck.events, "refused").length, 0, JSON.stringify(struck.events));
    assert.equal(who(struck.state, "brute").budgets.bonus, 0);
    // Thrown with the action, the handaxe still reaches the far one.
    who(state, "brute").budgets.action = 1;
    const thrown = menu(state).find((one) => one.label === "Handaxe")!;
    assert.ok(rulesetOptionTargets(definition, state, "brute", thrown).includes("far"));
  }

  // ── The rage over, the frenzy goes with it and leaves a level of exhaustion ──
  {
    const state = use(fight(), "Frenzied Rage").state;
    who(state, "brute").tracked.find((one) => one.condition === "raging")!.rounds = 1;
    const end = menu(state).find((one) => one.kind === "end-turn")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "brute", optionId: end.id, targetIds: [] },
      roll,
    );
    assert.deepEqual(rulesetCombatConditions(definition, who(step.state, "brute")), []);
    assert.deepEqual(
      of(step.events, "track").map((one) => [one.targetId, one.track, one.from, one.to]),
      [["brute", "exhaustion", 0, 1]],
    );
    // A plain rage leaves nothing.
    const plain = use(fight(), "Rage").state;
    who(plain, "brute").tracked.find((one) => one.condition === "raging")!.rounds = 1;
    const quiet = applyRulesetCombatChoice(
      definition,
      plain,
      { actorId: "brute", optionId: end.id, targetIds: [] },
      roll,
    );
    assert.deepEqual(of(quiet.events, "track"), []);
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
    const frenzy = (doc: Record<string, any>) => doc.combat.conditions.at(-1);
    refused((doc) => (frenzy(doc).onEnd.tracks[0].track = "sanity"), /Unknown track "sanity"/);
    refused((doc) => (frenzy(doc).onEnd = {}), /"onEnd" names "applies", "tracks" or "harm"/);
    refused((doc) => (frenzy(doc).grants = { budget: "bonus", melee: true }), /"melee" narrows "attacks"/);
    refused((doc) => (frenzy(doc).onEnd.tracks[0].by = 0), /at least one level/);
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
      "A ruleset with conditions whose granted attacks are melee only or that move a track as they end, or uses that spend another row's, requires schemaVersion 2 and capabilityApi 1.239 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const condition of [
      { condition: "frenzied", effects: [], grants: { budget: "bonus", attacks: true, melee: true } },
      { condition: "frenzied", effects: [], onEnd: { tracks: [{ track: "exhaustion", by: 1 }] } },
      undefined,
    ]) {
      const document = structuredClone(without);
      if (condition) document.combat.conditions.push(condition);
      else document.extra = { frenzy: { mechanics: { usesOf: "Rage" } } };
      assert.equal(issue(238, document), gate, JSON.stringify(condition));
      assert.notEqual(issue(239, document), gate);
    }
    // A grant of any attack, and an ending that only puts something on, are older.
    const older = structuredClone(without);
    older.combat.conditions.push({
      condition: "quick",
      effects: [],
      grants: { budget: "bonus", attacks: true },
      onEnd: { applies: [{ condition: "prone", duration: { rounds: 1 } }] },
    });
    assert.notEqual(issue(238, older), gate);
    assert.equal(issue(238, without, new Map([["rages.json", { entries: [frenzied] }]])), gate);
  }

  console.log(
    "Ruleset frenzy: a frenzied rage grants one melee strike a bonus action, held to reach, and leaves a level of exhaustion as the rage ends; gated at 1.239.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
