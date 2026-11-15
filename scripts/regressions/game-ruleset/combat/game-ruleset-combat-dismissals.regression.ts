/**
 * Actions a condition gives, cures by who put it on, and sending somebody away (Capability API 1.236).
 *
 *   - A condition's `actions`: 5e's Dispel Evil and Good lets its caster Break Enchantment or Dismiss
 *     while it lasts, and either one ends it (`endsCondition`), concentration and all.
 *   - `ends.from`: Break Enchantment ends only a charm or fright a fiend, an undead (...) put on.
 *   - `dismisses: true`: Dismissal sends a fiend out of the fight for good, alive.
 *   - `dismisses: { while, gone }`: Banishment sends somebody away while they are banished; back
 *     where they were (or the nearest free place) when it ends early, and a fiend that saw it run
 *     its whole time stays gone.
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
  rulesetOpportunityAttack,
  type RulesetCombatAction,
  type RulesetCombatant,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-dismissals-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { directedRulesetView } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");
const { rulesetBoardCells } = await import("../../../../packages/client/src/lib/ruleset-combat-board.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 231);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const planar = { types: ["celestial", "elemental", "fey", "fiend", "undead"] };
  const dispel = spell("dispel", "Dispel", {
    kind: "buff",
    targets: "self",
    concentration: true,
    applies: [{ condition: "warded", duration: { rounds: 10 } }],
  });
  const breaks = spell("break", "Break", {
    kind: "utility",
    targets: "ally",
    range: 0,
    ends: { conditions: ["charmed", "frightened"], from: planar },
    endsCondition: "warded",
  });
  const dismissal = spell("dismiss", "Dismiss", {
    kind: "debuff",
    targets: "enemy",
    range: 0,
    autoHit: true,
    save: { save: "cha_save", onSuccess: "negates" },
    targetTypes: { is: planar },
    dismisses: true,
    endsCondition: "warded",
  });
  const banish = spell("banish", "Banish", {
    kind: "debuff",
    targets: "enemy",
    range: 60,
    save: { save: "cha_save", onSuccess: "negates" },
    concentration: true,
    applies: [{ condition: "banished", duration: { rounds: 10 } }],
    dismisses: { while: "banished", gone: { types: ["celestial", "elemental", "fey", "fiend"] } },
  });
  const known = [dispel, banish];
  const spells = [dispel, breaks, dismissal, banish];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    doc.combat.creatureTypes = {
      types: ["humanoid", "celestial", "elemental", "fey", "fiend", "undead"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
    doc.sheet.live.conditions.push({ id: "warded", label: "Warded" }, { id: "banished", label: "Banished" });
    doc.combat.conditions.push(
      { condition: "warded", effects: [], actions: ["spells/break", "spells/dismiss"] },
      { condition: "banished", effects: [] },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  let d20 = 2;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const block = (type: string): RulesetStatBlock =>
    ({ health: 30, defense: 5, initiativeModifier: 0, speed: 30, actions: [], type }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 10,
    height: 10,
    tiles: Array.from({ length: 10 }, () => Array(10).fill("plains")),
  });
  const fight = (board = false): RulesetEncounterState => {
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
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: known.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        {
          id: "brenna",
          name: "Brenna",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 12, speed: 30, hp_max: 20 },
          }),
          live: {},
          catalogs: {},
        },
        { id: "imp", name: "Imp", side: "enemy", block: block("fiend") },
        { id: "thug", name: "Thug", side: "enemy", block: block("humanoid") },
      ],
      ...(board
        ? {
            board: {
              grid: grid(),
              placements: {
                mage: { x: 4, y: 4 },
                brenna: { x: 4, y: 5 },
                imp: { x: 5, y: 4 },
                thug: { x: 5, y: 5 },
              } as never,
            },
          }
        : {}),
    });
    state.order = ["mage", "brenna", "imp", "thug"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const labels = (state: RulesetEncounterState) => {
    who(state, "mage").budgets.action = 1;
    return rulesetCombatOptions(definition, state, "mage").map((one) => one.label);
  };
  const option = (state: RulesetEncounterState, label: string) => {
    who(state, "mage").budgets.action = 1;
    const found = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(found, `no ${label}`);
    return found;
  };
  const cast = (state: RulesetEncounterState, label: string, targetIds: string[]) => {
    who(state, "mage").budgets.action = 1;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option(state, label).id, targetIds },
      roll,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const holds = (state: RulesetEncounterState, id: string) =>
    rulesetCombatConditions(definition, who(state, id)).sort();
  const warded = () => {
    d20 = 2;
    const state = cast(fight(), "Dispel", ["mage"]).state;
    assert.deepEqual(holds(state, "mage"), ["warded"]);
    return state;
  };
  const kinds = (events: RulesetCombatEvent[]) =>
    events.flatMap((one) => (one.type === "dismissed" || one.type === "returned" ? [one] : []));

  // ── Dispel Evil and Good gives its two uses only while it lasts ──
  {
    const state = fight();
    assert.ok(!labels(state).includes("Break") && !labels(state).includes("Dismiss"));
    const held = warded();
    assert.ok(labels(held).includes("Break") && labels(held).includes("Dismiss"));
    // Its numbers are the caster's: Wisdom 16 at level 5 is 14.
    assert.equal(who(held, "mage").actions.find((one) => one.label === "Dismiss")!.save!.difficulty, 14);
  }

  // ── Break Enchantment: only what a fiend (...) put on, and the spell is over ──
  {
    const state = warded();
    const brenna = who(state, "brenna");
    brenna.tracked.push(
      { condition: "charmed", source: "imp", rounds: null },
      { condition: "frightened", source: "thug", rounds: null },
    );
    const step = cast(state, "Break", ["brenna"]);
    assert.deepEqual(holds(step.state, "brenna"), ["frightened"]);
    assert.deepEqual(holds(step.state, "mage"), []);
    assert.equal(who(step.state, "mage").concentrating, null);
    assert.ok(!labels(step.state).includes("Break"));
    // Somebody held only by what a humanoid put on is nobody it can be used on.
    const other = warded();
    who(other, "brenna").tracked.push({ condition: "frightened", source: "thug", rounds: null });
    assert.deepEqual(rulesetOptionTargets(definition, other, "mage", option(other, "Break")), []);
    // Charmed by both: the fiend's charm goes, the other's stays.
    const both = warded();
    who(both, "brenna").tracked.push(
      { condition: "charmed", source: "imp", rounds: null },
      { condition: "charmed", source: "thug", rounds: null },
    );
    const after = cast(both, "Break", ["brenna"]).state;
    assert.deepEqual(
      who(after, "brenna").tracked.map((one) => [one.condition, one.source]),
      [["charmed", "thug"]],
    );
  }

  // ── Dismissal: out of the fight for good, alive, and what it put on goes ──
  {
    const state = warded();
    who(state, "brenna").tracked.push({ condition: "charmed", source: "imp", rounds: null });
    assert.deepEqual(rulesetOptionTargets(definition, state, "mage", option(state, "Dismiss")), ["imp"]);
    d20 = 2;
    const step = cast(state, "Dismiss", ["imp"]);
    const imp = who(step.state, "imp");
    assert.ok(imp.defeated && imp.away && imp.diedRound === undefined);
    assert.equal(imp.health!.value, 30);
    assert.deepEqual(kinds(step.events), [{ type: "dismissed", actorId: "mage", targetId: "imp", label: "Dismiss" }]);
    assert.deepEqual(holds(step.state, "brenna"), []);
    assert.deepEqual(holds(step.state, "mage"), []);
    // A made save leaves it, and the spell is spent all the same.
    const saved = warded();
    d20 = 20;
    const kept = cast(saved, "Dismiss", ["imp"]);
    assert.ok(!who(kept.state, "imp").defeated);
    assert.deepEqual(holds(kept.state, "mage"), []);
  }

  // ── Banishment ──
  {
    const banished = (target: string, board = false) => {
      d20 = 2;
      const step = cast(fight(board), "Banish", [target]);
      assert.ok(who(step.state, target).defeated && who(step.state, target).away);
      assert.deepEqual(kinds(step.events), [
        { type: "dismissed", actorId: "mage", targetId: target, label: "Banish", while: "banished" },
      ]);
      return step.state;
    };
    // Ended early (the caster's concentration goes to another spell): back.
    for (const target of ["imp", "thug"]) {
      const state = banished(target);
      const step = cast(state, "Dispel", ["mage"]);
      const back = who(step.state, target);
      assert.ok(!back.defeated && !back.away, target);
      assert.deepEqual(kinds(step.events), [{ type: "returned", targetId: target }]);
    }
    // Its whole time: the humanoid comes back, the fiend stays gone.
    const run = (target: string) => {
      const state = banished(target);
      who(state, target).tracked.find((one) => one.condition === "banished")!.rounds = 1;
      const end = rulesetCombatOptions(definition, state, "mage").find((one) => one.kind === "end-turn")!;
      return applyRulesetCombatChoice(definition, state, { actorId: "mage", optionId: end.id, targetIds: [] }, roll);
    };
    const thug = run("thug");
    assert.ok(!who(thug.state, "thug").defeated);
    assert.deepEqual(kinds(thug.events), [{ type: "returned", targetId: "thug" }]);
    const imp = run("imp");
    assert.ok(who(imp.state, "imp").defeated && who(imp.state, "imp").away);
    assert.deepEqual(kinds(imp.events), [{ type: "returned", targetId: "imp", gone: true }]);
    // The clock is the caster's, since the banished take no turns: 10 rounds of them.
    const counted = banished("thug");
    assert.equal(who(counted, "thug").tracked.find((one) => one.condition === "banished")!.clockOf, "source");
    // Kept off what it is away under, it stays; and one away holds up no spell of its own.
    {
      d20 = 2;
      const state = fight();
      who(state, "thug").block = { ...who(state, "thug").block!, conditionImmunities: ["banished"] };
      who(state, "imp").concentrating = { actionId: "hex", label: "Hex" };
      assert.ok(!who(cast(state, "Banish", ["thug"]).state, "thug").defeated);
      const step = cast(fight(), "Banish", ["imp"]);
      assert.equal(who(step.state, "imp").concentrating, null);
      const held = fight();
      who(held, "imp").concentrating = { actionId: "hex", label: "Hex" };
      assert.equal(who(cast(held, "Banish", ["imp"]).state, "imp").concentrating, null);
    }
    // A made save sends nobody.
    d20 = 20;
    assert.ok(!who(cast(fight(), "Banish", ["thug"]).state, "thug").defeated);
    // On a board: off it while away, and back in its place, or the nearest free one.
    const state = banished("thug", true);
    const brenna = who(state, "brenna");
    brenna.x = 5;
    brenna.y = 5;
    const back = cast(state, "Dispel", ["mage"]).state;
    const thugBack = who(back, "thug");
    assert.notDeepEqual([thugBack.x, thugBack.y], [5, 5]);
    assert.equal(Math.max(Math.abs(thugBack.x! - 5), Math.abs(thugBack.y! - 5)), 1);
    // The screen is told, and draws it on no square while away.
    const view = (encounter: RulesetEncounterState) =>
      directedRulesetView(definition, {
        style: "ruleset",
        party: [],
        enemies: [],
        rulesetFight: { encounter, events: [], eventSeq: 0, controllers: {}, adjustments: [], bosses: [] },
      } as never)!;
    const gone = banished("thug", true);
    const seen = view(gone);
    assert.equal(seen.combatants.find((one) => one.id === "thug")!.away, true);
    assert.equal(seen.combatants.find((one) => one.id === "imp")!.away, undefined);
    const square = rulesetBoardCells(seen, null).find((cell) => cell.x === 5 && cell.y === 5)!;
    assert.equal(square.occupant, undefined);
    const free = banished("thug", true);
    const home = who(cast(free, "Dispel", ["mage"]).state, "thug");
    assert.deepEqual([home.x, home.y], [5, 5]);
  }

  // ── Import refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const entry = (doc: Record<string, any>, id: string) =>
      doc.catalogs.at(-1).entries.find((one: { id: string }) => one.id === id).mechanics;
    refused(
      (doc) => (entry(doc, "banish").dismisses = { while: "warded" }),
      /Away while it holds "warded", so the entry puts it on/,
    );
    refused((doc) => (entry(doc, "break").endsCondition = "dazzled"), /Unknown condition "dazzled"/);
    refused((doc) => (entry(doc, "break").ends.from = { types: ["dragon"] }), /dragon/);
    refused((doc) => (entry(doc, "banish").dismisses.gone = { types: ["dragon"] }), /dragon/);
    refused((doc) => (doc.combat.conditions.at(-2).actions = ["potions/heal"]), /Unknown catalog "potions"/);
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
      "A ruleset with conditions that give actions, uses that end a condition, cures of only what some creatures put on, or uses that send somebody out of the fight, requires schemaVersion 2 and capabilityApi 1.236 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const one of [
      { endsCondition: "warded" },
      { dismisses: true },
      { dismisses: { while: "banished" } },
      { ends: { conditions: ["charmed"], from: planar } },
    ]) {
      const document = { ...without, extra: { spell: { mechanics: one } } };
      assert.equal(issue(235, document), gate, JSON.stringify(one));
      assert.notEqual(issue(236, document), gate);
    }
    const giving = structuredClone(without);
    giving.combat.conditions.push({ condition: "warded", effects: [], actions: ["spells/break"] });
    assert.equal(issue(235, giving), gate);
    assert.notEqual(issue(236, giving), gate);
    // A cure with no `from`, and a creature's own actions, are not this.
    assert.notEqual(issue(235, { ...without, extra: { ends: { conditions: ["charmed"] } } }), gate);
    assert.notEqual(issue(235, without), gate);
    assert.equal(issue(235, without, new Map([["spells.json", { entries: [dismissal] }]])), gate);
  }

  // ── A strike a condition gives is no opportunity attack while the condition is off ──
  {
    const strike = (id: string, count: number, whileHolds?: string) =>
      ({
        id,
        label: id,
        kind: "attack",
        budget: "action",
        reach: 1,
        toHit: 5,
        damage: { count, sides: 6, flat: 0 },
        ...(whileHolds ? { whileHolds } : {}),
      }) as unknown as RulesetCombatAction;
    const paladin = {
      id: "paladin",
      actions: [strike("longsword", 1), strike("flame-blade", 3, "flaming")],
      uses: {},
      spent: [],
      tracked: [] as Array<{ condition: string }>,
    } as unknown as RulesetCombatant;
    assert.equal(rulesetOpportunityAttack(paladin)?.id, "longsword", "the blade not called up");
    paladin.tracked.push({ condition: "flaming" } as never);
    assert.equal(rulesetOpportunityAttack(paladin)?.id, "flame-blade", "the blade in hand");
  }

  console.log(
    "Ruleset dismissals: Dispel Evil and Good gives Break Enchantment and Dismissal and ends with them, Banishment sends away until it ends and keeps a fiend gone; gated at 1.236.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
