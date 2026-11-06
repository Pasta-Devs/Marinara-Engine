/**
 * Conditions that last a number of days (Capability API 1.663): 5e's Quivering Palm, "the
 * vibrations last for a number of days equal to your monk level".
 *
 *   - Put on in a fight with `duration: "until-dispelled"` and `lastsDays` read off the sheet of
 *     whoever puts it on: no clock while the fight goes on.
 *   - As the fight ends, its holder's sheet keeps how many days are left, and the sheet's `pass`
 *     command counts them down, taking it off once they are gone.
 *   - Taken off another way, the days left go with it.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  createRulesetEncounter,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-condition-days-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 663);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const palm = (applies: Record<string, unknown>) => ({
    id: "palm",
    label: "Quivering Palm",
    rows: [{ list: "spells", values: { name: "Quivering Palm", level: 1, prepared: true } }],
    mechanics: {
      kind: "debuff",
      budget: "action",
      range: 5,
      targets: "ally",
      applies: [{ condition: "quivering", ...applies }],
    },
  });
  const fiveE = (
    applies: Record<string, unknown> = { duration: "until-dispelled", lastsDays: { field: "level" } },
  ): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "quivering", label: "Quivering" });
    doc.combat.conditions.push({ condition: "quivering", effects: [] });
    doc.catalogs.push({ id: "ki", label: "Ki", feeds: ["spells"], entries: [palm(applies)] });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "ki")!.entries! as RulesetCatalogEntry[];
  const allyBuild = rulesetSheetBuildSchema.parse({ fields: { level: 3, ac: 12, speed: 30, hp_max: 30 } });

  // ── In the fight: on with no clock, and its days read off the monk's sheet ──
  let live: RulesetLiveState;
  {
    let state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "monk",
          name: "Monk",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 16, cha: 10 },
            fields: { level: 17, ac: 16, speed: 50, hp_max: 90, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: {
              spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
            },
          }),
          catalogs: { spells: entries },
        },
        { id: "ally", name: "Ally", side: "party", build: allyBuild, live: {} },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: { width: 8, height: 3, tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")) } as never,
        placements: { monk: { x: 1, y: 1 }, ally: { x: 2, y: 1 }, foe: { x: 6, y: 1 } },
      },
    });
    state.order = ["monk", "ally", "foe"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "monk").find((one) => one.label === "Quivering Palm");
    assert.ok(option, "offered");
    const result = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "monk", optionId: option.id, targetIds: ["ally"] },
      () => 10,
    );
    assert.deepEqual(of(result.events, "refused"), [], JSON.stringify(result.events));
    state = result.state;
    const ally = rulesetCombatant(state, "ally")!;
    const entry = ally.tracked.find((one) => one.condition === "quivering");
    assert.ok(entry, JSON.stringify(result.events));
    assert.equal(entry.rounds, null, "no clock in the fight");
    assert.equal(entry.days, 17, "the monk's level");
    const events = liftRulesetFightEffects(definition, state);
    assert.deepEqual(
      events.filter((one) => one.type === "condition" && one.condition === "quivering"),
      [],
      "not lifted as the fight ends",
    );
    live = ally.sheet!.live as RulesetLiveState;
    assert.deepEqual(live.conditions, ["quivering"]);
    assert.deepEqual(live.dayClocks, { quivering: 17 });
  }

  // ── Days pass: counted down, then off ──
  {
    const pass = (from: RulesetLiveState, days: number) => {
      const result = applyRulesetSheetOp(definition, allyBuild, from, { op: "pass", days });
      assert.ok(result.ok, JSON.stringify(result));
      return result;
    };
    let step = pass(live, 10);
    assert.deepEqual(step.live.conditions, ["quivering"], "10 days in");
    assert.deepEqual(step.live.dayClocks, { quivering: 7 });
    step = pass(step.live, 7);
    assert.match(step.now, /Quivering ended/);
    assert.ok(!(step.live.conditions ?? []).includes("quivering"), "ended");
    assert.equal(step.live.dayClocks, undefined, "its days go with it");
  }
  // ── Taken off another way, its days go too ──
  {
    const off = applyRulesetSheetOp(definition, allyBuild, live, {
      op: "condition",
      condition: "quivering",
      active: false,
    });
    assert.ok(off.ok);
    assert.equal(off.live.dayClocks, undefined);
  }

  // ── Refused ──
  refused(fiveE({ duration: { rounds: 10 }, lastsDays: { const: 3 } }), /"lastsDays" is its clock outside a fight/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions last a number of days (an applied condition's lastsDays) requires schemaVersion 2 and capabilityApi 1.663 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(662) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(663) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(662) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Condition days: Quivering Palm's vibrations have no clock in the fight, keep the monk's level in days on the sheet as it ends, and come off as they pass; gated at 1.663.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
