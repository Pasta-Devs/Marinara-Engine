/**
 * What a creature has on it as a fight begins (Capability API 1.795, Alyssa 2026-10-24).
 *
 *   - A bestiary creature's `inventory` lines, each rolled for once: an item of the ruleset's or a
 *     loot table's picks, `chance` in a hundred and `count` of it.
 *   - What the Game Master gives an opponent (`carrying`) takes the place of those lines, and an
 *     empty list is nothing at all; a name the ruleset has no item of is told.
 *   - A plain stat block uses what is used up in the using and reads nothing of its user (a
 *     poultice), as many times as it has it; a sheet-backed one uses its items as a party member
 *     does. What is left is what drops, and the foe's card says what it has.
 *   - Refused for an unknown table, and gated at 1.795.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rollRulesetCreatureInventory,
  rulesetCarriedLeft,
  rulesetCombatant,
  rulesetEncounterSummary,
  rulesetItemBook,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-inventory-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const {
  commandRulesetCombatDirector,
  createRulesetFight,
  directedRulesetView,
  rulesetDirectorStage,
  syncRulesetCombatants,
} = await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const emberText = readFileSync(
    fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  const ember = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(emberText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const creatureOf = (doc: Record<string, any>, id: string) =>
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.find((entry: { id: string }) => entry.id === id).creature;
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const doc = ember((one) => {
    creatureOf(one, "rust-jackal").inventory = [{ item: "outfitter/poultice", count: 2 }];
    creatureOf(one, "toll-warden").inventory = [{ item: "outfitter/poultice" }];
  });
  const definition = parsed(doc);
  const entries: Record<string, RulesetCatalogEntry[]> = Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
    ),
  );
  const book = rulesetItemBook(definition, entries);
  const bestiaryId = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
  const bestiary = { [bestiaryId]: entries[bestiaryId]! };

  // ── Rolled for, line by line ──
  {
    const at = (face: number) => () => face;
    const lines = [
      { item: "outfitter/poultice", chance: 40, count: 1 },
      { item: "outfitter/poultice", chance: 60, count: "1d4" },
    ];
    // A 50 misses the 40 line and makes the 60 one, whose 1d4 then reads 50 on a four-sided die: held
    // to what a stack may hold, as a table's picks are.
    const had = rollRulesetCreatureInventory(definition, book, lines, (sides) => Math.min(sides, 50));
    assert.deepEqual(
      had.map((one) => one.item),
      ["outfitter/poultice"],
    );
    assert.equal(rollRulesetCreatureInventory(definition, book, lines, at(100)).length, 0, "a 100 makes neither");
    assert.equal(
      rollRulesetCreatureInventory(definition, book, [{ item: "outfitter/poultice" }], at(100))[0]?.count,
      1,
      "a line with no chance is always had",
    );
    assert.equal(
      rollRulesetCreatureInventory(definition, book, [{ item: "outfitter/nothing-here" }], at(1)).length,
      0,
      "an item the ruleset does not have is not had",
    );
  }

  const begin = (enemies: Array<{ id: string; creature: string; items?: string[] }>) => {
    const built = createRulesetFight({
      definition,
      seed: 4,
      party: [{ id: "ada", name: "Ada" }],
      enemies: enemies.map((one) => ({ name: one.id, ...one })),
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
      playerName: null,
      live: {},
      items: () => [],
      itemBook: book,
      partyCatalogs: {},
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    return (built as { fight: any }).fight;
  };

  // ── What it begins with ──
  {
    const fight = begin([
      { id: "jackal", creature: `${bestiaryId}/rust-jackal` },
      { id: "warden", creature: `${bestiaryId}/toll-warden` },
      { id: "moth", creature: `${bestiaryId}/cinder-moth` },
    ]);
    const jackal = rulesetCombatant(fight.encounter, "jackal")!;
    assert.deepEqual(jackal.carried, [{ ref: "outfitter/poultice", name: "Poultice", count: 2 }]);
    const use = jackal.actions.find((action) => action.id === "carried:0");
    assert.ok(use, `a plain block has its poultice to use: ${jackal.actions.map((one) => one.id).join(", ")}`);
    assert.ok(use!.heal, `it heals: ${JSON.stringify(use)}`);
    assert.equal(jackal.uses["carried:0"], 2, "as many times as it has it");
    const warden = rulesetCombatant(fight.encounter, "warden")!;
    assert.ok(warden.sheet?.items?.length, "a sheet-backed one holds it as a party member does");
    assert.ok(warden.actions.some((action) => action.id === "use:0" && action.itemUse?.consumes));
    assert.equal(rulesetCombatant(fight.encounter, "moth")!.carried, undefined, "one with no lines has nothing");
    assert.deepEqual(rulesetCarriedLeft(jackal), [{ ref: "outfitter/poultice", name: "Poultice", count: 2 }]);
    jackal.uses["carried:0"] = 1;
    assert.deepEqual(rulesetCarriedLeft(jackal), [{ ref: "outfitter/poultice", name: "Poultice", count: 1 }]);
    warden.itemsUsed = { 0: 1 };
    assert.deepEqual(rulesetCarriedLeft(warden), [], "one used up leaves nothing to drop");
  }

  // ── What the Game Master gives it ──
  {
    const fight = begin([
      { id: "jackal", creature: `${bestiaryId}/rust-jackal`, items: ["poultice", "Poultice", "a dragon's hoard"] },
      { id: "bare", creature: `${bestiaryId}/rust-jackal`, items: [] },
    ]);
    assert.deepEqual(rulesetCombatant(fight.encounter, "jackal")!.carried, [
      { ref: "outfitter/poultice", name: "Poultice", count: 2 },
    ]);
    assert.ok(
      fight.adjustments.some((line: string) => line.includes(`"a dragon's hoard"`)),
      `a name it has no item of is told: ${fight.adjustments.join(" | ")}`,
    );
    assert.equal(rulesetCombatant(fight.encounter, "bare")!.carried, undefined, "an empty list is nothing at all");
    // Counted after its name, many of it, and in other words (laptop playtest 2026-10-25: "Heavy
    // Crossbow" given for 5e's "Crossbow, heavy" was no item).
    for (const line of ["Poultices (2)", "poultice x2", "2 Poultices"]) {
      const given = begin([{ id: "jackal", creature: `${bestiaryId}/rust-jackal`, items: [line] }]);
      assert.deepEqual(
        rulesetCombatant(given.encounter, "jackal")!.carried,
        [{ ref: "outfitter/poultice", name: "Poultice", count: 2 }],
        `${line}: ${given.adjustments.join(" | ")}`,
      );
    }
  }

  // ── Coins the Game Master gives it, with how many (laptop playtest 2026-10-25: a thief's stolen 9 gp,
  //    "no item called gold pieces") ──
  {
    const fight = begin([
      { id: "thief", creature: `${bestiaryId}/rust-jackal`, items: ["9 marks", "a bit", "2 Bits", "Poultice"] },
    ]);
    assert.deepEqual(fight.purses?.thief, [
      { ref: book.coins.find((coin) => coin.name === "marks")!.item, name: "marks", count: 9 },
      { ref: book.coins.find((coin) => coin.name === "bits")!.item, name: "bits", count: 3 },
    ]);
    assert.deepEqual(rulesetCombatant(fight.encounter, "thief")!.carried, [
      { ref: "outfitter/poultice", name: "Poultice", count: 1 },
    ]);
    assert.ok(!fight.adjustments.some((line: string) => /no item called/.test(line)), fight.adjustments.join(" | "));
    // It takes them along when it gets away, and comes back with them.
    const thief = rulesetCombatant(fight.encounter, "thief")!;
    Object.assign(thief, { defeated: true, away: { by: "thief", label: "Fled", left: true } });
    const { rulesetFightReturningFoes } =
      await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
    const gone = rulesetFightReturningFoes(definition, fight).fled[0]!;
    assert.deepEqual(gone.coins, fight.purses.thief);
    const back = createRulesetFight({
      definition,
      seed: 4,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "thief2", name: "thief", creature: `${bestiaryId}/rust-jackal`, items: [], coins: gone.coins }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
      playerName: null,
      live: {},
      items: () => [],
      itemBook: book,
      partyCatalogs: {},
      bestiary,
    } as never) as { ok: true; fight: any };
    assert.deepEqual(back.fight.purses?.thief2, fight.purses.thief);
  }

  // ── Used in the fight: a hurt jackal presses its poultice on itself ──
  {
    const fight = begin([{ id: "jackal", creature: `${bestiaryId}/rust-jackal` }]);
    const unit = (id: string, side: "player" | "enemy") => ({
      id,
      name: id,
      side,
      hp: 20,
      maxHp: 20,
      attack: 5,
      defense: 5,
      speed: 5,
      level: 1,
      skills: [],
    });
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("ada", "player")],
      enemies: [unit("jackal", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 4,
    } as never);
    state.rulesetFight = fight;
    const jackal = rulesetCombatant(fight.encounter, "jackal")!;
    jackal.health = { ...jackal.health!, value: 1 };
    // Its teeth drawn, so finishing Ada is not the better turn.
    jackal.actions = jackal.actions.filter((action) => action.id === "carried:0");
    syncRulesetCombatants(definition, state);
    state.stage = rulesetDirectorStage(state);
    const view = directedRulesetView(definition, state)!;
    assert.deepEqual(
      view.combatants.find((one) => one.id === "jackal")?.carrying,
      [{ name: "Poultice", count: 2 }],
      "its card says what it has",
    );
    const hers: RulesetCombatEvent[] = [];
    for (let guard = 0; guard < 6 && !state.outcome; guard++) {
      const now = state.rulesetFight!.encounter;
      if (rulesetEncounterSummary(definition, now).outcome !== "ongoing") break;
      if (rulesetCombatant(now, "jackal")!.uses["carried:0"]! < 2) break;
      if (now.order[now.turn] === "ada") {
        const step = applyRulesetCombatChoice(
          definition,
          now,
          { actorId: "ada", optionId: "end-turn", targetIds: [] },
          () => 10,
        );
        hers.push(...step.events);
        state.rulesetFight!.encounter = step.state;
        syncRulesetCombatants(definition, state);
        state.stage = rulesetDirectorStage(state);
        continue;
      }
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    }
    const after = rulesetCombatant(state.rulesetFight!.encounter, "jackal")!;
    assert.equal(after.uses["carried:0"], 1, "it used one poultice");
    assert.ok(after.health!.value > 1, "and it healed");
    assert.deepEqual(rulesetCarriedLeft(after), [{ ref: "outfitter/poultice", name: "Poultice", count: 1 }]);
  }

  // ── Refused, and gated ──
  {
    const unknownTable = parseRulesetDefinition(
      ember((one) => (creatureOf(one, "rust-jackal").inventory = [{ table: "no-such-table" }])),
    );
    assert.ok(!unknownTable.ok && /Unknown loot table "no-such-table"/.test(unknownTable.issues.join("; ")));
    const both = parseRulesetDefinition(
      ember((one) => (creatureOf(one, "rust-jackal").inventory = [{ item: "outfitter/poultice", table: "x" }])),
    );
    assert.ok(!both.ok && /names an item or a loot table, one of them/.test(both.issues.join("; ")));
    const gate =
      "A ruleset whose creatures have things on them as a fight begins (a creature's inventory) requires schemaVersion 2 and capabilityApi 1.795 or newer";
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "ember",
      name: "Ember",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(794) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(795) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(794) as never, ember()), gate);
  }

  console.info(
    "Creature inventory: rolled from its lines or given by the Game Master, used by a plain block and a sheet-backed one, what is left drops, gated at 1.795.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
