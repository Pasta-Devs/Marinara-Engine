/**
 * A condition that chokes its holder wherever they are, and a save kept off while they hold some
 * condition (Capability API 1.651): 5e's Dust of Sneezing and Choking.
 *
 *   - `suffocates`: on dry land its holder holds their breath and then chokes, as under water.
 *   - `savesUnless`: its save to end it is not rolled while they are unconscious.
 *   - What import refuses, and the install gate.
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
  rulesetAttackMode,
  rulesetCombatant,
  rulesetTargetRefusal,
  rulesetUnderwater,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-suffocates-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 651);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const thrown = { names: ["dagger", "javelin", "shortsword", "spear", "trident"] };
  const rule = {
    terrain: ["water"],
    melee: { mode: "disadvantage", unless: thrown },
    ranged: { pastNormal: "never", mode: "disadvantage", unless: { names: ["crossbow", "net", "javelin", "spear"] } },
    resist: ["fire"],
    breath: {
      holds: { rounds: 1, perMod: { ability: "con", rounds: 1 }, atLeast: 1 },
      then: { rounds: 0, perMod: { ability: "con", rounds: 1 }, atLeast: 1 },
      exempt: { conditions: ["gilled"], tags: ["breathes-water"] },
    },
  };
  const fiveE = (underwater: unknown = rule): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "gilled", label: "Water Breathing" });
    doc.combat.conditions.push({ condition: "gilled", effects: [] });
    doc.sheet.live.conditions.push({ id: "choking", label: "Choking" });
    doc.combat.conditions.push({
      condition: "choking",
      effects: ["cannot-act", "cannot-react"],
      suffocates: true,
      savesUnless: ["unconscious"],
    });
    doc.combat.creatureTypes = { types: [{ id: "beast", label: "Beast" }], default: "beast" };
    if (underwater !== null) doc.combat.underwater = underwater;
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
  const block = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 30,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
      actions: [
        {
          id: "dagger",
          name: "Dagger",
          budget: "action",
          toHit: 4,
          damage: { dice: "1d4", type: "piercing" },
          reach: 5,
        },
        {
          id: "club",
          name: "Club",
          budget: "action",
          toHit: 4,
          damage: { dice: "1d4", type: "bludgeoning" },
          reach: 5,
        },
        {
          id: "crossbow",
          name: "Light Crossbow",
          budget: "action",
          toHit: 4,
          damage: { dice: "1d8", type: "piercing" },
          range: { normal: 80, long: 320 },
        },
        {
          id: "bow",
          name: "Shortbow",
          budget: "action",
          toHit: 4,
          damage: { dice: "1d6", type: "piercing" },
          range: { normal: 80, long: 320 },
        },
        {
          id: "firebolt",
          name: "Fire Bolt",
          budget: "action",
          toHit: 4,
          damage: { dice: "2d10", type: "fire" },
          range: { normal: 120 },
        },
      ],
      ...extra,
    }) as unknown as RulesetStatBlock;
  // Columns 0-29 of one row: water up to `shore`, plains after.
  const fight = (
    definition: RulesetDefinition,
    at: { a: number; b: number },
    opts: { shore?: number; a?: Record<string, unknown>; b?: Record<string, unknown> } = {},
  ): RulesetEncounterState => {
    const shore = opts.shore ?? 30;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "a", name: "A", side: "party", block: block({ speeds: { swim: 0 }, ...opts.a }) },
        { id: "b", name: "B", side: "enemy", block: block(opts.b) },
      ],
      board: {
        grid: {
          width: 30,
          height: 1,
          tiles: [Array.from({ length: 30 }, (_, x) => (x < shore ? "water" : "plains"))],
        } as never,
        placements: { a: { x: at.a, y: 0 }, b: { x: at.b, y: 0 } },
      },
    });
    state.order = ["a", "b"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const breaths = (state: RulesetEncounterState, use = definition, roll = 10) => {
    const seen: Array<{ held: number; lasts: number } | "down"> = [];
    let now = state;
    for (let step = 0; step < 10 && seen.length < 4; step++) {
      const actorId = now.order[now.turn]!;
      const next = applyRulesetCombatChoice(use, now, { actorId, optionId: "end-turn", targetIds: [] }, () => roll);
      for (const one of of(next.events, "breath"))
        if (one.actorId === "a") seen.push({ held: one.held, lasts: one.lasts });
      if (of(next.events, "down").some((one) => one.actorId === "a")) seen.push("down");
      now = next.state;
    }
    return { seen, state: now };
  };
  const choking = (state: RulesetEncounterState, saves = false) => {
    who(state, "a").tracked.push({
      condition: "choking",
      rounds: null,
      source: "b",
      ...(saves ? { saveEnds: { save: "con_save", at: "turn-end" }, difficulty: 15 } : {}),
    } as never);
    return state;
  };
  const holds = (state: RulesetEncounterState, condition: string) =>
    who(state, "a").tracked.some((one) => one.condition === condition);

  // ── Choking on dry land ──
  {
    assert.deepEqual(breaths(fight(definition, { a: 15, b: 25 }, { shore: 10 })).seen, [], "breathing on land");
    const { seen, state } = breaths(choking(fight(definition, { a: 15, b: 25 }, { shore: 10 })));
    assert.deepEqual(seen.slice(0, 3), [
      { held: 1, lasts: 0 },
      { held: 0, lasts: 1 },
      { held: 0, lasts: 0 },
    ]);
    assert.equal(who(state, "a").health.value, 0, "choked to nothing");
    // Who needs no air is spared.
    const gilled = choking(fight(definition, { a: 15, b: 25 }, { shore: 10 }));
    who(gilled, "a").tracked.push({ condition: "gilled", rounds: null, source: "a" });
    assert.deepEqual(breaths(gilled).seen, []);
  }

  // ── Saved against only while conscious ──
  {
    const awake = breaths(choking(fight(definition, { a: 15, b: 25 }, { shore: 10 }), true), definition, 20);
    assert.equal(holds(awake.state, "choking"), false, "a 20 ends it");
    const out = choking(fight(definition, { a: 15, b: 25 }, { shore: 10 }), true);
    who(out, "a").tracked.push({ condition: "unconscious", rounds: null } as never);
    assert.equal(holds(breaths(out, definition, 20).state, "choking"), true, "never rolled while unconscious");
  }

  // ── What import refuses ──
  refused(fiveE({ terrain: ["water"], resist: ["fire"] }), /suffocates needs combat.underwater.breath/);
  {
    const doc = fiveE();
    doc.combat.conditions.at(-1).savesUnless = ["nonsense"];
    refused(doc, /Unknown condition "nonsense"/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that chokes its holder or whose save waits on what they hold (suffocates, savesUnless) requires schemaVersion 2 and capabilityApi 1.651 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(650) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(651) as never, fiveE()), gate);
  }

  console.log("Dust of Sneezing and Choking: choking on land, saved against only while conscious; gated at 1.651.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
