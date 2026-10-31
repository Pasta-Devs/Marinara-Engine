/**
 * A Necklace of Prayer Beads' last two pieces.
 *
 *   - A further use that spends another's count (Capability API 1.747): the bead of curing's Lesser
 *     Restoration off the same bead as its Cure Wounds, in a fight and out of one.
 *   - A call rolled among what it reads from a catalog (Capability API 1.748): the bead of summons'
 *     Planar Ally, a celestial, elemental or fiend chosen for its user, never picked by them.
 *   - An item of only further uses, rolled for (Capability API 1.749): no `use` of its own, its menu
 *     only its beads, in a fight and out of one.
 *   - Refusals and the install gates.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetOwnUsesMax,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-prayer-beads-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 749);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const heal = { kind: "heal", budget: "action", targets: "self", amount: { dice: "1d4" } };
  const document = (edit: (item: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "worn", label: "Worn" }] };
    const necklace: Record<string, any> = {
      category: "worn",
      stack: 1,
      use: { label: "Pray", ...heal },
      moreUses: [
        { label: "Cure Wounds", use: { ...heal }, uses: { max: 3, recharge: { rests: ["long"], amount: "max" } } },
        { label: "Lesser Restoration", use: { ...heal }, usesOf: "Cure Wounds" },
        {
          label: "Planar Ally",
          use: {
            kind: "utility",
            budget: "bonus",
            targets: "self",
            calls: {
              from: { catalog: "creatures", filters: { kind: ["Beast", "Undead"] } },
              count: { flat: 1 },
              rolled: true,
            },
          },
          uses: { max: 1 },
        },
      ],
    };
    edit(necklace);
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [{ id: "beads", label: "Necklace of Prayer Beads", item: necklace }],
    });
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
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "gear")!.entries! as RulesetCatalogEntry[];
  const necklace = entries[0]!.item!;
  const bestiary = Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries as RulesetCatalogEntry[]]] : [],
    ),
  );
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 14, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
  });
  const fight = (usesLeft?: Record<string, number>): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 3,
      bestiary,
      combatants: [
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build,
          live: { pools: { hp: { value: 20 } } },
          items: [
            {
              item: necklace,
              quantity: 1,
              name: "Necklace of Prayer Beads",
              worn: true,
              stack: { id: "st-beads", ref: "gear/beads" },
              ...(usesLeft ? { usesLeft } : {}),
            } as RulesetSheetItem,
          ],
        },
        {
          id: "wolf",
          name: "Wolf",
          side: "enemy",
          block: {
            health: 20,
            defense: 12,
            initiativeModifier: 0,
            speed: 40,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["cleric", "wolf"];
    state.turn = 0;
    return state;
  };
  const choose = (state: RulesetEncounterState, label: RegExp, d = 3) => {
    const working = structuredClone(state);
    const cleric = rulesetCombatant(working, "cleric")!;
    cleric.budgets.action = 1;
    cleric.budgets.bonus = 1;
    const offered = rulesetCombatOptions(definition, working, "cleric");
    const option = offered.find((one) => label.test(one.label));
    assert.ok(option, `${label} among ${offered.map((one) => one.label).join(", ")}`);
    return applyRulesetCombatChoice(
      definition,
      working,
      { actorId: "cleric", optionId: option.id, targetIds: ["cleric"] },
      () => d,
    );
  };
  const offered = (state: RulesetEncounterState, label: RegExp) => {
    const working = structuredClone(state);
    const cleric = rulesetCombatant(working, "cleric")!;
    cleric.budgets.action = 1;
    cleric.budgets.bonus = 1;
    return rulesetCombatOptions(definition, working, "cleric").some((one) => label.test(one.label));
  };

  // ── In a fight: one bead's count, spent by either spell ──
  {
    const actions = rulesetCombatant(fight(), "cleric")!.actions;
    assert.deepEqual(actions.find((one) => one.id === "use:0:2")?.itemUse?.ownUses, { more: 1, max: 3 });
    let state = choose(fight(), /Lesser Restoration/).state;
    assert.equal(rulesetCombatant(state, "cleric")!.usesLeft?.["0:1"], 2, "Lesser Restoration spent a bead");
    state = choose(state, /Cure Wounds/).state;
    assert.equal(rulesetCombatant(state, "cleric")!.usesLeft?.["0:1"], 1);
    // None left: neither is offered.
    const spent = fight({ "1": 0 });
    assert.equal(offered(spent, /Cure Wounds/), false);
    assert.equal(offered(spent, /Lesser Restoration/), false);
  }

  // ── Outside a fight, the same count ──
  {
    const book = rulesetItemBook(definition, { gear: entries });
    const stacks: GameInventoryStack[] = [
      {
        id: "st-beads",
        name: "Necklace of Prayer Beads",
        item: "gear/beads",
        quantity: 1,
        equipped: true,
        usesLeft: { "1": 1 },
      },
    ];
    const use = (more: number, from = stacks) =>
      useRulesetItemOutsideFight({
        definition,
        itemOf: book.itemOf,
        stacks: from,
        stackId: "st-beads",
        user: { name: "Cleric", build, live: {} },
        roll: () => 2,
        more,
      });
    const used = use(2);
    assert.ok(used.ok, used.ok ? "" : used.reason);
    assert.deepEqual(used.stacks[0]!.usesLeft, { "1": 0 });
    const again = use(1, used.stacks);
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.reason, "none-left");
    assert.equal(rulesetOwnUsesMax(necklace.moreUses![0]!.uses!, "st-beads", 1), 3);
  }

  // ── Planar Ally: one of what it reads, chosen for its user, never offered as a pick ──
  {
    const labels = (state: RulesetEncounterState) => {
      const working = structuredClone(state);
      rulesetCombatant(working, "cleric")!.budgets.bonus = 1;
      return rulesetCombatOptions(definition, working, "cleric")
        .filter((one) => /Planar Ally/.test(one.label))
        .map((one) => one.label);
    };
    assert.equal(labels(fight()).length, 1, "one choice, not one per creature");
    const kinds = new Set<string>();
    for (const face of [1, 2, 3, 5, 8, 13, 20, 50, 99]) {
      const step = choose(fight(), /Planar Ally/, face);
      const called = step.events.find((one) => one.type === "called");
      assert.ok(called && called.type === "called" && called.ids.length === 1, JSON.stringify(step.events));
      const ally = rulesetCombatant(step.state, called.ids[0]!)!;
      assert.equal(ally.side, "party");
      assert.ok(["cinder-hound", "grave-piper"].includes(ally.creature!.entryId), ally.creature!.entryId);
      kinds.add(ally.creature!.entryId);
    }
    assert.equal(kinds.size, 2, "either may come");
  }

  // ── Only further uses, rolled for: no use of its own ──
  const beadsOnly = (item: Record<string, any>) => {
    delete item.use;
    item.moreUsesRolled = { dice: "1d4+2", weights: [6, 0, 1] };
  };
  {
    const bare = parsed(document(beadsOnly));
    const item = bare.catalogs!.find((catalog) => catalog.id === "gear")!.entries![0]!.item!;
    const state = createRulesetEncounter({
      definition: bare,
      seed: 1,
      roller: () => 3,
      bestiary,
      combatants: [
        {
          id: "cleric",
          name: "Cleric",
          side: "party",
          build,
          live: {},
          items: [
            {
              item,
              quantity: 1,
              name: "Necklace of Prayer Beads",
              worn: true,
              stack: { id: "st-beads", ref: "gear/beads" },
            } as RulesetSheetItem,
          ],
        },
      ],
    });
    const ids = rulesetCombatant(state, "cleric")!.actions.flatMap((one) => (one.itemUse ? [one.id] : []));
    assert.ok(!ids.includes("use:0"), "no use of its own");
    assert.ok(ids.includes("use:0:1") && ids.includes("use:0:2"), ids.join(", "));
    const book = rulesetItemBook(bare, {
      gear: bare.catalogs!.find((catalog) => catalog.id === "gear")!.entries! as RulesetCatalogEntry[],
    });
    const stacks: GameInventoryStack[] = [
      { id: "st-beads", name: "Necklace of Prayer Beads", item: "gear/beads", quantity: 1, equipped: true },
    ];
    const cures = rulesetOwnUsesMax(item.moreUses![0]!.uses!, "st-beads", 1, item.moreUsesRolled);
    const outside = (more?: number) =>
      useRulesetItemOutsideFight({
        definition: bare,
        itemOf: book.itemOf,
        stacks,
        stackId: "st-beads",
        user: { name: "Cleric", build, live: {} },
        roll: () => 2,
        ...(more !== undefined ? { more } : {}),
      });
    const plain = outside();
    assert.equal(plain.ok, false, "nothing to use but its beads");
    const cure = outside(1);
    assert.equal(cure.ok, cures > 0, cure.ok ? "" : cure.reason);
  }
  refused(
    document((item) => delete item.use),
    /More uses go beside a "use", or are rolled for/,
  );

  // ── Refusals ──
  refused(
    document((item) => (item.moreUses[1].usesOf = "Nothing")),
    /No further use "Nothing" that counts its own uses/,
  );
  refused(
    document((item) => (item.moreUses[1].uses = { max: 1 })),
    /A further use counts its own uses or spends another's, not both/,
  );
  refused(
    document((item) => (item.moreUses[1].usesOf = "Lesser Restoration")),
    /No further use "Lesser Restoration" that counts its own uses/,
  );
  parsed(document((item) => (item.moreUsesRolled = { dice: "1d4+2", weights: [6, 0, 1] })));
  refused(
    document((item) => (item.moreUsesRolled = { dice: "1d4+2", weights: [6, 6, 1] })),
    /one spending another's weighs 0/,
  );

  // ── The install gates ──
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
  const rolledGate =
    "A ruleset with a call rolled among what it reads from a catalog (calls.rolled with calls.from) requires schemaVersion 2 and capabilityApi 1.748 or newer";
  const usesOfGate =
    "A ruleset with a further use that spends another's count (moreUses[].usesOf) requires schemaVersion 2 and capabilityApi 1.747 or newer";
  const onlyGate =
    "A ruleset with an item of only further uses, rolled for (moreUses with moreUsesRolled and no use), requires schemaVersion 2 and capabilityApi 1.749 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(748) as never, document(beadsOnly)), onlyGate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(749) as never, document(beadsOnly)), onlyGate);
  assert.equal(getCapabilityPackageInstallIssue(manifest(747) as never, document()), rolledGate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(748) as never, document()), rolledGate);
  const noAlly = document((item) => item.moreUses.splice(2, 1));
  assert.equal(getCapabilityPackageInstallIssue(manifest(746) as never, noAlly), usesOfGate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(747) as never, noAlly), usesOfGate);

  console.log(
    "Prayer beads: Lesser Restoration spends the curing bead's count with Cure Wounds, in a fight and out; Planar Ally's creature chosen among what it reads; a necklace of only beads; refusals and the gates at 1.747, 1.748 and 1.749.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
