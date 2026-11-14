/**
 * Teleports that leave the fight, take along only who they see, and leave smoke (Capability API 1.279).
 *
 *   - `teleport.leaves`: the choice names no cell and its user, with whoever goes along, is out of
 *     the fight alive (`away.left`). Off a board that is the only place it goes. A party gone from
 *     the fight that way has fled; an enemy gone that way is not beaten but got away.
 *   - `teleport.carriesSeen`: only those its user can see may go along.
 *   - `teleport.smoke`: a cloud on the cell left and the cell landed in, obscuring as a zone's
 *     `obscures` does, until the end of its user's next turn.
 *   - The director: a creature at a quarter of its health leaves; its unit keeps its hit points.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetEncounterOutcome,
  rulesetEncounterSummary,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import { rulesetCanSee } from "../../../../packages/shared/src/features/ruleset-combat/sight.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-teleport-leave-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 274);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const escape = spell("escape", {
    kind: "utility",
    teleport: { distance: 30, leaves: true, carries: 1, carriesWithin: 5 },
  });
  const misty = spell("misty", { kind: "utility", teleport: { distance: 30 } });
  const cape = spell("cape", { kind: "utility", teleport: { distance: 30, smoke: {} } });
  const veil = spell("veil", { kind: "utility", teleport: { distance: 30, smoke: { pierced: ["truesight"] } } });
  const spells = [escape, misty, cape, veil];
  const unicornAction = {
    id: "blink_away",
    name: "Teleport",
    budget: "action",
    teleport: { distance: 5280, leaves: true, carries: 3, carriesWithin: 5, carriesSeen: true },
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    doc.combat.senses ??= [];
    if (!doc.combat.senses.some((one: { id: string }) => one.id === "truesight"))
      doc.combat.senses.push({ id: "truesight", label: "Truesight" });
    for (const entry of doc.combat.conditions)
      if (entry.condition === "invisible") entry.unseen = { pierced: ["truesight"] };
    const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
    const unicorn = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
    unicorn.id = "unicorn";
    unicorn.label = "Unicorn";
    unicorn.creature.actions = [structuredClone(unicornAction)];
    delete unicorn.creature.legendary;
    creatures.entries.push(unicorn);
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
  const definition = parsed(fiveE());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_1: 4 },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const fight = (board = true): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build, live: {}, catalogs: { spells } },
        { id: "pal", name: "Pal", side: "party", build, live: {} },
        { id: "unicorn", name: "Unicorn", side: "enemy", block: block({ actions: [unicornAction as never] }) },
        { id: "foal", name: "Foal", side: "enemy", block: block() },
        { id: "stray", name: "Stray", side: "enemy", block: block() },
        { id: "seer", name: "Seer", side: "enemy", block: block({ senses: { truesight: 120 } } as never) },
      ],
      ...(board
        ? {
            board: {
              grid: {
                width: 20,
                height: 10,
                tiles: Array.from({ length: 10 }, () => Array(20).fill("plains")),
              } as never,
              placements: {
                mage: { x: 2, y: 2 },
                pal: { x: 2, y: 3 },
                unicorn: { x: 12, y: 2 },
                foal: { x: 12, y: 3 },
                stray: { x: 16, y: 8 },
                seer: { x: 10, y: 6 },
              },
            },
          }
        : {}),
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const optionOf = (state: RulesetEncounterState, label: string, actor = "mage") => {
    state.turn = state.order.indexOf(actor);
    return rulesetCombatOptions(definition, state, actor).find((one) => one.label === label);
  };
  const go = (state: RulesetEncounterState, label: string, extra: Partial<RulesetCombatChoice>, actor = "mage") => {
    const option = optionOf(state, label, actor);
    assert.ok(option, `${actor} has ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: actor, optionId: option.id, targetIds: [], ...extra },
      () => 10,
    );
  };
  const refusedStep = (step: ReturnType<typeof go>) => step.events.find((one) => one.type === "refused");

  // ── Out of the fight, and whoever it sees goes along ──
  {
    const state = fight();
    const option = optionOf(state, "Teleport", "unicorn")!;
    assert.equal(option.teleport?.leaves, true, "it may leave");
    assert.ok(option.teleport!.cells.length > 0, "or land on the board");
    assert.deepEqual(option.teleport!.carries?.ids, ["foal"], "only who stands near");
    const hidden = fight();
    who(hidden, "foal").tracked.push({ condition: "invisible", rounds: null } as never);
    assert.equal(optionOf(hidden, "Teleport", "unicorn")!.teleport!.carries, undefined, "an unseen foal stays");
    const gone = go(state, "Teleport", { carries: ["foal"] }, "unicorn");
    assert.equal(refusedStep(gone), undefined, JSON.stringify(gone.events));
    for (const id of ["unicorn", "foal"]) {
      assert.equal(who(gone.state, id).away?.left, true, `${id} left`);
      assert.equal(who(gone.state, id).defeated, true, `${id} is out of it`);
    }
    const left = gone.events.filter((one) => one.type === "left");
    assert.deepEqual(
      left.map((one) => [one.actorId, (one as { by?: string }).by]),
      [
        ["unicorn", undefined],
        ["foal", "unicorn"],
      ],
    );
    // Its health is what it was, and the summary says it got away.
    const summary = rulesetEncounterSummary(definition, gone.state);
    const unicorn = summary.enemies.find((one) => one.id === "unicorn")!;
    assert.equal(unicorn.left, true);
    assert.equal(unicorn.health, 40);
    assert.equal(rulesetEncounterOutcome(gone.state), "ongoing", "the rest still stand");
    // Out of reach for the cell rule: a cell still lands it on the board.
    const landed = go(fight(), "Teleport", { at: option.teleport!.cells[0]! }, "unicorn");
    assert.equal(refusedStep(landed), undefined);
    assert.equal(who(landed.state, "unicorn").away, undefined);
    // A teleport that may not leave needs a cell.
    assert.equal(refusedStep(go(fight(), "Misty", {}))?.reason, "bad-cell");
  }

  // ── The party gone from the fight has fled; fallen with nobody gone is still a defeat ──
  {
    const state = fight();
    const gone = go(state, "Escape", { carries: ["pal"] });
    assert.equal(refusedStep(gone), undefined, JSON.stringify(gone.events));
    assert.equal(rulesetEncounterOutcome(gone.state), "fled");
    assert.ok(gone.events.some((one) => one.type === "outcome" && one.outcome === "fled"));
    assert.equal(rulesetEncounterSummary(definition, gone.state).party[0]!.left, true);
    const half = fight();
    who(half, "pal").defeated = true;
    const alone = go(half, "Escape", {});
    assert.equal(rulesetEncounterOutcome(alone.state), "fled", "one fallen, one gone");
    const fallen = fight();
    for (const id of ["mage", "pal"]) who(fallen, id).defeated = true;
    assert.equal(rulesetEncounterOutcome(fallen), "defeat");
  }

  // ── Off a board, leaving is the only place it goes ──
  {
    const state = fight(false);
    const option = optionOf(state, "Escape")!;
    assert.ok(option?.teleport, "offered off a board");
    assert.deepEqual(option.teleport!.cells, []);
    assert.deepEqual(option.teleport!.carries?.ids, ["pal"], "nobody measures who stands near");
    assert.equal(optionOf(state, "Misty"), undefined, "one that cannot leave goes nowhere");
    const gone = go(state, "Escape", { carries: ["pal"] });
    assert.equal(rulesetEncounterOutcome(gone.state), "fled");
  }

  // ── Smoke where it left and where it landed, until the end of its next turn ──
  {
    const state = fight();
    const to = { x: 6, y: 6 };
    const step = go(state, "Cape", { at: to });
    assert.equal(refusedStep(step), undefined, JSON.stringify(step.events));
    const zone = who(step.state, "mage").zones?.find((one) => one.label === "Cape");
    assert.ok(zone, "a cloud stands");
    const cells = new Set(zone!.cells!.map((cell) => `${cell.x},${cell.y}`));
    assert.deepEqual([...cells].sort(), ["2,2", "6,6"]);
    const stray = who(step.state, "stray");
    assert.equal(rulesetCanSee(definition, step.state, stray, who(step.state, "mage")), false, "hidden in smoke");
    assert.equal(
      rulesetCanSee(definition, step.state, stray, who(step.state, "pal")),
      true,
      "the smoke is not everywhere",
    );
    // Its own `pierced`: truesight sees through the veil's, not the cape's.
    const veiled = go(fight(), "Veil", { at: to });
    const seer = who(veiled.state, "seer");
    assert.equal(rulesetCanSee(definition, veiled.state, seer, who(veiled.state, "mage")), true, "truesight");
    assert.equal(rulesetCanSee(definition, step.state, who(step.state, "seer"), who(step.state, "mage")), false);
    // The end of this turn leaves it; the end of the next takes it.
    const ended = (now: RulesetEncounterState) => {
      const actorId = now.order[now.turn]!;
      const option = rulesetCombatOptions(definition, now, actorId).find((one) => one.kind === "end-turn")!;
      return applyRulesetCombatChoice(definition, now, { actorId, optionId: option.id, targetIds: [] }, () => 10);
    };
    let now = ended(step.state).state;
    assert.ok(
      who(now, "mage").zones?.some((one) => one.label === "Cape"),
      "still there after this turn",
    );
    for (let guard = 0; guard < 10 && now.order[now.turn] !== "mage"; guard++) now = ended(now).state;
    assert.equal(now.order[now.turn], "mage");
    assert.ok(
      who(now, "mage").zones?.some((one) => one.label === "Cape"),
      "there through its next turn",
    );
    now = ended(now).state;
    assert.ok(!who(now, "mage").zones?.some((one) => one.label === "Cape"), "gone after the next");
    // A teleport that says nothing of smoke leaves none.
    assert.equal(who(go(fight(), "Misty", { at: to }).state, "mage").zones?.length ?? 0, 0, "no smoke unless it says");
  }

  // ── The director: at a quarter of its health it leaves, and keeps what it had ──
  {
    const bestiary = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creaturesId = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const director = (health: number) => {
      const built = createRulesetFight({
        definition,
        seed: 3,
        party: [{ id: "ada", name: "Ada" }],
        enemies: [{ id: "uni", name: "Unicorn", creature: `${creaturesId}/unicorn` }],
        cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
        playerName: null,
        live: {},
        items: () => [],
        partyCatalogs: {},
        bestiary,
      } as never);
      assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
      const unit = (id: string, name: string, side: "player" | "enemy") => ({
        id,
        name,
        side,
        hp: 30,
        maxHp: 30,
        attack: 8,
        defense: 6,
        speed: 6,
        level: 3,
        skills: [],
      });
      const state = createCombatDirector({
        id: "fight",
        anchor: "anchor",
        style: "ruleset",
        party: [unit("ada", "Ada", "player")],
        enemies: [unit("uni", "Unicorn", "enemy")],
        gm: false,
        difficulty: "normal",
        seed: 3,
      } as never);
      state.rulesetFight = (built as { fight: never }).fight;
      const uni = rulesetCombatant(state.rulesetFight!.encounter, "uni")!;
      uni.health!.value = Math.max(1, Math.floor(uni.health!.max * health));
      syncRulesetCombatants(definition, state);
      state.stage = rulesetDirectorStage(state);
      assert.ok(
        commandRulesetCombatDirector(definition, state, { type: "control", unitId: "ada", controller: "ai" }).ok,
      );
      const said = () => state.rulesetFight!.events.map((entry) => entry.event);
      for (let guard = 0; guard < 6 && !state.outcome; guard++) {
        assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
      }
      return { state, said: said() };
    };
    const hurt = director(0.2);
    assert.ok(
      hurt.said.some((event) => event.type === "left" && event.actorId === "uni"),
      "it got away",
    );
    assert.equal(hurt.state.outcome, "victory", "the field is the party's");
    const unit = hurt.state.enemies.find((one) => one.id === "uni")!;
    assert.ok(unit.hp > 0, "gone, not dead");
    const fresh = director(1);
    assert.ok(!fresh.said.some((event) => event.type === "left"), "a whole one stays");
  }

  // ── Import ──
  {
    refused(
      fiveE((doc) =>
        doc.catalogs.push({
          id: "x",
          label: "X",
          entries: [spell("y", { kind: "utility", teleport: { distance: 30, carriesSeen: true } })],
        }),
      ),
      /carriesSeen/,
    );
    refused(
      fiveE((doc) =>
        doc.catalogs.push({
          id: "x",
          label: "X",
          entries: [spell("y", { kind: "utility", teleport: { distance: 30, smoke: { pierced: ["nose"] } } })],
        }),
      ),
      /Unknown sense "nose"/,
    );
    refused(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
        creatures.entries.find((one: { id: string }) => one.id === "unicorn").creature.actions[0].teleport.smoke = {
          pierced: ["nose"],
        };
      }),
      /Unknown sense "nose"/,
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
      "A ruleset with a teleport that leaves the fight, takes along only those its user sees, or leaves smoke behind requires schemaVersion 2 and capabilityApi 1.279 or newer";
    const withTeleport = (teleport: Record<string, unknown>) => {
      const doc = JSON.parse(fiveEText);
      doc.catalogs.push({ id: "x", label: "X", entries: [spell("y", { kind: "utility", teleport })] });
      return doc;
    };
    for (const extra of [{ leaves: true }, { carries: 1, carriesSeen: true }, { smoke: {} }]) {
      const doc = withTeleport({ distance: 30, ...extra });
      assert.equal(getCapabilityPackageInstallIssue(manifest(278) as never, doc), gate, JSON.stringify(extra));
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(279) as never, doc), gate);
    }
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(278) as never, withTeleport({ distance: 30, carries: 1 })),
      gate,
    );
  }

  console.log(
    "Ruleset teleports out: a unicorn leaves the fight with whoever it sees beside it, a party gone that way has fled, and a cape leaves smoke at both ends; gated at 1.279.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
