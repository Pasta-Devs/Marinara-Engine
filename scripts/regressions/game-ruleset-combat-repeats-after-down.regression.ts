/**
 * A concentration entry moved on once its target is down (Capability API 1.604): Hunter's Mark.
 *
 *   - `repeats.afterTargetDown`: the repeat is offered only once everybody the cast was last aimed
 *     at is down, at no cost; made, what the cast put on them moves to the new target, and the new
 *     target is the one it waits on next.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-repeats-after-down-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 604);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const mark = (repeats: Record<string, unknown>, applies = true) =>
    ({
      id: "hunters-mark",
      label: "Hunter's Mark",
      rows: [{ list: "spells", values: { name: "Hunter's Mark", level: 1, prepared: true } }],
      mechanics: {
        cost: [{ pool: "slots_1", amount: 1 }],
        kind: "debuff",
        budget: "bonus",
        range: 90,
        autoHit: true,
        concentration: true,
        repeats,
        ...(applies
          ? { applies: [{ condition: "marked", duration: { rounds: 600 } }] }
          : { amount: { flat: 1 }, damageType: "force" }),
      },
    }) as unknown as RulesetCatalogEntry;
  const fiveE = (
    entry: RulesetCatalogEntry = mark({ budget: "bonus", afterTargetDown: true }),
  ): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "marked", label: "Marked" });
    doc.combat.conditions.push({ condition: "marked", effects: [] });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [entry] });
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
  const spells = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 14, cha: 10 },
    fields: { level: 5, ac: 14, speed: 30, hp_max: 40, slots_max_1: 4, spellcasting_ability: "wis" },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const foe = (id: string) => ({
    id,
    name: id.toUpperCase(),
    side: "enemy" as const,
    block: {
      health: 20,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    } as unknown as RulesetStatBlock,
  });
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      { id: "ranger", name: "Ranger", side: "party", build, live: {}, catalogs: { spells } },
      foe("a"),
      foe("b"),
    ],
    board: {
      grid: { width: 20, height: 5, tiles: Array.from({ length: 5 }, () => Array(20).fill("plains")) } as never,
      placements: { ranger: { x: 2, y: 2 }, a: { x: 8, y: 2 }, b: { x: 9, y: 3 } },
    },
  });
  state.order = ["ranger", "a", "b"];
  state.turn = 0;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const optionsOf = (s: RulesetEncounterState) => {
    s.turn = 0;
    const ranger = rulesetCombatant(s, "ranger")!;
    for (const key of Object.keys(ranger.budgets)) ranger.budgets[key] = 1;
    return rulesetCombatOptions(definition, s, "ranger");
  };
  const again = (s: RulesetEncounterState) => optionsOf(s).find((one) => one.id.endsWith(":again"));
  const choose = (s: RulesetEncounterState, optionId: string, targetIds: string[]): RulesetCombatStep => {
    optionsOf(s);
    const step = applyRulesetCombatChoice(definition, s, { actorId: "ranger", optionId, targetIds }, () => 10);
    assert.deepEqual(of(step.events, "refused"), []);
    return step;
  };
  const holds = (s: RulesetEncounterState, id: string) =>
    rulesetCombatant(s, id)!.tracked.some((one) => one.condition === "marked");

  // ── Marked, and not offered again while the mark stands ──
  const cast = choose(state, optionsOf(state).find((one) => one.label === "Hunter's Mark")!.id, ["a"]);
  assert.ok(holds(cast.state, "a"));
  assert.equal(again(cast.state), undefined, "a still stands");

  // ── Down, it is offered at no cost and moves the mark ──
  rulesetCombatant(cast.state, "a")!.down = true;
  const offered = again(cast.state);
  assert.ok(offered, "offered once the target is down");
  const slots = rulesetCombatant(cast.state, "ranger")!.sheet!.live.slots_1;
  const moved = choose(cast.state, offered.id, ["b"]);
  assert.ok(holds(moved.state, "b"), "the new target is marked");
  assert.ok(!holds(moved.state, "a"), "the mark moved off the old one");
  assert.equal(rulesetCombatant(moved.state, "ranger")!.sheet!.live.slots_1, slots, "costing nothing");
  assert.deepEqual(rulesetCombatant(moved.state, "ranger")!.concentrating?.targets, ["b"]);
  assert.equal(again(moved.state), undefined, "b stands, so not again");

  // ── Refusals ──
  refused(
    fiveE(mark({ budget: "bonus", afterTargetDown: true }, false)),
    /"afterTargetDown" moves what the entry applies/,
  );
  refused(
    fiveE(mark({ budget: "bonus", afterTargetDown: true, sameTargets: true })),
    /"afterTargetDown" moves what the entry applies/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an entry made again only once its target is down (repeats.afterTargetDown) requires schemaVersion 2 and capabilityApi 1.604 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(603) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(604) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(603) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Repeats after target down: Hunter's Mark offered again only once its target is down, the mark moved at no cost; gated at 1.604.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
