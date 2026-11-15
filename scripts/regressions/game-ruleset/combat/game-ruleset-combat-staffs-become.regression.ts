/**
 * An item that becomes another on its last charge (Capability API 1.272).
 *
 *   - `charges.breaksOn.becomes`: on the faces that would break it, a Staff of Striking becomes a
 *     plain quarterstaff instead: in a fight its uses go and it strikes as the quarterstaff from
 *     then on, and the fight writes the stack back as that item; outside a fight, and as the
 *     inventory spends a charge, the same.
 *   - The Game Master's facts say so; import refusals, the install check and the gate.
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
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetFightItemChanges,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemUseLine,
  rulesetItemUseText,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-staffs-become-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 267);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = { categories: [{ id: "staff", label: "Staff" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        {
          id: "striking",
          label: "Staff of Striking",
          item: {
            category: "staff",
            slots: { hands: 1 },
            stack: 1,
            charges: { max: 10, breaksOn: { die: 20, atMost: 1, becomes: "gear/quarterstaff" } },
            attack: { budget: "action", toHit: { bonus: 3 }, damage: { dice: "1d6", bonus: 3 } },
            use: {
              kind: "attack",
              budget: "action",
              range: 60,
              attackRoll: true,
              toHit: { bonus: 3 },
              amount: { dice: "3d6" },
              damageType: "force",
              charges: 3,
            },
          },
        },
        {
          id: "quarterstaff",
          label: "Quarterstaff",
          item: {
            category: "staff",
            slots: { hands: 1 },
            stack: 1,
            attack: { budget: "action", toHit: { bonus: 0 }, damage: { dice: "1d6" } },
          },
        },
      ],
    });
    edit(doc);
    return doc;
  };
  const striking = (doc: Record<string, any>) => doc.catalogs.at(-1).entries[0].item;
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
  const staffItem = book.itemOf("gear/striking")!.entry.item!;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
    lists: {},
  });
  const foe = (): RulesetStatBlock => ({
    health: 200,
    defense: 1,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
  });
  let faces: Record<number, number[]> = {};
  const roll = (sides: number) => faces[sides]?.shift() ?? (sides === 20 ? 10 : 1);
  const fight = (charges = 3): RulesetEncounterState => {
    faces = {};
    const held = {
      item: staffItem,
      quantity: 1,
      name: "Staff of Striking",
      worn: true,
      charges,
      stack: { id: "st", ref: "gear/striking" },
    } as RulesetSheetItem;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, items: [held], catalogs: entriesOf(definition) },
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
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const done = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const stacks = (charges = 3): GameInventoryStack[] => [
    { id: "st", name: "Staff of Striking", item: "gear/striking", quantity: 1, equipped: true, charges },
  ];

  // ── In a fight: a 1 on its last charge, and it is a quarterstaff ──
  {
    const state = fight();
    const ids = (one: RulesetEncounterState) => who(one, "hero").actions.map((action) => action.id);
    assert.ok(ids(state).includes("use:0"));
    assert.equal(who(state, "hero").actions.find((one) => one.id === "item:0")?.toHit, 3);
    faces = { 20: [1, 15] };
    const done = act(state, { actorId: "hero", optionId: "use:0", targetIds: ["ogre"] });
    assert.deepEqual(of(done.events, "broke"), [
      {
        type: "broke",
        actorId: "hero",
        optionId: "use:0",
        label: "Staff of Striking",
        roll: 1,
        becomes: "Quarterstaff",
      },
    ]);
    const hero = who(done.state, "hero");
    assert.ok(!ids(done.state).includes("use:0"), "its uses are gone");
    const strike = hero.actions.find((one) => one.id === "item:0")!;
    assert.deepEqual([strike.label, strike.toHit, strike.damage?.flat], ["Quarterstaff", 0, 0], "a plain staff now");
    assert.equal(hero.sheet?.items?.[0]?.name, "Quarterstaff");
    assert.equal(hero.sheet?.items?.[0]?.charges, undefined);
    assert.deepEqual(hero.became, { 0: "gear/quarterstaff" });
    assert.equal(hero.broken, undefined, "not broken");
    // Written back as that item.
    const changes = rulesetFightItemChanges(undefined, done.state);
    assert.deepEqual(
      changes.map((one) => one.becomes),
      [{ ref: "gear/quarterstaff", name: "Quarterstaff" }],
    );
    const written = applyRulesetFightItemChanges(stacks(), changes)!;
    assert.deepEqual(written.stacks, [
      { id: "st", name: "Quarterstaff", item: "gear/quarterstaff", quantity: 1, equipped: true },
    ]);
    assert.deepEqual(written.journal, [
      { item: "Staff of Striking", action: "lost", quantity: 1 },
      { item: "Quarterstaff", action: "acquired", quantity: 1 },
    ]);
    // A later step writes nothing more for it.
    assert.deepEqual(rulesetFightItemChanges(done.state, done.state), []);
    // A later step that changes it names the stack by what it became, which the stack now holds.
    const later = structuredClone(done.state);
    who(later, "hero").on = { 0: true };
    const after = rulesetFightItemChanges(done.state, later);
    assert.deepEqual(
      after.map((one) => one.stack.ref),
      ["gear/quarterstaff"],
    );
    assert.ok(applyRulesetFightItemChanges(written.stacks, after), "applied to the quarterstaff's stack");
    // Any other face, it holds, empty.
    const state2 = fight();
    faces = { 20: [5, 15] };
    const kept = act(state2, { actorId: "hero", optionId: "use:0", targetIds: ["ogre"] });
    assert.equal(of(kept.events, "broke").length, 0);
    assert.ok(ids(kept.state).includes("use:0"));
    assert.equal(who(kept.state, "hero").charges?.[0], 0);
  }

  // ── Outside a fight, and as the inventory spends a charge ──
  {
    const used = useRulesetItemOutsideFight({
      definition,
      itemOf: book.itemOf,
      stacks: stacks(),
      stackId: "st",
      user: { name: "Ada", build, live: {} },
      roll: () => 1,
    });
    assert.ok(used.ok, JSON.stringify(used));
    if (used.ok) {
      assert.deepEqual(used.said.becomes, { name: "Quarterstaff", roll: 1 });
      assert.equal(used.said.broke, undefined);
      assert.deepEqual(used.stacks, [
        { id: "st", name: "Quarterstaff", item: "gear/quarterstaff", quantity: 1, equipped: true },
      ]);
      assert.match(
        rulesetItemUseLine(used.said),
        /Its last charge spent, it becomes Quarterstaff \(a 1 on its die\)\.$/,
      );
    }
    const charged = applyGameInventoryOps(
      stacks(3),
      [{ op: "charge", name: "Staff of Striking", count: 1 }],
      undefined,
      book,
      () => 1,
    );
    assert.deepEqual(charged.stacks, [
      { id: "st", name: "Quarterstaff", item: "gear/quarterstaff", quantity: 1, equipped: true },
    ]);
    assert.deepEqual(charged.results, [{ ok: true, count: 1 }], "not broken");
    assert.deepEqual(charged.journal, [
      { item: "Staff of Striking", action: "lost", quantity: 1 },
      { item: "Quarterstaff", action: "acquired", quantity: 1 },
      { item: "Staff of Striking", action: "used", quantity: 1 },
    ]);
    // The Game Master is told.
    assert.match(
      rulesetItemUseText(rulesetItemFacts(definition, staffItem).use!),
      /becomes Quarterstaff on a 1 on a d20 when emptied/,
    );
  }

  // ── Import ──
  {
    refused(
      document(
        (doc) =>
          (striking(doc).charges.breaksOn = {
            die: 20,
            becomes: "gear/quarterstaff",
            regains: { atLeast: 20, amount: { flat: 1 } },
          }),
      ),
      /"becomes" goes with "atMost"/,
    );
    refused(
      document((doc) => (striking(doc).charges.breaksOn.becomes = "gear/broom")),
      /Unknown item "gear\/broom"/,
    );
    refused(
      document((doc) => (striking(doc).charges.breaksOn.becomes = "gear/striking")),
      /An item becomes another item/,
    );
    refused(
      document((doc) => (striking(doc).charges.breaksOn.becomes = "Quarterstaff")),
      /<catalog>\/<entry>/,
    );
  }

  // ── The install check and gate ──
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
      "A ruleset with an item that becomes another when its last charge is spent requires schemaVersion 2 and capabilityApi 1.272 or newer";
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const plain = document((doc) => delete striking(doc).charges.breaksOn.becomes);
    assert.notEqual(issue(271, plain), gate, "nothing of 1.272 left");
    assert.equal(issue(271, document()), gate);
    assert.notEqual(issue(272, document()), gate);
    assert.equal(
      issue(271, plain, new Map([["extra.json", [{ id: "x", item: { charges: { breaksOn: { becomes: "a/b" } } } }]]])),
      gate,
    );
    assert.equal(
      issue(
        272,
        document((doc) => (striking(doc).charges.breaksOn.becomes = "gear/broom")),
      ),
      'The item "gear/striking" cannot become "gear/broom": it is no other item of this ruleset',
    );
  }

  console.log(
    "Ruleset staffs become: on its last charge's 1 a Staff of Striking becomes a plain quarterstaff, in a fight (its uses gone, struck as the quarterstaff, written back as it), outside one and in the inventory; gated at 1.272.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
