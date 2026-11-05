/**
 * A called creature's actions and its caller (Capability API 1.586): 5e's Arcane Hand.
 *
 *   - `callerAdds: false`: the Clenched Fist takes nothing of its caller's added modifier; another
 *     action of the hand still does.
 *   - `perCallerStep`: the fist deals 2d8 more for each slot level the spell was cast above 5th.
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
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-caller-steps-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 586);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fist = (more: Record<string, unknown> = {}) => ({
    id: "fist",
    name: "Clenched Fist",
    budget: "action",
    toHit: 0,
    damage: { dice: "4d8", type: "force" },
    reach: 5,
    callerAdds: false,
    perCallerStep: { dice: "2d8" },
    ...more,
  });
  const hand = (action = fist()) => ({
    id: "arcane-hand",
    label: "Arcane Hand",
    creature: {
      health: 1,
      defense: 20,
      initiativeModifier: 0,
      speed: 60,
      tier: "cr_1",
      actions: [action, { id: "slap", name: "Slap", budget: "action", toHit: 0, damage: { flat: 1 }, reach: 5 }],
    },
  });
  const spell = {
    id: "arcane-hand",
    label: "Arcane Hand",
    rows: [{ list: "spells", values: { name: "Arcane Hand", level: 5, prepared: true } }],
    mechanics: {
      kind: "utility",
      targets: "self",
      budget: "action",
      cost: [{ pool: "slots_5", amount: 1 }],
      calls: {
        creature: "creatures/arcane-hand",
        count: { flat: 1 },
        initiative: "after",
        fromCaller: { health: true, toHit: { abilityMod: "int" }, adds: { abilityMod: "int" } },
      },
    },
  };
  const document = (action?: Record<string, unknown>) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(hand(action as never)));
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [structuredClone(spell)] });
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
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const fields: Record<string, number> = { level: 13, ac: 12, speed: 30, hp_max: 60 };
  for (let level = 1; level <= 7; level++) fields[`slots_max_${level}`] = 2;
  const cast = (payWith?: string) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 18, wis: 10, cha: 10 },
            fields: { ...fields, spellcasting_ability: "int" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: { health: 100, defense: 10, initiativeModifier: -5, speed: 30, actions: [] } as never,
        },
      ],
    });
    state.order = ["wizard", "brute"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Arcane Hand")!;
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: option.id, targetIds: [], ...(payWith ? { payWith } : {}) },
      () => 10,
    );
    assert.deepEqual(of(taken.events, "refused"), []);
    const handId = taken.state.combatants.find((one) => one.calledBy === "wizard")!.id;
    const theHand = rulesetCombatant(taken.state, handId)!;
    return {
      fist: theHand.actions.find((one) => one.label === "Clenched Fist")!.damage!,
      slap: theHand.actions.find((one) => one.label === "Slap")!.damage!,
    };
  };

  // ── At 5th: 4d8, no modifier; the slap still takes it ──
  {
    const { fist: dealt, slap } = cast();
    assert.deepEqual([dealt.count, dealt.sides, dealt.flat], [4, 8, 0]);
    assert.equal(slap.flat, 5, "1 and the caller's +4");
  }
  // ── At 7th: 2d8 more for each of two levels ──
  {
    const { fist: dealt } = cast("slots_7");
    assert.deepEqual([dealt.count, dealt.sides, dealt.flat], [8, 8, 0]);
  }

  // ── Refusals ──
  refused(
    document(fist({ perCallerStep: { dice: "2d6" } })),
    /"perCallerStep" rolls dice the size of the damage's own/,
  );
  refused(document(fist({ damage: undefined })), /"perCallerStep" adds to the action's damage/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a called creature's action that keeps its caller's number off or grows with the call (callerAdds, perCallerStep) requires schemaVersion 2 and capabilityApi 1.586 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(585) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(586) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(585) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Caller steps: Arcane Hand's Clenched Fist takes no modifier and 2d8 more for each slot level above 5th; gated at 1.586.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
