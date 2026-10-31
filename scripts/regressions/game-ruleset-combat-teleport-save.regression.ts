/**
 * Teleporting out only past a save (Capability API 1.603): 5e's Forcecage.
 *
 *   - Zone `forbids.teleport` as `{save, difficulty: "caster"}`: one inside who teleports out throws
 *     the save against its caster's difficulty. Made, they go; failed, they stay, the use spent.
 *   - Teleporting within it, or into it, is not stopped.
 *   - A wall laid as a ring holds what it rings: out of the cage's middle saves too.
 *   - Refusals and the install gate.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-teleport-save-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 603);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const save = { save: "cha_save", difficulty: "caster" };
  const box = spell("box", "Box", {
    kind: "utility",
    budget: "action",
    area: { shape: "burst", size: 10 },
    range: 60,
    zone: { rounds: 600, triggers: [], blocks: ["spells"], forbids: { teleport: save } },
  });
  const cage = spell("cage", "Cage", {
    kind: "utility",
    budget: "action",
    area: { shape: "wall", size: 80, ring: 20, ringOnly: true },
    range: 60,
    zone: { rounds: 600, triggers: [], blocks: ["move"], forbids: { teleport: save } },
  });
  const misty = spell("misty", "Misty", { kind: "utility", budget: "bonus", teleport: { distance: 30 } });
  const fiveE = (entries: RulesetCatalogEntry[] = [box, cage, misty]): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const block = {
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  // The mage's own difficulty is 8 + 4 + 3 = 15, and their Charisma save +0.
  const caged = (which: "Box" | "Cage", face: number) => {
    const roll = (sides: number) => (sides === 20 ? face : 3);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "thug", name: "Thug", side: "enemy", block },
      ],
      board: {
        grid: { width: 20, height: 11, tiles: Array.from({ length: 11 }, () => Array(20).fill("plains")) },
        placements: { mage: { x: 8, y: 5 }, thug: { x: 18, y: 5 } },
      },
    });
    state.order = ["mage", "thug"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === which)!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at: { x: 8, y: 5 } },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    const go = (to: { x: number; y: number }) => {
      const mistyOption = rulesetCombatOptions(definition, step.state, "mage").find((one) => one.label === "Misty")!;
      assert.ok(mistyOption, "Misty offered");
      return applyRulesetCombatChoice(
        definition,
        step.state,
        { actorId: "mage", optionId: mistyOption.id, targetIds: [], at: to },
        roll,
      );
    };
    return go;
  };
  const where = (events: RulesetCombatEvent[], state: Parameters<typeof rulesetCombatant>[0]) => {
    const mage = rulesetCombatant(state, "mage")!;
    return { at: `${mage.x},${mage.y}`, saves: of(events, "save").length, held: of(events, "teleported")[0]?.heldIn };
  };

  // ── Out of the box: failed, they stay and the use is spent; made, they go ──
  {
    const failed = caged("Box", 2)({ x: 14, y: 5 });
    assert.deepEqual(of(failed.events, "refused"), []);
    assert.deepEqual(where(failed.events, failed.state), { at: "8,5", saves: 1, held: "Box" });
    assert.equal(rulesetCombatant(failed.state, "mage")!.budgets.bonus, 0, "the use is spent");
    const made = caged("Box", 18)({ x: 14, y: 5 });
    assert.deepEqual(where(made.events, made.state), { at: "14,5", saves: 1, held: undefined });
    // Within it, no save.
    const within = caged("Box", 2)({ x: 9, y: 5 });
    assert.deepEqual(where(within.events, within.state), { at: "9,5", saves: 0, held: undefined });
  }

  // ── Out of the middle of a ring ──
  {
    const failed = caged("Cage", 2)({ x: 14, y: 5 });
    assert.deepEqual(where(failed.events, failed.state), { at: "8,5", saves: 1, held: "Cage" });
    const made = caged("Cage", 18)({ x: 14, y: 5 });
    assert.equal(where(made.events, made.state).at, "14,5");
  }

  // ── Refusals ──
  refused(
    fiveE([
      spell("bad", "Bad", {
        kind: "utility",
        area: { shape: "burst", size: 10 },
        range: 60,
        zone: { rounds: 10, triggers: [], forbids: { teleport: { save: "luck_save", difficulty: "caster" } } },
      }),
    ]),
    /Unknown save "luck_save"/,
  );
  refused(
    fiveE([
      spell("bad", "Bad", {
        kind: "utility",
        area: { shape: "burst", size: 10 },
        range: 60,
        zone: { rounds: 10, triggers: [], forbids: { teleport: { save: "cha_save" } } },
      }),
    ]),
    /forbids\.teleport: Invalid input/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a zone that lets nobody teleport out of it without a save (forbids.teleport save) requires schemaVersion 2 and capabilityApi 1.603 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(602) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(603) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(602) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Teleport save: out of a box or a ring's middle only past its save, the use spent on a failure; within it freely; gated at 1.603.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
