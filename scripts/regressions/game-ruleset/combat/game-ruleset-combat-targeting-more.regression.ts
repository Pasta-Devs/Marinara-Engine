/**
 * Targeting by any sense, targets near each other, growing areas, more uses and held things
 * (Capability API 1.267).
 *
 *   - `needsAny`: Turn Undead's "each undead that can see or hear you": one sense kept is enough.
 *   - `targetsWithin`: Command's higher-slot creatures "within 30 feet of each other".
 *   - `area.sizePerCostStep`: Confusion's sphere, 5 feet more radius a slot level higher.
 *   - `moreUses`: a wand of two spells, one menu entry each, drawing on one set of charges and let
 *     fall together.
 *   - A stat block's `held`: a printed shield, let fall with the tagged weapon (its defense with it)
 *     and picked up again; a multiattack with the weapon down strikes with what is left.
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
  rulesetCombatOptions,
  rulesetDefenseAgainst,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-targeting-more-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 262);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) => ({
    id,
    label,
    rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
    mechanics: { kind: "debuff", range: 60, save: { save: "wis_save", onSuccess: "negates" }, ...mechanics },
  });
  const spellsDoc = () => [
    spell("turn", "Turn", {
      targetCount: 3,
      needs: ["sight", "hearing"],
      needsAny: true,
      applies: [{ condition: "prone", duration: { rounds: 1 } }],
    }),
    spell("command", "Command", {
      targetCount: 1,
      targetsPerCostStep: 1,
      targetsWithin: 30,
      cost: [{ pool: "slots_1", amount: 1 }],
      applies: [{ condition: "prone", duration: { rounds: 1 } }],
    }),
    spell("confuse", "Confuse", {
      area: { shape: "burst", size: 10, sizePerCostStep: 5 },
      cost: [{ pool: "slots_1", amount: 1 }],
      applies: [{ condition: "prone", duration: { rounds: 1 } }],
    }),
  ];
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = {
      categories: [
        { id: "weapon", label: "Weapon" },
        { id: "gear", label: "Gear" },
      ],
      tags: [{ id: "held", label: "Held" }],
      slots: [{ id: "hands", label: "Hands", count: 2 }],
    };
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spellsDoc() });
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "blinded").lacks = ["sight"];
    doc.combat.conditions.push({ condition: "deafened", effects: [], lacks: ["hearing"] });
    doc.sheet.live.conditions.push({ id: "dropping", label: "Commanded: Drop" });
    doc.combat.conditions.push({
      condition: "dropping",
      effects: [],
      behavior: { only: [], drops: { tags: ["held"], at: "turn-start", pickUp: "action" } },
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
  const combat = definition.combat!;
  const spells = definition.catalogs!.find((entry) => entry.id === "spells")!.entries!;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 14, dex: 14, con: 12, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, ac: 14, speed: 30, hp_max: 40, spellcasting_ability: "wis", slots_max_1: 2, slots_max_2: 1 },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const bolt = (dice: string, damageType: string) => ({
    kind: "attack",
    budget: "action",
    range: 60,
    attackRoll: true,
    toHit: { abilities: ["dex"] },
    amount: { dice },
    damageType,
    charges: 1,
  });
  // A wand of fire and frost: two charges between them.
  const wand = {
    item: {
      category: "gear",
      slots: { hands: 1 },
      charges: { max: 2 },
      use: bolt("1d6", "fire"),
      moreUses: [{ label: "Frost", use: bolt("1d4", "cold") }],
    } as unknown as RulesetCatalogItem,
    quantity: 1,
    worn: true,
    name: "Wand",
  } as RulesetSheetItem;
  const foeBlock = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    saves: { wis_save: -10 },
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  // A guard whose printed AC 17 counts its shield's 2.
  const guard = (): RulesetStatBlock =>
    foeBlock({
      id: "guard",
      defense: 17,
      held: [{ label: "Shield", tags: ["held"], defense: 2 }],
      actions: [
        { id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } },
        {
          id: "sword",
          name: "Sword",
          budget: "action",
          toHit: 4,
          damage: { count: 1, sides: 8, flat: 0 },
          qualities: ["held"],
        },
        {
          id: "attacks",
          name: "Attacks",
          budget: "action",
          sequence: [
            { action: "claw", times: 1 },
            { action: "sword", times: 1 },
          ],
        },
      ],
    });
  // The guard as a bestiary writes it.
  const written = (held: unknown) => ({
    tier: "cr_1",
    health: 30,
    defense: 17,
    initiativeModifier: 0,
    held,
    actions: [
      {
        id: "sword",
        name: "Sword",
        budget: "action",
        toHit: 4,
        damage: { dice: "1d8", type: "slashing" },
        qualities: ["held"],
      },
      {
        id: "gaze",
        name: "Gaze",
        budget: "action",
        range: 30,
        needs: ["sight", "hearing"],
        needsAny: true,
        save: { save: "wis_save", difficulty: 12, onSuccess: "negates" },
        applies: [{ condition: "prone", duration: { rounds: 1 } }],
      },
    ],
  });
  const roll = (sides: number) => (sides === 20 ? 15 : 1);
  const fight = (foes: Record<string, { x: number; block?: RulesetStatBlock }>, width = 20): RulesetEncounterState => {
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
          items: [wand],
          catalogs: { spells },
        },
        ...Object.entries(foes).map(([id, one]) => ({
          id,
          name: id,
          side: "enemy" as const,
          block: one.block ?? foeBlock(),
        })),
      ],
      board: {
        grid: {
          width,
          height: 1,
          tiles: [Array(width).fill("plains")],
          elevation: [Array(width).fill(0)],
        } as never,
        placements: {
          hero: { x: 0, y: 0 },
          ...Object.fromEntries(Object.entries(foes).map(([id, one]) => [id, { x: one.x, y: 0 }])),
        },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const step = (state: RulesetEncounterState, choice: RulesetCombatChoice) =>
    applyRulesetCombatChoice(definition, state, choice, roll);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const done = step(state, choice);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const refusedAs = (state: RulesetEncounterState, choice: RulesetCombatChoice) =>
    of(step(state, choice).events, "refused")[0]?.reason;
  const menu = (state: RulesetEncounterState, id: string) => rulesetCombatOptions(definition, state, id);
  const ids = (state: RulesetEncounterState, id: string) => menu(state, id).map((option) => option.id);
  const named = (state: RulesetEncounterState, label: string) =>
    menu(state, "hero").find((option) => option.label === label)!;
  const defenseOf = (state: RulesetEncounterState, id: string) =>
    rulesetDefenseAgainst(definition, combat, state, who(state, id), undefined).defense;

  // ── Turn: a target that sees or hears is enough; one that does neither is not ──
  {
    const state = fight({ blind: { x: 2 }, deaf: { x: 3 }, both: { x: 4 }, fine: { x: 5 } });
    who(state, "blind").tracked.push({ condition: "blinded", rounds: 3 });
    who(state, "deaf").tracked.push({ condition: "deafened", rounds: 3 });
    who(state, "both").tracked.push({ condition: "blinded", rounds: 3 }, { condition: "deafened", rounds: 3 });
    const turn = named(state, "Turn");
    assert.equal(who(state, "hero").actions.find((one) => one.id === turn.id)!.needsAny, true);
    assert.deepEqual(rulesetOptionTargets(definition, state, "hero", turn).sort(), ["blind", "deaf", "fine"]);
    assert.ok(refusedAs(state, { actorId: "hero", optionId: turn.id, targetIds: ["both"] }));
    const done = act(state, { actorId: "hero", optionId: turn.id, targetIds: ["blind", "deaf"] });
    assert.equal(of(done.events, "save").length, 2, "both are reached and save");
    // Without needsAny, each sense is needed: the blind and the deaf are out of it.
    const strict = structuredClone(state);
    delete who(strict, "hero").actions.find((one) => one.id === turn.id)!.needsAny;
    assert.deepEqual(rulesetOptionTargets(definition, strict, "hero", turn), ["fine"]);
  }

  // ── Command: a second creature for a 2nd-level slot, within 30 feet of the first ──
  {
    const state = fight({ a: { x: 3 }, near: { x: 9 }, far: { x: 10 } });
    const command = named(state, "Command");
    assert.equal(who(state, "hero").actions.find((one) => one.id === command.id)!.targetsWithin, 6);
    assert.equal(
      refusedAs(state, { actorId: "hero", optionId: command.id, targetIds: ["a", "far"], payWith: "slots_2" }),
      "targets-apart",
    );
    const done = act(state, { actorId: "hero", optionId: command.id, targetIds: ["a", "near"], payWith: "slots_2" });
    assert.equal(of(done.events, "save").length, 2);
  }

  // ── Confuse: its burst grows 5 feet with each slot level above its own ──
  {
    const state = fight({ in: { x: 12 }, edge: { x: 13 } });
    const confuse = named(state, "Confuse");
    assert.equal(who(state, "hero").actions.find((one) => one.id === confuse.id)!.area?.sizePerCostStep, 1);
    const low = act(state, { actorId: "hero", optionId: confuse.id, targetIds: [], at: { x: 10, y: 0 } });
    const high = act(state, {
      actorId: "hero",
      optionId: confuse.id,
      targetIds: [],
      at: { x: 10, y: 0 },
      payWith: "slots_2",
    });
    const lowCells = of(low.events, "area")[0]!.cells.map((cell) => cell.x);
    const highCells = of(high.events, "area")[0]!.cells.map((cell) => cell.x);
    assert.equal(highCells.length, lowCells.length + 2, `${lowCells} / ${highCells}`);
    assert.ok(highCells.includes(13) && !lowCells.includes(13));
    assert.deepEqual(
      of(low.events, "save").map((one) => one.actorId),
      ["in"],
    );
    assert.deepEqual(
      of(high.events, "save")
        .map((one) => one.actorId)
        .sort(),
      ["edge", "in"],
    );
  }

  // ── A wand of two spells: two entries on the menu, one set of charges ──
  {
    const state = fight({ foe: { x: 4 } });
    const fire = menu(state, "hero").find((one) => one.id === "use:0")!;
    const frost = menu(state, "hero").find((one) => one.id === "use:0:1")!;
    assert.equal(fire.label, "Wand");
    assert.equal(frost.label, "Wand: Frost");
    const first = act(state, { actorId: "hero", optionId: frost.id, targetIds: ["foe"] });
    assert.ok(
      of(first.events, "damage").some((one) => one.targetId === "foe"),
      JSON.stringify(first.events),
    );
    assert.equal(who(first.state, "hero").charges?.[0], 1, "Frost spent the wand's charge");
    const next = structuredClone(first.state);
    who(next, "hero").budgets.action = 1;
    const second = act(next, { actorId: "hero", optionId: "use:0", targetIds: ["foe"] });
    assert.equal(who(second.state, "hero").charges?.[0], 0);
    const empty = structuredClone(second.state);
    who(empty, "hero").budgets.action = 1;
    assert.equal(ids(empty, "hero").includes("use:0") || ids(empty, "hero").includes("use:0:1"), false);
    // Both fall with the wand.
    const down = fight({ foe: { x: 4 } });
    who(down, "hero").dropped = [{ key: "item:0", label: "Wand", at: { x: 0, y: 0 } }];
    assert.equal(ids(down, "hero").includes("use:0") || ids(down, "hero").includes("use:0:1"), false);
    assert.equal(refusedAs(down, { actorId: "hero", optionId: "use:0:1", targetIds: ["foe"] }), "dropped");
  }

  // ── A guard's shield: let fall with its sword, its 2 gone; picked up again ──
  {
    const state = fight({ guard: { x: 1, block: guard() } });
    assert.equal(defenseOf(state, "guard"), 17);
    who(state, "guard").tracked.push({ condition: "dropping", rounds: 1, source: "hero" });
    const turn = act(state, { actorId: "hero", optionId: "end-turn", targetIds: [] });
    assert.deepEqual(
      of(turn.events, "letFall").map((one) => one.labels),
      [["Sword", "Shield"]],
    );
    assert.deepEqual(
      who(turn.state, "guard").dropped?.map((thing) => thing.key),
      ["sword", "held:0"],
    );
    assert.equal(defenseOf(turn.state, "guard"), 15, "the shield's 2 lies on the ground");
    // Command run out: the multiattack strikes with the claw alone.
    const later = structuredClone(turn.state);
    who(later, "guard").tracked = [];
    const offered = ids(later, "guard");
    assert.ok(offered.includes("pickup:held:0") && offered.includes("pickup:sword"), offered.join(", "));
    const attacks = act(later, { actorId: "guard", optionId: "attacks", targetIds: ["hero"] });
    assert.deepEqual(
      of(attacks.events, "attack").map((one) => one.optionId),
      ["claw"],
      "the dropped sword is no part of the multiattack",
    );
    const picked = act(later, { actorId: "guard", optionId: "pickup:held:0", targetIds: [] });
    assert.deepEqual(of(picked.events, "pickedUp"), [{ type: "pickedUp", actorId: "guard", label: "Shield" }]);
    assert.equal(defenseOf(picked.state, "guard"), 17);
    assert.deepEqual(
      who(picked.state, "guard").dropped?.map((thing) => thing.key),
      ["sword"],
    );
  }

  // ── Import ──
  {
    refused(
      document((doc) =>
        doc.catalogs.push({
          id: "monsters",
          label: "Monsters",
          holds: "creatures",
          entries: [
            {
              id: "guard",
              label: "Guard",
              creature: written([{ label: "Shield", tags: ["nope"] }]),
            },
          ],
        }),
      ),
      /Unknown item tag "nope"/,
    );
    refused(
      document(
        (doc) => (doc.catalogs.at(-1).entries[2].mechanics.area = { shape: "wall", size: 20, sizePerCostStep: 5 }),
      ),
      /A wall does not grow with its cost/,
    );
    refused(
      document((doc) =>
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          entries: [
            {
              id: "w",
              label: "W",
              item: { category: "gear", moreUses: [{ label: "Frost", use: bolt("1d4", "cold") }] },
            },
          ],
        }),
      ),
      /More uses go beside a "use"/,
    );
    const guarded = parsed(
      document((doc) =>
        doc.catalogs.push({
          id: "monsters",
          label: "Monsters",
          holds: "creatures",
          entries: [
            { id: "guard", label: "Guard", creature: written([{ label: "Shield", tags: ["held"], defense: 2 }]) },
          ],
        }),
      ),
    );
    const entry = guarded.catalogs!.find((one) => one.id === "monsters")!.entries![0]!;
    assert.deepEqual(entry.creature!.held, [{ label: "Shield", tags: ["held"], defense: 2 }]);
    // As a stat block, then in a fight: the shield and the gaze's any-sense come with it.
    const read = rulesetStatBlockFromCreature(guarded, entry.creature!)!;
    assert.deepEqual(read.held, [{ label: "Shield", tags: ["held"], defense: 2 }]);
    assert.equal(read.actions.find((one) => one.name === "Gaze")!.needsAny, true);
    const state = fight({ guard: { x: 2, block: read } });
    assert.equal(who(state, "guard").actions.find((one) => one.label === "Gaze")!.needsAny, true);
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
      "A ruleset with senses any one of which serves, targets kept near each other, an area that grows with its cost, more uses on an item, or things a stat block holds, requires schemaVersion 2 and capabilityApi 1.267 or newer";
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const only = (keep: (doc: Record<string, any>) => void) =>
      document((doc) => {
        const entries = doc.catalogs.at(-1).entries;
        delete entries[0].mechanics.needsAny;
        delete entries[1].mechanics.targetsWithin;
        delete entries[2].mechanics.area.sizePerCostStep;
        keep(doc);
      });
    assert.notEqual(
      issue(
        266,
        only(() => {}),
      ),
      gate,
      "nothing of 1.267 left",
    );
    const cases: Array<[string, (doc: Record<string, any>) => void]> = [
      ["needsAny", (doc) => (doc.catalogs.at(-1).entries[0].mechanics.needsAny = true)],
      ["targetsWithin", (doc) => (doc.catalogs.at(-1).entries[1].mechanics.targetsWithin = 30)],
      ["sizePerCostStep", (doc) => (doc.catalogs.at(-1).entries[2].mechanics.area.sizePerCostStep = 5)],
      [
        "moreUses",
        (doc) =>
          doc.catalogs.push({
            id: "gear",
            label: "Gear",
            holds: "items",
            entries: [{ id: "w", label: "W", item: { ...structuredClone(wand.item), stack: 1 } }],
          }),
      ],
      [
        "held",
        (doc) =>
          doc.catalogs.push({
            id: "monsters",
            label: "Monsters",
            holds: "creatures",
            entries: [
              { id: "guard", label: "Guard", creature: written([{ label: "Shield", tags: ["held"], defense: 2 }]) },
            ],
          }),
      ],
    ];
    for (const [name, keep] of cases) {
      const doc = only(keep);
      parsed(doc);
      assert.equal(issue(266, doc), gate, name);
      assert.notEqual(issue(267, doc), gate, name);
    }
    assert.equal(
      issue(
        266,
        only(() => {}),
        new Map([["extra.json", { mechanics: { needsAny: true } }]]),
      ),
      gate,
    );
  }

  console.log(
    "Ruleset targeting: Turn reaches whoever sees or hears, Command's extra targets stand within 30 feet, Confuse grows with the slot, a wand's two spells share charges and fall together, a guard's shield drops with its sword (its 2 with it) and is picked up, a multiattack strikes with what is left; gated at 1.267.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
