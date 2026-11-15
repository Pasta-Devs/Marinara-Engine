/**
 * Conditions that make their holder bigger or smaller (Capability API 1.195).
 *
 *   - A combat condition's `size.steps`: while it holds, its holder is that many of `combat.sizes`
 *     further along, or back along, never past either end; ended, they are their own size again.
 *   - On a board a growing holder fills its new size over every cell it stood on where that fits,
 *     or the biggest size short of it that does; a shrinking one keeps its top-left cell.
 *   - Held as the fight begins, it is set down at that size. The log says who changed, and to what.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFootprint,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetSizeRank,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-size-change-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 190);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.combat.sizes = {
      order: [
        { id: "small", label: "Small" },
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large", cells: 2 },
        { id: "huge", label: "Huge", cells: 3 },
      ],
      default: "medium",
    };
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    for (const [id, steps] of [
      ["enlarged", 1],
      ["reduced", -1],
      ["towering", 2],
      ["colossal", 5],
    ] as const) {
      doc.sheet.live.conditions.push({ id, label: id });
      doc.combat.conditions.push({ condition: id, size: { steps } });
    }
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parse(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 40 },
  });
  const sword = {
    name: "Sword",
    quantity: 1,
    worn: true,
    item: {
      category: "gear",
      slots: { hands: 1 },
      attack: {
        budget: "action",
        toHit: { abilities: ["str"] },
        damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
      },
    } as RulesetCatalogItem,
  } as RulesetSheetItem;
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 60,
      defense: 5,
      initiativeModifier: -20,
      speed: 30,
      actions: [{ id: "club", name: "Club", budget: "action", toHit: 5, damage: { count: 1, sides: 4, flat: 0 } }],
      ...extra,
    }) as RulesetStatBlock;
  const grid = (edit: (tiles: string[][]) => void = () => {}): TacticalGrid => {
    const tiles = Array.from({ length: 12 }, () => Array(12).fill("plains"));
    edit(tiles);
    return { width: 12, height: 12, tiles } as TacticalGrid;
  };
  const roller = (sides: number) => (sides === 20 ? 15 : 2);
  const fight = (
    placements: Record<string, { x: number; y: number }> = { hero: { x: 5, y: 5 }, ogre: { x: 0, y: 0 } },
    options: { board?: TacticalGrid; conditions?: string[]; ogre?: Partial<RulesetStatBlock> } = {},
  ) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build,
          items: [sword],
          live: { conditions: options.conditions ?? [] },
        },
        { id: "ogre", name: "ogre", side: "enemy", block: block({ size: "large", ...options.ogre }) },
      ],
      board: { grid: options.board ?? grid(), placements },
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const keys = (cells: Array<{ x: number; y: number }>) => cells.map((cell) => `${cell.x},${cell.y}`).sort();
  /** Puts a condition on and lets the fight catch up, as the end of any choice does. */
  const hold = (state: RulesetEncounterState, id: string, condition: string) => {
    who(state, id).tracked.push({ condition, rounds: null } as never);
    return advanceRulesetTurn(definition, state, roller);
  };
  const drop = (state: RulesetEncounterState, id: string, condition: string) => {
    who(state, id).tracked = who(state, id).tracked.filter((entry) => entry.condition !== condition);
    // A party member's own conditions live on their sheet.
    const live = who(state, id).sheet?.live as { conditions?: string[] } | undefined;
    if (live?.conditions) live.conditions = live.conditions.filter((one) => one !== condition);
    return advanceRulesetTurn(definition, state, roller);
  };

  // ── Enlarged by a spell, it grows over where it stood, and comes back down when it ends ──
  {
    const state = fight();
    who(state, "hero").actions.push({
      id: "enlarge",
      label: "Enlarge",
      kind: "ability",
      budget: "action",
      autoHit: true,
      targets: { side: "ally", count: 1 },
      range: { normal: 6 },
      applies: [{ condition: "enlarged", duration: { rounds: 10 } }],
    } as never);
    who(state, "hero").budgets.action = 1;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: "enlarge", targetIds: ["hero"] },
      roller,
    );
    const hero = who(step.state, "hero");
    assert.equal(hero.size, "large", JSON.stringify(step.events));
    assert.equal(hero.baseSize, "medium");
    assert.equal(hero.span, 2);
    assert.deepEqual(keys(rulesetFootprint(hero)), ["5,5", "5,6", "6,5", "6,6"]);
    assert.deepEqual(
      step.events.filter((one) => one.type === "resized"),
      [{ type: "resized", targetId: "hero", size: "large", label: "Large" }],
    );
    assert.equal(rulesetSizeRank(definition.combat!, hero), 2, "anything asking its size reads the new one");
    // Said once: the next choice changes nothing.
    const after = advanceRulesetTurn(definition, step.state, roller);
    assert.ok(!after.events.some((one) => one.type === "resized"));
    // Ended, it is its own size again, back on its top-left cell.
    const ended = drop(step.state, "hero", "enlarged");
    const back = who(ended.state, "hero");
    assert.equal(back.size, "medium");
    assert.equal(back.baseSize, undefined);
    assert.equal(back.span, undefined);
    assert.deepEqual([back.x, back.y], [5, 5]);
    assert.deepEqual(
      ended.events.filter((one) => one.type === "resized"),
      [{ type: "resized", targetId: "hero", size: "medium", label: "Medium" }],
    );
  }

  // ── Where its corner is walled it grows the other way, and only as big as there is room for ──
  {
    const walled = fight(undefined, { board: grid((tiles) => ((tiles[5]![6] = "wall"), (tiles[6]![6] = "wall"))) });
    const grown = who(hold(walled, "hero", "enlarged").state, "hero");
    assert.deepEqual([grown.x, grown.y, grown.span], [4, 5, 2]);
    // Up against somebody standing beside it too.
    const crowded = fight({ hero: { x: 5, y: 5 }, ogre: { x: 6, y: 5 } });
    const beside = who(hold(crowded, "hero", "enlarged").state, "hero");
    assert.deepEqual([beside.x, beside.y], [4, 5], "the ogre fills 6-7 by 5-6");
    // A corridor one cell wide: no room to grow at all.
    const corridor = grid((tiles) => tiles.forEach((row, y) => y !== 5 && row.fill("wall")));
    const narrow = hold(fight({ hero: { x: 5, y: 5 }, ogre: { x: 0, y: 5 } }, { board: corridor }), "hero", "enlarged");
    assert.equal(who(narrow.state, "hero").size, "medium");
    assert.equal(who(narrow.state, "hero").span, undefined);
    assert.ok(!narrow.events.some((one) => one.type === "resized"));
    // Two steps where there is room for only one: Large, not Huge, grown up the corridor.
    const tight = grid((tiles) => tiles.forEach((row, y) => y !== 5 && y !== 6 && row.fill("wall")));
    const one = who(
      hold(fight({ hero: { x: 5, y: 6 }, ogre: { x: 0, y: 5 } }, { board: tight }), "hero", "towering").state,
      "hero",
    );
    assert.deepEqual([one.size, one.span, one.baseSize, one.x, one.y], ["large", 2, "medium", 5, 5]);
    // With room it takes both steps, and five is held to the last size there is.
    assert.equal(who(hold(fight(), "hero", "towering").state, "hero").size, "huge");
    assert.equal(who(hold(fight(), "hero", "colossal").state, "hero").size, "huge");
  }

  // ── Reduced, a Large ogre keeps its top-left cell and stops reaching from its old far side ──
  {
    const state = fight({ hero: { x: 7, y: 7 }, ogre: { x: 5, y: 5 } });
    state.turn = state.order.indexOf("ogre");
    const club = () => {
      const option = rulesetCombatOptions(definition, state, "ogre").find((one) => one.label === "Club")!;
      return rulesetOptionTargets(definition, state, "ogre", option);
    };
    assert.deepEqual(club(), ["hero"]);
    const shrunk = hold(state, "ogre", "reduced").state;
    Object.assign(state, shrunk);
    state.turn = state.order.indexOf("ogre");
    const ogre = who(state, "ogre");
    assert.deepEqual([ogre.x, ogre.y, ogre.size, ogre.span, ogre.baseSize], [5, 5, "medium", undefined, "large"]);
    assert.deepEqual(club(), []);
    // Enlarged and reduced at once are its own size.
    who(state, "ogre").tracked.push({ condition: "enlarged", rounds: null } as never);
    const both = who(advanceRulesetTurn(definition, state, roller).state, "ogre");
    assert.deepEqual([both.size, both.span, both.baseSize], ["large", 2, undefined]);
  }

  // ── Held as the fight begins: set down at that size ──
  {
    const state = fight({ hero: { x: 5, y: 5 }, ogre: { x: 0, y: 0 } }, { conditions: ["enlarged"] });
    assert.deepEqual([who(state, "hero").size, who(state, "hero").span], ["large", 2]);
    // And nobody asked to stand inside it is left there.
    const crowded = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: { conditions: ["enlarged"] } },
        { id: "imp", name: "imp", side: "enemy", block: block({ size: "small" }) },
      ],
      board: { grid: grid(), placements: { hero: { x: 5, y: 5 }, imp: { x: 6, y: 6 } } },
    });
    const imp = who(crowded, "imp");
    assert.ok(!rulesetFootprint(who(crowded, "hero")).some((cell) => cell.x === imp.x && cell.y === imp.y));
  }

  // ── Without a board it changes size all the same ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build },
        { id: "ogre", name: "ogre", side: "enemy", block: block({ size: "large" }) },
      ],
    });
    state.turn = state.order.indexOf("hero");
    const grown = who(hold(state, "hero", "enlarged").state, "hero");
    assert.deepEqual([grown.size, grown.span, grown.x], ["large", 2, undefined]);
  }

  // ── Refusals and the gate ──
  {
    const refused = (edit: (doc: any) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(document(edit));
      assert.equal(result.ok, false, `should be refused: ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const sized = (doc: any) => doc.combat.conditions.find((entry: any) => entry.condition === "enlarged");
    refused((doc) => (sized(doc).size.steps = 0), /at least one step/);
    refused((doc) => (sized(doc).size.steps = 6), /size/);
    refused((doc) => (sized(doc).size.steps = 1.5), /size/);
    refused((doc) => (sized(doc).size = { steps: 1, to: "huge" }), /size/);
    refused((doc) => delete doc.combat.sizes, /changes size needs combat\.sizes/);
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
    const gate = "A ruleset with conditions that change size requires schemaVersion 2 and capabilityApi 1.195 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(194) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(195) as never, document()), gate);
    const plain = JSON.parse(fiveE);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(194) as never, plain), gate);
  }

  console.log(
    "Ruleset size changes: Enlarge grows its holder over where it stood as far as there is room, Reduce shrinks it in place, both end back at its own size, and the log says so.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
