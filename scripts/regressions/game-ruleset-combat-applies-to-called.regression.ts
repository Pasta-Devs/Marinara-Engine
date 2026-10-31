/**
 * What an entry puts on going on what it calls, and called objects that take no turns (Capability
 * API 1.479).
 *
 *   - Antipathy cast on an object: the object comes, takes no turn and keeps no side standing; its
 *     condition remembers the kind named, and its aura asks only that kind its save. Nobody it is
 *     aimed at or beside gets the condition.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetEncounterOutcome,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-applies-to-called-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 479);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const antipathy = (mechanics: Record<string, unknown> = {}) => ({
    id: "antipathy",
    label: "Antipathy",
    rows: [{ list: "spells", values: { name: "Antipathy", level: 1, prepared: true } }],
    mechanics: {
      kind: "utility",
      targets: "self",
      kindChoice: true,
      calls: { creature: "creatures/antipathy-object", count: { flat: 1 }, initiative: "none" },
      applies: [{ condition: "repugnant", duration: { rounds: 1000 } }],
      appliesToCalled: true,
      ...mechanics,
    },
  });
  const document = (mechanics: Record<string, unknown> = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.combat.creatureTypes = {
      types: ["beast", "humanoid", "object"].map((id) => ({ id, label: id })),
      field: "race",
      default: "humanoid",
    };
    doc.sheet.live.conditions.push({ id: "repugnant", label: "Antipathy" }, { id: "repelled", label: "Repelled" });
    doc.combat.conditions.push(
      {
        condition: "repugnant",
        effects: [],
        auras: [
          {
            distance: 60,
            side: "all",
            chosenKind: true,
            save: {
              save: "wis_save",
              difficulty: 15,
              applies: [
                { condition: "repelled", duration: "until-save", saveEnds: { save: "wis_save", at: "turn-end" } },
              ],
            },
          },
        ],
      },
      { condition: "repelled", effects: [], behavior: { moves: "away" } },
    );
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "antipathy-object",
        label: "Antipathy's object",
        creature: {
          health: 20,
          defense: 10,
          initiativeModifier: 0,
          speed: 0,
          tier: "cr_0",
          type: "object",
          actions: [{ id: "stand", name: "Stand", budget: "action", toHit: 0, damage: { flat: 0 }, reach: 5 }],
        },
      });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [antipathy(mechanics)] });
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
  const spells = definition.catalogs!.find((entry) => entry.id === "spells")!.entries! as RulesetCatalogEntry[];
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, ac: 14, speed: 30, hp_max: 40, race: "Human", spellcasting_ability: "wis" },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const block = (type: string): RulesetStatBlock => ({
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    type,
    saves: { wis_save: -10 },
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 0, sides: 0, flat: 1 } }],
  });
  let faces: Record<number, number[]> = {};
  const roll = (sides: number) => faces[sides]?.shift() ?? 10;
  const fight = (): RulesetEncounterState => {
    faces = {};
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries! },
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, catalogs: { spells } },
        { id: "friend", name: "Friend", side: "party", build, live: {} },
        { id: "wolf", name: "Wolf", side: "enemy", block: block("beast") },
        { id: "goblin", name: "Goblin", side: "enemy", block: block("humanoid") },
      ],
      board: {
        grid: { width: 20, height: 3, tiles: Array.from({ length: 3 }, () => Array(20).fill("plains")) },
        placements: { hero: { x: 0, y: 1 }, friend: { x: 1, y: 1 }, wolf: { x: 6, y: 1 }, goblin: { x: 7, y: 1 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const done = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const into = (state: RulesetEncounterState, id: string) => {
    const at = state.order.indexOf(id);
    state.turn = at - 1;
    return act(state, { actorId: state.order[at - 1]!, optionId: "end-turn", targetIds: [] });
  };
  const savesOf = (events: RulesetCombatEvent[], id: string) => of(events, "save").filter((one) => one.actorId === id);

  // ── Cast on an object: it comes, takes no turn, and holds the condition with the kind named ──
  const state = fight();
  const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label.startsWith("Antipathy"))!;
  assert.ok(option);
  const cast = act(state, { actorId: "hero", optionId: option.id, targetIds: [], mode: "kind-beast" });
  const called = of(cast.events, "called")[0]!;
  assert.equal(called.ids.length, 1);
  const object = who(cast.state, called.ids[0]!);
  assert.equal(object.turnless, true);
  assert.ok(!cast.state.order.includes(object.id), "no turn of its own");
  assert.equal(object.tracked.find((one) => one.condition === "repugnant")?.kind, "beast");
  assert.ok(!has(cast.state, "hero", "repugnant") && !has(cast.state, "friend", "repugnant"), "on nobody else");

  // ── Its aura asks the beast, not the goblin ──
  {
    const next = structuredClone(cast.state);
    faces = { 20: [1] };
    const wolf = into(next, "wolf");
    assert.equal(savesOf(wolf.events, "wolf").length, 1);
    assert.ok(has(wolf.state, "wolf", "repelled"));
    const goblin = into(structuredClone(wolf.state), "goblin");
    assert.equal(savesOf(goblin.events, "goblin").length, 0, "a goblin is no beast");
  }

  // ── It keeps no side standing ──
  {
    const lost = structuredClone(cast.state);
    for (const id of ["hero", "friend"]) {
      who(lost, id).down = true;
      who(lost, id).defeated = true;
    }
    assert.equal(rulesetEncounterOutcome(lost), "defeat");
  }

  // ── Refusals ──
  refused(document({ calls: undefined }), /appliesToCalled/);
  refused(document({ applies: undefined, kindChoice: undefined }), /appliesToCalled/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries put what they apply on what they call, or call what takes no turns (appliesToCalled, initiative none), requires schemaVersion 2 and capabilityApi 1.479 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(478) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(479) as never, document()), gate);
    const turnsOnly = document({ appliesToCalled: undefined });
    assert.equal(getCapabilityPackageInstallIssue(manifest(478) as never, turnsOnly), gate, "initiative none alone");
  }

  console.log(
    "Applies to called: Antipathy cast on an object that takes no turn, its aura reaching only the kind named; gated at 1.479.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
