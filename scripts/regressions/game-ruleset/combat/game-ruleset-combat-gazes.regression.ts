/**
 * Gazes, and auras by who they reach (Capability API 1.268).
 *
 *   - `save.failedBy`: a medusa's gaze, restrained on a failure, petrified on a failure by 5 or more.
 *   - `save.avert`: a creature that averts its eyes skips the gaze's save and cannot see its holder
 *     until it looks again; the director averts while anybody else is left to fight.
 *   - `targetTypes`: a sea hag's Horrific Appearance reaches humanoids only.
 *   - `saveEnds.seenLean`: its repeated save is rolled with disadvantage while she is in sight.
 *   - `sourcesOf`: a barbed devil's Barbed Hide harms only whoever grapples it.
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
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import { rulesetOptionLabel } from "../../../../packages/client/src/lib/ruleset-combat-menu.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-gazes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 263);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const conditionOf = (doc: Record<string, any>, id: string) =>
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === id);
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.combat.creatureTypes = {
      types: ["beast", "fey", "fiend", "humanoid", "monstrosity"].map((id) => ({ id, label: id })),
      field: "race",
      default: "humanoid",
    };
    for (const [id, label] of [
      ["gazing", "Petrifying Gaze"],
      ["horrific", "Horrific Appearance"],
      ["barbed", "Barbed Hide"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      {
        condition: "gazing",
        effects: [],
        auras: [
          {
            distance: 30,
            side: "enemies",
            save: {
              save: "con_save",
              difficulty: 14,
              seen: true,
              avert: true,
              applies: [{ condition: "restrained", duration: { rounds: 1 } }],
              failedBy: { atLeast: 5, applies: [{ condition: "petrified", duration: { rounds: 10 } }] },
            },
          },
        ],
      },
      {
        condition: "horrific",
        effects: [],
        auras: [
          {
            distance: 30,
            side: "enemies",
            targetTypes: { is: { types: ["humanoid"] } },
            save: {
              save: "wis_save",
              difficulty: 11,
              seen: true,
              immuneOnSuccess: true,
              immuneWhenEnds: true,
              applies: [
                {
                  condition: "frightened",
                  duration: "until-save",
                  saveEnds: { save: "wis_save", at: "turn-end", seenLean: "disadvantage" },
                },
              ],
            },
          },
        ],
      },
      {
        condition: "barbed",
        effects: [],
        auras: [{ distance: 5, side: "enemies", sourcesOf: ["grappled"], harms: { flat: 5, type: "piercing" } }],
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
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(document());
  const build = (race = "Human") =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      fields: { level: 1, ac: 14, speed: 30, hp_max: 40, race },
      lists: {},
    });
  const block = (keepsOn: string[], extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    keepsOn,
    type: "monstrosity",
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 0, sides: 0, flat: 1 } }],
    ...extra,
  });
  // Faces by die size; 10 for anything not queued.
  let faces: Record<number, number[]> = {};
  const roll = (sides: number) => faces[sides]?.shift() ?? 10;
  const fight = (
    foes: Record<string, { x: number; block: RulesetStatBlock }>,
    party: Record<string, { x: number; race?: string }> = { hero: { x: 0 } },
    walls: number[] = [],
  ): RulesetEncounterState => {
    faces = {};
    const width = 12;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        ...Object.entries(party).map(([id, one]) => ({
          id,
          name: id[0]!.toUpperCase() + id.slice(1),
          side: "party" as const,
          build: build(one.race),
          live: {},
        })),
        ...Object.entries(foes).map(([id, one]) => ({
          id,
          name: id[0]!.toUpperCase() + id.slice(1),
          side: "enemy" as const,
          block: one.block,
        })),
      ],
      board: {
        grid: {
          width,
          height: 1,
          tiles: [Array.from({ length: width }, (_, x) => (walls.includes(x) ? "wall" : "plains"))],
          elevation: [Array(width).fill(0)],
        } as never,
        placements: Object.fromEntries(
          [...Object.entries(party), ...Object.entries(foes)].map(([id, one]) => [id, { x: one.x, y: 0 }]),
        ),
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const done = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const endTurn = (state: RulesetEncounterState, id: string) =>
    act(state, { actorId: id, optionId: "end-turn", targetIds: [] });
  /** From the last turn of the round into the hero's: its turn starts, and the gaze asks its save. */
  const intoHero = (state: RulesetEncounterState) => {
    state.turn = state.order.length - 1;
    return endTurn(state, state.order.at(-1)!);
  };
  const savesOf = (events: RulesetCombatEvent[], id: string) => of(events, "save").filter((one) => one.actorId === id);

  // ── The medusa's gaze: restrained on a failure, petrified when it fails by 5 or more ──
  {
    const passed = fight({ medusa: { x: 3, block: block(["gazing"]) } });
    faces = { 20: [20] };
    const ok = intoHero(passed);
    assert.equal(savesOf(ok.events, "hero").length, 1);
    assert.equal(savesOf(ok.events, "hero")[0]!.success, true);
    assert.ok(!has(ok.state, "hero", "restrained") && !has(ok.state, "hero", "petrified"));

    const near = fight({ medusa: { x: 3, block: block(["gazing"]) } });
    faces = { 20: [11] };
    const missed = intoHero(near);
    const save = savesOf(missed.events, "hero")[0]!;
    assert.equal(save.success, false);
    assert.ok(save.difficulty - save.total < 5, `${save.total} against ${save.difficulty}`);
    assert.ok(has(missed.state, "hero", "restrained"));
    assert.ok(!has(missed.state, "hero", "petrified"));

    const far = fight({ medusa: { x: 3, block: block(["gazing"]) } });
    faces = { 20: [1] };
    const stoned = intoHero(far);
    const bad = savesOf(stoned.events, "hero")[0]!;
    assert.ok(bad.difficulty - bad.total >= 5, `${bad.total} against ${bad.difficulty}`);
    assert.ok(has(stoned.state, "hero", "petrified"), "failed by 5 or more: petrified instead");
    assert.ok(!has(stoned.state, "hero", "restrained"));
  }

  // ── Averting the eyes: no save, and the medusa unseen, until the hero looks again ──
  {
    const state = fight({ medusa: { x: 3, block: block(["gazing"]) }, goblin: { x: 5, block: block([]) } });
    const avert = rulesetCombatOptions(definition, state, "hero").find((one) => one.avert)!;
    assert.equal(avert.id, "avert:medusa");
    assert.deepEqual(avert.avert, { holderId: "medusa" });
    assert.equal(avert.budget, undefined, "free");
    const t = ((key: string, values: any) => `${key}:${values.target}`) as any;
    assert.equal(rulesetOptionLabel(avert as never, t), "game.combat.ruleset.menu.avert:Medusa");
    // Nobody offers to avert from a creature with no gaze.
    assert.equal(rulesetCombatOptions(definition, state, "hero").filter((one) => one.avert).length, 1);
    const averted = act(state, { actorId: "hero", optionId: avert.id, targetIds: [] });
    assert.deepEqual(of(averted.events, "averted"), [{ type: "averted", actorId: "hero", holderId: "medusa" }]);
    assert.deepEqual(who(averted.state, "hero").averted, ["medusa"]);
    assert.equal(
      rulesetCanSee(definition, averted.state, who(averted.state, "hero"), who(averted.state, "medusa")),
      false,
    );
    assert.equal(
      rulesetCanSee(definition, averted.state, who(averted.state, "hero"), who(averted.state, "goblin")),
      true,
    );
    assert.equal(
      rulesetCanSee(definition, averted.state, who(averted.state, "medusa"), who(averted.state, "hero")),
      true,
    );
    // Its turn comes round: no gaze save.
    faces = { 20: [1] };
    const next = intoHero(averted.state);
    assert.equal(savesOf(next.events, "hero").length, 0, "averted, the gaze asks nothing");
    assert.ok(!has(next.state, "hero", "petrified"));
    // Looking again.
    const back = rulesetCombatOptions(definition, next.state, "hero").find((one) => one.avert)!;
    assert.deepEqual(back.avert, { holderId: "medusa", back: true });
    assert.equal(rulesetOptionLabel(back as never, t), "game.combat.ruleset.menu.lookBack:Medusa");
    const looked = act(next.state, { actorId: "hero", optionId: back.id, targetIds: [] });
    assert.deepEqual(of(looked.events, "averted"), [
      { type: "averted", actorId: "hero", holderId: "medusa", back: true },
    ]);
    assert.equal(who(looked.state, "hero").averted, undefined);
    faces = { 20: [1] };
    const gazed = intoHero(looked.state);
    assert.equal(savesOf(gazed.events, "hero").length, 1, "looking again, the gaze asks its save");
  }

  // ── The sea hag: humanoids only; the repeated save with disadvantage while she is in sight ──
  {
    const state = fight(
      { hag: { x: 3, block: block(["horrific"]) } },
      { hero: { x: 0 }, wolf: { x: 1, race: "beast" } },
    );
    assert.equal(
      rulesetCombatOptions(definition, state, "hero").some((one) => one.avert),
      false,
      "her face is no gaze to avert from",
    );
    faces = { 20: [1, 1] };
    const hero = intoHero(state);
    assert.ok(has(hero.state, "hero", "frightened"));
    // The beast's own turn starts: nothing asked of it.
    const wolf = endTurn(hero.state, "hero");
    assert.equal(savesOf(wolf.events, "wolf").length, 0, "a beast is no humanoid");
    assert.ok(!has(wolf.state, "wolf", "frightened"));
    // Ending its turn in her sight, the hero saves with disadvantage.
    const frightened = structuredClone(hero.state);
    faces = { 20: [15, 2] };
    const ended = endTurn(frightened, "hero");
    const resave = savesOf(ended.events, "hero")[0]!;
    assert.equal(resave.rolls.length, 2, "rolled twice");
    assert.equal(resave.kept, 2, "the lower kept");
    // Saved off at last, the fright ended: her aura stays off the hero for the fight (1.269).
    const shaken = structuredClone(hero.state);
    faces = { 20: [20, 20] };
    const freed = endTurn(shaken, "hero");
    assert.ok(!has(freed.state, "hero", "frightened"));
    assert.deepEqual(who(freed.state, "hero").auraSafe, ["hag/horrific"]);
    faces = { 20: [1, 1] };
    const round = intoHero(endTurn(freed.state, "wolf").state);
    assert.equal(savesOf(round.events, "hero").length, 0, "immune once the effect ended");
    // Without immuneWhenEnds, she asks again.
    const plain = structuredClone(hero.state);
    delete who(plain, "hero").tracked.find((one) => one.condition === "frightened")!.auraSafeOnEnd;
    faces = { 20: [20, 20] };
    const again = intoHero(endTurn(endTurn(plain, "hero").state, "wolf").state);
    assert.equal(savesOf(again.events, "hero").length, 1, "asked again");
    // Out of her sight, once.
    const hidden = fight({ hag: { x: 3, block: block(["horrific"]) } }, { hero: { x: 0 } }, [2]);
    who(hidden, "hero").tracked.push(
      structuredClone(who(hero.state, "hero").tracked.find((one) => one.condition === "frightened")!),
    );
    faces = { 20: [15, 2] };
    const unseen = endTurn(hidden, "hero");
    assert.equal(savesOf(unseen.events, "hero")[0]!.rolls.length, 1, "out of sight, rolled once");
  }

  // ── The barbed devil: its spikes harm whoever grapples it, and nobody else beside it ──
  {
    const state = fight({ devil: { x: 1, block: block(["barbed"]) } }, { hero: { x: 0 }, friend: { x: 2 } });
    who(state, "devil").tracked.push({ condition: "grappled", rounds: null, source: "hero" });
    state.turn = state.order.indexOf("friend");
    const turn = endTurn(state, "friend");
    const harmed = of(turn.events, "damage").map((one) => [one.targetId, one.dealt]);
    assert.deepEqual(harmed, [["hero", 5]]);
    const loose = structuredClone(state);
    who(loose, "devil").tracked = [];
    assert.deepEqual(of(endTurn(loose, "friend").events, "damage"), [], "nobody grapples it");
  }

  // ── Import ──
  {
    refused(
      document((doc) => delete conditionOf(doc, "gazing").auras[0].save.seen),
      /Averting the eyes goes with a "seen" save/,
    );
    refused(
      document((doc) => (conditionOf(doc, "gazing").auras[0].save.failedBy.applies[0].condition = "stoned")),
      /Unknown condition "stoned"/,
    );
    refused(
      document((doc) => (conditionOf(doc, "barbed").auras[0].sourcesOf = ["held_fast"])),
      /Unknown condition "held_fast"/,
    );
    refused(
      document((doc) => (conditionOf(doc, "horrific").auras[0].targetTypes = { is: { types: ["ooze"] } })),
      /ooze/,
    );
    refused(
      document((doc) => (conditionOf(doc, "horrific").auras[0].save.applies[0].saveEnds.seenLean = "sideways")),
      /seenLean/,
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
      "A ruleset with auras reaching only some kinds of creature or whoever holds its holder, an aura save worse when failed by enough or one whose holder's eyes can be averted, or a save rolled leaning while its source is in sight, requires schemaVersion 2 and capabilityApi 1.268 or newer";
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const only = (keep: (doc: Record<string, any>) => void) =>
      document((doc) => {
        delete conditionOf(doc, "gazing").auras[0].save.avert;
        delete conditionOf(doc, "gazing").auras[0].save.failedBy;
        delete conditionOf(doc, "horrific").auras[0].targetTypes;
        delete conditionOf(doc, "horrific").auras[0].save.applies[0].saveEnds.seenLean;
        delete conditionOf(doc, "barbed").auras[0].sourcesOf;
        delete conditionOf(doc, "horrific").auras[0].save.immuneWhenEnds;
        keep(doc);
      });
    assert.notEqual(
      issue(
        267,
        only(() => {}),
      ),
      gate,
      "nothing of 1.268 left",
    );
    const cases: Array<[string, (doc: Record<string, any>) => void]> = [
      ["avert", (doc) => (conditionOf(doc, "gazing").auras[0].save.avert = true)],
      [
        "failedBy",
        (doc) =>
          (conditionOf(doc, "gazing").auras[0].save.failedBy = {
            atLeast: 5,
            applies: [{ condition: "petrified", duration: { rounds: 10 } }],
          }),
      ],
      ["targetTypes", (doc) => (conditionOf(doc, "horrific").auras[0].targetTypes = { is: { types: ["humanoid"] } })],
      ["seenLean", (doc) => (conditionOf(doc, "horrific").auras[0].save.applies[0].saveEnds.seenLean = "disadvantage")],
      ["sourcesOf", (doc) => (conditionOf(doc, "barbed").auras[0].sourcesOf = ["grappled"])],
    ];
    for (const [name, keep] of cases) {
      const doc = only(keep);
      parsed(doc);
      assert.equal(issue(267, doc), gate, name);
      assert.notEqual(issue(268, doc), gate, name);
    }
    assert.equal(
      issue(
        267,
        only(() => {}),
        new Map([["extra.json", { saveEnds: { save: "wis_save", seenLean: "advantage" } }]]),
      ),
      gate,
    );
  }

  console.log(
    "Ruleset gazes: a medusa's gaze restrains, or petrifies on a failure by 5 or more; averted eyes skip it and lose sight of her until they look again; a sea hag frightens humanoids only and her repeated save has disadvantage in sight; a barbed devil harms only its grappler; gated at 1.268.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
