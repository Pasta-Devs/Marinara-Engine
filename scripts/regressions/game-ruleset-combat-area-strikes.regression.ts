/**
 * Weapon strikes over an area, and a strike again (Capability API 1.428).
 *
 *   - Whirlwind Attack: the best melee weapon at every foe within 5 feet, a roll for each, never a
 *     friend beside them.
 *   - Volley: the best ranged weapon at every foe within 10 feet of a point, set down as far as the
 *     bow carries.
 *   - Horde Breaker: after a weapon attack at one foe, the same weapon at another within 5 feet of
 *     them, for nothing, once a turn.
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
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-area-strikes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 428);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const features = [
    {
      id: "whirlwind",
      label: "Whirlwind Attack",
      rows: [{ list: "features", values: { name: "Whirlwind Attack" } }],
      mechanics: { kind: "utility", strikesWith: "melee", area: { shape: "burst", size: 5, around: true } },
    },
    {
      id: "volley",
      label: "Volley",
      rows: [{ list: "features", values: { name: "Volley" } }],
      mechanics: { kind: "utility", strikesWith: "ranged", area: { shape: "burst", size: 10 } },
    },
  ] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.derived.push({ id: "ranger_level", label: "Ranger level", op: "sum", of: [{ field: "level" }] });
    doc.combat.levels = [...(doc.combat.levels ?? []), { derived: "ranger_level", at: 3, strikesAgain: { within: 5 } }];
    doc.catalogs.push({ id: "ranger", label: "Ranger", feeds: ["features"], entries: structuredClone(features) });
    edit(doc);
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
  const block = (): RulesetStatBlock =>
    ({
      health: 80,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 0, reach: 5, damage: { count: 0, sides: 0, flat: 1 } },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 30,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(30).fill("plains")),
  });
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (level = 11): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "ranger",
          name: "Ranger",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 16, con: 14, int: 8, wis: 14, cha: 8 },
            fields: { level, ac: 15, speed: 30, hp_max: 90 },
            lists: {
              attacks: [
                { name: "Greataxe", ability: "str", proficient: true, bonus: 0, damage: "1d12", reach: 5 },
                { name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 },
                {
                  name: "Longbow",
                  ability: "dex",
                  proficient: true,
                  bonus: 0,
                  damage: "1d8",
                  range: 150,
                  long_range: 600,
                },
              ],
              features: features.flatMap((entry) =>
                rowsFromCatalogEntry("ranger", entry).flatMap((one) => (one.list === "features" ? [one.row] : [])),
              ),
            },
          }),
          live: {},
          catalogs: { ranger: features },
        },
        { id: "ally", name: "Ally", side: "party", block: block() },
        ...["a", "b", "c", "d", "e", "f"].map((id) => ({
          id,
          name: id.toUpperCase(),
          side: "enemy" as const,
          block: block(),
        })),
      ],
      board: {
        grid: grid(),
        placements: {
          ranger: { x: 5, y: 5 },
          ally: { x: 5, y: 6 },
          a: { x: 6, y: 5 },
          b: { x: 6, y: 6 },
          c: { x: 4, y: 4 },
          d: { x: 15, y: 5 },
          e: { x: 16, y: 6 },
          f: { x: 22, y: 5 },
        },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const optionOf = (state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, state, "ranger").find((one) => one.label === label);
  const act = (state: RulesetEncounterState, label: string, choice: Partial<RulesetCombatChoice>) => {
    const option = optionOf(state, label);
    assert.ok(option, `no ${label}: ${rulesetCombatOptions(definition, state, "ranger").map((one) => one.label)}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ranger", optionId: option.id, targetIds: [], ...choice },
      roll,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const struck = (step: ReturnType<typeof act>) =>
    of(step.events, "attack")
      .map((one) => one.targetId)
      .sort();
  const strikesOf = (step: ReturnType<typeof act>) => of(step.events, "attack").map((one) => one.label);

  // ── Whirlwind Attack ──
  {
    const whirl = act(fight(), "Whirlwind Attack", {});
    assert.deepEqual(struck(whirl), ["a", "b", "c"], "every foe within 5 feet, never the ally");
    assert.deepEqual(new Set(strikesOf(whirl)), new Set(["Greataxe"]), "with the best melee weapon");
  }

  // ── Volley ──
  {
    const state = fight();
    const option = optionOf(state, "Volley");
    assert.ok((option?.area?.range ?? 0) >= 100, `as far as the bow carries: ${JSON.stringify(option?.area)}`);
    const volley = act(state, "Volley", { at: { x: 15, y: 5 } });
    assert.deepEqual(struck(volley), ["d", "e"], "every foe within 10 feet of the point");
    assert.deepEqual(new Set(strikesOf(volley)), new Set(["Longbow"]));
  }

  // ── Horde Breaker ──
  {
    const first = act(fight(), "Greataxe", { targetIds: ["a"] });
    const again = optionOf(first.state, "Greataxe (ranger_level)");
    assert.ok(
      again,
      rulesetCombatOptions(definition, first.state, "ranger")
        .map((one) => one.label)
        .join(", "),
    );
    assert.equal(again.budget, undefined, "for nothing");
    const legal = rulesetCombatOptions(definition, first.state, "ranger");
    void legal;
    const second = act(first.state, "Greataxe (ranger_level)", { targetIds: ["b"] });
    assert.deepEqual(struck(second), ["b"]);
    const refusedAt = applyRulesetCombatChoice(
      definition,
      first.state,
      { actorId: "ranger", optionId: again.id, targetIds: ["c"] },
      roll,
    );
    assert.ok(of(refusedAt.events, "refused").length > 0, "not one too far from the first");
    // Once a turn.
    who(second.state, "ranger").budgets.action = 1;
    const third = act(second.state, "Greataxe", { targetIds: ["a"] });
    assert.equal(optionOf(third.state, "Greataxe (ranger_level)"), undefined, "once a turn");
    // Not before 3rd level.
    const early = act(fight(2), "Greataxe", { targetIds: ["a"] });
    assert.equal(optionOf(early.state, "Greataxe (ranger_level)"), undefined);
  }

  // ── Refusals ──
  {
    const withMechanics = (mechanics: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs.at(-1).entries[0].mechanics = mechanics;
      });
    refused(
      withMechanics({ kind: "utility", strikesWith: "melee" }),
      /"strikesWith" is a reaction aimed back at whoever caused its moment with a melee weapon/,
    );
    refused(
      withMechanics({ kind: "utility", strikesWith: "ranged", reaction: { on: "attacked" } }),
      /"strikesWith" is a reaction aimed back at whoever caused its moment with a melee weapon/,
    );
    refused(
      fiveE((doc) => {
        doc.combat.levels.at(-1).strikesAgain = { within: 0 };
      }),
      /within/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries strike with a weapon over an area (strikesWith with an area) or whose conditions or levels give a strike again near the first (strikesAgain) requires schemaVersion 2 and capabilityApi 1.428 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(427) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(428) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(427) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Area strikes: Whirlwind Attack strikes every foe within 5 feet with the best melee weapon, Volley every foe within 10 feet of a point as far as the bow carries; Horde Breaker strikes another near the first for nothing, once a turn; gated at 1.428.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
