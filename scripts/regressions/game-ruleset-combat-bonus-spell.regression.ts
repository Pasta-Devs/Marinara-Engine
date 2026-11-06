/**
 * The bonus-action spell rule (Capability API 1.710): 5e's "you can't cast another spell during the
 * same turn, except for a cantrip with a casting time of 1 action".
 *
 *   - After a spell cast with the bonus budget, only a cantrip with an action is offered that turn.
 *   - After a leveled spell with an action, no spell with the bonus budget; a second leveled one with
 *     another action still is.
 *   - A cantrip with an action first leaves a bonus-action spell open.
 *   - Without the rule, nothing is barred.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-bonus-spell-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 710);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, level: number, budget: string) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level, prepared: true } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      amount: { flat: 1 },
      damageType: "force",
      targets: "enemy",
      range: 60,
      budget,
      ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}),
    },
  });
  const spells = [
    spell("word", "Spiritual Word", 1, "bonus"),
    spell("shillelagh", "Shillelagh", 0, "bonus"),
    spell("bolt", "Fire Bolt", 0, "action"),
    spell("missile", "Magic Missile", 1, "action"),
  ];
  const rule = { catalogs: ["spells"], budget: "bonus", only: { level: 0, budget: "action" } };
  const fiveE = (afterBonusSpell: Record<string, unknown> | null = rule) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    if (afterBonusSpell) doc.combat.casting = { afterBonusSpell };
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
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (definition: RulesetDefinition): RulesetEncounterState => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 18, cha: 10 },
            fields: { level: 5, ac: 16, speed: 30, hp_max: 40, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "ogre",
          name: "Ogre",
          side: "enemy",
          block: { health: 200, defense: 11, initiativeModifier: 0, speed: 40, actions: [] } as never,
        },
      ],
    });
    state.order = ["cleric", "ogre"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const offered = (definition: RulesetDefinition, state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "cleric")
      .map((one) => one.label)
      .filter((label) => spells.some((entry) => entry.label === label))
      .sort();
  const cast = (definition: RulesetDefinition, state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "cleric").find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${offered(definition, state).join(", ")}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cleric", optionId: option.id, targetIds: ["ogre"] },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step.state;
  };
  const definition = parsed(fiveE());

  // ── After a bonus-action spell, only a cantrip with an action ──
  {
    const state = fight(definition);
    assert.deepEqual(offered(definition, state), ["Fire Bolt", "Magic Missile", "Shillelagh", "Spiritual Word"]);
    const after = cast(definition, state, "Spiritual Word");
    assert.deepEqual(offered(definition, after), ["Fire Bolt"]);
    // A bonus cantrip counts as a bonus-action spell too.
    const shill = cast(definition, fight(definition), "Shillelagh");
    assert.deepEqual(offered(definition, shill), ["Fire Bolt"]);
  }

  // ── After a leveled spell with an action, no bonus-action spell; another action's leveled one ──
  {
    const after = cast(definition, fight(definition), "Magic Missile");
    assert.deepEqual(offered(definition, after), []);
    rulesetCombatant(after, "cleric")!.budgets.action = 1;
    assert.deepEqual(offered(definition, after), ["Fire Bolt", "Magic Missile"]);
  }

  // ── A cantrip with an action first leaves the bonus-action spell open ──
  {
    const after = cast(definition, fight(definition), "Fire Bolt");
    assert.deepEqual(offered(definition, after), ["Shillelagh", "Spiritual Word"]);
    const then = cast(definition, after, "Spiritual Word");
    rulesetCombatant(then, "cleric")!.budgets.action = 1;
    assert.deepEqual(offered(definition, then), ["Fire Bolt"]);
  }

  // ── Without the rule, nothing is barred ──
  {
    const plain = parsed(fiveE(null));
    const after = cast(plain, fight(plain), "Spiritual Word");
    assert.deepEqual(offered(plain, after), ["Fire Bolt", "Magic Missile"]);
  }

  // ── Refusals ──
  refused(fiveE({ ...rule, catalogs: ["prayers"] }), /Unknown catalog "prayers"/);
  refused(fiveE({ ...rule, budget: "swift" }), /Unknown budget "swift"/);
  refused(fiveE({ ...rule, only: { level: 0, budget: "bonus" } }), /another budget than the one it follows/);
  refused(fiveE({ ...rule, only: { budget: "action" } }), /level/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with the bonus-action spell rule (combat.casting.afterBonusSpell) requires schemaVersion 2 and capabilityApi 1.710 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(709) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(710) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(709) as never, fiveE(null)), gate);
  }

  console.log(
    "Bonus-action spell rule: after Spiritual Word or Shillelagh only Fire Bolt; after Magic Missile no bonus-action spell, another Magic Missile with another action; Fire Bolt first leaves Spiritual Word open; gated at 1.710.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
