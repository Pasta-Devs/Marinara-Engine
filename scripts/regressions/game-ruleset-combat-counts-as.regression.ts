/**
 * A condition that counts as another (Capability API 1.585): Enthrall as charmed.
 *
 *   - An immunity to charmed keeps enthralled off.
 *   - What holds charmed off holds enthralled off.
 *   - A save against enthralled is a save against charmed: Fey Ancestry's advantage reaches it.
 *   - What ends charmed ends enthralled.
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
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetImmuneToCondition,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-counts-as-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 585);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
    mechanics: { range: 60, ...mechanics },
  });
  const enthrall = spell("enthrall", "Enthrall", {
    kind: "debuff",
    save: { save: "wis_save", onSuccess: "negates" },
    applies: [{ condition: "enthralled", duration: { rounds: 10 } }],
  });
  const restore = spell("restore", "Restore", { kind: "buff", targets: "any", ends: { conditions: ["charmed"] } });
  const document = (countsAs: unknown = ["charmed"], edit: (doc: any) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    for (const id of ["enthralled", "fey", "calm"]) doc.sheet.live.conditions.push({ id, label: id });
    doc.combat.conditions.push(
      { condition: "enthralled", effects: [], ...(countsAs ? { countsAs } : {}) },
      {
        condition: "fey",
        effects: [],
        modifiers: [{ to: "saves", mode: "advantage", against: { conditions: ["charmed"] } }],
      },
      { condition: "calm", effects: [], suppresses: ["charmed"] },
    );
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [enthrall, restore] });
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown) => parseRulesetDefinition(doc);
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parse(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const fight = (definition: RulesetDefinition, foe: Partial<RulesetStatBlock> = {}): RulesetEncounterState => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
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
            fields: { level: 5, ac: 12, speed: 30, hp_max: 30, spellcasting_ability: "cha", slots_max_1: 9 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "elf",
          name: "Elf",
          side: "enemy",
          block: { health: 30, defense: 10, initiativeModifier: 0, speed: 30, actions: [], ...foe } as RulesetStatBlock,
        },
      ],
    });
    state.order = ["bard", "elf"];
    state.turn = 0;
    return state;
  };
  const definition = parsed(document());
  const cast = (def: RulesetDefinition, state: RulesetEncounterState, label: string, targetIds: string[]) => {
    const option = rulesetCombatOptions(def, state, "bard").find((one) => one.label === label)!;
    return applyRulesetCombatChoice(def, state, { actorId: "bard", optionId: option.id, targetIds }, () => 10);
  };

  // ── Immune to charmed, immune to it ──
  {
    const state = fight(definition, { conditionImmunities: ["charmed"] });
    assert.equal(rulesetImmuneToCondition(rulesetCombatant(state, "elf")!, "enthralled", definition, state), true);
    const plain = fight(definition);
    assert.equal(rulesetImmuneToCondition(rulesetCombatant(plain, "elf")!, "enthralled", definition, plain), false);
  }

  // ── Held off by what holds charmed off ──
  {
    const state = fight(definition);
    const elf = rulesetCombatant(state, "elf")!;
    elf.tracked.push({ condition: "enthralled", rounds: 10, source: "bard" }, { condition: "calm", rounds: 10 });
    assert.ok(
      !rulesetActiveConditions(definition, definition.combat!, elf, state).some(
        (one) => one.condition === "enthralled",
      ),
    );
  }

  // ── Fey Ancestry's advantage reaches the save ──
  {
    const saves = (def: RulesetDefinition) => {
      const state = fight(def);
      rulesetCombatant(state, "elf")!.tracked.push({ condition: "fey", rounds: null });
      return of(cast(def, state, "Enthrall", ["elf"]).events, "save");
    };
    assert.equal(saves(definition)[0]?.rolls.length, 2, "with advantage");
    assert.equal(saves(parsed(document(null)))[0]?.rolls.length, 1, "without countsAs, a plain save");
  }

  // ── What ends charmed ends it ──
  {
    const state = fight(definition);
    rulesetCombatant(state, "elf")!.tracked.push({ condition: "enthralled", rounds: 10, source: "bard" });
    const ended = cast(definition, state, "Restore", ["elf"]);
    assert.ok(!rulesetCombatant(ended.state, "elf")!.tracked.some((one) => one.condition === "enthralled"));
  }

  // ── Refusals ──
  {
    const self = parse(document(["enthralled"]));
    assert.ok(!self.ok && self.issues.some((one) => one.includes("A condition does not count as itself")));
    const unknown = parse(document(["dazzled"]));
    assert.ok(!unknown.ok && unknown.issues.some((one) => one.includes('Unknown condition "dazzled"')));
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that counts as another (countsAs) requires schemaVersion 2 and capabilityApi 1.585 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(584) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(585) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(584) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Counts as: enthralled counts as charmed for immunity, suppression, save advantage and what ends it; gated at 1.585.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
