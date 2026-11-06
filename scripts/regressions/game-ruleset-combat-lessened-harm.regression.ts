/**
 * Damage lessened by a value off the sheet, and falls lessened (Capability API 1.413).
 *
 *   - Deflect Missiles: 1d10 + Dexterity modifier + monk level off a ranged blow, spent by it; a melee
 *     blow is not lessened; never below 0.
 *   - Slow Fall: five times the monk's level off a fall, the condition spent by it; an attack is not
 *     lessened by it.
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
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lessened-harm-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 413);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.combat.elevation = {
      levelHeight: 5,
      falling: { per: 10, dice: { count: 1, sides: 6 }, max: 20, type: "bludgeoning" },
    };
    doc.sheet.derived.push(
      {
        id: "deflect_missiles",
        label: "Deflect Missiles",
        op: "sum",
        of: [{ abilityMod: "dex" }, { field: "level" }],
      },
      { id: "slow_fall", label: "Slow Fall", op: "multiply", of: [{ field: "level" }, { const: 5 }] },
    );
    doc.sheet.live.conditions.push(
      { id: "deflecting", label: "Deflecting" },
      { id: "slowing", label: "Slowing a fall" },
    );
    doc.combat.conditions.push(
      {
        condition: "deflecting",
        effects: [],
        modifiers: [
          {
            to: "damage-taken",
            blow: "ranged",
            dice: "1d10",
            add: { derived: "deflect_missiles" },
            minus: true,
          },
        ],
      },
      {
        condition: "slowing",
        effects: [],
        modifiers: [{ to: "damage-taken", falls: true, add: { derived: "slow_fall" }, minus: true }],
      },
    );
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
  const block = (): RulesetStatBlock => ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "arrow",
        name: "Arrow",
        budget: "action",
        toHit: 20,
        damage: { count: 0, sides: 0, flat: 15 },
        range: { normal: 80 },
      },
      { id: "club", name: "Club", budget: "action", toHit: 20, damage: { count: 0, sides: 0, flat: 15 } },
      {
        id: "nudge",
        name: "Nudge",
        budget: "action",
        toHit: 20,
        damage: { count: 0, sides: 0, flat: 1 },
        range: { normal: 80 },
      },
    ],
  });
  const fight = (board = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "archer", name: "Archer", side: "enemy", block: block() },
        {
          id: "monk",
          name: "Monk",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
            fields: { level: 3, ac: 12, speed: 40, hp_max: 40 },
          }),
          live: {},
        },
      ],
      ...(board
        ? {
            board: {
              grid: {
                width: 20,
                height: 1,
                tiles: [Array(20).fill("plains")],
                elevation: [[4, 4, ...Array(18).fill(0)]],
              },
              placements: { archer: { x: 0, y: 0 }, monk: { x: 1, y: 0 } },
            },
          }
        : {}),
    });
    state.order = ["archer", "monk"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState) => rulesetCombatant(state, "monk")!;
  const health = (state: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, who(state)).value;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const strike = (state: RulesetEncounterState, label: string, faces: (sides: number) => number) => {
    state.turn = 0;
    rulesetCombatant(state, "archer")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "archer").find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${rulesetCombatOptions(definition, state, "archer").map((one) => one.label)}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "archer", optionId: option.id, targetIds: ["monk"] },
      faces,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const faces = (sides: number) => (sides === 20 ? 15 : 4);

  // ── Deflect Missiles: 15 - (4 + 3 + 3) = 5, spent by the arrow ──
  {
    const state = fight();
    who(state).tracked.push({ condition: "deflecting", rounds: null, endsAfter: "attacked" } as never);
    const shot = strike(state, "Arrow", faces);
    assert.deepEqual(
      of(shot.events, "damage").map((one) => one.dealt),
      [5],
      JSON.stringify(shot.events),
    );
    assert.equal(health(shot.state), 35);
    assert.ok(!rulesetCombatConditions(definition, who(shot.state)).includes("deflecting"), "spent by the arrow");
    const again = strike(shot.state, "Arrow", faces);
    assert.deepEqual(
      of(again.events, "damage").map((one) => one.dealt),
      [15],
    );
    // A club is no missile.
    const close = fight();
    who(close).tracked.push({ condition: "deflecting", rounds: null, endsAfter: "attacked" } as never);
    assert.deepEqual(
      of(strike(close, "Club", faces).events, "damage").map((one) => one.dealt),
      [15],
    );
    // Never below 0.
    const small = fight();
    who(small).tracked.push({ condition: "deflecting", rounds: null, endsAfter: "attacked" } as never);
    const caught = strike(small, "Nudge", faces);
    assert.equal(health(caught.state), 40, JSON.stringify(caught.events));
    // Slow Fall lessens no arrow.
    const falling = fight();
    who(falling).tracked.push({ condition: "slowing", rounds: 1 } as never);
    assert.deepEqual(
      of(strike(falling, "Arrow", faces).events, "damage").map((one) => one.dealt),
      [15],
    );
    assert.ok(rulesetCombatConditions(definition, who(falling)).includes("slowing"));
  }

  // ── Slow Fall: 4 + 4 off a 20-foot ledge, less 15, and spent ──
  {
    const shove = (state: RulesetEncounterState) => {
      const option = rulesetCombatOptions(definition, state, "archer").find((one) => one.label === "Shove away");
      assert.ok(option, "the archer can shove");
      return applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "archer", optionId: option.id, targetIds: ["monk"] },
        (() => {
          const thrown = [18, 1, 4, 4];
          let index = 0;
          return () => thrown[index++] ?? 4;
        })(),
      );
    };
    const plain = shove(fight(true));
    assert.deepEqual(
      of(plain.events, "fell").map((one) => one.levels),
      [4],
      JSON.stringify(plain.events),
    );
    const plainDealt = of(plain.events, "damage").map((one) => one.dealt);
    assert.deepEqual(plainDealt, [8]);
    const state = fight(true);
    who(state).tracked.push({ condition: "slowing", rounds: 1 } as never);
    const slowed = shove(state);
    assert.deepEqual(
      of(slowed.events, "damage").map((one) => one.dealt),
      [0],
      JSON.stringify(slowed.events),
    );
    assert.equal(health(slowed.state), 40);
    assert.ok(!rulesetCombatConditions(definition, who(slowed.state)).includes("slowing"), "spent by the fall");
  }

  // ── Refusals ──
  {
    const withModifier = (modifier: Record<string, unknown>) =>
      document((doc) => {
        doc.combat.conditions.at(-1).modifiers = [modifier];
      });
    refused(
      withModifier({ to: "speed", add: { const: 2 } }),
      /"add" changes damage dealt or taken, attacks, checks or saves only/,
    );
    refused(withModifier({ to: "damage", falls: true, flat: -2 }), /"falls" narrows damage taken only/);
    refused(withModifier({ to: "damage-taken", falls: true, blow: "ranged", flat: -2 }), /"falls" goes without "blow"/);
    refused(withModifier({ to: "damage-taken", add: { derived: "nothing_here" } }), /nothing_here/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose damage modifier adds a value off the sheet (add) or lessens a fall (falls) requires schemaVersion 2 and capabilityApi 1.413 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(412) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(413) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(412) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Lessened harm: Deflect Missiles takes 1d10 + Dex + level off an arrow and is spent, not off a club, never below 0; Slow Fall takes 5 x level off a fall and is spent, not off an arrow; gated at 1.413.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
