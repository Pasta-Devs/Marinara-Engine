/**
 * A creature's action whose uses each do something else (Capability API 1.687).
 *
 *   - `byUse`: an androsphinx's Roar, three a day, frightens first, deafens as well second, and
 *     thunders third; its parts are never on the menu themselves; a use past the end makes the last.
 *   - On a board, a part bursting around the sphinx catches whom it reaches and never the sphinx,
 *     and the Roar is made where the sphinx stands.
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
  rulesetOptionTargets,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-roars-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 687);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const roars = [
    {
      id: "roar",
      name: "Roar",
      budget: "action",
      uses: { per: "day", count: 3 },
      byUse: ["roar_1", "roar_2", "roar_3"],
    },
    {
      id: "roar_1",
      name: "First Roar",
      budget: "action",
      autoHit: true,
      applies: [{ condition: "frightened", duration: { rounds: 10 } }],
    },
    {
      id: "roar_2",
      name: "Second Roar",
      budget: "action",
      autoHit: true,
      applies: [
        { condition: "deafened", duration: { rounds: 10 } },
        { condition: "frightened", duration: { rounds: 10 } },
      ],
    },
    {
      id: "roar_3",
      name: "Third Roar",
      budget: "action",
      autoHit: true,
      damage: { dice: "8d10", type: "thunder" },
      applies: [{ condition: "prone", duration: "instant" }],
    },
  ];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
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
  const withSphinx = (actions: unknown[]) =>
    fiveE((doc) => {
      doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.actions.push(...actions);
    });
  const definition = parsed(withSphinx(roars));
  const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
  const sphinx = rulesetStatBlockFromCreature(definition, creature)!;
  assert.deepEqual((sphinx.actions.find((one) => one.id === "roar") as unknown as { byUse: string[] }).byUse, [
    "roar_1",
    "roar_2",
    "roar_3",
  ]);
  const block = (actions: unknown[] = []): RulesetStatBlock =>
    ({ health: 500, defense: 10, initiativeModifier: 0, speed: 30, actions }) as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "sphinx", name: "Androsphinx", side: "enemy", block: { ...sphinx, health: 500 } },
        { id: "hero", name: "Hero", side: "party", block: block() },
        { id: "friend", name: "Friend", side: "party", block: block() },
      ],
    });
    state.order = ["sphinx", "hero", "friend"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const roar = (state: RulesetEncounterState) => {
    state.turn = 0;
    const sphinxNow = rulesetCombatant(state, "sphinx")!;
    sphinxNow.budgets.action = 1;
    sphinxNow.spent = [];
    for (const one of state.combatants) if (one.id !== "sphinx") one.tracked = [];
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "sphinx", optionId: "roar", targetIds: ["hero"] },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return {
      state: step.state,
      holds: rulesetCombatant(step.state, "hero")!
        .tracked.map((one) => one.condition)
        .sort(),
      thunder: of(step.events, "damage").filter((one) => one.targetId === "hero"),
    };
  };

  // ── Only the Roar is offered ──
  {
    const offered = rulesetCombatOptions(definition, fight(), "sphinx").map((one) => one.id);
    assert.ok(offered.includes("roar"), JSON.stringify(offered));
    for (const id of ["roar_1", "roar_2", "roar_3"]) assert.ok(!offered.includes(id), id);
  }
  // ── Louder each time ──
  {
    const first = roar(fight());
    assert.deepEqual(first.holds, ["frightened"]);
    assert.equal(first.thunder.length, 0);
    const second = roar(first.state);
    assert.deepEqual(second.holds, ["deafened", "frightened"]);
    const third = roar(second.state);
    assert.equal(third.thunder.length, 1, "the thunder");
    assert.equal(third.thunder[0]!.damageType, "thunder");
    assert.deepEqual(third.holds, ["prone"]);
    // Its uses are gone.
    const offered = rulesetCombatOptions(definition, third.state, "sphinx").map((one) => one.id);
    assert.ok(!offered.includes("roar"), "no roars left today");
  }

  // ── On a board, a part that bursts around the sphinx catches whom it reaches, never the sphinx ──
  {
    const loud = [
      { ...roars[0] },
      {
        id: "roar_1",
        name: "First Roar",
        budget: "action",
        area: { shape: "burst", size: 500, around: true },
        save: { save: "wis_save", difficulty: 18, onSuccess: "negates" },
        applies: [{ condition: "frightened", duration: { rounds: 10 } }],
      },
      { ...roars[2], autoHit: undefined, area: { shape: "burst", size: 500, around: true } },
      { ...roars[3], autoHit: undefined, area: { shape: "burst", size: 500, around: true } },
    ];
    const boardDefinition = parsed(withSphinx(loud));
    const boardCreature = boardDefinition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
    const loudSphinx = rulesetStatBlockFromCreature(boardDefinition, boardCreature)!;
    const state = createRulesetEncounter({
      definition: boardDefinition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "sphinx", name: "Androsphinx", side: "enemy", block: { ...loudSphinx, health: 500 } },
        { id: "hero", name: "Hero", side: "party", block: block() },
        { id: "friend", name: "Friend", side: "party", block: block() },
      ],
      board: {
        grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) },
        placements: { sphinx: { x: 14, y: 6 }, hero: { x: 6, y: 6 }, friend: { x: 2, y: 1 } },
      },
    } as never);
    state.order = ["sphinx", "hero", "friend"];
    state.turn = 0;
    const option = rulesetCombatOptions(boardDefinition, state, "sphinx").find((one) => one.id === "roar");
    assert.ok(option, "offered on a board");
    const step = applyRulesetCombatChoice(
      boardDefinition,
      state,
      {
        actorId: "sphinx",
        optionId: "roar",
        targetIds: rulesetOptionTargets(boardDefinition, state, "sphinx", option)
          .slice(0, option.targets.count)
          .map((one) => one.id),
      },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    assert.deepEqual(
      of(step.events, "save")
        .map((one) => one.actorId)
        .sort(),
      ["friend", "hero"],
      "the sphinx never saves against its own roar",
    );
    for (const id of ["hero", "friend"])
      assert.ok(
        rulesetCombatant(step.state, id)!.tracked.some((one) => one.condition === "frightened"),
        id,
      );
    assert.equal(rulesetCombatant(step.state, "sphinx")!.tracked.length, 0);
  }

  // ── Refusals ──
  refused(
    withSphinx([{ ...roars[0], uses: undefined }, ...roars.slice(1)]),
    /"byUse" is counted by the action's own "uses"/,
  );
  refused(withSphinx([{ ...roars[0], byUse: ["roar_1", "roar_9"] }, ...roars.slice(1)]), /Unknown action "roar_9"/);
  refused(withSphinx([{ ...roars[0], autoHit: true }, ...roars.slice(1)]), /carries nothing of its own/);
  refused(withSphinx([{ ...roars[0], byUse: ["roar", "roar_1"] }, ...roars.slice(1)]), /cannot name itself/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature's action whose uses each do something else (byUse) requires schemaVersion 2 and capabilityApi 1.687 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(686) as never, withSphinx(roars)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(687) as never, withSphinx(roars)), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(686) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Roars: each use of the Roar louder than the last, its parts off the menu; gated at 1.687.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
