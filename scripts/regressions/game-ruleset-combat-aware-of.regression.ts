/**
 * Awareness of some kinds of creature only, past no total cover, and from a condition or a level
 * (Capability API 1.439).
 *
 *   - Divine Sense: a condition that leaves no fiend or undead within 60 feet hidden from its holder,
 *     unless a wall stands between them; a goblin hides as before.
 *   - Primeval Awareness: a level-style awareness with no cover test finds a fiend behind a wall,
 *     once the next step asks.
 *   - A trait's own `aware` takes `of` too.
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
  rulesetAwareOf,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-aware-of-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 439);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const divineSense = { within: 60, of: { types: ["celestial", "fiend", "undead"] }, uncovered: true };
  const primeval = { within: 5280, of: { types: ["fiend"] } };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push(
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look" };
    doc.combat.creatureTypes = {
      types: ["celestial", "fiend", "undead", "humanoid"].map((id) => ({ id, label: id })),
    };
    for (const id of ["divine_sense", "primeval_awareness"]) doc.sheet.live.conditions.push({ id, label: id });
    doc.combat.conditions.push(
      { condition: "divine_sense", effects: [], aware: divineSense },
      { condition: "primeval_awareness", effects: [], aware: primeval },
    );
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
  const block = (type: string): RulesetStatBlock =>
    ({
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      type,
      checks: { sneak: 5 },
      actions: [],
    }) as unknown as RulesetStatBlock;
  // A wall down x = 6, from y = 0 to y = 4, unless the board is open.
  const fight = (conditions: string[], open: boolean, at = 8): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "paladin",
          name: "Paladin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 16 },
            fields: { level: 5, ac: 18, speed: 30, hp_max: 44 },
          }),
          live: { conditions },
        },
        { id: "imp", name: "Imp", side: "enemy", block: block("fiend") },
        { id: "goblin", name: "Goblin", side: "enemy", block: block("humanoid") },
      ],
      board: {
        grid: {
          width: 30,
          height: 5,
          tiles: Array.from({ length: 5 }, () =>
            Array.from({ length: 30 }, (_, x) => (!open && x === 6 ? "wall" : "plains")),
          ),
        } as never,
        placements: { paladin: { x: 2, y: 2 }, imp: { x: at, y: 2 }, goblin: { x: at, y: 3 } },
      },
    });
    state.order = ["paladin", "imp", "goblin"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const aware = (state: RulesetEncounterState, id: string) =>
    rulesetAwareOf(definition, state, who(state, "paladin"), who(state, id));

  // ── Divine Sense ──
  {
    const open = fight(["divine_sense"], true);
    assert.ok(aware(open, "imp"), "a fiend 30 feet off, in the open");
    assert.ok(!aware(open, "goblin"), "a humanoid is not sensed");
    const walled = fight(["divine_sense"], false);
    assert.ok(!aware(walled, "imp"), "not behind total cover");
    assert.ok(!aware(fight(["divine_sense"], true, 15), "imp"), "nor beyond 60 feet");
    assert.ok(!aware(fight([], true), "imp"), "nothing without it");
  }

  // ── Primeval Awareness: no cover test, found once the next step asks ──
  {
    const state = fight(["primeval_awareness"], false, 25);
    assert.ok(aware(state, "imp"), "a fiend behind the wall, far off");
    assert.ok(!aware(state, "goblin"));
    for (const id of ["imp", "goblin"]) who(state, id).hiding = { total: 30, from: ["paladin"] } as never;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "paladin", optionId: "end-turn", targetIds: [] },
      () => 10,
    );
    assert.equal(who(step.state, "imp").hiding, undefined, JSON.stringify(step.events));
    assert.deepEqual(who(step.state, "goblin").hiding?.from, ["paladin"], "the goblin stays hidden");
  }

  // ── A trait's own aware takes `of` too ──
  {
    const doc = fiveE();
    doc.catalogs
      .find((catalog: { id: string }) => catalog.id === "feats")
      .entries.push({
        id: "fiend-nose",
        label: "Fiend Nose",
        rows: [{ list: "features", values: { name: "Fiend Nose", text: "x" } }],
        mechanics: { kind: "utility", hiding: { aware: { within: 30, of: { types: ["fiend"] } } } },
      });
    parsed(doc);
  }

  // ── Refusals ──
  refused(
    fiveE((doc) => (doc.combat.conditions.at(-1).aware = { within: 60, of: { types: ["dragon"] } })),
    /dragon/,
  );
  refused(
    fiveE((doc) => (doc.combat.conditions.at(-1).aware = { within: 60, lostWith: ["sleepy"] })),
    /Unknown condition "sleepy"/,
  );
  refused(
    fiveE((doc) => delete doc.combat.hiding),
    /Awareness is read where combat.hiding hides for real/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions or levels make their holder aware of the hidden, or whose awareness is of some kinds only (of) or past no total cover (uncovered), requires schemaVersion 2 and capabilityApi 1.439 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(438) as never, fiveE()), gate);
    const plain = fiveE((doc) => {
      doc.combat.conditions.at(-1).aware = { within: 10 };
      delete doc.combat.conditions.at(-2).aware;
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(438) as never, plain), gate, "a condition's own");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(439) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(438) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Aware of: Divine Sense finds a fiend in the open within 60 feet but not behind a wall or a goblin, Primeval Awareness finds one anywhere, and a trait's aware takes kinds too; gated at 1.439.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
