/**
 * A teleport's familiarity table (Capability API 1.670).
 *
 *   - Each familiarity row is a mode, and leaving the fight needs one; landing on the board does not.
 *   - A d100 against the row: a mishap hurts its user and everybody along and rolls again; then
 *     they leave, the log saying each roll and what came of it.
 *   - A permanent circle never goes wrong.
 *   - Import refusals and the install gate.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-teleport-familiarity-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 670);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const table = {
    familiarity: [
      { id: "circle", label: "Permanent circle", mishap: 0 },
      { id: "casual", label: "Seen casually", mishap: 33, similar: 10, off: 10 },
    ],
    mishap: { dice: "3d10", type: "force" },
  };
  const teleport = spell("teleport", {
    kind: "utility",
    teleport: { distance: 30, leaves: true, carries: 1, carriesWithin: 5, ...table },
  });
  const spells = [teleport];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
    fields: { level: 13, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_1: 4 },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const block = (): RulesetStatBlock => ({
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } }],
  });
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build, live: {}, catalogs: { spells } },
        { id: "pal", name: "Pal", side: "party", build, live: {} },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 20, height: 10, tiles: Array.from({ length: 10 }, () => Array(20).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 2 }, pal: { x: 2, y: 3 }, foe: { x: 15, y: 5 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  // Each d100 off the list in turn; every other die shows 5.
  const rolling = (hundreds: number[]) => (sides: number) => (sides === 100 ? (hundreds.shift() ?? 99) : 5);
  const go = (state: RulesetEncounterState, extra: Partial<RulesetCombatChoice>, hundreds: number[] = []) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Teleport");
    assert.ok(option, "the mage has Teleport");
    return {
      option,
      step: applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "mage", optionId: option.id, targetIds: [], ...extra },
        rolling(hundreds),
      ),
    };
  };
  const refused = (events: RulesetCombatEvent[]) => events.find((one) => one.type === "refused");
  const rolls = (events: RulesetCombatEvent[]) =>
    events.flatMap((one) =>
      one.type === "teleportRoll" ? [[one.row, one.roll, one.outcome] as [string, number, string]] : [],
    );

  // ── Each row is a mode, and leaving needs one ──
  {
    const { option, step } = go(fight(), { carries: ["pal"] });
    assert.deepEqual(
      option.modes?.map((one) => [one.id, one.label]),
      [
        ["familiar-circle", "Permanent circle"],
        ["familiar-casual", "Seen casually"],
      ],
    );
    assert.equal((refused(step.events) as { reason?: string } | undefined)?.reason, "unknown-mode");
    // Landing on the board rolls nothing.
    const landed = go(fight(), { at: option.teleport!.cells[0]! }).step;
    assert.equal(refused(landed.events), undefined, JSON.stringify(refused(landed.events)));
    assert.deepEqual(rolls(landed.events), []);
  }

  // ── A mishap hurts both travellers, then it rolls again and they leave ──
  {
    const { step } = go(fight(), { carries: ["pal"], mode: "familiar-casual" }, [3, 90]);
    assert.equal(refused(step.events), undefined, JSON.stringify(refused(step.events)));
    assert.deepEqual(rolls(step.events), [
      ["Seen casually", 3, "mishap"],
      ["Seen casually", 90, "on-target"],
    ]);
    assert.equal(hp(step.state, "mage"), 25, "3d10 force, every die a 5");
    assert.equal(hp(step.state, "pal"), 25);
    for (const id of ["mage", "pal"]) assert.equal(who(step.state, id).away?.left, true, `${id} left`);
  }

  // ── The other bands ──
  {
    const similar = go(fight(), { mode: "familiar-casual" }, [40]).step;
    assert.deepEqual(rolls(similar.events), [["Seen casually", 40, "similar"]]);
    const off = go(fight(), { mode: "familiar-casual" }, [50]).step;
    assert.deepEqual(rolls(off.events), [["Seen casually", 50, "off-target"]]);
    assert.equal(hp(off.state, "mage"), 40);
    // A permanent circle never goes wrong.
    const circle = go(fight(), { mode: "familiar-circle" }, [1]).step;
    assert.deepEqual(rolls(circle.events), [["Permanent circle", 1, "on-target"]]);
    assert.equal(who(circle.state, "mage").away?.left, true);
  }

  // ── Refusals ──
  {
    const withTeleport = (rule: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs.find((one: { id: string }) => one.id === "spells").entries = [
          spell("teleport", { kind: "utility", teleport: { distance: 30, ...rule } }),
        ];
      });
    refusedDoc(withTeleport({ ...table }), /goes with "leaves" and a "mishap"/);
    refusedDoc(withTeleport({ leaves: true, familiarity: table.familiarity }), /goes with "leaves" and a "mishap"/);
    refusedDoc(withTeleport({ leaves: true, mishap: table.mishap }), /"mishap" is what "familiarity" rolls/);
    refusedDoc(
      withTeleport({
        leaves: true,
        ...table,
        familiarity: [{ id: "a", label: "A", mishap: 60, similar: 30, off: 20 }],
      }),
      /come to no more than 100/,
    );
    refusedDoc(
      withTeleport({
        leaves: true,
        ...table,
        familiarity: [
          { id: "a", label: "A", mishap: 1 },
          { id: "a", label: "B", mishap: 2 },
        ],
      }),
      /Each familiarity has its own id/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a teleport's familiarity table (teleport.familiarity or teleport.mishap) requires schemaVersion 2 and capabilityApi 1.670 or newer";
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
    const plain = fiveE((doc) => {
      doc.catalogs.find((one: { id: string }) => one.id === "spells").entries = [
        spell("teleport", { kind: "utility", teleport: { distance: 30, leaves: true } }),
      ];
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(669) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(670) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(669) as never, plain), gate);
  }

  console.log(
    "Teleport familiarity: each row a mode needed to leave; a d100 against it, a mishap hurting every traveller and rolling again; gated at 1.670.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
