/**
 * Creatures that push, and a scroll's wide line (Capability API 1.184).
 *
 *   - A creature action's `push`: whoever it lands on is pushed away from the creature, and with a
 *     save only on a failed one (a bronze dragon's Repulsion Breath, a dragon turtle's Tail, whose
 *     damage lands either way).
 *   - An item's use may give its line a `width` (a scroll of Gust of Wind).
 *   - Import refusals, and the install gate.
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
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  supportedCapabilityApi,
  type RulesetCombatCell,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-push-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 179);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
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
  const definition = parsed(fiveE());
  const repulsion = {
    name: "Repulsion",
    targets: "any" as const,
    budget: "action",
    area: { shape: "cone" as const, size: 30 },
    save: { save: "str_save", difficulty: 15, onSuccess: "negates" as const },
    push: 30,
  };
  const tail = {
    name: "Tail",
    targets: "any" as const,
    budget: "action",
    toHit: 30,
    damage: { count: 0, sides: 4, flat: 7 },
    save: { save: "str_save", difficulty: 20, onSuccess: "none" as const },
    push: 10,
    applies: [{ condition: "prone", duration: "instant" as const }],
  };
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    saves: { str_save: -10 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  const fight = (
    hero: Partial<RulesetStatBlock> = {},
    dragon: RulesetStatBlock = block({ actions: [repulsion as never, tail as never] }),
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "dragon", name: "Dragon", side: "enemy", block: dragon },
        { id: "hero", name: "Hero", side: "enemy", block: block(hero) },
      ],
      board: { grid: grid(), placements: { dragon: { x: 5, y: 7 }, hero: { x: 6, y: 7 } } },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const at = (state: RulesetEncounterState, id: string) => ({ x: who(state, id).x, y: who(state, id).y });
  const use = (
    state: RulesetEncounterState,
    label: string,
    choice: { at?: RulesetCombatCell; targetIds?: string[] },
  ) => {
    const option = rulesetCombatOptions(definition, state, "dragon").find((one) => one.label === label);
    assert.ok(option, `the dragon has no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "dragon", optionId: option.id, targetIds: choice.targetIds ?? [], ...choice },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
    );
    return step;
  };

  // Both stand on one side, so the actions say they may be pointed at anybody.
  // ── Repulsion Breath: a failed save, pushed 30 feet ──
  {
    const breath = use(fight(), "Repulsion", { at: { x: 7, y: 7 } });
    assert.deepEqual(at(breath.state, "hero"), { x: 12, y: 7 }, "six cells straight away from the dragon");
    assert.ok(breath.events.some((one) => one.type === "pushed" && one.actorId === "dragon"));
    const held = use(fight({ saves: { str_save: 30 } }), "Repulsion", { at: { x: 7, y: 7 } });
    assert.deepEqual(at(held.state, "hero"), { x: 6, y: 7 }, "a save keeps them where they are");
  }

  // ── Tail: the hit lands either way, the push and the fall only on a failed save ──
  {
    const health = (state: RulesetEncounterState) =>
      rulesetCombatHealth(definition, definition.combat!, who(state, "hero")).value;
    const swept = use(fight(), "Tail", { targetIds: ["hero"] });
    assert.deepEqual(at(swept.state, "hero"), { x: 8, y: 7 });
    assert.ok(rulesetCombatConditions(definition, who(swept.state, "hero")).includes("prone"));
    assert.equal(health(swept.state), 93);
    const stood = use(fight({ saves: { str_save: 30 } }), "Tail", { targetIds: ["hero"] });
    assert.deepEqual(at(stood.state, "hero"), { x: 6, y: 7 });
    assert.ok(!rulesetCombatConditions(definition, who(stood.state, "hero")).includes("prone"));
    assert.equal(health(stood.state), 93, "the blow still lands");
  }

  // ── A dragon out of the bestiary pushes just as far ──
  {
    const beast = rulesetCreatureBlock(definition, {
      id: "turtle",
      label: "Turtle",
      creature: { ...block({ actions: [tail as never] }), tier: "cr_0" },
    } as never);
    assert.ok(beast);
    const swept = use(fight({}, beast), "Tail", { targetIds: ["hero"] });
    assert.deepEqual(at(swept.state, "hero"), { x: 8, y: 7 }, "two cells, as the one written out");
  }

  // ── A scroll's wide line ──
  const scroll = {
    category: "gear",
    use: {
      kind: "debuff",
      budget: "action",
      range: 60,
      area: { shape: "line", size: 60, width: 10 },
      save: { save: "str_save", onSuccess: "negates" },
      saveDifficulty: 15,
      push: 15,
      consumes: true,
    },
  };
  const withItem = (item: Record<string, unknown>) =>
    fiveE((doc) => {
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [{ id: "s", label: "S", item }] });
    });
  {
    parsed(withItem(scroll));
    const burst = parseRulesetDefinition(
      withItem({ ...scroll, use: { ...scroll.use, area: { shape: "burst", size: 10, width: 10 } } }),
    );
    assert.ok(!burst.ok && burst.issues.some((issue) => /Only a line or a wall carries width/.test(issue)));
    const bad = parseRulesetDefinition(
      fiveE((doc) => {
        doc.catalogs.push({
          id: "beasts",
          label: "Beasts",
          holds: "creatures",
          entries: [
            {
              id: "d",
              label: "D",
              creature: { ...block({ actions: [{ ...repulsion, push: -5 } as never] }), tier: "cr_0" },
            },
          ],
        });
      }),
    );
    assert.ok(!bad.ok && bad.issues.some((issue) => /push/.test(issue)));
  }

  // ── The gate ──
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
      "A ruleset with creature actions that push or item uses whose line has a width requires schemaVersion 2 and capabilityApi 1.184 or newer";
    const creatureDoc = fiveE((doc) => {
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [{ id: "d", label: "D", creature: { ...block({ actions: [repulsion as never] }), tier: "cr_0" } }],
      });
    });
    for (const [label, doc] of [
      ["creature push", creatureDoc],
      ["scroll width", withItem({ ...scroll, use: { ...scroll.use, push: undefined } })],
    ] as const) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(183) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(184) as never, doc), gate, label);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(183) as never, fiveE()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset creature pushes: a dragon's breath pushes whoever fails the save, a tail's blow lands either way and pushes and fells only on a failure, and a scroll's line can be wide.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
