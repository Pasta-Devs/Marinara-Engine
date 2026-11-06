/**
 * Ruleset combat, slice C5e (#6712): a reaction that answers somebody USING something, and what a
 * reaction answers.
 *
 * What is pinned here:
 *   - `used`: when somebody on the other side is about to use something, a window opens BEFORE it
 *     resolves for everybody on that side holding a reaction for the moment that reaches the user,
 *     whoever it is aimed at. An answer that cancels calls it off; its price stays spent.
 *   - `against: { catalogs }`: only an action that came from an entry of those catalogs opens the
 *     moment for that reaction. A weapon row has no entry behind it and opens nothing.
 *   - `used` first, then `aimed`: a use nobody stopped is aimed next, and resolves after both.
 *   - Nothing opened inside a window opens another, so a counter cannot itself be countered.
 *   - On a board a counter answers only what it reaches.
 *   - Every import refusal, the words on screen, and the 1.44 gate.
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
  rulesetCatalogEntryIssues,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  RULESET_PASS_OPTION,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
  type TacticalGrid,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-moments-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const [
    { getCapabilityPackageInstallIssue },
    { rulesetWindowTargetOf },
    { rulesetCombatEventLine, rulesetCombatNames },
  ] = await Promise.all([
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    import("../../packages/server/src/services/game/ruleset-combat-director.service.js"),
    import("../../packages/client/src/lib/ruleset-combat-log.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  const english = JSON.parse(read("../../packages/client/src/localization/locales/en.json")) as Record<string, string>;
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const ember = parsedOrThrow(JSON.parse(emberText), "the 2d6 example");
  const knacks = () => ember.catalogs!.find((catalog) => catalog.id === "knacks")!.entries!;
  const knackRows = (entries: readonly RulesetCatalogEntry[], ids: string[]) =>
    ids.flatMap((id) =>
      rowsFromCatalogEntry(
        "knacks",
        entries.find((entry) => entry.id === id)!,
      )
        .filter((row) => row.list === "knacks")
        .map((row) => row.row),
    );

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

  const axe = { name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" };
  /** Juno is who things are thrown at. Pell holds the counter; Juno holds `extra` when a case wants
   *  her to have something of her own to answer with. */
  const juno = (entries = knacks(), extra: string[] = []): RulesetCombatantInput => ({
    id: "juno",
    name: "Juno",
    side: "party",
    build: rulesetSheetBuildSchema.parse({
      abilities: { brawn: 2, wits: 0, heart: 1 },
      fields: { toughness: 4 },
      lists: { gear: [axe], knacks: knackRows(entries, extra) },
    }),
    live: {},
    catalogs: { knacks: entries },
  });
  const pell = (entries = knacks(), picked = ["smother"]): RulesetCombatantInput => ({
    id: "pell",
    name: "Pell",
    side: "party",
    build: rulesetSheetBuildSchema.parse({
      abilities: { brawn: 1, wits: 0, heart: 2 },
      fields: { toughness: 2 },
      lists: { knacks: knackRows(entries, picked) },
    }),
    live: {},
    catalogs: { knacks: entries },
  });
  /** An opponent written as a sheet, so it throws a knack from the same catalog. */
  const kindler = (entries = knacks(), picked = ["coldfire-toss"], id = "kindler"): RulesetCombatantInput => ({
    id,
    name: id === "kindler" ? "Kindler" : "Soot",
    side: "enemy",
    block: {
      sheet: rulesetSheetBuildSchema.parse({
        abilities: { brawn: 1, wits: 2, heart: 1 },
        fields: { toughness: 3 },
        lists: { gear: [axe], knacks: knackRows(entries, picked) },
      }),
      actions: [],
    },
  });
  /** The Kindler first: 6 + 6 + Wits 2 against Juno's and Pell's ones. */
  const fight = (
    definition: RulesetDefinition,
    combatants: RulesetCombatantInput[],
    board?: { grid: TacticalGrid; placements: Record<string, { x: number; y: number }> },
    entries = knacks(),
  ): RulesetEncounterState =>
    createRulesetEncounter({
      definition,
      seed: 7,
      combatants,
      roller: dice(...combatants.flatMap((combatant) => (combatant.id === "kindler" ? [6, 6] : [1, 1]))),
      bestiary: { knacks: entries },
      ...(board ? { board } : {}),
    });
  const act = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    choice: RulesetCombatChoice,
    ...faces: number[]
  ) => applyRulesetCombatChoice(definition, state, choice, dice(...faces));
  const optionNamed = (definition: RulesetDefinition, state: RulesetEncounterState, actorId: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((entry) => entry.label === label);
    assert.ok(option, `${actorId} has no "${label}" on the menu`);
    return option;
  };
  const cellOf = (state: RulesetEncounterState, id: string) => {
    const { x, y } = rulesetCombatant(state, id)!;
    return { x: x!, y: y! };
  };
  /** Thrown at Juno; on a board an area is aimed at a cell instead, so it is thrown at hers. */
  const toss = (definition: RulesetDefinition, state: RulesetEncounterState, ...faces: number[]) =>
    act(
      definition,
      state,
      {
        actorId: "kindler",
        optionId: optionNamed(definition, state, "kindler", "Coldfire Toss").id,
        ...(state.board ? { targetIds: [], at: cellOf(state, "juno") } : { targetIds: ["juno"] }),
      },
      ...faces,
    );

  // ── Refused at import ──
  {
    const header = ember.catalogs!.find((catalog) => catalog.id === "knacks")!;
    const smother = knacks().find((entry) => entry.id === "smother")!;
    const withReaction = (reaction: unknown) =>
      rulesetCatalogEntryIssues(ember, header, [
        { ...smother, mechanics: { ...smother.mechanics!, reaction } } as never,
      ]).map((issue) => issue.message);
    assert.deepEqual(withReaction({ on: "used", at: "source", cancels: true, against: { catalogs: ["knacks"] } }), []);
    assert.deepEqual(withReaction({ on: "used", at: "source", against: { catalogs: ["hexes"] } }), [
      'Unknown catalog "hexes"',
    ]);
    const doc = JSON.parse(emberText);
    doc.catalogs
      .find((catalog: { id: string }) => catalog.id === "knacks")
      .entries.find((entry: { id: string }) => entry.id === "smother").mechanics.reaction.on = "harmed";
    const parsed = parseRulesetDefinition(doc);
    assert.ok(!parsed.ok && parsed.issues.some((issue) => /Only an "aimed" or "used" reaction cancels/.test(issue)));
  }

  // ── A knack being used opens the moment, and the counter calls it off ──
  {
    const state = fight(ember, [juno(), pell(), kindler()]);
    assert.equal(state.order[state.turn], "kindler");
    const pellActions = rulesetCombatant(state, "pell")!.actions;
    const smother = pellActions.find((action) => action.label === "Smother")!;
    assert.deepEqual(smother.reaction, { on: "used", at: "source", cancels: true, against: { catalogs: ["knacks"] } });
    assert.ok(
      !rulesetCombatOptions(ember, state, "pell").some((option) => option.label === "Smother"),
      "never on a turn",
    );
    const tossOption = optionNamed(ember, state, "kindler", "Coldfire Toss");
    assert.equal(
      rulesetCombatant(state, "kindler")!.actions.find((action) => action.id === tossOption.id)!.catalog,
      "knacks",
    );

    // Aimed at Juno, yet it is Pell who is asked: the use is what the moment is about.
    const held = toss(ember, state);
    const window = held.state.window!;
    assert.ok(window, "the toss is held");
    assert.deepEqual(window.trigger, {
      kind: "used",
      sourceId: "kindler",
      optionId: tossOption.id,
      label: "Coldfire Toss",
      catalog: "knacks",
      entry: "knacks/coldfire-toss",
    });
    assert.deepEqual(window.waiting, ["pell"]);
    assert.deepEqual(eventsOf(held.events, "window")[0], {
      type: "window",
      window: window.id,
      kind: "reaction",
      waiting: ["pell"],
      moment: "used",
      label: "Coldfire Toss",
      sourceId: "kindler",
    });
    assert.deepEqual(eventsOf(held.events, "damage"), [], "nothing lands while it is held");
    assert.deepEqual(
      rulesetWindowOptions(ember, held.state, "pell").map((option) => [option.label, option.targets, option.budget]),
      [["Smother", { side: "self", count: 0 }, undefined]],
      "a counter asks nobody to pick, and spends none of the one action a turn holds",
    );

    const luck = () => rulesetCombatant(held.state, "pell")!.sheet!.live.pools?.luck?.value;
    const smothered = act(ember, held.state, {
      actorId: "pell",
      optionId: smother.id,
      targetIds: [],
      window: window.id,
    });
    assert.deepEqual(eventsOf(smothered.events, "cancelled"), [
      {
        type: "cancelled",
        actorId: "kindler",
        optionId: tossOption.id,
        label: "Coldfire Toss",
        byId: "pell",
        with: "Smother",
      },
    ]);
    assert.deepEqual(eventsOf(smothered.events, "damage"), [], "the toss never happens");
    assert.deepEqual(eventsOf(smothered.events, "spend"), [
      // On what, so the line names it (laptop level-4 pass 2026-10-26).
      { type: "spend", actorId: "pell", pool: "luck", label: "Luck", amount: 1, on: "Smother" },
    ]);
    assert.equal(smothered.state.window, undefined);
    assert.notEqual(luck(), rulesetCombatant(smothered.state, "pell")!.sheet!.live.pools?.luck?.value);

    // Let go, it lands.
    const through = act(
      ember,
      held.state,
      { actorId: "pell", optionId: RULESET_PASS_OPTION, targetIds: [], window: window.id },
      4,
      3,
    );
    assert.equal(through.state.window, undefined);
    assert.ok(
      eventsOf(through.events, "damage").some((event) => event.targetId === "juno"),
      "the toss lands on Juno",
    );
  }

  // ── Only the other side answers, and an answer that does not cancel lands first ──
  {
    // Soot is on the Kindler's side and holds a Smother too: a friend using something is no threat.
    const crowd = fight(ember, [juno(), pell(), kindler(), kindler(knacks(), ["smother"], "soot")]);
    assert.deepEqual(toss(ember, crowd).state.window?.waiting, ["pell"]);

    // Backfire answers the use without stopping it: it lands on the Kindler, then the toss goes on.
    const doc = JSON.parse(emberText);
    doc.catalogs
      .find((catalog: { id: string }) => catalog.id === "knacks")
      .entries.push({
        id: "backfire",
        label: "Backfire",
        rows: [{ list: "knacks", values: { name: "Backfire", notes: "Burn whoever starts a knack near you." } }],
        mechanics: {
          kind: "attack",
          free: true,
          range: 8,
          targets: "enemy",
          autoHit: true,
          amount: { flat: 2 },
          damageType: "coldfire",
          reaction: { on: "used" },
        },
      });
    const variant = parsedOrThrow(doc, "a variant with an answer that strikes back");
    const entries = variant.catalogs!.find((catalog) => catalog.id === "knacks")!.entries!;
    const state = fight(variant, [juno(entries), pell(entries, ["backfire"]), kindler(entries)], undefined, entries);
    const held = toss(variant, state);
    assert.equal(held.state.window?.trigger.kind, "used");
    const [answer] = rulesetWindowOptions(variant, held.state, "pell");
    assert.equal(answer?.label, "Backfire");
    assert.equal(
      rulesetWindowTargetOf(held.state, rulesetCombatant(held.state, "pell")!, answer!),
      "kindler",
      "the Engine's picker weighs it by what it does to whoever used the knack",
    );
    const answered = act(
      variant,
      held.state,
      { actorId: "pell", optionId: answer!.id, targetIds: [], window: held.state.window!.id },
      4,
      3,
    );
    assert.equal(answered.state.window, undefined);
    assert.deepEqual(eventsOf(answered.events, "cancelled"), []);
    assert.deepEqual(
      eventsOf(answered.events, "damage").map((event) => event.targetId),
      ["kindler", "juno"],
      "the answer first, then the toss it did not stop",
    );
  }

  // ── A fake held while it is answered (Capability API 1.79) ──
  {
    // Juno presses a fake poultice on herself (a balm that heals by a flat 3, not the poultice's dice);
    // the Kindler's Backfire answers the use first, and once the window closes the use goes on as what
    // it truly is.
    const doc = JSON.parse(emberText);
    doc.catalogs
      .find((catalog: { id: string }) => catalog.id === "knacks")
      .entries.push({
        id: "backfire",
        label: "Backfire",
        rows: [{ list: "knacks", values: { name: "Backfire", notes: "Burn whoever starts a knack near you." } }],
        mechanics: {
          kind: "attack",
          free: true,
          range: 8,
          targets: "enemy",
          autoHit: true,
          amount: { flat: 1 },
          damageType: "coldfire",
          reaction: { on: "used" },
        },
      });
    const variant = parsedOrThrow(doc, "a variant with an answer that strikes back");
    const entries = variant.catalogs!.find((catalog) => catalog.id === "knacks")!.entries!;
    const poultice = variant
      .catalogs!.find((catalog) => catalog.id === "outfitter")!
      .entries!.find((entry) => entry.id === "poultice")!.item!;
    const balm = { ...poultice, use: { ...poultice.use!, amount: { flat: 3 } } };
    const state = createRulesetEncounter({
      definition: variant,
      seed: 7,
      combatants: [
        {
          ...juno(entries),
          items: [{ item: poultice, quantity: 1, worn: false, name: "Poultice", truly: { item: balm, name: "Balm" } }],
        },
        kindler(entries, ["backfire"]),
      ],
      roller: dice(6, 6, 1, 1),
      bestiary: { knacks: entries },
    });
    assert.equal(state.order[state.turn], "juno");
    const held = act(variant, state, { actorId: "juno", optionId: "use:0", targetIds: ["juno"] });
    assert.equal(held.state.window?.trigger.kind, "used", JSON.stringify(held.events));
    const through = act(
      variant,
      held.state,
      { actorId: "kindler", optionId: RULESET_PASS_OPTION, targetIds: [], window: held.state.window!.id },
      4,
      3,
    );
    const healed = eventsOf(through.events, "heal");
    assert.deepEqual(
      healed.map((event) => [event.targetId, event.rolls, event.flat]),
      [["juno", [], 3]],
      JSON.stringify(through.events),
    );
  }

  // ── It answers only knacks ──
  {
    const state = fight(ember, [juno(), pell(), kindler()]);
    const swing = act(
      ember,
      state,
      { actorId: "kindler", optionId: optionNamed(ember, state, "kindler", "Road axe").id, targetIds: ["juno"] },
      6,
      5,
      3,
    );
    assert.equal(swing.state.window, undefined, "an axe has no knack behind it, so the counter is not asked");
    assert.equal(eventsOf(swing.events, "attack").length, 1);
    // A counter that names no catalog answers anything used.
    const anything = parsedOrThrow(
      (() => {
        const doc = JSON.parse(emberText);
        delete doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "knacks")
          .entries.find((entry: { id: string }) => entry.id === "smother").mechanics.reaction.against;
        return doc;
      })(),
      "a counter for anything",
    );
    const all = anything.catalogs!.find((catalog) => catalog.id === "knacks")!.entries!;
    const open = fight(anything, [juno(all), pell(all), kindler(all)], undefined, all);
    const swung = act(anything, open, {
      actorId: "kindler",
      optionId: optionNamed(anything, open, "kindler", "Road axe").id,
      targetIds: ["juno"],
    });
    assert.equal(swung.state.window?.trigger.kind, "used", "and now the axe is answerable");
  }

  // ── On a board, only what it reaches ──
  {
    const grid: TacticalGrid = {
      width: 12,
      height: 3,
      tiles: Array.from({ length: 3 }, () => Array(12).fill("plains")),
    };
    const at = (pellX: number) =>
      fight(ember, [juno(), pell(), kindler()], {
        grid,
        placements: { kindler: { x: 0, y: 1 }, juno: { x: 1, y: 1 }, pell: { x: pellX, y: 1 } },
      });
    // Eight paces is four cells.
    assert.equal(toss(ember, at(4)).state.window?.trigger.kind, "used", "four cells away, in reach");
    const beyond = toss(ember, at(5), 4, 3);
    assert.equal(beyond.state.window, undefined, "five cells away, the toss goes ahead");
    assert.ok(eventsOf(beyond.events, "damage").some((event) => event.targetId === "juno"));
  }

  // ── Used first, then aimed, and a counter cannot be countered ──
  {
    // A variant where Juno holds a knack of her own that answers being AIMED at.
    const variant = parsedOrThrow(
      (() => {
        const doc = JSON.parse(emberText);
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "knacks")
          .entries.push({
            id: "duck",
            label: "Duck",
            summary: "Get out of the way.",
            rows: [{ list: "knacks", values: { name: "Duck", notes: "Out of the way." } }],
            mechanics: { kind: "utility", free: true, targets: "self", reaction: { on: "aimed", cancels: true } },
          });
        return doc;
      })(),
      "a variant with an aimed answer",
    );
    const entries = variant.catalogs!.find((catalog) => catalog.id === "knacks")!.entries!;
    const state = fight(
      variant,
      [juno(entries, ["duck"]), pell(entries), kindler(entries, ["coldfire-toss", "smother"])],
      undefined,
      entries,
    );
    const first = toss(variant, state);
    assert.equal(first.state.window?.trigger.kind, "used");
    // Pell lets it go: Juno is asked next, as the one it is aimed at.
    const second = act(variant, first.state, {
      actorId: "pell",
      optionId: RULESET_PASS_OPTION,
      targetIds: [],
      window: first.state.window!.id,
    });
    assert.equal(second.state.window?.trigger.kind, "aimed");
    assert.deepEqual(second.state.window?.waiting, ["juno"]);
    assert.deepEqual(eventsOf(second.events, "damage"), [], "still held");
    // She lets it go too, and it lands.
    const landed = act(
      variant,
      second.state,
      { actorId: "juno", optionId: RULESET_PASS_OPTION, targetIds: [], window: second.state.window!.id },
      4,
      3,
    );
    assert.equal(landed.state.window, undefined);
    assert.ok(eventsOf(landed.events, "damage").length > 0);
    // Pell smothers it instead: nobody is asked about it being aimed, because it never is.
    const smother = rulesetCombatant(first.state, "pell")!.actions.find((action) => action.label === "Smother")!;
    const smothering = act(variant, first.state, {
      actorId: "pell",
      optionId: smother.id,
      targetIds: [],
      window: first.state.window!.id,
    });
    // The Kindler holds a Smother too, and Pell's is a spell it may answer (counter-the-counter).
    assert.equal(smothering.state.window?.resume?.kind, "answer");
    assert.deepEqual(smothering.state.window?.waiting, ["kindler"]);
    const stopped = act(variant, smothering.state, {
      actorId: "kindler",
      optionId: RULESET_PASS_OPTION,
      targetIds: [],
      window: smothering.state.window!.id,
    });
    assert.equal(stopped.state.window, undefined, "no aimed window for something that was called off");
    assert.equal(eventsOf(stopped.events, "cancelled")[0]?.label, "Coldfire Toss");
    assert.deepEqual(eventsOf(stopped.events, "window"), [], "and nothing more is asked");
    // The Kindler smothers Pell's Smother instead: only Pell's is stopped, and the toss goes on to be
    // aimed (laptop playtest 2026-10-25: a log that said both counters stopped what they answered).
    const kindlerSmother = rulesetCombatant(smothering.state, "kindler")!.actions.find(
      (action) => action.label === "Smother",
    )!;
    const countered = act(
      variant,
      smothering.state,
      {
        actorId: "kindler",
        optionId: kindlerSmother.id,
        targetIds: [],
        window: smothering.state.window!.id,
      },
      4,
      3,
      4,
      3,
      4,
      3,
    );
    const allEvents = [...countered.events];
    let after = countered;
    for (let guard = 0; guard < 6 && after.state.window; guard++) {
      const waiter = after.state.window.waiting[0];
      if (!waiter) break;
      after = act(
        variant,
        after.state,
        {
          actorId: waiter,
          optionId: RULESET_PASS_OPTION,
          targetIds: [],
          window: after.state.window.id,
        },
        4,
        3,
        4,
        3,
        4,
        3,
      );
      allEvents.push(...after.events);
    }
    const cancels = eventsOf(allEvents, "cancelled");
    assert.equal(cancels.length, 1, `one thing stopped: ${JSON.stringify(cancels)}`);
    assert.equal(cancels[0]!.label, "Smother", "Pell's Smother");
    assert.equal(cancels[0]!.actorId, "pell");
    assert.equal(cancels[0]!.byId, "kindler");
  }

  // ── What the screen says ──
  {
    const t = ((key: string, params: Record<string, unknown> = {}) =>
      (english[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name] ?? ""))) as never;
    const state = fight(ember, [juno(), pell(), kindler()]);
    const held = toss(ember, state);
    const view = {
      combatants: held.state.combatants.map((combatant) => ({ id: combatant.id, name: combatant.name })),
    } as never;
    const event = eventsOf(held.events, "window")[0]!;
    assert.equal(
      rulesetCombatEventLine(event, rulesetCombatNames(ember, view, t), t),
      "Kindler uses Coldfire Toss, and Pell may answer.",
    );
    assert.equal(english["game.combat.ruleset.menu.windowUsed"], "{{mover}} uses {{label}}: {{name}} may answer.");
  }

  // ── Every new key needs 1.44 to install ──
  {
    assert.ok(supportedCapabilityApi.minor >= 44);
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-test",
      name: "Test",
      version: "0.1.0",
      description: "A packaged ruleset.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const issue = /requires schemaVersion 2 and capabilityApi 1\.44 or newer/;
    const entry = (reaction: unknown) => ({ catalogs: [{ id: "k", entries: [{ id: "x", mechanics: { reaction } }] }] });
    for (const reaction of [{ on: "used" }, { on: "aimed", against: { catalogs: ["k"] } }]) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(43) as never, entry(reaction)) ?? "",
        issue,
        JSON.stringify(reaction),
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(44) as never, entry(reaction)), null);
    }
    // A moment 1.33 already knew is still only 1.33's.
    assert.equal(getCapabilityPackageInstallIssue(manifest(43) as never, entry({ on: "aimed", cancels: true })), null);
  }

  console.info("game ruleset combat moment regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
