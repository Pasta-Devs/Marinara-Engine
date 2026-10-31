/**
 * A fall made safe only up to a height, and not while some conditions hold (Capability API 1.650):
 * 5e's Cat's Grace.
 *
 *   - A shove off a 20-foot ledge does no harm to a holder safe up to 20 feet, and leaves them
 *     standing; safe only up to 15, or incapacitated, it lands as any fall.
 *   - What import refuses, and the install gate.
 */
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_PASS_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  readRulesetLive,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-falls-up-to-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { rulesetWindowTargetOf } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 650);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const feather = (reaction: Record<string, unknown> = { on: "falls" }, targets = "ally") => ({
    id: "feather-fall",
    label: "Feather Fall",
    rows: [{ list: "spells", values: { name: "Feather Fall", level: 1, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets,
      range: 60,
      budget: "reaction",
      cost: [{ pool: "slots_1", amount: 1 }],
      reaction,
      applies: [{ condition: "feather_falling", duration: { rounds: 10 } }],
    },
  });
  const document = (graceful: Record<string, unknown> = { upTo: 20, unless: ["incapacitated"] }) => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.live.conditions.push({ id: "graceful", label: "Cat's Grace" });
    doc.combat.conditions.push({ condition: "graceful", effects: [], fallsSafely: graceful });
    doc.combat.elevation = {
      levelHeight: 5,
      falling: { per: 10, dice: { count: 1, sides: 6 }, max: 20, type: "bludgeoning", prone: "prone" },
    };
    doc.sheet.live.conditions.push({ id: "feather_falling", label: "Feather falling" });
    doc.combat.conditions.push({ condition: "feather_falling", fallsSafely: true });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [feather()] });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, "the file should be refused");
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  let definition = parsed(document());
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 4, damage: { flat: 1 } }],
    ...extra,
  });
  const fight = (entry = feather(), casterAt = 3): RulesetEncounterState => {
    const spell = entry as unknown as RulesetCatalogEntry;
    return createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "snag", name: "Snag", side: "enemy", block: block({ initiativeModifier: 20 }) },
        {
          id: "brenna",
          name: "Brenna",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
          catalogs: {},
        },
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_1: 4 },
            lists: { spells: rowsFromCatalogEntry("spells", spell).map((row) => row.row) },
          }),
          live: {},
          catalogs: { spells: [spell] },
        },
      ],
      board: {
        grid: { width: 20, height: 1, tiles: [Array(20).fill("plains")], elevation: [[4, 4, ...Array(18).fill(0)]] },
        placements: { snag: { x: 0, y: 0 }, brenna: { x: 1, y: 0 }, corwin: { x: casterAt, y: 0 } },
      },
    });
  };
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice, faces: number[] = []) => {
    let index = 0;
    const step = applyRulesetCombatChoice(definition, state, choice, (sides) => {
      assert.ok(index < faces.length, `no die left for d${sides}`);
      return faces[index++]!;
    });
    assert.equal(
      step.events.find((event) => event.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const shove = (state: RulesetEncounterState, label = "Shove away", target = "brenna") => {
    const option = rulesetCombatOptions(definition, state, "snag").find((one) => one.label === label);
    assert.ok(option, `Snag has ${label}`);
    return act(state, { actorId: "snag", optionId: option.id, targetIds: [target] }, [18, 1, 3, 4]);
  };
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const who = (state: RulesetEncounterState, id = "brenna") => rulesetCombatant(state, id)!;

  const landing = (graceful: Record<string, unknown>, also: string[] = []) => {
    definition = parsed(document(graceful));
    const state = fight();
    who(state, "corwin").actions = [];
    who(state).tracked.push({ condition: "graceful", rounds: 10 });
    for (const condition of also) who(state).tracked.push({ condition, rounds: 10 });
    const landed = shove(state);
    return {
      harmed: eventsOf(landed.events, "damage").length > 0,
      prone: rulesetCombatConditions(definition, who(landed.state)).includes("prone"),
      fell: eventsOf(landed.events, "fell").map((one) => one.levels),
    };
  };

  // ── Twenty feet, safe up to twenty ──
  {
    const safe = landing({ upTo: 20, unless: ["incapacitated"] });
    assert.deepEqual(safe.fell, [4], "four levels of five feet");
    assert.equal(safe.harmed, false);
    assert.equal(safe.prone, false);
  }

  // ── Higher than it keeps safe ──
  assert.equal(landing({ upTo: 15 }).harmed, true);

  // ── Incapacitated ──
  assert.equal(landing({ upTo: 20, unless: ["incapacitated"] }, ["incapacitated"]).harmed, true);

  // ── What import refuses ──
  refused(document({ upTo: 20, unless: ["nonsense"] }), /Unknown condition "nonsense"/);
  refused(document({ upTo: 0 }), /fallsSafely/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a fall made safe only up to a height (fallsSafely.upTo) requires schemaVersion 2 and capabilityApi 1.650 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(649) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(650) as never, document()), gate);
  }

  console.log("Cat's Grace: a fall no higher than 20 feet does no harm unless incapacitated; gated at 1.650.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
