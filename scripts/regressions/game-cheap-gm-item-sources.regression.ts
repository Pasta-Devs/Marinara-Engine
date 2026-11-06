/**
 * Cheap-GM playtest 2026-10-26 (items from nowhere): a Game Master added a Potion of Healing "from the
 * captain's belt" with a bare `[inventory: action="add"]`, and the Engine took it; it then healed.
 *
 * The rule: in a game whose ruleset sells its items or drops them from loot tables, an item of the
 * ruleset that a use spends (a consumable: a tonic, a page, a potion) never comes into a bag by the
 * Game Master's word. It comes by a buy, a loot roll or a won fight's drop, which the Engine rolls and
 * prices itself, or by a give from a bag that already holds it, and an add of one is refused as
 * `no-source`. Everything else is added as before, and so is a consumable where the ruleset has no
 * market or tables to source it from. An Experience's own story gift is the Engine's, marked
 * `source="story"`, and stands; a Game Master's copy of that mark is dropped before the story's gifts
 * join the reply. A use spends what it uses, so one item is used once.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyGameInventoryTags,
  defaultRulesetSheetBuild,
  dropForgedStorySources,
  parseRulesetDefinition,
  readResolvedInventoryTags,
  rulesetItemBook,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cheap-gm-item-sources-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const { gameInventoryItemUser } = await import("../../packages/server/src/services/game/game-item-use.service.js");
  const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const parse = (text: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(JSON.parse(text));
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
  // Gravewatch sells its items and has loot tables; Ember Roads has neither.
  const gravewatch = parse(read("../../docs/examples/rulesets/gravewatch.json"));
  const ember = parse(read("../../docs/examples/rulesets/ember-roads.json"));
  assert.ok(gravewatch.items?.market && gravewatch.items.lootTables?.length);
  assert.ok(!ember.items?.market && !ember.items?.lootTables?.length);
  const gm = rulesetItemBook(gravewatch, entriesOf(gravewatch), { actor: "game-master" });
  const party = { members: ["Ada", "Bo"] };
  const answers = (content: string, stacks: GameInventoryStack[] = [], book = gm) =>
    readResolvedInventoryTags(applyGameInventoryTags(content, stacks, party, undefined, book).content).map(
      (answer) => `${answer.item}: ${answer.ok ? "ok" : answer.reason}`,
    );

  // ── A consumable needs a source the Engine checks ──
  assert.deepEqual(
    answers(
      `From the captain's belt. [inventory: action="add" item="Warming tonic" who="Ada"] [inventory: action="add" item="Page of the vigil litany" count="2" source="the captain"] [inventory: action="add" item="Grave spade" who="Ada"]`,
    ),
    ["Warming tonic: no-source", "Page of the vigil litany: no-source", "Grave spade: ok"],
  );
  // More of one already held is no different.
  const held: GameInventoryStack[] = [
    { id: "st-tonic", name: "Warming tonic", item: "kit/warming-tonic", quantity: 1, holder: "Ada" },
  ];
  assert.deepEqual(answers(`[inventory: action="add" item="Warming tonic" who="Ada"]`, held), [
    "Warming tonic: no-source",
  ]);
  // A give moves one somebody holds.
  assert.deepEqual(answers(`[inventory: action="give" item="Warming tonic" who="Ada" to="Bo"]`, held), [
    "Warming tonic: ok",
  ]);
  // The player's own book, and a ruleset with nowhere else to get one, add as before.
  const player = rulesetItemBook(gravewatch, entriesOf(gravewatch), { actor: "player" });
  assert.deepEqual(answers(`[inventory: action="add" item="Warming tonic"]`, [], player), ["Warming tonic: ok"]);
  const emberGm = rulesetItemBook(ember, entriesOf(ember), { actor: "game-master" });
  assert.deepEqual(answers(`[inventory: action="add" item="Poultice"]`, [], emberGm), ["Poultice: ok"]);

  // ── The story's own gift stands; a copied mark does not ──
  assert.deepEqual(answers(`[inventory: action="add" item="Warming tonic" count="1" source="story"]`), [
    "Warming tonic: ok",
  ]);
  const forged = `[inventory: action="add" item="Warming tonic" source="story" who="Ada"] [inventory: action="add" item="Grave spade" source='story']`;
  const unmarked = dropForgedStorySources(forged);
  assert.equal(
    unmarked,
    `[inventory: action="add" item="Warming tonic" who="Ada"] [inventory: action="add" item="Grave spade"]`,
  );
  assert.deepEqual(answers(unmarked), ["Warming tonic: no-source", "Grave spade: ok"]);
  assert.equal(
    dropForgedStorySources(`[skill_check: skill="Lore" dc="10" source="story"]`),
    `[skill_check: skill="Lore" dc="10" source="story"]`,
  );

  // ── A use spends it: one tonic is used once ──
  {
    const context = {
      definition: gravewatch,
      packageId: null,
      cards: [{ name: "Ada", build: defaultRulesetSheetBuild(gravewatch) }],
      playerName: null,
    };
    const user = gameInventoryItemUser(context as never, gm.itemOf, {}, 7);
    const told = applyGameInventoryTags(
      `[inventory: action="use" item="Warming tonic" who="Ada"] [inventory: action="use" item="Warming tonic" who="Ada"]`,
      held,
      party,
      undefined,
      gm,
      user.useItem,
    );
    assert.deepEqual(
      readResolvedInventoryTags(told.content).map((answer) => (answer.ok ? "ok" : answer.reason)),
      ["ok", "none-held"],
    );
    assert.equal(told.stacks.length, 0);
  }

  // ── The brief says so, in a line ──
  const reminder = (definition: RulesetDefinition) =>
    buildGmFormatReminder({ hasSceneModel: true, ruleset: definition } as never);
  assert.match(reminder(gravewatch), /that a use spends \(a potion, a scroll\) is never added/);
  assert.doesNotMatch(reminder(ember), /that a use spends/);

  console.info("cheap-GM item source regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
