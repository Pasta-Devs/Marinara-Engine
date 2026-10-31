/**
 * Temporary points as a foe drops (Capability API 1.412).
 *
 *   - Dark One's Blessing: a warlock's level grants Charisma modifier + level as the foe they cut down
 *     drops; the log says so.
 *   - A foe somebody else finished is not theirs.
 *   - A creature reads a `const` off a condition it holds.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-fells-grant-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 412);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.derived.push(
      { id: "fiend_level", label: "Fiend warlock level", op: "sum", of: [{ field: "level" }] },
      {
        id: "dark_ones_blessing",
        label: "Dark One's Blessing",
        op: "sum",
        of: [{ abilityMod: "cha" }, { field: "level" }],
      },
    );
    doc.combat.levels.push({
      derived: "fiend_level",
      at: 1,
      fellsGrant: { temporary: { derived: "dark_ones_blessing" } },
    });
    doc.sheet.live.conditions.push({ id: "gorged", label: "Gorged" });
    doc.combat.conditions.push({ condition: "gorged", effects: [], fellsGrant: { temporary: { const: 4 } } });
    edit(doc);
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
  const definition = parsed(document());
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const block = (health: number): RulesetStatBlock => ({
    health,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "blade", name: "Blade", budget: "action", toHit: 20, damage: { count: 0, sides: 0, flat: 10 } }],
  });
  const fight = (foeHealth: number): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "warlock",
          name: "Warlock",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 16 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 20 },
            lists: {
              attacks: [
                {
                  name: "Shortsword",
                  ability: "str",
                  proficient: true,
                  bonus: 0,
                  damage: "1d6",
                  damage_type: "piercing",
                  reach: 5,
                },
              ],
            },
          }),
          live: {},
        },
        { id: "ally", name: "Ally", side: "party", block: block(30) },
        { id: "foe", name: "Foe", side: "enemy", block: block(foeHealth) },
      ],
    });
    state.order = ["warlock", "ally", "foe"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const strike = (state: RulesetEncounterState, actorId: string, label: string, target: string) => {
    state.turn = state.order.indexOf(actorId);
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `no ${label} for ${actorId}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds: [target] },
      roll,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };

  // ── Dark One's Blessing: +3 Charisma and level 3 ──
  {
    const state = fight(3);
    const step = strike(state, "warlock", "Shortsword", "foe");
    assert.ok(rulesetCombatant(step.state, "foe")!.down, JSON.stringify(step.events));
    const granted = of(step.events, "temporary");
    assert.deepEqual(
      granted.map((one) => [one.targetId, one.amount]),
      [["warlock", 6]],
      JSON.stringify(step.events),
    );
  }

  // ── Somebody else finished it ──
  {
    const state = fight(5);
    const first = strike(state, "warlock", "Shortsword", "foe");
    assert.equal(rulesetCombatant(first.state, "foe")!.down ?? false, false);
    const second = strike(first.state, "ally", "Blade", "foe");
    assert.ok(rulesetCombatant(second.state, "foe")!.down);
    assert.equal(of(second.events, "temporary").length, 0, "the ally's kill, not the warlock's");
  }

  // ── A creature reads a const off a condition ──
  {
    const state = fight(30);
    rulesetCombatant(state, "foe")!.tracked.push({ condition: "gorged", rounds: null } as never);
    const ally = rulesetCombatant(state, "ally")!;
    ally.health!.value = 5;
    const step = strike(state, "foe", "Blade", "ally");
    assert.ok(rulesetCombatant(step.state, "ally")!.down);
    assert.deepEqual(
      of(step.events, "temporary").map((one) => [one.targetId, one.amount]),
      [["foe", 4]],
    );
    assert.equal(rulesetCombatant(step.state, "foe")!.health!.temp, 4);
  }

  // ── Refusals ──
  {
    refused(
      document((doc) => {
        doc.combat.levels.at(-1).fellsGrant = { temporary: { derived: "nothing_here" } };
      }),
      /nothing_here/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).fellsGrant = { temporary: { const: 4 }, extra: 1 };
      }),
      /extra/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose condition or level grants temporary points as a foe drops (fellsGrant) requires schemaVersion 2 and capabilityApi 1.412 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(411) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(412) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(411) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Fells grant: Dark One's Blessing gives 6 as the warlock's own blow drops a foe, nothing for an ally's kill; a creature's const; gated at 1.412.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
