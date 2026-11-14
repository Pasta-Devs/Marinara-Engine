/**
 * Conditions held off rather than ended (Capability API 1.275).
 *
 *   - `orSourceWithin` beside `whileSourceInSight`: Antipathy's fright holds while its holder can see
 *     the target or stands within 60 feet of it; out of both it is held off, still on, and holds
 *     again the moment either is true.
 *   - `suppresses`: Calm Emotions holds a charm or a fright off while it lasts, and it is back once
 *     Calm Emotions ends.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-held-off-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 270);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const conditionOf = (doc: Record<string, any>, id: string) =>
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === id);
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    for (const [id, label] of [
      ["repelled", "Repelled"],
      ["calmed", "Calmed"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      {
        condition: "repelled",
        effects: [],
        behavior: { moves: "away" },
        whileSourceInSight: true,
        orSourceWithin: 60,
      },
      { condition: "calmed", effects: [], suppresses: ["repelled"] },
    );
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
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 14, speed: 30, hp_max: 40 },
    lists: {},
  });
  const block = (): RulesetStatBlock => ({
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 0, sides: 0, flat: 1 } }],
  });
  const width = 30;
  const fight = (wolfAt: number, walls: number[] = []): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "friend", name: "Friend", side: "party", build, live: {} },
        { id: "wolf", name: "Wolf", side: "enemy", block: block() },
      ],
      board: {
        grid: {
          width,
          height: 1,
          tiles: [Array.from({ length: width }, (_, x) => (walls.includes(x) ? "wall" : "plains"))],
          elevation: [Array(width).fill(0)],
        } as never,
        placements: { friend: { x: 1, y: 0 }, wolf: { x: wolfAt, y: 0 } },
      },
    });
    rulesetCombatant(state, "wolf")!.tracked.push({ condition: "repelled", rounds: null, source: "friend" } as never);
    return state;
  };
  const holds = (state: RulesetEncounterState, condition = "repelled") =>
    rulesetActiveConditions(definition, definition.combat!, rulesetCombatant(state, "wolf")!, state).some(
      (one) => one.condition === condition,
    );
  const on = (state: RulesetEncounterState, condition = "repelled") =>
    rulesetCombatConditions(definition, rulesetCombatant(state, "wolf")!).includes(condition);

  // ── Within 60 feet or in sight: it holds; out of both, it is held off and still on ──
  {
    assert.ok(holds(fight(5)), "near and seen");
    assert.ok(holds(fight(20)), "far, but seen");
    assert.ok(holds(fight(10, [5])), "unseen, but within 60 feet");
    const away = fight(20, [10]);
    assert.ok(!holds(away), "far and unseen: held off");
    assert.ok(on(away), "but still on");
    // Back in sight, it holds again.
    rulesetCombatant(away, "wolf")!.x = 8;
    assert.ok(holds(away), "back within 60 feet");
    // Without orSourceWithin, sight alone decides.
    const rule = definition.combat!.conditions!.find((one) => one.condition === "repelled")!;
    const within = rule.orSourceWithin;
    delete rule.orSourceWithin;
    try {
      assert.ok(!holds(fight(10, [5])), "unseen and near: sight alone is gone");
    } finally {
      rule.orSourceWithin = within;
    }
  }

  // ── Calm Emotions holds the fright off, and it is back once Calm Emotions ends ──
  {
    const state = fight(5);
    const wolf = rulesetCombatant(state, "wolf")!;
    wolf.tracked.push({ condition: "calmed", rounds: 10 } as never);
    assert.ok(!holds(state), "held off");
    assert.ok(holds(state, "calmed"));
    assert.ok(on(state), "still on");
    wolf.tracked = wolf.tracked.filter((one) => one.condition !== "calmed");
    assert.ok(holds(state), "back");
  }

  // ── Import ──
  {
    refused(
      document((doc) => delete conditionOf(doc, "repelled").whileSourceInSight),
      /"orSourceWithin" widens "whileSourceInSight"/,
    );
    refused(
      document((doc) => (conditionOf(doc, "calmed").suppresses = ["calmed"])),
      /A condition holds off others, not itself/,
    );
    refused(
      document((doc) => (conditionOf(doc, "calmed").suppresses = ["sulking"])),
      /Unknown condition "sulking"/,
    );
    refused(
      document((doc) => (conditionOf(doc, "repelled").orSourceWithin = 0)),
      /orSourceWithin/,
    );
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
      "A ruleset with a condition that holds while its source is near as well as in sight, or one condition that holds others off, requires schemaVersion 2 and capabilityApi 1.275 or newer";
    const issue = (minor: number, doc: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, undefined as never);
    const plain = document((doc) => {
      delete conditionOf(doc, "repelled").orSourceWithin;
      delete conditionOf(doc, "calmed").suppresses;
    });
    assert.notEqual(issue(274, plain), gate, "nothing of 1.275 left");
    assert.equal(issue(274, document()), gate);
    assert.notEqual(issue(275, document()), gate);
    assert.equal(
      issue(
        274,
        document((doc) => delete conditionOf(doc, "calmed").suppresses),
      ),
      gate,
      "near alone",
    );
    assert.equal(
      issue(
        274,
        document((doc) => delete conditionOf(doc, "repelled").orSourceWithin),
      ),
      gate,
      "held off alone",
    );
  }

  console.log(
    "Ruleset held off: Antipathy's fright holds within 60 feet or in sight and is held off, still on, out of both; Calm Emotions holds a fright off until it ends; gated at 1.275.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
