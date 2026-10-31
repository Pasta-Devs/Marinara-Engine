/**
 * A contest that takes what its target holds (Capability API 1.668): 5e's Telekinesis on "an object
 * worn or carried by a creature".
 *
 *   - Won, the first thing the target holds in a named slot (or with a named tag) lies at the
 *     caster's feet, and the log says it was taken; the target can pick it up only from there.
 *   - Lost, nothing is taken.
 *   - Refusal and the install gate.
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
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-contest-takes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 668);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (takes: Record<string, unknown> = { slots: ["hand"] }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push(
      { id: "spellcasting", label: "Spellcasting", value: { abilityMod: "int" } },
      { id: "strength", label: "Strength", value: { abilityMod: "str" } },
    );
    doc.items = {
      categories: [{ id: "weapon", label: "Weapon" }],
      slots: [{ id: "hand", label: "Hand", count: 2 }],
    };
    doc.catalogs.push(
      {
        id: "spells",
        label: "Spells",
        feeds: ["spells"],
        entries: [
          {
            id: "telekinesis-object",
            label: "Telekinesis",
            rows: [{ list: "spells", values: { name: "Telekinesis", level: 5, prepared: true } }],
            mechanics: {
              kind: "debuff",
              targets: "ally",
              budget: "action",
              range: 60,
              contest: { attacker: ["spellcasting"], defender: ["strength"], takes },
            },
          },
        ],
      },
      {
        id: "kit",
        label: "Kit",
        holds: "items",
        entries: [{ id: "mace", label: "Mace", item: { category: "weapon", slots: { hand: 1 } } }],
      },
    );
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
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const mace: RulesetSheetItem = {
    item: definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!,
    quantity: 1,
    worn: true,
    name: "Mace",
    stack: { id: "st-mace", ref: "kit/mace" },
  };
  const cast = (str: number) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 50, spellcasting_ability: "int", slots_max_5: 1 },
            lists: { spells: entries.flatMap((one) => rowsFromCatalogEntry("spells", one).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
            fields: { level: 9, ac: 16, speed: 30, hp_max: 60 },
          }),
          live: {},
          items: [mace],
        },
      ],
      board: {
        grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) },
        placements: { wizard: { x: 2, y: 4 }, cleric: { x: 10, y: 4 } },
      },
    } as never);
    state.order = ["wizard", "cleric"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Telekinesis");
    assert.ok(option, "offered");
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: option.id, targetIds: ["cleric"] },
      () => 10,
    );
  };

  // ── Won: the mace lies at the wizard's feet ──
  {
    const won = cast(6);
    assert.deepEqual(of(won.events, "refused"), []);
    assert.deepEqual(
      of(won.events, "takenAway").map((one) => [one.actorId, one.targetId, one.labels]),
      [["wizard", "cleric", ["Mace"]]],
      JSON.stringify(won.events),
    );
    const cleric = rulesetCombatant(won.state, "cleric")!;
    assert.deepEqual(
      cleric.dropped?.map((thing) => [thing.label, thing.at]),
      [["Mace", { x: 2, y: 4 }]],
    );
    // Not picked up from where the cleric stands.
    won.state.turn = won.state.order.indexOf("cleric");
    assert.equal(
      rulesetCombatOptions(definition, won.state, "cleric").some((one) => one.pickUp),
      false,
      "too far to pick up",
    );
  }
  // ── Lost: nothing taken ──
  {
    const lost = cast(20);
    assert.deepEqual(of(lost.events, "takenAway"), []);
    assert.equal(rulesetCombatant(lost.state, "cleric")!.dropped, undefined);
  }

  // ── Refused ──
  refused(document({}), /"takes" names "slots", "tags" or both/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a contest that takes what its target holds (contest.takes) requires schemaVersion 2 and capabilityApi 1.668 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(667) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(668) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(667) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Contest takes: Telekinesis won takes the cleric's mace to the wizard's feet, lost takes nothing; gated at 1.668.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
