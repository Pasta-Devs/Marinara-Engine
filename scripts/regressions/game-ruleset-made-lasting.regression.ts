/**
 * What is made lasting a while before it vanishes (Capability API 1.760): 5e's Creation, "vegetable
 * matter 1 day, stone or crystal 12 hours, precious metals 1 hour, gems 10 minutes, adamantine or
 * mithral 1 minute".
 *
 *   - The Game Master's add may say how long it `lasts`; such a stack is its own, counts down on the
 *     game's clock and vanishes as it runs out.
 *   - A cast with several `lasts` offers each as its own choice; in a fight what it made counts down in
 *     its maker's turns and vanishes there, and what is left rides on the stack as the fight ends.
 *   - An item used from the bag picks one too, onto a stack of its own.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyGameInventoryOps,
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  inventoryLastsWords,
  parseInventoryTagBody,
  parseRulesetDefinition,
  passRulesetItemTime,
  readInventoryLasts,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-made-lasting-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 760);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const creation = [
    { label: "Gems", minutes: 1 },
    { label: "Vegetable matter", minutes: 1440 },
  ];
  const fiveE = (lasts: unknown = creation): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push(
      {
        id: "kit",
        label: "Kit",
        holds: "items",
        entries: [
          { id: "made", label: "Made Thing", item: { category: "gear", stack: 10 } },
          {
            id: "scroll",
            label: "Scroll of Creation",
            item: {
              category: "gear",
              stack: 10,
              use: {
                kind: "utility",
                budget: "action",
                label: "Read",
                targets: "self",
                consumes: true,
                makesItems: { item: "kit/made", count: 1, lasts },
              },
            },
          },
        ],
      },
      {
        id: "spells",
        label: "Spells",
        feeds: ["spells"],
        entries: [
          {
            id: "creation",
            label: "Creation",
            rows: [{ list: "spells", values: { name: "Creation", level: 5, prepared: true } }],
            mechanics: {
              kind: "utility",
              targets: "self",
              budget: "action",
              makesItems: { item: "kit/made", count: 2, lasts },
            },
          },
        ],
      },
    );
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const book = rulesetItemBook(definition, {
    kit: definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries! as RulesetCatalogEntry[],
  });

  // ── The Game Master's add, on the game's clock ──
  {
    assert.equal(parseInventoryTagBody('action="add" item="Rope" lasts="1 hour"')?.lasts, 60);
    assert.equal(readInventoryLasts("2 days"), 2880);
    assert.equal(readInventoryLasts("10"), 10);
    assert.equal(readInventoryLasts("forever"), undefined);
    assert.equal(inventoryLastsWords(720), "12 hours");
    const added = applyGameInventoryOps([], [
      { op: "add", name: "Rope", count: 1, lasts: 60 },
      { op: "add", name: "Rope", count: 1, lasts: 30 },
      { op: "add", name: "Rope", count: 1 },
    ] as never);
    assert.deepEqual(
      added.stacks.map((stack) => [stack.quantity, stack.vanishesIn]),
      [
        [1, 60],
        [1, 30],
        [1, undefined],
      ],
      "never one stack with another",
    );
    const half = passRulesetItemTime({
      definition,
      itemOf: book.itemOf,
      stacks: added.stacks,
      minutes: 30,
      roll: () => 1,
    });
    assert.deepEqual(
      half.stacks.map((stack) => stack.vanishesIn),
      [30, undefined],
    );
    assert.deepEqual(half.vanished, [{ name: "Rope", count: 1 }]);
    const gone = passRulesetItemTime({
      definition,
      itemOf: book.itemOf,
      stacks: half.stacks,
      minutes: 45,
      roll: () => 1,
    });
    assert.deepEqual(
      gone.stacks.map((stack) => stack.vanishesIn),
      [undefined],
    );
  }

  // ── Cast in a fight: each material its own choice, counted in its maker's turns ──
  const spells = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 12, int: 18, wis: 10, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_5: 1 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells },
          holder: "Wizard",
        },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 20,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["wizard", "foe"];
    state.turn = 0;
    return state;
  };
  const cast = (state: RulesetEncounterState, mode: string) => {
    const option = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label.startsWith("Creation"));
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "wizard")
        .map((one) => one.label)
        .join(", "),
    );
    assert.deepEqual(
      option.modes?.map((one) => one.label),
      ["Gems", "Vegetable matter"],
    );
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: option.id, targetIds: ["wizard"], mode },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  // Whoever's turn it is ends it, every event kept.
  const pass = (state: RulesetEncounterState, events: RulesetCombatEvent[]) => {
    const actor = state.order[state.turn]!;
    const end = rulesetCombatOptions(definition, state, actor).find((one) => one.kind === "end-turn")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: actor, optionId: end.id, targetIds: [] },
      () => 10,
    );
    events.push(...step.events);
    return step.state;
  };
  {
    const start = fight();
    const made = cast(start, "lasts-0");
    assert.deepEqual(of(made.events, "itemsMade"), [
      { type: "itemsMade", actorId: "wizard", label: "Made Thing", count: 2 },
    ]);
    // A minute is ten of its maker's turns at 6 seconds a round.
    const events: RulesetCombatEvent[] = [];
    let state = made.state;
    state = pass(state, events); // the wizard's first turn ends: 9 left
    const midway = rulesetFightItemChanges(start, state);
    assert.equal(midway.length, 1);
    assert.equal(midway[0]!.taken, -2);
    assert.equal(midway[0]!.vanishesIn, 1, "what is left of the minute rides on the stack");
    assert.match(midway[0]!.stack.id, /-lasting$/);
    for (let n = 0; n < 18 && of(events, "itemsVanished").length === 0; n++) state = pass(state, events);
    assert.deepEqual(of(events, "itemsVanished"), [
      { type: "itemsVanished", actorId: "wizard", label: "Made Thing", count: 2 },
    ]);
    assert.equal(rulesetCombatant(state, "wizard")!.madeFor, undefined);
    assert.equal(state.round, 10, "gone at the end of its maker's tenth turn");
    assert.deepEqual(rulesetFightItemChanges(start, state), [], "nothing of it reaches the bag");
  }
  {
    const start = fight();
    const made = cast(start, "lasts-1");
    const changes = rulesetFightItemChanges(start, made.state);
    assert.equal(changes[0]!.vanishesIn, 1440, "a day of vegetable matter");
    const written = applyRulesetFightItemChanges([], changes)!;
    assert.deepEqual(
      written.stacks.map((stack) => [stack.name, stack.quantity, stack.vanishesIn]),
      [["Made Thing", 2, 1440]],
    );
  }

  // ── Used from the bag: picked, onto a stack of its own ──
  {
    const stacks: GameInventoryStack[] = [
      { id: "s-scroll", name: "Scroll of Creation", item: "kit/scroll", quantity: 2 },
      { id: "s-made", name: "Made Thing", item: "kit/made", quantity: 3 },
    ];
    const use = (on: GameInventoryStack[], lasts?: number) =>
      useRulesetItemOutsideFight({
        definition,
        itemOf: book.itemOf,
        stacks: on,
        stackId: "s-scroll",
        user: { name: "Wizard", build: rulesetSheetBuildSchema.parse({}), live: {} },
        roll: () => 10,
        ...(lasts !== undefined ? { lasts } : {}),
      });
    const first = use(stacks, 2);
    assert.ok(first.ok);
    const second = use(first.stacks);
    assert.ok(second.ok);
    assert.deepEqual(
      second.stacks.filter((stack) => stack.item === "kit/made").map((stack) => [stack.quantity, stack.vanishesIn]),
      [
        [3, undefined],
        [1, 1440],
        [1, 1],
      ],
      "neither tops up another",
    );
    assert.deepEqual(use(stacks, 3), { ok: false, reason: "no-use" });
  }

  // ── Refused ──
  refused(fiveE([]), /lasts/);
  refused(fiveE([{ minutes: 1 }, { minutes: 2 }]), /picked by its label/);
  refused(fiveE([{ minutes: 0 }]), /lasts/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with what is made lasting a while before it vanishes (makesItems.lasts) requires schemaVersion 2 and capabilityApi 1.760 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(759) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(760) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(759) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Made lasting: Creation's gems vanish after ten of its maker's turns, its vegetable matter a day later on the game's clock, each on a stack of its own; the Game Master's add lasts as it says; gated at 1.760.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
