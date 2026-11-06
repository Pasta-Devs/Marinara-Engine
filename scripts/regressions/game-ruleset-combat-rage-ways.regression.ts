/**
 * A condition that stops casting and concentrating, and one its holder going down ends (Capability
 * API 1.438).
 *
 *   - Rage: no spell offered while it holds, nor anything needing concentration, and a spell already
 *     concentrated on ends as it comes on; it comes off once its holder is knocked down, whether its
 *     rule says so or it was put on saying so.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rage-ways-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 440);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spells = [
    {
      id: "fire-bolt",
      label: "Fire Bolt",
      rows: [{ list: "spells", values: { name: "Fire Bolt", level: 0, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "fire", range: 120, amount: { dice: "1d10" } },
    },
    {
      id: "hex",
      label: "Hex",
      rows: [{ list: "spells", values: { name: "Hex", level: 1, prepared: true } }],
      mechanics: {
        kind: "debuff",
        targets: "enemy",
        range: 90,
        concentration: true,
        cost: [{ pool: "slots_1", amount: 1 }],
        applies: [{ condition: "hexed", duration: { rounds: 10 } }],
      },
    },
  ] as unknown as RulesetCatalogEntry[];
  const tricks = [
    {
      id: "focus",
      label: "Focus",
      rows: [{ list: "spells", values: { name: "Focus", level: 0, prepared: true } }],
      mechanics: {
        kind: "debuff",
        targets: "enemy",
        range: 60,
        concentration: true,
        applies: [{ condition: "focused", duration: { rounds: 10 } }],
      },
    },
  ] as unknown as RulesetCatalogEntry[];
  const rage = { forbids: { casts: ["spells"], concentration: true }, endsWhenHolder: { downed: true } };
  const fiveE = (raging: Record<string, unknown> = rage): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    for (const id of ["raging", "frenzied", "hexed", "focused"]) doc.sheet.live.conditions.push({ id, label: id });
    doc.combat.conditions.push(
      { condition: "raging", effects: [], ...raging },
      { condition: "frenzied", effects: [] },
      { condition: "hexed", effects: [] },
      { condition: "focused", effects: [] },
    );
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) },
      { id: "tricks", label: "Tricks", feeds: ["spells"], entries: structuredClone(tricks) },
    );
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
  const rows = (catalog: string, entries: RulesetCatalogEntry[], list: string) =>
    entries.flatMap((entry) =>
      rowsFromCatalogEntry(catalog, entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const block = (): RulesetStatBlock =>
    ({
      health: 200,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "maul", name: "Maul", budget: "action", toHit: 20, reach: 5, damage: { count: 0, sides: 0, flat: 50 } },
      ],
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 8,
    height: 3,
    tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")),
  });
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "barbarian",
          name: "Barbarian",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 18, dex: 12, con: 16, int: 8, wis: 10, cha: 14 },
            fields: { level: 5, ac: 15, speed: 30, hp_max: 40, spellcasting_ability: "cha", slots_max_1: 2 },
            lists: {
              attacks: [{ name: "Greataxe", ability: "str", proficient: true, bonus: 0, damage: "1d12", reach: 5 }],
              spells: [...rows("spells", spells, "spells"), ...rows("tricks", tricks, "spells")],
            },
          }),
          live: {},
          catalogs: { spells, tricks },
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: { grid: grid(), placements: { barbarian: { x: 2, y: 1 }, foe: { x: 3, y: 1 } } },
    });
    state.order = ["barbarian", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const step = (state: RulesetEncounterState, choice: Partial<RulesetCombatChoice> & { actorId: string }) => {
    const taken = applyRulesetCombatChoice(definition, state, { optionId: "end-turn", targetIds: [], ...choice }, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(of(taken.events, "refused")));
    return taken;
  };
  const offered = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "barbarian").map((one) => one.label);
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    who(state, id).tracked.some((one) => one.condition === condition);

  // ── No casting, no concentrating ──
  {
    let state = fight();
    for (const label of ["Fire Bolt", "Hex", "Focus", "Greataxe"])
      assert.ok(offered(state).includes(label), `${label} before: ${offered(state).join(", ")}`);
    const hex = rulesetCombatOptions(definition, state, "barbarian").find((one) => one.label === "Hex")!;
    state = step(state, { actorId: "barbarian", optionId: hex.id, targetIds: ["foe"] }).state;
    assert.ok(who(state, "barbarian").concentrating, "concentrating on Hex");
    assert.ok(has(state, "foe", "hexed"));
    // Rage comes on: Hex ends with it.
    who(state, "barbarian").tracked.push({ condition: "raging", rounds: 10 });
    const raged = step(state, { actorId: "barbarian" });
    state = raged.state;
    assert.equal(who(state, "barbarian").concentrating, null, "concentration ends as rage comes on");
    assert.ok(
      of(raged.events, "concentration").some((one) => one.state === "ended" && one.reason === "spent"),
      JSON.stringify(raged.events),
    );
    assert.equal(has(state, "foe", "hexed"), false, "and the spell with it");
    state.turn = 0;
    who(state, "barbarian").budgets.action = 1;
    const now = offered(state);
    assert.ok(now.includes("Greataxe"), now.join(", "));
    for (const label of ["Fire Bolt", "Hex"]) assert.ok(!now.includes(label), `${label} is a spell`);
    assert.ok(!now.includes("Focus"), "Focus needs concentration");
    // Once rage is gone, all are back.
    who(state, "barbarian").tracked = who(state, "barbarian").tracked.filter((one) => one.condition !== "raging");
    for (const label of ["Fire Bolt", "Hex", "Focus"]) assert.ok(offered(state).includes(label), `${label} after`);
  }

  // ── Ended by going down ──
  {
    let state = fight();
    who(state, "barbarian").tracked.push(
      { condition: "raging", rounds: 10 },
      // One put on saying so, with no such rule of its own.
      { condition: "frenzied", rounds: 10, endsWhenHolder: { downed: true } },
    );
    state.turn = 1;
    state = step(state, { actorId: "foe", optionId: "maul", targetIds: ["barbarian"] }).state;
    assert.ok(who(state, "barbarian").down, "knocked down");
    assert.equal(has(state, "barbarian", "raging"), false, "rage ends when knocked down");
    assert.equal(has(state, "barbarian", "frenzied"), false, "and so does one put on saying so");
    // Hurt but standing, both stay.
    state = fight();
    who(state, "barbarian").tracked.push(
      { condition: "raging", rounds: 10 },
      { condition: "frenzied", rounds: 10, endsWhenHolder: { downed: true } },
    );
    state.turn = 1;
    who(state, "foe").actions.find((one) => one.label === "Maul")!.damage = { count: 0, sides: 0, flat: 5 } as never;
    state = step(state, { actorId: "foe", optionId: "maul", targetIds: ["barbarian"] }).state;
    assert.ok(!who(state, "barbarian").down);
    assert.ok(has(state, "barbarian", "raging") && has(state, "barbarian", "frenzied"));
  }

  // ── Ended by gaining a condition (1.440): put to sleep, still standing ──
  {
    const slept = parsed(fiveE({ ...rage, endsWhenHolder: { downed: true, gains: ["unconscious"] } }));
    const state = fight();
    who(state, "barbarian").tracked.push(
      { condition: "raging", rounds: 10 },
      { condition: "frenzied", rounds: 10, endsWhenHolder: { gains: ["unconscious"] } },
      { condition: "unconscious", rounds: 10 },
    );
    const taken = applyRulesetCombatChoice(
      slept,
      state,
      { actorId: "barbarian", optionId: "end-turn", targetIds: [] },
      roll,
    ).state;
    assert.ok(!who(taken, "barbarian").down, "asleep, not down");
    assert.equal(has(taken, "barbarian", "raging"), false, "rage ends on falling unconscious");
    assert.equal(has(taken, "barbarian", "frenzied"), false, "and one put on saying so");
    // Without the condition, both stay.
    const awake = fight();
    who(awake, "barbarian").tracked.push({ condition: "raging", rounds: 10 });
    const kept = applyRulesetCombatChoice(
      slept,
      awake,
      { actorId: "barbarian", optionId: "end-turn", targetIds: [] },
      roll,
    ).state;
    assert.ok(has(kept, "barbarian", "raging"));
  }

  // ── Refusals ──
  refused(fiveE({ forbids: {} }), /Say what it stops/);
  refused(fiveE({ forbids: { casts: ["no_such_catalog"] } }), /Unknown catalog "no_such_catalog"/);
  refused(fiveE({ endsWhenHolder: {} }), /Say what ends it/);
  refused(fiveE({ endsWhenHolder: { gains: ["sleepy"] } }), /Unknown condition "sleepy"/);
  refused(fiveE({ endsWhenHolder: { gains: ["raging"] } }), /never ended by gaining itself/);
  {
    const gate =
      "A ruleset whose conditions end when their holder gains another condition (endsWhenHolder gains) requires schemaVersion 2 and capabilityApi 1.440 or newer";
    const doc = fiveE({ endsWhenHolder: { gains: ["unconscious"] } });
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(439) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(440) as never, doc), gate);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions stop casting from a catalog or concentrating (forbids casts, concentration) or end when their holder goes down (endsWhenHolder downed) requires schemaVersion 2 and capabilityApi 1.438 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(437) as never, fiveE()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(437) as never, fiveE({ endsWhenHolder: { downed: true } })),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(438) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(437) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Rage ways: no spell and nothing needing concentration while raging, Hex ends as rage comes on, and rage comes off when its holder is knocked down; gated at 1.438.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
