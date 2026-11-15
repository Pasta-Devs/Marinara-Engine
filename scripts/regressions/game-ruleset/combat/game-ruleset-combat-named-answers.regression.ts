/**
 * Answers to one entry by name (Capability API 1.117): 5e's Shield against Magic Missile.
 *
 *   - `against.entries` opens a moment only for an action from one of those entries; a catalog or an
 *     entry matching is enough, and an action from another entry opens nothing.
 *   - `also` takes the same answer at more moments, each with its own `against`: Shield is still
 *     taken when an attack hits, and now when Magic Missile is aimed at its caster.
 *   - A condition's `noDamageFrom` keeps those entries' harm off its holder, whatever its kind.
 *   - Import (cancels with `also`, refs, catalogs) and the install gate (1.117).
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
  rulesetCombatOptions,
  rulesetReactionsAt,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-named-answers-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const shieldReaction = (extra: Record<string, unknown> = {}) => ({
    on: "hit",
    also: [{ on: "aimed", against: { entries: ["spells/magic-missile"] } }],
    ...extra,
  });
  const spells = (reaction: Record<string, unknown> = shieldReaction()): RulesetCatalogEntry[] =>
    [
      {
        id: "magic-missile",
        label: "Magic Missile",
        rows: [{ list: "spells", values: { name: "Magic Missile", level: 1, prepared: true } }],
        mechanics: {
          kind: "attack",
          autoHit: true,
          amount: { flat: 10 },
          damageType: "force",
          cost: [{ pool: "slots_1", amount: 1 }],
        },
      },
      {
        id: "bolt",
        label: "Bolt",
        rows: [{ list: "spells", values: { name: "Bolt", level: 1, prepared: true } }],
        mechanics: {
          kind: "attack",
          autoHit: true,
          amount: { flat: 4 },
          damageType: "force",
          cost: [{ pool: "slots_1", amount: 1 }],
        },
      },
      {
        id: "shield",
        label: "Shield",
        rows: [{ list: "spells", values: { name: "Shield", level: 1, prepared: true } }],
        mechanics: {
          kind: "buff",
          targets: "self",
          budget: "reaction",
          cost: [{ pool: "slots_1", amount: 1 }],
          reaction,
          applies: [{ condition: "shielded", duration: { rounds: 1, at: "turn-start" } }],
        },
      },
    ] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  /** The 5e example with a spells catalog and Shield's condition, which keeps Magic Missile off. */
  const withShield = (doc: Record<string, any>, condition: Record<string, unknown> = {}) => {
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells() });
    doc.sheet.live.conditions.push({ id: "shielded", label: "Shielded" });
    doc.combat.conditions.push({
      condition: "shielded",
      modifiers: [{ to: "defense", flat: 5 }],
      noDamageFrom: ["spells/magic-missile"],
      ...condition,
    });
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

  const caster = (entries: RulesetCatalogEntry[], abilities: Record<string, number>) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 8, con: 12, wis: 12, cha: 10, int: 16, ...abilities },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_1: 4 },
      lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  /** The mage first, and Corwin, who holds Shield. */
  const fight = (definition: RulesetDefinition, entries = spells()): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells: entries },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "enemy",
          block: { sheet: caster(entries, { dex: 20 }), actions: [] },
        } as RulesetCombatantInput,
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: caster(entries, { dex: 1 }),
          live: {},
          catalogs: { spells: entries },
        },
      ],
    });
  const definition = parsedOrThrow(fiveE(withShield), "the 5e example with Shield");
  const cast = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((entry) => entry.label === label);
    assert.ok(option, `the mage has ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["corwin"] },
      dice(),
    );
  };

  // ── What the fight carries ──
  {
    const state = fight(definition);
    const corwin = rulesetCombatant(state, "corwin")!;
    const shield = corwin.actions.find((action) => action.label === "Shield")!;
    assert.deepEqual(shield.reaction, {
      on: "hit",
      at: "source",
      also: [{ on: "aimed", against: { entries: ["spells/magic-missile"] } }],
    });
    const missile = rulesetCombatant(state, "mage")!.actions.find((action) => action.label === "Magic Missile")!;
    assert.equal(missile.entry, "spells/magic-missile", "an action knows the entry it came from");
    assert.equal(missile.catalog, "spells");
    // Still on the moment it always had, whatever the attack.
    const atHit = rulesetReactionsAt(definition, definition.combat!, state, corwin, "hit", "mage");
    assert.deepEqual(
      atHit.map((action) => action.label),
      ["Shield"],
    );
    const aimed = (cause: { catalog?: string; entry?: string } = {}) =>
      rulesetReactionsAt(definition, definition.combat!, state, corwin, "aimed", "mage", cause).map(
        (action) => action.label,
      );
    assert.deepEqual(aimed({ catalog: "spells", entry: "spells/magic-missile" }), ["Shield"]);
    assert.deepEqual(
      aimed({ catalog: "spells", entry: "spells/bolt" }),
      [],
      "another entry of the same catalog opens nothing",
    );
    assert.deepEqual(aimed(), [], "nor does an action from no entry at all");
  }

  // ── Shield against Magic Missile ──
  {
    const held = cast(fight(definition), "Magic Missile");
    assert.ok(held.state.window, JSON.stringify(held.events));
    assert.equal(held.state.window.trigger.kind, "aimed");
    assert.deepEqual(held.state.window.waiting, ["corwin"]);
    assert.deepEqual(eventsOf(held.events, "damage"), [], "held before it lands");
    const option = rulesetWindowOptions(definition, held.state, "corwin").find((entry) => entry.label === "Shield");
    assert.ok(option, "Corwin may raise Shield");
    const shielded = applyRulesetCombatChoice(
      definition,
      held.state,
      { actorId: "corwin", optionId: option.id, targetIds: [], window: held.state.window.id },
      dice(),
    );
    assert.deepEqual(eventsOf(shielded.events, "cancelled"), [], "it is not called off");
    const [damage] = eventsOf(shielded.events, "damage");
    assert.deepEqual(
      [damage?.targetId, damage?.amount, damage?.dealt, damage?.adjust],
      ["corwin", 10, 0, "immune"],
      "it lands and does nothing",
    );
    const corwin = rulesetCombatant(shielded.state, "corwin")!;
    assert.ok(corwin.tracked.some((entry) => entry.condition === "shielded"));
    assert.ok(
      eventsOf(shielded.events, "spend").some((spend) => spend.actorId === "corwin" && spend.pool === "slots_1"),
      "Shield is paid for",
    );

    // Passing lets it through.
    const again = cast(fight(definition), "Magic Missile");
    const passed = applyRulesetCombatChoice(
      definition,
      again.state,
      { actorId: "corwin", optionId: RULESET_PASS_OPTION, targetIds: [], window: again.state.window!.id },
      dice(),
    );
    const [taken] = eventsOf(passed.events, "damage");
    assert.deepEqual([taken?.dealt, taken?.adjust], [10, "none"]);
  }

  // ── Another spell is not answered, and Shielded keeps only what it names off ──
  {
    const bolt = cast(fight(definition), "Bolt");
    assert.equal(bolt.state.window, undefined, "nobody is asked about a bolt");
    const [damage] = eventsOf(bolt.events, "damage");
    assert.deepEqual([damage?.dealt, damage?.adjust], [4, "none"]);

    // Already shielded: Magic Missile does nothing, a bolt does its all.
    const state = fight(definition);
    rulesetCombatant(state, "corwin")!.tracked.push({ condition: "shielded", rounds: 1 });
    const missile = cast(state, "Magic Missile");
    const option = rulesetWindowOptions(definition, missile.state, "corwin").find((entry) => entry.label === "Shield")!;
    const passed = applyRulesetCombatChoice(
      definition,
      missile.state,
      { actorId: "corwin", optionId: RULESET_PASS_OPTION, targetIds: [], window: missile.state.window!.id },
      dice(),
    );
    assert.ok(option);
    assert.deepEqual(
      eventsOf(passed.events, "damage").map((event) => [event.dealt, event.adjust]),
      [[0, "immune"]],
      "under Shield, Magic Missile does nothing even unanswered",
    );
    const shieldedState = fight(definition);
    rulesetCombatant(shieldedState, "corwin")!.tracked.push({ condition: "shielded", rounds: 1 });
    const struck = cast(shieldedState, "Bolt");
    assert.deepEqual(
      eventsOf(struck.events, "damage").map((event) => [event.dealt, event.adjust]),
      [[4, "none"]],
    );
  }

  // ── An `against` naming catalogs still works, and either matching is enough ──
  {
    const both = spells(
      shieldReaction({ also: [{ on: "aimed", against: { catalogs: ["feats"], entries: ["spells/bolt"] } }] }),
    );
    const bolt = cast(fight(definition, both), "Bolt");
    assert.ok(bolt.state.window, "the named entry opens it");
    const missile = cast(fight(definition, both), "Magic Missile");
    assert.equal(missile.state.window, undefined, "an entry it does not name, from a catalog it does not name");
    const byCatalog = spells(shieldReaction({ also: [{ on: "aimed", against: { catalogs: ["spells"] } }] }));
    assert.ok(cast(fight(definition, byCatalog), "Bolt").state.window, "any spell, by catalog");
  }

  // ── Import ──
  {
    const withShieldReaction = (reaction: Record<string, unknown>, condition: Record<string, unknown> = {}) =>
      fiveE((doc) => {
        withShield(doc, condition);
        doc.catalogs.find((one: { id: string }) => one.id === "spells").entries = spells(reaction);
      });
    refused(
      withShieldReaction(shieldReaction({ on: "aimed", cancels: true })),
      /answers one moment/,
      "also on a reaction that cancels",
    );
    refused(
      withShieldReaction(shieldReaction({ also: [{ on: "aimed", against: { entries: ["magic-missile"] } }] })),
      /<catalog>\/<entry>/,
      "an entry without its catalog",
    );
    refused(
      withShieldReaction(shieldReaction({ also: [{ on: "aimed", against: { entries: ["scrolls/magic-missile"] } }] })),
      /Unknown catalog "scrolls"/,
      "an entry of a catalog the ruleset has not got",
    );
    refused(
      withShieldReaction(shieldReaction({ also: [{ on: "aimed", against: {} }] })),
      /names catalogs, entries or both/,
      "an empty against",
    );
    refused(withShieldReaction(shieldReaction({ also: [] })), /also/, "an empty also");
    refused(
      withShieldReaction(shieldReaction(), { noDamageFrom: ["scrolls/magic-missile"] }),
      /Unknown catalog "scrolls"/,
      "a condition keeping off a catalog the ruleset has not got",
    );
    // A creature's own reaction says it the same way.
    parsedOrThrow(
      fiveE((doc) => {
        withShield(doc);
        const creature = doc.catalogs
          .find((one: { id: string }) => one.id === "creatures")
          .entries.find((one: { id: string }) => one.id === "grave-piper").creature;
        creature.actions.push({
          id: "ward",
          name: "Ward",
          budget: "reaction",
          reaction: shieldReaction(),
        });
      }),
      "a creature's own answer to a named entry",
    );
  }

  // ── The install gate: 1.117 ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-shield",
      name: "Shield",
      version: "0.1.0",
      description: "A packaged ruleset whose Shield answers Magic Missile.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /name the entries they answer.*capabilityApi 1\.117/;
    const issue = (minor: number, doc: Record<string, any>) =>
      getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
    const answering = (reaction: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "spells", label: "Spells", entries: spells(reaction) });
    };
    const keepingOff = (doc: Record<string, any>) => {
      doc.combat.conditions.push({ condition: "parrying", noDamageFrom: ["feats/x"] });
    };
    for (const [what, edit] of [
      ["an answer at more moments", answering(shieldReaction())],
      ["an answer to a named entry", answering({ on: "aimed", against: { entries: ["spells/bolt"] } })],
      ["a condition keeping an entry off", keepingOff],
    ] as const) {
      assert.match(issue(116, fiveE(edit)) ?? "", gate, what);
      assert.doesNotMatch(issue(117, fiveE(edit)) ?? "", gate, what);
    }
    assert.doesNotMatch(
      issue(116, fiveE(answering({ on: "aimed", against: { catalogs: ["spells"] } }))) ?? "",
      gate,
      "an answer by catalog asks nothing new",
    );
    assert.doesNotMatch(issue(116, fiveE()) ?? "", gate, "the example as shipped asks nothing new");
  }

  console.log("Named answers: Shield answers Magic Missile by name and keeps it off, gated at 1.117.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
