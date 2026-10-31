/**
 * Casts that reach a foe, and what a sanctuary stops (Capability API 1.425).
 *
 *   - endsWhenHolder.castsAtFoes: a warded cleric keeps it casting a heal on a friend, and loses it
 *     casting at a foe, or with an area that catches one.
 *   - sanctuary.against: Nature's Sanctuary ({attacks}) lets a foe's harmful spell through and stops
 *     its claw; Sanctuary ({attacks, casts: spells}) stops the spell too, never a creature's own
 *     harmful action that is neither.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sanctuary-against-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 425);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
    mechanics,
  });
  const spells = [
    spell("mend", "Mend", { kind: "heal", targets: "ally", range: 30, amount: { flat: 3 } }),
    spell("sting", "Sting", {
      kind: "attack",
      autoHit: true,
      targets: "enemy",
      range: 60,
      damageType: "fire",
      amount: { flat: 2 },
    }),
    spell("flare", "Flare", {
      kind: "attack",
      autoHit: true,
      range: 60,
      damageType: "fire",
      area: { shape: "burst", size: 5 },
      amount: { flat: 2 },
      save: { save: "dex_save", onSuccess: "half" },
    }),
  ] as unknown as RulesetCatalogEntry[];
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.live.conditions.push(
      { id: "warded", label: "Warded" },
      { id: "sanctuary", label: "Sanctuary" },
      { id: "natures_sanctuary", label: "Nature's Sanctuary" },
    );
    doc.combat.conditions.push(
      { condition: "warded", effects: [] },
      {
        condition: "sanctuary",
        effects: [],
        sanctuary: { save: "wis_save", difficulty: { const: 30 }, against: { attacks: true, casts: ["spells"] } },
      },
      {
        condition: "natures_sanctuary",
        effects: [],
        sanctuary: { save: "wis_save", difficulty: { const: 30 }, against: { attacks: true } },
      },
    );
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
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
  const spellRows = spells.flatMap((entry) =>
    rowsFromCatalogEntry("spells", entry).flatMap((one) => (one.list === "spells" ? [one.row] : [])),
  );
  const caster = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
      fields: { level: 6, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "wis" },
      lists: { spells: spellRows },
    });
  const block = (): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      saves: { wis_save: 0, dex_save: 0 },
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 5, damage: { count: 0, sides: 0, flat: 4 }, reach: 5 },
        {
          id: "glare",
          name: "Glare",
          budget: "action",
          damage: { count: 0, sides: 0, flat: 3 },
          range: 30,
          save: { save: "con_save", difficulty: 30, onSuccess: "half" },
        },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 12,
    tiles: Array.from({ length: 12 }, () => Array(20).fill("plains")),
  });
  const roller = (sides: number) => (sides === 20 ? 10 : 1);
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build: caster(), live: {}, catalogs: { spells } },
        { id: "ally", name: "Ally", side: "party", build: caster(), live: {} },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
        { id: "far", name: "Far", side: "enemy", block: block() },
      ],
      board: {
        grid: grid(),
        placements: { hero: { x: 5, y: 5 }, ally: { x: 4, y: 5 }, foe: { x: 6, y: 5 }, far: { x: 10, y: 9 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    // A creature's spell, as its stat block's spellcasting builds one: the glare, cast out of "spells".
    const foe = who(state, "foe");
    const glare = foe.actions.find((one) => one.label === "Glare")!;
    foe.actions.push({ ...structuredClone(glare), id: "hex_bolt", label: "Hex Bolt", catalog: "spells" });
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, actorId: string, label: string, choice: Partial<RulesetCombatChoice>) => {
    state.turn = state.order.indexOf(actorId);
    who(state, actorId).budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} can ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds: [], ...choice },
      roller,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const holds = (state: RulesetEncounterState, id: string) => who(state, id).tracked.map((one) => one.condition);

  // ── castsAtFoes: a heal on a friend keeps it, a cast at a foe or an area that catches one ends it ──
  {
    const warded = () => {
      const state = fight();
      who(state, "hero").tracked.push({
        condition: "warded",
        rounds: null,
        endsWhenHolder: { attacks: true, casts: ["spells"], castsAtFoes: true },
      } as never);
      return state;
    };
    const mended = act(warded(), "hero", "Mend", { targetIds: ["ally"] });
    assert.deepEqual(holds(mended.state, "hero"), ["warded"], "a heal on a friend keeps it");
    const stung = act(warded(), "hero", "Sting", { targetIds: ["far"] });
    assert.deepEqual(holds(stung.state, "hero"), [], "a cast at a foe ends it");
    const flared = act(warded(), "hero", "Flare", { at: { x: 10, y: 9 } });
    assert.ok(of(flared.events, "damage").some((one) => one.targetId === "far"));
    assert.deepEqual(holds(flared.state, "hero"), [], "an area that catches a foe ends it");
    const missed = act(warded(), "hero", "Flare", { at: { x: 16, y: 10 } });
    assert.deepEqual(holds(missed.state, "hero"), ["warded"], "an area that catches nobody keeps it");
  }

  // ── sanctuary.against ──
  {
    const guarded = (condition: string) => {
      const state = fight();
      who(state, "hero").tracked.push({ condition, rounds: null } as never);
      return state;
    };
    const stopped = (step: ReturnType<typeof act>) => of(step.events, "sanctuary").length > 0;
    // Nature's Sanctuary: attacks only.
    assert.ok(stopped(act(guarded("natures_sanctuary"), "foe", "Claw", { targetIds: ["hero"] })));
    const through = act(guarded("natures_sanctuary"), "foe", "Hex Bolt", { targetIds: ["hero"] });
    assert.ok(!stopped(through), "a spell goes through Nature's Sanctuary");
    assert.ok(of(through.events, "damage").some((one) => one.targetId === "hero"));
    // Sanctuary: attacks and harmful spells, not a creature's own harmful action.
    assert.ok(stopped(act(guarded("sanctuary"), "foe", "Claw", { targetIds: ["hero"] })));
    assert.ok(stopped(act(guarded("sanctuary"), "foe", "Hex Bolt", { targetIds: ["hero"] })));
    assert.ok(!stopped(act(guarded("sanctuary"), "foe", "Glare", { targetIds: ["hero"] })), "not a spell");
  }

  // ── Refusals ──
  {
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).sanctuary.against = {};
      }),
      /Say what it stops/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).sanctuary.against = { casts: ["nothing_here"] };
      }),
      /Unknown catalog "nothing_here"/,
    );
    refused(
      document((doc) => {
        doc.catalogs.at(-1).entries[1].mechanics.applies = [
          { condition: "warded", duration: { rounds: 1 }, endsWhenHolder: { attacks: true, castsAtFoes: true } },
        ];
      }),
      /"castsAtFoes" narrows "casts"/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions end only on a cast that reaches a foe (castsAtFoes) or whose sanctuaries stop only attacks or casts (sanctuary.against) requires schemaVersion 2 and capabilityApi 1.425 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(424) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(425) as never, document()), gate);
    const casting = document((doc) => {
      for (const rule of doc.combat.conditions) delete rule.sanctuary?.against;
      doc.catalogs.at(-1).entries[0].mechanics.applies = [
        {
          condition: "warded",
          duration: { rounds: 1 },
          endsWhenHolder: { casts: ["spells"], castsAtFoes: true },
        },
      ];
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(424) as never, casting), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(424) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Sanctuary against: castsAtFoes keeps a ward through a heal on a friend and ends it on a cast or an area that reaches a foe; Nature's Sanctuary stops attacks only, Sanctuary attacks and spells, never a creature's own harmful action; gated at 1.425.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
