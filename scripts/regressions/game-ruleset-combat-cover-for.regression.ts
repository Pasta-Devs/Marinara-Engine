/**
 * A condition that gives cover against its holder (Capability API 1.588).
 *
 *   - `coverFor: { tier: "half", who: "caller" }`: Arcane Hand's Interposing Hand. The creature the
 *     hand stands before attacks the hand's caster through half cover, and the caster's saves against
 *     its effects get it too, while the hand stands; nobody else is covered.
 *   - `who: "source"` covers the applier itself.
 *   - Off a board it still counts.
 *   - A fight with no `cover` is refused.
 *   - The install gate.
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
  rulesetCoverBonus,
  rulesetDefenseAgainst,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
  type TacticalGrid,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cover-for-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 588);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (who: "source" | "caller" = "caller", edit: (doc: any) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "interposed", label: "Interposed" });
    doc.combat.conditions.push({ condition: "interposed", coverFor: { tier: "half", who } });
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown) => parseRulesetDefinition(doc);
  const definitionOf = (who: "source" | "caller"): RulesetDefinition => {
    const parsed = parse(document(who));
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };

  const noCover = parse(document("caller", (doc) => delete doc.combat.cover));
  assert.ok(!noCover.ok && noCover.issues.some((one) => one.includes('"coverFor" gives cover')));

  const creature = (): RulesetStatBlock =>
    ({
      health: 50,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "slam", name: "Slam", budget: "action", toHit: 5, damage: { count: 0, sides: 0, flat: 3 }, reach: 1 },
      ],
    }) as RulesetStatBlock;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    fields: { level: 9, ac: 12, speed: 30, hp_max: 60 },
  });
  const grid: TacticalGrid = {
    width: 8,
    height: 3,
    tiles: Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => "plains" as const)),
  };
  /** The caster, their hand off to one side (not in the way), and a wolf the hand stands before. */
  const fight = (definition: RulesetDefinition, board = true): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build, live: {} },
        { id: "ally", name: "Ally", side: "party", block: creature() },
        { id: "hand", name: "Hand", side: "party", block: creature() },
        { id: "wolf", name: "Wolf", side: "enemy", block: creature() },
      ],
      ...(board
        ? {
            board: {
              grid,
              placements: { mage: { x: 0, y: 1 }, ally: { x: 1, y: 0 }, hand: { x: 6, y: 2 }, wolf: { x: 3, y: 1 } },
            },
          }
        : {}),
    } as never);
    rulesetCombatant(state, "hand")!.calledBy = "mage";
    return state;
  };
  const interpose = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "wolf")!.tracked.push({ condition: "interposed", rounds: null, source: "hand" });
  const coverAt = (definition: RulesetDefinition, state: RulesetEncounterState, targetId: string) =>
    rulesetDefenseAgainst(
      definition,
      definition.combat!,
      state,
      rulesetCombatant(state, targetId)!,
      rulesetCombatant(state, "wolf"),
    ).cover;

  const caller = definitionOf("caller");
  // ── Nothing in the way, no cover ──
  assert.equal(coverAt(caller, fight(caller), "mage"), 0, "open ground, no cover");
  // ── The hand before the wolf: half cover for the mage, and only the mage ──
  {
    const state = fight(caller);
    interpose(state);
    assert.equal(coverAt(caller, state, "mage"), 2, "the mage has half cover against the wolf");
    assert.equal(coverAt(caller, state, "ally"), 0, "nobody else does");
    assert.equal(coverAt(caller, state, "hand"), 0, "nor the hand itself");
    // A save against the wolf's effect, from the wolf's cell.
    assert.equal(
      rulesetCoverBonus(
        caller.combat!,
        state,
        rulesetCombatant(state, "mage")!,
        { x: 3, y: 1 },
        "save",
        undefined,
        "wolf",
      ),
      2,
      "and against the wolf's effects",
    );
    // The hand gone, the cover with it.
    rulesetCombatant(state, "hand")!.defeated = true;
    assert.equal(coverAt(caller, state, "mage"), 0, "no hand, no cover");
  }
  // ── Off a board, still ──
  {
    const state = fight(caller, false);
    interpose(state);
    assert.equal(coverAt(caller, state, "mage"), 2, "off a board too");
  }
  // ── who: "source" covers the hand, not its caller ──
  {
    const source = definitionOf("source");
    const state = fight(source);
    interpose(state);
    assert.equal(coverAt(source, state, "hand"), 2, "the applier covered");
    assert.equal(coverAt(source, state, "mage"), 0, "its caller not");
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that gives cover against its holder (coverFor) requires schemaVersion 2 and capabilityApi 1.588 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(587) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(588) as never, document()), gate);
  }

  console.log(
    "Condition coverFor: half cover for the applier's caller (or the applier) against the holder, attacks and saves, while the applier stands; on or off a board; refused without cover; gated at 1.588.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
