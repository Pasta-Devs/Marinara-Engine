/**
 * Calm Emotions (Capability API 1.278).
 *
 *   - `save.alliesMayFail`: its user's own side fails the save without rolling; anybody else rolls.
 *   - `cannot-target-source-side`: its holder points nothing at whoever put it on them or at their
 *     side, unless that side is its holder's own.
 *   - `endsWhen` "attacked": an attack roll at its holder, from anybody, hit or miss. An action that
 *     hits without a roll is not one.
 *   - `endsWhenHarmedFrom`: harm from what is cast out of these catalogs, from anybody; casting the
 *     very same condition on again is not harm to it.
 *   - `endsWhen` "ally-harmed-in-sight": damage to one of its holder's own side that it sees.
 *   - Import refusals and the install gate.
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
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-calm-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 273);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>): RulesetCatalogEntry =>
    ({
      id,
      label: id,
      rows: [{ list: "spells", values: { name: id, level: 1, prepared: true } }],
      mechanics: { range: 60, ...mechanics },
    }) as RulesetCatalogEntry;
  const spells = [
    spell("calm", {
      kind: "debuff",
      targets: "any",
      save: { save: "wis_save", onSuccess: "negates", alliesMayFail: true },
      applies: [{ condition: "calm", duration: { rounds: 10 } }],
    }),
    spell("sting", { kind: "attack", attackRoll: true, amount: { flat: 3 } }),
    spell("zap", { kind: "attack", autoHit: true, amount: { flat: 3 } }),
  ];
  const tricks = [spell("jab", { kind: "attack", autoHit: true, amount: { flat: 3 } })];
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    doc.catalogs.push({ id: "tricks", label: "Tricks", feeds: ["spells"], entries: structuredClone(tricks) });
    for (const id of ["calm", "calm_a", "calm_s", "calm_w"]) doc.sheet.live.conditions.push({ id, label: id });
    doc.combat.conditions.push(
      {
        condition: "calm",
        effects: ["cannot-target-source-side"],
        endsWhen: ["attacked", "ally-harmed-in-sight"],
        endsWhenHarmedFrom: ["spells"],
      },
      { condition: "calm_a", effects: [], endsWhen: ["attacked"] },
      { condition: "calm_s", effects: [], endsWhenHarmedFrom: ["spells"] },
      { condition: "calm_w", effects: [], endsWhen: ["ally-harmed-in-sight"] },
    );
    // Blinded takes the eyes away.
    doc.combat.sight = { eyes: "sight" };
    for (const entry of doc.combat.conditions) if (entry.condition === "blinded") entry.lacks = ["sight"];
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
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      return faces[index++]!;
    };
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);
  const block = (): RulesetStatBlock => ({
    health: 80,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    saves: { wis_save: 3 },
    actions: [
      { id: "bite", name: "Bite", budget: "action", toHit: 4, reach: 60, damage: { count: 0, sides: 0, flat: 5 } },
    ],
  });
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 80, spellcasting_ability: "int", slots_max_1: 9 },
            lists: {
              spells: [
                ...spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
                ...tricks.flatMap((entry) => rowsFromCatalogEntry("tricks", entry).map((row) => row.row)),
              ],
            },
          }),
          live: {},
          catalogs: { spells, tricks },
        },
        { id: "pal", name: "Pal", side: "enemy", block: block() },
        { id: "orc", name: "Orc", side: "enemy", block: block() },
        { id: "orc2", name: "Orc2", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 12, height: 1, tiles: [Array(12).fill("plains")] } as never,
        placements: { corwin: { x: 0, y: 0 }, pal: { x: 1, y: 0 }, orc: { x: 4, y: 0 }, orc2: { x: 6, y: 0 } },
      },
    });
    rulesetCombatant(state, "pal")!.side = "party";
    state.order = ["corwin", "pal", "orc", "orc2"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const give = (state: RulesetEncounterState, condition: string, target = "orc", source = "corwin") => {
    who(state, target).tracked.push({ condition, source, rounds: null } as never);
    return state;
  };
  const has = (state: RulesetEncounterState, condition: string, target = "orc") =>
    rulesetCombatConditions(definition, who(state, target)).includes(condition);
  const use = (state: RulesetEncounterState, actorId: string, label: string, targetIds: string[], faces: number[]) => {
    state.turn = state.order.indexOf(actorId);
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds },
      dice(...faces),
    );
    assert.deepEqual(eventsOf(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };

  // ── A friend lets it in; anybody else rolls ──
  {
    const friend = use(fight(), "corwin", "calm", ["pal"], []);
    const save = eventsOf(friend.events, "save")[0];
    assert.ok(save, "a save is recorded");
    assert.equal(save.success, false);
    assert.equal(save.automatic, true, "nothing rolled");
    assert.ok(has(friend.state, "calm", "pal"));
    const resisted = use(fight(), "corwin", "calm", ["orc"], [20]);
    assert.equal(eventsOf(resisted.events, "save")[0]?.automatic, undefined, "a foe rolls");
    assert.equal(has(resisted.state, "calm"), false);
    assert.ok(has(use(fight(), "corwin", "calm", ["orc"], [1]).state, "calm"));
  }

  // ── Kept off the caster's whole side, not its own ──
  {
    const targetsOf = (state: RulesetEncounterState, actorId: string) => {
      state.turn = state.order.indexOf(actorId);
      const bite = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === "Bite");
      assert.ok(bite, `${actorId} may bite`);
      return rulesetOptionTargets(definition, state, actorId, bite);
    };
    assert.deepEqual(targetsOf(fight(), "orc").sort(), ["corwin", "pal"], "calm: both");
    assert.deepEqual(targetsOf(give(fight(), "calm"), "orc"), [], "calm: neither");
    // Calmed by a friend: nobody is kept off.
    assert.deepEqual(targetsOf(give(fight(), "calm", "pal"), "pal").sort(), ["orc", "orc2"]);
    // Calmed by a friend, a spell for friends still reaches them.
    const calmed = give(fight(), "calm", "corwin", "pal");
    calmed.turn = 0;
    const calm = rulesetCombatOptions(definition, calmed, "corwin").find((one) => one.label === "calm")!;
    assert.ok(rulesetOptionTargets(definition, calmed, "corwin", calm).includes("pal"), "a friend is not kept off");
    // Calmed by one of the caster's side: kept off that whole side as well.
    assert.deepEqual(targetsOf(give(fight(), "calm", "orc", "pal"), "orc"), []);
  }

  // ── Attacked: any attack roll, hit or miss; one that cannot miss is no attack roll ──
  {
    assert.equal(has(use(give(fight(), "calm_a"), "corwin", "sting", ["orc"], [1]).state, "calm_a"), false, "a miss");
    assert.equal(has(use(give(fight(), "calm_a"), "pal", "Bite", ["orc"], [20]).state, "calm_a"), false, "a hit");
    const zapped = use(give(fight(), "calm_a"), "corwin", "zap", ["orc"], []);
    assert.ok(has(zapped.state, "calm_a"), "no attack roll");
    assert.ok(
      has(use(give(fight(), "calm_a"), "corwin", "calm", ["orc"], [20]).state, "calm_a"),
      "a save is no attack",
    );
    // A blow its maker writes down as never missing is no roll either, though it says a bonus.
    const sure = give(fight(), "calm_a");
    who(sure, "pal").actions.find((one) => one.label === "Bite")!.autoHit = true;
    assert.ok(has(use(sure, "pal", "Bite", ["orc"], []).state, "calm_a"), "a blow that cannot miss");
    assert.ok(eventsOf(zapped.events, "damage").length > 0);
  }

  // ── Harmed by a spell: out of the catalog named, from anybody ──
  {
    const zapped = use(give(fight(), "calm_s"), "corwin", "zap", ["orc"], []);
    assert.equal(has(zapped.state, "calm_s"), false);
    assert.equal(eventsOf(zapped.events, "condition").at(-1)?.reason, "harmed");
    assert.ok(has(use(give(fight(), "calm_s"), "corwin", "jab", ["orc"], []).state, "calm_s"), "another catalog");
    assert.ok(has(use(give(fight(), "calm_s"), "pal", "Bite", ["orc"], [20]).state, "calm_s"), "a bite is no spell");
    // Cast on again: refreshed, not ended, and not ended by the try either.
    assert.ok(has(use(give(fight(), "calm"), "corwin", "calm", ["orc"], [1]).state, "calm"), "recast");
    assert.ok(has(use(give(fight(), "calm"), "corwin", "calm", ["orc"], [20]).state, "calm"), "recast resisted");
    // From anybody, not only whoever put it on or their side.
    const theirs = give(fight(), "calm_s", "orc", "orc2");
    assert.equal(has(use(theirs, "corwin", "zap", ["orc"], []).state, "calm_s"), false, "the other side's spell");
  }

  // ── A friend harmed in sight ──
  {
    const seen = use(give(fight(), "calm_w"), "corwin", "jab", ["orc2"], []);
    assert.equal(has(seen.state, "calm_w"), false, "seen");
    const blind = give(give(fight(), "calm_w"), "blinded");
    assert.ok(has(use(blind, "corwin", "jab", ["orc2"], []).state, "calm_w"), "a blind holder sees nothing");
    assert.ok(
      has(use(give(fight(), "calm_w"), "corwin", "jab", ["orc"], []).state, "calm_w"),
      "its own harm is not a friend's",
    );
    assert.ok(has(use(give(fight(), "calm_w"), "orc2", "Bite", ["pal"], [20]).state, "calm_w"), "a foe harmed");
    const walled = give(fight(), "calm_w");
    // Moved past a wall from its friend, though not from the caster.
    who(walled, "orc").x = 8;
    walled.board!.grid.tiles[0]![7] = "wall" as never;
    assert.ok(has(use(walled, "corwin", "jab", ["orc2"], []).state, "calm_w"), "behind a wall");
    // The same ally harm also ends the full Calm.
    assert.equal(has(use(give(fight(), "calm"), "corwin", "jab", ["orc2"], []).state, "calm"), false);
  }

  // ── Import ──
  {
    refused(
      document((doc) => {
        doc.combat.conditions.find((one: any) => one.condition === "calm_s").endsWhenHarmedFrom = ["nowhere"];
      }),
      /Unknown catalog "nowhere"/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.find((one: any) => one.condition === "calm_a").endsWhen = ["attacked", "attacked"];
      }),
      /unique/,
    );
    refused(
      document((doc) => {
        doc.combat.conditions.find((one: any) => one.condition === "calm_a").endsWhen = ["attacked", "crying"];
      }),
      /endsWhen/,
    );
    parsed(
      document((doc) => {
        doc.combat.conditions.find((one: any) => one.condition === "calm_a").endsWhen = [
          "damaged",
          "harmed-by-source-side",
          "attacked",
          "ally-harmed-in-sight",
        ];
      }),
    );
  }

  // ── The install gate ──
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
      "A ruleset with a save its user's side may fail, a condition that keeps its holder off a whole side, or one that ends on an attack, on harm from a catalog or on a friend harmed in sight requires schemaVersion 2 and capabilityApi 1.278 or newer";
    const plain = () => {
      const doc = JSON.parse(fiveEText);
      doc.sheet.live.conditions.push({ id: "calm", label: "calm" });
      doc.catalogs.push({
        id: "spells",
        label: "Spells",
        entries: [spell("zap", { kind: "attack", autoHit: true, amount: { flat: 3 } })],
      });
      return doc;
    };
    const variants: Array<(doc: Record<string, any>) => void> = [
      (doc) =>
        (doc.catalogs.at(-1).entries[0].mechanics.save = {
          save: "wis_save",
          onSuccess: "negates",
          alliesMayFail: true,
        }),
      (doc) => doc.combat.conditions.push({ condition: "calm", effects: ["cannot-target-source-side"] }),
      (doc) => doc.combat.conditions.push({ condition: "calm", endsWhen: ["attacked"] }),
      (doc) => doc.combat.conditions.push({ condition: "calm", endsWhen: ["ally-harmed-in-sight"] }),
      (doc) => doc.combat.conditions.push({ condition: "calm", endsWhenHarmedFrom: ["spells"] }),
    ];
    for (const variant of variants) {
      const doc = plain();
      variant(doc);
      assert.equal(getCapabilityPackageInstallIssue(manifest(277) as never, doc), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(278) as never, doc), gate);
    }
    const older = plain();
    older.combat.conditions.push({ condition: "calm", endsWhen: ["damaged", "harmed-by-source-side"] });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(277) as never, older), gate, "older endings");
  }

  console.log(
    "Ruleset Calm Emotions: friends fail its save unrolled, its holder is kept off the caster's side, and it ends when attacked, harmed by a spell or a friend is harmed in sight; gated at 1.278.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
