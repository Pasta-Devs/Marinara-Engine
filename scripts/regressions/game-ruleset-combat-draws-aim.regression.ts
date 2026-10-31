/**
 * Attacks drawn to a holder (Capability API 1.658): 5e's Shield of Missile Attraction's curse,
 * "Whenever a ranged weapon attack is made against a target within 10 feet of you, the curse causes you
 * to become the target instead."
 *
 *   - A bolt at an ally beside the cursed knight is made at the knight, nobody asked.
 *   - Not a bite, not an ally farther off, never the attack's own maker.
 *   - From a condition or a worn item alike.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-draws-aim-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 658);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const curse = () => ({ within: 10, blow: "ranged", weapon: true });
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "cursed", label: "Missile Attraction" });
    doc.combat.conditions.push({ condition: "cursed", effects: [], drawsAim: curse() });
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      slots: [{ id: "hand", label: "Hand", count: 2 }],
    };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "shield",
          label: "Shield of Missile Attraction",
          item: { category: "gear", slots: { hand: 1 }, worn: { drawsAim: curse() } },
        },
      ],
    });
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
  const shield = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const block = (): RulesetStatBlock =>
    ({
      health: 100,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "bite", name: "Bite", budget: "action", toHit: 5, reach: 5, damage: { flat: 4 } },
        { id: "bolt", name: "Bolt", budget: "action", toHit: 5, range: { normal: 120 }, damage: { flat: 4 } },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (allyAt: number, foeAt = 6, by: "condition" | "item" = "condition"): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "knight",
          name: "Knight",
          side: "party",
          build: rulesetSheetBuildSchema.parse({ fields: { level: 5, ac: 15, speed: 30, hp_max: 60 } }),
          live: {},
          ...(by === "item"
            ? { items: [{ item: shield, quantity: 1, worn: true, name: "Shield of Missile Attraction" }] }
            : {}),
        },
        {
          id: "ally",
          name: "Ally",
          side: "party",
          build: rulesetSheetBuildSchema.parse({ fields: { ac: 12, hp_max: 60 } }),
          live: {},
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 10, height: 3, tiles: Array.from({ length: 3 }, () => Array(10).fill("plains")) } as never,
        placements: { knight: { x: 1, y: 1 }, ally: { x: allyAt, y: 1 }, foe: { x: foeAt, y: 1 } },
      },
    });
    if (by === "condition") rulesetCombatant(state, "knight")!.tracked.push({ condition: "cursed", rounds: null });
    state.order = ["foe", "knight", "ally"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const attack = (state: RulesetEncounterState, optionId: string, target = "ally") => {
    const result = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "foe", optionId, targetIds: [target] },
      () => 10,
    );
    assert.deepEqual(of(result.events, "refused"), [], JSON.stringify(result.events));
    return result;
  };
  const struck = (events: RulesetCombatEvent[]) => of(events, "attack").map((one) => one.targetId);

  // ── A bolt at the ally beside them is made at the knight ──
  for (const by of ["condition", "item"] as const) {
    const bolt = attack(fight(2, 6, by), "bolt");
    assert.deepEqual(
      of(bolt.events, "tookAim").map((one) => [one.actorId, one.targetId, one.sourceId]),
      [["knight", "ally", "foe"]],
      `${by}: ${JSON.stringify(bolt.events)}`,
    );
    assert.equal(bolt.state.window, undefined, "nobody is asked");
    assert.deepEqual(struck(bolt.events), ["knight"], by);
  }

  // ── Not a bite, not an ally 15 feet off, never its own maker ──
  {
    assert.deepEqual(struck(attack(fight(2, 3), "bite").events), ["ally"], "a melee attack");
    assert.deepEqual(struck(attack(fight(4), "bolt").events), ["ally"], "15 feet off");
    assert.deepEqual(struck(attack(fight(4, 2), "bolt", "ally").events), ["ally"], "the foe beside them draws nothing");
    assert.deepEqual(struck(attack(fight(2), "bolt", "knight").events), ["knight"], "at the knight already");
  }

  // ── Refused ──
  refused(
    fiveE((doc) => (doc.combat.conditions.at(-1).drawsAim.within = 0)),
    /drawsAim\.within/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with attacks drawn to whoever holds a drawsAim near their target requires schemaVersion 2 and capabilityApi 1.658 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(657) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(658) as never, fiveE()), gate);
  }

  console.log(
    "Shield of Missile Attraction: a ranged weapon attack at someone within 10 feet is made at its holder, forced; gated at 1.658.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
