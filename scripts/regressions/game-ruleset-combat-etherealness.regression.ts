/**
 * A creature's action that sends somebody, or itself, out of the fight (Capability API 1.685).
 *
 *   - `dismisses` on a creature's `self` action with `"turns": true`: a ghost's Etherealness takes it
 *     off the board, still taking its turns, offered there only its way back (the condition's
 *     `endable`), and back where it left.
 *   - `dismisses.carries`: a nightmare's Ethereal Stride takes its nearest allies within 5 feet, up to
 *     three, and they come back with it.
 *   - A catalog creature carries it onto its block. Import refusals, and the install gate.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetPositionOf,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-etherealness-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 685);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "ethereal", label: "Ethereal" });
    doc.combat.conditions.push({ condition: "ethereal", effects: [], endable: { budget: "action" } });
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
  const etherealness = (carries?: Record<string, unknown>) => ({
    id: "etherealness",
    name: "Etherealness",
    budget: "action",
    self: true,
    applies: [{ condition: "ethereal", duration: "until-dispelled" }],
    dismisses: { while: "ethereal", turns: true, ...(carries ? { carries } : {}) },
  });
  const block = (actions: unknown[] = []): RulesetStatBlock =>
    ({ health: 45, defense: 11, initiativeModifier: 0, speed: 30, actions }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid =>
    ({ width: 12, height: 3, tiles: Array.from({ length: 3 }, () => Array(12).fill("plains")) }) as TacticalGrid;
  const fight = (actions: unknown[]): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "ghost", name: "Ghost", side: "enemy", block: block(actions) },
        { id: "imp", name: "Imp", side: "enemy", block: block() },
        { id: "rat", name: "Rat", side: "enemy", block: block() },
        { id: "far", name: "Far Imp", side: "enemy", block: block() },
        { id: "hero", name: "Hero", side: "party", block: block() },
        { id: "friend", name: "Friend", side: "party", block: block() },
      ],
      board: {
        grid: grid(),
        placements: {
          ghost: { x: 5, y: 1 },
          imp: { x: 6, y: 1 },
          rat: { x: 4, y: 0 },
          far: { x: 9, y: 1 },
          hero: { x: 0, y: 0 },
          friend: { x: 0, y: 2 },
        },
      },
    });
    state.order = ["ghost", "hero", "friend", "imp", "rat", "far"];
    state.turn = 0;
    return state;
  };
  const act = (state: RulesetEncounterState, optionId: string) => {
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ghost", optionId, targetIds: ["ghost"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const gone = (state: RulesetEncounterState, id: string) => !!rulesetCombatant(state, id)!.away;

  // ── Etherealness: away, its turns offering only the way back, and back where it was ──
  {
    let state = act(fight([etherealness()]), "etherealness").state;
    assert.ok(gone(state, "ghost"));
    assert.ok(!gone(state, "imp"), "nobody carried");
    state.turn = 0;
    const ghost = rulesetCombatant(state, "ghost")!;
    ghost.budgets.action = 1;
    const offered = rulesetCombatOptions(definition, state, "ghost").map((one) => one.id);
    assert.ok(offered.includes("end-condition:ethereal"), JSON.stringify(offered));
    assert.ok(!offered.includes("etherealness"));
    const back = act(state, "end-condition:ethereal");
    assert.ok(!gone(back.state, "ghost"));
    assert.deepEqual(rulesetPositionOf(rulesetCombatant(back.state, "ghost")!), { x: 5, y: 1 });
    assert.ok(back.events.some((one) => one.type === "returned" && one.targetId === "ghost"));
  }
  // ── Ethereal Stride: the two allies within 5 feet go, the far one stays; back together ──
  {
    let state = act(fight([etherealness({ count: 3, within: 5, condition: "ethereal" })]), "etherealness").state;
    assert.deepEqual(
      ["ghost", "imp", "rat", "far"].map((id) => gone(state, id)),
      [true, true, true, false],
    );
    state.turn = 0;
    rulesetCombatant(state, "ghost")!.budgets.action = 1;
    state = act(state, "end-condition:ethereal").state;
    assert.deepEqual(
      ["ghost", "imp", "rat", "far"].map((id) => gone(state, id)),
      [false, false, false, false],
    );
    assert.deepEqual(rulesetPositionOf(rulesetCombatant(state, "rat")!), { x: 4, y: 0 });
  }
  // ── Only one rider ──
  {
    const state = act(fight([etherealness({ count: 1, within: 5, condition: "ethereal" })]), "etherealness").state;
    assert.equal(["imp", "rat"].filter((id) => gone(state, id)).length, 1);
  }

  // ── A catalog creature carries it onto its block ──
  {
    const doc = fiveE();
    const creatures = doc.catalogs.find((one: { id: string }) => one.id === "creatures");
    assert.ok(creatures, "the example has a bestiary");
    const entry = creatures.entries[0];
    entry.creature.actions.push(etherealness());
    parsed(doc);
  }

  // ── Refusals ──
  refused(
    fiveE((doc) => {
      doc.catalogs
        .find((one: { id: string }) => one.id === "creatures")
        .entries[0].creature.actions.push({
          ...etherealness(),
          applies: undefined,
        });
    }),
    /Away while it holds "ethereal", so the action puts it on/,
  );
  refused(
    fiveE((doc) => {
      doc.catalogs
        .find((one: { id: string }) => one.id === "creatures")
        .entries[0].creature.actions.push({
          ...etherealness({ count: 3, within: 5, condition: "ethereal" }),
          self: undefined,
        });
    }),
    /go with the creature itself, so the action is "self"/,
  );
  refused(
    fiveE((doc) => {
      doc.catalogs
        .find((one: { id: string }) => one.id === "creatures")
        .entries[0].creature.actions.push(etherealness({ count: 3, within: 5, condition: "astral" }));
    }),
    /Unknown condition "astral"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's action that sends somebody, or the creature itself, out of the fight (a creature action's dismisses) requires schemaVersion 2 and capabilityApi 1.685 or newer";
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
    const withGhost = fiveE((doc) => {
      doc.catalogs
        .find((one: { id: string }) => one.id === "creatures")
        .entries[0].creature.actions.push(etherealness());
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(684) as never, withGhost), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(685) as never, withGhost), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(684) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Etherealness: a creature away on its own action, offered only its way back, its riders along with it; gated at 1.685.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
