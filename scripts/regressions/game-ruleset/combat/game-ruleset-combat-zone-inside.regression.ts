/**
 * Zones that work on whoever stands in them (Capability API 1.179).
 *
 *   - `zone.inside`: conditions on whoever is inside, damage types kept off them (Silence).
 *   - `combat.components` and an entry's `components`; `zone.forbids` and a condition's `forbids`
 *     stop what needs them (no verbal spells in Silence, a gag).
 *   - `zone.wards`: entries off its catalogs at its level or lower, used from outside, do not reach
 *     whoever is inside, judged at the level paid (Globe of Invulnerability).
 *   - A condition that takes budgets away, put on during its holder's turn, takes this turn's
 *     (Stinking Cloud).
 *   - Import refusals, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  RULESET_MOVE_OPTION,
  rowsFromCatalogEntry,
  rulesetActiveConditions,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetWarded,
  rulesetZoneConditions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zone-inside-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 174);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };

  const spell = (id: string, mechanics: Record<string, unknown>, level = 1) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "fire", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Silence: deafens, keeps thunder out, and nothing verbal is cast inside.
  const silence = spell("silence", {
    kind: "utility",
    area: { shape: "burst", size: 10 },
    range: 120,
    zone: {
      rounds: 10,
      triggers: [],
      inside: { conditions: ["deafened"], immune: ["thunder"] },
      forbids: { components: ["verbal"] },
    },
  });
  // A bolt that needs a voice, a bolt that does not, and a thunderclap.
  const shout = spell("shout", { range: 120, amount: { flat: 5 }, components: ["verbal"] });
  const sign = spell("sign", {
    range: 120,
    amount: { flat: 5 },
    components: ["somatic"],
    cost: [{ pool: "slots_1", amount: 1 }],
  });
  const clap = spell("clap", { range: 120, amount: { flat: 5 }, damageType: "thunder" });
  // Globe: nothing of level 1 or lower from outside gets in.
  const globe = spell("globe", {
    kind: "utility",
    area: { shape: "burst", size: 5 },
    range: 60,
    zone: { rounds: 10, triggers: [], wards: { catalogs: ["spells"], maxLevel: 1 } },
  });
  // Stinking Cloud: a Con save as a turn begins in it, or the turn's action is lost.
  const stink = spell("stink", {
    kind: "debuff",
    area: { shape: "burst", size: 10 },
    range: 90,
    save: { save: "con_save", onSuccess: "negates" },
    applies: [{ condition: "poisoned", duration: { rounds: 1 } }],
    cost: [{ pool: "slots_1", amount: 1 }],
    zone: { rounds: 10, triggers: ["turn-start"], atCast: false },
  });
  const blast = spell("blast", {
    area: { shape: "burst", size: 10 },
    range: 120,
    amount: { flat: 5 },
    cost: [{ pool: "slots_1", amount: 1 }],
  });
  // The same cloud catching whoever walks into it, to put the condition on in the middle of a turn.
  const foul = spell("foul", {
    kind: "debuff",
    area: { shape: "burst", size: 10 },
    range: 90,
    save: { save: "con_save", onSuccess: "negates" },
    applies: [{ condition: "poisoned", duration: { rounds: 1 } }],
    zone: { rounds: 10, triggers: ["enter"], atCast: false },
  });
  const spells = [silence, shout, sign, clap, globe, stink, blast, foul];
  const definition = parsed(
    fiveE((doc) => {
      doc.combat.components = [
        { id: "verbal", label: "Verbal" },
        { id: "somatic", label: "Somatic" },
      ];
      // Here, poisoned costs the turn's action, as Stinking Cloud's retching does.
      const poisoned = doc.combat.conditions.find((entry: any) => entry.condition === "poisoned");
      poisoned.budgets = [{ budget: "action", flat: -1 }];
      // And deafened does something in a fight here, so the zone's condition is one the fight reads.
      doc.combat.conditions.push({ condition: "deafened", effects: ["own-attacks-disadvantage"] });
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    }),
  );
  const combat = definition.combat!;
  const block = (): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    saves: { con_save: -10 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
  });
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  const fight = (placements: Record<string, { x: number; y: number }> = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: {
              level: 5,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 9,
              slots_max_2: 3,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        { id: "a", name: "A", side: "enemy", block: block() },
        { id: "b", name: "B", side: "enemy", block: block() },
      ],
      board: {
        grid: grid(),
        placements: { mage: { x: 2, y: 7 }, a: { x: 10, y: 7 }, b: { x: 16, y: 7 }, ...placements },
      },
    });
    state.order = ["mage", "a", "b"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) =>
    rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
  const use = (
    state: RulesetEncounterState,
    label: string,
    choice: { at?: RulesetCombatCell; targetIds?: string[]; payWith?: string },
  ) => {
    const option = optionOf(state, "mage", label);
    assert.ok(option, `the mage has no ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: choice.targetIds ?? [], ...choice },
      roll,
    );
  };
  // Round to the mage's next turn.
  const around = (state: RulesetEncounterState) => {
    let next = state;
    for (let turn = 0; turn < 3; turn++) next = advanceRulesetTurn(definition, next, roll).state;
    assert.equal(next.order[next.turn], "mage");
    return next;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, combat, who(state, id)).value;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  // What is on a combatant: the fight's own conditions, and what a zone they stand in puts on them.
  const conditionsOf = (state: RulesetEncounterState, id: string) => [
    ...rulesetActiveConditions(definition, combat, who(state, id), state).map((entry) => entry.condition),
    ...rulesetZoneConditions(state, who(state, id)),
  ];

  // ── Silence ──
  {
    // Cast around A: A is deafened while inside, and the thunderclap does nothing to it.
    const step = use(fight(), "Silence", { at: { x: 10, y: 7 } });
    assert.equal(refused(step), undefined);
    const state = around(step.state);
    assert.ok(conditionsOf(state, "a").includes("deafened"), "deafened inside");
    assert.ok(
      rulesetActiveConditions(definition, combat, who(state, "a"), state).some((one) => one.condition === "deafened"),
      "and the fight reads it as on A",
    );
    assert.ok(!conditionsOf(state, "b").includes("deafened"), "not outside");
    const clapped = use(state, "Clap", { targetIds: ["a"] });
    assert.equal(hp(clapped.state, "a"), 100, "no thunder inside");
    // The mage outside still shouts; walked inside, it cannot, but a spell with no voice works.
    assert.ok(optionOf(state, "mage", "Shout"));
    const inside = fight({ mage: { x: 9, y: 7 } });
    const silenced = around(use(inside, "Silence", { at: { x: 10, y: 7 } }).state);
    assert.equal(optionOf(silenced, "mage", "Shout"), undefined, "nothing verbal inside");
    assert.ok(optionOf(silenced, "mage", "Sign"), "somatic only is fine");
    // Once it ends, all of it is gone.
    let after = silenced;
    for (let turn = 0; turn < 40 && who(after, "mage").zones?.length; turn++) {
      after = advanceRulesetTurn(definition, after, roll).state;
    }
    assert.ok(!conditionsOf(after, "a").includes("deafened"), "gone with it");
  }

  // ── Off a board, whoever it was cast on is inside ──
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            fields: { level: 5, hp_max: 30, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        { id: "a", name: "A", side: "enemy", block: block() },
        { id: "b", name: "B", side: "enemy", block: block() },
      ],
    });
    state.order = ["mage", "a", "b"];
    state.turn = 0;
    const cast = use(state, "Silence", { targetIds: ["a"] });
    assert.equal(refused(cast), undefined);
    assert.ok(conditionsOf(cast.state, "a").includes("deafened"), "held on A");
    assert.ok(!conditionsOf(cast.state, "b").includes("deafened"), "not on B");
  }

  // ── A gag ──
  {
    const gagged = parsed(
      fiveE((doc) => {
        doc.combat.components = [{ id: "verbal", label: "Verbal" }];
        doc.combat.conditions.find((entry: any) => entry.condition === "stunned").forbids = { components: ["verbal"] };
        doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [shout] });
      }),
    );
    const state = createRulesetEncounter({
      definition: gagged,
      seed: 1,
      roller: () => 10,
      bestiary: { spells: [shout] },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            fields: { level: 5, hp_max: 30, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: rowsFromCatalogEntry("spells", shout).map((row) => row.row) },
          }),
          live: { conditions: ["stunned"] } as never,
          catalogs: { spells: [shout] },
        },
        { id: "a", name: "A", side: "enemy", block: block() },
      ],
    });
    assert.ok(
      !rulesetCombatOptions(gagged, state, "mage").some((one) => one.label === "Shout"),
      "a condition that forbids the voice stops the shout",
    );
  }

  // ── Globe of Invulnerability ──
  {
    const step = use(fight(), "Globe", { at: { x: 10, y: 7 } });
    assert.equal(refused(step), undefined);
    const state = around(step.state);
    // A level-1 bolt from outside: A is not offered and cannot be named; B is.
    const sign = optionOf(state, "mage", "Sign")!;
    const offered = rulesetOptionTargets(definition, state, "mage", sign);
    assert.ok(offered.includes("b"));
    const named = use(state, "Sign", { targetIds: ["a"] });
    assert.ok(refused(named), "named behind the globe at level 1");
    // Something off another catalog is not warded at all.
    const signAction = who(state, "mage").actions.find((one) => one.id === sign.id)!;
    assert.ok(rulesetWarded(definition, state, who(state, "mage"), signAction, who(state, "a")));
    assert.ok(
      !rulesetWarded(definition, state, who(state, "mage"), { ...signAction, catalog: "feats" }, who(state, "a")),
    );
    // Paid at level 2, it goes through.
    assert.ok(sign.payWith?.includes("slots_2"), `payWith ${JSON.stringify(sign.payWith)}`);
    const upcast = use(state, "Sign", { targetIds: ["a"], payWith: "slots_2" });
    assert.equal(refused(upcast), undefined);
    assert.equal(hp(upcast.state, "a"), 95);
    // An area at level 1 catches B outside and leaves A inside alone.
    const close = around(use(fight({ b: { x: 13, y: 7 } }), "Globe", { at: { x: 10, y: 7 } }).state);
    const blasted = use(close, "Blast", { at: { x: 12, y: 7 } });
    assert.equal(refused(blasted), undefined);
    assert.equal(hp(blasted.state, "b"), 95, "B outside is caught");
    assert.equal(hp(blasted.state, "a"), 100, "A inside is not");
    // From inside the same globe, it reaches.
    const inGlobe = around(use(fight({ mage: { x: 9, y: 7 } }), "Globe", { at: { x: 10, y: 7 } }).state);
    const near = use(inGlobe, "Sign", { targetIds: ["a"] });
    assert.equal(refused(near), undefined);
    assert.equal(hp(near.state, "a"), 95, "cast from inside the globe");
  }

  // ── Stinking Cloud: the turn's action, lost as the turn begins ──
  {
    const cast = use(fight(), "Stink", { at: { x: 10, y: 7 } });
    assert.equal(refused(cast), undefined);
    assert.ok(!conditionsOf(cast.state, "a").includes("poisoned"), "nothing as it appears");
    // A's turn: it begins in the cloud, fails, and has no action this turn.
    const aTurn = advanceRulesetTurn(definition, cast.state, roll).state;
    assert.equal(aTurn.order[aTurn.turn], "a");
    assert.ok(conditionsOf(aTurn, "a").includes("poisoned"));
    assert.equal(who(aTurn, "a").budgets.action, 0, "no action this turn");
    assert.ok(
      !rulesetCombatOptions(definition, aTurn, "a").some((one) => one.label === "Claw"),
      "nothing on the action budget",
    );
  }

  // ── Walked into in the middle of a turn: this turn's action goes too ──
  {
    const cast = use(fight(), "Foul", { at: { x: 13, y: 7 } });
    assert.equal(refused(cast), undefined);
    const aTurn = advanceRulesetTurn(definition, cast.state, roll).state;
    assert.equal(who(aTurn, "a").budgets.action, 1, "A starts its turn outside, with its action");
    const walked = applyRulesetCombatChoice(
      definition,
      aTurn,
      { actorId: "a", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 11, y: 7 } },
      roll,
    );
    assert.equal(refused(walked), undefined);
    assert.ok(conditionsOf(walked.state, "a").includes("poisoned"), "caught walking in");
    assert.equal(who(walked.state, "a").budgets.action, 0, "and the action is gone this turn");
  }

  // ── Import refusals ──
  {
    const refusedDoc = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const withSpell =
      (mechanics: Record<string, unknown>, components = true) =>
      (doc: Record<string, any>) => {
        if (components) doc.combat.components = [{ id: "verbal", label: "Verbal" }];
        doc.catalogs.push({
          id: "spells",
          label: "Spells",
          feeds: ["spells"],
          entries: [{ ...spell("x", {}), mechanics }],
        });
      };
    const zoneOf = (zone: Record<string, unknown>) => ({
      kind: "utility",
      area: { shape: "burst", size: 10 },
      zone: { rounds: 1, triggers: [], ...zone },
    });
    refusedDoc(withSpell({ kind: "attack", components: ["somatic"] }), /Unknown component "somatic"/);
    refusedDoc(withSpell({ kind: "attack", components: ["verbal"] }, false), /declares no combat components/);
    refusedDoc(withSpell({ kind: "attack", components: ["verbal", "verbal"] }), /Each is named once/);
    refusedDoc(withSpell(zoneOf({ inside: { conditions: ["dazzled"] } })), /Unknown condition "dazzled"/);
    refusedDoc(withSpell(zoneOf({ inside: { immune: ["sonic"] } })), /Unknown damage type "sonic"/);
    refusedDoc(withSpell(zoneOf({ inside: {} })), /Say what standing inside does/);
    refusedDoc(withSpell(zoneOf({ forbids: { components: ["somatic"] } })), /Unknown component "somatic"/);
    refusedDoc(withSpell(zoneOf({ wards: { catalogs: ["prayers"], maxLevel: 5 } })), /Unknown catalog "prayers"/);
    refusedDoc((doc) => {
      doc.combat.components = [
        { id: "verbal", label: "Verbal" },
        { id: "verbal", label: "Again" },
      ];
    }, /Duplicate component/);
    refusedDoc((doc) => {
      doc.combat.components = [{ id: "verbal", label: "Verbal" }];
      doc.combat.conditions.find((entry: any) => entry.condition === "stunned").forbids = { components: ["somatic"] };
    }, /Unknown component "somatic"/);
    refusedDoc((doc) => {
      doc.combat.components = [{ id: "verbal", label: "Verbal" }];
      doc.catalogs.find((catalog: any) => catalog.id === "creatures").entries[0].creature.actions[0].components = [
        "somatic",
      ];
    }, /Unknown component "somatic"/);
  }

  // A zone that only puts a condition on whoever stands in it needs no trigger.
  parsed(
    fiveE((doc) => {
      doc.catalogs.push({
        id: "spells",
        label: "Spells",
        feeds: ["spells"],
        entries: [
          {
            ...spell("hush", {}),
            mechanics: {
              kind: "utility",
              area: { shape: "burst", size: 10 },
              zone: { rounds: 1, triggers: [], inside: { conditions: ["deafened"] } },
            },
          },
        ],
      });
    }),
  );

  // ── The gate ──
  {
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
    const gate =
      "A ruleset with combat components, or zones that work on whoever stands inside, stop components or ward off spells, requires schemaVersion 2 and capabilityApi 1.179 or newer";
    const withEntry = (entry: RulesetCatalogEntry) =>
      fiveE((doc) => {
        doc.catalogs.push({ id: "x", label: "X", entries: [entry] });
      });
    for (const entry of [silence, shout, globe]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(178) as never, withEntry(entry)), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(179) as never, withEntry(entry)), gate, entry.id);
    }
    const components = fiveE((doc) => {
      doc.combat.components = [{ id: "verbal", label: "Verbal" }];
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(178) as never, components), gate, "combat components");
    const gag = fiveE((doc) => {
      doc.combat.conditions.find((entry: any) => entry.condition === "stunned").forbids = { components: ["verbal"] };
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(178) as never, gag), gate, "a condition that forbids");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(178) as never, withEntry(stink)), gate, "a plain zone");
  }

  console.log(
    "Zone inside: Silence deafens, keeps thunder out and stops verbal spells inside; a gag stops them too; Globe of Invulnerability wards off level-1 spells from outside but not from inside or paid higher; Stinking Cloud takes the turn's action; gated at 1.179.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
