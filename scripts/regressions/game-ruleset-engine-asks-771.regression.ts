/**
 * Ruleset's asks of 2026-10-23 (Capability API 1.787):
 *
 *   - `fellsKill`: whoever its damage drops to 0 dies outright, never dying (Disintegrate).
 *   - A creature action's `whileFlying`: offered only up in the air, and made in a sequence only then
 *     (a wyvern's claws).
 *   - A sequence's `castsOne`: one spell of its spellcasting follows for nothing, and the rest of the
 *     choice is gone once one is made (a glabrezu).
 *   - A rescue's `against`: only a save against what it names (a Scarab of Protection).
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  supportedCapabilityApi,
  type RulesetCombatAction,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-asks-771-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 787);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: [
        { id: "humanoid", label: "Humanoid" },
        { id: "undead", label: "Undead" },
      ],
    };
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
  const definition = parsed(fiveE());
  const claw = {
    id: "claw",
    name: "Claw",
    budget: "action",
    toHit: 4,
    damage: { count: 1, sides: 6, flat: 0 },
    reach: 1,
  };
  const block = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      actions: [claw],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const hero = defaultRulesetSheetBuild(definition);
  hero.fields = { ...hero.fields, hp_max: 40 };
  /** The foe first, beside the hero. */
  const fight = (foe: RulesetStatBlock, heroHp = 40): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build: hero, live: { pools: { hp: { value: heroHp } } } },
        { id: "foe", name: "Foe", side: "enemy", block: foe },
      ],
      board: {
        grid: { width: 8, height: 6, tiles: Array.from({ length: 6 }, () => Array(8).fill("plains")) },
        placements: { hero: { x: 1, y: 1 }, foe: { x: 2, y: 1 } },
      } as never,
    });
    state.order = ["foe", "hero"];
    state.turn = 0;
    return state;
  };
  const offered = (state: RulesetEncounterState, id: string) =>
    rulesetCombatOptions(definition, state, "foe").find((option) => option.id === id);

  // ── fellsKill: dust at 0 ──
  {
    const state = fight(block(), 1);
    // Without it the hero would lie dying; with it, the hero is dead.
    const plain = applyRulesetCombatChoice(
      definition,
      structuredClone(state),
      { actorId: "foe", optionId: "claw", targetIds: ["hero"] },
      () => 15,
    );
    const downed = rulesetCombatant(plain.state, "hero")!;
    assert.ok(downed.down && !downed.defeated, "a claw leaves them dying");
    const foe = rulesetCombatant(state, "foe")!;
    (foe.actions.find((one) => one.id === "claw") as RulesetCombatAction).fellsKill = true;
    const dust = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "foe", optionId: "claw", targetIds: ["hero"] },
      () => 15,
    );
    const gone = rulesetCombatant(dust.state, "hero")!;
    assert.ok(gone.defeated, `dead outright: ${JSON.stringify(dust.events.map((event) => event.type))}`);
    assert.ok(dust.events.some((event) => event.type === "slain" && event.targetId === "hero"));
    const doc = fiveE();
    const feats = doc.catalogs.find((one: { entries?: any[] }) => one.entries?.some((entry) => entry.mechanics));
    const entry = { ...structuredClone(feats.entries[0]), id: "dust" };
    entry.mechanics = { kind: "attack", amount: { dice: "2d6" }, damageType: "force", fellsKill: true };
    feats.entries.push(entry);
    parsed(doc);
    delete entry.mechanics.amount;
    refused(doc, /"fellsKill" kills whoever its damage drops to 0/);
  }

  // ── whileFlying: a wyvern's claws ──
  {
    const wyvern = block({
      speeds: { fly: 80 },
      actions: [
        claw,
        { id: "bite", name: "Bite", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 0 }, reach: 1 },
        { ...claw, id: "talons", name: "Talons", whileFlying: true },
        {
          id: "flying_multiattack",
          name: "Multiattack (flying)",
          budget: "action",
          whileFlying: true,
          sequence: [
            { action: "bite", times: 1 },
            { action: "talons", times: 1 },
          ],
        },
      ],
    });
    const state = fight(wyvern);
    assert.equal(offered(state, "talons"), undefined, "not on the ground");
    assert.equal(offered(state, "flying_multiattack"), undefined);
    rulesetCombatant(state, "foe")!.airborne = true;
    assert.ok(offered(state, "talons"), "up in the air");
    assert.ok(offered(state, "flying_multiattack"));
  }

  // ── castsOne: a glabrezu's pincers and a spell ──
  {
    const glabrezu = block({
      actions: [
        claw,
        { id: "fist", name: "Fist", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 }, reach: 1 },
        {
          id: "pincers_and_spell",
          name: "Multiattack (spell)",
          budget: "action",
          sequence: [{ action: "claw", times: 2 }],
          castsOne: true,
        },
      ],
    });
    const state = fight(glabrezu);
    const foe = rulesetCombatant(state, "foe")!;
    // Two of its spells, as its spellcasting would make them.
    for (const id of ["fist"])
      (foe.actions.find((one) => one.id === id) as RulesetCombatAction).innate = { level: 1, baseLevel: 1 } as never;
    const spellTwo = structuredClone(foe.actions.find((one) => one.id === "fist")!) as RulesetCombatAction;
    spellTwo.id = "fist_two";
    spellTwo.label = "Fist two";
    foe.actions.push(spellTwo);
    const made = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "foe", optionId: "pincers_and_spell", targetIds: ["hero", "hero"] },
      () => 15,
    );
    const after = rulesetCombatant(made.state, "foe")!;
    assert.deepEqual(
      (after.flags.followUps ?? []).map((one) => one.id).sort(),
      ["fist", "fist_two"],
      "either spell may follow",
    );
    const free = rulesetCombatOptions(definition, made.state, "foe").find((option) => option.id === "fist");
    assert.ok(free, "and is on the menu with the budget spent");
    const cast = applyRulesetCombatChoice(
      definition,
      made.state,
      { actorId: "foe", optionId: "fist", targetIds: ["hero"] },
      () => 15,
    );
    assert.deepEqual(rulesetCombatant(cast.state, "foe")!.flags.followUps ?? [], [], "one, and the other is gone");
    const doc = fiveE();
    const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
    creatures.entries[0].creature.actions[0].castsOne = true;
    refused(doc, /"castsOne" is the spell a sequence lets follow/);
  }

  // ── rescue.against: a Scarab of Protection ──
  {
    const piper = block({
      actions: [
        {
          id: "wail",
          name: "Wail",
          budget: "action",
          save: { save: "wis_save", difficulty: 30, onSuccess: "negates" },
          applies: [{ condition: "frightened", duration: { rounds: 3 } }],
          range: 30,
        },
      ],
    });
    const rescued = (type: string, against: Record<string, unknown>) => {
      const state = fight({ ...piper, type } as never);
      const heroNow = rulesetCombatant(state, "hero")!;
      const base = heroNow.actions.find((one) => one.targets.side === "self") ?? heroNow.actions[0]!;
      const scarab = structuredClone(base) as RulesetCombatAction;
      scarab.id = "scarab";
      scarab.label = "Scarab of Protection";
      scarab.rescue = { roll: "saves", by: "success", against } as never;
      heroNow.actions.push(scarab);
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "foe", optionId: "wail", targetIds: ["hero"] },
        () => 2,
      );
      return step.events.some((event) => event.type === "rescued");
    };
    assert.equal(rescued("undead", { fromTypes: ["undead"] }), true, "against an undead's wail");
    assert.equal(rescued("humanoid", { fromTypes: ["undead"] }), false, "never a living piper's");
    const doc = fiveE();
    const items = doc.catalogs.find((one: { entries?: any[] }) => one.entries?.some((entry) => entry.mechanics));
    const entry = items.entries.find((one: any) => one.mechanics);
    entry.mechanics.rescue = { roll: "saves", by: "success", against: { fromTypes: ["undead"] } };
    parsed(doc);
    entry.mechanics.rescue = { roll: "saves", by: "success", against: {} };
    refused(doc, /Say what it rescues against/);
    entry.mechanics.rescue = { roll: "checks", by: "success", against: { fromTypes: ["undead"] } };
    refused(doc, /"against" narrows a rescue of "saves"/);
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
      "A ruleset with fellsKill, a creature action's whileFlying or castsOne, or a rescue's against requires schemaVersion 2 and capabilityApi 1.787 or newer";
    const flying = fiveE();
    flying.catalogs.find(
      (one: { holds?: string }) => one.holds === "creatures",
    ).entries[0].creature.actions[0].whileFlying = true;
    assert.equal(getCapabilityPackageInstallIssue(manifest(786) as never, flying), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(787) as never, flying), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(786) as never, fiveE()), gate);
  }

  console.log(
    "Engine asks 1.787: dust at 0, claws only in the air, a spell after the pincers, a scarab against the undead only; refused where unsaid; gated at 1.787.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
