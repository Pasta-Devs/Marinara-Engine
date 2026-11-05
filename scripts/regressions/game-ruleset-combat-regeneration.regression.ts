/**
 * Health regained as a turn starts (Capability API 1.396).
 *
 *   - A creature's `regenerates`: a troll's 10 at the start of its turn, none at the start of the
 *     turn after fire or acid harmed it.
 *   - `keepsUp`: at 0 the troll is down, not out, and is out only if it starts its turn at 0 and
 *     does not regenerate.
 *   - A condition's `regenerates` with `add` off the sheet, `atMostHalf` and `notAtZero`: 5e's
 *     Survivor, 5 plus the Constitution modifier at half health or less.
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
  rulesetCombatHealth,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-regeneration-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 396);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const troll = {
    id: "troll",
    label: "Troll",
    creature: {
      health: 84,
      defense: 15,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_5",
      regenerates: { flat: 10, stoppedBy: ["fire", "acid"], keepsUp: true },
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 7, damage: { flat: 11 }, reach: 5 }],
    },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures").entries.push(troll);
    doc.sheet.live.conditions.push({ id: "survivor", label: "Survivor" });
    doc.combat.conditions.push({
      condition: "survivor",
      effects: [],
      regenerates: { flat: 5, add: { abilityMod: "con" }, atMostHalf: true, notAtZero: true },
    });
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
  const trollBlock = rulesetCreatureBlock(
    definition,
    definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!.find((one) => one.id === "troll"),
  )!;
  const roll = () => 10;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const blaster = (amount: number, type: string): RulesetStatBlock => ({
    health: 100,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      { name: "Blast", budget: "action", toHit: 30, damage: { count: 0, sides: 0, flat: amount, type }, reach: 120 },
    ],
  });
  const fight = (hero: RulesetStatBlock): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "hero", name: "Hero", side: "enemy", block: hero },
        { id: "troll", name: "Troll", side: "enemy", block: trollBlock },
      ],
    });
    rulesetCombatant(state, "hero")!.side = "party";
    state.order = ["hero", "troll"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const step = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const taken = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return taken;
  };
  const blast = (state: RulesetEncounterState) =>
    step(state, { actorId: "hero", optionId: who(state, "hero").actions[0]!.id, targetIds: ["troll"] });
  const endHero = (state: RulesetEncounterState) =>
    step(state, { actorId: "hero", optionId: "end-turn", targetIds: [] });

  // ── Regeneration: 10 as its turn starts, none after fire ──
  {
    const hit = blast(fight(blaster(30, "slashing")));
    assert.equal(health(hit.state, "troll"), 54);
    const turned = endHero(hit.state);
    assert.deepEqual(of(turned.events, "regenerates"), [{ type: "regenerates", actorId: "troll", amount: 10 }]);
    assert.equal(health(turned.state, "troll"), 64);
    // Burned: nothing as its next turn starts, and 10 again the turn after.
    const burned = endHero(blast(fight(blaster(30, "fire"))).state);
    assert.deepEqual(of(burned.events, "regenerates"), [
      { type: "regenerates", actorId: "troll", amount: 0, stopped: true },
    ]);
    assert.equal(health(burned.state, "troll"), 54);
    let again = step(burned.state, { actorId: "troll", optionId: "end-turn", targetIds: [] }).state;
    again = endHero(again).state;
    assert.equal(health(again, "troll"), 64, "the fire is a turn old");
    // Burned, it says so; never hurt, it regains nothing and says nothing.
    assert.deepEqual(
      of(endHero(blast(fight(blaster(1, "fire"))).state).events, "regenerates").length,
      1,
      "burned: stopped",
    );
    assert.deepEqual(of(endHero(fight(blaster(30, "slashing"))).events, "regenerates"), [], "unhurt: nothing");
  }

  // ── Down at 0 but not out; out only if it cannot regenerate ──
  {
    const felled = blast(fight(blaster(200, "slashing")));
    const troll = who(felled.state, "troll");
    assert.equal(troll.down, true);
    assert.ok(!troll.defeated, "down, not out");
    assert.equal(troll.regrowing, true);
    const up = endHero(felled.state);
    assert.equal(health(up.state, "troll"), 10, "back up with its 10");
    assert.ok(!who(up.state, "troll").down);
    assert.equal(up.state.order[up.state.turn], "troll", "and its turn goes on");
    // Felled by fire: nothing comes back, and it is out.
    const burned = endHero(blast(fight(blaster(200, "fire"))).state);
    assert.equal(who(burned.state, "troll").defeated, true);
    assert.equal(of(burned.events, "defeated").length, 1);
  }

  // ── Survivor: 5 plus Constitution at half or less, never at 0 ──
  {
    const champion = (hp: number) => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: roll,
        combatants: [
          {
            id: "fighter",
            name: "Fighter",
            side: "party",
            build: rulesetSheetBuildSchema.parse({
              abilities: { str: 16, dex: 10, con: 16, int: 10, wis: 10, cha: 10 },
              fields: { level: 18, ac: 18, speed: 30, hp_max: 100 },
            }),
            live: {},
          },
          { id: "dummy", name: "Dummy", side: "enemy", block: blaster(hp, "slashing") },
        ],
      });
      who(state, "fighter").tracked.push({ condition: "survivor", rounds: null } as never);
      state.order = ["dummy", "fighter"];
      state.turn = 0;
      return state;
    };
    const hurtBy = (amount: number) => {
      const state = champion(amount);
      const struck = step(state, {
        actorId: "dummy",
        optionId: who(state, "dummy").actions[0]!.id,
        targetIds: ["fighter"],
      });
      return step(struck.state, { actorId: "dummy", optionId: "end-turn", targetIds: [] });
    };
    const half = hurtBy(60);
    assert.deepEqual(of(half.events, "regenerates"), [{ type: "regenerates", actorId: "fighter", amount: 8 }], "5 + 3");
    assert.equal(health(half.state, "fighter"), 48);
    assert.deepEqual(of(hurtBy(40).events, "regenerates"), [], "more than half left");
  }

  // ── Refusals ──
  {
    refused(
      document((doc) => {
        doc.catalogs
          .find((catalog: { holds?: string }) => catalog.holds === "creatures")
          .entries.at(-1).creature.regenerates = {
          flat: 10,
          add: { abilityMod: "con" },
        };
      }),
      /A creature has no sheet to read "add" off/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).regenerates = { stoppedBy: ["fire"] };
      }),
      /What it regains names/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.at(-1).regenerates = { flat: 1, keepsUp: true, notAtZero: true };
      }),
      /keepsUp/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with regeneration on a condition, a level or a creature requires schemaVersion 2 and capabilityApi 1.396 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(395) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(396) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(395) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Regeneration: a troll's 10 as its turn starts, none after fire, down but not out at 0 and out when it cannot; Survivor's 5 + Con at half or less; gated at 1.396.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
