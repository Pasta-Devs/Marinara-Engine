/**
 * A contest's winner moves with the one it pushes (Capability API 1.598): Arcane Hand's Forceful
 * Hand, "moves with the target to remain within 5 feet of it".
 *
 *   - `onWin.follows`: pushed two squares, the pusher steps into the last cell the target left.
 *   - One two cells a side steps to the open place beside the target nearest it, not over them.
 *   - Without it, the pusher stays put.
 *   - Refused without a push, and the install gate.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
  type TacticalGrid,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-contest-follows-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 598);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const forceful = (onWin: Record<string, unknown>) => ({
    id: "forceful",
    label: "Forceful push",
    budget: "action",
    attacker: { checks: ["might"] },
    defender: { checks: ["might"] },
    onWin,
  });
  const document = (onWin: Record<string, unknown> = { push: 10, follows: true }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.contests.push(forceful(onWin));
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const wolf = (): RulesetStatBlock =>
    ({
      health: 200,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      checks: { might: -5 },
      actions: [],
    }) as RulesetStatBlock;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 60 },
  });
  const grid: TacticalGrid = {
    width: 8,
    height: 3,
    tiles: Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => "plains" as const)),
  };
  const push = (definition: RulesetDefinition, blocker = false, wide = false) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {} },
        { id: "wolf", name: "Wolf", side: "enemy", block: wolf() },
        ...(blocker ? [{ id: "rock", name: "Rock", side: "enemy" as const, block: wolf() }] : []),
      ],
      board: {
        grid,
        placements: wide
          ? { hero: { x: 0, y: 0 }, wolf: { x: 2, y: 0 } }
          : { hero: { x: 1, y: 1 }, wolf: { x: 2, y: 1 }, ...(blocker ? { rock: { x: 4, y: 1 } } : {}) },
      },
    } as never);
    // Two cells a side (1.194), as the Arcane Hand.
    if (wide) rulesetCombatant(state, "hero")!.span = 2;
    state.order = ["hero", "wolf", ...(blocker ? ["rock"] : [])];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Forceful push");
    assert.ok(option, "offered");
    const after = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option.id, targetIds: ["wolf"] },
      () => 10,
    );
    const at = (id: string) => {
      const one = rulesetCombatant(after.state, id)!;
      return { x: one.x, y: one.y };
    };
    const pushed = after.events.filter(
      (event): event is Extract<RulesetCombatEvent, { type: "pushed" }> => event.type === "pushed",
    );
    return { hero: at("hero"), wolf: at("wolf"), pushed };
  };

  // ── Pushed two squares; the hero steps up behind ──
  {
    const done = push(parsed(document()));
    assert.deepEqual(done.wolf, { x: 4, y: 1 });
    assert.deepEqual(done.hero, { x: 3, y: 1 }, "beside it again");
    assert.deepEqual(done.pushed[0]!.followed, { from: { x: 1, y: 1 }, to: { x: 3, y: 1 } });
  }
  // ── Without `follows`, the hero stays ──
  {
    const done = push(parsed(document({ push: 10 })));
    assert.deepEqual(done.wolf, { x: 4, y: 1 });
    assert.deepEqual(done.hero, { x: 1, y: 1 });
    assert.equal(done.pushed[0]!.followed, undefined);
  }
  // ── Stopped short by a rock: pushed one square, the hero follows one ──
  {
    const done = push(parsed(document()), true);
    assert.deepEqual(done.wolf, { x: 3, y: 1 }, "up against the rock");
    assert.deepEqual(done.hero, { x: 2, y: 1 });
  }

  // ── Two cells a side, pushing away from itself: beside the target again, not over it ──
  {
    const done = push(parsed(document()), false, true);
    assert.deepEqual(done.wolf, { x: 4, y: 0 });
    assert.deepEqual(done.hero, { x: 2, y: 0 }, "its right edge beside the wolf");
    assert.deepEqual(done.pushed[0]!.followed, { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } });
  }

  // ── Refused without a push ──
  {
    const doc = document({ applies: [{ condition: "prone" }], follows: true });
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false);
    if (!result.ok)
      assert.match(result.issues.join("; "), /"follows" moves after the one it pushes, so it goes with "push"/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a contest whose winner moves with the one it pushes (onWin.follows) requires schemaVersion 2 and capabilityApi 1.598 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(597) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(598) as never, document()), gate);
  }

  console.log(
    "Contest follows: the winner steps into the last cell the one it pushed left; refused without a push; gated at 1.598.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
