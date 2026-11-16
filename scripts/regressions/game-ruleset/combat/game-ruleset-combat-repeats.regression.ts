/**
 * A concentration entry made again, and a condition that ends at a distance (Capability API 1.310).
 *
 *   - `repeats` offers the entry's effect again on its own budget while its user concentrates on it,
 *     costing nothing off the sheet and grown by what the cast was paid at: Vampiric Touch.
 *   - `notSaved` never offers it at one that succeeded on a save against it: Eyebite.
 *   - `sameTargets` offers it only at whom the cast was aimed: Heat Metal.
 *   - `endsAway` takes a condition off once its holder stands farther than it says from whoever put
 *     it on and, with `unseen`, cannot see them: Eyebite's panic, on a walk or as a turn ends.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  RULESET_MOVE_OPTION,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import { rulesetOptionLabel } from "../../../../packages/client/src/lib/ruleset-combat-menu.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-repeats-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 305);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, level: number, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
      mechanics: { cost: [{ pool: `slots_${level}`, amount: 1 }], ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const touch = spell("vampiric-touch", "Vampiric Touch", 3, {
    kind: "attack",
    range: 5,
    autoHit: true,
    amount: { flat: 3 },
    perCostStep: { flat: 2 },
    damageType: "necrotic",
    concentration: true,
    repeats: { budget: "action" },
  });
  const eyebite = spell("eyebite", "Eyebite", 5, {
    kind: "debuff",
    range: 60,
    concentration: true,
    repeats: { budget: "action", notSaved: true },
    save: { save: "wis_save", onSuccess: "negates", succeeds: { conditionImmune: ["panicked"] } },
    applies: [{ condition: "panicked", duration: { rounds: 10 }, endsAway: { beyond: 60, unseen: true } }],
  });
  const heat = spell("heat-metal", "Heat Metal", 2, {
    kind: "attack",
    range: 60,
    autoHit: true,
    amount: { flat: 4 },
    damageType: "fire",
    concentration: true,
    repeats: { budget: "bonus", sameTargets: true },
  });
  const spells = [touch, eyebite, heat];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "panicked", label: "Panicked" });
    doc.combat.conditions.push({ condition: "panicked", effects: [] });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
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
  const fields: Record<string, number> = { level: 11, ac: 12, speed: 30, hp_max: 60 };
  for (let level = 1; level <= 6; level++) fields[`slots_max_${level}`] = 4;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
    fields: { ...fields, spellcasting_ability: "int" },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const foe = (id: string, immune = false) => ({
    id,
    name: id.toUpperCase(),
    side: "enemy" as const,
    block: {
      health: 200,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      ...(immune ? { conditionImmunities: ["panicked"] } : {}),
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { flat: 1 } }],
    } as unknown as RulesetStatBlock,
  });
  // What a d20 comes up as; everything else rolls 1.
  let d20 = 1;
  const roll = (sides: number) => (sides === 20 ? d20 : 1);
  const fight = (immuneA = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build, live: {}, catalogs: { spells } },
        foe("a", immuneA),
        foe("b"),
      ],
      board: {
        grid: { width: 40, height: 5, tiles: Array.from({ length: 5 }, () => Array(40).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 2 }, a: { x: 3, y: 2 }, b: { x: 3, y: 3 } },
      },
    });
    state.order = ["mage", "a", "b"];
    state.turn = 0;
    return state;
  };
  const optionsOf = (state: RulesetEncounterState, actorId = "mage") => {
    state.turn = state.order.indexOf(actorId);
    const actor = rulesetCombatant(state, actorId)!;
    for (const key of Object.keys(actor.budgets)) actor.budgets[key] = 9;
    return rulesetCombatOptions(definition, state, actorId);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const choose = (
    state: RulesetEncounterState,
    optionId: string,
    targetIds: string[],
    payWith?: string,
  ): RulesetCombatStep => {
    optionsOf(state);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId, targetIds, ...(payWith ? { payWith } : {}) },
      roll,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const labels: Record<string, string> = Object.fromEntries(spells.map((one) => [one.id, one.label]));
  const again = (state: RulesetEncounterState, id: string) =>
    optionsOf(state).find((one) => one.label === labels[id] && one.id.endsWith(":again"));
  const cast = (state: RulesetEncounterState, id: string, targetIds: string[], payWith?: string) => {
    const option = optionsOf(state).find((one) => one.label === labels[id] && !one.id.endsWith(":again"));
    assert.ok(option, `no ${id}`);
    return choose(state, option.id, targetIds, payWith);
  };
  const damage = (step: RulesetCombatStep, id: string) =>
    of(step.events, "damage")
      .filter((one) => one.targetId === id)
      .reduce((sum, one) => sum + one.amount, 0);
  const holds = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatant(state, id)!.tracked.some((one) => one.condition === condition);

  // ── Vampiric Touch ──
  {
    const state = fight();
    assert.equal(again(state, "vampiric-touch"), undefined, "nothing to repeat before the cast");
    const first = cast(state, "vampiric-touch", ["a"]);
    assert.equal(damage(first, "a"), 3);
    const repeat = again(first.state, "vampiric-touch");
    assert.ok(repeat, "the touch is offered again while concentrated on");
    assert.equal(repeat.label, "Vampiric Touch");
    assert.equal(repeat.again, true);
    const t = ((key: string, values: { label: string }) => `${key}:${values.label}`) as never;
    assert.equal(rulesetOptionLabel(repeat, t), "game.combat.ruleset.menu.again:Vampiric Touch");
    const live = structuredClone(rulesetCombatant(first.state, "mage")!.sheet!.live);
    const second = choose(first.state, repeat.id, ["b"]);
    assert.equal(damage(second, "b"), 3, "made again at the cast's own level");
    assert.deepEqual(rulesetCombatant(second.state, "mage")!.sheet!.live, live, "costing nothing off the sheet");
    assert.equal(rulesetCombatant(second.state, "mage")!.concentrating?.label, "Vampiric Touch");
    assert.ok(
      !of(second.events, "concentration").some((one) => one.state === "started"),
      "a repeat starts no concentration of its own",
    );
    // Cast higher, every repeat is as high.
    const high = cast(fight(), "vampiric-touch", ["a"], "slots_5");
    assert.equal(damage(high, "a"), 7);
    const higher = choose(high.state, again(high.state, "vampiric-touch")!.id, ["a"]);
    assert.equal(damage(higher, "a"), 7, "grown by what the cast was paid at");
    // Concentrating on something else, it is gone.
    const other = cast(higher.state, "heat-metal", ["a"]);
    assert.equal(again(other.state, "vampiric-touch"), undefined, "no longer concentrated on");
  }

  // ── Eyebite ──
  {
    d20 = 20;
    const saved = cast(fight(), "eyebite", ["a"]);
    assert.equal(holds(saved.state, "a", "panicked"), false, "A saved");
    const repeat = again(saved.state, "eyebite");
    assert.ok(repeat, "Eyebite is offered again");
    assert.deepEqual(
      rulesetOptionTargets(definition, saved.state, "mage", repeat),
      ["b"],
      "never at one that saved against it",
    );
    d20 = 1;
    const panicked = choose(saved.state, repeat.id, ["b"]);
    assert.ok(holds(panicked.state, "b", "panicked"), "B is panicked");
    // One that cannot be panicked succeeds outright, and is not picked again either.
    const outright = cast(fight(true), "eyebite", ["a"]);
    assert.ok(
      of(outright.events, "save").some((one) => one.automatic && one.success),
      "an outright success",
    );
    assert.deepEqual(rulesetOptionTargets(definition, outright.state, "mage", again(outright.state, "eyebite")!), [
      "b",
    ]);
    const entry = rulesetCombatant(panicked.state, "b")!.tracked.find((one) => one.condition === "panicked")!;
    assert.deepEqual(entry.endsAway, { beyond: 60, unseen: true });
    assert.equal(entry.source, "mage");
    // Far off, but still in sight: it holds.
    const far = structuredClone(panicked.state);
    rulesetCombatant(far, "b")!.x = 30;
    let step = advanceRulesetTurn(definition, far, roll);
    assert.ok(holds(step.state, "b", "panicked"), "the mage is still in sight");
    // Out of sight but near: it holds.
    const near = structuredClone(panicked.state);
    rulesetCombatant(near, "mage")!.hiding = { total: 30, from: ["b"] } as never;
    step = advanceRulesetTurn(definition, near, roll);
    assert.ok(holds(step.state, "b", "panicked"), "near enough still");
    // Far off and out of sight as a turn ends: it comes off.
    const both = structuredClone(far);
    rulesetCombatant(both, "mage")!.hiding = { total: 30, from: ["b"] } as never;
    step = advanceRulesetTurn(definition, both, roll);
    assert.equal(holds(step.state, "b", "panicked"), false, "far and unseen ends it");
    // Exactly as far as it says, out of sight: it holds; a cell farther, it comes off.
    const edge = structuredClone(panicked.state);
    rulesetCombatant(edge, "b")!.x = 14;
    rulesetCombatant(edge, "mage")!.hiding = { total: 30, from: ["b"] } as never;
    step = advanceRulesetTurn(definition, edge, roll);
    assert.ok(holds(step.state, "b", "panicked"), "sixty feet is not more than sixty");
    // A walk that takes it far enough ends it on the way.
    const walking = structuredClone(panicked.state);
    rulesetCombatant(walking, "b")!.x = 14;
    rulesetCombatant(walking, "mage")!.hiding = { total: 30, from: ["b"] } as never;
    walking.turn = walking.order.indexOf("b");
    const walked = applyRulesetCombatChoice(
      definition,
      walking,
      { actorId: "b", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 16, y: 3 } },
      roll,
    );
    assert.equal(of(walked.events, "refused").length, 0, JSON.stringify(walked.events));
    assert.equal(holds(walked.state, "b", "panicked"), false, "walked out of reach");
  }

  // ── Heat Metal ──
  {
    const first = cast(fight(), "heat-metal", ["a"]);
    const repeat = again(first.state, "heat-metal");
    assert.ok(repeat, "Heat Metal is offered again");
    assert.equal(repeat.budget, "bonus", "on its own budget");
    assert.deepEqual(rulesetOptionTargets(definition, first.state, "mage", repeat), ["a"], "only its own target");
    const second = choose(first.state, repeat.id, ["a"]);
    assert.equal(damage(second, "a"), 4);
  }

  // ── Refusals ──
  const withSpell = (entry: RulesetCatalogEntry) =>
    fiveE((doc) => {
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "spells").entries.push(entry);
    });
  const odd = (mechanics: Record<string, unknown>) =>
    withSpell(spell("odd", "Odd", 1, { kind: "attack", range: 5, autoHit: true, amount: { flat: 1 }, ...mechanics }));
  refusedDoc(odd({ repeats: { budget: "action" } }), /goes with "concentration"/);
  refusedDoc(odd({ concentration: true, repeats: { budget: "nope" } }), /Unknown budget "nope"/);
  refusedDoc(
    odd({ applies: [{ condition: "panicked", duration: { rounds: 1 }, endsAway: { unseen: true } }] }),
    /beyond/,
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
      "A ruleset with an entry made again while its user concentrates on it, or a condition that ends at a distance from whoever put it on, requires schemaVersion 2 and capabilityApi 1.310 or newer";
    const docWith = (entries: unknown[]) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
      return doc;
    };
    const plainEyebite = structuredClone(eyebite) as Record<string, any>;
    delete plainEyebite.mechanics.repeats;
    const unended = structuredClone(plainEyebite);
    delete unended.mechanics.applies[0].endsAway;
    for (const doc of [docWith([touch]), docWith([plainEyebite])]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(309) as never, doc), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(310) as never, doc), gate);
    }
    for (const doc of [JSON.parse(fiveEText), docWith([unended])]) {
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(309) as never, doc), gate, "nothing new, no gate");
    }
  }

  console.log(
    "Repeats: Vampiric Touch made again at its cast's level for nothing, Eyebite never at who saved and its panic ended far and unseen, Heat Metal only at its target; refusals; gated at 1.310.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
