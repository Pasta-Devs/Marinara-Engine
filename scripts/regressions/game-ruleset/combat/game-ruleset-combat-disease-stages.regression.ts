/**
 * Disease stages (Capability API 1.261), and qualities on a stat block's action (1.262).
 *
 *   - `onDamaged`: Slimy Doom stuns its holder each time they take damage.
 *   - `cannot-heal-nonmagical`: a diseased giant rat's bite keeps off every heal but a magical one,
 *     in a fight, on the sheet and on a rest.
 *   - `expires.becomes`: an aboleth's disease turns into its later stage when its clock runs out, a
 *     fight's end included, never when it is cured; `curedOnlyBy`: only a 6th-level cure ends that.
 *   - `onRest.restoredWhenCured`: a cure gives back what the rests took.
 *   - `ends` on a stat block's action: a unicorn's Healing Touch.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  clampRulesetStatBlock,
  createRulesetEncounter,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-disease-stages-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 256);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, level: number, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: { range: 30, ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const spells = [
    spell("bolt", 1, { kind: "attack", targets: "enemy", autoHit: true, amount: { flat: 3 }, damageType: "fire" }),
    spell("mend", 1, { kind: "heal", targets: "any", amount: { flat: 5 }, qualities: ["magical"] }),
    spell("bandage", 1, { kind: "heal", targets: "any", amount: { flat: 5 } }),
    spell("cleanse", 1, {
      kind: "utility",
      targets: "any",
      ends: { conditions: ["disease"] },
      cost: [{ pool: "slots_1", amount: 1 }],
    }),
  ];
  const conditionsOf = (doc: Record<string, any>, id: string) =>
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === id);
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items ??= { categories: [{ id: "gear", label: "Gear" }] };
    doc.items.tags = [...(doc.items.tags ?? []), { id: "magical", label: "Magical" }];
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    for (const [id, label] of [
      ["slimy_doom", "Slimy Doom"],
      ["rat_fever", "Rat Fever"],
      ["sea_change", "Sea Change"],
      ["sea_curse", "Sea Curse"],
      ["mummy_rot", "Mummy Rot"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      {
        condition: "slimy_doom",
        effects: [],
        kinds: ["disease"],
        onDamaged: { applies: [{ condition: "stunned", duration: { rounds: 1 } }] },
      },
      { condition: "rat_fever", effects: ["cannot-heal-nonmagical"], kinds: ["disease"] },
      { condition: "sea_change", effects: [], kinds: ["disease"], expires: { becomes: "sea_curse" } },
      { condition: "sea_curse", effects: [], kinds: ["disease"], curedOnlyBy: { catalogs: ["spells"], minLevel: 6 } },
      {
        condition: "mummy_rot",
        effects: [],
        onRest: { rests: ["long"], lowersMax: { dice: "3d6" }, lasting: true, restoredWhenCured: true },
      },
    );
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
  const entries = definition.catalogs!.find((entry) => entry.id === "spells")!.entries!;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    fields: {
      level: 11,
      ac: 12,
      speed: 30,
      hp_max: 30,
      spellcasting_ability: "int",
      slots_max_1: 4,
      slots_max_6: 1,
    },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  let d20s: number[] = [];
  const roll = (sides: number) => (sides === 20 ? (d20s.shift() ?? 10) : 3);
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 50,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    saves: { con_save: 0 },
    actions: [],
    ...extra,
  });
  const fight = (
    foe: Partial<RulesetStatBlock> = {},
    extra: Array<Record<string, unknown>> = [],
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      bestiary: { spells: entries },
      seed: 1,
      roller: roll,
      combatants: [
        { id: "corwin", name: "Corwin", side: "party", build, live: {}, catalogs: { spells: entries } },
        { id: "foe", name: "Foe", side: "enemy", block: block(foe) },
        ...(extra as never[]),
      ],
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id = "foe") => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, condition: string, id = "foe") =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const cast = (state: RulesetEncounterState, label: string, targetIds = ["foe"], payWith?: string) => {
    state.turn = 0;
    who(state, "corwin").budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "corwin").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return act(state, { actorId: "corwin", optionId: option.id, targetIds, ...(payWith ? { payWith } : {}) });
  };

  // ── Slimy Doom: stunned each time its holder takes damage ──
  {
    const state = fight();
    who(state).tracked.push({ condition: "slimy_doom", rounds: null });
    const hit = cast(state, "Bolt");
    assert.ok(has(hit.state, "stunned"), JSON.stringify(hit.events));
    assert.ok(who(hit.state).tracked.find((entry) => entry.condition === "stunned")!.rounds !== null, "on a clock");
    // Not without the disease, and not on whoever the blow kills.
    assert.equal(has(cast(fight(), "Bolt").state, "stunned"), false);
    const dying = fight({ health: 3 });
    who(dying).tracked.push({ condition: "slimy_doom", rounds: null });
    assert.equal(has(cast(dying, "Bolt").state, "stunned"), false);
  }

  // ── Only magic heals a diseased giant rat's bite ──
  const flask = (tags?: string[]) =>
    ({
      category: "gear",
      ...(tags ? { tags } : {}),
      use: { kind: "heal", budget: "action", amount: { flat: 4 }, consumes: true },
    }) as unknown as RulesetCatalogItem;
  {
    const hurt = { pools: { hp: { value: 10 } }, conditions: ["rat_fever"] };
    const state = createRulesetEncounter({
      definition,
      bestiary: { spells: entries },
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build,
          live: hurt,
          catalogs: { spells: entries },
          items: [
            { name: "Potion", quantity: 1, item: flask(["magical"]) },
            { name: "Tonic", quantity: 1, item: flask() },
          ],
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
    });
    state.order = ["corwin", "foe"];
    state.turn = 0;
    const plain = cast(state, "Bandage", ["corwin"]);
    const blocked = of(plain.events, "heal")[0]!;
    assert.deepEqual([blocked.amount, blocked.blocked], [0, true]);
    const magic = of(cast(plain.state, "Mend", ["corwin"]).events, "heal")[0]!;
    assert.deepEqual([magic.amount, magic.blocked], [5, undefined]);
    // An item tagged magical is a magical heal in a fight too; one that is not is kept off.
    const quaff = (from: RulesetEncounterState, label: string) => {
      from.turn = 0;
      who(from, "corwin").budgets.action = 1;
      const option = rulesetCombatOptions(definition, from, "corwin").find((one) => one.label.startsWith(label));
      assert.ok(option, `no ${label}: ${rulesetCombatOptions(definition, from, "corwin").map((one) => one.label)}`);
      return act(from, { actorId: "corwin", optionId: option.id, targetIds: ["corwin"] });
    };
    const tonic = of(quaff(plain.state, "Tonic").events, "heal")[0]!;
    assert.deepEqual([tonic.amount, tonic.blocked], [0, true]);
    const drunk = of(quaff(plain.state, "Potion").events, "heal")[0]!;
    assert.deepEqual([drunk.amount, drunk.blocked], [4, undefined]);
    // On the sheet: refused unless magical, and a rest gives nothing back.
    const pool = (live: unknown) => readRulesetLive(definition, build, live).pools.find((one) => one.key === "hp")!;
    const refusedHeal = applyRulesetSheetOp(definition, build, hurt, { op: "restore", pool: "hp", amount: 5 });
    assert.deepEqual(refusedHeal, { ok: false, reason: "cannot-heal" });
    const potion = applyRulesetSheetOp(definition, build, hurt, {
      op: "restore",
      pool: "hp",
      amount: 5,
      magical: true,
    });
    assert.ok(potion.ok && pool(potion.live).value === 15);
    const rested = applyRulesetSheetOp(definition, build, hurt, { op: "rest", rest: "long" });
    assert.ok(rested.ok);
    assert.equal(pool(rested.live).value, 10);
    assert.match(rested.now, /Rat Fever keeps .* from healing/);
    // Cured, they heal as ever.
    const cured = applyRulesetSheetOp(
      definition,
      build,
      { pools: { hp: { value: 10 } } },
      { op: "rest", rest: "long" },
    );
    assert.ok(cured.ok && pool(cured.live).value === 30);
  }

  // ── An onset that turns into its later stage when its clock runs out ──
  {
    // In the fight, on its holder's own clock.
    const state = fight();
    who(state).tracked.push({ condition: "sea_change", rounds: 1, source: "corwin" });
    state.turn = 1;
    const ended = act(state, { actorId: "foe", optionId: "end-turn", targetIds: [] });
    assert.equal(has(ended.state, "sea_change"), false, JSON.stringify(ended.events));
    assert.ok(has(ended.state, "sea_curse"), "the later stage");
    assert.equal(who(ended.state).tracked.find((entry) => entry.condition === "sea_curse")!.rounds, null);
    // The fight's end lets its clock run out.
    const after = fight();
    who(after).tracked.push({ condition: "sea_change", rounds: 10 });
    liftRulesetFightEffects(definition, after);
    assert.ok(has(after, "sea_curse"));
    // Cured before then, it never turns.
    const early = fight();
    who(early).tracked.push({ condition: "sea_change", rounds: 10 });
    const cleansed = cast(early, "Cleanse");
    assert.equal(has(cleansed.state, "sea_change"), false);
    assert.equal(has(cleansed.state, "sea_curse"), false);
    // And the later stage: only a 6th-level cure ends it.
    const late = fight();
    who(late).tracked.push({ condition: "sea_curse", rounds: null });
    assert.ok(has(cast(late, "Cleanse").state, "sea_curse"), "a 1st-level cleanse does nothing");
    assert.equal(has(cast(late, "Cleanse", ["foe"], "slots_6").state, "sea_curse"), false, "a 6th-level one ends it");
  }

  // ── A cure gives back what Mummy Rot's rests took ──
  {
    const pool = (live: unknown) => readRulesetLive(definition, build, live).pools.find((one) => one.key === "hp")!;
    const rotted = applyRulesetSheetOp(definition, build, { conditions: ["mummy_rot"] }, { op: "rest", rest: "long" });
    assert.ok(rotted.ok);
    assert.deepEqual(
      [pool(rotted.live).sealed, (rotted.live as { lowered?: Record<string, number> }).lowered],
      [10, { mummy_rot: 10 }],
    );
    const lifted = applyRulesetSheetOp(definition, build, rotted.live, {
      op: "condition",
      condition: "mummy_rot",
      active: false,
    });
    assert.ok(lifted.ok);
    assert.deepEqual([pool(lifted.live).sealed, pool(lifted.live).lasting], [0, 0]);
    assert.equal((lifted.live as { lowered?: unknown }).lowered, undefined);
    assert.match(lifted.now, /maximum back up by 10/);
    // Only its own loss: a clay golem's stays.
    const both = { pools: { hp: { value: 20, sealed: 10, lasting: 10 } }, conditions: ["mummy_rot"] };
    const twice = applyRulesetSheetOp(definition, build, both, { op: "rest", rest: "long" });
    assert.ok(twice.ok);
    const off = applyRulesetSheetOp(definition, build, twice.live, {
      op: "condition",
      condition: "mummy_rot",
      active: false,
    });
    assert.ok(off.ok);
    assert.deepEqual([pool(off.live).sealed, pool(off.live).lasting], [10, 10]);
  }

  // ── A unicorn's Healing Touch cures as it heals ──
  {
    const unicorn = block({
      actions: [
        {
          id: "touch",
          name: "Healing Touch",
          budget: "action",
          heal: { count: 2, sides: 8, flat: 2 },
          ends: { conditions: ["disease"] },
          qualities: ["magical"],
          targets: "ally",
        },
        // Heals only: magical or not decides it on a holder of the rat's fever (1.262).
        {
          id: "mend",
          name: "Mending Touch",
          budget: "action",
          heal: { flat: 6 },
          qualities: ["magical"],
          targets: "ally",
        },
        { id: "rub", name: "Rubbing Touch", budget: "action", heal: { flat: 6 }, targets: "ally" },
      ],
    } as Partial<RulesetStatBlock>);
    const state = fight({}, [{ id: "unicorn", name: "Unicorn", side: "enemy", block: unicorn }]);
    who(state).tracked.push({ condition: "rat_fever", rounds: null }, { condition: "slimy_doom", rounds: null });
    state.turn = 2;
    const option = rulesetCombatOptions(definition, state, "unicorn").find((one) => one.label === "Healing Touch")!;
    assert.ok(option);
    who(state).health!.value = 20;
    const touched = act(state, { actorId: "unicorn", optionId: option.id, targetIds: ["foe"] });
    // It cures before it heals.
    const healed = of(touched.events, "heal")[0]!;
    assert.deepEqual([healed.amount, healed.blocked], [8, undefined], JSON.stringify(touched.events));
    assert.equal(has(touched.state, "rat_fever"), false);
    assert.equal(has(touched.state, "slimy_doom"), false);
    const touch = (label: string) => {
      const fevered = fight({}, [{ id: "unicorn", name: "Unicorn", side: "enemy", block: unicorn }]);
      who(fevered).tracked.push({ condition: "rat_fever", rounds: null });
      who(fevered).health!.value = 20;
      fevered.turn = 2;
      const picked = rulesetCombatOptions(definition, fevered, "unicorn").find((one) => one.label === label)!;
      return of(act(fevered, { actorId: "unicorn", optionId: picked.id, targetIds: ["foe"] }).events, "heal")[0]!;
    };
    assert.deepEqual([touch("Mending Touch").amount, touch("Rubbing Touch").amount], [6, 0]);
    // A catalog creature carries it onto its block.
    const written = parsed(
      document((doc) => {
        const creature = doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0];
        creature.creature.actions[0].ends = { conditions: ["disease"], count: 1 };
        creature.creature.actions[0].qualities = ["magical"];
      }),
    );
    const creature = written.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
    assert.deepEqual(rulesetStatBlockFromCreature(written, creature)!.actions[0]!.qualities, ["magical"]);
    assert.deepEqual(rulesetStatBlockFromCreature(written, creature)!.actions[0]!.ends, {
      conditions: ["disease"],
      count: 1,
    });
    // A block nobody wrote keeps no cure.
    const held = clampRulesetStatBlock(definition, unicorn, "cr_1");
    assert.equal((held.block.actions[0] as { ends?: unknown }).ends, undefined);
  }

  // ── Import ──
  {
    refused(
      document((doc) => (conditionsOf(doc, "sea_change").expires.becomes = "nope")),
      /Unknown condition "nope"/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "sea_change").expires.becomes = "sea_change")),
      /A condition does not turn into itself/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "sea_curse").curedOnlyBy.catalogs = ["scrolls"])),
      /Unknown catalog "scrolls"/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "slimy_doom").onDamaged.applies[0].condition = "slimy_doom")),
      /A condition does not put itself on/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "slimy_doom").onDamaged.applies[0].condition = "nope")),
      /Unknown condition "nope"/,
    );
    refused(
      document((doc) => (conditionsOf(doc, "slimy_doom").onDamaged.applies[0].duration = "until-save")),
      /What damage puts on lasts some rounds/,
    );
    refused(
      document((doc) => delete conditionsOf(doc, "mummy_rot").onRest.lasting),
      /"restoredWhenCured" gives back a lasting loss/,
    );
    refused(
      document((doc) => {
        const creature = doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0];
        creature.creature.actions[0].ends = { conditions: ["plague"] };
      }),
      /Unknown condition "plague"/,
    );
    refused(
      document((doc) => {
        const creature = doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0];
        creature.creature.actions[0].qualities = ["holy"];
      }),
      /Unknown item tag "holy"/,
    );
  }

  // ── The install gate: 1.261 ──
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
      "A ruleset with conditions brought on by damage, onsets that turn into another, cures only some level ends, rest losses a cure gives back, heals only magic gets through, or cures on a creature's action requires schemaVersion 2 and capabilityApi 1.261 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    for (const extra of [
      { condition: "x", onDamaged: { applies: [] } },
      { condition: "x", expires: { becomes: "y" } },
      { condition: "x", curedOnlyBy: { minLevel: 6 } },
      { condition: "x", onRest: { rests: ["long"], lowersMax: { flat: 1 }, lasting: true, restoredWhenCured: true } },
      { condition: "x", effects: ["cannot-heal-nonmagical"] },
      { name: "Healing Touch", budget: "action", ends: { conditions: ["x"] } },
    ]) {
      const doc = structuredClone(without);
      doc.extra = { entry: extra };
      assert.equal(issue(260, doc), gate, JSON.stringify(extra));
      assert.notEqual(issue(261, doc), gate);
    }
    // A catalog entry's ends is older.
    const older = structuredClone(without);
    older.extra = { entry: { label: "Cure", mechanics: { budget: "action", ends: { conditions: ["x"] } } } };
    assert.notEqual(issue(260, older), gate);
    assert.notEqual(issue(260, without), gate);
    assert.equal(
      issue(260, without, new Map([["c.json", { entries: [{ condition: "x", expires: { becomes: "y" } }] }]])),
      gate,
    );
    const qualityGate =
      "A ruleset with qualities on a creature's action requires schemaVersion 2 and capabilityApi 1.262 or newer";
    const blessed = structuredClone(without);
    blessed.extra = { entry: { name: "Healing Touch", budget: "action", qualities: ["magical"] } };
    assert.equal(issue(261, blessed), qualityGate);
    assert.notEqual(issue(262, blessed), qualityGate);
    const catalogQualities = structuredClone(without);
    catalogQualities.extra = { entry: { label: "Bolt", mechanics: { budget: "action", qualities: ["magical"] } } };
    assert.notEqual(issue(261, catalogQualities), qualityGate, "a catalog entry's are older");
    assert.equal(issue(261, without, new Map([["c.json", { entries: [blessed.extra.entry] }]])), qualityGate);
  }

  console.log(
    "Ruleset disease stages: damage brings Slimy Doom's stun, only magic (a spell, a magical potion, a magical Healing Touch) heals a rat's fever, an onset turns into its later stage that only a 6th-level cure ends, a cure gives Mummy Rot's loss back, and Healing Touch cures; gated at 1.261 and 1.262.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
