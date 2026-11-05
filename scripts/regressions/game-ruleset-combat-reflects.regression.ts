/**
 * Turned back on a die (Capability API 1.723): a tarrasque's Reflective Carapace.
 *
 *   - A foe's entry it names, of an area shape it names, or a ranged attack roll, rolls its die: its
 *     holder is untouched, and on its top face the entry is turned back at its maker.
 *   - Anything else (a melee spell attack, a burst) lands as always.
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
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-reflects-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 723);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
    mechanics: { kind: "attack", autoHit: true, damageType: "force", ...mechanics },
  });
  const spells = [
    spell("magic-missile", "Magic Missile", { range: 120, amount: { flat: 3 } }),
    spell("ray", "Ray", { range: 60, autoHit: false, attackRoll: true, amount: { flat: 4 } }),
    spell("touch", "Touch", { range: 0, autoHit: false, attackRoll: true, amount: { flat: 5 } }),
    spell("bolt", "Bolt", {
      range: 100,
      area: { shape: "line", size: 100 },
      amount: { flat: 6 },
      save: { save: "dex_save", onSuccess: "half" },
    }),
  ] as unknown as RulesetCatalogEntry[];
  const carapace = {
    sides: 6,
    backFrom: 6,
    against: { catalogs: ["spells"], entries: ["spells/magic-missile"], area: ["line"], attackRoll: "ranged" },
  };
  const fiveE = (reflects: unknown = carapace): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "carapace", label: "Reflective Carapace" });
    doc.combat.conditions.push({ condition: "carapace", effects: [], reflects });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
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
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = (keepsOn?: string[]): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
      ...(keepsOn ? { keepsOn } : {}),
    }) as unknown as RulesetStatBlock;
  const fight = (positioned = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      ...(positioned
        ? {
            board: {
              grid: {
                width: 20,
                height: 3,
                tiles: Array.from({ length: 3 }, () => Array.from({ length: 20 }, () => "plains")),
              },
              placements: { wizard: { x: 0, y: 1 }, tarrasque: { x: 4, y: 1 }, ogre: { x: 8, y: 1 } },
            } as never,
          }
        : {}),
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        { id: "tarrasque", name: "Tarrasque", side: "enemy", block: block(["carapace"]) },
        { id: "ogre", name: "Ogre", side: "enemy", block: block() },
      ],
    });
    state.order = ["wizard", "tarrasque", "ogre"];
    state.turn = 0;
    return state;
  };
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  const cast = (label: string, face: number, at?: { x: number; y: number }) => {
    const state = fight(!!at);
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    // The d6 shows `face`; every d20 a 15.
    const roll = (sides: number) => (sides === 6 ? face : sides === 20 ? 15 : 1);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: option.id, targetIds: at ? [] : ["tarrasque"], ...(at ? { at } : {}) },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };

  // ── Magic Missile and a ranged ray: untouched on 1 to 5, turned back on a 6 ──
  for (const [label, dealt] of [
    ["Magic Missile", 3],
    ["Ray", 4],
  ] as const) {
    const untouched = cast(label, 5);
    assert.deepEqual(
      of(untouched.events, "reflected").map((one) => [one.roll, one.back, one.by]),
      [[5, false, "Reflective Carapace"]],
    );
    assert.equal(health(untouched.state, "tarrasque"), 100);
    assert.equal(health(untouched.state, "wizard"), 40);
    const back = cast(label, 6);
    assert.deepEqual(
      of(back.events, "reflected").map((one) => one.back),
      [true],
    );
    assert.equal(health(back.state, "tarrasque"), 100);
    assert.equal(health(back.state, "wizard"), 40 - dealt, `${label} turned at its caster`);
  }

  // ── A line: the tarrasque untouched, the ogre beside it caught as always ──
  {
    const step = cast("Bolt", 2, { x: 12, y: 1 });
    assert.equal(of(step.events, "reflected").length, 1);
    assert.equal(health(step.state, "tarrasque"), 100);
    assert.ok(health(step.state, "ogre") < 100);
  }

  // ── A melee spell attack lands ──
  {
    const step = cast("Touch", 6);
    assert.deepEqual(of(step.events, "reflected"), []);
    assert.equal(health(step.state, "tarrasque"), 95);
  }

  // ── Refusals and the install gate ──
  {
    refused(fiveE({ ...carapace, backFrom: 7 }), /"backFrom" is a face of the die/);
    refused(fiveE({ ...carapace, against: { catalogs: ["spells"] } }), /named by "entries", "area" or "attackRoll"/);
    refused(
      fiveE({ ...carapace, against: { ...carapace.against, catalogs: ["prayers"] } }),
      /Unknown catalog "prayers"/,
    );
    const gate =
      "A ruleset with a condition that turns entries back on a die (combat.conditions[].reflects) requires schemaVersion 2 and capabilityApi 1.723 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(722) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(723) as never, fiveE()), gate);
  }

  console.log(
    "Reflective Carapace: Magic Missile, a ranged ray and a line leave it untouched, turned back on a 6; a melee spell lands; gated at 1.723.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
