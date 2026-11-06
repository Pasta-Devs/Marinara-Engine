/**
 * A zone stage that shakes concentration and is a wind (Capability API 1.580): Storm of Vengeance,
 * rounds 5-10.
 *
 *   - `breaksConcentration`: whoever starts a turn inside while the stage lasts rolls the
 *     concentration save, at the entry's own difficulty, or loses it. Not before the stage begins.
 *   - `disperses`: fog the storm reaches is blown away once the stage begins, and not before.
 *   - Refusal without concentration, and the install gate.
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
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-stage-wind-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 580);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "utility", area: { shape: "burst", size: 10 }, range: 120, ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const wind = { from: 2, label: "Wind", breaksConcentration: true, disperses: true };
  const fog = spell("fog", { zone: { rounds: 100, triggers: [], obscures: { dispersed: true } } });
  const storm = (stage: Record<string, unknown> = wind) =>
    spell("storm", { zone: { rounds: 100, triggers: [], stages: [stage] } });
  const fiveE = (stage?: Record<string, unknown>, edit: (doc: any) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [fog, storm(stage)] });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const roll = () => 2;
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = {
    health: 50,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  let state: RulesetEncounterState = createRulesetEncounter({
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
          fields: { level: 17, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        catalogs: { spells: entries },
      },
      { id: "shaman", name: "Shaman", side: "enemy", block },
    ],
    board: {
      grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) },
      placements: { mage: { x: 1, y: 4 }, shaman: { x: 10, y: 4 } },
    },
  });
  state.order = ["mage", "shaman"];
  state.turn = 0;
  rulesetCombatant(state, "shaman")!.concentrating = { actionId: "hex", label: "Hex" } as never;
  const step = (choice: Record<string, unknown>) => {
    const taken = applyRulesetCombatChoice(definition, state, { targetIds: [], ...choice } as never, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(of(taken.events, "refused")));
    state = taken.state;
    return taken.events;
  };
  const cast = (label: string) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label)!;
    return step({ actorId: "mage", optionId: option.id, at: { x: 10, y: 4 } });
  };
  const fogs = () => (rulesetCombatant(state, "mage")!.zones ?? []).filter((zone) => zone.label === "Fog").length;

  // ── Fog, then the storm over it: before its stage, no wind and no shaking ──
  cast("Fog");
  step({ actorId: "mage", optionId: "end-turn" });
  step({ actorId: "shaman", optionId: "end-turn" });
  cast("Storm");
  {
    const events = step({ actorId: "mage", optionId: "end-turn" });
    assert.deepEqual(of(events, "concentration"), [], "no stage yet");
    assert.equal(fogs(), 1, "the fog stands");
    assert.ok(rulesetCombatant(state, "shaman")!.concentrating);
  }

  // ── Its stage begins as the mage's turn does: the fog is blown away ──
  {
    const events = step({ actorId: "shaman", optionId: "end-turn" });
    assert.ok(events.some((one) => one.type === "zone" && one.outcome === "stage" && one.layer === "Wind"));
    assert.ok(events.some((one) => one.type === "zone" && one.outcome === "dispersed" && one.label === "Fog"));
    assert.equal(fogs(), 0);
  }

  // ── The shaman starts its turn inside: its concentration save fails ──
  {
    const events = step({ actorId: "mage", optionId: "end-turn" });
    assert.ok(of(events, "save").some((one) => one.actorId === "shaman" && !one.success));
    assert.ok(!rulesetCombatant(state, "shaman")!.concentrating, "concentration lost");
  }

  // ── Refused without concentration ──
  {
    const result = parseRulesetDefinition(fiveE(wind, (doc) => delete doc.combat.concentration));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /Nothing here is held by concentration to break/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a zone stage that breaks concentration or disperses fog (stages breaksConcentration, disperses) requires schemaVersion 2 and capabilityApi 1.580 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(579) as never, fiveE()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(579) as never, fiveE({ from: 2, label: "Gust", disperses: true })),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(580) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(579) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Stage wind: from its stage on, a storm blows fog away and shakes the concentration of whoever starts a turn inside; gated at 1.580.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
