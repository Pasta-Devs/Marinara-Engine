/**
 * Saved against on the caster's turn, and sent away by failing (Capability API 1.483).
 *
 *   - Prismatic Spray's Violet ray: blinded, with a save made as the caster's next turn starts (not
 *     the holder's own); a success ends the blindness, a failure sends the creature away for good,
 *     alive, and it is blinded no more.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-source-saves-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 483);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const violetEnds = { save: "wis_save", at: "source-turn-start", failures: { count: 1, dismisses: true } };
  const violet = (saveEnds: Record<string, unknown> = violetEnds) =>
    ({
      id: "violet",
      label: "Violet",
      rows: [{ list: "spells", values: { name: "Violet", level: 1, prepared: true } }],
      mechanics: {
        kind: "debuff",
        targets: "enemy",
        range: 60,
        save: { save: "dex_save", onSuccess: "negates" },
        applies: [{ condition: "blinded", duration: "until-save", saveEnds }],
      },
    }) as unknown as RulesetCatalogEntry;
  const fiveE = (saveEnds?: Record<string, unknown>): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [violet(saveEnds)] });
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
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const fight = (wis: number): RulesetEncounterState => {
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
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_1: 4 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        {
          id: "wolf",
          name: "Wolf",
          side: "enemy",
          block: {
            health: 30,
            defense: 12,
            initiativeModifier: 0,
            speed: 40,
            saves: { dex_save: -10, wis_save: wis },
            actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 4, damage: { flat: 1 }, reach: 5 }],
          } as unknown as RulesetStatBlock,
        },
        {
          id: "bear",
          name: "Bear",
          side: "enemy",
          block: {
            health: 30,
            defense: 12,
            initiativeModifier: 0,
            speed: 40,
            actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { flat: 1 }, reach: 5 }],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: { width: 12, height: 3, tiles: Array.from({ length: 3 }, () => Array(12).fill("plains")) },
        placements: { mage: { x: 0, y: 1 }, wolf: { x: 8, y: 1 }, bear: { x: 10, y: 1 } },
      },
    });
    state.order = ["mage", "wolf", "bear"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const step = (state: RulesetEncounterState, actorId: string, optionId: string, targetIds: string[] = []) => {
    const done = applyRulesetCombatChoice(definition, state, { actorId, optionId, targetIds }, () => 10);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(of(done.events, "refused")));
    return done;
  };
  const blinded = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "wolf")!.tracked.some((one) => one.condition === "blinded");
  /** Cast, then on through the wolf's and the bear's turns into the mage's next. */
  const play = (wis: number) => {
    let state = fight(wis);
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Violet")!;
    state = step(state, "mage", option.id, ["wolf"]).state;
    assert.equal(blinded(state), true, "blinded by the ray");
    state = step(state, "mage", "end-turn").state;
    assert.equal(state.order[state.turn], "wolf");
    const wolfTurn = step(state, "wolf", "end-turn");
    assert.equal(of(wolfTurn.events, "save").length, 0, "not at its own turn");
    assert.equal(blinded(wolfTurn.state), true);
    return step(wolfTurn.state, "bear", "end-turn");
  };

  // ── A success at the caster's next turn ends it ──
  {
    const next = play(20);
    assert.deepEqual(
      of(next.events, "save").map((one) => one.actorId),
      ["wolf"],
      "saved as the mage's turn starts",
    );
    assert.equal(blinded(next.state), false);
    assert.equal(rulesetCombatant(next.state, "wolf")!.defeated, false);
  }
  // ── A failure sends it away for good, blinded no more ──
  {
    const next = play(-20);
    const wolf = rulesetCombatant(next.state, "wolf")!;
    assert.equal(wolf.defeated, true);
    assert.equal(wolf.away?.by, "mage");
    assert.equal(wolf.away?.while, undefined, "for good");
    assert.equal(blinded(next.state), false);
    assert.deepEqual(
      of(next.events, "dismissed").map((one) => [one.actorId, one.targetId, one.label]),
      [["mage", "wolf", "Violet"]],
    );
  }

  // ── Refusals ──
  refused(fiveE({ save: "wis_save", at: "turn-end", failures: { count: 1 } }), /becomes|dismisses/);
  refused(
    fiveE({ save: "wis_save", at: "turn-end", failures: { count: 1, becomes: "blinded", dismisses: true } }),
    /becomes|dismisses/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose saves are made as the turn of whoever put a condition on starts, or whose failed saves send the holder away (saveEnds source-turn-start, failures dismisses), requires schemaVersion 2 and capabilityApi 1.483 or newer";
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
    for (const ends of [
      violetEnds,
      { save: "wis_save", at: "source-turn-start" },
      { save: "wis_save", at: "turn-end", failures: { count: 1, dismisses: true } },
    ]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(482) as never, fiveE(ends)), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(483) as never, fiveE(ends)), gate);
    }
  }

  console.log(
    "Source saves: Violet's blindness saved against as the caster's turn starts, ended by a success, sent away for good by a failure; gated at 1.483.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
