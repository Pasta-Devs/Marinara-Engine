/**
 * A save rolled with advantage by a target being fought (Capability API 1.582): Charm Person.
 *
 *   - `save.advantageIfFought`: a target on a side hostile to the caster's rolls twice and keeps the
 *     better; one on the caster's own side rolls once.
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
  rowsFromCatalogEntry,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-save-if-fought-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 582);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const charm = {
    id: "charm",
    label: "Charm",
    rows: [{ list: "spells", values: { name: "Charm", level: 1, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "any",
      range: 60,
      save: { save: "wis_save", onSuccess: "negates", advantageIfFought: true },
      applies: [{ condition: "charmed", duration: { rounds: 10 } }],
    },
  };
  const document = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [structuredClone(charm)] });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = {
    health: 30,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "bard",
        name: "Bard",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
          fields: { level: 3, ac: 12, speed: 30, hp_max: 30, spellcasting_ability: "cha", slots_max_1: 9 },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        catalogs: { spells: entries },
      },
      { id: "guard", name: "Guard", side: "enemy", block },
      { id: "squire", name: "Squire", side: "party", block },
    ],
  });
  state.order = ["bard", "guard", "squire"];
  state.turn = 0;
  const option = rulesetCombatOptions(definition, state, "bard").find((one) => one.label === "Charm")!;
  const cast = (targetId: string) =>
    of(
      applyRulesetCombatChoice(
        definition,
        structuredClone(state),
        { actorId: "bard", optionId: option.id, targetIds: [targetId] },
        () => 10,
      ).events,
      "save",
    );

  // ── The guard, being fought: two dice ──
  const guard = cast("guard");
  assert.equal(guard.length, 1);
  assert.equal(guard[0]!.rolls.length, 2, "advantage");
  // ── The squire, a companion: one ──
  const squire = cast("squire");
  assert.equal(squire.length, 1);
  assert.equal(squire[0]!.rolls.length, 1, "no advantage");

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a save rolled with advantage by a target being fought (advantageIfFought) requires schemaVersion 2 and capabilityApi 1.582 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(581) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(582) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(581) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Save if fought: Charm Person's save is made with advantage by a foe, not by a companion; gated at 1.582.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
