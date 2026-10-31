/**
 * Massive damage (Capability API 1.709): 5e's instant death.
 *
 *   - `dying.instantDeath: "overflow-at-least-max"`: a blow whose damage left past 0 is at least the
 *     hit point maximum kills one who would lie dying outright; one less leaves them dying.
 *   - Temporary hit points soak first.
 *   - A blow at least that big while down kills; a smaller one costs failures as always.
 *   - Only a ward against being slain outright holds (Death Ward); Relentless Endurance does not.
 *   - Without the key, and for a creature that dies at 0 anyway, nothing changes.
 *   - The log line, import refusals and the install gate.
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
  rulesetSheetBuildSchema,
  rulesetSheetDead,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-massive-damage-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 709);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.dying.instantDeath = "overflow-at-least-max";
    doc.sheet.live.conditions.push({ id: "warded", label: "Warded" });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  // Every d20 a 15 (a hit, never a critical one), every other die a 3.
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const brute = (bonus: number): RulesetStatBlock =>
    ({
      health: 60,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        {
          id: "smash",
          name: "Smash",
          budget: "action",
          toHit: 6,
          damage: { count: 1, sides: 6, flat: bonus },
          reach: 5,
        },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (definition: RulesetDefinition, temp = 0) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 20 },
          }),
          live: { pools: { hp: { value: 20, ...(temp ? { temp } : {}) } } },
        },
        // Somebody still standing, so the fight goes on while the hero is down.
        { id: "squire", name: "Squire", side: "party", block: { ...brute(0), health: 10 } },
        // 3 + 37 = 40, 20 past 0; 3 + 36 = 39, 19 past.
        { id: "huge", name: "Huge", side: "enemy", block: brute(37) },
        { id: "heavy", name: "Heavy", side: "enemy", block: brute(36) },
        // 3 + 17 = 20 and 3 + 16 = 19 while down.
        { id: "big", name: "Big", side: "enemy", block: brute(17) },
        { id: "small", name: "Small", side: "enemy", block: brute(16) },
      ],
    });
    state.order = ["hero", "squire", "huge", "heavy", "big", "small"];
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const hit = (definition: RulesetDefinition, state: RulesetEncounterState, by: string, target = "hero") => {
    state.turn = state.order.indexOf(by);
    who(state, by).budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, by).find((one) => one.label === "Smash");
    assert.ok(option, `no Smash for ${by}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: by, optionId: option.id, targetIds: [target] },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const definition = parsed(fiveE());

  // ── 20 past 0 on a maximum of 20: dead outright; 19 past: dying ──
  {
    const step = hit(definition, fight(definition), "huge");
    assert.deepEqual(
      of(step.events, "damage").map((one) => one.dealt),
      [40],
    );
    assert.deepEqual(of(step.events, "massiveDeath"), [{ type: "massiveDeath", actorId: "hero" }]);
    const hero = who(step.state, "hero");
    assert.equal(hero.defeated, true);
    assert.ok(!hero.dying);
    // Dead on the sheet it goes back to, as three failed saves are (laptop pass 6 2026-10-26: a hero
    // killed outright was healed back to 1 after the fight).
    assert.ok(rulesetSheetDead(definition, hero.sheet!.build, hero.sheet!.live), JSON.stringify(hero.sheet!.live));
    // And three blows while down, each a failure, the same.
    let down = hit(definition, fight(definition), "heavy");
    for (let blow = 0; blow < 3; blow++) down = hit(definition, down.state, "small");
    const fallen = who(down.state, "hero");
    assert.equal(fallen.defeated, true);
    assert.ok(
      rulesetSheetDead(definition, fallen.sheet!.build, fallen.sheet!.live),
      JSON.stringify(fallen.sheet!.live),
    );
    const lighter = hit(definition, fight(definition), "heavy");
    assert.deepEqual(of(lighter.events, "massiveDeath"), []);
    assert.equal(who(lighter.state, "hero").dying, true);
    assert.ok(!who(lighter.state, "hero").defeated);
  }

  // ── Temporary hit points soak first: 40 on 5 + 20 leaves 15 past ──
  {
    const step = hit(definition, fight(definition, 5), "huge");
    assert.deepEqual(of(step.events, "massiveDeath"), []);
    assert.equal(who(step.state, "hero").dying, true);
  }

  // ── While down: 20 kills, 19 costs failures ──
  {
    const down = hit(definition, fight(definition), "heavy").state;
    const killed = hit(definition, structuredClone(down), "big");
    assert.equal(of(killed.events, "massiveDeath").length, 1);
    assert.equal(who(killed.state, "hero").defeated, true);
    const hurt = hit(definition, structuredClone(down), "small");
    assert.deepEqual(of(hurt.events, "massiveDeath"), []);
    const hero = who(hurt.state, "hero");
    assert.ok(hero.dying, JSON.stringify(hurt.events));
    assert.ok((hero.sheet!.live as any).tracks?.death_save_failures >= 1, JSON.stringify(hero.sheet!.live));
  }

  // ── Death Ward holds; Relentless Endurance does not ──
  {
    const warding = (hangsOn: Record<string, unknown>) =>
      parsed(fiveE((doc) => doc.combat.conditions.push({ condition: "warded", effects: [], hangsOn })));
    const ward = warding({ uses: 1, ends: true, outright: true, label: "Death Ward" });
    const state = fight(ward);
    who(state, "hero").tracked.push({ condition: "warded", rounds: 4800 });
    const step = hit(ward, state, "huge");
    assert.deepEqual(of(step.events, "massiveDeath"), []);
    assert.equal(of(step.events, "hangsOn").length, 1);
    assert.ok(!who(step.state, "hero").defeated);
    const relentless = warding({ uses: 1, label: "Relentless Endurance" });
    const other = fight(relentless);
    who(other, "hero").tracked.push({ condition: "warded", rounds: 4800 });
    const slain = hit(relentless, other, "huge");
    assert.deepEqual(of(slain.events, "hangsOn"), []);
    assert.equal(of(slain.events, "massiveDeath").length, 1);
    assert.equal(who(slain.state, "hero").defeated, true);
    // Hanging on still works against a blow that is not massive.
    const heldOn = fight(relentless);
    who(heldOn, "hero").tracked.push({ condition: "warded", rounds: 4800 });
    assert.equal(of(hit(relentless, heldOn, "heavy").events, "hangsOn").length, 1);
  }

  // ── Without the key, dying; a creature that dies at 0 is simply defeated ──
  {
    const plain = parsed(JSON.parse(fiveEText));
    const step = hit(plain, fight(plain), "huge");
    assert.deepEqual(of(step.events, "massiveDeath"), []);
    assert.equal(who(step.state, "hero").dying, true);
    const state = fight(definition);
    const squire = hit(definition, state, "huge", "squire");
    assert.deepEqual(of(squire.events, "massiveDeath"), []);
    assert.equal(who(squire.state, "squire").defeated, true);
  }

  // ── Refusals and the install gate ──
  refused(
    fiveE((doc) => (doc.combat.dying.instantDeath = "always")),
    /instantDeath/,
  );
  {
    const gate =
      "A ruleset whose massive damage kills outright (combat.dying.instantDeath) requires schemaVersion 2 and capabilityApi 1.709 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(708) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(709) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(708) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Massive damage: 20 past 0 on a maximum of 20 kills outright, 19 leaves them dying, temporary points soak first, 20 while down kills; Death Ward holds and Relentless Endurance does not; gated at 1.709.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
