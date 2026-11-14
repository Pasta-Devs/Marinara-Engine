/**
 * Numbers fixed off whoever put a condition on, Sympathy's pull, and a scroll's chosen kind
 * (Capability API 1.274).
 *
 *   - An aura save's `appliedDifficulty`: Antipathy/Sympathy's save is against its caster's spell
 *     save DC, fixed as it was cast, with `difficulty` for an aura nothing put on.
 *   - An applied condition's `value`, read off its applier's sheet as it goes on, and a combat
 *     condition's `temporary`: Heroism's temporary points each turn, its caster's spellcasting
 *     modifier, lost as it ends (`lostWhenEnds`) unless something gave more.
 *   - `saveEnds.bySource`: Sympathy's save when the target harms its holder, and only then.
 *   - `behavior.keepsIn`: once within 5 feet of the target, Sympathy's holder never walks away.
 *   - `kindChoice` on an item's use: a scroll of Antipathy names its kind too.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetGap,
  rulesetReachableCells,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-source-numbers-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 269);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const conditionOf = (doc: Record<string, any>, id: string) =>
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === id);
  const entries = () => [
    {
      id: "antipathy",
      label: "Antipathy",
      rows: [{ list: "spells", values: { name: "Antipathy", level: 1, prepared: true } }],
      mechanics: {
        kind: "buff",
        range: 60,
        kindChoice: true,
        applies: [{ condition: "repugnant", duration: { rounds: 100 } }],
      },
    },
    {
      id: "heroism",
      label: "Heroism",
      rows: [{ list: "spells", values: { name: "Heroism", level: 1, prepared: true } }],
      mechanics: {
        kind: "buff",
        range: 60,
        applies: [
          {
            condition: "heroic",
            duration: { rounds: 1 },
            value: { abilityModFromField: "spellcasting_ability" },
          },
        ],
      },
    },
  ];
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.combat.creatureTypes = {
      types: ["beast", "humanoid"].map((id) => ({ id, label: id })),
      field: "race",
      default: "humanoid",
    };
    for (const [id, label] of [
      ["repugnant", "Antipathy"],
      ["repelled", "Repelled"],
      ["attracted", "Attracted"],
      ["heroic", "Heroic"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      {
        condition: "repugnant",
        effects: [],
        auras: [
          {
            distance: 60,
            side: "all",
            chosenKind: true,
            save: {
              save: "wis_save",
              difficulty: 18,
              appliedDifficulty: true,
              applies: [{ condition: "repelled", duration: { rounds: 10 } }],
            },
          },
        ],
      },
      { condition: "repelled", effects: [], behavior: { moves: "away" } },
      { condition: "attracted", effects: [], behavior: { keepsIn: 5 } },
      {
        condition: "heroic",
        effects: [],
        temporary: { at: "turn-start", value: true, lostWhenEnds: true },
      },
    );
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: entries() });
    doc.items = { categories: [{ id: "scroll", label: "Scroll" }] };
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        {
          id: "scroll",
          label: "Scroll of Antipathy",
          item: {
            category: "scroll",
            stack: 10,
            use: {
              kind: "buff",
              budget: "action",
              range: 60,
              consumes: true,
              kindChoice: true,
              applies: [{ condition: "repugnant", duration: { rounds: 100 } }],
            },
          },
        },
      ],
    });
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
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(document());
  const spells = definition.catalogs!.find((entry) => entry.id === "spells")!.entries!;
  const scroll = definition.catalogs!.find((entry) => entry.id === "gear")!.entries![0]!.item!;
  const sling = {
    name: "Sling",
    ability: "dex",
    proficient: true,
    bonus: 0,
    damage: "1d4",
    range: 60,
    long_range: 120,
  };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, ac: 14, speed: 30, hp_max: 40, race: "Human", spellcasting_ability: "wis" },
    lists: {
      spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)),
      attacks: [sling],
    },
  });
  const block = (type: string): RulesetStatBlock => ({
    health: 40,
    defense: 1,
    initiativeModifier: 0,
    speed: 30,
    type,
    saves: { wis_save: 0 },
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 0, sides: 0, flat: 1 } }],
  });
  let faces: Record<number, number[]> = {};
  const roll = (sides: number) => faces[sides]?.shift() ?? (sides === 20 ? 10 : 1);
  const width = 30;
  const fight = (wolfAt = 5): RulesetEncounterState => {
    faces = {};
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build,
          live: {},
          catalogs: { spells },
          items: [{ item: scroll, quantity: 1, name: "Scroll of Antipathy" } as RulesetSheetItem],
        },
        { id: "friend", name: "Friend", side: "party", build, live: {} },
        { id: "wolf", name: "Wolf", side: "enemy", block: block("beast") },
      ],
      board: {
        grid: {
          width,
          height: 3,
          tiles: Array.from({ length: 3 }, () => Array(width).fill("plains")),
          elevation: Array.from({ length: 3 }, () => Array(width).fill(0)),
        } as never,
        placements: { hero: { x: 0, y: 1 }, friend: { x: 1, y: 1 }, wolf: { x: wolfAt, y: 1 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (
    state: RulesetEncounterState,
    choice: Partial<RulesetCombatChoice> & { actorId: string; optionId: string },
  ) => {
    const done = applyRulesetCombatChoice(definition, state, { targetIds: [], ...choice } as RulesetCombatChoice, roll);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const endTurn = (state: RulesetEncounterState, id: string) => act(state, { actorId: id, optionId: "end-turn" });
  const into = (state: RulesetEncounterState, id: string) => {
    const at = state.order.indexOf(id);
    state.turn = at - 1;
    return endTurn(state, state.order[at - 1]!);
  };
  const optionOf = (state: RulesetEncounterState, id: string, label: string) =>
    rulesetCombatOptions(definition, state, id).find((one) => one.label.startsWith(label))!;
  const savesOf = (events: RulesetCombatEvent[], id: string) => of(events, "save").filter((one) => one.actorId === id);
  const temp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).temp;

  // ── Antipathy's save is against its caster's DC, fixed as it was cast ──
  {
    const state = fight();
    const cast = act(state, {
      actorId: "hero",
      optionId: optionOf(state, "hero", "Antipathy").id,
      targetIds: ["friend"],
      mode: "kind-beast",
    }).state;
    const dc = who(cast, "friend").tracked.find((one) => one.condition === "repugnant")?.difficulty;
    assert.ok(dc !== undefined && dc !== 18, `the caster's DC, not the written 18: ${dc}`);
    faces = { 20: [dc] };
    const wolf = into(structuredClone(cast), "wolf");
    assert.deepEqual(
      savesOf(wolf.events, "wolf").map((one) => [one.difficulty, one.success]),
      [[dc, true]],
      "made against the caster's DC, which the written 18 would have failed",
    );
    assert.ok(!has(wolf.state, "wolf", "repelled"));
    // An aura nothing put on stands on its written difficulty.
    const kept = fight();
    who(kept, "friend").tracked.push({ condition: "repugnant", rounds: null, kind: "beast" } as never);
    faces = { 20: [17] };
    const plain = into(kept, "wolf");
    assert.deepEqual(
      savesOf(plain.events, "wolf").map((one) => [one.difficulty, one.success]),
      [[18, false]],
    );
    assert.ok(has(plain.state, "wolf", "repelled"));
  }

  // ── A scroll of Antipathy names its kind too ──
  {
    const state = fight();
    const offered = optionOf(state, "hero", "Scroll of Antipathy");
    assert.deepEqual(
      offered.modes?.map((one) => one.id),
      ["kind-beast", "kind-humanoid"],
    );
    const bare = applyRulesetCombatChoice(
      definition,
      structuredClone(state),
      { actorId: "hero", optionId: offered.id, targetIds: ["friend"] },
      roll,
    );
    assert.equal(of(bare.events, "refused")[0]?.reason, "unknown-mode", "no kind named, no scroll");
    const done = act(state, { actorId: "hero", optionId: offered.id, targetIds: ["friend"], mode: "kind-humanoid" });
    assert.equal(who(done.state, "friend").tracked.find((one) => one.condition === "repugnant")?.kind, "humanoid");
  }

  // ── Heroism: its caster's modifier in temporary points each turn, lost as it ends ──
  {
    const state = fight();
    const cast = act(state, {
      actorId: "hero",
      optionId: optionOf(state, "hero", "Heroism").id,
      targetIds: ["friend"],
    }).state;
    assert.equal(who(cast, "friend").tracked.find((one) => one.condition === "heroic")?.value, 3, "Wisdom 16");
    const started = into(cast, "friend");
    assert.deepEqual(
      of(started.events, "temporary").map((one) => [one.targetId, one.amount, one.lost]),
      [["friend", 3, undefined]],
    );
    assert.equal(temp(started.state, "friend"), 3);
    // Its one round over, what is left of them goes with it.
    const ended = endTurn(started.state, "friend");
    assert.ok(!has(ended.state, "friend", "heroic"));
    assert.deepEqual(
      of(ended.events, "temporary").map((one) => [one.amount, one.lost]),
      [[3, true]],
    );
    assert.equal(temp(ended.state, "friend"), 0);
    // More from something else stays.
    const more = into(
      act(fight(), { actorId: "hero", optionId: optionOf(fight(), "hero", "Heroism").id, targetIds: ["friend"] }).state,
      "friend",
    ).state;
    const friend = who(more, "friend");
    friend.sheet!.live = { ...friend.sheet!.live };
    const pool = definition.combat!.health as { pool: string };
    (friend.sheet!.live as any).pools[pool.pool].temp = 8;
    const after = endTurn(more, "friend");
    assert.equal(of(after.events, "temporary").length, 0, "nothing lost");
    assert.equal(temp(after.state, "friend"), 8);
  }

  // ── Sympathy: a save on harm only from the target, and kept within 5 feet ──
  {
    const pulled = (wolfAt: number) => {
      const state = fight(wolfAt);
      who(state, "wolf").tracked.push({
        condition: "attracted",
        rounds: null,
        source: "friend",
        difficulty: 14,
        saveEnds: { save: "wis_save", at: "damaged", bySource: true },
      } as never);
      return state;
    };
    // The hero's sling: no save.
    const byHero = pulled(5);
    faces = { 20: [15, 20] };
    const shot = act(byHero, {
      actorId: "hero",
      optionId: optionOf(byHero, "hero", "Sling").id,
      targetIds: ["wolf"],
    });
    assert.ok(
      of(shot.events, "damage").some((one) => one.targetId === "wolf"),
      "it hit",
    );
    assert.equal(savesOf(shot.events, "wolf").length, 0, "harmed by somebody else: no save");
    assert.ok(has(shot.state, "wolf", "attracted"));
    // The friend's sling: the save, and it ends.
    const byFriend = pulled(5);
    byFriend.turn = 1;
    faces = { 20: [15, 20] };
    const harmed = act(byFriend, {
      actorId: "friend",
      optionId: optionOf(byFriend, "friend", "Sling").id,
      targetIds: ["wolf"],
    });
    assert.equal(savesOf(harmed.events, "wolf").length, 1, "harmed by the target: the save");
    assert.ok(!has(harmed.state, "wolf", "attracted"));

    // Within 5 feet of the friend, never a step farther.
    const near = pulled(2);
    near.turn = 2;
    const cells = rulesetReachableCells(definition, near, "wolf");
    assert.ok(cells.length > 0, "it may still move");
    const friend = who(near, "friend");
    for (const cell of cells) {
      const moved = { ...who(near, "wolf"), x: cell.x, y: cell.y };
      assert.ok(rulesetGap(moved as never, friend) <= 1, `${cell.x},${cell.y} is too far`);
    }
    // Farther off, it walks where it likes.
    const far = pulled(6);
    far.turn = 2;
    assert.ok(
      rulesetReachableCells(definition, far, "wolf").some((cell) => cell.x > 6),
      "not yet within reach: free to walk",
    );
    // Drawn toward the friend too, as Sympathy is: outside the ring only nearer, inside it free to
    // move about within it (1.276 follow-up).
    const rule = definition.combat!.conditions!.find((one) => one.condition === "attracted")!;
    rule.behavior = { ...rule.behavior!, moves: "toward" };
    try {
      const inside = rulesetReachableCells(definition, pulled(2), "wolf");
      assert.ok(inside.length > 0, "inside the ring, drawn toward the friend, it may still move");
      for (const cell of inside) {
        const moved = { ...who(near, "wolf"), x: cell.x, y: cell.y };
        assert.ok(rulesetGap(moved as never, friend) <= 1, `${cell.x},${cell.y} leaves the ring`);
      }
      const drawn = pulled(6);
      const start = rulesetGap(who(drawn, "wolf"), who(drawn, "friend"));
      const stops = rulesetReachableCells(definition, drawn, "wolf");
      assert.ok(stops.length > 0, "outside the ring it walks nearer");
      for (const cell of stops) {
        const moved = { ...who(drawn, "wolf"), x: cell.x, y: cell.y };
        assert.ok(rulesetGap(moved as never, who(drawn, "friend")) < start, `${cell.x},${cell.y} is no nearer`);
      }
    } finally {
      delete (rule.behavior as { moves?: string }).moves;
    }
  }

  // ── Import ──
  {
    refused(
      document((doc) => (conditionOf(doc, "heroic").temporary = { at: "turn-start" })),
      /What it gives names dice, a flat amount, the value it was put on with/,
    );
    refused(
      document(
        (doc) =>
          (conditionOf(doc, "repugnant").auras[0].save.applies[0].saveEnds = {
            save: "wis_save",
            at: "turn-end",
            bySource: true,
          }),
      ),
      /"bySource" narrows a save rolled on damage/,
    );
    refused(
      document((doc) => (doc.catalogs.at(-2).entries[1].mechanics.applies[0].value = { derived: "luck" })),
      /luck/,
    );
    refused(
      document((doc) => delete doc.catalogs.at(-1).entries[0].item.use.applies),
      /"kindChoice" goes with "applies"/,
    );
    refused(
      document((doc) => {
        delete doc.combat.creatureTypes;
        doc.catalogs.at(-2).entries = [];
        for (const one of doc.combat.conditions) delete one.auras;
      }),
      /This ruleset has no creature types to choose from/,
    );
    refused(
      document((doc) => (conditionOf(doc, "attracted").behavior.keepsIn = 0)),
      /keepsIn/,
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
      "A ruleset with a condition put on with a value off its applier, temporary points a condition gives each turn, an aura save against its applier's difficulty, a save on harm from a condition's source, a walk kept within reach, or a kind chosen as an item is used, requires schemaVersion 2 and capabilityApi 1.274 or newer";
    const issue = (minor: number, doc: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, undefined as never);
    const plain = document((doc) => {
      delete conditionOf(doc, "repugnant").auras[0].save.appliedDifficulty;
      delete conditionOf(doc, "heroic").temporary;
      delete conditionOf(doc, "attracted").behavior.keepsIn;
      conditionOf(doc, "attracted").behavior.moves = "toward";
      delete doc.catalogs.at(-2).entries[1].mechanics.applies[0].value;
      doc.catalogs.pop();
    });
    assert.notEqual(issue(273, plain), gate, "nothing of 1.274 left");
    assert.equal(issue(273, document()), gate);
    assert.notEqual(issue(274, document()), gate);
    const one = (edit: (doc: Record<string, any>) => void) => {
      const doc = structuredClone(plain);
      edit(doc);
      assert.equal(issue(273, doc), gate, JSON.stringify(edit.toString()));
    };
    one((doc) => (conditionOf(doc, "repugnant").auras[0].save.appliedDifficulty = true));
    one((doc) => (conditionOf(doc, "heroic").temporary = { at: "turn-start", flat: 1 }));
    one((doc) => (conditionOf(doc, "attracted").behavior.keepsIn = 5));
    one((doc) => (doc.catalogs.at(-1).entries[1].mechanics.applies[0].value = { const: 1 }));
    one(
      (doc) =>
        (conditionOf(doc, "repugnant").auras[0].save.applies[0] = {
          condition: "repelled",
          duration: "until-save",
          saveEnds: { save: "wis_save", at: "damaged", bySource: true },
        }),
    );
    one((doc) =>
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [{ id: "s", label: "S", item: { category: "scroll", use: { kind: "buff", kindChoice: true } } }],
      }),
    );
  }

  console.log(
    "Ruleset source numbers: Antipathy's save against its caster's DC, Heroism's temporary points each turn from its caster's modifier and lost as it ends, Sympathy's save only on harm from the target and its walk kept within 5 feet, a scroll naming its kind; gated at 1.274.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
