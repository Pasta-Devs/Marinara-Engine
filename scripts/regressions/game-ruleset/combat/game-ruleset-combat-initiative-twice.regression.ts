/**
 * Initiative thrown twice (Capability API 1.240).
 *
 *   - A catalog entry's `initiativeMode` held on a sheet's list: 5e's Feral Instinct, advantage.
 *   - `combat.initiative.checkAbility`: initiative is a check made with that ability, so what rolls
 *     such checks twice rolls it twice: Foresight's advantage on checks, Cat's Grace's on Dexterity
 *     checks (and not one narrowed to another ability).
 *   - Advantage and disadvantage cancel out; the better or the worse throw is kept, and the log entry
 *     says which and what was dropped. A fight that throws every round throws twice every round.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  currentRulesetActor,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-initiative-twice-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 235);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const feral = {
    id: "feral",
    label: "Feral Instinct",
    rows: [{ list: "features", values: { name: "Feral Instinct" } }],
    mechanics: { kind: "utility", initiativeMode: "advantage" },
  } as unknown as RulesetCatalogEntry;
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "instincts", label: "Instincts", feeds: ["features"], entries: [structuredClone(feral)] });
    doc.combat.initiative.checkAbility = "dex";
    doc.sheet.live.conditions.push(
      { id: "foresight", label: "Foresight" },
      { id: "graceful", label: "Cat's Grace" },
      { id: "mighty", label: "Bull's Strength" },
      { id: "clumsy", label: "Clumsy" },
    );
    doc.combat.conditions.push(
      { condition: "foresight", effects: ["own-checks-advantage"] },
      { condition: "graceful", effects: [], modifiers: [{ to: "checks", mode: "advantage", abilities: ["dex"] }] },
      { condition: "mighty", effects: [], modifiers: [{ to: "checks", mode: "advantage", abilities: ["str"] }] },
      { condition: "clumsy", effects: ["own-checks-disadvantage"] },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  // d20s from the list in turn, every other die a 3.
  const faces = (...d20s: number[]): RulesetCombatRoller => {
    const left = [...d20s];
    return (sides) => (sides === 20 ? (left.shift() ?? 10) : 3);
  };
  const goblin = {
    health: 10,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  // One hero (Dexterity 10, so nothing is added) and a goblin, the hero thrown first.
  const fight = (
    { feature = false, conditions = [] as string[], doc = definition } = {},
    ...d20s: number[]
  ): RulesetEncounterState =>
    createRulesetEncounter({
      definition: doc,
      seed: 1,
      roller: faces(...d20s),
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 20 },
            lists: feature ? { features: rowsFromCatalogEntry("instincts", feral).map((row) => row.row) } : {},
          }),
          live: conditions.length ? { conditions } : {},
          catalogs: { instincts: [feral] },
        },
        { id: "goblin", name: "Goblin", side: "enemy", block: goblin },
      ],
    });
  const hero = (state: RulesetEncounterState) => rulesetCombatant(state, "hero")!;
  const entry = (events: RulesetCombatEvent[]) =>
    events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "initiative" }> => one.type === "initiative")
      .at(-1)!
      .entries.find((one) => one.actorId === "hero")!;
  // The hero's first throw is 5, the goblin's 12, then the hero's second 15.
  const thrown = (options: Parameters<typeof fight>[0]) => {
    const state = fight(options, 5, 12, 15);
    return { total: hero(state).initiative, entry: entry(state.opening) };
  };

  // ── Feral Instinct: advantage, the better kept ──
  {
    const { total, entry: told } = thrown({ feature: true });
    assert.equal(total, 15);
    assert.deepEqual(told, { actorId: "hero", roll: [15], modifier: 0, total: 15, mode: "advantage", dropped: [5] });
    // The goblin's number is its own, thrown once.
    assert.equal(rulesetCombatant(fight({ feature: true }, 5, 12, 15), "goblin")!.initiative, 12);
    // Nothing held, nothing thrown twice.
    const plain = thrown({});
    assert.equal(plain.total, 5);
    assert.equal(plain.entry.mode, undefined);
  }

  // ── Initiative is a Dexterity check: Foresight, Cat's Grace, never Bull's Strength ──
  {
    assert.equal(thrown({ conditions: ["foresight"] }).total, 15);
    assert.equal(thrown({ conditions: ["graceful"] }).total, 15);
    assert.equal(thrown({ conditions: ["mighty"] }).total, 5);
    // Disadvantage keeps the worse; both at once cancel out.
    const worse = fight({ conditions: ["clumsy"] }, 15, 12, 5);
    assert.equal(hero(worse).initiative, 5);
    assert.deepEqual(entry(worse.opening).dropped, [15]);
    assert.equal(thrown({ feature: true, conditions: ["clumsy"] }).total, 5);
    // Without checkAbility, initiative is no check, and only the sheet's own lean counts.
    const loose = parsed(fiveE((doc) => delete doc.combat.initiative.checkAbility));
    assert.equal(hero(fight({ conditions: ["foresight"], doc: loose }, 5, 12, 15)).initiative, 5);
    assert.equal(hero(fight({ feature: true, doc: loose }, 5, 12, 15)).initiative, 15);
  }

  // ── Thrown every round, thrown twice every round ──
  {
    const doc = parsed(fiveE((one) => (one.combat.initiative.each = "round")));
    // Round 1: hero 5, goblin 12, hero again 15. Round 2 throws each in turn: hero 2 and 18, goblin 9.
    const rolls = faces(5, 12, 15, 2, 18, 9);
    let state = createRulesetEncounter({
      definition: doc,
      seed: 1,
      roller: rolls,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 20 },
            lists: { features: rowsFromCatalogEntry("instincts", feral).map((row) => row.row) },
          }),
          live: {},
          catalogs: { instincts: [feral] },
        },
        { id: "goblin", name: "Goblin", side: "enemy", block: goblin },
      ],
    });
    const events: RulesetCombatEvent[] = [];
    for (let step = 0; step < 2; step++) {
      const actor = currentRulesetActor(state)!;
      const end = rulesetCombatOptions(doc, state, actor.id).find((one) => one.kind === "end-turn")!;
      const next = applyRulesetCombatChoice(doc, state, { actorId: actor.id, optionId: end.id, targetIds: [] }, rolls);
      events.push(...next.events);
      state = next.state;
    }
    assert.deepEqual(entry(events), {
      actorId: "hero",
      roll: [18],
      modifier: 0,
      total: 18,
      mode: "advantage",
      dropped: [2],
    });
  }

  // ── Import refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    refused((doc) => (doc.combat.initiative.checkAbility = "luck"), /Unknown ability "luck"/);
    refused((doc) => (doc.catalogs.at(-1).entries[0].mechanics.initiativeMode = "twice"), /initiativeMode/);
  }

  // ── The install gate ──
  {
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
    const gate =
      "A ruleset whose initiative is a check made with an ability, or with uses that throw initiative twice, requires schemaVersion 2 and capabilityApi 1.240 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    const checked = structuredClone(without);
    checked.combat.initiative.checkAbility = "dex";
    assert.equal(issue(239, checked), gate);
    assert.notEqual(issue(240, checked), gate);
    const leaning = { ...without, extra: { feral: { mechanics: { initiativeMode: "advantage" } } } };
    assert.equal(issue(239, leaning), gate);
    assert.notEqual(issue(240, leaning), gate);
    assert.notEqual(issue(239, without), gate);
    assert.equal(issue(239, without, new Map([["instincts.json", { entries: [feral] }]])), gate);
  }

  console.log(
    "Ruleset initiative twice: Feral Instinct, Foresight and Cat's Grace throw initiative with advantage, disadvantage cancels it, every round too; gated at 1.240.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
