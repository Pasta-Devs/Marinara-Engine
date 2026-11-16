/**
 * A creature's own ways of hiding and looking (Capability API 1.291).
 *
 *   - A creature action's `standard`: standard actions with that action's own budget (Nimble
 *     Escape), with `while: "obscured"` only in a fog or in dim light or darkness (Shadow Stealth).
 *   - A creature's `checkModes`: its own checks with some skills rolled twice, only while it can
 *     see, in some lights, or on some ground (Keen Sight, Sunlight Sensitivity, camouflage).
 *   - A creature's printed `passive` Perception.
 *   - The light a fight is fought in, off the scene's time of day, and the kind of place it is.
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
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetLightMatches,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetBoardLight,
  type RulesetCombatChoice,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-seeking-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createRulesetFight, rulesetBoardLightFor } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 286);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const claw = { id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { dice: "1d4", flat: 0 }, reach: 5 };
  const creature = (id: string, extra: Record<string, unknown>, actions: unknown[] = []) => ({
    id,
    label: id[0]!.toUpperCase() + id.slice(1),
    creature: {
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_1_2",
      checks: { look: 0, sneak: 0 },
      actions: [claw, ...actions],
      ...extra,
    },
  });
  const goblin = creature("goblin", {}, [
    { id: "nimble", name: "Nimble Escape", budget: "bonus", standard: { actions: ["disengage", "hide"] } },
  ]);
  const shadow = creature("shadow", {}, [
    {
      id: "shadow_stealth",
      name: "Shadow Stealth",
      budget: "bonus",
      standard: { actions: ["hide"], while: "obscured" },
    },
  ]);
  const drow = creature("drow", {
    checkModes: [{ skills: ["perception"], mode: "disadvantage", sight: true, light: ["sunlight"] }],
  });
  const hawk = creature("hawk", { checkModes: [{ skills: ["perception"], mode: "advantage", sight: true }] });
  const yeti = creature("yeti", { checkModes: [{ skills: ["stealth"], mode: "advantage", terrain: ["snow"] }] });
  const otter = creature("otter", { checkModes: [{ skills: ["stealth"], mode: "advantage", terrain: ["water"] }] });
  // A printed passive of 13 where 10 + its Perception would be 11.
  const bear = creature("bear", { checks: { look: 1 }, passive: 13 });
  const beasts = [goblin, shadow, drow, hawk, yeti, otter, bear];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sight = { unseenAttacks: true, eyes: "sight" };
    for (const entry of doc.combat.conditions) if (entry.condition === "blinded") entry.lacks = ["sight"];
    doc.combat.checks.push(
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look", passiveMode: 5 };
    doc.combat.standard.push("search");
    doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(...structuredClone(beasts));
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const creaturesId = "creatures";
  const bestiary = Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
    ),
  );

  // ── Built from the bestiary, in the scene's light and place ──
  const built = createRulesetFight({
    definition,
    seed: 3,
    positioned: true,
    environment: "snow",
    time: "12:00",
    party: [{ id: "ada", name: "Ada" }],
    enemies: beasts.map((one) => ({ id: one.id, name: one.label, creature: `${creaturesId}/${one.id}` })),
    cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
    playerName: null,
    live: {},
    items: () => [],
    partyCatalogs: {},
    bestiary,
  } as never);
  assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
  const fought = (built as { fight: { encounter: RulesetEncounterState } }).fight.encounter;
  assert.equal(fought.board?.light, "sunlight", "noon, outdoors");
  assert.equal(fought.board?.environment, "snow");
  const blockOf = (id: string): RulesetStatBlock => structuredClone(rulesetCombatant(fought, id)!.block!);
  assert.deepEqual(blockOf("bear").passive, 13);
  assert.deepEqual(blockOf("hawk").checkModes, [{ skills: ["perception"], mode: "advantage", sight: true }]);
  assert.deepEqual(
    rulesetCombatant(fought, "goblin")!.actions.find((action) => action.label === "Nimble Escape")?.standard,
    { actions: ["disengage", "hide"], budget: "bonus" },
  );

  // A rogue to hide and be looked for: Stealth +3.
  const rogue = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 30 },
    lists: { attacks: [{ name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 }] },
  });
  // A wall down x = 8: the rogue behind it, the beast beyond; a pond at (12,9).
  const fight = (
    beast: string,
    light?: RulesetBoardLight,
    environment = "plains",
    at = { x: 12, y: 5 },
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "rogue", name: "Rogue", side: "party", build: rogue, live: {} },
        { id: beast, name: beast, side: "enemy", block: blockOf(beast) },
      ],
      board: {
        grid: {
          width: 20,
          height: 15,
          tiles: Array.from({ length: 15 }, (_, y) =>
            Array.from({ length: 20 }, (_, x) =>
              x === 8 && y >= 1 && y <= 10 ? "wall" : x === 12 && y === 9 ? "water" : "plains",
            ),
          ),
        } as never,
        placements: { rogue: { x: 6, y: 5 }, [beast]: at },
        ...(light ? { light } : {}),
        environment,
      },
    });
    state.order = ["rogue", beast];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const dice =
    (...faces: number[]) =>
    () =>
      faces.shift() ?? 10;
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice, roll = dice()) => {
    state.turn = state.order.indexOf(choice.actorId);
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return step;
  };
  const optionIds = (state: RulesetEncounterState, id: string) => {
    state.turn = state.order.indexOf(id);
    return rulesetCombatOptions(definition, state, id).map((one) => one.id);
  };
  const thrown = (step: RulesetCombatStep, action: string) => {
    const event = step.events.find((one) => one.type === "standard" && one.action === action);
    assert.ok(event?.type === "standard" && event.check, JSON.stringify(step.events));
    return event.check!;
  };

  // ── Nimble Escape: Disengage or Hide with the bonus action ──
  {
    const state = fight("goblin");
    const ids = optionIds(state, "goblin");
    assert.ok(ids.includes("standard:hide@bonus"), ids.join(", "));
    assert.ok(ids.includes("standard:disengage@bonus"));
    assert.ok(!ids.includes("standard:dash@bonus"), "only what it names");
    const step = act(state, { actorId: "goblin", optionId: "standard:hide@bonus", targetIds: [] });
    assert.equal(who(step.state, "goblin").budgets.bonus, 0);
    assert.equal(who(step.state, "goblin").budgets.action, 1, "the action is left");
  }

  // ── Shadow Stealth: only in dim light, darkness or a fog ──
  {
    assert.ok(!optionIds(fight("shadow"), "shadow").includes("standard:hide@bonus"), "bright light");
    assert.ok(!optionIds(fight("shadow", "sunlight"), "shadow").includes("standard:hide@bonus"));
    assert.ok(optionIds(fight("shadow", "dim"), "shadow").includes("standard:hide@bonus"), "dim light");
    assert.ok(optionIds(fight("shadow", "dark"), "shadow").includes("standard:hide@bonus"), "darkness");
    const fogged = fight("shadow");
    who(fogged, "rogue").zones = [
      {
        actionId: "fog",
        label: "Fog",
        rounds: 5,
        anchor: "point",
        triggers: [],
        cells: [{ x: 12, y: 5 }],
        obscures: { pierced: [] },
      },
    ];
    assert.ok(optionIds(fogged, "shadow").includes("standard:hide@bonus"), "in a fog");
    // Taken out of the shadows, it is refused.
    const lit = fight("shadow");
    lit.turn = 1;
    const step = applyRulesetCombatChoice(
      definition,
      lit,
      { actorId: "shadow", optionId: "standard:hide@bonus", targetIds: [] },
      dice(),
    );
    assert.ok(refused(step), "not out in the light");
  }

  // ── Sensitivity to sunlight, keen sight: the passive and the Search ──
  {
    const hidden = (beast: string, light?: RulesetBoardLight, face = 10) => {
      const step = act(fight(beast, light), { actorId: "rogue", optionId: "standard:hide", targetIds: [] }, dice(face));
      return who(step.state, "rogue").hiding?.from ?? [];
    };
    // A 13 against a passive of 10: hidden; in sunlight the drow's is 5, so a 6 does it.
    assert.deepEqual(hidden("drow", "sunlight", 3), ["drow"], "sunlight: passive 5");
    assert.deepEqual(hidden("drow", "bright", 3), [], "bright light that is not the sun's");
    // Keen sight: 15.
    assert.deepEqual(hidden("hawk"), [], "keen: passive 15");
    assert.deepEqual(hidden("hawk", undefined, 12), ["hawk"]);
    const blind = fight("hawk");
    who(blind, "hawk").tracked.push({ condition: "blinded", rounds: null } as never);
    const step = act(blind, { actorId: "rogue", optionId: "standard:hide", targetIds: [] });
    assert.deepEqual(who(step.state, "rogue").hiding?.from, ["hawk"], "blinded, its eyes give it nothing");
    // The drow's Search in sunlight, with disadvantage.
    const searching = fight("drow", "sunlight");
    who(searching, "rogue").hiding = { total: 10, from: ["drow"] };
    const looked = thrown(
      act(searching, { actorId: "drow", optionId: "standard:search", targetIds: [] }, dice(15, 4)),
      "search",
    );
    assert.equal(looked.mode, "disadvantage");
    assert.equal(looked.total, 4);
    // A printed passive: 13, not 11.
    assert.deepEqual(hidden("bear", undefined, 9), [], "12 against the printed 13");
    assert.deepEqual(hidden("bear", undefined, 10), ["bear"]);
  }

  // ── Camouflage: by the place, or by the ground it stands on ──
  {
    const hides = (state: RulesetEncounterState, beast: string) =>
      thrown(act(state, { actorId: beast, optionId: "standard:hide", targetIds: [] }, dice(15, 4)), "hide");
    assert.equal(hides(fight("yeti", undefined, "snow"), "yeti").mode, "advantage", "in the snow");
    assert.equal(hides(fight("yeti"), "yeti").mode, undefined, "on the plains");
    assert.equal(hides(fight("otter", undefined, "plains", { x: 12, y: 9 }), "otter").mode, "advantage", "in the pond");
    assert.equal(hides(fight("otter"), "otter").mode, undefined, "on dry land");
    assert.equal(hides(fight("hawk"), "hawk").mode, undefined, "keen eyes do not hide it");
  }

  // ── The light off the scene's time ──
  {
    assert.equal(rulesetLightMatches("sunlight", "bright"), true, "sunlight is bright light");
    assert.equal(rulesetLightMatches(undefined, "bright"), true);
    assert.equal(rulesetLightMatches("bright", "sunlight"), false);
    assert.equal(rulesetBoardLightFor("noon", "plains"), "sunlight");
    assert.equal(rulesetBoardLightFor("14:30", "forest"), "sunlight");
    assert.equal(rulesetBoardLightFor("7pm", "plains"), "dim");
    assert.equal(rulesetBoardLightFor("6:15 am", "plains"), "dim");
    assert.equal(rulesetBoardLightFor("23:00", "plains"), "dark");
    assert.equal(rulesetBoardLightFor("12am", "plains"), "dark");
    assert.equal(rulesetBoardLightFor("Late night", "snow"), "dark");
    assert.equal(rulesetBoardLightFor("dusk", undefined), "dim");
    assert.equal(rulesetBoardLightFor("Morning", "plains"), "sunlight");
    assert.equal(rulesetBoardLightFor("noon", "castle"), undefined, "indoors, its own lamps");
    // A cave is dark at any hour (1.294).
    assert.equal(rulesetBoardLightFor("noon", "cave"), "dark");
    assert.equal(rulesetBoardLightFor(null, "dungeon"), "dark");
    assert.equal(rulesetBoardLightFor(null, "plains"), undefined);
    assert.equal(rulesetBoardLightFor("the third bell", "plains"), undefined);
  }

  // ── Refusals ──
  {
    const withBeast = (entry: unknown, edit: (doc: Record<string, any>) => void = () => {}) =>
      fiveE((doc) => {
        doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(entry);
        edit(doc);
      });
    refusedDoc(
      withBeast(creature("odd", { checkModes: [{ skills: ["flying"], mode: "advantage" }] })),
      /Unknown skill "flying"/,
    );
    refusedDoc(
      withBeast(
        creature("odd", {}, [{ id: "odd", name: "Odd", budget: "bonus", standard: { actions: ["search", "fly"] } }]),
      ),
      /standard/,
    );
    refusedDoc(
      withBeast(
        creature("odd", {}, [{ id: "odd", name: "Odd", budget: "bonus", standard: { actions: ["dodge"] } }]),
        (doc) => {
          doc.combat.standard = doc.combat.standard.filter((one: string) => one !== "dodge");
        },
      ),
      /Unknown standard action "dodge"/,
    );
    refusedDoc(
      withBeast(creature("odd", { passive: 12 }), (doc) => {
        doc.combat.standard = doc.combat.standard.filter((one: string) => one !== "search");
        delete doc.combat.hiding;
      }),
      /printed passive Perception is read by hiding/,
    );
    refusedDoc(
      withBeast(creature("odd", { checkModes: [{ skills: ["stealth"], mode: "advantage", light: ["moon"] }] })),
      /light/,
    );
  }

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
      "A ruleset with a creature that has its own modes on checks, a printed passive Perception, or standard actions with its own budget requires schemaVersion 2 and capabilityApi 1.291 or newer";
    const only = (beast: unknown) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(beast);
      return doc;
    };
    for (const beast of [goblin, hawk, bear]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(290) as never, only(beast)), gate, beast.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(291) as never, only(beast)), gate, beast.id);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(290) as never, only(creature("plain", {}))), gate);
  }

  console.log(
    "Creature seeking: Nimble Escape and Shadow Stealth hide with the bonus action, the latter only out of the light; keen sight, sunlight sensitivity and camouflage roll twice where they hold; a printed passive; the light off the scene's time; refusals; gated at 1.291.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
