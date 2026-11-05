/**
 * Fighting under water and holding breath (Capability API 1.498).
 *
 *   - A melee swing under water takes disadvantage unless the attacker swims or the weapon is named;
 *     a shot never reaches past its normal range, and within it takes disadvantage unless named.
 *   - Fire is halved on whoever is under water.
 *   - Breath: held for 1 + Con turns, then lasted Con turns more, then 0; exempt conditions breathe.
 *   - Water-only breathers (1.512) hold it out of the water instead.
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
  rulesetAttackMode,
  rulesetCombatant,
  rulesetTargetRefusal,
  rulesetUnderwater,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-underwater-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 498);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const thrown = { names: ["dagger", "javelin", "shortsword", "spear", "trident"] };
  const rule = {
    terrain: ["water"],
    melee: { mode: "disadvantage", unless: thrown },
    ranged: { pastNormal: "never", mode: "disadvantage", unless: { names: ["crossbow", "net", "javelin", "spear"] } },
    resist: ["fire"],
    breath: {
      holds: { rounds: 1, perMod: { ability: "con", rounds: 1 }, atLeast: 1 },
      then: { rounds: 0, perMod: { ability: "con", rounds: 1 }, atLeast: 1 },
      exempt: { conditions: ["gilled"], tags: ["breathes-water"] },
    },
  };
  const fiveE = (underwater: unknown = rule): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "gilled", label: "Water Breathing" });
    doc.combat.conditions.push({ condition: "gilled", effects: [] });
    doc.combat.creatureTypes = { types: [{ id: "beast", label: "Beast" }], default: "beast" };
    if (underwater !== null) doc.combat.underwater = underwater;
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
  const block = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 30,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
      actions: [
        {
          id: "dagger",
          name: "Dagger",
          budget: "action",
          toHit: 4,
          damage: { dice: "1d4", type: "piercing" },
          reach: 5,
        },
        {
          id: "club",
          name: "Club",
          budget: "action",
          toHit: 4,
          damage: { dice: "1d4", type: "bludgeoning" },
          reach: 5,
        },
        {
          id: "crossbow",
          name: "Light Crossbow",
          budget: "action",
          toHit: 4,
          damage: { dice: "1d8", type: "piercing" },
          range: { normal: 80, long: 320 },
        },
        {
          id: "bow",
          name: "Shortbow",
          budget: "action",
          toHit: 4,
          damage: { dice: "1d6", type: "piercing" },
          range: { normal: 80, long: 320 },
        },
        {
          id: "firebolt",
          name: "Fire Bolt",
          budget: "action",
          toHit: 4,
          damage: { dice: "2d10", type: "fire" },
          range: { normal: 120 },
        },
      ],
      ...extra,
    }) as unknown as RulesetStatBlock;
  // Columns 0-29 of one row: water up to `shore`, plains after.
  const fight = (
    definition: RulesetDefinition,
    at: { a: number; b: number },
    opts: { shore?: number; a?: Record<string, unknown>; b?: Record<string, unknown> } = {},
  ): RulesetEncounterState => {
    const shore = opts.shore ?? 30;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "a", name: "A", side: "party", block: block({ speeds: { swim: 0 }, ...opts.a }) },
        { id: "b", name: "B", side: "enemy", block: block(opts.b) },
      ],
      board: {
        grid: {
          width: 30,
          height: 1,
          tiles: [Array.from({ length: 30 }, (_, x) => (x < shore ? "water" : "plains"))],
        } as never,
        placements: { a: { x: at.a, y: 0 }, b: { x: at.b, y: 0 } },
      },
    });
    state.order = ["a", "b"];
    state.turn = 0;
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const mode = (use: RulesetDefinition, state: RulesetEncounterState, optionId: string) =>
    rulesetAttackMode(use, use.combat!, who(state, "a"), who(state, "b"), { state, optionId });

  // ── Who is under water ──
  {
    const state = fight(definition, { a: 2, b: 3 }, { shore: 3 });
    assert.equal(rulesetUnderwater(definition, state, who(state, "a")), true);
    assert.equal(rulesetUnderwater(definition, state, who(state, "b")), false, "on the bank");
    const flier = fight(definition, { a: 2, b: 3 }, { a: { speeds: { fly: 30 } } });
    assert.equal(rulesetUnderwater(definition, flier, who(flier, "a")), false, "a flier skims the water");
  }

  // ── Melee: a club swung under water, a dagger, and a swimmer ──
  {
    const state = fight(definition, { a: 2, b: 3 });
    assert.equal(mode(definition, state, "club"), "disadvantage");
    assert.equal(mode(definition, state, "dagger"), "normal", "a dagger is named");
    const swimmer = fight(definition, { a: 2, b: 3 }, { a: { speeds: { swim: 30 } } });
    assert.equal(mode(definition, swimmer, "club"), "normal", "a swim speed swings freely");
    const dry = fight(definition, { a: 2, b: 3 }, { shore: 0 });
    assert.equal(mode(definition, dry, "club"), "normal", "out of the water");
    const plain = parsed(fiveE(null));
    assert.equal(mode(plain, fight(plain, { a: 2, b: 3 }), "club"), "normal", "without the rule");
  }

  // ── Ranged: within normal range a shortbow is disadvantaged, a crossbow is not; past it, refused ──
  {
    const near = fight(definition, { a: 0, b: 10 });
    assert.equal(mode(definition, near, "bow"), "disadvantage");
    assert.equal(mode(definition, near, "crossbow"), "normal", "a crossbow is named");
    assert.equal(rulesetTargetRefusal(near, "a", "bow", "b", undefined, definition), null);
    const far = fight(definition, { a: 0, b: 20 });
    assert.equal(rulesetTargetRefusal(far, "a", "crossbow", "b", undefined, definition), "out-of-reach");
    assert.equal(rulesetTargetRefusal(far, "a", "crossbow", "b"), null, "read without the ruleset");
    // The target alone under water is enough.
    const fromBank = fight(definition, { a: 25, b: 5 }, { shore: 20 });
    assert.equal(rulesetTargetRefusal(fromBank, "a", "crossbow", "b", undefined, definition), "out-of-reach");
    const dry = fight(definition, { a: 0, b: 20 }, { shore: 0 });
    assert.equal(rulesetTargetRefusal(dry, "a", "crossbow", "b", undefined, definition), null, "on land");
    const shot = applyRulesetCombatChoice(
      definition,
      far,
      { actorId: "a", optionId: "crossbow", targetIds: ["b"] },
      () => 15,
    );
    assert.equal(of(shot.events, "refused")[0]?.reason, "out-of-reach", JSON.stringify(shot.events));
  }

  // ── Fire under water is halved ──
  {
    const bolt = (shore: number) =>
      of(
        applyRulesetCombatChoice(
          definition,
          fight(definition, { a: 20, b: 5 }, { shore }),
          { actorId: "a", optionId: "firebolt", targetIds: ["b"] },
          () => 15,
        ).events,
        "damage",
      )[0];
    const wet = bolt(10)!;
    assert.equal(wet.adjust, "resist", JSON.stringify(wet));
    assert.equal(wet.dealt, Math.floor(wet.amount / 2));
    assert.equal(bolt(0)!.adjust, "none", "on land");
  }

  // ── Holding breath: 1 + Con (2) turns, then Con (1) more, then 0 ──
  const breaths = (state: RulesetEncounterState, use = definition) => {
    const seen: Array<{ held: number; lasts: number } | "down"> = [];
    let now = state;
    for (let step = 0; step < 10 && seen.length < 4; step++) {
      const actorId = now.order[now.turn]!;
      const next = applyRulesetCombatChoice(use, now, { actorId, optionId: "end-turn", targetIds: [] }, () => 10);
      for (const one of of(next.events, "breath"))
        if (one.actorId === "a") seen.push({ held: one.held, lasts: one.lasts });
      if (of(next.events, "down").some((one) => one.actorId === "a")) seen.push("down");
      now = next.state;
    }
    return { seen, state: now };
  };
  {
    const { seen, state } = breaths(fight(definition, { a: 2, b: 25 }, { shore: 10 }));
    assert.deepEqual(
      seen.slice(0, 4),
      [
        { held: 1, lasts: 0 },
        { held: 0, lasts: 1 },
        { held: 0, lasts: 0 },
        { held: 0, lasts: 0 },
      ],
      JSON.stringify(seen),
    );
    assert.ok(seen.includes("down") || who(state, "a").down || who(state, "a").defeated, "out of breath");
    assert.equal(who(state, "a").health.value, 0);
  }
  {
    // On land, an exempt condition or tag, or no breath rule: nothing.
    assert.deepEqual(breaths(fight(definition, { a: 15, b: 25 }, { shore: 10 })).seen, []);
    const gilled = fight(definition, { a: 2, b: 25 }, { shore: 10 });
    who(gilled, "a").tracked.push({ condition: "gilled", rounds: null, source: "a" });
    assert.deepEqual(breaths(gilled).seen, []);
    assert.deepEqual(
      breaths(fight(definition, { a: 2, b: 25 }, { shore: 10, a: { type: "beast", tags: ["breathes-water"] } })).seen,
      [],
    );
    const noBreath = parsed(fiveE({ ...rule, breath: undefined }));
    assert.deepEqual(breaths(fight(noBreath, { a: 2, b: 25 }, { shore: 10 }), noBreath).seen, []);
  }
  {
    // Breathing only water (1.512): a shark on the bank holds its breath, and in the sea breathes.
    const sharks = parsed(
      fiveE({ ...rule, breath: { ...rule.breath, exempt: undefined, waterOnly: { tags: ["gills"] } } }),
    );
    const shark = { type: "beast", tags: ["gills"] };
    const { seen, state } = breaths(fight(sharks, { a: 15, b: 25 }, { shore: 10, a: shark }), sharks);
    assert.deepEqual(seen.slice(0, 3), [
      { held: 1, lasts: 0 },
      { held: 0, lasts: 1 },
      { held: 0, lasts: 0 },
    ]);
    assert.equal(who(state, "a").health.value, 0, "out of the water too long");
    assert.deepEqual(breaths(fight(sharks, { a: 2, b: 25 }, { shore: 10, a: shark }), sharks).seen, [], "in the sea");
    assert.ok(breaths(fight(sharks, { a: 2, b: 25 }, { shore: 10 }), sharks).seen.length > 0, "others still drown");
    refused(fiveE({ ...rule, breath: { ...rule.breath, waterOnly: { tags: [] } } }), /tags/);
    const gate =
      "A ruleset whose creatures breathe only water (underwater breath waterOnly) requires schemaVersion 2 and capabilityApi 1.512 or newer";
    const doc = fiveE({ ...rule, breath: { ...rule.breath, waterOnly: { tags: ["gills"] } } });
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(511) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(512) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(511) as never, fiveE()), gate);
  }

  // ── Refusals ──
  refused(fiveE({ terrain: [] }), /terrain/);
  refused(fiveE({ terrain: ["water"] }), /underwater says what/);
  refused(fiveE({ terrain: ["water"], ranged: {} }), /pastNormal or mode/);
  refused(fiveE({ terrain: ["water"], melee: { mode: "worse" } }), /mode/);
  refused(fiveE({ ...rule, swims: true }), /Unrecognized key/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose fights go on under water (combat underwater) requires schemaVersion 2 and capabilityApi 1.498 or newer";
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
    const only = JSON.parse(fiveEText) as Record<string, any>;
    only.combat.underwater = { terrain: ["water"], resist: ["fire"] };
    assert.equal(getCapabilityPackageInstallIssue(manifest(497) as never, only), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(498) as never, only), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(497) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Underwater: swings and shots lean as the rule says, shots stop at normal range, fire is halved, breath runs out to 0 unless exempt, and out of the water for water-only breathers; gated at 1.498 and 1.512.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
