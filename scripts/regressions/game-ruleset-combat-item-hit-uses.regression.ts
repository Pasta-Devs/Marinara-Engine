/**
 * Weapon hits with their own uses (Capability API 1.534).
 *
 *   - An `attack.spends` entry may count its own `uses` in place of the item's charges, kept per
 *     spend and brought back by its `recharge`: a Rod of Lordly Might's properties, once a dawn each.
 *   - Its `amount` kept off by the one hit's made `save`, and a `drain` back to its wielder: Drain
 *     Life's DC 17 Constitution, 4d6 necrotic and half of it healed.
 *   - Conditions alone, with no amount: Paralyze's paralyzed a minute at most, a save at each turn's
 *     end; and the Staff of Thunder and Lightning's Thunder, stunned to the end of its wielder's next
 *     turn (`"of": "source"`).
 *   - The Game Master's facts, import refusals and the gate.
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
  rechargeRulesetItems,
  RULESET_PASS_OPTION,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemAttackText,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-hit-uses-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 534);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const dawn = { max: 1, recharge: { rests: ["long"], amount: "max" } };
  const rod = {
    id: "rod",
    label: "Rod of Lordly Might",
    item: {
      category: "rod",
      slots: { hands: 1 },
      stack: 1,
      attack: {
        budget: "action",
        toHit: { bonus: 3 },
        damage: { dice: "1d6", bonus: 3, type: "bludgeoning" },
        spends: [
          {
            label: "Drain Life",
            uses: dawn,
            amount: { dice: "4d6" },
            type: "necrotic",
            save: { save: "con_save", difficulty: 17 },
            drain: { share: 0.5 },
          },
          {
            label: "Paralyze",
            uses: dawn,
            onHit: [
              {
                condition: "paralyzed",
                rounds: 10,
                save: { save: "str_save", difficulty: 17 },
                saveEnds: { save: "str_save", difficulty: 17, at: "turn-end" },
              },
            ],
          },
          {
            label: "Thunder",
            uses: dawn,
            onHit: [{ condition: "stunned", rounds: 1, of: "source", save: { save: "con_save", difficulty: 17 } }],
          },
        ],
      },
    },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = { categories: [{ id: "rod", label: "Rod" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [structuredClone(rod)] });
    edit(doc);
    return doc;
  };
  const spends = (doc: Record<string, any>) => doc.catalogs.at(-1).entries[0].item.attack.spends;
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
      saves: { con_save: 0, str_save: 0 },
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
    }) as unknown as RulesetStatBlock;
  let faces: Record<number, number[]> = {};
  // Every die shows 1 unless told otherwise; a d20 shows 10.
  const roll = (sides: number) => faces[sides]?.shift() ?? (sides === 20 ? 10 : 1);
  const fight = (usesLeft?: Record<string, number>): RulesetEncounterState => {
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
          live: { hp: 20 },
          items: [
            {
              item: book.itemOf("gear/rod")!.entry.item!,
              quantity: 1,
              name: "Rod of Lordly Might",
              worn: true,
              ...(usesLeft ? { usesLeft } : {}),
              stack: { id: "rd", ref: "gear/rod" },
            } as RulesetSheetItem,
          ],
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
  const act = (
    state: RulesetEncounterState,
    choice: Partial<RulesetCombatChoice> & { optionId: string },
    actorId = "hero",
  ) => {
    const done = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, targetIds: [], ...choice } as RulesetCombatChoice,
      roll,
    );
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const hit = (state: RulesetEncounterState) => act(state, { optionId: "item:0", targetIds: ["ogre"] });
  const answers = (state: RulesetEncounterState) => rulesetWindowOptions(definition, state, "hero");
  const settle = (spent: ReturnType<typeof act>) => {
    if (!spent.state.window) return { state: spent.state, events: spent.events };
    const landed = act(spent.state, { optionId: RULESET_PASS_OPTION });
    return { state: landed.state, events: [...spent.events, ...landed.events] };
  };
  const harm = (events: RulesetCombatEvent[], label: string) =>
    of(events, "damage").filter((one) => one.label === label);

  // ── Each property offered on the rod's hit, from its own use, with no charges at all ──
  {
    const state = fight();
    faces = { 20: [15] };
    const struck = hit(state);
    assert.deepEqual(
      answers(struck.state).map((one) => [one.id, one.label, one.left]),
      [
        ["spend:0:0", "Rod of Lordly Might: Drain Life", 1],
        ["spend:0:1", "Rod of Lordly Might: Paralyze", 1],
        ["spend:0:2", "Rod of Lordly Might: Thunder", 1],
      ],
    );
  }

  // ── Drain Life: a failed Constitution save, 4d6 necrotic, half of it back ──
  {
    const state = fight();
    faces = { 20: [15] };
    const struck = hit(state);
    faces = { 20: [5], 6: [1, 6, 5, 4, 2] };
    const spent = act(struck.state, { optionId: "spend:0:0" });
    assert.deepEqual(
      of(spent.events, "uses").map((one) => [one.label, one.left, one.of]),
      [["Rod of Lordly Might: Drain Life", 0, 1]],
    );
    const landed = settle(spent);
    assert.deepEqual(
      harm(landed.events, "Rod of Lordly Might: Drain Life").map((one) => [one.damageType, one.amount]),
      [["necrotic", 17]],
    );
    assert.deepEqual(
      of(landed.events, "save").map((one) => [one.save, one.success]),
      [["con_save", false]],
    );
    const heals = of(landed.events, "heal").filter((one) => one.targetId === "hero");
    assert.deepEqual(
      heals.map((one) => one.amount),
      [8],
      "half of 17, rounded down",
    );
    const hero = who(landed.state, "hero");
    assert.equal(hero.usesLeft?.["0:h1"], 0, "its own use spent, kept apart from the others");
  }

  // ── Drain Life saved against: no harm and nothing back, the use still spent ──
  {
    const state = fight();
    faces = { 20: [15] };
    const struck = hit(state);
    faces = { 20: [18], 6: [6, 5, 4, 2] };
    const landed = settle(act(struck.state, { optionId: "spend:0:0" }));
    assert.equal(harm(landed.events, "Rod of Lordly Might: Drain Life").length, 0);
    assert.equal(of(landed.events, "heal").filter((one) => one.targetId === "hero").length, 0);
    assert.equal(who(landed.state, "hero").usesLeft?.["0:h1"], 0);
  }

  // ── Kept on the stack: a stack with its use spent offers nothing, and a long rest brings it back ──
  {
    const state = fight({ h1: 0 });
    faces = { 20: [15] };
    const struck = hit(state);
    assert.deepEqual(
      answers(struck.state).map((one) => one.id),
      ["spend:0:1", "spend:0:2"],
    );
    const stacks: GameInventoryStack[] = [
      { id: "rd", name: "Rod of Lordly Might", item: "gear/rod", quantity: 1, equipped: true, usesLeft: { h1: 0 } },
    ];
    const rest = (id: string) =>
      rechargeRulesetItems({ definition, itemOf: book.itemOf, stacks, holder: undefined, rest: id, roll: () => 1 });
    assert.deepEqual(rest("short").recharged, []);
    const back = rest("long");
    assert.deepEqual(back.recharged, [{ item: "Rod of Lordly Might: Drain Life", now: 1, max: 1, uses: true }]);
    assert.equal(back.stacks[0]!.usesLeft, undefined, "full again reads as full");
  }

  // ── Paralyze: no harm of its own, a failed Strength save, a minute at most, a save at each turn end ──
  {
    const state = fight();
    faces = { 20: [15] };
    const struck = hit(state);
    faces = { 20: [5] };
    const landed = settle(act(struck.state, { optionId: "spend:0:1" }));
    assert.equal(harm(landed.events, "Rod of Lordly Might: Paralyze").length, 0, "no amount, no harm");
    const ogre = who(landed.state, "ogre");
    assert.ok(rulesetCombatConditions(definition, ogre).includes("paralyzed"));
    const held = ogre.tracked.find((one) => one.condition === "paralyzed")!;
    assert.equal(held.rounds, 10, "a minute at most");
    assert.deepEqual(held.saveEnds, { save: "str_save", at: "turn-end" });
    assert.equal(held.difficulty, 17);
  }

  // ── Thunder: stunned until the end of its wielder's next turn ──
  {
    const state = fight();
    faces = { 20: [15] };
    const struck = hit(state);
    faces = { 20: [5] };
    const landed = settle(act(struck.state, { optionId: "spend:0:2" }));
    const ogre = who(landed.state, "ogre");
    const held = ogre.tracked.find((one) => one.condition === "stunned")!;
    assert.ok(held, "stunned");
    assert.equal(held.clockOf, "source", "on its wielder's clock");
    assert.equal(held.rounds, 2, "put on in its wielder's own turn, so it runs to the end of the next");
  }

  // ── The Game Master's facts ──
  {
    const facts = rulesetItemFacts(definition, book.itemOf("gear/rod")!.entry.item!);
    const text = rulesetItemAttackText(facts.attack!);
    assert.match(text, /Drain Life: on a hit, one of its 1 use for \+4d6 necrotic/);
    assert.match(text, /Paralyze: on a hit, one of its 1 use, Paralyzed for 10 rounds/);
  }

  // ── Import refusals ──
  {
    refused(
      document((doc) => (spends(doc)[0].charges = 1)),
      /A hit spends "charges" of the item or its own "uses": one of them/,
    );
    refused(
      document((doc) => delete spends(doc)[1].onHit),
      /What it does on a hit is an amount, conditions or both/,
    );
    refused(
      document((doc) => delete spends(doc)[2].onHit[0].rounds),
      /Counted on its wielder's turns, it lasts some "rounds"/,
    );
    refused(
      document((doc) => (spends(doc)[1].save = { save: "con_save", difficulty: 10 })),
      /A save against it or a drain is of its amount, so it has one/,
    );
    refused(
      document((doc) => (spends(doc)[0].save.save = "luck")),
      /Unknown save "luck"/,
    );
    refused(
      document((doc) => (spends(doc)[0].uses.recharge.rests = ["nap"])),
      /Unknown rest "nap"/,
    );
    refused(
      document((doc) => (doc.catalogs.at(-1).entries[0].item.stack = 2)),
      /An item whose hits count their own uses is one to a stack, so its stack is 1/,
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
      "A ruleset with a weapon hit spending its own uses, a save, a drain or only conditions (attack spends uses, save, drain) requires schemaVersion 2 and capabilityApi 1.534 or newer";
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const plain = document((doc) => {
      doc.catalogs.pop();
    });
    assert.notEqual(issue(533, plain), gate, "nothing of 1.534 left");
    assert.equal(issue(533, document()), gate);
    assert.notEqual(issue(534, document()), gate);
    assert.equal(
      issue(
        531,
        plain,
        new Map([["extra.json", [{ id: "x", item: { attack: { spends: [{ label: "x", uses: { max: 1 } }] } } }]]]),
      ),
      gate,
    );
    const charged = [{ label: "x", charges: 1, amount: { dice: "1d6" } }];
    assert.notEqual(
      issue(533, plain, new Map([["extra.json", [{ id: "x", item: { attack: { spends: charged } } }]]])),
      gate,
      "a charge spent for an amount is 1.273's",
    );
  }

  console.log(
    "Ruleset item hit uses: a weapon hit's properties counted on their own uses (Rod of Lordly Might, once a dawn each, kept on the stack and back on a long rest), Drain Life's save, 4d6 necrotic and half back, Paralyze's conditions alone with a minute's cap beside its save, Thunder on its wielder's clock; facts, refusals and the gate at 1.534.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
