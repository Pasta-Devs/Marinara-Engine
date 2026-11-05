/**
 * A contest's `takes` as a mode of its own (Capability API 1.692): 5e's Telekinesis, one cast either
 * pulling an object a creature holds or moving the creature, and a repeat keeping its grip on the same.
 *
 *   - Cast in the takes mode, a win takes the mace and does nothing else: no condition goes on.
 *   - Cast with no mode, or in the rest mode, a win puts the condition on and takes nothing.
 *   - The repeat is offered only in the mode the cast was made in, and made in it when none is named.
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
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-takes-mode-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 692);
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
              concentration: true,
              repeats: { budget: "bonus" },
              contest: {
                attacker: ["spellcasting"],
                defender: ["strength"],
                takes,
                takesMode: { label: "Object", restLabel: "Creature" },
              },
              applies: [{ condition: "restrained", duration: { rounds: 1 } }],
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
  const fight = (str: number) => {
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
    return state;
  };
  const cast = (state: RulesetEncounterState, mode?: string, again = false) => {
    const option = rulesetCombatOptions(definition, state, "wizard").find(
      (one) => one.label === "Telekinesis" && one.id.endsWith(":again") === again,
    );
    assert.ok(option, again ? "the repeat offered" : "offered");
    return {
      option,
      ...applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "wizard", optionId: option.id, targetIds: ["cleric"], ...(mode ? { mode } : {}) },
        () => 10,
      ),
    };
  };
  const restrained = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "cleric")!.tracked.some((one) => one.condition === "restrained");
  // Repeated on a bonus action here, so in the same turn as the cast.
  const nextTurn = (state: RulesetEncounterState) => state;

  // ── Offered both ways ──
  {
    const first = rulesetCombatOptions(definition, fight(6), "wizard").find((one) => one.label === "Telekinesis");
    assert.deepEqual(
      first?.modes?.map((one) => one.id),
      ["contest-rest", "contest-takes"],
    );
  }
  // ── The object: taken, and nothing else ──
  {
    const won = cast(fight(6), "contest-takes");
    assert.deepEqual(of(won.events, "refused"), []);
    assert.deepEqual(
      of(won.events, "takenAway").map((one) => [one.actorId, one.targetId, one.labels]),
      [["wizard", "cleric", ["Mace"]]],
    );
    assert.equal(restrained(won.state), false, "no condition in the object mode");
    assert.equal(rulesetCombatant(won.state, "wizard")!.concentrating?.mode, "contest-takes");
    // The repeat: only the object again.
    const later = nextTurn(won.state);
    const again = rulesetCombatOptions(definition, later, "wizard").find(
      (one) => one.label === "Telekinesis" && one.id.endsWith(":again"),
    );
    assert.ok(again, "the repeat is offered");
    assert.deepEqual(
      again.modes?.map((one) => one.id),
      ["contest-takes"],
      "only the mode the cast was made in",
    );
    const refusedMode = applyRulesetCombatChoice(
      definition,
      later,
      { actorId: "wizard", optionId: again.id, targetIds: ["cleric"], mode: "contest-rest" },
      () => 10,
    );
    assert.equal(of(refusedMode.events, "refused")[0]?.reason, "unknown-mode");
    const kept = cast(later, undefined, true);
    assert.deepEqual(of(kept.events, "refused"), []);
    assert.equal(restrained(kept.state), false, "the repeat is made in the object mode");
  }
  // ── The creature, with no mode named: the condition, and nothing taken ──
  {
    const won = cast(fight(6));
    assert.deepEqual(of(won.events, "refused"), []);
    assert.deepEqual(of(won.events, "takenAway"), []);
    assert.equal(restrained(won.state), true);
    assert.equal(rulesetCombatant(won.state, "wizard")!.concentrating?.mode, "contest-rest");
    const later = nextTurn(won.state);
    const again = rulesetCombatOptions(definition, later, "wizard").find(
      (one) => one.label === "Telekinesis" && one.id.endsWith(":again"),
    );
    assert.deepEqual(
      again?.modes?.map((one) => one.id),
      ["contest-rest"],
    );
    const kept = cast(later, undefined, true);
    assert.deepEqual(of(kept.events, "takenAway"), [], "the repeat takes nothing in the creature mode");
  }
  // ── Lost: nothing taken ──
  {
    const lost = cast(fight(20), "contest-takes");
    assert.deepEqual(of(lost.events, "takenAway"), []);
  }

  // ── Refused ──
  {
    const bare = document();
    delete bare.catalogs.at(-2).entries[0].mechanics.contest.takes;
    refused(bare, /"takesMode" picks "takes" as a mode, so it needs "takes"/);
    const twice = document();
    twice.catalogs.at(-2).entries[0].mechanics.applies.push({ condition: "prone", duration: { rounds: 1 } });
    twice.catalogs.at(-2).entries[0].mechanics.appliesOneOf = true;
    refused(twice, /"takesMode" is picked as a mode/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a contest whose takes is a mode of its own (contest.takesMode) requires schemaVersion 2 and capabilityApi 1.692 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(691) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(692) as never, document()), gate);
  }

  console.log(
    "Takes mode: Telekinesis pulls the mace or holds the cleric, one cast either way, its repeat keeping the same; gated at 1.692.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
