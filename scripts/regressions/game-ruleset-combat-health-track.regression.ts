/**
 * A fight whose health is a PLAIN track that fills up (Capability API 1.383): `combat.health`
 * naming a track with neither levels nor boxes, as Genesys keeps Wounds, from 0 up to a threshold.
 *
 * It reads the way a wound track does, as what it has LEFT: the room above its value out of its
 * length, so a full track is a combatant at zero and every rule about going down keeps its words.
 *
 * What is pinned:
 *   - Health reads as the room left, with no temporary buffer.
 *   - Damage adds its points, held at the maximum, and filling the track puts them down.
 *   - A heal in a fight takes its points off, and brings a downed member back.
 *   - Using an item outside a fight takes its heal off the track too.
 *   - The `battle` bridge carries a share of the track and writes back points.
 *   - What import refuses: a track with no room, one that starts full, kinds, temporary points.
 *   - The install gate.
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
  currentRulesetActor,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetEncounterSummary,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  seedCombatantFromSheet,
  sheetOpsFromCombatResult,
  useRulesetItemOutsideFight,
  type RulesetCatalogEntry,
  type RulesetCombatant,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-health-track-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const { getCapabilityPackageInstallIssue } =
    await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
  const emberText = readFileSync(
    fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );

  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      return faces[index++]!;
    };
  };
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((event): event is Extract<RulesetCombatEvent, { type: T }> => event.type === type);
  const who = (state: RulesetEncounterState, id: string): RulesetCombatant => {
    const combatant = rulesetCombatant(state, id);
    assert.ok(combatant, `no combatant "${id}"`);
    return combatant;
  };

  /** Ember Roads with its health moved off the Grit pool onto a plain Wounds track of 5. */
  const woundsDocument = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(emberText) as Record<string, any>;
    delete doc.layers;
    doc.id = "ember-roads-wounds-plain";
    doc.sheet.live.tracks.push({ id: "wounds", label: "Wounds", min: 0, max: 5, default: 0 });
    doc.combat.health = { track: "wounds" };
    // No track holds temporary points, so the entries that grant them go.
    for (const catalog of doc.catalogs ?? []) {
      for (const entry of catalog.entries ?? []) {
        if (entry.mechanics?.temporary) delete entry.mechanics.temporary;
      }
    }
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (doc: Record<string, any>, what: string): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, `${what} must validate: ${result.ok ? "" : result.issues.join("; ")}`);
    return result.definition;
  };
  const filling = parsedOrThrow(woundsDocument(), "a ruleset whose health is a plain track");

  const buildOf = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);
  const travellerBuild = () =>
    buildOf({
      abilities: { brawn: 2, wits: 1, heart: 1 },
      skills: { scrap: "trained" },
      fields: { calling: "Hauler", toughness: 2 },
      lists: { gear: [{ name: "Road axe", notes: "Heavy", swing: "brawn", damage: "1d6", harm: "cut" }] },
    });
  const traveller = (live: unknown = {}) => ({
    id: "juno",
    name: "Juno",
    side: "party" as const,
    build: travellerBuild(),
    live,
    catalogs: {},
  });
  const pell = () => ({
    id: "pell",
    name: "Pell",
    side: "party" as const,
    build: buildOf({
      abilities: { brawn: 1, wits: 2, heart: 0 },
      fields: { calling: "Scout", toughness: 1 },
      lists: {},
    }),
    live: {},
    catalogs: {},
  });
  const hound = {
    id: "ash",
    name: "Ash-hound",
    side: "enemy" as const,
    block: {
      health: 20,
      defense: 6,
      initiativeModifier: 1,
      actions: [
        { id: "claw", name: "Claw", budget: "act", toHit: 6, damage: { count: 1, sides: 6, flat: 0, type: "cut" } },
      ],
    },
  };
  const woundsOf = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) => {
    const sheet = who(state, id).sheet!;
    return readRulesetLive(definition, sheet.build, sheet.live).tracks.find((entry) => entry.id === "wounds")!.value;
  };

  // ── Health reads as the room the track has left ──
  {
    const state = createRulesetEncounter({
      definition: filling,
      seed: 4242,
      combatants: [traveller(), hound],
      roller: dice(6, 5, 1, 1),
    });
    assert.deepEqual(rulesetCombatHealth(filling, filling.combat!, who(state, "juno")), { value: 5, max: 5, temp: 0 });
    const hurt = createRulesetEncounter({
      definition: filling,
      seed: 4242,
      combatants: [traveller({ tracks: { wounds: 3 } }), hound],
      roller: dice(6, 5, 1, 1),
    });
    assert.deepEqual(rulesetCombatHealth(filling, filling.combat!, who(hurt, "juno")), { value: 2, max: 5, temp: 0 });
    const summary = rulesetEncounterSummary(filling, hurt).party.find((member) => member.id === "juno")!;
    assert.deepEqual([summary.health, summary.maxHealth, summary.temp], [2, 5, 0]);
  }

  // ── Damage adds its points, and a full track is down ──
  {
    const swing = (state: RulesetEncounterState, ...faces: number[]) => {
      const claw = rulesetCombatOptions(filling, state, "ash").find((option) => option.label === "Claw")!;
      return applyRulesetCombatChoice(
        filling,
        state,
        { actorId: "ash", optionId: claw.id, targetIds: ["juno"] },
        dice(...faces),
      );
    };
    let state = createRulesetEncounter({
      definition: filling,
      seed: 4242,
      combatants: [traveller(), pell(), hound],
      roller: dice(1, 1, 1, 1, 6, 6),
    });
    assert.equal(state.order[0], "ash", "the hound swings first");
    const first = swing(state, 6, 6, 3);
    assert.equal(eventsOf(first.events, "damage")[0]!.dealt, 3);
    assert.equal(eventsOf(first.events, "damage")[0]!.health, 2, "the log reads what is left");
    state = first.state;
    assert.equal(woundsOf(filling, state, "juno"), 3, "three wounds on the track");
    assert.equal(who(state, "juno").down, false);

    // Round again to the hound, then a blow for 6 that runs past the threshold.
    for (let guard = 0; guard < 8 && !(state.order[state.turn] === "ash" && guard > 0); guard++) {
      const actor = state.order[state.turn]!;
      state = applyRulesetCombatChoice(
        filling,
        state,
        { actorId: actor, optionId: "end-turn", targetIds: [] },
        dice(1, 1, 1, 1),
      ).state;
    }
    assert.equal(state.order[state.turn], "ash");
    const last = swing(state, 6, 6, 6);
    assert.equal(woundsOf(filling, last.state, "juno"), 5, "held at the threshold");
    assert.equal(rulesetCombatHealth(filling, filling.combat!, who(last.state, "juno")).value, 0);
    assert.equal(eventsOf(last.events, "down")[0]?.actorId, "juno", "a full track is down");
  }

  // ── A heal in a fight takes its points off, and brings them back ──
  {
    const knacks = (JSON.parse(emberText).catalogs ?? []).find(
      (catalog: Record<string, any>) => catalog.id === "knacks",
    );
    const lastEmber = (knacks?.entries ?? []).find((entry: Record<string, any>) => entry.id === "last-ember");
    assert.ok(lastEmber, "the example still ships the knack this case mends with");
    const mender = {
      id: "pell",
      name: "Pell",
      side: "party" as const,
      build: buildOf({
        abilities: { brawn: 1, wits: 2, heart: 1 },
        fields: { calling: "Scout", toughness: 1 },
        lists: { knacks: [{ name: "Last Ember", notes: "Mend", _catalog: "knacks/last-ember" }] },
      }),
      live: { pools: { grit: { value: 6 } } },
      catalogs: { knacks: [lastEmber] },
    };
    let mending = createRulesetEncounter({
      definition: filling,
      seed: 4242,
      combatants: [traveller({ tracks: { wounds: 5 } }), mender],
      roller: dice(1, 6, 1, 1, 1, 1),
    });
    assert.equal(who(mending, "juno").down, true, "a full track starts the fight down");
    if (currentRulesetActor(mending)?.id !== "pell")
      mending = advanceRulesetTurn(filling, mending, dice(1, 1, 1, 1)).state;
    const ember = rulesetCombatOptions(filling, mending, "pell").find((option) => option.label === "Last Ember");
    assert.ok(ember, "the mender can mend");
    const mended = applyRulesetCombatChoice(
      filling,
      mending,
      { actorId: "pell", optionId: ember.id, targetIds: ["juno"] },
      dice(3, 3, 3, 3),
    );
    const heal = eventsOf(mended.events, "heal")[0];
    assert.ok(heal && heal.amount > 0, "the knack heals");
    assert.equal(
      woundsOf(filling, mended.state, "juno"),
      Math.max(0, 5 - heal.amount),
      "its points come off the track",
    );
    assert.equal(heal.health, Math.min(5, heal.amount), "and the log reads the room it made");
    assert.equal(who(mended.state, "juno").down, false, "so they are on their feet again");
  }

  // ── An item's heal outside a fight takes its points off too ──
  {
    const entries: Record<string, RulesetCatalogEntry[]> = Object.fromEntries(
      (filling.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const book = rulesetItemBook(filling, entries);
    const used = useRulesetItemOutsideFight({
      definition: filling,
      itemOf: book.itemOf,
      stacks: [{ id: "st-poultice", name: "Poultice", item: "outfitter/poultice", quantity: 2 }],
      stackId: "st-poultice",
      user: { name: "Juno", build: travellerBuild(), live: { tracks: { wounds: 4 } } },
      roll: () => 2,
    });
    assert.ok(used.ok, "the poultice is used");
    // 1d4 + 1 with a 2 on the die is 3 off four wounds.
    const live = readRulesetLive(filling, travellerBuild(), used.live);
    assert.equal(live.tracks.find((track) => track.id === "wounds")!.value, 1);
  }

  // ── The `battle` bridge: a share of the track, and points on the way back ──
  {
    const bridged = parsedOrThrow(
      woundsDocument((doc) => (doc.battle.health = { track: "wounds" })),
      "a battle block on a plain track",
    );
    const build = travellerBuild();
    const fresh = seedCombatantFromSheet(bridged, build, {}, 60);
    assert.ok(fresh);
    assert.deepEqual([fresh.hp, fresh.maxHp, fresh.sheetHp, fresh.sheetMaxHp], [60, 60, 5, 5]);
    const hurt = seedCombatantFromSheet(bridged, build, { tracks: { wounds: 2 } }, 60);
    assert.ok(hurt);
    assert.deepEqual([hurt.sheetHp, hurt.hp], [3, 36]);
    // The Engine took the fresh member to 24 of 60, two fifths: three wounds written.
    assert.deepEqual(sheetOpsFromCombatResult(bridged, fresh, { hp: 24 }), [{ op: "track", track: "wounds", by: 3 }]);
    // And healed whole, the two wounds come off.
    assert.deepEqual(sheetOpsFromCombatResult(bridged, hurt, { hp: 60 }), [{ op: "track", track: "wounds", by: -2 }]);
    assert.deepEqual(sheetOpsFromCombatResult(bridged, fresh, { hp: 60 }), []);
  }

  // ── Refusals at import ──
  {
    const refuse = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(woundsDocument(edit));
      assert.equal(result.ok, false, `expected a refusal matching ${pattern}`);
      const issues = result.ok ? [] : result.issues;
      assert.ok(
        issues.some((issue) => pattern.test(issue)),
        `expected ${pattern} in ${JSON.stringify(issues)}`,
      );
    };
    refuse((doc) => (doc.sheet.live.tracks.at(-1).max = 0), /"wounds" has no room above its floor/);
    refuse(
      (doc) => (doc.sheet.live.tracks.at(-1).default = 5),
      /"wounds" starts full, so it cannot be the health track/,
    );
    refuse(
      (doc) => (doc.combat.damageKinds = { default: "bruise", marks: "per-blow" }),
      /Health is the plain track "wounds", which fills by points and keeps no kinds/,
    );
    // The shipped entries that grant temporary points, put back.
    refuse(
      (doc) => (doc.catalogs = JSON.parse(emberText).catalogs),
      /Health is the track "wounds", which carries no buffer for temporary points/,
    );
    // A start read off the sheet could be full, so a health track starts at its default.
    refuse(
      (doc) => (doc.sheet.live.tracks.at(-1).startFrom = { field: "toughness" }),
      /"wounds" starts where the sheet says, so it may start full: a health track starts at its default/,
    );
  }

  // ── A threshold the sheet works out is each character's own ──
  {
    const threshold = parsedOrThrow(
      woundsDocument((doc) => (doc.sheet.live.tracks.at(-1).max = { field: "toughness" })),
      "a threshold read off the sheet",
    );
    const tough = (toughness: number, live: unknown = {}) => ({
      ...traveller(live),
      build: buildOf({ ...travellerBuild(), fields: { calling: "Hauler", toughness } }),
    });
    const state = createRulesetEncounter({
      definition: threshold,
      seed: 4242,
      combatants: [tough(2, { tracks: { wounds: 1 } }), hound],
      roller: dice(6, 5, 1, 1),
    });
    assert.deepEqual(rulesetCombatHealth(threshold, threshold.combat!, who(state, "juno")), {
      value: 1,
      max: 2,
      temp: 0,
    });
    // A build whose threshold comes to nothing has no health to fight with, as a pool whose
    // maximum comes to nothing has none: that is the character, not a broken ruleset.
    const none = createRulesetEncounter({
      definition: threshold,
      seed: 4242,
      combatants: [tough(0), hound],
      roller: dice(6, 5, 1, 1),
    });
    assert.deepEqual(rulesetCombatHealth(threshold, threshold.combat!, who(none, "juno")), {
      value: 0,
      max: 0,
      temp: 0,
    });
  }

  // ── Health on a plain track needs 1.383 to install ──
  {
    const manifest = (minor: number) =>
      ({
        schemaVersion: 2,
        capabilityApi: { major: 1, minor },
        id: "ruleset-test",
        kind: ["ruleset"],
        permissions: [],
        restartRequired: false,
        contributions: { assets: { paths: ["ruleset.json"] } },
      }) as never;
    const issue = /fight health is a plain track that fills up requires schemaVersion 2 and capabilityApi 1\.383/;
    const plain = { sheet: { live: { tracks: [{ id: "wounds", min: 0, max: 5 }] } } };
    for (const block of ["combat", "battle"]) {
      const ruleset = { ...plain, [block]: { health: { track: "wounds" } } } as never;
      assert.match(getCapabilityPackageInstallIssue(manifest(382), ruleset) ?? "", issue, block);
      assert.equal(getCapabilityPackageInstallIssue(manifest(383), ruleset), null, block);
    }
    // A wound track, or a pool, was health before.
    const wound = {
      sheet: { live: { tracks: [{ id: "harm", min: 0, max: 2, levels: [{ label: "a" }, { label: "b" }] }] } },
      combat: { health: { track: "harm" } },
    } as never;
    assert.doesNotMatch(getCapabilityPackageInstallIssue(manifest(382), wound) ?? "", issue);
  }

  console.info("game ruleset combat health track regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
