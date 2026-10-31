/**
 * Conditions harm puts on a creature (Capability API 1.542).
 *
 *   - A flesh golem's Aversion of Fire: fire that deals it anything puts disadvantage (poisoned, in
 *     this test) on it until the end of its next turn; slashing does not, nor fire it is immune to.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-when-harmed-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 542);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hit = (id: string, label: string, damageType: string, flat: number) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
      mechanics: { kind: "attack", targets: "enemy", range: 120, autoHit: true, amount: { flat }, damageType },
    }) as unknown as RulesetCatalogEntry;
  const entries = [hit("cut", "Cut", "slashing", 10), hit("burn", "Burn", "Fire", 7)];
  const aversion = [{ by: ["fire"], applies: [{ condition: "poisoned", duration: { rounds: 1 } }] }];
  const fiveE = (whenHarmedBy: unknown = aversion, more: Record<string, unknown> = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "golem",
        label: "Flesh Golem",
        creature: {
          health: 93,
          defense: 9,
          initiativeModifier: 0,
          speed: 30,
          tier: "cr_5",
          actions: [{ id: "slam", name: "Slam", budget: "action", toHit: 7, damage: { flat: 13 }, reach: 5 }],
          whenHarmedBy,
          ...more,
        },
      });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const begin = (definition: RulesetDefinition) => {
    const golem = rulesetCreatureBlock(
      definition,
      definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "golem"),
    );
    assert.ok(golem);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "golem", name: "Flesh Golem", side: "enemy", block: golem },
      ],
      board: {
        grid: { width: 12, height: 12, tiles: Array.from({ length: 12 }, () => Array(12).fill("plains")) },
        placements: { mage: { x: 1, y: 1 }, golem: { x: 6, y: 6 } },
      },
    });
    state.order = ["mage", "golem"];
    state.turn = 0;
    return state;
  };
  const definition = parsed(fiveE());
  const cast = (from: RulesetEncounterState, label: string, rules = definition) => {
    from.turn = 0;
    rulesetCombatant(from, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(rules, from, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      rules,
      from,
      { actorId: "mage", optionId: option.id, targetIds: ["golem"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const hp = (from: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(from, "golem")!).value;

  const holds = (from: RulesetEncounterState) => rulesetCombatant(from, "golem")!.tracked.map((one) => one.condition);

  // ── Slashing: nothing put on; fire: poisoned, to the end of its next turn ──
  const cut = cast(begin(definition), "Cut");
  assert.deepEqual(holds(cut.state), []);
  const burnt = cast(cut.state, "Burn");
  assert.deepEqual(holds(burnt.state), ["poisoned"]);
  assert.equal(hp(burnt.state), 76, "and the fire still hurts");

  // ── Immune to fire: nothing dealt, nothing put on ──
  {
    const immune = parsed(fiveE(aversion, { immune: ["fire"] }));
    const burnt = cast(begin(immune), "Burn", immune);
    assert.deepEqual(holds(burnt.state), []);
  }

  // ── Refusals ──
  refused(
    fiveE([{ by: ["fire"], applies: [{ condition: "smouldering", duration: { rounds: 1 } }] }]),
    /Unknown condition "smouldering"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature that harm puts conditions on (whenHarmedBy) requires schemaVersion 2 and capabilityApi 1.542 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(541) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(542) as never, fiveE()), gate);
  }

  console.log(
    "When harmed by: a flesh golem burnt is put off by fire to the end of its next turn, not when cut or immune; an unknown condition refused; gated at 1.542.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
