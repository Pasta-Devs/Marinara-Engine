/**
 * Conditions kept off by the catalog of what puts them on (Capability API 1.476).
 *
 *   - Freedom of Movement: a spell's restraint is kept off, a creature's grab is not; with no ward
 *     the spell's lands.
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
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-immunity-catalogs-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 476);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const web = {
    id: "web",
    label: "Web",
    rows: [{ list: "spells", values: { name: "Web", level: 2, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      range: 60,
      applies: [{ condition: "restrained", duration: { rounds: 10 } }],
    },
  } as unknown as RulesetCatalogEntry;
  const entries = [web];
  const freed = { conditions: ["paralyzed", "restrained"], catalogs: ["spells"] };
  const fiveE = (ward: Record<string, unknown> = freed): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "freed", label: "Freedom of Movement" });
    doc.combat.conditions.push({ condition: "freed", conditionImmunitiesFrom: [ward] });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
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
  const definition = parsed(fiveE());
  const ogre = {
    health: 60,
    defense: 8,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "grab",
        name: "Grab",
        budget: "action",
        reach: 5,
        toHit: 20,
        damage: { flat: 1 },
        applies: [{ condition: "restrained", duration: { rounds: 10 } }],
      },
    ],
  } as unknown as RulesetStatBlock;
  const fight = () => {
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
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_2: 9 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "ogre", name: "Ogre", side: "enemy", block: ogre },
      ],
      board: {
        grid: { width: 12, height: 12, tiles: Array.from({ length: 12 }, () => Array(12).fill("plains")) },
        placements: { mage: { x: 1, y: 1 }, ogre: { x: 2, y: 1 } },
      },
    });
    state.order = ["mage", "ogre"];
    state.turn = 0;
    return state;
  };
  const act = (state: RulesetEncounterState, actor: string, label: string, target: string) => {
    state.turn = state.order.indexOf(actor);
    rulesetCombatant(state, actor)!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, actor).find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: actor, optionId: option.id, targetIds: [target] },
      () => 10,
    );
    Object.assign(state, step.state);
    return step.events;
  };
  const kept = (events: RulesetCombatEvent[]) =>
    events.some((one) => one.type === "condition" && one.reason === "immune" && one.condition === "restrained");
  const restrained = (state: RulesetEncounterState, id: string) =>
    rulesetCombatant(state, id)!.tracked.some((one) => one.condition === "restrained");

  // ── A spell's restraint is kept off ──
  {
    const state = fight();
    rulesetCombatant(state, "ogre")!.tracked.push({ condition: "freed", rounds: null });
    const events = act(state, "mage", "Web", "ogre");
    assert.ok(kept(events), JSON.stringify(events.map((one) => one.type)));
    assert.equal(restrained(state, "ogre"), false);
  }
  // ── Unwarded, it lands ──
  {
    const state = fight();
    act(state, "mage", "Web", "ogre");
    assert.equal(restrained(state, "ogre"), true);
  }
  // ── A creature's grab is no spell ──
  {
    const state = fight();
    rulesetCombatant(state, "mage")!.tracked.push({ condition: "freed", rounds: null });
    const events = act(state, "ogre", "Grab", "mage");
    assert.equal(kept(events), false);
    assert.equal(restrained(state, "mage"), true, "the grab holds");
  }

  // ── Refusals ──
  refused(fiveE({ conditions: ["restrained"], catalogs: ["scrolls"] }), /Unknown catalog "scrolls"/);
  refused(fiveE({ conditions: ["restrained"] }), /conditionImmunitiesFrom/);
  refused(fiveE({ conditions: ["restrained"], catalogs: [] }), /catalogs/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions are kept off by the catalog of what puts them on (conditionImmunitiesFrom catalogs) requires schemaVersion 2 and capabilityApi 1.476 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(475) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(476) as never, fiveE()), gate);
    const byWho = fiveE({ conditions: ["restrained"], from: { types: ["humanoid"] } });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(475) as never, byWho), gate, "from alone is 1.191's");
  }

  console.log(
    "Immunity catalogs: Freedom of Movement keeps a spell's restraint off, not a creature's grab; refusals; gated at 1.476.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
