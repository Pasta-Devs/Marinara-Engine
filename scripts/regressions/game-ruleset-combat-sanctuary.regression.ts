/**
 * A sanctuary (Capability API 1.423).
 *
 *   - Sanctuary: whoever attacks its holder first makes a Wisdom save against the difficulty it was put
 *     on with; failed, the attack goes to the nearest other creature it could be made at, or is lost.
 *   - Saved, the attack goes ahead; an area is never stopped.
 *   - Nature's Sanctuary: only beasts and plants, the difficulty off the druid's sheet, and one that
 *     saved is free of it for the fight.
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
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sanctuary-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 423);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.combat.creatureTypes = {
      types: ["beast", "plant", "humanoid"].map((id) => ({ id, label: id })),
      field: "race",
      default: "humanoid",
    };
    doc.sheet.live.conditions.push(
      { id: "sanctuary", label: "Sanctuary" },
      { id: "natures_sanctuary", label: "Nature's Sanctuary" },
    );
    doc.combat.conditions.push(
      { condition: "sanctuary", effects: [], sanctuary: { save: "wis_save" } },
      {
        condition: "natures_sanctuary",
        effects: [],
        sanctuary: {
          save: "wis_save",
          difficulty: { const: 15 },
          from: { types: ["beast", "plant"] },
          immuneOnSave: true,
        },
      },
    );
    edit(doc);
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
  const hero = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
      fields: { level: 6, ac: 12, speed: 30, hp_max: 40 },
    });
  const block = (type: string): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      type,
      saves: { wis_save: 0 },
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 5, damage: { count: 0, sides: 0, flat: 4 }, reach: 5 },
        {
          id: "roar",
          name: "Roar",
          budget: "action",
          damage: { count: 0, sides: 0, flat: 3 },
          area: { shape: "burst", size: 10 },
          range: 30,
          save: { save: "con_save", difficulty: 30, onSuccess: "half" },
        },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 12,
    tiles: Array.from({ length: 12 }, () => Array(20).fill("plains")),
  });
  let queue: number[] = [];
  const roller = (sides: number) => (sides === 20 ? (queue.shift() ?? 10) : 1);
  const fight = (
    condition: string,
    { ally = true, type = "beast", difficulty }: { ally?: boolean; type?: string; difficulty?: number } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "foe", name: "Foe", side: "enemy", block: block(type) },
        { id: "hero", name: "Hero", side: "party", build: hero(), live: {} },
        ...(ally ? [{ id: "ally", name: "Ally", side: "party" as const, build: hero(), live: {} }] : []),
      ],
      board: {
        grid: grid(),
        placements: { foe: { x: 6, y: 5 }, hero: { x: 5, y: 5 }, ...(ally ? { ally: { x: 7, y: 5 } } : {}) },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    rulesetCombatant(state, "hero")!.tracked.push({
      condition,
      rounds: null,
      ...(difficulty !== undefined ? { difficulty } : {}),
    } as never);
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, label: string, d20s: number[], choice: Record<string, unknown> = {}) => {
    queue = [...d20s];
    state.turn = 0;
    who(state, "foe").budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "foe").find((one) => one.label === label);
    assert.ok(option, `the foe can ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "foe", optionId: option.id, targetIds: ["hero"], ...choice },
      roller,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const attacked = (step: ReturnType<typeof act>) => of(step.events, "attack").map((one) => one.targetId);

  // ── Sanctuary: a failed save sends the claw to the ally beside the foe, or loses it ──
  {
    const sent = act(fight("sanctuary", { difficulty: 13 }), "Claw", [2, 18]);
    assert.deepEqual(
      of(sent.events, "save").map((one) => [one.actorId, one.save, one.success]),
      [["foe", "wis_save", false]],
    );
    assert.deepEqual(
      of(sent.events, "sanctuary").map((one) => [one.actorId, one.holderId, one.to]),
      [["foe", "hero", "ally"]],
    );
    assert.deepEqual(attacked(sent), ["ally"]);
    const lost = act(fight("sanctuary", { difficulty: 13, ally: false }), "Claw", [2, 18]);
    assert.deepEqual(
      of(lost.events, "sanctuary").map((one) => one.to),
      [undefined],
    );
    assert.deepEqual(attacked(lost), [], "lost, with nobody else to make it at");
    // Saved, it goes ahead.
    assert.deepEqual(attacked(act(fight("sanctuary", { difficulty: 13 }), "Claw", [18, 18])), ["hero"]);
    // An area is never stopped.
    const roar = act(fight("sanctuary", { difficulty: 13 }), "Roar", [], { targetIds: [], at: { x: 5, y: 5 } });
    assert.equal(of(roar.events, "sanctuary").length, 0);
    assert.ok(of(roar.events, "damage").some((one) => one.targetId === "hero"));
  }

  // ── Nature's Sanctuary: beasts and plants, its difficulty off the sheet, free of it once saved ──
  {
    assert.deepEqual(
      attacked(act(fight("natures_sanctuary", { type: "humanoid" }), "Claw", [18])),
      ["hero"],
      "a humanoid is not stopped",
    );
    const beast = fight("natures_sanctuary");
    const sent = act(beast, "Claw", [14, 18]);
    assert.deepEqual(
      of(sent.events, "save").map((one) => [one.success, one.difficulty]),
      [[false, 15]],
    );
    assert.deepEqual(attacked(sent), ["ally"]);
    const saved = act(sent.state, "Claw", [15, 18]);
    assert.deepEqual(attacked(saved), ["hero"]);
    const free = act(saved.state, "Claw", [2, 18]);
    assert.equal(of(free.events, "save").length, 0, "no save once it saved");
    assert.deepEqual(attacked(free), ["hero"]);
  }

  // ── Refusals ──
  {
    const withWard = (sanctuary: Record<string, unknown>) =>
      document((doc) => {
        doc.combat.conditions.at(-1).sanctuary = sanctuary;
      });
    refused(withWard({ save: "luck_save" }), /Unknown save "luck_save"/);
    refused(withWard({ save: "wis_save", difficulty: { derived: "nothing_here" } }), /nothing_here/);
    refused(withWard({ save: "wis_save", from: { types: ["fiend"] } }), /fiend/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions keep attacks off their holder behind a save (sanctuary) requires schemaVersion 2 and capabilityApi 1.423 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(422) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(423) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(422) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Sanctuary: a failed save sends an attack to the nearest other creature or loses it, a save lets it through, an area is never stopped; Nature's Sanctuary holds only beasts and plants, reads its difficulty off the sheet and frees one that saved; gated at 1.423.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
