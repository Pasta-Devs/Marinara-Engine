/**
 * An item's use taken as a reaction (Capability API 1.322).
 *
 *   - Liesl's Coffin: once a day, as a creature within 5 feet of its bearer is hit, +5 AC on them until
 *     the start of the bearer's next turn, against that hit too.
 *   - The Straw Proxy: an attack aimed at its owner is lost, and the proxy burns.
 *   - The Time-Flour Loaf: eaten, one more action on the eater's next turn, once.
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
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-reactions-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 322);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const coffinUse = {
    kind: "buff",
    budget: "reaction",
    targets: "any",
    charges: 1,
    reaction: { on: "hit", at: "target", for: "any", within: 5 },
    applies: [{ condition: "coffin_ward", duration: { rounds: 1, at: "turn-start", of: "source" } }],
  };
  const proxyUse = {
    kind: "buff",
    budget: "reaction",
    targets: "self",
    consumes: true,
    reaction: { on: "aimed", cancels: true, for: "self" },
  };
  const loafUse = {
    kind: "buff",
    budget: "bonus",
    targets: "self",
    consumes: true,
    applies: [{ condition: "an_hour", duration: { rounds: 2 } }],
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    for (const [id, label] of [
      ["coffin_ward", "Liesl's Coffin"],
      ["an_hour", "An Hour"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      { condition: "coffin_ward", effects: [], modifiers: [{ to: "defense", flat: 5 }] },
      { condition: "an_hour", effects: [], budgets: [{ budget: "action", flat: 1 }] },
    );
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 50 },
  });
  const item = (name: string, use: Record<string, unknown>, extra: Record<string, unknown> = {}): RulesetSheetItem =>
    ({
      name,
      quantity: 1,
      worn: false,
      item: { category: "gear", use, ...extra },
    }) as never;
  const coffin = item("Liesl's Coffin", coffinUse, {
    charges: { max: 1, recharge: { rests: ["long"], amount: "max" } },
  });
  const proxy = item("Straw Proxy", proxyUse);
  const loaf = item("Time-Flour Loaf", loafUse);
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 100,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } },
      ],
      ...extra,
    }) as RulesetStatBlock;
  let d20 = 10;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const fight = (items: { bard?: RulesetSheetItem[]; ally?: RulesetSheetItem[] }): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "bard", name: "Bard", side: "party", build, live: {}, ...(items.bard ? { items: items.bard } : {}) },
        { id: "ally", name: "Ally", side: "party", build, live: {}, ...(items.ally ? { items: items.ally } : {}) },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 16, height: 10, tiles: Array.from({ length: 10 }, () => Array(16).fill("plains")) },
        placements: { bard: { x: 4, y: 4 }, ally: { x: 5, y: 4 }, foe: { x: 6, y: 4 } },
      },
    });
    state.order = ["foe", "bard", "ally"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };

  // ── Liesl's Coffin ──
  {
    // The foe's claw hits the ally (14 against 12): the bard, 5 feet off, may answer with the coffin.
    d20 = 10;
    const state = fight({ bard: [coffin] });
    const held = act(state, { actorId: "foe", optionId: "claw", targetIds: ["ally"] });
    assert.ok(held.state.window, JSON.stringify(held.events));
    const option = rulesetWindowOptions(definition, held.state, "bard").find((one) => one.label.includes("Coffin"));
    assert.ok(option, JSON.stringify(rulesetWindowOptions(definition, held.state, "bard")));
    const warded = act(held.state, {
      actorId: "bard",
      optionId: option!.id,
      targetIds: ["ally"],
      window: held.state.window!.id,
    });
    assert.deepEqual(
      of(warded.events, "condition").map((one) => [one.targetId, one.condition]),
      [["ally", "coffin_ward"]],
    );
    assert.ok(rulesetCombatConditions(definition, who(warded.state, "ally")).includes("coffin_ward"));
    assert.deepEqual(of(warded.events, "damage"), [], "17 against 14: the hit misses now");
    assert.deepEqual(
      of(warded.events, "uses").map((one) => [one.actorId, one.label, one.left, one.of]),
      [["bard", "Liesl's Coffin", 0, 1]],
    );
    assert.equal(who(warded.state, "bard").budgets.reaction, 0, "the bearer's reaction");
    // Its one charge is spent: the next hit opens nothing for it.
    who(warded.state, "foe").budgets.action = 1;
    warded.state.turn = 0;
    d20 = 18;
    const next = act(warded.state, { actorId: "foe", optionId: "claw", targetIds: ["ally"] });
    assert.notEqual(of(next.events, "attack").at(-1)?.outcome, "miss", "an 18 hits the ally, unwarded");
    assert.ok(of(next.events, "attack").length > 0);
    assert.ok(
      !next.state.window ||
        !rulesetWindowOptions(definition, next.state, "bard").some((one) => one.label.includes("Coffin")),
      "once a day",
    );
    // Not on its bearer's own turn, and not for somebody more than 5 feet off.
    const own = fight({ bard: [coffin] });
    own.turn = 1;
    assert.ok(!rulesetCombatOptions(definition, own, "bard").some((one) => one.label.includes("Coffin")));
    d20 = 10;
    const far = fight({ bard: [coffin] });
    who(far, "bard").x = 1;
    const farHit = act(far, { actorId: "foe", optionId: "claw", targetIds: ["ally"] });
    assert.ok(
      !farHit.state.window ||
        !rulesetWindowOptions(definition, farHit.state, "bard").some((one) => one.label.includes("Coffin")),
      "15 feet off",
    );
    // Passed, the hit lands.
    const passed = act(held.state, {
      actorId: "bard",
      optionId: RULESET_PASS_OPTION,
      targetIds: [],
      window: held.state.window!.id,
    });
    assert.equal(of(passed.events, "damage")[0]?.targetId, "ally");
  }

  // ── The Straw Proxy ──
  {
    d20 = 10;
    const state = fight({ ally: [proxy] });
    const held = act(state, { actorId: "foe", optionId: "claw", targetIds: ["ally"] });
    assert.ok(held.state.window, JSON.stringify(held.events));
    const option = rulesetWindowOptions(definition, held.state, "ally").find((one) => one.label.includes("Proxy"));
    assert.ok(option, JSON.stringify(rulesetWindowOptions(definition, held.state, "ally")));
    const burnt = act(held.state, {
      actorId: "ally",
      optionId: option!.id,
      targetIds: [],
      window: held.state.window!.id,
    });
    assert.equal(of(burnt.events, "cancelled").length, 1);
    assert.deepEqual(of(burnt.events, "damage"), []);
    assert.deepEqual(who(burnt.state, "ally").itemsUsed, { 0: 1 }, "it burns");
    // Burnt, it answers nothing more.
    who(burnt.state, "foe").budgets.action = 1;
    who(burnt.state, "ally").budgets.reaction = 1;
    burnt.state.turn = 0;
    const again = act(burnt.state, { actorId: "foe", optionId: "claw", targetIds: ["ally"] });
    assert.ok(
      !again.state.window ||
        !rulesetWindowOptions(definition, again.state, "ally").some((one) => one.label.includes("Proxy")),
    );
    // Only at its owner: aimed at the bard beside them, it does nothing.
    const other = fight({ ally: [proxy] });
    who(other, "bard").x = 7;
    const atBard = act(other, { actorId: "foe", optionId: "claw", targetIds: ["bard"] });
    assert.ok(
      !atBard.state.window ||
        !rulesetWindowOptions(definition, atBard.state, "ally").some((one) => one.label.includes("Proxy")),
    );
  }

  // ── The Time-Flour Loaf ──
  {
    const state = fight({ bard: [loaf] });
    state.turn = 1;
    const eat = rulesetCombatOptions(definition, state, "bard").find((one) => one.label.includes("Loaf"));
    assert.ok(eat);
    const eaten = act(state, { actorId: "bard", optionId: eat!.id, targetIds: ["bard"] });
    assert.equal(who(eaten.state, "bard").budgets.action, 1, "not this turn");
    let step = act(eaten.state, { actorId: "bard", optionId: "end-turn", targetIds: [] });
    step = act(step.state, { actorId: "ally", optionId: "end-turn", targetIds: [] });
    step = act(step.state, { actorId: "foe", optionId: "end-turn", targetIds: [] });
    assert.equal(step.state.order[step.state.turn], "bard");
    assert.equal(who(step.state, "bard").budgets.action, 2, "one more action on their next turn");
    step = act(step.state, { actorId: "bard", optionId: "end-turn", targetIds: [] });
    step = act(step.state, { actorId: "ally", optionId: "end-turn", targetIds: [] });
    step = act(step.state, { actorId: "foe", optionId: "end-turn", targetIds: [] });
    assert.equal(who(step.state, "bard").budgets.action, 1, "once");
    assert.deepEqual(who(step.state, "bard").tracked, []);
  }

  // ── Refused, and the install gate ──
  {
    const withItem = (use: Record<string, unknown>) =>
      document((doc) => {
        doc.items = { categories: [{ id: "gear", label: "Gear" }] };
        doc.catalogs.push({
          id: "valley",
          label: "Valley",
          holds: "items",
          entries: [
            {
              id: "liesls-coffin",
              label: "Liesl's Coffin",
              item: {
                category: "gear",
                stack: 1,
                use,
                charges: { max: 1, recharge: { rests: ["long"], amount: "max" } },
              },
            },
          ],
        });
      });
    const refusedTrue = parseRulesetDefinition(withItem({ ...coffinUse, reaction: true }));
    assert.equal(refusedTrue.ok, false);
    if (!refusedTrue.ok)
      assert.ok(
        refusedTrue.issues.some((issue) => /says the moment it answers/.test(issue)),
        refusedTrue.issues.join("; "),
      );
    const message =
      "A ruleset with an item use taken as a reaction requires schemaVersion 2 and capabilityApi 1.322 or newer";
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
    const at = (minor: number, doc: Record<string, any>) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc);
    parsed(withItem(coffinUse));
    assert.equal(at(321, withItem(coffinUse)), message);
    assert.notEqual(at(322, withItem(coffinUse)), message);
    assert.notEqual(at(321, withItem({ ...coffinUse, reaction: false })), message, "false is no reaction");
    assert.notEqual(at(321, withItem(loafUse)), message);
    const more = withItem({ kind: "buff", budget: "bonus", targets: "self", charges: 1, applies: loafUse.applies });
    more.catalogs.find((catalog: { holds?: string }) => catalog.holds === "items").entries.at(-1).item.moreUses = [
      { label: "Ward", use: coffinUse },
    ];
    parsed(more);
    assert.equal(at(321, more), message);
  }
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
