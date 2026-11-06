/**
 * Readying for real (Capability API 1.288).
 *
 *   - `combat.readying`: the Ready action offers each option taken with its budget (and a walk),
 *     waiting for an opponent to come where it reaches them (`comes`) or for one to act (`acts`).
 *   - When it happens a window asks its holder, who takes it with the readying budget: as their own
 *     turn would, aimed then, and a walk it interrupted goes on after. Passing keeps it ready.
 *   - With `concentrates`, a spell is paid as it is readied and held by concentration: not paid
 *     again when it goes off, lost with the concentration, spent if it never does.
 *   - It waits until the start of its holder's next turn.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_MOVE_OPTION,
  RULESET_READIED_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatRoller,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ready-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 283);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  // A first-level bolt: a spell attack at one creature in range.
  const bolt = {
    id: "bolt",
    label: "Bolt",
    rows: [{ list: "spells", values: { name: "Bolt", level: 1, prepared: true } }],
    mechanics: {
      kind: "attack",
      range: 120,
      autoHit: true,
      amount: { flat: 5 },
      damageType: "force",
      cost: [{ pool: "slots_1", amount: 1 }],
    },
  } as unknown as RulesetCatalogEntry;
  const spells = [bolt];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    doc.combat.readying = { budget: "reaction", concentrates: true };
    for (const entry of doc.combat.conditions) if (entry.condition === "invisible") entry.unseen = {};
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
  const fighter = rulesetSheetBuildSchema.parse({
    abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 30 },
    lists: { attacks: [{ name: "Sword", ability: "str", proficient: true, bonus: 0, damage: "1d8", reach: 5 }] },
  });
  const mage = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 30, spellcasting_ability: "int", slots_max_1: 2 },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const block = (): RulesetStatBlock => ({
    health: 60,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } }],
  });
  const fight = (corridor?: Set<string>): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "fighter", name: "Fighter", side: "party", build: fighter, live: {} },
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: mage,
          live: { pools: { slots_1: { value: 2 } } },
          catalogs: { spells },
        },
        { id: "gob", name: "Gob", side: "enemy", block: block() },
      ],
      board: {
        grid: {
          width: 20,
          height: 10,
          tiles: Array.from({ length: 10 }, (_, y) =>
            Array.from({ length: 20 }, (_, x) => (!corridor || corridor.has(`${x},${y}`) ? "plains" : "wall")),
          ),
        } as never,
        placements: { fighter: { x: 2, y: 5 }, mage: { x: 1, y: 1 }, gob: corridor ? { x: 3, y: 8 } : { x: 9, y: 5 } },
      },
    });
    state.order = ["fighter", "mage", "gob"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice, roll: RulesetCombatRoller = () => 10) => {
    if (!state.window) state.turn = state.order.indexOf(choice.actorId);
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return step;
  };
  const optionsOf = (state: RulesetEncounterState, actorId: string) => {
    state.turn = state.order.indexOf(actorId);
    return rulesetCombatOptions(definition, state, actorId);
  };
  const ready = (state: RulesetEncounterState, actorId: string, label: string, on: "comes" | "acts") => {
    const option = optionsOf(state, actorId).find((one) => one.ready?.label === label && one.ready.on === on);
    assert.ok(option, `${actorId} may ready ${label} for ${on}`);
    return act(state, { actorId, optionId: option.id, targetIds: [] });
  };
  const slots = (state: RulesetEncounterState) =>
    (who(state, "mage").sheet!.live as { pools?: Record<string, { value: number }> }).pools?.slots_1?.value;
  const walk = (state: RulesetEncounterState, to: { x: number; y: number }) =>
    act(state, { actorId: "gob", optionId: RULESET_MOVE_OPTION, targetIds: [], to });

  // ── The menu: each option of the action's budget, and a walk, for each thing to wait for ──
  {
    const options = optionsOf(fight(), "fighter");
    const readies = options.filter((one) => one.ready).map((one) => `${one.ready!.label}@${one.ready!.on}`);
    assert.ok(readies.includes("Sword@comes") && readies.includes("Sword@acts"), JSON.stringify(readies));
    assert.ok(
      readies.some((one) => one.startsWith("Move@")),
      "a walk may be readied",
    );
    assert.ok(!options.some((one) => one.id === "standard:ready"), "the old stance is not offered");
    assert.ok(
      optionsOf(fight(), "mage").some((one) => one.ready?.label === "Bolt"),
      "a spell may be readied",
    );
  }

  // ── A sword readied for the gob coming in reach: struck mid-walk, and the walk goes on ──
  {
    const readied = ready(fight(), "fighter", "Sword", "comes");
    assert.ok(readied.events.some((one) => one.type === "ready" && one.outcome === "readied"));
    assert.equal(who(readied.state, "fighter").readied?.on, "comes");
    assert.equal(who(readied.state, "fighter").budgets.action, 0, "the action is spent readying");
    // The gob walks past the fighter, coming in reach on the way.
    const step = walk(readied.state, { x: 3, y: 6 });
    assert.equal(step.state.window?.trigger.kind, "readied", JSON.stringify(step.events));
    assert.deepEqual(step.state.window?.waiting, ["fighter"]);
    const gobAt = { x: who(step.state, "gob").x, y: who(step.state, "gob").y };
    assert.ok(
      Math.max(Math.abs(gobAt.x - 2), Math.abs(gobAt.y - 5)) <= 1,
      `stopped in reach: ${JSON.stringify(gobAt)}`,
    );
    const offered = rulesetWindowOptions(definition, step.state, "fighter");
    assert.equal(offered.length, 1);
    assert.equal(offered[0]!.id, RULESET_READIED_OPTION);
    assert.equal(offered[0]!.budget, "reaction");
    const struck = act(step.state, {
      actorId: "fighter",
      optionId: RULESET_READIED_OPTION,
      targetIds: ["gob"],
      window: step.state.window!.id,
    });
    assert.ok(struck.events.some((one) => one.type === "ready" && one.outcome === "released"));
    assert.ok(
      struck.events.some((one) => one.type === "attack" && one.actorId === "fighter"),
      JSON.stringify(struck.events),
    );
    assert.equal(who(struck.state, "fighter").readied, undefined);
    assert.equal(who(struck.state, "fighter").budgets.reaction, 0, "taken with the reaction");
    assert.deepEqual({ x: who(struck.state, "gob").x, y: who(struck.state, "gob").y }, { x: 3, y: 6 }, "walked on");
    assert.equal(struck.state.window, undefined);
    // Let go by: still readied, and not asked again on the same walk.
    const again = walk(ready(fight(), "fighter", "Sword", "comes").state, { x: 3, y: 6 });
    const passed = act(again.state, {
      actorId: "fighter",
      optionId: "pass",
      targetIds: [],
      window: again.state.window!.id,
    });
    assert.equal(who(passed.state, "fighter").readied?.on, "comes", "still readied");
    assert.equal(passed.state.window, undefined, "nobody asked twice in one walk");
    assert.deepEqual({ x: who(passed.state, "gob").x, y: who(passed.state, "gob").y }, { x: 3, y: 6 });
    // A walk that stays out of reach sets nothing off.
    const far = walk(ready(fight(), "fighter", "Sword", "comes").state, { x: 9, y: 1 });
    assert.equal(far.state.window, undefined);
  }

  // ── Asked once a walk, and only on coming in reach ──
  {
    // Already in reach: stepping about inside it sets nothing off.
    const near = ready(fight(), "fighter", "Sword", "comes").state;
    who(near, "gob").x = 3;
    const about = walk(near, { x: 3, y: 6 });
    assert.equal(about.state.window, undefined, JSON.stringify(about.events));
    assert.equal(who(about.state, "fighter").readied?.on, "comes");
    // Somebody it cannot see comes unnoticed.
    const unseen = ready(fight(), "fighter", "Sword", "comes").state;
    who(unseen, "gob").tracked.push({ condition: "invisible", rounds: null } as never);
    const sneaked = walk(unseen, { x: 3, y: 6 });
    assert.equal(sneaked.state.window, undefined, JSON.stringify(sneaked.events));
    // A corridor in, out and back in: let go the first time, not asked the second.
    const cells = ["1,1", "2,5", "3,8", "3,7", "2,7", "2,6", "1,6", "0,6", "0,5", "0,4", "1,4"];
    const winding = ready(fight(new Set(cells)), "fighter", "Sword", "comes").state;
    who(winding, "gob").movementLeft = 99;
    const first = walk(winding, { x: 1, y: 4 });
    assert.equal(first.state.window?.trigger.kind, "readied", JSON.stringify(first.events));
    assert.deepEqual(
      { x: who(first.state, "gob").x, y: who(first.state, "gob").y },
      { x: 1, y: 6 },
      JSON.stringify(first.state.window),
    );
    let state = act(first.state, {
      actorId: "fighter",
      optionId: "pass",
      targetIds: [],
      window: first.state.window!.id,
    }).state;
    // Leaving reach gives the fighter its opportunity attack; it lets that go too.
    while (state.window && state.window.trigger.kind !== "readied") {
      state = act(state, {
        actorId: state.window.waiting[0]!,
        optionId: "pass",
        targetIds: [],
        window: state.window.id,
      }).state;
    }
    assert.equal(state.window, undefined, "not asked again on the same walk");
    assert.deepEqual({ x: who(state, "gob").x, y: who(state, "gob").y }, { x: 1, y: 4 });
  }

  // ── A walk readied: the fighter steps away as the gob comes ──
  {
    const step = walk(ready(fight(), "fighter", "Move", "comes").state, { x: 3, y: 5 });
    assert.equal(step.state.window?.trigger.kind, "readied", JSON.stringify(step.events));
    const option = rulesetWindowOptions(definition, step.state, "fighter")[0]!;
    assert.equal(option.kind, "move");
    const to = option.cells!.find((cell) => cell.x === 2 && cell.y === 0)!;
    assert.ok(to, "anywhere its whole speed reaches");
    const leaving = act(step.state, {
      actorId: "fighter",
      optionId: RULESET_READIED_OPTION,
      targetIds: [],
      to,
      window: step.state.window!.id,
    });
    // Leaving the gob's reach gives it its opportunity attack, as any walk does; it lets it go.
    assert.deepEqual(leaving.state.window?.waiting, ["gob"], JSON.stringify(leaving.events));
    const away = act(leaving.state, {
      actorId: "gob",
      optionId: "pass",
      targetIds: [],
      window: leaving.state.window!.id,
    });
    assert.deepEqual({ x: who(away.state, "fighter").x, y: who(away.state, "fighter").y }, { x: 2, y: 0 });
    assert.equal(who(away.state, "fighter").budgets.reaction, 0);
    assert.deepEqual(
      { x: who(away.state, "gob").x, y: who(away.state, "gob").y },
      { x: 3, y: 5 },
      "the gob's walk ends",
    );
  }

  // ── A bolt readied for the gob acting: paid now, held by concentration, not paid again ──
  {
    const before = slots(fight());
    const readied = ready(fight(), "mage", "Bolt", "acts");
    assert.equal(slots(readied.state), before! - 1, "the slot is spent as it is readied");
    assert.equal(who(readied.state, "mage").concentrating?.label, "Bolt", "held by concentration");
    assert.equal(who(readied.state, "mage").readied?.paid, true);
    // The gob claws the fighter.
    const near = readied.state;
    who(near, "gob").x = 3;
    const claw = optionsOf(near, "gob").find((one) => one.label === "Claw")!;
    const clawed = act(near, { actorId: "gob", optionId: claw.id, targetIds: ["fighter"] });
    assert.equal(clawed.state.window?.trigger.kind, "readied", JSON.stringify(clawed.events));
    assert.deepEqual(clawed.state.window?.waiting, ["mage"]);
    const option = rulesetWindowOptions(definition, clawed.state, "mage")[0]!;
    assert.ok(option, "the bolt is offered though its slot is spent");
    const fired = act(clawed.state, {
      actorId: "mage",
      optionId: RULESET_READIED_OPTION,
      targetIds: ["gob"],
      window: clawed.state.window!.id,
    });
    assert.ok(
      fired.events.some((one) => one.type === "damage" && one.targetId === "gob"),
      JSON.stringify(fired.events),
    );
    assert.equal(slots(fired.state), before! - 1, "not paid again");
    assert.ok(!fired.events.some((one) => one.type === "spend"), "nothing spent at all");
    assert.equal(who(fired.state, "mage").concentrating, null, "the hold is let go");
    assert.equal(who(fired.state, "mage").budgets.reaction, 0);
    // Its own allies acting set nothing off.
    const ally = ready(fight(), "mage", "Bolt", "acts").state;
    const sword = optionsOf(ally, "fighter").find((one) => one.label === "Sword")!;
    who(ally, "gob").x = 3;
    assert.equal(act(ally, { actorId: "fighter", optionId: sword.id, targetIds: ["gob"] }).state.window, undefined);
  }

  // ── A sword readied for the gob acting, with nobody in its reach: nobody is asked, and the log says
  //    nothing (laptop playtest 2026-10-24: "may take what they readied" on every action) ──
  {
    const state = ready(fight(), "fighter", "Sword", "acts").state;
    who(state, "gob").x = 2;
    who(state, "gob").y = 1;
    const claw = optionsOf(state, "gob").find((one) => one.label === "Claw")!;
    const far = act(state, { actorId: "gob", optionId: claw.id, targetIds: ["mage"] });
    assert.ok(
      far.events.some((one) => one.type === "damage" || one.type === "attack"),
      JSON.stringify(far.events),
    );
    assert.equal(far.state.window, undefined, JSON.stringify(far.events));
    // Beside it, the same sword is offered.
    const near = ready(fight(), "fighter", "Sword", "acts").state;
    who(near, "gob").x = 3;
    const clawed = act(near, { actorId: "gob", optionId: claw.id, targetIds: ["fighter"] });
    assert.equal(clawed.state.window?.trigger.kind, "readied", JSON.stringify(clawed.events));
  }

  // ── Waiting runs out at its holder's next turn; a held spell is spent all the same ──
  {
    let state = ready(fight(), "mage", "Bolt", "acts").state;
    const before = slots(state);
    const events: RulesetCombatStep["events"] = [];
    for (let guard = 0; guard < 6; guard++) {
      const actorId = state.order[state.turn]!;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId, optionId: "end-turn", targetIds: [] },
        () => 10,
      );
      events.push(...step.events);
      state = step.state;
      if (state.order[state.turn] === "mage") break;
    }
    assert.equal(state.order[state.turn], "mage");
    assert.ok(
      events.some((one) => one.type === "ready" && one.outcome === "expired"),
      JSON.stringify(events),
    );
    assert.equal(who(state, "mage").readied, undefined);
    assert.equal(who(state, "mage").concentrating, null);
    assert.equal(slots(state), before, "the slot stays spent");
  }

  // ── Lost with the concentration holding it ──
  {
    const state = ready(fight(), "mage", "Bolt", "acts").state;
    who(state, "gob").x = 2;
    who(state, "gob").y = 1;
    const claw = optionsOf(state, "gob").find((one) => one.label === "Claw")!;
    // The claw hits on a 15; the concentration save fails on a 1.
    let d20s = 0;
    const roll: RulesetCombatRoller = (sides) => (sides === 20 ? (d20s++ === 0 ? 15 : 1) : 4);
    const step = act(state, { actorId: "gob", optionId: claw.id, targetIds: ["mage"] }, roll);
    assert.ok(
      step.events.some((one) => one.type === "ready" && one.outcome === "lost"),
      JSON.stringify(step.events),
    );
    assert.equal(who(step.state, "mage").readied, undefined);
    assert.equal(step.state.window, undefined, "nothing left to set off");
  }

  // ── Refusals ──
  {
    refusedDoc(
      fiveE((doc) => {
        doc.combat.readying.budget = "nap";
      }),
      /Unknown budget "nap"/,
    );
    refusedDoc(
      fiveE((doc) => {
        delete doc.combat.concentration;
      }),
      /A spell held by concentration needs combat.concentration/,
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
    const gate = "A ruleset that readies for real requires schemaVersion 2 and capabilityApi 1.288 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(287) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(288) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(287) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Ready: each option of the action's budget or a walk, readied for an opponent coming in reach or acting; taken with the reaction in a window, a walk going on after; a pass keeps it; a spell paid as readied and held by concentration, lost with it, spent if it never goes off; refusals; gated at 1.288.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
