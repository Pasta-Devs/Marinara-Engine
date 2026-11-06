/**
 * Wards a condition puts on its holder (Capability API 1.520).
 *
 *   - A rakshasa keeping Limited Magic Immunity on: a 1st-level spell aimed at it is refused, a 7th
 *     reaches it, and a 1st-level burst passes it by while it catches the one beside it.
 *   - Its own spells still reach itself; refusals and the install gate.
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
  rulesetWarded,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-holder-wards-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 520);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>, level: number) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "fire", range: 120, amount: { flat: 5 }, ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const bolt = spell("bolt", { cost: [{ pool: "slots_1", amount: 1 }] }, 1);
  const great = spell("great", { cost: [{ pool: "slots_7", amount: 1 }] }, 7);
  const burst = spell("burst", { area: { shape: "burst", size: 10 }, cost: [{ pool: "slots_1", amount: 1 }] }, 1);
  const spells = [bolt, great, burst];
  const document = (wards: Record<string, unknown> = { catalogs: ["spells"], maxLevel: 6 }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "limited_magic_immunity", label: "Limited Magic Immunity" });
    doc.combat.conditions.push({ condition: "limited_magic_immunity", effects: [], wards });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
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
  const definition = parsed(document());
  const block = (keepsOn?: string[]): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
      ...(keepsOn ? { keepsOn } : {}),
    }) as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: {
              level: 13,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 4,
              slots_max_7: 1,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        { id: "rak", name: "Rakshasa", side: "enemy", block: block(["limited_magic_immunity"]) },
        { id: "imp", name: "Imp", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 20, height: 5, tiles: Array.from({ length: 5 }, () => Array(20).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 2 }, rak: { x: 10, y: 2 }, imp: { x: 11, y: 2 } },
      },
    });
    state.order = ["mage", "rak", "imp"];
    state.turn = 0;
    return state;
  };
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  const cast = (state: RulesetEncounterState, label: string, choice: Record<string, unknown>) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], ...choice },
      () => 10,
    );
  };

  // ── Low spells never reach it, a high one does ──
  {
    const state = fight();
    const mage = rulesetCombatant(state, "mage")!;
    const boltAction = mage.actions.find((one) => one.label === "Bolt")!;
    assert.ok(rulesetWarded(definition, state, mage, boltAction, rulesetCombatant(state, "rak")!));
    assert.ok(!rulesetWarded(definition, state, mage, boltAction, rulesetCombatant(state, "imp")!));
    const low = cast(state, "Bolt", { targetIds: ["rak"] });
    assert.equal(low.events.find((one) => one.type === "refused")?.type, "refused", "refused");
    assert.equal(hp(low.state, "rak"), 100);
    const high = cast(fight(), "Great", { targetIds: ["rak"] });
    assert.equal(hp(high.state, "rak"), 95, "a 7th reaches it");
    // A burst over both catches the imp only.
    const area = cast(fight(), "Burst", { at: { x: 10, y: 2 } });
    assert.equal(hp(area.state, "rak"), 100, "passed by");
    assert.equal(hp(area.state, "imp"), 95, "caught");
  }
  // ── Its own spells reach itself ──
  {
    const state = fight();
    const rak = rulesetCombatant(state, "rak")!;
    const mage = rulesetCombatant(state, "mage")!;
    const boltAction = mage.actions.find((one) => one.label === "Bolt")!;
    assert.ok(!rulesetWarded(definition, state, rak, boltAction, rak), "never from itself");
  }

  // ── Refusals ──
  refusedDoc(document({ catalogs: ["prayers"], maxLevel: 6 }), /Unknown catalog "prayers"/);
  refusedDoc(document({ catalogs: ["spells"], maxLevel: 6, maxLevelPerCostStep: 1 }), /rises by no steps/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions ward their holders from entries of a level or lower (a condition's wards) requires schemaVersion 2 and capabilityApi 1.520 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(519) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(520) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(519) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Holder wards: a rakshasa's Limited Magic Immunity refuses a 1st-level spell, lets a 7th through, and is passed by a burst that catches the one beside it; never from itself; gated at 1.520.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
