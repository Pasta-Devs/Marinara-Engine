/**
 * A heal shared out among its targets (Capability API 1.563): 5e's Preserve Life.
 *
 *   - `sharesHeal: "half"`: one amount, shared out in the order the targets were picked, nobody past
 *     half their maximum; one already there gets nothing.
 *   - `sharesHeal: true`: up to each one's maximum.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-shared-heal-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 563);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const entry = (shares: unknown, more: Record<string, unknown> = {}) => ({
    id: "preserve-life",
    label: "Preserve Life",
    rows: [{ list: "spells", values: { name: "Preserve Life", level: 1, prepared: true } }],
    mechanics: {
      kind: "heal",
      targets: "ally",
      targetCount: 3,
      budget: "action",
      range: 30,
      amount: { flat: 25 },
      sharesHeal: shares,
      ...more,
    },
  });
  const document = (shares: unknown = "half", more?: Record<string, unknown>) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [entry(shares, more)] });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const ally = (max: number): RulesetStatBlock =>
    ({ health: max, defense: 10, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const cast = (shares: unknown) => {
    const definition = parsed(document(shares));
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: entries.flatMap((one) => rowsFromCatalogEntry("spells", one).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        { id: "a", name: "A", side: "party", block: ally(40) },
        { id: "b", name: "B", side: "party", block: ally(40) },
        { id: "c", name: "C", side: "party", block: ally(30) },
        { id: "foe", name: "Foe", side: "enemy", block: ally(30) },
      ],
    });
    state.order = ["cleric", "a", "b", "c", "foe"];
    state.turn = 0;
    rulesetCombatant(state, "a")!.health = { value: 20, max: 40, temp: 0 };
    rulesetCombatant(state, "b")!.health = { value: 2, max: 40, temp: 0 };
    rulesetCombatant(state, "c")!.health = { value: 10, max: 30, temp: 0 };
    const option = rulesetCombatOptions(definition, state, "cleric").find((one) => one.label === "Preserve Life")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cleric", optionId: option.id, targetIds: ["a", "b", "c"] } as never,
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    return Object.fromEntries(["a", "b", "c"].map((id) => [id, rulesetCombatant(step.state, id)!.health!.value]));
  };

  // ── Up to half: A is there already, B takes 18, C what is left ──
  assert.deepEqual(cast("half"), { a: 20, b: 20, c: 15 });
  // ── Up to each one's maximum: A takes 20, B the last 5 ──
  assert.deepEqual(cast(true), { a: 40, b: 7, c: 10 });

  // ── Refusals ──
  {
    const doc = document("half");
    doc.catalogs.at(-1).entries[0].mechanics.kind = "buff";
    refused(doc, /"sharesHeal" shares out what it heals/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a heal shared out among its targets (sharesHeal) requires schemaVersion 2 and capabilityApi 1.563 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(562) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(563) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(562) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Shared heal: Preserve Life shares one amount, nobody past half their maximum; or up to each maximum; gated at 1.563.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
