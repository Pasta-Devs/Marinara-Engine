/**
 * Wish's stress (Capability API 1.646).
 *
 *   - `harms.at: "casts"`: each spell its holder casts deals 1d10 necrotic per level it was cast at
 *     (`perLevel`), past resistance (`unblockable`); a catalog it does not name, nothing.
 *   - `forbids.entries`: Wish lost is not offered.
 *   - An `applies` line's `chance`: put on only on a d100 of 33 or lower.
 *   - What import refuses, and the install gate.
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
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-casting-stress-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 646);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, level: number, more: Record<string, unknown> = {}) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: {
        kind: "attack",
        autoHit: true,
        damageType: "fire",
        range: 120,
        amount: { flat: 5 },
        ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}),
        ...more,
      },
    }) as unknown as RulesetCatalogEntry;
  const spells = [
    spell("bolt", 1),
    spell("great", 7),
    spell("spark", 0),
    spell("wish", 1, {
      appliesSelf: [{ condition: "wish_lost", duration: "until-dispelled", chance: 33 }],
    }),
  ];
  const stress = {
    at: "casts",
    catalogs: ["spells"],
    dice: "1d10",
    type: "necrotic",
    perLevel: true,
    unblockable: true,
  };
  const document = (harms: Record<string, unknown> = stress): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "stressed", label: "Stressed" },
      { id: "wish_lost", label: "Wish Lost" },
      { id: "warded", label: "Warded" },
    );
    doc.combat.conditions.push(
      { condition: "stressed", effects: [], harms },
      { condition: "wish_lost", effects: [], forbids: { entries: ["spells/great"] } },
      { condition: "warded", effects: ["resist-all"] },
    );
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
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
  const roll =
    (d100: number): RulesetCombatRoller =>
    (sides) =>
      sides === 100 ? d100 : sides === 10 ? 4 : 10;
  const fight = (holds: string[]): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll(50),
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
            fields: {
              level: 17,
              ac: 12,
              speed: 30,
              hp_max: 300,
              spellcasting_ability: "int",
              slots_max_1: 4,
              slots_max_7: 1,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        {
          id: "ogre",
          name: "Ogre",
          side: "enemy",
          block: {
            health: 100,
            defense: 5,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["mage", "ogre"];
    state.turn = 0;
    for (const condition of holds) rulesetCombatant(state, "mage")!.tracked.push({ condition } as never);
    return state;
  };
  const option = (state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
  const cast = (state: RulesetEncounterState, label: string, d100 = 50) => {
    const offered = option(state, label);
    assert.ok(offered, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: offered.id, targetIds: ["ogre"] },
      roll(d100),
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const mageHarm = (events: RulesetCombatEvent[]) =>
    of(events, "damage")
      .filter((one) => one.targetId === "mage")
      .map((one) => one.dealt);

  // ── 1d10 per level, past resistance ──
  {
    assert.deepEqual(mageHarm(cast(fight(["stressed"]), "Bolt").events), [4], "a 1st-level spell, 1d10");
    assert.deepEqual(mageHarm(cast(fight(["stressed"]), "Great").events), [28], "a 7th, 7d10");
    assert.deepEqual(mageHarm(cast(fight(["stressed"]), "Spark").events), [], "a cantrip, no level, nothing");
    assert.deepEqual(mageHarm(cast(fight(["stressed", "warded"]), "Great").events), [28], "not reduced");
    assert.deepEqual(mageHarm(cast(fight([]), "Great").events), [], "without the stress, nothing");
  }

  // ── Wish lost: not offered ──
  {
    assert.ok(option(fight([]), "Great"));
    assert.equal(option(fight(["wish_lost"]), "Great"), undefined);
    assert.ok(option(fight(["wish_lost"]), "Bolt"), "every other spell still is");
  }

  // ── A 33 in 100 chance ──
  {
    const held = (state: RulesetEncounterState) =>
      rulesetCombatant(state, "mage")!.tracked.some((one) => one.condition === "wish_lost");
    assert.equal(held(cast(fight([]), "Wish", 50).state), false, "a 50 keeps it");
    assert.equal(held(cast(fight([]), "Wish", 33).state), true, "a 33 loses it");
  }

  // ── What import refuses ──
  {
    const refused = (harms: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(document(harms));
      assert.ok(!result.ok);
      assert.match(result.issues.join("; "), pattern);
    };
    refused({ ...stress, catalogs: undefined }, /names the "catalogs" cast from/);
    refused({ at: "turn-start", dice: "1d10", perLevel: true }, /"perLevel" counts the level/);
    refused({ ...stress, catalogs: ["gear"] }, /Unknown catalog "gear"/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with harm for casting, a condition put on by chance or an entry stopped by name (harms.at casts, applies[].chance, forbids.entries) requires schemaVersion 2 and capabilityApi 1.646 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(645) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(646) as never, document()), gate);
  }

  console.log(
    "Casting stress: 1d10 per level cast, past resistance; a lost Wish not offered; lost on 33 in 100; gated at 1.646.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
