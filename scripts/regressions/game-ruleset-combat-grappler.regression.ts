/**
 * Attacks and contests on a target held by its holder (Capability API 1.553).
 *
 *   - A mimic's Grappler: attack mode advantage only at a creature it has grappled itself.
 *   - The Grappler feat: a modifier narrowed to a target grappled by the holder.
 *   - The feat's pin: a contest offered only on a creature grappled by the actor, which on a win
 *     restrains both until the grapple ends; escaping the grapple frees both.
 *   - The install gate.
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
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-grappler-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 553);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const pin = {
    id: "pin",
    label: "Pin",
    budget: "action",
    attacker: { checks: ["might"] },
    defender: { checks: ["might", "agility"] },
    targetHolds: "grappled",
    targetHeldBySelf: true,
    onWin: { both: { applies: ["restrained"], whileTargetHolds: "grappled" } },
  };
  const document = (edit: (doc: any) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.combat.contests.push(pin);
    doc.sheet.live.conditions.push({ id: "grappling", label: "Grappler" });
    doc.combat.conditions.push({
      condition: "grappling",
      modifiers: [{ to: "attacks", mode: "advantage", targetHoldsFromSelf: ["grappled"] }],
    });
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const creature = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 200,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      checks: { might: -5, agility: -5 },
      actions: [
        { id: "slam", name: "Slam", budget: "action", toHit: 5, damage: { count: 0, sides: 0, flat: 3 }, reach: 1 },
      ],
      ...extra,
    }) as RulesetStatBlock;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 60 },
  });
  const club = {
    name: "Club",
    quantity: 1,
    worn: true,
    item: {
      category: "gear",
      attack: {
        budget: "action",
        toHit: { abilities: ["str"] },
        damage: { dice: "1d4", abilities: ["str"], type: "bludgeoning" },
      },
    },
  } as RulesetSheetItem;
  const fight = () => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, items: [club] },
        { id: "wolf", name: "Wolf", side: "enemy", block: creature() },
        { id: "boar", name: "Boar", side: "enemy", block: creature() },
        {
          id: "mimic",
          name: "Mimic",
          side: "enemy",
          block: creature({ attackModes: [{ mode: "advantage", targetHoldsFromSelf: ["grappled"] }] } as never),
        },
      ],
    });
    state.order = ["hero", "wolf", "boar", "mimic"];
    state.turn = 0;
    return state;
  };
  const grapple = (state: RulesetEncounterState, sourceId: string, targetId: string) =>
    rulesetCombatant(state, targetId)!.tracked.push({ condition: "grappled", rounds: null, source: sourceId });
  const holds = (state: RulesetEncounterState, id: string) =>
    rulesetCombatant(state, id)!.tracked.map((one) => one.condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const choose = (state: RulesetEncounterState, actorId: string, label: string, targetIds: string[]) => {
    state.turn = state.order.indexOf(actorId);
    rulesetCombatant(state, actorId)!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return applyRulesetCombatChoice(definition, state, { actorId, optionId: option.id, targetIds }, () => 10);
  };

  // ── The mimic: advantage at whom it holds, not at whom another holds ──
  {
    const state = fight();
    grapple(state, "mimic", "hero");
    const held = choose(structuredClone(state), "mimic", "Slam", ["hero"]);
    assert.equal(of(held.events, "attack")[0]?.mode, "advantage");
    const other = fight();
    grapple(other, "wolf", "hero");
    const loose = choose(other, "mimic", "Slam", ["hero"]);
    assert.equal(of(loose.events, "attack")[0]?.mode, "normal", "grappled by somebody else");
  }

  // ── The feat's advantage: a modifier at whom the holder grapples ──
  {
    const state = fight();
    rulesetCombatant(state, "hero")!.tracked.push({ condition: "grappling", rounds: null });
    grapple(state, "hero", "wolf");
    grapple(state, "mimic", "boar");
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Club");
    assert.ok(option, "a club");
    const wolf = applyRulesetCombatChoice(
      definition,
      structuredClone(state),
      { actorId: "hero", optionId: option.id, targetIds: ["wolf"] },
      () => 10,
    );
    assert.equal(of(wolf.events, "attack")[0]?.mode, "advantage");
    const boar = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option.id, targetIds: ["boar"] },
      () => 10,
    );
    assert.equal(of(boar.events, "attack")[0]?.mode, "normal", "the boar is the mimic's");
  }

  // ── The pin: only on whom the actor grapples, then both restrained until the grapple ends ──
  {
    const state = fight();
    grapple(state, "hero", "wolf");
    grapple(state, "mimic", "boar");
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Pin");
    assert.ok(option, "pin offered");
    assert.deepEqual(rulesetOptionTargets(definition, state, "hero", option, true), ["wolf"]);
    const pinned = choose(state, "hero", "Pin", ["wolf"]);
    assert.ok(holds(pinned.state, "wolf").includes("restrained"));
    assert.ok(holds(pinned.state, "hero").includes("restrained"), "and the one pinning");
    rulesetCombatant(pinned.state, "wolf")!.checks = { might: 30, agility: 30 };
    const escaped = choose(pinned.state, "wolf", "Escape a grapple", ["hero"]);
    assert.ok(!holds(escaped.state, "wolf").includes("grappled"), "escaped");
    assert.ok(!holds(escaped.state, "wolf").includes("restrained"), "the wolf is free");
    assert.ok(!holds(escaped.state, "hero").includes("restrained"), "and so is the hero");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with attacks or contests on a target held by its holder (targetHoldsFromSelf, targetHeldBySelf, onWin.both) requires schemaVersion 2 and capabilityApi 1.553 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(552) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(553) as never, document()), gate);
    const onlyPin = document((doc) => doc.combat.conditions.pop());
    assert.equal(getCapabilityPackageInstallIssue(manifest(552) as never, onlyPin), gate, "the pin alone");
  }

  console.log(
    "Grappler: a mimic and the feat attack with advantage only at whom they grapple; the pin is offered only on them and restrains both until the grapple ends; gated at 1.553.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
