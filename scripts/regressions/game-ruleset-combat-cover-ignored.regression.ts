/**
 * Attacks that ignore some cover (Capability API 1.705): a Wand of the War Mage, "you ignore half
 * cover when making a spell attack".
 *
 *   - Behind a creature (half cover), a spell attack from the wand's holder ignores it; a weapon
 *     attack does not.
 *   - Behind a wall of three-quarters cover, the wand ignores nothing; Spell Sniper's
 *     three-quarters ignores it.
 *   - Refused with an unknown tier; the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetDefenseAgainst,
  supportedCapabilityApi,
  type RulesetCombatAction,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cover-ignored-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 705);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.cover = { bonus: 2, threeQuarters: 5, creatures: true };
    doc.sheet.live.conditions.push(
      { id: "war_mage", label: "Wand of the War Mage" },
      { id: "sniper", label: "Spell Sniper" },
    );
    doc.combat.conditions.push(
      { condition: "war_mage", effects: [], coverIgnored: { upTo: "half", attacks: "spell" } },
      { condition: "sniper", effects: [], coverIgnored: { upTo: "three-quarters", attacks: "spell" } },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const block = (): RulesetStatBlock =>
    ({ health: 40, defense: 12, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const spell = {
    id: "bolt",
    label: "Fire Bolt",
    kind: "attack",
    budget: "action",
    catalog: "spells",
    targets: { side: "enemy", count: 1 },
    range: { normal: 24 },
  } as unknown as RulesetCombatAction;
  const bow = {
    id: "bow",
    label: "Longbow",
    kind: "attack",
    budget: "action",
    targets: { side: "enemy", count: 1 },
    range: { normal: 30 },
  } as unknown as RulesetCombatAction;
  // The mage at (0,2), the target at (4,2); a creature at (2,2), or a wall there.
  const fight = (conditions: string[], wall: boolean): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mage", name: "Mage", side: "party", block: block() },
        { id: "target", name: "Target", side: "enemy", block: block() },
        ...(wall ? [] : [{ id: "screen", name: "Screen", side: "enemy" as const, block: block() }]),
      ],
      board: {
        grid: { width: 8, height: 5, tiles: Array.from({ length: 5 }, () => Array(8).fill("plains")) },
        placements: { mage: { x: 0, y: 2 }, target: { x: 4, y: 2 }, ...(wall ? {} : { screen: { x: 2, y: 2 } }) },
      },
    } as never);
    if (wall) {
      const target = rulesetCombatant(state, "target")!;
      target.actions.push({
        id: "wall",
        label: "Wall",
        budget: "action",
        targets: { side: "self", count: 0 },
        zone: { cover: "three-quarters" },
      } as never);
      target.zones = [
        {
          actionId: "wall",
          label: "Wall",
          rounds: 10,
          anchor: "point",
          triggers: [],
          at: { x: 2, y: 2 },
          cells: [0, 1, 2, 3, 4].map((y) => ({ x: 2, y })),
        },
      ];
    }
    const mage = rulesetCombatant(state, "mage")!;
    for (const condition of conditions) mage.tracked.push({ condition, rounds: null } as never);
    return state;
  };
  const cover = (conditions: string[], wall: boolean, action: RulesetCombatAction) => {
    const state = fight(conditions, wall);
    return rulesetDefenseAgainst(
      definition,
      definition.combat!,
      state,
      rulesetCombatant(state, "target")!,
      rulesetCombatant(state, "mage")!,
      action,
    ).cover;
  };

  // ── Half cover behind a creature ──
  assert.equal(cover([], false, spell), 2);
  assert.equal(cover(["war_mage"], false, spell), 0, "the wand ignores half cover on a spell attack");
  assert.equal(cover(["war_mage"], false, bow), 2, "not on a weapon attack");
  // ── Three-quarters behind a wall ──
  assert.equal(cover([], true, spell), 5);
  assert.equal(cover(["war_mage"], true, spell), 5, "the wand ignores no three-quarters cover");
  assert.equal(cover(["sniper"], true, spell), 0, "Spell Sniper does");

  // ── Refused with an unknown tier ──
  {
    const result = parseRulesetDefinition(
      fiveE((doc) => {
        doc.combat.conditions.find((one: { condition: string }) => one.condition === "war_mage").coverIgnored = {
          upTo: "total",
        };
      }),
    );
    assert.equal(result.ok, false);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition whose holder's attacks ignore some cover (coverIgnored) requires schemaVersion 2 and capabilityApi 1.705 or newer";
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
    const without = fiveE((doc) => {
      for (const one of doc.combat.conditions) delete one.coverIgnored;
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(704) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(705) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(704) as never, without), gate);
  }

  console.log(
    "Cover ignored: the wand's spell attack ignores half cover but not three-quarters, a weapon attack ignores none, Spell Sniper ignores three-quarters; gated at 1.705.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
