/**
 * Answers to a hit that happen by themselves, and hard going on a worn item (Capability API 1.489).
 *
 *   - Holy Aura: a fiend hitting its holder in melee saves with Constitution against the caster's
 *     save difficulty or is blinded, held by the aura's concentration; a fiend that saves, one
 *     shooting from afar, a beast, or a miss is not.
 *   - Given through another's aura (1.491), it answers on the same terms.
 *   - Ring of Free Action: worn, hard going costs its wearer no more than plain ground.
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
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetSyncAuras,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-when-hit-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 489);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const flash = {
    blow: "melee",
    from: { types: ["fiend", "undead"] },
    save: { save: "con_save" },
    applies: [{ condition: "blinded", duration: { rounds: 10 } }],
  };
  const document = (whenHit: Record<string, unknown> = flash, ring: Record<string, unknown> = {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: ["beast", "humanoid", "fiend", "undead"].map((id) => ({ id, label: id })),
      field: "race",
      default: "humanoid",
    };
    doc.sheet.live.conditions.push({ id: "holy", label: "Holy Aura" });
    doc.combat.conditions.push({ condition: "holy", effects: [], whenHit });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "rings",
      label: "Rings",
      holds: "items",
      entries: [
        {
          id: "free",
          label: "Ring of Free Action",
          item: { category: "gear", worn: { ignoresHardGround: true, ...ring } },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const foe = (type: string, con: number, ranged = false, toHit = 20): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      type,
      saves: { con_save: con },
      actions: [
        ranged
          ? { id: "bolt", name: "Bolt", budget: "action", toHit, damage: { flat: 1 }, range: { normal: 120 } }
          : { id: "claw", name: "Claw", budget: "action", toHit, damage: { flat: 1 }, reach: 5 },
      ],
    }) as unknown as RulesetStatBlock;
  const cleric = {
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "aura",
        name: "Holy Aura",
        budget: "action",
        save: { save: "con_save", difficulty: 17 },
        damage: { flat: 0 },
      },
    ],
  } as unknown as RulesetStatBlock;
  const ring: RulesetSheetItem = {
    name: "Ring of Free Action",
    quantity: 1,
    worn: true,
    item: { category: "gear", worn: { ignoresHardGround: true } } as RulesetSheetItem["item"],
  };
  const fight = (attacker: RulesetStatBlock, items: RulesetSheetItem[] = []): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, race: "humanoid" },
          }),
          items,
        },
        { id: "cleric", name: "Cleric", side: "party", block: cleric },
        { id: "foe", name: "Foe", side: "enemy", block: attacker },
      ],
      board: {
        grid: { width: 10, height: 3, tiles: Array.from({ length: 3 }, () => Array(10).fill("plains")) },
        placements: { hero: { x: 1, y: 1 }, cleric: { x: 0, y: 0 }, foe: { x: 2, y: 1 } },
      },
    });
    state.order = ["foe", "hero", "cleric"];
    state.turn = 0;
    rulesetCombatant(state, "hero")!.tracked.push({
      condition: "holy",
      rounds: 10,
      source: "cleric",
      action: ["aura", "Holy Aura"],
      concentration: true,
    });
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const strike = (state: RulesetEncounterState) => {
    const option = rulesetCombatOptions(definition, state, "foe").find((one) => one.kind === "block")!;
    assert.ok(option, "an attack");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "foe", optionId: option.id, targetIds: ["hero"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    return step;
  };
  const blinded = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "foe")!.tracked.find((one) => one.condition === "blinded");

  // ── A fiend's claw: it saves against the cleric's 17 and fails, and is blinded ──
  {
    const step = strike(fight(foe("fiend", -5)));
    const saves = of(step.events, "save").filter((one) => one.actorId === "foe");
    assert.equal(saves.length, 1);
    assert.equal(saves[0]!.difficulty, 17, "the caster's save difficulty");
    const held = blinded(step.state);
    assert.ok(held, "blinded");
    assert.equal(held.source, "cleric");
    assert.equal(held.concentration, true, "held by the aura's concentration");
  }
  // ── Saved, shot from afar, a beast, or a miss: nothing ──
  assert.equal(blinded(strike(fight(foe("fiend", 20))).state), undefined, "saved");
  assert.equal(blinded(strike(fight(foe("fiend", -5, true))).state), undefined, "not in melee");
  assert.equal(blinded(strike(fight(foe("beast", -5))).state), undefined, "no fiend");
  assert.equal(blinded(strike(fight(foe("undead", -5, false, -20))).state), undefined, "missed");
  // ── Its own difficulty, where it names one ──
  {
    const own = parsed(document({ ...flash, save: { save: "con_save", difficulty: 9 } }));
    const state = fight(foe("undead", -5));
    const option = rulesetCombatOptions(own, state, "foe").find((one) => one.kind === "block")!;
    const step = applyRulesetCombatChoice(
      own,
      state,
      { actorId: "foe", optionId: option.id, targetIds: ["hero"] },
      () => 10,
    );
    assert.equal(of(step.events, "save").find((one) => one.actorId === "foe")?.difficulty, 9);
  }

  // ── Given through the cleric's aura (1.491): the caster's difficulty and concentration all the same ──
  {
    const doc = document();
    doc.sheet.live.conditions.push({ id: "holy_caster", label: "Holy Aura (caster)" });
    doc.combat.conditions.push({
      condition: "holy_caster",
      effects: [],
      auras: [{ distance: 30, side: "allies", conditions: ["holy"] }],
    });
    const aura = parsed(doc);
    const state = fight(foe("fiend", -5));
    const hero = rulesetCombatant(state, "hero")!;
    hero.tracked = hero.tracked.filter((one) => one.condition !== "holy");
    rulesetCombatant(state, "cleric")!.tracked.push({
      condition: "holy_caster",
      rounds: 10,
      source: "cleric",
      action: ["aura", "Holy Aura"],
      concentration: true,
    });
    rulesetSyncAuras(aura, state);
    assert.ok(
      hero.tracked.some((one) => one.condition === "holy" && one.aura === "cleric"),
      "spread to the hero",
    );
    const option = rulesetCombatOptions(aura, state, "foe").find((one) => one.kind === "block")!;
    const step = applyRulesetCombatChoice(
      aura,
      state,
      { actorId: "foe", optionId: option.id, targetIds: ["hero"] },
      () => 10,
    );
    assert.equal(of(step.events, "save").find((one) => one.actorId === "foe")?.difficulty, 17, "the caster's number");
    const held = blinded(step.state);
    assert.ok(held, "blinded");
    assert.equal(held.source, "cleric");
    assert.equal(held.concentration, true, "held by the caster's concentration");
  }

  // ── Ring of Free Action ──
  assert.equal(rulesetCombatant(fight(foe("beast", 0), [ring]), "hero")!.ignoresHardGround, true, "worn");
  assert.equal(rulesetCombatant(fight(foe("beast", 0)), "hero")!.ignoresHardGround, undefined, "not worn");

  // ── Refusals ──
  refused(document({ ...flash, save: { save: "luck_save" } }), /Unknown save "luck_save"/);
  refused(
    document({ ...flash, applies: [{ condition: "dazzled", duration: { rounds: 1 } }] }),
    /Unknown condition "dazzled"/,
  );
  refused(document({ ...flash, blow: "thrown" }), /whenHit/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose items cross hard going freely (ignoresHardGround on an item) or whose conditions answer a hit by themselves (whenHit) requires schemaVersion 2 and capabilityApi 1.489 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(488) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(489) as never, document()), gate);
    const ringOnly = document();
    ringOnly.combat.conditions = ringOnly.combat.conditions.filter(
      (one: { condition: string }) => one.condition !== "holy",
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(488) as never, ringOnly), gate, "the ring alone");
  }

  console.log(
    "When hit: Holy Aura blinds a fiend that hits in melee and fails its save against the caster's number, held by the aura's concentration; not one that saves, shoots, is no fiend, or misses; the Ring of Free Action worn; gated at 1.489.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
