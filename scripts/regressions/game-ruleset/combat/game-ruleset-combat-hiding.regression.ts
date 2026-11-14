/**
 * Hiding for real, Search and Detect (Capability API 1.287).
 *
 *   - `combat.hiding`: Hide throws Stealth, and its user is hidden from each opponent that does not
 *     see them clearly and whose passive Perception the total meets (lightly obscured: 5 less).
 *   - Whoever they are hidden from does not see them and cannot point anything at them.
 *   - It ends on an attack (made unseen, so with advantage), on anything needing a `noisy`
 *     component, and for each opponent that comes to see them clearly, on the way of a walk too.
 *   - The `search` standard action, and a creature's `search` action (a legendary Detect), find
 *     whoever's total the Perception check meets.
 *   - The director looks for whoever hides from it: Detect between turns, Search when all hide.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_MOVE_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSees,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hiding-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 282);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "utility", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const cloud = (components: string[]) => ({
    area: { shape: "burst", size: 5 },
    range: 120,
    components,
    zone: { rounds: 10, triggers: [], obscures: {} },
  });
  // The same cloud spoken aloud, and with only a gesture.
  const spoken = spell("spoken", cloud(["verbal"]));
  const silent = spell("silent", cloud(["somatic"]));
  // A haze that only lightly obscures (1.286).
  const haze = spell("haze", {
    area: { shape: "burst", size: 5 },
    range: 120,
    components: ["somatic"],
    zone: { rounds: 10, triggers: [], obscures: { light: true } },
  });
  const spells = [spoken, silent, haze];
  const detect = { id: "detect", name: "Detect", budget: "action", signature: { cost: 1 }, search: true };
  const hiding = (doc: Record<string, any>) => {
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    doc.combat.components = [
      { id: "verbal", label: "Verbal" },
      { id: "somatic", label: "Somatic" },
    ];
    doc.combat.sight = { unseenAttacks: true };
    doc.combat.checks.push(
      { id: "stealth", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "perception", label: "Perception", value: { skillMod: "perception" } },
    );
    doc.combat.hiding = { stealth: "stealth", perception: "perception", noisy: ["verbal"] };
    doc.combat.standard.push("search");
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    hiding(doc);
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
  // Dexterity 16, so Stealth +3: a 10 on the die hides with 13.
  const rogue = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 16, con: 12, int: 14, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 30, spellcasting_ability: "int", slots_max_1: 4 },
    lists: {
      attacks: [{ name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 }],
      spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
    },
  });
  const block = (perception: number, extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      checks: { perception },
      actions: [
        { name: "Bow", budget: "action", toHit: 4, range: { normal: 80 }, damage: { count: 1, sides: 6, flat: 0 } },
      ],
      ...extra,
    }) as RulesetStatBlock;
  // A wall down x = 8 from y = 2 to y = 8: the rogue behind it, the guard and the sharp-eyed scout
  // beyond it, and a watcher on the rogue's own side of it. Another along y = 9 hides the guard,
  // down below, from the rogue, though not from every cell on the rogue's way round.
  const fight = (open = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "rogue", name: "Rogue", side: "party", build: rogue, live: {}, catalogs: { spells } },
        { id: "ally", name: "Ally", side: "party", build: rogue, live: {} },
        { id: "guard", name: "Guard", side: "enemy", block: block(3) },
        { id: "scout", name: "Scout", side: "enemy", block: block(5) },
        { id: "watch", name: "Watch", side: "enemy", block: block(0) },
        {
          id: "drake",
          name: "Drake",
          side: "enemy",
          block: block(0, { signaturePoints: 3, actions: [...block(0).actions, detect] } as never),
        },
      ],
      board: {
        grid: {
          width: 20,
          height: 15,
          tiles: Array.from({ length: 15 }, (_, y) =>
            Array.from({ length: 20 }, (_, x) =>
              !open && ((x === 8 && y >= 2 && y <= 8) || (y === 9 && x >= 3 && x <= 7)) ? "wall" : "plains",
            ),
          ),
        } as never,
        placements: {
          rogue: { x: 6, y: 5 },
          ally: { x: 1, y: 13 },
          guard: { x: 12, y: 12 },
          scout: { x: 12, y: 4 },
          watch: { x: 3, y: 5 },
          drake: { x: 14, y: 5 },
        },
      },
    });
    state.order = ["rogue", "ally", "guard", "scout", "watch", "drake"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice, roll = () => 10) => {
    state.turn = state.order.indexOf(choice.actorId);
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return step;
  };
  const standard = (state: RulesetEncounterState, actorId: string, name: string, roll = () => 10) =>
    act(state, { actorId, optionId: `standard:${name}`, targetIds: [] }, roll);
  const option = (state: RulesetEncounterState, actorId: string, label: string) => {
    state.turn = state.order.indexOf(actorId);
    const found = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(found, `${actorId} has ${label}`);
    return found;
  };
  // Hidden, with the turn's action back to spend on something else.
  const hid = () => {
    const step = standard(fight(), "rogue", "hide");
    who(step.state, "rogue").budgets = { ...who(fight(), "rogue").budgets };
    return step;
  };

  // ── Hide: hidden from whoever does not see the rogue clearly and whose passive it meets ──
  {
    assert.equal(who(fight(), "rogue").checks?.stealth, 3);
    const step = hid();
    const event = step.events.find((one) => one.type === "standard" && one.action === "hide");
    assert.ok(event?.type === "standard" && event.check, JSON.stringify(step.events));
    assert.equal(event.check!.total, 13);
    // The guard's passive 13 is met; the scout's 15 beats 13; the watch sees the rogue clearly.
    assert.deepEqual(event.from, ["guard", "drake"]);
    assert.deepEqual(who(step.state, "rogue").hiding, { total: 13, from: ["guard", "drake"] });
    const rogueSeenBy = (viewer: string) =>
      rulesetCanSee(definition, step.state, who(step.state, viewer), who(step.state, "rogue"));
    assert.equal(rogueSeenBy("watch"), true);
    // In the open, nobody but somebody the rules already keep from seeing is hidden from.
    const open = standard(fight(true), "rogue", "hide");
    assert.equal(who(open.state, "rogue").hiding, undefined, "nobody to hide from out in the open");
    assert.ok(open.events.some((one) => one.type === "standard" && one.action === "hide" && one.from?.length === 0));
    // The rogue's flag is not what hides it: the old stance stays off.
    assert.equal(who(step.state, "rogue").flags.hidden, undefined);
    // And it lasts past the rogue's next turn starting.
    let now = step.state;
    for (let guard = 0; guard < 8; guard++) {
      const actorId = now.order[now.turn]!;
      now = applyRulesetCombatChoice(definition, now, { actorId, optionId: "end-turn", targetIds: [] }, () => 10).state;
      if (now.order[now.turn] === "rogue") break;
    }
    assert.equal(now.order[now.turn], "rogue");
    assert.deepEqual(who(now, "rogue").hiding?.from, ["guard", "drake"], "still hidden on its next turn");
  }

  // ── In a light haze out in the open: everybody's passive is 5 lower, so even the scout's 10 ──
  {
    const state = fight(true);
    const hazed = act(state, {
      actorId: "rogue",
      optionId: option(state, "rogue", "Haze").id,
      targetIds: [],
      at: { x: 6, y: 5 },
    });
    who(hazed.state, "rogue").budgets = { ...who(fight(), "rogue").budgets };
    const step = standard(hazed.state, "rogue", "hide");
    assert.deepEqual(who(step.state, "rogue").hiding, { total: 13, from: ["guard", "scout", "watch", "drake"] });
  }

  // ── Hidden from somebody: not seen by them, not to be pointed at, seen once in the open ──
  {
    const state = fight(true);
    who(state, "rogue").hiding = { total: 20, from: ["guard"] };
    assert.equal(rulesetCanSee(definition, state, who(state, "guard"), who(state, "rogue")), false);
    assert.equal(rulesetCanSee(definition, state, who(state, "scout"), who(state, "rogue")), true);
    // What a condition's "can see its source" reads too.
    assert.equal(rulesetSees(state, who(state, "guard"), who(state, "rogue")), false);
    assert.equal(rulesetSees(state, who(state, "scout"), who(state, "rogue")), true);
    const bow = option(state, "guard", "Bow");
    assert.ok(!rulesetOptionTargets(definition, state, "guard", bow).includes("rogue"), "not a target for the guard");
    assert.ok(rulesetOptionTargets(definition, state, "guard", bow).includes("ally"));
    assert.ok(rulesetOptionTargets(definition, state, "scout", option(state, "scout", "Bow")).includes("rogue"));
    // Out in the open, the next step finds it seen.
    const step = standard(state, "ally", "dodge");
    const revealed = step.events.find((one) => one.type === "revealed");
    assert.ok(revealed?.type === "revealed" && revealed.reason === "seen", JSON.stringify(step.events));
    assert.deepEqual(revealed.byIds, ["guard"]);
    assert.equal(who(step.state, "rogue").hiding, undefined);
  }

  // ── Attacking gives it away, after the blow is made unseen ──
  {
    const state = fight(true);
    who(state, "rogue").hiding = { total: 20, from: ["watch"] };
    who(state, "rogue").x = 4;
    const dagger = option(state, "rogue", "Dagger");
    const step = act(state, { actorId: "rogue", optionId: dagger.id, targetIds: ["watch"] });
    const attack = step.events.find((one) => one.type === "attack");
    assert.ok(attack?.type === "attack" && attack.mode === "advantage", JSON.stringify(attack));
    const revealed = step.events.find((one) => one.type === "revealed");
    assert.ok(revealed?.type === "revealed" && revealed.reason === "attack", JSON.stringify(step.events));
    assert.equal(who(step.state, "rogue").hiding, undefined);
  }

  // ── A spoken spell gives it away; one with only a gesture does not ──
  {
    const hidden = hid().state;
    const loud = act(hidden, {
      actorId: "rogue",
      optionId: option(hidden, "rogue", "Spoken").id,
      targetIds: [],
      at: { x: 4, y: 2 },
    });
    const revealed = loud.events.find((one) => one.type === "revealed");
    assert.ok(revealed?.type === "revealed" && revealed.reason === "noise", JSON.stringify(loud.events));
    assert.equal(who(loud.state, "rogue").hiding, undefined);
    const still = hid().state;
    const quiet = act(still, {
      actorId: "rogue",
      optionId: option(still, "rogue", "Silent").id,
      targetIds: [],
      at: { x: 4, y: 2 },
    });
    assert.ok(!quiet.events.some((one) => one.type === "revealed"), JSON.stringify(quiet.events));
    assert.deepEqual(who(quiet.state, "rogue").hiding?.from, ["guard", "drake"]);
  }

  // ── Walking: seen on the way out in the open, even ending behind the wall again ──
  {
    const state = hid().state;
    const walk = rulesetCombatOptions(definition, state, "rogue").find((one) => one.id === RULESET_MOVE_OPTION)!;
    const guard = who(state, "guard");
    const seenAt = (cell: { x: number; y: number }) =>
      rulesetCanSee(definition, state, guard, { ...who(state, "watch"), id: "probe", x: cell.x, y: cell.y });
    const around = walk.cells!.find((cell) => !seenAt(cell) && (cell.path ?? []).some((step) => seenAt(step)));
    assert.ok(
      around,
      `a walk that crosses the guard's view and ends out of it: ${JSON.stringify(
        walk.cells!.map((cell) => [cell.x, cell.y, seenAt(cell), (cell.path ?? []).map((one) => [one.x, one.y])]),
      )}`,
    );
    const step = act(state, { actorId: "rogue", optionId: RULESET_MOVE_OPTION, targetIds: [], to: around });
    const revealed = step.events.find((one) => one.type === "revealed");
    assert.ok(revealed?.type === "revealed" && revealed.byIds.includes("guard"), JSON.stringify(step.events));
    assert.ok(!who(step.state, "rogue").hiding?.from.includes("guard"));
    // A step that stays behind the wall keeps it hidden.
    const near = walk.cells!.find((cell) => cell.x === 6 && cell.y === 6)!;
    const stayed = act(hid().state, { actorId: "rogue", optionId: RULESET_MOVE_OPTION, targetIds: [], to: near });
    assert.deepEqual(who(stayed.state, "rogue").hiding?.from, ["guard", "drake"]);
  }

  // ── Search: a Perception check that meets the total finds the rogue, for the searcher only ──
  {
    const missed = standard(hid().state, "guard", "search", () => 9);
    const looked = missed.events.find((one) => one.type === "standard" && one.action === "search");
    assert.ok(looked?.type === "standard" && looked.check?.total === 12, JSON.stringify(missed.events));
    assert.deepEqual(looked.found, []);
    assert.deepEqual(who(missed.state, "rogue").hiding?.from, ["guard", "drake"]);
    const found = standard(hid().state, "guard", "search");
    const spotted = found.events.find((one) => one.type === "standard" && one.action === "search");
    assert.ok(spotted?.type === "standard");
    assert.deepEqual(spotted.found, ["rogue"], "13 meets 13");
    assert.deepEqual(who(found.state, "rogue").hiding?.from, ["drake"], "still hidden from the drake");
  }

  // ── Detect: the drake's legendary search, between turns ──
  {
    const state = hid().state;
    const ended = act(state, { actorId: "rogue", optionId: "end-turn", targetIds: [] });
    assert.equal(ended.state.window?.kind, "signature");
    const offered = rulesetWindowOptions(definition, ended.state, "drake").find((one) => one.label === "Detect");
    assert.ok(offered, "Detect is offered between turns");
    const step = applyRulesetCombatChoice(
      definition,
      ended.state,
      { actorId: "drake", optionId: offered.id, targetIds: [], window: ended.state.window!.id },
      () => 20,
    );
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    const search = step.events.find((one) => one.type === "search");
    assert.ok(search?.type === "search" && search.label === "Detect", JSON.stringify(step.events));
    assert.deepEqual(search.found, ["rogue"]);
    assert.ok(step.events.some((one) => one.type === "signature" && one.actorId === "drake"));
    assert.deepEqual(who(step.state, "rogue").hiding?.from, ["guard"]);
  }

  // ── The director looks for whoever hides from it ──
  {
    const withDrake = parsed(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
        const drake = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
        drake.id = "drake";
        drake.label = "Drake";
        drake.creature.signaturePoints = 3;
        drake.creature.checks = { perception: 0 };
        drake.creature.actions = [
          { id: "bite", name: "Bite", budget: "action", toHit: 4, reach: 5, damage: { dice: "1d4" } },
          detect,
        ];
        delete drake.creature.legendary;
        creatures.entries.push(drake);
        for (const entry of doc.combat.conditions) if (entry.condition === "invisible") entry.unseen = {};
      }),
    );
    const bestiary = Object.fromEntries(
      (withDrake.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creaturesId = (withDrake.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const built = createRulesetFight({
      definition: withDrake,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "drake", name: "Drake", creature: `${creaturesId}/drake` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(withDrake) } }],
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
      enemies: [unit("drake", "Drake", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    // Ada, invisible, hides far better than the drake can look, so nothing it does finds her.
    const ada = rulesetCombatant(state.rulesetFight!.encounter, "ada")!;
    ada.hiding = { total: 40, from: ["drake"] };
    ada.tracked.push({ condition: "invisible", rounds: null } as never);
    syncRulesetCombatants(withDrake, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(
      commandRulesetCombatDirector(withDrake, state, { type: "control", unitId: "ada", controller: "manual" }).ok,
    );
    const events = () => state.rulesetFight!.events.map((entry) => entry.event);
    for (let guard = 0; guard < 6 && !state.outcome; guard++) {
      const encounter = state.rulesetFight!.encounter;
      const asking = encounter.window?.waiting[0] ?? encounter.order[encounter.turn];
      if (asking === "ada") {
        const optionId = encounter.window ? "pass" : "end-turn";
        assert.ok(
          commandRulesetCombatDirector(withDrake, state, { type: "ruleset", optionId, targetIds: [] } as never).ok,
        );
      } else assert.ok(commandRulesetCombatDirector(withDrake, state, { type: "continue" }).ok);
      if (
        events().some((event) => event.type === "search" && event.actorId === "drake") &&
        events().some((event) => event.type === "standard" && event.action === "search" && event.actorId === "drake")
      )
        break;
    }
    assert.ok(
      events().some((event) => event.type === "standard" && event.action === "search" && event.actorId === "drake"),
      `the drake searched on its turn: ${JSON.stringify(events().map((event) => event.type))}`,
    );
    assert.ok(
      events().some((event) => event.type === "search" && event.actorId === "drake" && event.label === "Detect"),
      `and detected between turns: ${JSON.stringify(events().map((event) => event.type))}`,
    );
  }

  // ── Refusals ──
  {
    refusedDoc(
      fiveE((doc) => {
        doc.combat.hiding.stealth = "sneak";
      }),
      /Unknown contest check "sneak"/,
    );
    refusedDoc(
      fiveE((doc) => {
        doc.combat.hiding.noisy = ["humming"];
      }),
      /Unknown component "humming"/,
    );
    refusedDoc(
      fiveE((doc) => {
        delete doc.combat.hiding;
      }),
      /Search looks for whoever is hiding/,
    );
    refusedDoc(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
        creatures.entries[0].creature.actions.push({ ...detect, damage: { dice: "1d4" } });
      }),
      /A search is the looking, so it carries no damage/,
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
      "A ruleset that hides for real, searches, or has a creature that detects requires schemaVersion 2 and capabilityApi 1.287 or newer";
    const plain = JSON.parse(fiveEText) as Record<string, any>;
    const cases: Array<[string, Record<string, any>]> = [
      ["hiding", fiveE()],
      [
        "hiding alone",
        (() => {
          const doc = structuredClone(plain);
          doc.combat.hiding = { stealth: "might", perception: "agility" };
          return doc;
        })(),
      ],
      [
        "search standard",
        (() => {
          const doc = structuredClone(plain);
          doc.combat.standard.push("search");
          return doc;
        })(),
      ],
      [
        "detect",
        (() => {
          const doc = structuredClone(plain);
          doc.catalogs
            .find((one: { holds?: string }) => one.holds === "creatures")
            .entries[0].creature.actions.push(detect);
          return doc;
        })(),
      ],
    ];
    for (const [name, doc] of cases) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(286) as never, doc), gate, name);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(287) as never, doc), gate, name);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(286) as never, plain), gate, "the plain 5e example");
  }

  console.log(
    "Hiding: Hide throws Stealth against each unseeing opponent's passive Perception; the hidden are unseen and untargetable by them; attacks (with advantage) and spoken spells give them away, and so does being seen, on a walk too; Search and Detect find them; the director looks; refusals; gated at 1.287.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
