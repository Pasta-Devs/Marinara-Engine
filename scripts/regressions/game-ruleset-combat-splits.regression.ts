/**
 * Splitting in two (Capability API 1.475).
 *
 *   - Black Pudding: slashing that leaves it standing with 10 or more splits it, each half its health
 *     and one size smaller, the second beside it and acting right after it; lightning splits a
 *     Medium one again; one already below Medium, one under 10, or fire does not. One immune to
 *     what it splits on splits all the same, the blow dealing nothing.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetFootprint,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-splits-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 475);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hit = (id: string, label: string, damageType: string, flat: number) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
      mechanics: { kind: "attack", targets: "enemy", range: 120, autoHit: true, amount: { flat }, damageType },
    }) as unknown as RulesetCatalogEntry;
  const entries = [
    hit("cut", "Cut", "slashing", 10),
    hit("zap", "Zap", "lightning", 10),
    hit("burn", "Burn", "fire", 10),
  ];
  const splits = { by: ["lightning", "slashing"], atLeast: 10, smallest: "medium" };
  const fiveE = (creature: Record<string, unknown> = { splits }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sizes = {
      order: [
        { id: "small", label: "Small" },
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large", cells: 2 },
      ],
      default: "medium",
    };
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "pudding",
        label: "Pudding",
        creature: {
          health: 85,
          defense: 7,
          initiativeModifier: 0,
          speed: 20,
          tier: "cr_4",
          actions: [{ id: "pseudopod", name: "Pseudopod", budget: "action", toHit: 5, damage: { flat: 6 }, reach: 5 }],
          ...creature,
        },
      });
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
  const block = (health: number, size: string, more: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      ...more,
      health,
      defense: 7,
      initiativeModifier: 0,
      speed: 20,
      actions: [],
      splits,
      size,
    }) as unknown as RulesetStatBlock;
  const fight = (health = 85, size = "large", more: Record<string, unknown> = {}) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "pudding", name: "Pudding", side: "enemy", block: block(health, size, more) },
      ],
      board: {
        grid: { width: 12, height: 12, tiles: Array.from({ length: 12 }, () => Array(12).fill("plains")) },
        placements: { mage: { x: 1, y: 1 }, pudding: { x: 6, y: 6 } },
      },
    });
    state.order = ["mage", "pudding"];
    state.turn = 0;
    return state;
  };
  const cast = (state: RulesetEncounterState, label: string, targetId = "pudding") => {
    state.turn = state.order.indexOf("mage");
    rulesetCombatant(state, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [targetId] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;

  // ── Slashing: a Large pudding splits into two Medium ones ──
  const first = cast(fight(), "Cut");
  {
    const state = first.state;
    assert.deepEqual(
      of(first.events, "split").map((one) => [one.actorId, one.ids, one.health]),
      [["pudding", ["pudding-split-1"], 37]],
      "75 left: two of 37",
    );
    assert.equal(hp(state, "pudding"), 37);
    assert.equal(hp(state, "pudding-split-1"), 37);
    assert.equal(rulesetCombatant(state, "pudding")!.size, "medium");
    assert.equal(rulesetCombatant(state, "pudding-split-1")!.size, "medium");
    assert.equal(rulesetFootprint(rulesetCombatant(state, "pudding")).length, 1, "one cell now");
    const twin = rulesetCombatant(state, "pudding-split-1")!;
    assert.ok(twin.x !== undefined && !(twin.x === 6 && twin.y === 6), "set down beside it");
    assert.deepEqual(state.order, ["mage", "pudding", "pudding-split-1"], "acting straight after it");
  }

  // ── Lightning splits a Medium one again, into Small ones; a Small one does not split ──
  {
    const again = cast(first.state, "Zap");
    assert.deepEqual(
      of(again.events, "split").map((one) => [one.ids, one.health]),
      [[["pudding-split-2"], 13]],
    );
    assert.equal(rulesetCombatant(again.state, "pudding")!.size, "small");
    const small = cast(again.state, "Cut");
    assert.deepEqual(of(small.events, "split"), [], "below Medium: no split");
  }

  // ── Immune to lightning and slashing, as the SRD's oozes are: it splits, nothing dealt ──
  {
    const immune = { immune: ["lightning", "slashing"] };
    const zapped = cast(fight(85, "large", immune), "Zap");
    assert.deepEqual(
      of(zapped.events, "split").map((one) => [one.ids, one.health]),
      [[["pudding-split-1"], 42]],
      "85 kept: two of 42",
    );
    assert.equal(rulesetCombatant(zapped.state, "pudding")!.size, "medium");
    assert.deepEqual(of(cast(fight(85, "large", { immune: ["fire"] }), "Burn").events, "split"), [], "fire still not");
  }

  // ── Fire, or under 10 left: no split ──
  assert.deepEqual(of(cast(fight(), "Burn").events, "split"), [], "fire does not split it");
  assert.deepEqual(of(cast(fight(18), "Cut").events, "split"), [], "8 left: too few");

  // ── Refusals ──
  refused(fiveE({ splits: { by: [], atLeast: 10 } }), /splits/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose creatures split in two when harmed (splits) requires schemaVersion 2 and capabilityApi 1.475 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(474) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(475) as never, fiveE()), gate);
  }

  console.log(
    "Splits: a Black Pudding split by slashing or lightning into two of half its health, a size smaller, beside it and after it, immune to it or not; not by fire, under 10 or below Medium; gated at 1.475.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
