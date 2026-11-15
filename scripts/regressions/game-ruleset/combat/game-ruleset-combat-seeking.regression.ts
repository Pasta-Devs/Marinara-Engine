/**
 * Looking for the hidden, weighed (Capability API 1.290).
 *
 *   - A check of the fight's read off a skill (`skillMod`) counts as that skill's check, so what is
 *     narrowed to the skill counts on Hide and Search: Stealth in heavy armor, Pass without Trace.
 *   - `combat.hiding.passiveMode`: a passive Perception with advantage gains it, with disadvantage
 *     loses it (5e's 5).
 *   - A `checks-taken` change: the mode its holder puts on checks made to find them, on a passive
 *     and on a Search, which throws apart for them where that changes how it is thrown.
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
  rulesetCombatant,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-seeking-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 285);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const seeking = (doc: Record<string, any>, passiveMode = true) => {
    doc.combat.sight = { unseenAttacks: true };
    doc.combat.checks.push(
      // Named apart from the skills they are read off.
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
    );
    doc.combat.hiding = {
      stealth: "sneak",
      perception: "look",
      ...(passiveMode ? { passiveMode: 5 } : {}),
    };
    doc.combat.standard.push("search");
    doc.sheet.live.conditions.push(
      { id: "clanking", label: "Plate" },
      { id: "traceless", label: "Pass without Trace" },
      { id: "sharp", label: "Sharp-eyed" },
      { id: "keen", label: "Keen Sight" },
      { id: "dazzled", label: "Dazzled" },
      { id: "elvish", label: "Cloak of Elvenkind" },
      { id: "slick", label: "Slick" },
    );
    doc.combat.conditions.push(
      { condition: "clanking", modifiers: [{ to: "checks", skills: ["stealth"], mode: "disadvantage" }] },
      { condition: "traceless", modifiers: [{ to: "checks", skills: ["stealth"], flat: 10 }] },
      // Narrowed to another skill: nothing on Stealth.
      { condition: "sharp", modifiers: [{ to: "checks", skills: ["perception"], flat: 10 }] },
      { condition: "keen", modifiers: [{ to: "checks", skills: ["perception"], mode: "advantage" }] },
      { condition: "dazzled", modifiers: [{ to: "checks", skills: ["perception"], mode: "disadvantage" }] },
      { condition: "elvish", modifiers: [{ to: "checks-taken", skills: ["perception"], mode: "disadvantage" }] },
      // Narrowed to another skill: nothing on looking.
      { condition: "slick", modifiers: [{ to: "checks-taken", skills: ["athletics"], mode: "disadvantage" }] },
    );
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}, passiveMode = true): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    seeking(doc, passiveMode);
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
  const plainPassive = parsed(fiveE(() => {}, false));
  // Dexterity 16, so Stealth +3.
  const rogue = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 30 },
    lists: { attacks: [{ name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 }] },
  });
  // Perception +3: a passive of 13.
  const block = (): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      checks: { look: 3 },
      actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 0 } }],
    }) as RulesetStatBlock;
  // A wall down x = 8: the rogue and the ally behind it, the guard beyond.
  const fight = (rules = definition, conditions: Record<string, string[]> = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "rogue", name: "Rogue", side: "party", build: rogue, live: {} },
        { id: "ally", name: "Ally", side: "party", build: rogue, live: {} },
        { id: "guard", name: "Guard", side: "enemy", block: block() },
      ],
      board: {
        grid: {
          width: 20,
          height: 15,
          tiles: Array.from({ length: 15 }, (_, y) =>
            Array.from({ length: 20 }, (_, x) => (x === 8 && y >= 1 && y <= 10 ? "wall" : "plains")),
          ),
        } as never,
        placements: { rogue: { x: 6, y: 5 }, ally: { x: 6, y: 7 }, guard: { x: 12, y: 5 } },
      },
    });
    for (const [id, list] of Object.entries(conditions)) {
      for (const condition of list) {
        rulesetCombatant(state, id)!.tracked.push({ condition, rounds: null } as never);
      }
    }
    state.order = ["rogue", "ally", "guard"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  // The die shows these, then 10s.
  const dice =
    (...faces: number[]) =>
    () =>
      faces.shift() ?? 10;
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice, roll = dice(), rules = definition) => {
    state.turn = state.order.indexOf(choice.actorId);
    const step = applyRulesetCombatChoice(rules, state, choice, roll);
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return step;
  };
  const hide = (state: RulesetEncounterState, roll = dice(), rules = definition) => {
    const step = act(state, { actorId: "rogue", optionId: "standard:hide", targetIds: [] }, roll, rules);
    const event = step.events.find((one) => one.type === "standard" && one.action === "hide");
    assert.ok(event?.type === "standard" && event.check, JSON.stringify(step.events));
    return { step, check: event.check!, from: event.from ?? [] };
  };

  // ── What is narrowed to Stealth counts on Hide ──
  {
    const plain = hide(fight(), dice(15, 5));
    assert.equal(plain.check.total, 18, "one die, no mode");
    const plate = hide(fight(definition, { rogue: ["clanking"] }), dice(15, 5));
    assert.equal(plate.check.mode, "disadvantage", "heavy armor: disadvantage on Stealth");
    assert.equal(plate.check.total, 8);
    assert.deepEqual(plate.from, [], "8 meets no passive");
    const trace = hide(fight(definition, { rogue: ["traceless"] }));
    assert.equal(trace.check.total, 23, "Pass without Trace adds 10 to Stealth");
    const other = hide(fight(definition, { rogue: ["sharp"] }));
    assert.equal(other.check.total, 13, "what is narrowed to Perception is not on Stealth");
  }

  // ── A passive Perception reads advantage and disadvantage ──
  {
    // A 13 meets the guard's passive 13.
    assert.deepEqual(hide(fight()).from, ["guard"]);
    // Keen: 18, beaten by nothing short of it.
    assert.deepEqual(hide(fight(definition, { guard: ["keen"] })).from, [], "keen: passive 18");
    assert.deepEqual(hide(fight(definition, { guard: ["keen"] }), dice(15)).from, ["guard"], "18 meets it");
    // Dazzled: 8, met by a 9.
    assert.deepEqual(hide(fight(definition, { guard: ["dazzled"] }), dice(6)).from, ["guard"], "dazzled: 8");
    assert.deepEqual(hide(fight(), dice(6)).from, [], "a 9 against a plain 13");
    // Without passiveMode the passive is as it was.
    assert.deepEqual(hide(fight(plainPassive, { guard: ["keen"] }), dice(), plainPassive).from, ["guard"]);
  }

  // ── A Cloak of Elvenkind: looking for its wearer is harder ──
  {
    assert.deepEqual(hide(fight(definition, { rogue: ["elvish"] }), dice(6)).from, ["guard"], "passive 8");
    assert.deepEqual(hide(fight(definition, { rogue: ["slick"] }), dice(6)).from, [], "not on Perception");
    // Keen and the cloak cancel out: a plain 13.
    assert.deepEqual(hide(fight(definition, { rogue: ["elvish"], guard: ["keen"] }), dice(6)).from, []);
    assert.deepEqual(hide(fight(definition, { rogue: ["elvish"], guard: ["keen"] })).from, ["guard"]);
    // A Search throws apart for the wearer: the guard's 12 + 3 finds the ally, its 12 and 2 with
    // disadvantage do not find the rogue.
    const state = fight(definition, { rogue: ["elvish"] });
    who(state, "rogue").hiding = { total: 12, from: ["guard"] };
    who(state, "ally").hiding = { total: 12, from: ["guard"] };
    const step = act(state, { actorId: "guard", optionId: "standard:search", targetIds: [] }, dice(12, 12, 2));
    const event = step.events.find((one) => one.type === "standard" && one.action === "search");
    assert.ok(event?.type === "standard", JSON.stringify(step.events));
    assert.equal(event.check!.total, 15);
    assert.deepEqual(event.found, ["ally"]);
    assert.equal(event.apart?.length, 1);
    assert.deepEqual(event.apart![0]!.ids, ["rogue"]);
    assert.equal(event.apart![0]!.check.mode, "disadvantage");
    assert.equal(event.apart![0]!.check.total, 5);
    assert.deepEqual(who(step.state, "rogue").hiding?.from, ["guard"], "still hidden");
    assert.equal(who(step.state, "ally").hiding, undefined, "found");
    // Keen eyes against the cloak: the ally is looked for with advantage, the rogue plainly.
    const keen = fight(definition, { rogue: ["elvish"], guard: ["keen"] });
    who(keen, "rogue").hiding = { total: 12, from: ["guard"] };
    who(keen, "ally").hiding = { total: 12, from: ["guard"] };
    const both = act(keen, { actorId: "guard", optionId: "standard:search", targetIds: [] }, dice(12, 2, 9));
    const once = both.events.find((one) => one.type === "standard" && one.action === "search");
    assert.ok(once?.type === "standard");
    assert.equal(once.check!.mode, "advantage");
    assert.equal(once.check!.total, 15);
    assert.equal(once.apart?.[0]?.check.mode, undefined, "cancelled out: one die");
    assert.equal(once.apart?.[0]?.check.total, 12);
    assert.deepEqual(once.found, ["rogue", "ally"]);
  }

  // ── Refusals ──
  {
    const condition = (modifier: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.sheet.live.conditions.push({ id: "odd", label: "Odd" });
        doc.combat.conditions.push({ condition: "odd", modifiers: [modifier] });
      });
    refusedDoc(condition({ to: "checks-taken", flat: 2 }), /"checks-taken" rolls checks to find the holder twice/);
    refusedDoc(
      condition({ to: "checks-taken", mode: "advantage", flat: 2 }),
      /"checks-taken" rolls checks to find the holder twice/,
    );
    refusedDoc(condition({ to: "saves", skills: ["perception"], mode: "advantage" }), /"skills" narrows/);
    parsed(condition({ to: "checks-taken", mode: "advantage" }));
    refusedDoc(
      fiveE((doc) => {
        doc.combat.hiding.passiveMode = 0;
      }),
      /passiveMode/,
    );
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
      "A ruleset with a passive Perception that reads advantage, or a change to checks made to find somebody, requires schemaVersion 2 and capabilityApi 1.290 or newer";
    const cloakOnly = fiveE(() => {}, false);
    const passiveOnly = fiveE((doc) => {
      doc.combat.conditions = doc.combat.conditions.filter(
        (entry: { condition: string }) => entry.condition !== "elvish",
      );
    });
    for (const doc of [cloakOnly, passiveOnly]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(289) as never, doc), gate);
      assert.equal(getCapabilityPackageInstallIssue(manifest(290) as never, doc), null);
    }
  }

  console.log(
    "Seeking: Stealth and Perception read what is narrowed to their skills; a passive gains or loses passiveMode for advantage or disadvantage; a Cloak of Elvenkind puts disadvantage on looking for its wearer, a Search throwing apart for them; refusals; gated at 1.290.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
