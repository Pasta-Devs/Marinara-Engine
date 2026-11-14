/**
 * More of what staffs and rings do (Capability API 1.271).
 *
 *   - `use.label`: an item's first use is named on the menu as its `moreUses` are.
 *   - `use.amountAdd`: a Staff of Healing's Cure Wounds plus its holder's spellcasting modifier, in a
 *     fight and outside one.
 *   - `chargeStep.push`: a Ring of the Ram pushes 5 feet farther for each charge more.
 *   - `charges.breaksOn.regains`: the last charge's die gives charges back on a 20 (a Staff of the
 *     Magi's 1d12 + 1), in a fight, outside one, and as the inventory spends a charge; `atMost` is
 *     optional beside it.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyGameInventoryOps,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetItemUseLine,
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-staffs-more-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 266);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const staffItem = () => ({
    category: "staff",
    stack: 1,
    charges: { max: 10, breaksOn: { die: 20, atMost: 1, regains: { atLeast: 20, amount: { dice: "1d12", flat: 1 } } } },
    use: {
      label: "Fireball",
      kind: "attack",
      budget: "action",
      range: 150,
      amount: { dice: "8d6" },
      damageType: "fire",
      save: { save: "dex_save", onSuccess: "half" },
      sheetDifficulty: { derived: "spell_save_dc" },
      charges: 3,
    },
    moreUses: [
      {
        label: "Cure Wounds",
        use: {
          kind: "heal",
          budget: "action",
          targets: "ally",
          amount: { dice: "1d8" },
          amountAdd: { abilityModFromField: "spellcasting_ability" },
          charges: 1,
        },
      },
    ],
  });
  const ringItem = () => ({
    category: "ring",
    stack: 1,
    charges: { max: 3 },
    use: {
      kind: "attack",
      budget: "action",
      range: 60,
      attackRoll: true,
      toHit: { bonus: 7 },
      amount: { dice: "2d10" },
      damageType: "force",
      push: 5,
      charges: 1,
      chargeStep: { max: 2, amount: { dice: "2d10" }, push: 5 },
    },
  });
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = {
      categories: [
        { id: "staff", label: "Staff" },
        { id: "ring", label: "Ring" },
      ],
    };
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        { id: "staff", label: "Staff", item: staffItem() },
        { id: "ring", label: "Ring", item: ringItem() },
        {
          id: "healing",
          label: "Staff of Healing",
          item: {
            category: "staff",
            stack: 1,
            charges: { max: 10 },
            use: {
              label: "Cure Wounds",
              kind: "heal",
              budget: "action",
              amount: { dice: "1d8" },
              amountAdd: { abilityModFromField: "spellcasting_ability" },
              charges: 1,
            },
          },
        },
      ],
    });
    edit(doc);
    return doc;
  };
  const gearOf = (doc: Record<string, any>, id: string) =>
    doc.catalogs.at(-1).entries.find((entry: { id: string }) => entry.id === id).item;
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
  const held = (ref: string, name: string, charges?: number) =>
    ({
      item: book.itemOf(ref)!.entry.item!,
      quantity: 1,
      name,
      worn: true,
      ...(charges !== undefined ? { charges } : {}),
    }) as RulesetSheetItem;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "wis" },
    lists: {},
  });
  const foe = (): RulesetStatBlock => ({
    health: 200,
    defense: 1,
    initiativeModifier: 0,
    speed: 30,
    saves: { dex_save: -20 },
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
  });
  // Faces by die size; 1 for anything not queued, and 10 on a d20.
  let faces: Record<number, number[]> = {};
  const roll = (sides: number) => faces[sides]?.shift() ?? (sides === 20 ? 10 : 1);
  const width = 20;
  const fight = (items: RulesetSheetItem[]): RulesetEncounterState => {
    faces = {};
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, items },
        { id: "friend", name: "Friend", side: "party", build, live: {} },
        { id: "ogre", name: "Ogre", side: "enemy", block: foe() },
      ],
      board: {
        grid: {
          width,
          height: 1,
          tiles: [Array(width).fill("plains")],
          elevation: [Array(width).fill(0)],
        } as never,
        placements: { hero: { x: 0, y: 0 }, friend: { x: 1, y: 0 }, ogre: { x: 3, y: 0 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
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

  // ── The first use named, as the others are ──
  {
    const state = fight([held("gear/staff", "Staff")]);
    const labels = rulesetCombatOptions(definition, state, "hero")
      .filter((one) => one.id.startsWith("use:0"))
      .map((one) => [one.id, one.label]);
    assert.deepEqual(labels, [
      ["use:0", "Staff: Fireball"],
      ["use:0:1", "Staff: Cure Wounds"],
    ]);
    // Unnamed, it is the item's own name.
    const plain = parsed(document((doc) => delete gearOf(doc, "staff").use.label));
    const plainItem = rulesetItemBook(plain, entriesOf(plain)).itemOf("gear/staff")!.entry.item!;
    const unnamed = createRulesetEncounter({
      definition: plain,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build,
          live: {},
          items: [{ item: plainItem, quantity: 1, name: "Staff" }],
        },
        { id: "ogre", name: "Ogre", side: "enemy", block: foe() },
      ],
    });
    assert.equal(unnamed.combatants[0]!.actions.find((one) => one.id === "use:0")?.label, "Staff");
  }

  // ── Cure Wounds plus the holder's spellcasting modifier ──
  {
    const state = fight([held("gear/staff", "Staff")]);
    const cure = who(state, "hero").actions.find((one) => one.id === "use:0:1")!;
    assert.deepEqual(cure.heal, { count: 1, sides: 8, flat: 3 }, "1d8 + Wisdom's 3");
    const healed = act(state, { actorId: "hero", optionId: "use:0:1", targetIds: ["friend"] });
    const heal = of(healed.events, "heal")[0]!;
    assert.deepEqual([heal.rolls, heal.flat], [[1], 3]);
    // Outside a fight, the same.
    const stacks: GameInventoryStack[] = [
      { id: "st", name: "Staff of Healing", item: "gear/healing", quantity: 1, equipped: true },
    ];
    const used = useRulesetItemOutsideFight({
      definition,
      itemOf: book.itemOf,
      stacks,
      stackId: "st",
      user: { name: "Ada", build, live: { pools: { hp: 20 } } },
      roll: () => 1,
    });
    assert.ok(used.ok, JSON.stringify(used));
    if (used.ok) {
      const part = used.said.parts.find((one) => one.kind === "heal");
      assert.equal(part?.amount, 4, "1 + 3");
    }
  }

  // ── The ram: 5 feet farther for each charge more ──
  {
    const pushedTo = (payWith?: string) => {
      const state = fight([held("gear/ring", "Ring")]);
      const done = act(state, {
        actorId: "hero",
        optionId: "use:0",
        targetIds: ["ogre"],
        ...(payWith ? { payWith } : {}),
      });
      return [who(done.state, "ogre").x, who(done.state, "hero").charges?.[0]];
    };
    assert.deepEqual(pushedTo(), [4, 2], "5 feet");
    assert.deepEqual(pushedTo("charges:1"), [5, 1], "10 feet for a charge more");
    assert.deepEqual(pushedTo("charges:2"), [6, 0], "15 feet for two");
  }

  // ── The last charge's die: a 20 gives 1d12 + 1 back, a 1 breaks it, anything else neither ──
  {
    const lastOf = (face: number) => {
      const state = fight([held("gear/staff", "Staff", 3)]);
      faces = { 20: [face, 10], 12: [5] };
      return act(state, { actorId: "hero", optionId: "use:0", targetIds: ["ogre"] });
    };
    const back = lastOf(20);
    assert.deepEqual(of(back.events, "recharged"), [
      {
        type: "recharged",
        actorId: "hero",
        optionId: "use:0",
        label: "Staff: Fireball",
        roll: 20,
        rolls: [5],
        amount: 6,
      },
    ]);
    assert.equal(who(back.state, "hero").charges?.[0], 6);
    assert.ok(!who(back.state, "hero").broken?.[0]);
    const cracked = lastOf(1);
    assert.equal(of(cracked.events, "broke").length, 1);
    assert.equal(of(cracked.events, "recharged").length, 0);
    const neither = lastOf(12);
    assert.deepEqual([of(neither.events, "broke").length, of(neither.events, "recharged").length], [0, 0]);
    assert.equal(who(neither.state, "hero").charges?.[0], 0);
    // Without a break, a 1 does nothing.
    const unbreakable = parsed(document((doc) => delete gearOf(doc, "staff").charges.breaksOn.atMost));
    const tough = rulesetItemBook(unbreakable, entriesOf(unbreakable)).itemOf("gear/staff")!.entry.item!;
    const state = createRulesetEncounter({
      definition: unbreakable,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build,
          live: {},
          items: [{ item: tough, quantity: 1, name: "Staff", charges: 3 }],
        },
        { id: "ogre", name: "Ogre", side: "enemy", block: foe() },
      ],
    });
    state.order = ["hero", "ogre"];
    state.turn = 0;
    faces = { 20: [1, 10] };
    const kept = applyRulesetCombatChoice(
      unbreakable,
      state,
      { actorId: "hero", optionId: "use:0", targetIds: ["ogre"] },
      roll,
    );
    assert.equal(of(kept.events, "broke").length, 0);

    // Outside a fight.
    const stacks: GameInventoryStack[] = [
      { id: "st", name: "Staff", item: "gear/staff", quantity: 1, equipped: true, charges: 3 },
    ];
    let at = 0;
    const outFaces = [20, 5];
    const used = useRulesetItemOutsideFight({
      definition,
      itemOf: book.itemOf,
      stacks,
      stackId: "st",
      user: { name: "Ada", build, live: {} },
      roll: () => outFaces[at++] ?? 1,
    });
    assert.ok(used.ok, JSON.stringify(used));
    if (used.ok) {
      assert.deepEqual(used.said.recharged, { roll: 20, amount: 6 });
      assert.equal(used.stacks[0]?.charges, 6);
      assert.match(rulesetItemUseLine(used.said), /Its last charge spent, it gets 6 back \(a 20 on its die\)\.$/);
    }

    // As the inventory spends a charge.
    const charge = (dice: number[]) => {
      let i = 0;
      return applyGameInventoryOps(
        [{ id: "st", name: "Staff", item: "gear/staff", quantity: 1, equipped: true, charges: 3 }],
        [{ op: "charge", name: "Staff", count: 1 }],
        undefined,
        book,
        () => dice[i++] ?? 1,
      );
    };
    assert.deepEqual(
      charge([20, 5]).stacks.map((stack) => stack.charges),
      [6],
    );
    assert.deepEqual(charge([1]).stacks, [], "a 1 breaks it");
    assert.deepEqual(
      charge([12]).stacks.map((stack) => stack.charges),
      [0],
    );
  }

  // ── Import ──
  {
    parsed(document((doc) => (gearOf(doc, "ring").use.chargeStep = { max: 2, push: 5 })));
    refused(
      document((doc) => delete gearOf(doc, "ring").use.amount && (gearOf(doc, "ring").use.amountAdd = { const: 1 })),
      /amountAdd adds to an amount/,
    );
    refused(
      document((doc) => (gearOf(doc, "staff").moreUses[0].use.amountAdd = { derived: "nonsense" })),
      /nonsense/,
    );
    refused(
      document((doc) => (gearOf(doc, "staff").moreUses[0].use.label = "Cure")),
      /A further use is named by its own label/,
    );
    refused(
      document((doc) => (gearOf(doc, "ring").use.chargeStep = { max: 2 })),
      /A charge more adds an amount, targets, a push, or some of them/,
    );
    refused(
      document((doc) => (gearOf(doc, "ring").use.chargeStep.push = 0)),
      /push/,
    );
    refused(
      document((doc) => (gearOf(doc, "staff").charges.breaksOn = { die: 20 })),
      /breaks the item \("atMost"\), gives charges back \("regains"\), or both/,
    );
    refused(
      document((doc) => (gearOf(doc, "staff").charges.breaksOn.regains.atLeast = 1)),
      /above any that break it/,
    );
    refused(
      document((doc) => (gearOf(doc, "staff").charges.breaksOn.regains.atLeast = 21)),
      /above any that break it/,
    );
    refused(
      document((doc) => (gearOf(doc, "staff").charges.breaksOn.regains.amount = {})),
      /Charges given back say how many/,
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
      "A ruleset with an item whose first use is named, an item use adding a value off its holder's sheet, more charges that push farther, or a last charge's die that gives charges back, requires schemaVersion 2 and capabilityApi 1.271 or newer";
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const only = (keep: (doc: Record<string, any>) => void) =>
      document((doc) => {
        const staff = gearOf(doc, "staff");
        delete staff.use.label;
        delete staff.moreUses[0].use.amountAdd;
        delete staff.charges.breaksOn.regains;
        delete gearOf(doc, "ring").use.chargeStep.push;
        doc.catalogs.at(-1).entries.pop();
        keep(doc);
      });
    assert.notEqual(
      issue(
        270,
        only(() => {}),
      ),
      gate,
      "nothing of 1.271 left",
    );
    const cases: Array<[string, (doc: Record<string, any>) => void]> = [
      ["label", (doc) => (gearOf(doc, "staff").use.label = "Fireball")],
      [
        "amountAdd",
        (doc) => (gearOf(doc, "staff").moreUses[0].use.amountAdd = { abilityModFromField: "spellcasting_ability" }),
      ],
      ["push", (doc) => (gearOf(doc, "ring").use.chargeStep.push = 5)],
      [
        "regains",
        (doc) => (gearOf(doc, "staff").charges.breaksOn.regains = { atLeast: 20, amount: { dice: "1d12", flat: 1 } }),
      ],
      [
        "no atMost",
        (doc) => (gearOf(doc, "staff").charges.breaksOn = { die: 20, regains: { atLeast: 20, amount: { flat: 1 } } }),
      ],
    ];
    for (const [name, keep] of cases) {
      const doc = only(keep);
      parsed(doc);
      assert.equal(issue(270, doc), gate, name);
      assert.notEqual(issue(271, doc), gate, name);
    }
    assert.equal(
      issue(
        270,
        only(() => {}),
        new Map([["extra.json", [{ id: "x", item: { category: "staff", use: { kind: "heal", label: "Cure" } } }]]]),
      ),
      gate,
    );
  }

  console.log(
    "Ruleset staffs more: an item's first use is named on the menu, a Staff of Healing adds its holder's spellcasting modifier, a Ring of the Ram pushes 5 feet farther a charge, and a last charge's 20 gives 1d12 + 1 charges back in a fight, outside one and in the inventory; gated at 1.271.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
