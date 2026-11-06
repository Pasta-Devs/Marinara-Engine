/**
 * Answers to one kind of blow, from a source in sight (Capability API 1.118): 5e's Parry.
 *
 *   - `blow: "melee" | "ranged"` on a `hit` moment. A blow is melee while its target stands in the
 *     weapon's reach: a scimitar always, a bow never, a thrown dagger only next to its target. With
 *     no board a weapon with a reach is taken as swung in hand.
 *   - `seesSource: true` opens the moment only while its holder sees the attacker: never one who has
 *     hidden, and on a board only with a line of sight between them.
 *   - Both on a moment in `also`; `blow` only on a `hit` one.
 *   - Import and the install gate (1.118).
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
  rulesetBlowKind,
  rulesetCombatant,
  rulesetReactionsAt,
  rulesetSees,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-blow-kind-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const refused = (document: unknown, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(document);
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
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

  const definition = parsedOrThrow(fiveE(), "the 5e example");
  const parryReaction = (extra: Record<string, unknown> = {}) => ({
    on: "hit",
    blow: "melee",
    seesSource: true,
    ...extra,
  });
  const parryEntry = (reaction: Record<string, unknown>): RulesetCatalogEntry =>
    ({
      id: "parry",
      label: "Parry",
      rows: [{ list: "spells", values: { name: "Parry", level: 1, prepared: true } }],
      mechanics: {
        kind: "buff",
        targets: "self",
        budget: "reaction",
        reaction,
        applies: [{ condition: "parrying", duration: { rounds: 1 }, endsAfter: "attacked" }],
      },
    }) as unknown as RulesetCatalogEntry;
  /** Snag strikes first: a scimitar, a bow, and a dagger it may throw, all at +4. */
  const snag: RulesetStatBlock = {
    health: 40,
    defense: 13,
    initiativeModifier: 20,
    speed: 30,
    actions: [
      {
        id: "scimitar",
        name: "Scimitar",
        budget: "action",
        toHit: 4,
        reach: 5,
        damage: { count: 1, sides: 6, flat: 2 },
      },
      {
        id: "bow",
        name: "Bow",
        budget: "action",
        toHit: 4,
        range: { normal: 80, long: 320 },
        damage: { count: 1, sides: 6, flat: 2 },
      },
      {
        id: "dagger",
        name: "Dagger",
        budget: "action",
        toHit: 4,
        reach: 5,
        range: { normal: 20, long: 60 },
        damage: { count: 1, sides: 4, flat: 2 },
      },
    ],
  } as RulesetStatBlock;
  const line = (width: number, walls: number[] = []): TacticalGrid => ({
    width,
    height: 1,
    tiles: [Array.from({ length: width }, (_, x) => (walls.includes(x) ? ("wall" as const) : ("plains" as const)))],
  });
  /** Snag at the left end; Brenna, at Armor Class 12, `brennaAt` cells along, holding the Parry. */
  const fight = (
    reaction: Record<string, unknown> = parryReaction(),
    board: { grid: TacticalGrid; brennaAt: number } | null = { grid: line(10), brennaAt: 1 },
  ): RulesetEncounterState => {
    const parry = parryEntry(reaction);
    return createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "snag", name: "Snag", side: "enemy", block: snag } as RulesetCombatantInput,
        {
          id: "brenna",
          name: "Brenna",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 1, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 40 },
            lists: { spells: rowsFromCatalogEntry("spells", parry).map((row) => row.row) },
          }),
          live: {},
          catalogs: { spells: [parry] },
        },
      ],
      ...(board
        ? { board: { grid: board.grid, placements: { snag: { x: 0, y: 0 }, brenna: { x: board.brennaAt, y: 0 } } } }
        : {}),
    });
  };
  /** A 15 to hit, which hits Armor Class 12, and the damage dice behind it if nobody is asked. */
  const strike = (state: RulesetEncounterState, optionId: string) =>
    applyRulesetCombatChoice(definition, state, { actorId: "snag", optionId, targetIds: ["brenna"] }, dice(15, 3));
  const asked = (step: ReturnType<typeof strike>) =>
    !!step.state.window &&
    step.state.window.trigger.kind === "hit" &&
    rulesetWindowOptions(definition, step.state, "brenna").some((option) => option.label === "Parry");

  // ── What a blow is ──
  {
    const state = fight();
    const snagNow = rulesetCombatant(state, "snag")!;
    const brenna = rulesetCombatant(state, "brenna")!;
    const action = (id: string) => snagNow.actions.find((one) => one.id === id)!;
    assert.equal(rulesetBlowKind(state, snagNow, brenna, action("scimitar")), "melee");
    assert.equal(rulesetBlowKind(state, snagNow, brenna, action("bow")), "ranged", "a bow, even point-blank");
    assert.equal(rulesetBlowKind(state, snagNow, brenna, action("dagger")), "melee", "a dagger in reach");
    const far = fight(parryReaction(), { grid: line(10), brennaAt: 3 });
    assert.equal(
      rulesetBlowKind(far, rulesetCombatant(far, "snag")!, rulesetCombatant(far, "brenna")!, action("dagger")),
      "ranged",
      "and thrown from afar",
    );
    const boardless = fight(parryReaction(), null);
    assert.equal(
      rulesetBlowKind(
        boardless,
        rulesetCombatant(boardless, "snag")!,
        rulesetCombatant(boardless, "brenna")!,
        action("dagger"),
      ),
      "melee",
      "swung in hand where nothing is measured",
    );
  }

  // ── Parry answers melee, from a source in sight ──
  {
    const away = { grid: line(10), brennaAt: 3 };
    const scimitar = strike(fight(), "scimitar");
    assert.ok(asked(scimitar), "a scimitar hit asks Brenna");
    assert.equal(scimitar.state.window?.trigger.kind === "hit" && scimitar.state.window.trigger.blow, "melee");
    assert.deepEqual(eventsOf(scimitar.events, "damage"), [], "held before its damage");

    // A few cells off, where a bow is not shot at disadvantage.
    const shot = strike(fight(parryReaction(), away), "bow");
    assert.equal(shot.state.window, undefined, "a bow is not parried");
    assert.equal(eventsOf(shot.events, "damage").length, 1);

    assert.ok(asked(strike(fight(), "dagger")), "a dagger stabbed in reach is");
    const thrown = strike(fight(parryReaction(), away), "dagger");
    assert.equal(thrown.state.window, undefined, "a dagger thrown from afar is not");

    // Hidden, the attacker is not seen, so nothing is asked, unless the answer does not care.
    const hiddenState = fight();
    rulesetCombatant(hiddenState, "snag")!.flags.hidden = true;
    assert.equal(strike(hiddenState, "scimitar").state.window, undefined, "an attacker unseen is not parried");
    const blind = fight(parryReaction({ seesSource: undefined }));
    rulesetCombatant(blind, "snag")!.flags.hidden = true;
    assert.ok(asked(strike(blind, "scimitar")), "an answer that need not see still answers");

    // Answering only ranged blows, the other way round.
    const deflect = parryReaction({ blow: "ranged", seesSource: undefined });
    assert.ok(asked(strike(fight(deflect, away), "bow")));
    assert.equal(strike(fight(deflect), "scimitar").state.window, undefined);

    // Taken at `also` moments the same way.
    const viaAlso = { on: "harmed", also: [{ on: "hit", blow: "melee" }] };
    assert.ok(asked(strike(fight(viaAlso), "scimitar")), "an also moment narrowed to melee");
    const harmed = strike(fight(viaAlso, away), "bow");
    assert.equal(asked(harmed), false, "no hit moment for a bow");
    assert.equal(harmed.state.window?.trigger.kind, "harmed", "only its first moment, once hurt");
  }

  // ── Sight on the board ──
  {
    const walled = fight(parryReaction(), { grid: line(10, [2]), brennaAt: 4 });
    const brenna = rulesetCombatant(walled, "brenna")!;
    const snagNow = rulesetCombatant(walled, "snag")!;
    assert.equal(rulesetSees(walled, brenna, snagNow), false, "a wall between them");
    assert.equal(rulesetSees(fight(), rulesetCombatant(fight(), "brenna")!, snagNow), true);
    const at = (state: RulesetEncounterState, blow?: "melee" | "ranged") =>
      rulesetReactionsAt(definition, definition.combat!, state, rulesetCombatant(state, "brenna")!, "hit", "snag", {
        ...(blow ? { blow } : {}),
      }).map((action) => action.label);
    assert.deepEqual(at(walled, "melee"), [], "nobody parries what they cannot see");
    assert.deepEqual(at(fight(), "melee"), ["Parry"]);
    assert.deepEqual(at(fight()), [], "a hit that says nothing of its blow (a window from before) is not one");
    assert.deepEqual(at(fight(parryReaction(), null), "melee"), ["Parry"], "no board, everybody seen");
  }

  // ── Import ──
  {
    const withCreatureAnswer = (reaction: Record<string, unknown>) =>
      fiveE((doc) => {
        const creature = doc.catalogs
          .find((one: { id: string }) => one.id === "creatures")
          .entries.find((one: { id: string }) => one.id === "toll-sergeant").creature;
        creature.actions[0].reaction = reaction;
      });
    parsedOrThrow(withCreatureAnswer(parryReaction()), "a creature's Parry");
    refused(withCreatureAnswer({ on: "harmed", blow: "melee" }), /"blow" says what kind of hit/, "blow off a hit");
    refused(
      withCreatureAnswer({ on: "hit", also: [{ on: "harmed", blow: "ranged" }] }),
      /"blow" says what kind of hit/,
      "blow off a hit, in also",
    );
    refused(withCreatureAnswer({ on: "hit", blow: "thrown" }), /blow/, "a kind of blow there is not");
    refused(withCreatureAnswer({ on: "hit", seesSource: false }), /seesSource/, "seesSource is only ever true");
    parsedOrThrow(withCreatureAnswer({ on: "harmed", seesSource: true }), "sight on any moment");
  }

  // ── The install gate: 1.118 ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-parry",
      name: "Parry",
      version: "0.1.0",
      description: "A packaged ruleset whose Parry answers melee only.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /one kind of blow.*capabilityApi 1\.118/;
    const issue = (minor: number, doc: Record<string, any>) =>
      getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
    const answering = (reaction: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "spells", label: "Spells", entries: [parryEntry(reaction)] });
    };
    for (const [what, edit] of [
      ["a blow", answering({ on: "hit", blow: "melee" })],
      ["sight", answering({ on: "hit", seesSource: true })],
      ["a blow in also", answering({ on: "aimed", also: [{ on: "hit", blow: "ranged" }] })],
    ] as const) {
      assert.match(issue(117, fiveE(edit)) ?? "", gate, what);
      assert.doesNotMatch(issue(118, fiveE(edit)) ?? "", gate, what);
    }
    assert.doesNotMatch(issue(117, fiveE(answering({ on: "hit" }))) ?? "", gate, "a plain hit asks nothing new");
    assert.doesNotMatch(issue(117, fiveE()) ?? "", gate, "the example as shipped asks nothing new");
  }

  console.log("Blow kind: Parry answers melee from a source in sight, gated at 1.118.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
