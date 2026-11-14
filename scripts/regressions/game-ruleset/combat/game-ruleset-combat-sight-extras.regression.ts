/**
 * More of seeing (Capability API 1.180).
 *
 *   - An applied condition's `endsWhenHolder`: it comes off once its holder has attacked, or cast
 *     from a catalog it names (Invisibility); an item's `use.casts` counts as casting (a scroll). The
 *     blow that ended it still had it; a standing zone striking on its own is not its caster acting.
 *   - `senses` on a condition (the Darkvision spell, True Seeing) and on a worn item (goggles of
 *     night): the longer reach counts while it holds.
 *   - A condition's `cancelsUnseen` (Faerie Fire): an invisible holder is seen, fog still hides.
 *   - Import refusals, and the install gate.
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
  liftRulesetFightEffects,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetAttackMode,
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSenseRanges,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatCell,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sight-extras-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 175);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  // The 5e example with senses (as 1.178's test has them), items, and three conditions of spells:
  // the Darkvision spell, True Seeing and Faerie Fire's outline.
  const sighted = (doc: Record<string, any>) => {
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.combat.senses = [
      { id: "darkvision", label: "Darkvision" },
      { id: "blindsight", label: "Blindsight", blind: true },
      { id: "truesight", label: "Truesight" },
    ];
    doc.combat.sight = { unseenAttacks: true, eyes: "sight" };
    for (const entry of doc.combat.conditions) {
      if (entry.condition === "blinded") entry.lacks = ["sight"];
      if (entry.condition === "invisible") entry.unseen = { pierced: ["blindsight", "truesight"] };
    }
    doc.sheet.live.conditions.push(
      { id: "darkvision_spell", label: "Darkvision (spell)" },
      { id: "true_seeing", label: "True Seeing" },
      { id: "outlined", label: "Outlined" },
    );
    doc.combat.conditions.push(
      { condition: "darkvision_spell", senses: { darkvision: 60 } },
      { condition: "true_seeing", senses: { truesight: 120 } },
      { condition: "outlined", cancelsUnseen: true, effects: ["attacks-against-advantage"] },
    );
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE(sighted));
  const combat = definition.combat!;

  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "fire", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Invisibility on the caster: gone once they attack or cast from "spells".
  const invisibility = spell("invisibility", {
    kind: "buff",
    autoHit: undefined,
    targets: "self",
    range: 0,
    applies: [
      { condition: "invisible", duration: { rounds: 10 }, endsWhenHolder: { attacks: true, casts: ["spells"] } },
    ],
  });
  const bolt = spell("bolt", { range: 120, amount: { flat: 5 }, cost: [{ pool: "slots_1", amount: 1 }] });
  // A darkness only darkvision and blindsight see into, and fog nothing does.
  const dark = spell("dark", {
    kind: "utility",
    autoHit: undefined,
    area: { shape: "burst", size: 5 },
    range: 60,
    zone: { rounds: 10, triggers: [], obscures: { pierced: ["darkvision", "blindsight"] } },
  });
  const fog = spell("fog", {
    kind: "utility",
    autoHit: undefined,
    area: { shape: "burst", size: 10 },
    range: 120,
    zone: { rounds: 10, triggers: [], obscures: {} },
  });
  // A burning patch that strikes whoever starts a turn in it, on its own.
  const burn = spell("burn", {
    area: { shape: "burst", size: 5 },
    range: 60,
    amount: { flat: 3 },
    zone: { rounds: 10, triggers: ["turn-start"], atCast: false },
  });
  const spells = [invisibility, bolt, dark, fog, burn];
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  const scrollItem = {
    category: "gear",
    use: {
      kind: "attack",
      budget: "action",
      range: 120,
      amount: { flat: 4 },
      damageType: "fire",
      casts: "spells",
      consumes: true,
    },
  } as unknown as RulesetCatalogItem;
  const potionItem = {
    category: "gear",
    use: { kind: "heal", budget: "action", amount: { flat: 2 }, consumes: true },
  } as unknown as RulesetCatalogItem;
  const gogglesItem = { category: "gear", worn: { senses: { darkvision: 60 } } } as unknown as RulesetCatalogItem;
  const held = (name: string, item: RulesetCatalogItem, worn = false): RulesetSheetItem => ({
    name,
    quantity: 1,
    ...(worn ? { worn: true } : {}),
    item,
    stack: { id: name, ref: `gear/${name}` },
  });
  const fight = (
    options: {
      placements?: Record<string, { x: number; y: number }>;
      a?: Partial<RulesetStatBlock>;
      mageLive?: Record<string, unknown>;
      items?: RulesetSheetItem[];
      board?: boolean;
    } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: (options.mageLive ?? {}) as never,
          catalogs: { spells },
          ...(options.items ? { items: options.items } : {}),
        },
        { id: "a", name: "A", side: "enemy", block: block(options.a) },
        { id: "b", name: "B", side: "enemy", block: block() },
      ],
      ...(options.board === false
        ? {}
        : {
            board: {
              grid: grid(),
              placements: { mage: { x: 2, y: 7 }, a: { x: 4, y: 7 }, b: { x: 16, y: 7 }, ...options.placements },
            },
          }),
    });
    state.order = ["mage", "a", "b"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(
      option,
      `${actorId} has no ${label}: ${rulesetCombatOptions(definition, state, actorId).map((one) => one.label)}`,
    );
    return option;
  };
  const choose = (
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    targetIds: string[] = [],
    at?: RulesetCombatCell,
  ) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: optionOf(state, actorId, label).id, targetIds, ...(at ? { at } : {}) },
      roll,
    );
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const sees = (state: RulesetEncounterState, viewer: string, seen: string) =>
    rulesetCanSee(definition, state, who(state, viewer), who(state, seen));
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, combat, who(state, id)).value;
  const holds = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const toMage = (state: RulesetEncounterState) => {
    let next = state;
    for (let turn = 0; turn < 3; turn++) next = advanceRulesetTurn(definition, next, roll).state;
    assert.equal(next.order[next.turn], "mage");
    return next;
  };
  const toA = (state: RulesetEncounterState) => {
    const next = advanceRulesetTurn(definition, state, roll).state;
    assert.equal(next.order[next.turn], "a");
    return next;
  };

  // ── Invisibility ends when its holder casts ──
  {
    const cast = choose(fight(), "mage", "Invisibility", ["mage"]);
    assert.equal(refused(cast), undefined);
    let state = cast.state;
    assert.ok(holds(state, "mage", "invisible"));
    assert.deepEqual(who(state, "mage").tracked.find((entry) => entry.condition === "invisible")?.endsWhenHolder, {
      attacks: true,
      casts: ["spells"],
    });
    assert.equal(sees(state, "a", "mage"), false);
    state = toMage(state);
    assert.ok(holds(state, "mage", "invisible"), "it lasts while the mage does nothing");
    // Casting the bolt: the mage was invisible as it went, and is not afterwards.
    const step = choose(state, "mage", "Bolt", ["a"]);
    assert.equal(refused(step), undefined);
    assert.equal(hp(step.state, "a"), 95);
    assert.ok(!holds(step.state, "mage", "invisible"), "casting a spell ends it");
    assert.ok(
      step.events.some((one) => one.type === "condition" && one.condition === "invisible" && one.active === false),
    );
    assert.equal(sees(step.state, "a", "mage"), true);
  }

  // ── … and when its holder attacks: the attack still had it ──
  {
    const state = toA(fight({ placements: { a: { x: 3, y: 7 } } }));
    who(state, "a").tracked.push({ condition: "invisible", rounds: null, endsWhenHolder: { attacks: true } });
    assert.equal(sees(state, "mage", "a"), false);
    const option = optionOf(state, "a", "Claw");
    assert.equal(
      rulesetAttackMode(definition, combat, who(state, "a"), who(state, "mage"), { state, optionId: option.id }),
      "advantage",
      "the claw is made unseen",
    );
    const step = choose(state, "a", "Claw", ["mage"]);
    assert.equal(refused(step), undefined);
    const attack = step.events.find((one) => one.type === "attack");
    assert.ok(attack && attack.type === "attack" && attack.mode === "advantage", "rolled with advantage");
    assert.ok(!holds(step.state, "a", "invisible"), "attacking ends it");
    // Only casting ends this one: the claw leaves it on.
    const casting = toA(fight({ placements: { a: { x: 3, y: 7 } } }));
    who(casting, "a").tracked.push({ condition: "invisible", rounds: null, endsWhenHolder: { casts: ["spells"] } });
    assert.ok(holds(choose(casting, "a", "Claw", ["mage"]).state, "a", "invisible"), "an attack is not a spell");
    // An item's use that casts from "spells" is casting; a potion is not.
    const scroll = fight({ items: [held("scroll", scrollItem), held("potion", potionItem)] });
    who(scroll, "mage").tracked.push({ condition: "invisible", rounds: null, endsWhenHolder: { casts: ["spells"] } });
    const drank = choose(scroll, "mage", optionOf(scroll, "mage", "potion").label, ["mage"]);
    assert.equal(refused(drank), undefined);
    assert.ok(holds(drank.state, "mage", "invisible"), "drinking a potion is not casting");
    const read = choose(scroll, "mage", optionOf(scroll, "mage", "scroll").label, ["a"]);
    assert.equal(refused(read), undefined);
    assert.ok(!holds(read.state, "mage", "invisible"), "reading a scroll is");
    // Casting from another catalog does not end it.
    const other = fight();
    who(other, "mage").tracked.push({ condition: "invisible", rounds: null, endsWhenHolder: { casts: ["feats"] } });
    assert.ok(holds(choose(other, "mage", "Bolt", ["a"]).state, "mage", "invisible"));
  }

  // ── A spell called off was cast all the same; so was an answer that failed its save ──
  {
    const counter = (cancelSave?: { save: string; dc: number }) =>
      fight({
        placements: { a: { x: 3, y: 7 } },
        a: {
          actions: [
            { name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } },
            {
              name: "Hush",
              budget: "reaction",
              ...(cancelSave ? { toHit: 0 } : {}),
              reaction: {
                on: "used",
                cancels: true,
                against: { catalogs: ["spells"] },
                ...(cancelSave ? { cancelSave } : {}),
              },
            },
          ],
        } as Partial<RulesetStatBlock>,
      });
    const state = counter();
    who(state, "mage").tracked.push({ condition: "invisible", rounds: null, endsWhenHolder: { casts: ["spells"] } });
    const held = choose(state, "mage", "Bolt", ["a"]);
    assert.ok(held.state.window, "A may answer the bolt");
    const hush = rulesetWindowOptions(definition, held.state, "a").find((one) => one.label === "Hush")!;
    const stopped = applyRulesetCombatChoice(
      definition,
      held.state,
      { actorId: "a", optionId: hush.id, targetIds: [], window: held.state.window!.id },
      roll,
    );
    assert.ok(stopped.events.some((one) => one.type === "cancelled"));
    assert.equal(hp(stopped.state, "a"), 100, "the bolt never lands");
    assert.ok(!holds(stopped.state, "mage", "invisible"), "but the mage cast it");
    // An answer (here one that rolls to hit) whose save fails does nothing, but it was made.
    const tried = counter({ save: "dex_save", dc: 30 });
    who(tried, "a").tracked.push({ condition: "invisible", rounds: null, endsWhenHolder: { attacks: true } });
    const asked = choose(tried, "mage", "Bolt", ["a"]);
    const answer = rulesetWindowOptions(definition, asked.state, "a").find((one) => one.label === "Hush")!;
    const failed = applyRulesetCombatChoice(
      definition,
      asked.state,
      { actorId: "a", optionId: answer.id, targetIds: [], window: asked.state.window!.id },
      roll,
    );
    assert.ok(!failed.events.some((one) => one.type === "cancelled"), "the save failed");
    assert.ok(!holds(failed.state, "a", "invisible"), "the answer was made all the same");
  }

  // ── The fight's end takes it off ──
  {
    // With no clock of its own, only what ends it says it will not outlast the fight.
    const state = fight();
    who(state, "a").tracked.push({ condition: "invisible", rounds: null, endsWhenHolder: { attacks: true } });
    const lifted = liftRulesetFightEffects(definition, state);
    assert.ok(
      lifted.some((one) => one.type === "condition" && one.condition === "invisible" && one.active === false),
      "it lasts no longer than the fight",
    );
  }

  // ── A standing zone striking on its own is not its caster acting ──
  {
    const laid = choose(fight(), "mage", "Burn", [], { x: 4, y: 7 });
    assert.equal(refused(laid), undefined);
    let state = laid.state;
    who(state, "mage").tracked.push({
      condition: "invisible",
      rounds: null,
      endsWhenHolder: { attacks: true, casts: ["spells"] },
    });
    state = toA(state);
    assert.equal(hp(state, "a"), 97, "the patch burns A as its turn begins");
    assert.ok(holds(state, "mage", "invisible"), "the mage did nothing");
  }

  // ── Senses from conditions and items ──
  {
    // Darkness on A: the mage has no darkvision of its own.
    const plain = choose(fight(), "mage", "Dark", [], { x: 4, y: 7 }).state;
    assert.equal(sees(plain, "mage", "a"), false);
    // The Darkvision spell gives 60 ft, so 12 cells.
    const spelled = choose(fight({ mageLive: { conditions: ["darkvision_spell"] } }), "mage", "Dark", [], {
      x: 4,
      y: 7,
    }).state;
    assert.equal(rulesetSenseRanges(definition, who(spelled, "mage"), spelled).darkvision, 12);
    assert.equal(sees(spelled, "mage", "a"), true, "darkvision from a condition");
    // Goggles of night, worn; carried, they do nothing.
    const goggles = choose(fight({ items: [held("goggles", gogglesItem, true)] }), "mage", "Dark", [], {
      x: 4,
      y: 7,
    }).state;
    assert.equal(sees(goggles, "mage", "a"), true, "darkvision from worn goggles");
    const pocket = choose(fight({ items: [held("goggles", gogglesItem)] }), "mage", "Dark", [], { x: 4, y: 7 }).state;
    assert.equal(sees(pocket, "mage", "a"), false, "goggles in a pack give nothing");
    // A longer reach of its own stands: a creature with darkvision 120 and a spell of 60.
    const own = fight({ a: { senses: { darkvision: 120 } } });
    who(own, "a").tracked.push({ condition: "darkvision_spell", rounds: null });
    assert.equal(rulesetSenseRanges(definition, who(own, "a"), own).darkvision, 24);
    // True Seeing finds the invisible, within 120 ft.
    const hidden = fight({ placements: { a: { x: 12, y: 7 } } });
    who(hidden, "a").tracked.push({ condition: "invisible", rounds: null });
    assert.equal(sees(hidden, "mage", "a"), false);
    who(hidden, "mage").tracked.push({ condition: "true_seeing", rounds: null });
    assert.equal(sees(hidden, "mage", "a"), true, "truesight from a condition");
    // Blinded, the truesight is gone with the eyes.
    who(hidden, "mage").tracked.push({ condition: "blinded", rounds: null });
    assert.equal(sees(hidden, "mage", "a"), false);
  }

  // ── Faerie Fire gives the invisible away ──
  {
    const state = fight({ placements: { a: { x: 12, y: 7 } } });
    who(state, "a").tracked.push({ condition: "invisible", rounds: null });
    assert.equal(sees(state, "mage", "a"), false);
    who(state, "a").tracked.push({ condition: "outlined", rounds: null });
    assert.equal(sees(state, "mage", "a"), true, "outlined, the invisible are seen");
    assert.equal(sees(state, "b", "a"), true, "by everybody");
    // Off a board too.
    const off = fight({ board: false });
    who(off, "a").tracked.push({ condition: "invisible", rounds: null }, { condition: "outlined", rounds: null });
    assert.equal(sees(off, "mage", "a"), true);
    // Fog still hides them.
    const fogged = choose(fight({ placements: { a: { x: 12, y: 7 } } }), "mage", "Fog", [], { x: 12, y: 7 }).state;
    who(fogged, "a").tracked.push({ condition: "invisible", rounds: null }, { condition: "outlined", rounds: null });
    assert.equal(sees(fogged, "mage", "a"), false, "an obscuring zone still hides an outlined creature");
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
    const withSpell = (mechanics: Record<string, unknown>) => (doc: Record<string, any>) => {
      sighted(doc);
      doc.catalogs.push({ id: "x", label: "X", feeds: ["spells"], entries: [{ ...spell("x", {}), mechanics }] });
    };
    const applying = (endsWhenHolder: unknown) =>
      withSpell({
        kind: "buff",
        applies: [{ condition: "invisible", duration: { rounds: 1 }, endsWhenHolder }],
      });
    refusedDoc(applying({ casts: ["scrolls"] }), /Unknown catalog "scrolls"/);
    refusedDoc(applying({}), /Say what ends it/);
    refusedDoc(applying({ casts: ["x", "x"] }), /A catalog is named once/);
    refusedDoc((doc) => {
      sighted(doc);
      doc.combat.conditions.find((entry: any) => entry.condition === "true_seeing").senses = { xray: 30 };
    }, /Unknown sense "xray"/);
    refusedDoc((doc) => {
      sighted(doc);
      delete doc.combat.senses;
      delete doc.combat.sight;
      for (const entry of doc.combat.conditions) delete entry.unseen;
    }, /declares no combat senses to give/);
    const withItem = (item: Record<string, unknown>) => (doc: Record<string, any>) => {
      sighted(doc);
      doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [{ id: "it", label: "It", item }] });
    };
    refusedDoc(withItem({ category: "gear", worn: { senses: { xray: 30 } } }), /Unknown sense "xray"/);
    refusedDoc(
      withItem({ category: "gear", use: { kind: "attack", budget: "action", amount: { flat: 1 }, casts: "scrolls" } }),
      /Unknown catalog "scrolls"/,
    );
    // An item that does nothing but give a sense is fine.
    parsed(fiveE(withItem({ category: "gear", worn: { senses: { darkvision: 60 } } })));
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
      "A ruleset with conditions that end when their holder attacks or casts, senses given by conditions or items, conditions that give away the unseen, or item uses that cast, requires schemaVersion 2 and capabilityApi 1.180 or newer";
    const docs: Array<[string, Record<string, any>]> = [
      [
        "endsWhenHolder",
        fiveE((doc) => {
          doc.catalogs.push({ id: "x", label: "X", entries: [invisibility] });
        }),
      ],
      [
        "condition senses",
        fiveE((doc) => {
          doc.combat.conditions.push({ condition: "x", senses: { darkvision: 60 } });
        }),
      ],
      [
        "cancelsUnseen",
        fiveE((doc) => {
          doc.combat.conditions.push({ condition: "x", cancelsUnseen: true });
        }),
      ],
      [
        "worn senses",
        fiveE((doc) => {
          doc.catalogs.push({ id: "gear", label: "Gear", entries: [{ id: "g", label: "G", item: gogglesItem }] });
        }),
      ],
      [
        "use casts",
        fiveE((doc) => {
          doc.catalogs.push({ id: "gear", label: "Gear", entries: [{ id: "s", label: "S", item: scrollItem }] });
        }),
      ],
    ];
    for (const [label, doc] of docs) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(179) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(180) as never, doc), gate, label);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(179) as never, fiveE()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset sight extras: Invisibility ends on an attack or a cast (a scroll's too, not a zone's), senses come from conditions and worn items, Faerie Fire gives the invisible away.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
