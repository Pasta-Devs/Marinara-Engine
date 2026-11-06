/**
 * Ways of moving given by a condition (Capability API 1.395).
 *
 *   - `speeds` on a combat condition: 5e's Fly gives a flying speed of 60 while it holds, and
 *     `"walk"` one as fast as its holder walks (Dragon Wings). A faster one of their own stays.
 *   - Given partway through a turn, the flight starts with what is left of the walk.
 *   - When it ends, somebody up in the air with no flight left falls; `hover` keeps them up while
 *     they cannot move.
 *   - `levitates`: Levitate moves its holder only up and down, never across.
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
  rulesetCombatOptions,
  rulesetReachableCells,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  RULESET_FLY_DOWN_OPTION,
  RULESET_FLY_UP_OPTION,
  RULESET_MOVE_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-given-flight-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 395);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, condition: string, concentration = true) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 3, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      budget: "action",
      ...(concentration ? { concentration: true } : {}),
      applies: [{ condition, duration: { rounds: 100 } }],
    },
  });
  const spells = [
    spell("fly", "Fly", "flying"),
    spell("dragon-wings", "Dragon Wings", "winged", false),
    spell("levitate", "Levitate", "levitating"),
  ];
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.combat.elevation = {
      levelHeight: 5,
      falling: { per: 10, dice: { count: 1, sides: 6 }, max: 20, type: "bludgeoning", prone: "prone" },
    };
    doc.sheet.live.conditions.push(
      { id: "flying", label: "Flying" },
      { id: "winged", label: "Dragon Wings" },
      { id: "levitating", label: "Levitating" },
    );
    doc.combat.conditions.push(
      { condition: "flying", effects: [], speeds: { fly: 60 } },
      { condition: "winged", effects: [], speeds: { fly: "walk" } },
      { condition: "levitating", effects: [], speeds: { fly: 20 }, levitates: true },
    );
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
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
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  let queued: number[] = [];
  const roll = (sides: number) => Math.min(sides, queued.shift() ?? 10);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const brute: RulesetStatBlock = {
    health: 100,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Smash", budget: "action", toHit: 30, damage: { count: 0, sides: 0, flat: 1 }, reach: 120 }],
  };
  const fight = (wizardSpeeds?: { fly: number }): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 18, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        { id: "brute", name: "Brute", side: "enemy", block: brute },
      ],
      board: {
        grid: { width: 20, height: 1, tiles: [Array(20).fill("plains")], elevation: [Array(20).fill(0)] },
        placements: { wizard: { x: 2, y: 0 }, brute: { x: 18, y: 0 } },
      },
    });
    if (wizardSpeeds) rulesetCombatant(state, "wizard")!.speeds = wizardSpeeds;
    state.order = ["wizard", "brute"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id = "wizard") => rulesetCombatant(state, id)!;
  const step = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const taken = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return taken;
  };
  const cast = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === label);
    assert.ok(option, `${label}: ${rulesetCombatOptions(definition, state, "wizard").map((one) => one.label)}`);
    return step(state, { actorId: "wizard", optionId: option.id, targetIds: ["wizard"] }).state;
  };
  const optionIds = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "wizard").map((one) => one.id);

  // ── Fly: a flying speed of 60 while it holds, from what is left of the walk ──
  {
    let state = fight();
    assert.equal(who(state).speeds, undefined, "a wizard only walks");
    // Two cells walked first.
    state = step(state, { actorId: "wizard", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 4, y: 0 } }).state;
    assert.equal(who(state).movementLeft, 4);
    state = cast(state, "Fly");
    const flying = who(state);
    assert.deepEqual(flying.speeds, { fly: 60 });
    assert.deepEqual(flying.baseSpeeds, {}, "their own: none");
    assert.equal(flying.movement, 12, "sixty feet a turn");
    assert.equal(flying.movementLeft, 10, "less the two cells already walked");
    assert.equal(flying.modeLeft?.fly, 10);
    assert.equal(flying.modeLeft?.walk, 4);
    assert.ok(optionIds(state).includes(RULESET_FLY_UP_OPTION), "up into the air");
    state = step(state, { actorId: "wizard", optionId: RULESET_FLY_UP_OPTION, targetIds: [] }).state;
    state = step(state, { actorId: "wizard", optionId: RULESET_FLY_UP_OPTION, targetIds: [] }).state;
    assert.equal(who(state).altitude, 2);
    // The brute's blow breaks the concentration: the flight is gone, and the wizard falls ten feet.
    state.turn = 1;
    who(state, "brute").budgets.action = 1;
    queued = [10, 1];
    const struck = step(state, {
      actorId: "brute",
      optionId: who(state, "brute").actions[0]!.id,
      targetIds: ["wizard"],
    });
    queued = [];
    const fallen = who(struck.state);
    assert.equal(fallen.speeds, undefined, "the flight goes with the spell");
    assert.equal(fallen.baseSpeeds, undefined);
    assert.equal(fallen.altitude, undefined, "down on the ground");
    assert.ok(
      of(struck.events, "fell").length + of(struck.events, "damage").length >= 2,
      JSON.stringify(struck.events),
    );
  }

  // ── Their own faster flight stays; Dragon Wings as fast as they walk ──
  {
    const fast = cast(fight({ fly: 90 }), "Fly");
    assert.deepEqual(who(fast).speeds, { fly: 90 }, "their own ninety, not the spell's sixty");
    const winged = cast(fight(), "Dragon Wings");
    assert.deepEqual(who(winged).speeds, { fly: 30 }, "as fast as they walk");
  }

  // ── Levitate: up and down only ──
  {
    const state = cast(fight(), "Levitate");
    const floating = who(state);
    assert.equal(floating.levitating, true);
    assert.equal(floating.hover, true);
    assert.deepEqual(rulesetReachableCells(definition, state, "wizard"), [], "never across");
    assert.ok(!optionIds(state).includes(RULESET_MOVE_OPTION));
    assert.ok(optionIds(state).includes(RULESET_FLY_UP_OPTION), "but up");
    const up = step(state, { actorId: "wizard", optionId: RULESET_FLY_UP_OPTION, targetIds: [] }).state;
    assert.ok(rulesetCombatOptions(definition, up, "wizard").some((one) => one.id === RULESET_FLY_DOWN_OPTION));
  }

  // ── Refusals ──
  {
    refused(
      document((doc) => doc.combat.conditions.push({ condition: "prone", effects: [], speeds: { teleport: 30 } })),
      /speeds/,
    );
    refused(
      document((doc) => doc.combat.conditions.push({ condition: "prone", effects: [], speeds: { fly: "run" } })),
      /speeds/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that gives ways of moving, hovering or levitation requires schemaVersion 2 and capabilityApi 1.395 or newer";
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
    const doc = document();
    assert.equal(getCapabilityPackageInstallIssue(manifest(394) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(395) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(394) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Given flight: Fly's sixty from what is left of the walk and a fall when it breaks, a faster own flight kept, Dragon Wings as fast as the walk, Levitate up and down only; gated at 1.395.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
