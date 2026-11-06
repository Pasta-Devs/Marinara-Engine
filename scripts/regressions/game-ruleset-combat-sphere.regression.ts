/**
 * A zone anybody near may move on a check (Capability API 1.694): 5e's Sphere of Annihilation, moved
 * with a DC Arcana check by whoever is within 60 feet, 5 × their Intelligence modifier feet, coming
 * 10 feet at whoever fails, and contested once somebody else moved it last.
 *
 *   - Offered to everybody within reach of it, caster or not, as far as their own modifier says.
 *   - Failing the difficulty, it comes at the mover; meeting it, it goes where they picked and is theirs.
 *   - Moved by somebody else while it is held, the check is contested by the holder's; the tie theirs.
 *   - Moved onto somebody, it catches them as entering it does.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_ZONE_CHECK_OPTION_PREFIX,
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
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sphere-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 694);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const check = {
    check: "arcana",
    difficulty: 14,
    within: 60,
    distanceBy: { abilityMod: "int", times: 5, atLeast: 5 },
    failsToward: 10,
  };
  const document = (moveCheck: Record<string, unknown> = check) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push({ id: "arcana", label: "Arcana", value: { abilityMod: "int" } });
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "sphere",
          label: "Sphere",
          rows: [{ list: "spells", values: { name: "Sphere", level: 5, prepared: true } }],
          mechanics: {
            kind: "attack",
            area: { shape: "burst", size: 5 },
            range: 60,
            amount: { dice: "4d10" },
            damageType: "force",
            save: { save: "dex_save", onSuccess: "negates" },
            zone: {
              rounds: 100,
              outlasts: true,
              triggers: ["enter"],
              atCast: false,
              move: { budget: "action", distance: 5, check: moveCheck },
            },
          },
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "wizard",
        name: "Wizard",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
          fields: { level: 9, ac: 12, speed: 30, hp_max: 50, spellcasting_ability: "int", slots_max_5: 1 },
          lists: { spells: entries.flatMap((one) => rowsFromCatalogEntry("spells", one).map((row) => row.row)) },
        }),
        live: {},
        catalogs: { spells: entries },
      },
      {
        id: "fighter",
        name: "Fighter",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
          fields: { level: 9, ac: 16, speed: 30, hp_max: 60 },
        }),
        live: {},
      },
      {
        id: "orc",
        name: "Orc",
        side: "enemy",
        block: {
          health: 30,
          defense: 13,
          initiativeModifier: -20,
          actions: [],
          abilities: { int: 14 },
          checks: { arcana: 6 },
        } as unknown as RulesetStatBlock,
      },
    ],
    board: {
      grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) },
      placements: { wizard: { x: 2, y: 4 }, fighter: { x: 6, y: 4 }, orc: { x: 14, y: 4 } },
    },
  } as never);
  state.order = ["wizard", "fighter", "orc"];
  state.turn = 0;
  const choose = (from: RulesetEncounterState, actorId: string, to?: { x: number; y: number }) => {
    const turn = structuredClone(from);
    turn.turn = turn.order.indexOf(actorId);
    const actor = rulesetCombatant(turn, actorId)!;
    actor.budgets.action = 1;
    const option = rulesetCombatOptions(definition, turn, actorId).find((one) =>
      one.id.startsWith(RULESET_ZONE_CHECK_OPTION_PREFIX),
    );
    assert.ok(option, `${actorId} may try to move it`);
    const step = applyRulesetCombatChoice(
      definition,
      turn,
      { actorId, optionId: option.id, targetIds: [], to: to ?? option.cells![0]! },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    return { option, ...step };
  };
  const sphereAt = (from: RulesetEncounterState) => rulesetCombatant(from, "wizard")!.zones![0]!.at;

  // ── Made where the wizard aims it ──
  const castOption = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Sphere");
  assert.ok(castOption, "offered");
  const cast = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "wizard", optionId: castOption.id, targetIds: [], at: { x: 10, y: 4 } },
    () => 10,
  );
  assert.deepEqual(of(cast.events, "refused"), []);
  assert.deepEqual(sphereAt(cast.state), { x: 10, y: 4 });
  // Its caster moves it as anybody does, and not by the zone's own move.
  assert.equal(
    rulesetCombatOptions(definition, cast.state, "wizard").some((one) => one.id.startsWith("zone:")),
    false,
  );

  // ── The fighter: 10 + 0 against 14, failed (and 5 feet at least to move it); it comes 10 feet at them ──
  const fighter = choose(cast.state, "fighter", { x: 10, y: 3 });
  assert.deepEqual(
    of(fighter.events, "contest").map((one) => [one.difficulty, one.winner]),
    [[14, "target"]],
  );
  assert.deepEqual(sphereAt(fighter.state), { x: 8, y: 4 }, "two cells toward the fighter");
  assert.equal(rulesetCombatant(fighter.state, "wizard")!.zones![0]!.heldBy, undefined);

  // ── The orc: 10 + 6 meets 14; 5 × 2 = 10 feet, onto the fighter, who is caught ──
  const orc = choose(fighter.state, "orc", { x: 6, y: 4 });
  const reach = orc.option.cells!.map((cell) => Math.max(Math.abs(cell.x - 8), Math.abs(cell.y - 4)));
  assert.equal(Math.max(...reach), 2, "as far as the orc's Intelligence says");
  assert.deepEqual(
    of(orc.events, "contest").map((one) => one.winner),
    ["actor"],
  );
  assert.deepEqual(sphereAt(orc.state), { x: 6, y: 4 });
  assert.equal(rulesetCombatant(orc.state, "wizard")!.zones![0]!.heldBy, "orc");
  assert.ok(
    of(orc.events, "damage").some((one) => one.targetId === "fighter"),
    `the fighter is caught: ${JSON.stringify(orc.events)}`,
  );

  // ── The wizard against the orc's hold: 14 against 16, lost; it stays ──
  const wizard = choose(orc.state, "wizard");
  const contest = of(wizard.events, "contest")[0]!;
  assert.equal(contest.targetId, "orc");
  assert.equal(contest.difficulty, undefined, "contested, not against the difficulty");
  assert.equal(contest.winner, "target");
  assert.deepEqual(sphereAt(wizard.state), { x: 6, y: 4 }, "a contest lost moves nothing");

  // ── Refused ──
  refused(document({ ...check, check: "lore" }), /Unknown check "lore"/);
  refused(document({ ...check, distanceBy: { abilityMod: "luck", times: 5 } }), /Unknown ability "luck"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a zone anybody near may move on a check (zone.move.check) requires schemaVersion 2 and capabilityApi 1.694 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(693) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(694) as never, document()), gate);
  }

  console.log(
    "Sphere: moved by anybody near on an Arcana check, coming at a failed mover, contested while held, catching whoever it is moved onto; gated at 1.694.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
