/**
 * A contest rolled with advantage by size and pushing by a sheet's value (Capability API 1.587).
 *
 *   - `advantageAtMostSize: "medium"`: the actor throws its check with advantage against a Medium
 *     target and not against a Large one (Arcane Hand's Forceful Hand).
 *   - `onWin.pushRead`: the win pushes `push` plus what is read off the actor's sheet, or off its
 *     caller's for a called creature with none of its own.
 *   - An unknown size, and a size with no `sizes`, are refused.
 *   - The install gate.
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
  type RulesetEncounterState,
  type RulesetStatBlock,
  type TacticalGrid,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-push-read-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 587);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const forceful = {
    id: "forceful",
    label: "Forceful push",
    budget: "action",
    attacker: { checks: ["might"] },
    defender: { checks: ["might"] },
    advantageAtMostSize: "medium",
    onWin: { push: 5, pushRead: { abilityMod: "str" } },
  };
  const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
  const document = (edit: (doc: any) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sizes = {
      order: SIZES.map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) })),
      default: "medium",
    };
    doc.combat.contests.push(structuredClone(forceful));
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown) => parseRulesetDefinition(doc);
  const parsed = parse(document());
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;

  // ── Refusals ──
  const unknown = parse(document((doc) => (doc.combat.contests.at(-1).advantageAtMostSize = "vast")));
  assert.ok(!unknown.ok && unknown.issues.some((one) => one.includes('Unknown size "vast"')));
  const noSizes = parse(document((doc) => delete doc.combat.sizes));
  assert.ok(!noSizes.ok && noSizes.issues.some((one) => one.includes('"advantageAtMostSize" reads sizes')));

  const creature = (size?: string, might = -5): RulesetStatBlock =>
    ({
      health: 200,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      ...(size ? { size } : {}),
      checks: { might },
      actions: [
        { id: "slam", name: "Slam", budget: "action", toHit: 5, damage: { count: 0, sides: 0, flat: 3 }, reach: 1 },
      ],
    }) as RulesetStatBlock;
  // Strength 20: +5, so a push of 5 feet and 5 more, two squares.
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 60 },
  });
  const grid: TacticalGrid = {
    width: 8,
    height: 3,
    tiles: Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => "plains" as const)),
  };
  let d20s = 0;
  const roller = (sides: number) => {
    if (sides === 20) d20s++;
    return 10;
  };
  /** The hero, or a called hand with no sheet of its own, next to a wolf of the given size. */
  const fight = (size: string | undefined, pusher: "hero" | "hand"): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {} },
        { id: "hand", name: "Hand", side: "party", block: creature("large", 8) },
        { id: "wolf", name: "Wolf", side: "enemy", block: creature(size) },
      ],
      board: { grid, placements: { hero: { x: 0, y: 0 }, hand: { x: 1, y: 2 }, wolf: { x: 2, y: 1 } } },
    } as never);
    rulesetCombatant(state, "hand")!.calledBy = "hero";
    if (pusher === "hand") rulesetCombatant(state, "hand")!.x = 1;
    if (pusher === "hand") rulesetCombatant(state, "hand")!.y = 1;
    else {
      rulesetCombatant(state, "hero")!.x = 1;
      rulesetCombatant(state, "hero")!.y = 1;
    }
    state.order = [pusher, pusher === "hero" ? "hand" : "hero", "wolf"];
    state.turn = 0;
    return state;
  };
  const push = (size: string | undefined, pusher: "hero" | "hand") => {
    const state = fight(size, pusher);
    const option = rulesetCombatOptions(definition, state, pusher).find((one) => one.label === "Forceful push");
    assert.ok(option, `the push offered to the ${pusher}`);
    d20s = 0;
    const after = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: pusher, optionId: option.id, targetIds: ["wolf"] },
      roller,
    );
    const pushed = after.events.filter(
      (event): event is Extract<RulesetCombatEvent, { type: "pushed" }> => event.type === "pushed",
    );
    return { d20s, wolf: rulesetCombatant(after.state, "wolf")!, pushed };
  };

  // ── Against a Medium wolf: advantage (three d20s), pushed 5 + 5 feet, two squares ──
  {
    const medium = push("medium", "hero");
    assert.equal(medium.d20s, 3, "the actor throws two d20s against a Medium target");
    assert.equal(medium.pushed.length, 1);
    assert.deepEqual({ x: medium.wolf.x, y: medium.wolf.y }, { x: 4, y: 1 }, "pushed two squares");
  }
  // ── Against a Large one: no advantage ──
  {
    const large = push("large", "hero");
    assert.equal(large.d20s, 2, "no advantage against a Large target");
    assert.deepEqual({ x: large.wolf.x, y: large.wolf.y }, { x: 4, y: 1 });
  }
  // ── A called hand with no sheet reads its caller's: still two squares ──
  {
    const hand = push("medium", "hand");
    assert.deepEqual({ x: hand.wolf.x, y: hand.wolf.y }, { x: 4, y: 1 }, "the hand pushes by its caller's Strength");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a contest rolled with advantage by size or pushing by a sheet's value (advantageAtMostSize, onWin.pushRead) requires schemaVersion 2 and capabilityApi 1.587 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(586) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(587) as never, document()), gate);
  }

  console.log(
    "Contest push reads: advantage against a target no bigger than the size named, a push farther by a sheet's value or its caller's; refusals; gated at 1.587.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
