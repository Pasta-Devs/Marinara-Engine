/**
 * A ward picked as it is cast (Capability API 1.758): 5e's Wish, "up to ten creatures you can see
 * immunity to a single spell or other magical effect for 8 hours" (a lich's life drain).
 *
 *   - Its option offers every entry and creature action anybody in the fight has, once each, and
 *     exactly one is named (`kinds`); a creature's own choice takes the first.
 *   - What it puts on wards its holder off that one alone, from anybody but themselves, whatever its
 *     level; until dispelled, the sheet keeps what it wards off for the next fight.
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
  liftRulesetFightEffects,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetLiveState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ward-pick-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 758);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
    mechanics,
  });
  const wish = (duration: unknown = { rounds: 4800 }, extra: Record<string, unknown> = {}) =>
    spell("wish", "Wish", {
      kind: "buff",
      budget: "action",
      range: 60,
      targets: "ally",
      wardPick: true,
      applies: [{ condition: "wished", duration }],
      ...extra,
    });
  const bolt = spell("bolt", "Bolt", {
    kind: "attack",
    budget: "action",
    range: 60,
    targets: "enemy",
    attackRoll: true,
    amount: { dice: "1d10" },
    damageType: "fire",
  });
  const fiveE = (entries: unknown[] = [wish(), bolt]): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "wished", label: "Wished" });
    doc.combat.conditions.push({ condition: "wished", effects: [] });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const allyBuild = rulesetSheetBuildSchema.parse({ fields: { level: 3, ac: 12, speed: 30, hp_max: 30 } });
  const fight = (definition: RulesetDefinition, allyLive: RulesetLiveState = {}): RulesetEncounterState => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 20, wis: 10, cha: 10 },
            fields: { level: 17, ac: 12, speed: 30, hp_max: 90, spellcasting_ability: "int", slots_max_1: 9 },
            lists: {
              spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
            },
          }),
          catalogs: { spells: entries },
        },
        { id: "ally", name: "Ally", side: "party", build: allyBuild, live: allyLive },
        {
          id: "lich",
          name: "Lich",
          side: "enemy",
          block: {
            health: 100,
            defense: 10,
            initiativeModifier: -20,
            speed: 30,
            actions: [
              { id: "drain", name: "Life Drain", budget: "action", toHit: 5, damage: { count: 0, sides: 0, flat: 3 } },
              { id: "claw", name: "Claw", budget: "action", toHit: 5, damage: { count: 0, sides: 0, flat: 1 } },
            ],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: { width: 8, height: 3, tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 0 }, ally: { x: 2, y: 1 }, lich: { x: 3, y: 1 } },
      },
    });
    state.order = ["mage", "ally", "lich"];
    state.turn = 0;
    return state;
  };
  // Whom the lich's action may be aimed at.
  const lichTargets = (definition: RulesetDefinition, state: RulesetEncounterState, label: string) => {
    const next = structuredClone(state);
    next.turn = next.order.indexOf("lich");
    const option = rulesetCombatOptions(definition, next, "lich").find((one) => one.label === label);
    assert.ok(option, `${label} offered`);
    return rulesetOptionTargets(definition, next, "lich", option).sort();
  };
  const cast = (definition: RulesetDefinition, state: RulesetEncounterState, kinds?: string[]) => {
    rulesetCombatant(state, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Wish")!;
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["ally"], ...(kinds ? { kinds } : {}) },
      roll,
    );
  };

  // ── Offered: every entry and creature action in the fight, once each, exactly one picked ──
  const definition = parsed(fiveE());
  {
    const state = fight(definition);
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Wish");
    assert.ok(option);
    assert.equal(option.kindsOne, true);
    assert.deepEqual(
      option.kindsOf!.map((one) => one.id),
      ["spells/bolt", "action:claw", "action:life drain"],
      "its own pick left out",
    );
    assert.deepEqual(
      of(cast(definition, fight(definition), ["action:claw", "action:life drain"]).events, "refused").length,
      1,
    );
    assert.deepEqual(of(cast(definition, fight(definition), ["action:nothing"]).events, "refused").length, 1);
  }

  // ── Picked: the life drain alone keeps off the ally, from the lich ──
  {
    const state = fight(definition);
    assert.deepEqual(lichTargets(definition, state, "Life Drain"), ["ally", "mage"]);
    const step = cast(definition, state, ["action:life drain"]);
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    assert.equal(
      rulesetCombatant(step.state, "ally")!.tracked.find((one) => one.condition === "wished")?.wardsOff,
      "action:life drain",
    );
    assert.deepEqual(lichTargets(definition, step.state, "Life Drain"), ["mage"], "warded off");
    assert.deepEqual(lichTargets(definition, step.state, "Claw"), ["ally", "mage"], "the claw still reaches");
  }
  // ── A creature's own choice takes the first ──
  {
    const step = cast(definition, fight(definition));
    assert.deepEqual(of(step.events, "refused"), []);
    assert.equal(
      rulesetCombatant(step.state, "ally")!.tracked.find((one) => one.condition === "wished")?.wardsOff,
      "spells/bolt",
    );
  }

  // ── Until dispelled: the sheet keeps it, and the next fight reads it ──
  {
    const lasting = parsed(fiveE([wish("until-dispelled"), bolt]));
    const step = cast(lasting, fight(lasting), ["action:life drain"]);
    liftRulesetFightEffects(lasting, step.state);
    const live = rulesetCombatant(step.state, "ally")!.sheet!.live as RulesetLiveState;
    assert.deepEqual(live.wardsOff, { wished: "action:life drain" });
    const next = fight(lasting, live);
    assert.deepEqual(lichTargets(lasting, next, "Life Drain"), ["mage"], "still warded");
  }

  // ── Refused ──
  refused(fiveE([spell("wish", "Wish", { kind: "buff", targets: "ally", wardPick: true })]), /"wardPick"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a ward picked as it is cast (wardPick) requires schemaVersion 2 and capabilityApi 1.758 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(757) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(758) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(757) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Ward pick: Wish wards its targets off one entry or creature action picked as it is cast, a lich's life drain but not its claw, kept on the sheet until dispelled; gated at 1.758.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
