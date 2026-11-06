/**
 * Charges spent on a hit (Capability API 1.273).
 *
 *   - A weapon's `attack.spends`: once a blow with it has hit, its holder may spend the item's
 *     charges for more harm with the blow (a Staff of Power's Power Strike), more for each charge
 *     more (a Staff of Striking's 1d6 force a charge, up to three) and conditions on the one hit
 *     against a save (a Staff of Withering's Constitution save).
 *   - Only a hit with that weapon offers it, and only while the item holds the charges; its last
 *     charge rolls the item's last-charge die.
 *   - The Game Master's facts say so; import refusals and the gate.
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
  RULESET_PASS_OPTION,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemAttackText,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-charged-hits-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 268);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const staff = (id: string, label: string, spends: unknown[], breaksOn?: unknown) => ({
    id,
    label,
    item: {
      category: "staff",
      slots: { hands: 1 },
      stack: 1,
      charges: { max: 10, ...(breaksOn ? { breaksOn } : {}) },
      attack: { budget: "action", toHit: { bonus: 3 }, damage: { dice: "1d6", bonus: 3, type: "bludgeoning" }, spends },
    },
  });
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = { categories: [{ id: "staff", label: "Staff" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    doc.sheet.live.conditions.push({ id: "withered", label: "Withered" });
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        staff("power", "Staff of Power", [
          { label: "Power Strike", charges: 1, amount: { dice: "1d6" }, type: "force" },
        ]),
        staff(
          "striking",
          "Staff of Striking",
          [
            {
              label: "Strike",
              charges: 1,
              amount: { dice: "1d6" },
              type: "force",
              blow: "melee",
              chargeStep: { max: 2, amount: { dice: "1d6" } },
            },
          ],
          { die: 20, atMost: 1, becomes: "gear/quarterstaff" },
        ),
        staff("withering", "Staff of Withering", [
          {
            label: "Wither",
            charges: 1,
            amount: { dice: "2d10" },
            type: "necrotic",
            onHit: [{ condition: "withered", rounds: 600, save: { save: "con_save", difficulty: 10 } }],
          },
        ]),
        {
          id: "quarterstaff",
          label: "Quarterstaff",
          item: {
            category: "staff",
            slots: { hands: 1 },
            stack: 1,
            attack: { budget: "action", toHit: { bonus: 0 }, damage: { dice: "1d6", type: "bludgeoning" } },
          },
        },
        {
          id: "dagger",
          label: "Dagger",
          item: {
            category: "staff",
            slots: { hands: 1 },
            stack: 1,
            attack: { budget: "action", toHit: { bonus: 3 }, damage: { dice: "1d4", type: "piercing" } },
          },
        },
      ],
    });
    edit(doc);
    return doc;
  };
  const gear = (doc: Record<string, any>, at: number) => doc.catalogs.at(-1).entries[at].item;
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
  const entriesOf = (one: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (one.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds === "items" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
  const book = rulesetItemBook(definition, entriesOf(definition));
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
    lists: {},
  });
  const foe = (): RulesetStatBlock =>
    ({
      health: 200,
      defense: 1,
      initiativeModifier: 0,
      speed: 30,
      saves: { con_save: 0 },
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
    }) as unknown as RulesetStatBlock;
  let faces: Record<number, number[]> = {};
  // Every die shows 1 unless told otherwise; a d20 shows 10.
  const roll = (sides: number) => faces[sides]?.shift() ?? (sides === 20 ? 10 : 1);
  const fight = (ref: string, name: string, charges = 10): RulesetEncounterState => {
    faces = {};
    const held = (one: string, label: string, stack: string, count?: number) =>
      ({
        item: book.itemOf(one)!.entry.item!,
        quantity: 1,
        name: label,
        worn: true,
        ...(count !== undefined ? { charges: count } : {}),
        stack: { id: stack, ref: one },
      }) as RulesetSheetItem;
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
          items: [held(ref, name, "st", charges), held("gear/dagger", "Dagger", "dg")],
          catalogs: entriesOf(definition),
        },
        { id: "ogre", name: "Ogre", side: "enemy", block: foe() },
      ],
    });
    state.order = ["hero", "ogre"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: Partial<RulesetCombatChoice> & { optionId: string }) => {
    const done = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", targetIds: [], ...choice } as RulesetCombatChoice,
      roll,
    );
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const hit = (state: RulesetEncounterState, optionId = "item:0") => {
    const done = act(state, { optionId, targetIds: ["ogre"] });
    return done;
  };
  const answers = (state: RulesetEncounterState) => rulesetWindowOptions(definition, state, "hero");
  /** What a spend and the blow it joined did, the blow passed on to if it is still held. */
  const settle = (spent: ReturnType<typeof act>) => {
    if (!spent.state.window) return { state: spent.state, events: spent.events };
    const landed = act(spent.state, { optionId: RULESET_PASS_OPTION });
    return { state: landed.state, events: [...spent.events, ...landed.events] };
  };
  const harm = (events: RulesetCombatEvent[], label: string) =>
    of(events, "damage").filter((one) => one.label === label);

  // ── Power Strike: a charge for 1d6 force on the staff's hit ──
  {
    const state = fight("gear/power", "Staff of Power");
    faces = { 20: [15] };
    const struck = hit(state);
    assert.equal(struck.state.window?.trigger.kind, "hit");
    assert.deepEqual(struck.state.window?.waiting, ["hero"]);
    const offered = answers(struck.state);
    assert.deepEqual(
      offered.map((one) => [one.id, one.label, one.left, one.payWith]),
      [["spend:0:0", "Staff of Power: Power Strike", 10, undefined]],
    );
    faces = { 6: [1, 4] };
    const spent = act(struck.state, { optionId: "spend:0:0" });
    assert.deepEqual(
      of(spent.events, "uses").map((one) => [one.label, one.left, one.of]),
      [["Staff of Power: Power Strike", 9, 10]],
    );
    assert.deepEqual(
      of(spent.events, "added").map((one) => one.label),
      ["Staff of Power: Power Strike"],
    );
    // Asked once: nothing more is held for the hit, so it lands.
    const landed = settle(spent);
    const force = harm(landed.events, "Staff of Power: Power Strike");
    assert.deepEqual(
      force.map((one) => [one.damageType, one.amount]),
      [["force", 4]],
    );
    assert.equal(who(landed.state, "hero").charges?.[0], 9);
  }

  // ── Only a hit with the staff: the dagger's offers nothing ──
  {
    const state = fight("gear/power", "Staff of Power");
    faces = { 20: [15] };
    const struck = hit(state, "item:1");
    assert.equal(struck.state.window, undefined, "nothing to answer a dagger's hit with");
    assert.equal(harm(struck.events, "Staff of Power: Power Strike").length, 0);
  }

  // ── Too few charges left: not offered ──
  {
    const state = fight("gear/power", "Staff of Power", 0);
    faces = { 20: [15] };
    const struck = hit(state);
    assert.equal(struck.state.window, undefined, "an empty staff spends nothing");
  }

  // ── A Staff of Striking: up to two charges more, 1d6 each ──
  {
    const state = fight("gear/striking", "Staff of Striking");
    faces = { 20: [15] };
    const struck = hit(state);
    // Only on a melee blow, as the staff says.
    assert.equal(who(state, "hero").actions.find((one) => one.id === "spend:0:0")?.reaction?.blow, "melee");
    const offered = answers(struck.state);
    assert.deepEqual(
      offered.map((one) => [one.label, one.payWith]),
      [["Staff of Striking: Strike", ["charges:1", "charges:2"]]],
    );
    faces = { 6: [1, 2, 3, 4] };
    const spent = act(struck.state, { optionId: "spend:0:0", payWith: "charges:2" });
    assert.deepEqual(
      of(spent.events, "uses").map((one) => one.left),
      [7],
      "three charges spent",
    );
    const landed = settle(spent);
    const all = landed.events;
    assert.deepEqual(
      harm(all, "Staff of Striking: Strike").map((one) => [one.damageType, one.amount]),
      [["force", 9]],
      "3d6 force",
    );
  }

  // ── Its last charge: the die is rolled, and on a 1 it is a quarterstaff ──
  {
    const state = fight("gear/striking", "Staff of Striking", 1);
    faces = { 20: [15] };
    const struck = hit(state);
    assert.deepEqual(answers(struck.state)[0]?.payWith, undefined, "no charge to spend more");
    faces = { 20: [1], 6: [1, 5] };
    const spent = act(struck.state, { optionId: "spend:0:0" });
    assert.deepEqual(
      of(spent.events, "broke").map((one) => [one.roll, one.becomes]),
      [[1, "Quarterstaff"]],
    );
    const landed = settle(spent);
    const all = landed.events;
    assert.deepEqual(
      harm(all, "Staff of Striking: Strike").map((one) => [one.damageType, one.amount]),
      [["force", 5]],
      "the charge spent still lands",
    );
    const hero = who(landed.state, "hero");
    assert.ok(!hero.actions.some((one) => one.id.startsWith("spend:0")), "a quarterstaff spends nothing");
    assert.equal(hero.sheet?.items?.[0]?.name, "Quarterstaff");
  }

  // ── A Staff of Withering: 2d10 necrotic, and a Constitution save or withered ──
  {
    const state = fight("gear/withering", "Staff of Withering");
    faces = { 20: [15] };
    const struck = hit(state);
    faces = { 10: [3, 4], 20: [5] };
    const spent = act(struck.state, { optionId: "spend:0:0" });
    const landed = settle(spent);
    const all = landed.events;
    assert.deepEqual(
      harm(all, "Staff of Withering: Wither").map((one) => [one.damageType, one.amount]),
      [["necrotic", 7]],
    );
    assert.deepEqual(
      of(all, "save").map((one) => [one.save, one.success]),
      [["con_save", false]],
    );
    assert.ok(rulesetCombatConditions(definition, who(landed.state, "ogre")).includes("withered"));

    const again = fight("gear/withering", "Staff of Withering");
    faces = { 20: [15] };
    const second = hit(again);
    faces = { 10: [3, 4], 20: [15] };
    const made = act(second.state, { optionId: "spend:0:0" });
    const after = settle(made);
    assert.ok(!rulesetCombatConditions(definition, who(after.state, "ogre")).includes("withered"), "saved");
  }

  // ── The Game Master's facts ──
  {
    const facts = rulesetItemFacts(definition, book.itemOf("gear/striking")!.entry.item!);
    assert.match(
      rulesetItemAttackText(facts.attack!),
      /Strike: on a hit, 1 charge for \+1d6 force, up to 2 more for \+1d6 each/,
    );
    const withering = rulesetItemFacts(definition, book.itemOf("gear/withering")!.entry.item!);
    assert.match(
      rulesetItemAttackText(withering.attack!),
      /Wither: on a hit, 1 charge for \+2d10 necrotic, Withered for 600 rounds \(.+ 10 resists\)/,
    );
  }

  // ── Import refusals ──
  {
    refused(
      document((doc) => delete gear(doc, 0).charges),
      /Charges spent on a hit are the item's own, so it holds some/,
    );
    refused(
      document((doc) => (gear(doc, 2).attack.spends[0].onHit[0].condition = "rotting")),
      /Unknown condition "rotting"/,
    );
    refused(
      document((doc) => (gear(doc, 2).attack.spends[0].onHit[0].save.save = "luck")),
      /Unknown save "luck"/,
    );
    refused(
      document((doc) => (gear(doc, 0).attack.spends[0].amount = {})),
      /What spending charges on a hit adds is dice, a flat amount, or both/,
    );
    refused(
      document((doc) => (gear(doc, 1).attack.spends[0].chargeStep.amount = {})),
      /A charge more adds dice, a flat amount, or both/,
    );
    // Rounds beside a save that ends it are the most it lasts since 1.534; counted on the wielder's
    // turns, it lasts some.
    refused(
      document((doc) => {
        delete gear(doc, 2).attack.spends[0].onHit[0].rounds;
        gear(doc, 2).attack.spends[0].onHit[0].of = "source";
      }),
      /Counted on its wielder's turns, it lasts some "rounds"/,
    );
    refused(
      document((doc) => (gear(doc, 0).attack.spends[0].type = "sonic boom")),
      /Unknown damage type "sonic boom"/,
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
    const gate =
      "A ruleset with a weapon whose charges are spent on its hits requires schemaVersion 2 and capabilityApi 1.273 or newer";
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const plain = document((doc) => {
      doc.catalogs.pop();
    });
    assert.notEqual(issue(272, plain), gate, "nothing of 1.273 left");
    assert.equal(issue(272, document()), gate);
    assert.notEqual(issue(273, document()), gate);
    assert.equal(issue(272, plain, new Map([["extra.json", [{ id: "x", item: { attack: { spends: [] } } }]]])), gate);
  }

  console.log(
    "Ruleset charged hits: a staff's charges spent on its own hit (Power Strike's 1d6 force, Striking's 1d6 a charge up to three, Withering's 2d10 necrotic and its Constitution save), only on that weapon's hit and while it holds them, its last charge rolling its die; facts, refusals and the gate at 1.273.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
