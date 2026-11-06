/**
 * Summons that strike by themselves (Capability API 1.539).
 *
 *   - `summons.strikesAtTurnStart`: 5e's Faithful Hound. Cast, it only appears; as each of its
 *     caster's turns starts it bites the nearest hostile creature within its reach of where it stands,
 *     never commanded and never held for an answer; with nobody near, nothing.
 *   - It may stay up to 14400 rounds, with no budget of its own.
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
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-striking-summons-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 539);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hound = (summons: Record<string, unknown> = { rounds: 4800, reach: 5, strikesAtTurnStart: true }) =>
    ({
      id: "faithful-hound",
      label: "Faithful Hound",
      rows: [{ list: "spells", values: { name: "Faithful Hound", level: 4, prepared: true } }],
      mechanics: {
        kind: "attack",
        budget: "action",
        attackRoll: true,
        range: 30,
        amount: { dice: "4d8" },
        damageType: "piercing",
        cost: [{ pool: "slots_4", amount: 1 }],
        summons,
      },
    }) as RulesetCatalogEntry;
  const fiveE = (entry = hound()): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  // A d20 shows 15, every other die 4.
  const roll = (sides: number) => (sides === 20 ? 15 : Math.min(sides, 4));
  const line = (): TacticalGrid => ({ width: 30, height: 1, tiles: [Array.from({ length: 30 }, () => "plains")] });
  const snag: RulesetStatBlock = {
    health: 300,
    defense: 13,
    initiativeModifier: -10,
    speed: 30,
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 0 } }],
  } as RulesetStatBlock;
  const entry = hound();
  const fight = (): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      board: { grid: line(), placements: { corwin: { x: 0, y: 0 }, snag: { x: 4, y: 0 } } },
      combatants: [
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 18, wis: 10, cha: 10 },
            fields: { level: 7, ac: 12, speed: 30, hp_max: 30, spellcasting_ability: "int", slots_max_4: 1 },
            lists: { spells: rowsFromCatalogEntry("spells", entry).map((row) => row.row) },
          }),
          live: {},
          catalogs: { spells: [entry] },
        },
        { id: "snag", name: "Snag", side: "enemy", block: snag },
      ],
    });
  const step = (state: RulesetEncounterState, actorId: string, optionId: string, targetIds: string[] = []) => {
    const taken = applyRulesetCombatChoice(definition, state, { actorId, optionId, targetIds }, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(of(taken.events, "refused")));
    return taken;
  };

  // ── Cast, it only appears; as Corwin's next turn starts, it bites ──
  {
    const state = fight();
    const option = rulesetCombatOptions(definition, state, "corwin").find((one) => one.label === "Faithful Hound");
    assert.ok(option);
    const made = step(state, "corwin", option.id, ["snag"]);
    assert.equal(of(made.events, "attack").length, 0, "no bite as it is cast");
    assert.deepEqual(
      of(made.events, "summon").map((one) => one.outcome),
      ["appeared"],
    );
    const summon = rulesetCombatant(made.state, "corwin")!.summons![0]!;
    assert.equal(summon.rounds, 4800);
    assert.equal(summon.strikesAtTurnStart, true);
    assert.ok(
      !rulesetCombatOptions(definition, made.state, "corwin").some((one) => one.id.startsWith("summon:")),
      "never commanded",
    );
    const theirs = step(made.state, "corwin", "end-turn");
    const back = step(theirs.state, "snag", "end-turn");
    const bites = of(back.events, "attack").filter((one) => one.actorId === "corwin");
    assert.equal(bites.length, 1, "it bites as Corwin's turn starts");
    assert.equal(bites[0]!.targetId, "snag");
    assert.deepEqual(
      of(back.events, "damage")
        .filter((one) => one.targetId === "snag")
        .map((one) => [one.damageType, one.amount]),
      [["piercing", 16]],
    );
    assert.equal(rulesetCombatant(back.state, "corwin")!.budgets.action, 1, "and spends none of Corwin's turn");

    // Out of its reach: nothing.
    const away = structuredClone(theirs.state);
    rulesetCombatant(away, "snag")!.x = 20;
    const quiet = step(away, "snag", "end-turn");
    assert.equal(of(quiet.events, "attack").filter((one) => one.actorId === "corwin").length, 0);
  }

  // ── Refusals ──
  refused(fiveE(hound({ rounds: 10 })), /names the "budget" each command spends/);
  refused(fiveE(hound({ budget: "bonus", rounds: 4800 })), /stays up to 100 rounds/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a summons that strikes by itself as its summoner's turn starts (summons strikesAtTurnStart) requires schemaVersion 2 and capabilityApi 1.539 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(538) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(539) as never, fiveE()), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(538) as never, fiveE(hound({ budget: "bonus", rounds: 10 }))),
      gate,
    );
  }

  console.log(
    "Ruleset striking summons: a Faithful Hound only appears as it is cast, then bites the nearest foe within its reach as each of its caster's turns starts, never commanded, for up to 4800 rounds; refusals and the gate at 1.539.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
