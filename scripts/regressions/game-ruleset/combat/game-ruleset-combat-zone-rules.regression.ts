/**
 * Escapes against the spell, zones that shake concentration or stop at a damage cap, and zones on
 * item uses (Capability API 1.174).
 *
 *   - `escapeDc: "save"` puts the applier's save difficulty on the condition, and its escape contest
 *     is rolled against that (Web). With no save difficulty the holder contests as usual.
 *   - `zone.breaksConcentration`: whoever the zone catches while concentrating, at the cast or at a
 *     trigger, makes the concentration save against the entry's save or loses it (Sleet Storm).
 *   - `zone.damageCap`: the zone ends once it has dealt that much in all (Guardian of Faith).
 *   - An item's use may concentrate and leave a zone (a scroll of the spell).
 *   - 1.175: a breaking-free contest marked `escapable` is offered only against a hold with an escape
 *     DC; `escapeChecks` names the checks that break a hold; `zone.whileHeld` hurts whoever starts a
 *     turn in it already held by it, with no save, in place of its effect (Black Tentacles).
 *   - Import refusals and the install gate.
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
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetZonesShown,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zone-rules-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 169);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  // Breaking out of a web: Athletics against whoever holds on, or against the web's DC.
  const breakFree = {
    id: "break_free",
    label: "Break free",
    budget: "action",
    attacker: { checks: ["might"] },
    defender: { checks: ["might"] },
    from: { holding: "restrained", escapable: true },
    onWin: { ends: [{ condition: "restrained", on: "actor" }] },
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.contests.push(breakFree);
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());

  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "cold", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const web = spell("web", {
    kind: "debuff",
    range: 60,
    targetCount: 1,
    save: { save: "dex_save", onSuccess: "negates" },
    applies: [{ condition: "restrained", duration: "until-save", escapeDc: "save" }],
  });
  // Sleet Storm, small: no harm, a Dexterity save or prone.
  const storm = spell("storm", {
    kind: "debuff",
    area: { shape: "burst", size: 5 },
    range: 60,
    save: { save: "dex_save", onSuccess: "negates" },
    applies: [{ condition: "prone", duration: "instant" }],
    zone: { rounds: 10, triggers: ["enter", "turn-start"], breaksConcentration: true },
  });
  // Flesh to Stone, small: restrained with no escape.
  const stone = spell("stone", {
    kind: "debuff",
    range: 60,
    targetCount: 1,
    applies: [{ condition: "restrained", duration: "until-save" }],
  });
  // Black Tentacles, small: a Dexterity save or 5 and restrained, broken only with Dexterity; 7 with
  // no save to whoever starts a turn already held.
  const tentacles = spell("tentacles", {
    area: { shape: "burst", size: 5 },
    range: 60,
    amount: { flat: 5 },
    damageType: "bludgeoning",
    concentration: true,
    save: { save: "dex_save", onSuccess: "negates" },
    applies: [{ condition: "restrained", duration: "until-save", escapeDc: "save", escapeChecks: ["agility"] }],
    zone: {
      rounds: 10,
      triggers: ["enter", "turn-start"],
      whileHeld: { condition: "restrained", amount: { flat: 7 }, damageType: "bludgeoning" },
    },
  });
  const hold = spell("hold", { amount: { flat: 1 }, concentration: true, range: 60 });
  const guardian = spell("guardian", {
    area: { shape: "burst", size: 5 },
    range: 60,
    friendlyFire: false,
    amount: { flat: 20 },
    damageType: "radiant",
    zone: { rounds: 1000, triggers: ["enter", "turn-start"], atCast: false, damageCap: 60 },
  });
  const spells = [web, storm, hold, guardian, stone, tentacles];
  const block: RulesetStatBlock = { health: 100, defense: 5, initiativeModifier: 0, speed: 30, actions: [] };
  const grid = (): TacticalGrid => ({
    width: 15,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(15).fill("plains")),
  });
  const scrollItem = {
    category: "gear",
    use: {
      kind: "attack",
      budget: "action",
      autoHit: true,
      range: 60,
      area: { shape: "burst", size: 5 },
      amount: { flat: 5 },
      damageType: "poison",
      consumes: true,
      concentration: true,
      zone: { rounds: 3, triggers: ["turn-start"] },
    },
  } as unknown as RulesetCatalogItem;
  const scroll: RulesetSheetItem = {
    name: "Scroll of Cloud",
    quantity: 1,
    item: scrollItem,
    stack: { id: "s1", ref: "gear/scroll" },
  };
  let die = 10;
  const roll = () => die;
  const fight = (placements: Record<string, { x: number; y: number }> = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
          items: [scroll],
        },
        { id: "a", name: "A", side: "enemy", block },
        {
          id: "b",
          name: "B",
          side: "enemy",
          // A lasso with no save difficulty to hold anybody to: escaped as the contest says.
          block: {
            ...block,
            actions: [
              {
                id: "lasso",
                name: "Lasso",
                budget: "action",
                toHit: 50,
                damage: { count: 0, sides: 0, flat: 1 },
                applies: [{ condition: "restrained", duration: "until-save", escapeDc: "save" }],
              },
            ],
          },
        },
      ],
      board: {
        grid: grid(),
        placements: { mage: { x: 2, y: 7 }, a: { x: 8, y: 7 }, b: { x: 11, y: 7 }, ...placements },
      },
    });
    state.order = ["mage", "a", "b"];
    state.turn = 0;
    return state;
  };
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(
      option,
      `${actorId} has no ${label}: ${rulesetCombatOptions(definition, state, actorId).map((one) => one.label)}`,
    );
    return option;
  };
  const take = (
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    aim: { at?: { x: number; y: number }; targetIds?: string[] } = {},
  ) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: optionOf(state, actorId, label).id, targetIds: aim.targetIds ?? [], ...aim },
      roll,
    );
  const walk = (state: RulesetEncounterState, actorId: string, to: { x: number; y: number }) =>
    applyRulesetCombatChoice(definition, state, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to }, roll);
  const end = (state: RulesetEncounterState) => advanceRulesetTurn(definition, state, roll);
  const toMage = (state: RulesetEncounterState) => {
    const events: RulesetCombatEvent[] = [];
    let step: RulesetCombatStep = { state, events: [] };
    do {
      step = end(step.state);
      events.push(...step.events);
    } while (step.state.order[step.state.turn] !== "mage");
    return { state: step.state, events };
  };
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  const refused = (step: { events: RulesetCombatEvent[] }) =>
    step.events.find((one): one is Extract<RulesetCombatEvent, { type: "refused" }> => one.type === "refused");
  const concentrations = (step: { events: RulesetCombatEvent[] }) =>
    step.events.flatMap((one) => (one.type === "concentration" ? [[one.state, one.reason]] : []));
  const zoneEvents = (step: { events: RulesetCombatEvent[] }) =>
    step.events.filter((one): one is Extract<RulesetCombatEvent, { type: "zone" }> => one.type === "zone");
  const mageAction = (state: RulesetEncounterState, label: string) =>
    rulesetCombatant(state, "mage")!.actions.find((one) => one.label === label)!;

  // ── Web: escaped against the spell's DC ──
  {
    die = 10;
    const state = fight({ a: { x: 3, y: 7 } });
    const dc = mageAction(state, "Web").save!.difficulty;
    let step: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = take(state, "mage", "Web", {
      targetIds: ["a"],
    });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    const held = rulesetCombatant(step.state, "a")!.tracked.find((one) => one.condition === "restrained");
    assert.ok(held, "A is restrained");
    assert.equal(held.escapeDc, dc, "held to the web's DC");
    step = end(step.state);
    const tried = take(step.state, "a", "Break free", { targetIds: ["mage"] });
    const contest = tried.events.find((one) => one.type === "contest");
    assert.ok(contest && contest.type === "contest", JSON.stringify(tried.events));
    assert.equal(contest.escapeDc, dc, "rolled against the web's DC");
    // A lasso with no save difficulty is escaped against its holder.
    const lassoed = fight({ b: { x: 3, y: 7 } });
    lassoed.turn = 2;
    const netted = take(lassoed, "b", "Lasso", { targetIds: ["mage"] });
    assert.equal(refused(netted), undefined, JSON.stringify(refused(netted)));
    const loose = rulesetCombatant(netted.state, "mage")!.tracked.find((one) => one.condition === "restrained");
    assert.ok(loose);
    assert.equal("escapeDc" in loose, false, "nothing to hold it to");
  }

  // ── Sleet Storm: the concentrating save as the storm catches them ──
  {
    die = 10;
    // At the cast: the mage holds a spell, then casts the storm on their own square.
    let step: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = take(fight(), "mage", "Hold", {
      targetIds: ["a"],
    });
    assert.ok(rulesetCombatant(step.state, "mage")!.concentrating);
    step = toMage(step.state);
    const dc = mageAction(step.state, "Storm").save!.difficulty;
    assert.ok(dc > 10, "a 10 on the die fails");
    step = take(step.state, "mage", "Storm", { at: { x: 2, y: 7 } });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.deepEqual(concentrations(step), [["ended", "zone"]], "the cast caught the mage");
    assert.equal(rulesetCombatant(step.state, "mage")!.concentrating, null);
    // At a trigger: the mage holds a spell and walks in.
    let walkIn: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = take(fight(), "mage", "Storm", {
      at: { x: 8, y: 7 },
    });
    walkIn = toMage(walkIn.state);
    walkIn = take(walkIn.state, "mage", "Hold", { targetIds: ["a"] });
    assert.ok(rulesetCombatant(walkIn.state, "mage")!.concentrating);
    walkIn = walk(walkIn.state, "mage", { x: 7, y: 7 });
    assert.deepEqual(concentrations(walkIn), [["ended", "zone"]], "walking in");
    // A good roll keeps it.
    die = 20;
    let kept: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = take(fight(), "mage", "Storm", {
      at: { x: 8, y: 7 },
    });
    kept = toMage(kept.state);
    kept = take(kept.state, "mage", "Hold", { targetIds: ["a"] });
    kept = walk(kept.state, "mage", { x: 7, y: 7 });
    assert.deepEqual(concentrations(kept), [["kept", undefined]]);
    assert.ok(rulesetCombatant(kept.state, "mage")!.concentrating);
    // Nobody concentrating, nothing to save.
    die = 10;
    const plain = take(fight(), "mage", "Storm", { at: { x: 8, y: 7 } });
    assert.deepEqual(concentrations(plain), []);
  }

  // ── Guardian of Faith: ends once it has dealt 60 ──
  {
    die = 10;
    let step: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = take(fight(), "mage", "Guardian", {
      at: { x: 8, y: 7 },
    });
    assert.equal(hp(step.state, "a"), 100, "nothing as it appears");
    let turn = end(step.state); // A starts a turn in it: 20.
    assert.equal(hp(turn.state, "a"), 80);
    turn = end(turn.state); // B's turn: B walks in, 20.
    turn = walk(turn.state, "b", { x: 9, y: 7 });
    assert.equal(hp(turn.state, "b"), 80);
    assert.equal(rulesetZonesShown(turn.state).length, 1, "40 of 60");
    step = toMage(turn.state);
    turn = end(step.state); // A again: 60 of 60, and it is gone.
    assert.equal(hp(turn.state, "a"), 60);
    assert.deepEqual(
      zoneEvents(turn).map((one) => one.outcome),
      ["struck", "ended"],
    );
    assert.equal(rulesetZonesShown(turn.state).length, 0);
    turn = end(turn.state); // B starts a turn where it was.
    assert.equal(hp(turn.state, "b"), 80, "gone for good");
  }

  // ── A scroll of a zone spell ──
  {
    die = 10;
    let step: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = take(
      fight(),
      "mage",
      "Scroll of Cloud",
      { at: { x: 8, y: 7 } },
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hp(step.state, "a"), 95, "the reading catches A");
    assert.deepEqual(rulesetCombatant(step.state, "mage")!.concentrating?.label, "Scroll of Cloud");
    assert.deepEqual(
      zoneEvents(step).map((one) => one.outcome),
      ["appeared"],
    );
    step = end(step.state);
    assert.equal(hp(step.state, "a"), 90, "a turn started in it");
    // The scroll is used up and its cloud goes on, until its reader stops holding it.
    step = toMage(step.state);
    step = take(step.state, "mage", "Hold", { targetIds: ["b"] });
    assert.deepEqual(
      zoneEvents(step).map((one) => one.outcome),
      ["ended"],
      "held by the reader's concentration",
    );
  }

  // ── Holds broken only as the spell says (1.175) ──
  {
    die = 10;
    const breaks = (state: RulesetEncounterState, id: string) =>
      rulesetCombatOptions(definition, state, id).some((one) => one.label === "Break free");
    // Web names an escape DC, so the contest is offered; stone names none, so it is not.
    const webbed = end(take(fight({ a: { x: 3, y: 7 } }), "mage", "Web", { targetIds: ["a"] }).state);
    assert.equal(breaks(webbed.state, "a"), true);
    const stoned = end(take(fight({ a: { x: 3, y: 7 } }), "mage", "Stone", { targetIds: ["a"] }).state);
    assert.ok(rulesetCombatant(stoned.state, "a")!.tracked.some((one) => one.condition === "restrained"));
    assert.equal(breaks(stoned.state, "a"), false, "no escape from stone");
    // The web is broken with the contest's own check; the tentacles only with Dexterity.
    // A web spun by somebody on the held one's own side is broken the same way (1.176 fix).
    {
      const friendly = structuredClone(webbed.state);
      rulesetCombatant(friendly, "mage")!.side = "enemy";
      assert.equal(breaks(friendly, "a"), true, "a friend's web is escaped too");
      const out = take(friendly, "a", "Break free", { targetIds: ["mage"] });
      assert.equal(refused(out), undefined, JSON.stringify(refused(out)));
    }
    const webTry = take(webbed.state, "a", "Break free", { targetIds: ["mage"] });
    const webContest = webTry.events.find((one) => one.type === "contest");
    assert.equal(webContest && webContest.type === "contest" ? webContest.attacker.check : "", "might");
    let grip: { state: RulesetEncounterState; events: RulesetCombatEvent[] } = take(fight(), "mage", "Tentacles", {
      at: { x: 8, y: 7 },
    });
    assert.equal(hp(grip.state, "a"), 95, "the cast: 5 and restrained");
    const held = rulesetCombatant(grip.state, "a")!.tracked.find((one) => one.condition === "restrained")!;
    assert.deepEqual(held.escapeChecks, ["agility"]);
    // A starts a turn held: 7 with no save, and nothing else.
    grip = end(grip.state);
    assert.equal(hp(grip.state, "a"), 88);
    assert.deepEqual(
      grip.events.filter((one) => one.type === "save").length,
      0,
      "no save for whoever it already holds",
    );
    const gripTry = take(grip.state, "a", "Break free", { targetIds: ["mage"] });
    assert.equal(refused(gripTry), undefined, JSON.stringify(refused(gripTry)));
    const gripContest = gripTry.events.find((one) => one.type === "contest");
    assert.equal(gripContest && gripContest.type === "contest" ? gripContest.attacker.check : "", "agility");
    // B walks in, unheld: the save, 5, and restrained.
    let walkIn = end(grip.state);
    walkIn = walk(walkIn.state, "b", { x: 9, y: 7 });
    assert.equal(hp(walkIn.state, "b"), 95);
    assert.ok(rulesetCombatant(walkIn.state, "b")!.tracked.some((one) => one.condition === "restrained"));
    // Broken free, A is caught as anybody is at the next turn's start.
    die = 20;
    const free = take(grip.state, "a", "Break free", { targetIds: ["mage"] });
    assert.equal(
      rulesetCombatant(free.state, "a")!.tracked.some((one) => one.condition === "restrained"),
      false,
      "broken free",
    );
    die = 10;
    const again = toMage(free.state);
    const aTurn = end(again.state);
    assert.equal(hp(aTurn.state, "a"), 83, "5 again, with the save, as anybody");
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
    const entry = (mechanics: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "zones", label: "Zones", entries: [{ id: "z", label: "Z", mechanics }] });
    };
    const area = { shape: "burst", size: 5 };
    refusedDoc(
      entry({
        kind: "attack",
        area,
        amount: { flat: 1 },
        zone: { rounds: 1, triggers: ["enter"], breaksConcentration: true },
      }),
      /against the entry's own save/,
    );
    refusedDoc(
      entry({
        kind: "attack",
        area,
        save: { save: "dex_save", onSuccess: "negates" },
        zone: { rounds: 1, triggers: [], terrain: { difficult: true }, breaksConcentration: true },
      }),
      /at one of its triggers/,
    );
    refusedDoc(entry({ kind: "attack", area, zone: { rounds: 1, triggers: ["enter"], damageCap: 0 } }), /1/);
    refusedDoc(
      entry({ kind: "debuff", applies: [{ condition: "restrained", duration: "instant", escapeDc: "dc" }] }),
      /escapeDc/,
    );
    // An escape against the spell still needs a contest that breaks free of the condition.
    refusedDoc((doc) => {
      doc.combat.contests = doc.combat.contests.filter((one: { id: string }) => one.id !== "break_free");
      entry({ kind: "debuff", applies: [{ condition: "restrained", duration: "instant", escapeDc: "save" }] })(doc);
    }, /No contest breaks free of "restrained"/);
    refusedDoc(
      entry({ kind: "debuff", applies: [{ condition: "restrained", duration: "instant", escapeChecks: ["might"] }] }),
      /go with the "escapeDc"/,
    );
    refusedDoc(
      entry({
        kind: "debuff",
        applies: [{ condition: "restrained", duration: "instant", escapeDc: "save", escapeChecks: ["nope"] }],
      }),
      /Unknown contest check "nope"/,
    );
    refusedDoc(
      entry({
        kind: "attack",
        area: { shape: "burst", size: 5 },
        zone: { rounds: 1, triggers: ["turn-start"], whileHeld: { condition: "nope", amount: { flat: 1 } } },
      }),
      /Unknown condition "nope"/,
    );
    // An item's zone is held to what an entry's is.
    refusedDoc((doc) => {
      doc.catalogs.push({
        id: "kit",
        label: "Kit",
        entries: [
          {
            id: "bad",
            label: "Bad",
            item: {
              category: "gear",
              use: { kind: "attack", amount: { flat: 1 }, zone: { rounds: 1, triggers: ["enter"] } },
            },
          },
        ],
      });
    }, /needs an area/);
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
      "A ruleset with save escapes, concentration-breaking or capped zones, or zones on item uses requires schemaVersion 2 and capabilityApi 1.174 or newer";
    const carriers: Array<[string, (doc: Record<string, any>) => void]> = [
      ["web", (doc) => doc.catalogs.push({ id: "zones", label: "Zones", entries: [web] })],
      ["storm", (doc) => doc.catalogs.push({ id: "zones", label: "Zones", entries: [storm] })],
      ["guardian", (doc) => doc.catalogs.push({ id: "zones", label: "Zones", entries: [guardian] })],
      [
        "scroll",
        (doc) =>
          doc.catalogs.push({
            id: "kit",
            label: "Kit",
            entries: [{ id: "scroll", label: "Scroll", item: scrollItem }],
          }),
      ],
      [
        "concentrating item",
        (doc) =>
          doc.catalogs.push({
            id: "kit",
            label: "Kit",
            entries: [
              {
                id: "wand",
                label: "Wand",
                item: { category: "gear", use: { kind: "attack", amount: { flat: 1 }, concentration: true } },
              },
            ],
          }),
      ],
    ];
    for (const [name, edit] of carriers) {
      const doc = fiveE(edit);
      assert.equal(getCapabilityPackageInstallIssue(manifest(173) as never, doc), gate, name);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(174) as never, doc), gate, name);
    }
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(173) as never, fiveE()),
      gate,
      "nothing without the keys",
    );
  }

  console.log(
    "Zone rules: Web is escaped against its DC, Sleet Storm shakes concentration at the cast and on the way in, Guardian of Faith ends at its cap, a scroll leaves its cloud; gated at 1.174.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
