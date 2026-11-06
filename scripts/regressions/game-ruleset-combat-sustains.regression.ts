/**
 * Kept up without concentration, and spared only on a made save (Capability API 1.431).
 *
 *   - Intimidating Presence frightens a creature that fails its save; on a later turn the barbarian's
 *     action keeps it up, its rounds started again, with no save and nothing spent.
 *   - Kept up only at a creature it is still on, and offered only while it is on somebody.
 *   - A creature that made its save is spared it until a long rest; one that failed is not.
 *   - Far OR out of sight, asked only as its holder ends a turn (Capability API 1.433): "ends if the
 *     creature ends its turn out of line of sight or more than 60 feet away from you".
 *   - Refusals and the install gates.
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
  RULESET_MOVE_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sustains-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 431);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const presence = {
    id: "presence",
    label: "Intimidating Presence",
    rows: [{ list: "features", values: { name: "Intimidating Presence" } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      range: 30,
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "frightened", duration: { rounds: 1, of: "source" } }],
      sustains: { budget: "action" },
      oncePerTarget: { until: "long", whenSaved: true },
    },
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    // A feature's save against 8 + proficiency + Charisma, as the sheet works it out.
    doc.combat.abilities.find((source: { list: string }) => source.list === "features").saveDifficulty = {
      derived: "spell_save_dc",
    };
    doc.catalogs.push({
      id: "berserker",
      label: "Berserker",
      feeds: ["features"],
      entries: [structuredClone(presence)],
    });
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
  const entries = definition.catalogs!.find((one) => one.id === "berserker")!.entries as RulesetCatalogEntry[];
  const block = (wis: number): RulesetStatBlock =>
    ({
      health: 50,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      saves: { wis_save: wis },
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 0, reach: 5, damage: { count: 0, sides: 0, flat: 1 } },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 12,
    tiles: Array.from({ length: 12 }, () => Array(20).fill("plains")),
  });
  // A d20 of 10: the shaky foe's 10 fails against 15, the steady one's 20 makes it.
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
  const fight = (rules = definition, held = entries): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "barbarian",
          name: "Barbarian",
          side: "party",
          // Charisma 16 and proficiency 4: 8 + 4 + 3 is 15.
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 18, dex: 12, con: 16, int: 8, wis: 10, cha: 16 },
            fields: { level: 10, ac: 15, speed: 30, hp_max: 100, spellcasting_ability: "cha" },
            lists: {
              features: held.flatMap((entry) =>
                rowsFromCatalogEntry("berserker", entry).flatMap((one) => (one.list === "features" ? [one.row] : [])),
              ),
            },
          }),
          live: {},
          catalogs: { berserker: held },
        },
        { id: "shaky", name: "Shaky", side: "enemy", block: block(0) },
        { id: "steady", name: "Steady", side: "enemy", block: block(10) },
      ],
      board: {
        grid: grid(),
        placements: { barbarian: { x: 5, y: 5 }, shaky: { x: 7, y: 5 }, steady: { x: 7, y: 7 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const options = (state: RulesetEncounterState) => rulesetCombatOptions(definition, state, "barbarian");
  const find = (state: RulesetEncounterState, sustain: boolean) =>
    options(state).find((one) => one.label === "Intimidating Presence" && !!one.sustain === sustain);
  const use = (state: RulesetEncounterState, sustain: boolean, targetId: string) => {
    state.turn = 0;
    who(state, "barbarian").budgets.action = 1;
    const option = find(state, sustain);
    assert.ok(option, `${sustain ? "keeping up" : "using"}: ${options(state).map((one) => one.label)}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "barbarian", optionId: option.id, targetIds: [targetId] },
      roll,
    );
  };
  const frightened = (state: RulesetEncounterState, id: string) =>
    who(state, id).tracked.find((entry) => entry.condition === "frightened");

  // ── Frightened, then kept up ──
  let state = fight();
  assert.equal(find(state, true), undefined, "nothing to keep up yet");
  const first = use(state, false, "shaky");
  state = first.state;
  assert.deepEqual(
    of(first.events, "save").map((one) => [one.actorId, one.difficulty, one.success]),
    [["shaky", 15, false]],
  );
  assert.ok(frightened(state, "shaky"), "a failed save frightens");
  // Later, one round of it left: kept up, the barbarian's next turn is the end of it again.
  state.round += 1;
  frightened(state, "shaky")!.rounds = 1;
  const kept = use(state, true, "shaky");
  state = kept.state;
  assert.equal(of(kept.events, "save").length, 0, "no save again");
  assert.deepEqual(
    of(kept.events, "sustained").map((one) => [one.targetId, one.condition]),
    [["shaky", "frightened"]],
  );
  assert.equal(frightened(state, "shaky")!.rounds, 2, "started again, from the barbarian's next turn");

  // ── Only at a creature it is still on ──
  {
    const at = use(structuredClone(state), true, "steady");
    assert.ok(of(at.events, "refused").length > 0, "not at one it is not on");
    const gone = structuredClone(state);
    who(gone, "shaky").tracked = who(gone, "shaky").tracked.filter((entry) => entry.condition !== "frightened");
    assert.equal(find(gone, true), undefined, "not offered once it is off everybody");
  }

  // ── Spared only on a made save ──
  {
    const saved = use(state, false, "steady");
    state = saved.state;
    assert.deepEqual(
      of(saved.events, "save").map((one) => [one.actorId, one.success]),
      [["steady", true]],
    );
    const again = use(structuredClone(state), false, "steady");
    assert.ok(of(again.events, "refused").length > 0, "spared until a long rest");
    // The one that failed may be frightened again once it is off.
    who(state, "shaky").tracked = who(state, "shaky").tracked.filter((entry) => entry.condition !== "frightened");
    const anew = use(state, false, "shaky");
    assert.equal(of(anew.events, "refused").length, 0, JSON.stringify(of(anew.events, "refused")));
  }

  // ── Far or out of sight, as its holder ends a turn (1.433) ──
  {
    const orDefinition = parsed(
      fiveE((doc) => {
        doc.catalogs.at(-1).entries[0].mechanics.applies[0].endsAway = { beyond: 60, orUnseen: true };
      }),
    );
    const orEntries = orDefinition.catalogs!.find((one) => one.id === "berserker")!.entries as RulesetCatalogEntry[];
    const frighten = () => {
      const start = fight(orDefinition, orEntries);
      const option = rulesetCombatOptions(orDefinition, start, "barbarian").find(
        (one) => one.label === "Intimidating Presence" && !one.sustain,
      )!;
      const step = applyRulesetCombatChoice(
        orDefinition,
        start,
        { actorId: "barbarian", optionId: option.id, targetIds: ["shaky"] },
        roll,
      );
      assert.ok(frightened(step.state, "shaky"));
      step.state.turn = step.state.order.indexOf("shaky");
      who(step.state, "shaky").movementLeft = 6;
      return step.state;
    };
    const endTurn = (at: RulesetEncounterState) =>
      applyRulesetCombatChoice(orDefinition, at, { actorId: "shaky", optionId: "end-turn", targetIds: [] }, roll).state;
    // 65 feet off, in plain sight: kept through its walk, gone as its turn ends.
    const far = frighten();
    who(far, "shaky").x = 18;
    const walked = applyRulesetCombatChoice(
      orDefinition,
      far,
      { actorId: "shaky", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 19, y: 5 } },
      roll,
    );
    assert.equal(of(walked.events, "refused").length, 0, JSON.stringify(of(walked.events, "refused")));
    assert.ok(frightened(walked.state, "shaky"), "asked only as its turn ends");
    assert.equal(frightened(endTurn(walked.state), "shaky"), undefined, "far is enough");
    // Near, but a wall between them: gone too.
    const unseen = frighten();
    for (const row of unseen.board!.grid.tiles) row[6] = "wall";
    assert.equal(frightened(endTurn(unseen), "shaky"), undefined, "out of sight is enough");
    // Near and in sight: it stays.
    assert.ok(frightened(endTurn(frighten()), "shaky"), "near and seen, it holds");
    refused(
      fiveE((doc) => {
        doc.catalogs.at(-1).entries[0].mechanics.applies[0].endsAway = { beyond: 60, unseen: true, orUnseen: true };
      }),
      /"endsAway" ends out of sight AND far/,
    );
    const gate =
      "A ruleset whose conditions end as their holder ends a turn far away or out of sight (endsAway orUnseen) requires schemaVersion 2 and capabilityApi 1.433 or newer";
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
    const orDoc = fiveE((doc) => {
      doc.catalogs.at(-1).entries[0].mechanics.applies[0].endsAway = { beyond: 60, orUnseen: true };
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(432) as never, orDoc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(433) as never, orDoc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(432) as never, fiveE()), gate);
  }

  // ── Refusals ──
  {
    const withMechanics = (edit: (mechanics: Record<string, any>) => void) =>
      fiveE((doc) => {
        edit(doc.catalogs.at(-1).entries[0].mechanics);
      });
    refused(
      withMechanics((mechanics) => {
        mechanics.applies[0].duration = "instant";
      }),
      /"sustains" starts again the rounds of what it puts on/,
    );
    refused(
      withMechanics((mechanics) => {
        mechanics.sustains.budget = "nothing_here";
      }),
      /Unknown budget "nothing_here"/,
    );
    refused(
      withMechanics((mechanics) => {
        delete mechanics.save;
      }),
      /"whenSaved" spares a creature that made its save/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries are kept up on later turns (sustains) or spare a creature only once it makes its save (oncePerTarget whenSaved) requires schemaVersion 2 and capabilityApi 1.431 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(430) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(431) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(430) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Sustains: Intimidating Presence frightens on a failed save, is kept up on a later turn with no save, only at one it is still on, and spares only a creature that made its save until a long rest; gated at 1.431. It ends as its holder ends a turn far away or out of sight; gated at 1.433.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
