/**
 * Game Mode inventory stacks (#6759): ids, any amount, splitting, merging, and the named operations
 * the Game Master's tag and a fight use when one item sits in several stacks.
 *
 * Pinned here:
 *   - A saved inventory with no ids reads with the same ids every time, two stacks of one name apart.
 *   - Adding by name goes onto the first stack of that name only; taking by name runs top to bottom
 *     across stacks, removes the ones it empties, and never takes more than there is.
 *   - Setting a count, splitting (300 by 100 is 200 and 100, beside each other), merging (same item
 *     only, into the target's place), and renaming one stack, with every refused change returning
 *     the same array.
 *   - A new session keeps every stack and id (the old carry-over kept only the first of a name).
 *   - The amount field: a count, or +N / -N, bounded like a stack.
 *   - Wearing and carrying (#6801): equipping takes free slots and binding stays under the bearer's
 *     maximum, one item of a larger stack at a time; a worn or bound stack stays one item (never
 *     topped up, merged or split, and unworn when handed over); a bound cursed item stays with its
 *     bearer for the player; an addition into the shared view goes to whoever can carry it, split by
 *     room, then least over, never past a limit, and what nobody can carry is left behind.
 *   - Ruleset items (#6795): a stack that is one is that item whatever it is called, a name that is one
 *     adds it (over a plain item only called that), a stack of one holds up to its `stack` (adding,
 *     setting, merging and giving past it start new stacks, never too many), only the ruleset's items
 *     may be added under `freeform: "refuse"`, and a new session brings one back as itself.
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  addGameInventoryRulesetItem,
  addToGameInventory,
  addToGameInventoryNamed,
  applyGameInventoryOps,
  applyGameInventoryTags,
  gameInventoryBearerStatus,
  gameInventoryLoad,
  placeGameInventoryAddition,
  wearGameInventoryStack,
  carryGameInventory,
  GAME_INVENTORY_MAX_NEW_STACKS,
  GAME_INVENTORY_MAX_QUANTITY,
  gameInventoryItemsOwnNamed,
  gameInventoryCount,
  gameInventoryItemId,
  gameInventoryPlainItemId,
  gameInventoryStackLabel,
  gameInventoryTotals,
  mergeGameInventoryStacks,
  normalizeGameInventoryStacks,
  sameGameInventory,
  renameGameInventoryStack,
  setGameInventoryStackQuantity,
  splitGameInventoryStack,
  giveGameInventoryStack,
  takeFromGameInventory,
  type GameInventoryBearer,
  type GameInventoryItemRules,
  type GameInventoryRulesetItem,
  type GameInventoryStack,
} from "../../packages/shared/src/index.js";
import {
  defaultInventorySplitSize,
  parseInventoryAmount,
} from "../../packages/client/src/lib/game-inventory-amount.js";

const ids = (stacks: GameInventoryStack[]) => stacks.map((stack) => stack.id);
const piles = (stacks: GameInventoryStack[]) => stacks.map((stack) => [gameInventoryStackLabel(stack), stack.quantity]);
const fixedId = (id: string) => () => id;

// ── Reading a saved inventory ──
{
  const saved = [
    { name: " Apple ", quantity: 300 },
    { name: "Rope", quantity: "2" },
    { name: "apple", quantity: 5 },
    { name: "", quantity: 1 },
    null,
    { name: "Coin", quantity: 0 },
    { name: "Hoard", quantity: GAME_INVENTORY_MAX_QUANTITY + 50 },
  ];
  const once = normalizeGameInventoryStacks(saved);
  const twice = normalizeGameInventoryStacks(saved);
  assert.deepEqual(ids(once), ids(twice), "the same saved list reads with the same ids");
  assert.equal(new Set(ids(once)).size, once.length, "every stack has its own id");
  assert.deepEqual(piles(once), [
    ["Apple", 300],
    ["Rope", 2],
    ["apple", 5],
    ["Coin", 1],
    ["Hoard", GAME_INVENTORY_MAX_QUANTITY],
  ]);
  // Stored ids are kept; a duplicated stored id is replaced on the second entry only.
  const stored = normalizeGameInventoryStacks([
    { id: "st-a", name: "Apple", quantity: 1 },
    { id: "st-a", name: "Apple", quantity: 2 },
  ]);
  assert.equal(stored[0]!.id, "st-a");
  assert.notEqual(stored[1]!.id, "st-a");
  assert.deepEqual(normalizeGameInventoryStacks("not a list"), []);
  // A worked-out id trims dashes from both ends, and a name that is a long run of them stays quick.
  assert.equal(normalizeGameInventoryStacks([{ name: " --Apple-- ", quantity: 1 }])[0]!.id, "st-apple-0");
  const started = performance.now();
  const dashes = normalizeGameInventoryStacks([{ name: `${"-".repeat(100_000)}x`, quantity: 1 }]);
  assert.equal(dashes[0]!.id, "st-x-0");
  assert.ok(performance.now() - started < 200, "a long run of dashes is read in linear time");
  // Stored ids are reserved first: an entry saved without an id never takes a later entry's id.
  const reserved = normalizeGameInventoryStacks([
    { name: "Apple", quantity: 1 },
    { id: "st-apple-0", name: "Apple", quantity: 2 },
  ]);
  assert.equal(reserved[1]!.id, "st-apple-0", "the stack saved with the id keeps it");
  assert.notEqual(reserved[0]!.id, "st-apple-0");
}

const apples = (): GameInventoryStack[] => [
  { id: "a1", name: "Apple", quantity: 200 },
  { id: "r1", name: "Rope", quantity: 1 },
  { id: "a2", name: "Apple", quantity: 100 },
];

// ── Adding by name ──
{
  const added = addToGameInventory(apples(), "  apple ", 5);
  assert.deepEqual(
    piles(added),
    [
      ["Apple", 205],
      ["Rope", 1],
      ["Apple", 100],
    ],
    "onto the first stack of that name, and no other",
  );
  const fresh = addToGameInventory(apples(), "Lantern", 2, fixedId("new"));
  assert.deepEqual(fresh.at(-1), { id: "new", name: "Lantern", quantity: 2 });
  // What the first stack cannot hold starts a new stack; nothing added is lost.
  const nearlyFull: GameInventoryStack[] = [{ id: "c1", name: "Coin", quantity: GAME_INVENTORY_MAX_QUANTITY - 5 }];
  assert.deepEqual(addToGameInventory(nearlyFull, "coin", 20, fixedId("c2")), [
    { id: "c1", name: "Coin", quantity: GAME_INVENTORY_MAX_QUANTITY },
    { id: "c2", name: "Coin", quantity: 15 },
  ]);
  const full: GameInventoryStack[] = [{ id: "c1", name: "Coin", quantity: GAME_INVENTORY_MAX_QUANTITY }];
  assert.deepEqual(piles(addToGameInventory(full, "Coin", 3, fixedId("c2"))), [
    ["Coin", GAME_INVENTORY_MAX_QUANTITY],
    ["Coin", 3],
  ]);
  const same = apples();
  assert.equal(addToGameInventory(same, "Apple", 0), same, "adding nothing changes nothing");
  for (const count of [Number.NaN, Number.POSITIVE_INFINITY, GAME_INVENTORY_MAX_QUANTITY + 1]) {
    assert.equal(addToGameInventory(same, "Apple", count), same, `adding ${count} is refused`);
    assert.equal(addToGameInventory(same, "Lantern", count), same, `a new stack of ${count} is refused`);
  }
  assert.equal(addToGameInventory(same, "   ", 3), same);
}

// ── Taking by name ──
{
  const partly = takeFromGameInventory(apples(), "Apple", 50);
  assert.equal(partly.taken, 50);
  assert.deepEqual(piles(partly.stacks), [
    ["Apple", 150],
    ["Rope", 1],
    ["Apple", 100],
  ]);
  const across = takeFromGameInventory(apples(), "apple", 250);
  assert.equal(across.taken, 250);
  assert.deepEqual(ids(across.stacks), ["r1", "a2"], "the emptied stack is removed");
  assert.deepEqual(piles(across.stacks), [
    ["Rope", 1],
    ["Apple", 50],
  ]);
  const everything = takeFromGameInventory(apples(), "Apple", 9999);
  assert.equal(everything.taken, 300, "more than there is takes all of it, and says how many");
  assert.deepEqual(ids(everything.stacks), ["r1"]);
  // Taking is not held to one stack's bound: several full stacks can be emptied at once.
  const hoard: GameInventoryStack[] = [
    { id: "h1", name: "Coin", quantity: GAME_INVENTORY_MAX_QUANTITY },
    { id: "h2", name: "Coin", quantity: GAME_INVENTORY_MAX_QUANTITY },
  ];
  const bigTake = takeFromGameInventory(hoard, "Coin", GAME_INVENTORY_MAX_QUANTITY + 10);
  assert.equal(bigTake.taken, GAME_INVENTORY_MAX_QUANTITY + 10);
  assert.deepEqual(piles(bigTake.stacks), [["Coin", GAME_INVENTORY_MAX_QUANTITY - 10]]);
  const same = apples();
  const none = takeFromGameInventory(same, "Lantern", 1);
  assert.equal(none.stacks, same);
  assert.equal(none.taken, 0);
  assert.equal(gameInventoryCount(apples(), " APPLE"), 300);
  assert.deepEqual(gameInventoryTotals(apples()), [
    { name: "Apple", quantity: 300 },
    { name: "Rope", quantity: 1 },
  ]);
}

// ── One stack's count ──
{
  const same = apples();
  assert.deepEqual(piles(setGameInventoryStackQuantity(same, "a2", 150)).at(-1), ["Apple", 150]);
  assert.deepEqual(ids(setGameInventoryStackQuantity(same, "r1", 0)), ["a1", "a2"], "zero removes the stack");
  assert.equal(setGameInventoryStackQuantity(same, "a1", 200), same);
  assert.equal(setGameInventoryStackQuantity(same, "missing", 3), same);
  assert.equal(setGameInventoryStackQuantity(same, "a1", Number.NaN), same);
  assert.equal(
    setGameInventoryStackQuantity(same, "a1", GAME_INVENTORY_MAX_QUANTITY * 2)[0]!.quantity,
    GAME_INVENTORY_MAX_QUANTITY,
  );
}

// ── Splitting ──
{
  const pile: GameInventoryStack[] = [
    { id: "a", name: "Apple", quantity: 300 },
    { id: "r", name: "Rope", quantity: 1 },
  ];
  const split = splitGameInventoryStack(pile, "a", 100, fixedId("b"));
  assert.deepEqual(
    split,
    [
      { id: "a", name: "Apple", quantity: 200 },
      { id: "b", name: "Apple", quantity: 100 },
      { id: "r", name: "Rope", quantity: 1 },
    ],
    "300 split by 100 is 200 and 100, side by side",
  );
  for (const size of [0, 300, 301, -1, 1.5, Number.NaN]) {
    assert.equal(splitGameInventoryStack(pile, "a", size), pile, `a split of ${size} changes nothing`);
  }
  assert.equal(splitGameInventoryStack(pile, "r", 1), pile, "a single item cannot be split");
  const fresh = splitGameInventoryStack(pile, "a", 1);
  assert.equal(new Set(ids(fresh)).size, 3, "a split without a given id still makes a new one");
}

// ── Merging ──
{
  const same = apples();
  const merged = mergeGameInventoryStacks(same, "a2", "a1");
  assert.deepEqual(
    merged,
    [
      { id: "a1", name: "Apple", quantity: 300 },
      { id: "r1", name: "Rope", quantity: 1 },
    ],
    "into the target, which keeps its place",
  );
  assert.equal(mergeGameInventoryStacks(same, "r1", "a1"), same, "two different items never merge");
  assert.equal(mergeGameInventoryStacks(same, "a1", "a1"), same);
  assert.equal(mergeGameInventoryStacks(same, "a1", "missing"), same);
  const full: GameInventoryStack[] = [
    { id: "x", name: "Coin", quantity: GAME_INVENTORY_MAX_QUANTITY },
    { id: "y", name: "Coin", quantity: 1 },
  ];
  assert.equal(mergeGameInventoryStacks(full, "y", "x"), full, "nothing pours into a full stack");
  const nearlyFull: GameInventoryStack[] = [
    { id: "x", name: "Coin", quantity: GAME_INVENTORY_MAX_QUANTITY - 2 },
    { id: "y", name: "Coin", quantity: 5 },
  ];
  assert.deepEqual(
    mergeGameInventoryStacks(nearlyFull, "y", "x").map((stack) => [stack.id, stack.quantity]),
    [
      ["x", GAME_INVENTORY_MAX_QUANTITY],
      ["y", 3],
    ],
    "only what fits pours in, and the rest stays where it was",
  );
}

// ── Renaming one stack: a nickname, never another item ──
{
  const same = apples();
  const renamed = renameGameInventoryStack(same, "a2", "Green apple")!;
  assert.equal(renamed.id, "a2");
  assert.deepEqual(
    renamed.stacks[2],
    { id: "a2", name: "Apple", nickname: "Green apple", quantity: 100 },
    "only that stack is called something else, and it is still an apple",
  );
  assert.equal(gameInventoryItemId(renamed.stacks[2]!), gameInventoryItemId(same[0]!));
  assert.equal(gameInventoryCount(renamed.stacks, "Apple"), 300, "named by its own name");
  assert.equal(gameInventoryCount(renamed.stacks, "green APPLE"), 300, "or by the nickname, any case");
  assert.deepEqual(gameInventoryTotals(renamed.stacks), [
    { name: "Apple", quantity: 300 },
    { name: "Rope", quantity: 1 },
  ]);
  const into = renameGameInventoryStack(same, "r1", "Apple")!;
  assert.equal(into.id, "r1", "a rope called Apple is never poured into the apples");
  assert.deepEqual(piles(into.stacks), [
    ["Apple", 200],
    ["Apple", 1],
    ["Apple", 100],
  ]);
  assert.equal(gameInventoryCount(into.stacks, "rope"), 1, "it is still a rope");
  assert.equal(mergeGameInventoryStacks(into.stacks, "r1", "a1"), into.stacks, "and never merges with them");
  const back = renameGameInventoryStack(renamed.stacks, "a2", "  APPLE ")!;
  assert.deepEqual(back.stacks[2], same[2], "the item's own name, in any case, clears the nickname");
  assert.equal(renameGameInventoryStack(same, "a2", "APPLE")!.stacks, same, "which is nothing to clear here");
  assert.equal(renameGameInventoryStack(same, "a1", "Apple")!.stacks, same);
  assert.equal(renameGameInventoryStack(renamed.stacks, "a2", "Green apple")!.stacks, renamed.stacks);
  assert.equal(renameGameInventoryStack(same, "missing", "X"), null);
  assert.equal(renameGameInventoryStack(same, "a1", "   "), null);
  // Nicknames read back as they were saved, and one that is the own name again is dropped.
  assert.deepEqual(
    normalizeGameInventoryStacks([
      { id: "x", name: "Rope", nickname: "  Grandpa's   rope ", quantity: 2 },
      { id: "y", name: "Rope", nickname: "ROPE", quantity: 1 },
      { id: "z", name: "Rope", nickname: 7, quantity: 1 },
    ]),
    [
      { id: "x", name: "Rope", nickname: "Grandpa's rope", quantity: 2 },
      { id: "y", name: "Rope", quantity: 1 },
      { id: "z", name: "Rope", quantity: 1 },
    ],
  );
}

// ── Which item a name makes ──
{
  assert.equal(gameInventoryPlainItemId("Rope"), "plain:rope");
  assert.equal(gameInventoryPlainItemId("  ROPE!! "), "plain:rope", "case, spacing and punctuation aside");
  assert.equal(gameInventoryPlainItemId("Health Potion"), "plain:health-potion");
  assert.equal(gameInventoryPlainItemId("Épée"), "plain:epee", "accents aside");
  assert.equal(gameInventoryPlainItemId("Меч"), "plain:меч", "every script keeps its letters");
  assert.notEqual(gameInventoryPlainItemId("Меч"), gameInventoryPlainItemId("Щит"), "so two such items stay two");
  assert.notEqual(
    gameInventoryPlainItemId("がく"),
    gameInventoryPlainItemId("かく"),
    "a dakuten is part of the letter",
  );
  assert.notEqual(gameInventoryPlainItemId("किताब"), gameInventoryPlainItemId("कताब"), "and so is a vowel sign");
  assert.equal(
    gameInventoryPlainItemId("\u304c"),
    gameInventoryPlainItemId("\u304b\u3099"),
    "however the name was typed: composed or not",
  );
  assert.notEqual(gameInventoryPlainItemId("Sword +1"), gameInventoryPlainItemId("Sword -1"), "a sign is kept");
  assert.notEqual(gameInventoryPlainItemId("Sword +1"), gameInventoryPlainItemId("Sword 1"));
  assert.equal(gameInventoryPlainItemId("Sword+1"), gameInventoryPlainItemId("Sword +1"), "spaced or not");
  assert.equal(gameInventoryPlainItemId("Sword \u22121"), gameInventoryPlainItemId("Sword -1"), "a real minus too");
  assert.equal(gameInventoryPlainItemId("-1 Sword"), gameInventoryPlainItemId("\u22121 sword"), "at the start too");
  assert.equal(gameInventoryPlainItemId("Mk-2 Lamp"), gameInventoryPlainItemId("Mk 2 Lamp"), "a hyphen is a dash");
  assert.equal(gameInventoryPlainItemId("Rope + Hook"), gameInventoryPlainItemId("Rope Hook"), "no number, no sign");
  assert.notEqual(gameInventoryPlainItemId("🍎"), gameInventoryPlainItemId("🍐"));
  const long = `${"a".repeat(50)}1`;
  assert.notEqual(gameInventoryPlainItemId(long), gameInventoryPlainItemId(`${"a".repeat(50)}2`), "not cut into one");
  assert.ok(gameInventoryPlainItemId(long).length <= 48);
}

// ── A new session carries every stack ──
{
  const carried = carryGameInventory(
    [
      { id: "st-a", name: "Apple", quantity: 200 },
      { id: "st-b", name: "Apple", quantity: 100 },
    ],
    [
      { name: "apple", description: "", quantity: 300, location: "on_person" },
      { name: "Map", description: "Of the valley", quantity: 1, location: "on_person" },
    ],
  );
  assert.deepEqual(
    piles(carried),
    [
      ["Apple", 200],
      ["Apple", 100],
      ["Map", 1],
    ],
    "both apple stacks survive, and the detailed inventory adds only what no stack holds",
  );
  assert.deepEqual(ids(carried).slice(0, 2), ["st-a", "st-b"]);
  // Nicknames carry over, and an entry that follows an item by id is that item under any name.
  assert.deepEqual(
    carryGameInventory(
      [{ id: "st-r", name: "Rope", nickname: "Grandpa's rope", quantity: 2 }],
      [
        { item: gameInventoryPlainItemId("Rope"), name: "Old faithful", description: "", quantity: 2, location: "" },
        { name: "grandpa's rope", description: "", quantity: 2, location: "" },
      ],
    ),
    [{ id: "st-r", name: "Rope", nickname: "Grandpa's rope", quantity: 2 }],
  );
  // An entry that follows an item nobody holds any more is carried, even when its name (a nickname)
  // is another held item's own name: it comes back as its own item, not onto the rope.
  const cordCarried = carryGameInventory(
    [{ id: "st-r", name: "Rope", quantity: 2 }],
    [
      { item: gameInventoryPlainItemId("Cord"), name: "Rope", description: "", quantity: 1, location: "" },
      { item: gameInventoryPlainItemId("Lamp"), name: "Lamp", description: "", quantity: 1, location: "" },
    ],
  );
  assert.deepEqual(
    cordCarried.map(({ name, nickname, quantity }) => [name, nickname ?? null, quantity]),
    [
      ["Rope", null, 2],
      ["cord", "Rope", 1],
      ["Lamp", null, 1],
    ],
  );
  assert.equal(gameInventoryItemId(cordCarried[1]!), gameInventoryPlainItemId("Cord"));
  // A signed name reads back off its id, so a nicknamed "Sword -1" comes back as that very item.
  const [cursed] = carryGameInventory(
    [],
    [{ item: gameInventoryPlainItemId("Sword -1"), name: "Old Bitey", description: "", quantity: 1, location: "" }],
  );
  assert.equal(gameInventoryItemId(cursed!), gameInventoryPlainItemId("Sword -1"));
  assert.equal(gameInventoryStackLabel(cursed!), "Old Bitey");
  // An id that cannot be read back into a name (a fingerprint) comes back by name, and one cut short
  // comes back as the same item, the nickname shown over whatever own name it read back.
  const fingerprinted = gameInventoryPlainItemId("🍎");
  assert.deepEqual(
    carryGameInventory(
      [],
      [{ item: fingerprinted, name: "Apple charm", description: "", quantity: 1, location: "" }],
    ).map(({ name, nickname, quantity }) => [name, nickname ?? null, quantity]),
    [["Apple charm", null, 1]],
  );
  const longId = gameInventoryPlainItemId(`${"a".repeat(50)}1`);
  const [heirloom] = carryGameInventory(
    [],
    [{ item: longId, name: "Heirloom", description: "", quantity: 1, location: "" }],
  );
  assert.equal(gameInventoryItemId(heirloom!), longId);
  assert.equal(gameInventoryStackLabel(heirloom!), "Heirloom");
  assert.deepEqual(piles(carryGameInventory(undefined, [{ name: "Map", quantity: 1 }])), [["Map", 1]]);
  assert.deepEqual(
    piles(
      carryGameInventory(
        [],
        [
          { name: "Map", quantity: 1 },
          { name: "map", quantity: 2 },
        ],
      ),
    ),
    [["Map", 3]],
    "two detailed entries of a name no stack holds both count",
  );
}

// ── Ruleset items ──
{
  const known: GameInventoryRulesetItem[] = [
    { item: "outfitter/arrows", name: "Arrows", stack: 20 },
    { item: "outfitter/hand-axe", name: "Hand axe" },
    { item: "kit/relic", name: "Relic", stack: 1 },
    // A layer of this game hides it: it can be held, but not added by its id.
    { item: "kit/veiled", name: "Veiled lamp" },
  ];
  const rules = (plain: "allow" | "refuse" = "allow"): GameInventoryItemRules => ({
    itemNamed: (name) =>
      known.find((each) => each.item !== "kit/veiled" && each.name.toLowerCase() === name.trim().toLowerCase()),
    itemOf: (item) => known.find((each) => each.item === item),
    offers: (item) => item !== "kit/veiled" && known.some((each) => each.item === item),
    plain,
  });
  let n = 0;
  const next = () => `n${++n}`;
  const shape = (stacks: GameInventoryStack[]) =>
    stacks.map((stack) => [gameInventoryStackLabel(stack), stack.item ?? null, stack.quantity, stack.holder ?? null]);

  // A stack of a ruleset item is that item, whatever it is called, and apart from a plain one.
  assert.equal(gameInventoryItemId({ name: "Arrows", item: "outfitter/arrows" }), "outfitter/arrows");
  assert.notEqual(
    gameInventoryItemId({ name: "Arrows", item: "outfitter/arrows" }),
    gameInventoryItemId({ name: "Arrows" }),
  );
  assert.equal(gameInventoryItemId({ name: "Quiver", item: "outfitter/arrows" }), "outfitter/arrows");
  // Read back as saved; anything that is not a catalog and an entry is dropped.
  assert.deepEqual(
    normalizeGameInventoryStacks([
      { id: "a", name: "Arrows", item: "outfitter/arrows", quantity: 3 },
      { id: "b", name: "Rope", item: "plain:rope", quantity: 1 },
      { id: "c", name: "Axe", item: "Outfitter/Axe", quantity: 1 },
      { id: "d", name: "Axe", item: `outfitter/${"a".repeat(130)}`, quantity: 1 },
    ]).map((stack) => stack.item ?? null),
    ["outfitter/arrows", null, null, null],
  );

  // A name that is one of the ruleset's items adds that item, called by its label.
  const axe = addToGameInventoryNamed([], "HAND AXE", 1, next, undefined, rules());
  assert.deepEqual(shape(axe!.stacks), [["Hand axe", "outfitter/hand-axe", 1, null]]);
  // Its nickname finds it too, and a plain item called by the same name is another item.
  const nicknamed: GameInventoryStack[] = [
    { id: "q", name: "Arrows", nickname: "Quiver", item: "outfitter/arrows", quantity: 5 },
  ];
  assert.deepEqual(shape(addToGameInventoryNamed(nicknamed, "quiver", 2, next, undefined, rules())!.stacks), [
    ["Quiver", "outfitter/arrows", 7, null],
  ]);
  // A plain stack that only has the ruleset item's name as its own gives way to the ruleset's item.
  const plainArrows: GameInventoryStack[] = [{ id: "p", name: "Arrows", quantity: 4 }];
  assert.deepEqual(shape(addToGameInventoryNamed(plainArrows, "Arrows", 2, next, undefined, rules())!.stacks), [
    ["Arrows", null, 4, null],
    ["Arrows", "outfitter/arrows", 2, null],
  ]);
  // Without rules a name is a plain item, as before.
  assert.deepEqual(shape(addToGameInventoryNamed([], "Hand axe", 1, next)!.stacks), [["Hand axe", null, 1, null]]);
  // By its id; one the ruleset does not have is refused.
  assert.deepEqual(shape(addGameInventoryRulesetItem([], "outfitter/hand-axe", 2, next, "Bram", rules())!.stacks), [
    ["Hand axe", "outfitter/hand-axe", 2, "Bram"],
  ]);
  assert.equal(addGameInventoryRulesetItem([], "outfitter/missing", 1, next, undefined, rules()), null);
  assert.equal(addGameInventoryRulesetItem([], "kit/veiled", 1, next, undefined, rules()), null, "a layer hides it");
  assert.equal(addGameInventoryRulesetItem([], "outfitter/hand-axe", 1, next), null, "no rules, no ruleset items");

  // Only the ruleset's items, and items already held, when plain ones are refused.
  assert.equal(addToGameInventoryNamed([], "Rope", 1, next, undefined, rules("refuse")), null);
  assert.ok(addToGameInventoryNamed([], "Arrows", 1, next, undefined, rules("refuse")));
  const heldRope: GameInventoryStack[] = [{ id: "r", name: "Rope", quantity: 1 }];
  assert.deepEqual(shape(addToGameInventoryNamed(heldRope, "rope", 1, next, undefined, rules("refuse"))!.stacks), [
    ["Rope", null, 2, null],
  ]);
  const refusedOps = applyGameInventoryOps(
    [],
    [
      { op: "add", name: "Rope", count: 1 },
      { op: "add", name: "Relic", item: "kit/missing", count: 1 },
      { op: "add", name: "Veiled lamp", item: "kit/veiled", count: 1 },
      { op: "add", name: "Relic", item: "kit/relic", count: 1 },
      { op: "add", name: "Relic", item: "kit/relic", count: GAME_INVENTORY_MAX_NEW_STACKS + 1 },
    ],
    next,
    rules("refuse"),
  );
  assert.deepEqual(
    refusedOps.results.map((result) => (result.ok ? "ok" : result.reason)),
    ["not-ruleset-item", "not-ruleset-item", "not-ruleset-item", "ok", "refused"],
  );

  // A stack of arrows holds 20: an addition fills the bag's stacks of it in order, then starts new
  // ones of at most 20.
  const quivers: GameInventoryStack[] = [
    { id: "a1", name: "Arrows", item: "outfitter/arrows", quantity: 18 },
    { id: "rope", name: "Rope", quantity: 1 },
    { id: "a2", name: "Arrows", item: "outfitter/arrows", quantity: 15 },
    { id: "a3", name: "Arrows", item: "outfitter/arrows", quantity: 2, holder: "Bram" },
  ];
  const topped = addToGameInventoryNamed(quivers, "arrows", 30, next, undefined, rules())!;
  assert.deepEqual(
    topped.stacks.map((stack) => [stack.id.startsWith("n") ? "new" : stack.id, stack.quantity, stack.holder ?? null]),
    [
      ["a1", 20, null],
      ["rope", 1, null],
      ["a2", 20, null],
      ["a3", 2, "Bram"],
      ["new", 20, null],
      ["new", 3, null],
    ],
  );
  assert.equal(topped.id, "a1", "the stack it went onto first");
  // One change never starts more than GAME_INVENTORY_MAX_NEW_STACKS stacks.
  assert.equal(addToGameInventoryNamed([], "Relic", GAME_INVENTORY_MAX_NEW_STACKS + 1, next, undefined, rules()), null);
  assert.equal(
    addToGameInventoryNamed([], "Relic", GAME_INVENTORY_MAX_NEW_STACKS, next, undefined, rules())!.stacks.length,
    GAME_INVENTORY_MAX_NEW_STACKS,
  );
  // Setting past 20 fills that stack and puts the rest in new stacks right after it.
  const set = setGameInventoryStackQuantity(quivers, "a2", 45, next, rules());
  assert.deepEqual(
    set.map((stack) => [stack.id.startsWith("n") ? "new" : stack.id, stack.quantity]),
    [
      ["a1", 18],
      ["rope", 1],
      ["a2", 20],
      ["new", 20],
      ["new", 5],
      ["a3", 2],
    ],
  );
  assert.ok(set.every((stack) => stack.item === quivers.find((each) => each.name === stack.name)?.item));
  assert.equal(setGameInventoryStackQuantity(quivers, "a2", 12, next, rules())[2]!.quantity, 12);
  const relics: GameInventoryStack[] = [{ id: "z", name: "Relic", item: "kit/relic", quantity: 1 }];
  assert.equal(
    setGameInventoryStackQuantity(relics, "z", GAME_INVENTORY_MAX_NEW_STACKS + 2, next, rules()),
    relics,
    "a count that would start too many stacks changes nothing",
  );
  const setOps = applyGameInventoryOps(
    quivers,
    [
      { op: "set", id: "a2", quantity: 45 },
      { op: "set", id: "a1", quantity: 5000 },
    ],
    next,
    rules(),
  );
  assert.deepEqual(
    setOps.results.map((result) => (result.ok ? [result.count, result.now] : result.reason)),
    [[30, 20], "refused"],
  );
  // Pouring fills the stack poured into up to 20 and leaves the rest.
  assert.deepEqual(
    mergeGameInventoryStacks(quivers, "a2", "a1", rules()).map((stack) => [stack.id, stack.quantity]),
    [
      ["a1", 20],
      ["rope", 1],
      ["a2", 13],
      ["a3", 2],
    ],
  );
  // Giving onto a receiver's stack fills it and starts a new one there for the rest.
  const given = giveGameInventoryStack(quivers, "a2", "Bram", 15, next, rules())!;
  assert.deepEqual(shape(given.stacks), [
    ["Arrows", "outfitter/arrows", 18, null],
    ["Rope", null, 1, null],
    ["Arrows", "outfitter/arrows", 17, "Bram"],
  ]);
  // Past what the receiver's stack can take, the rest starts a new stack in their bag.
  const overflowing = giveGameInventoryStack(given.stacks, "a1", "Bram", 18, next, rules())!;
  assert.deepEqual(shape(overflowing.stacks), [
    ["Rope", null, 1, null],
    ["Arrows", "outfitter/arrows", 20, "Bram"],
    ["Arrows", "outfitter/arrows", 15, "Bram"],
  ]);
  assert.equal(overflowing.id, "a3", "the receiver's stack it went onto first");
  // A plain item has no such limit.
  assert.deepEqual(shape(addToGameInventoryNamed(heldRope, "Rope", 500, next)!.stacks), [["Rope", null, 501, null]]);

  // Taking and counting by name find the ruleset item by its own name; a split keeps the item.
  assert.deepEqual(shape(takeFromGameInventory(quivers, "ARROWS", 20).stacks), [
    ["Rope", null, 1, null],
    ["Arrows", "outfitter/arrows", 13, null],
    ["Arrows", "outfitter/arrows", 2, "Bram"],
  ]);
  assert.equal(gameInventoryCount(quivers, "arrows"), 35);
  assert.deepEqual([...gameInventoryItemsOwnNamed([...quivers, ...plainArrows], "Arrows")].sort(), [
    "outfitter/arrows",
    gameInventoryPlainItemId("Arrows"),
  ]);
  assert.ok(splitGameInventoryStack(quivers, "a1", 5, next).every((stack) => stack.name !== "Arrows" || stack.item));
  assert.equal(renameGameInventoryStack(quivers, "a1", "Quiver")!.stacks[0]!.item, "outfitter/arrows");
  assert.deepEqual(gameInventoryTotals(quivers)[0], { name: "Arrows", quantity: 35, item: "outfitter/arrows" });
  // Two inventories that differ only in which item a stack is are not the same inventory.
  assert.equal(
    sameGameInventory(
      [{ id: "x", name: "Arrows", item: "outfitter/arrows", quantity: 1 }],
      [{ id: "x", name: "Arrows", quantity: 1 }],
    ),
    false,
  );

  // A new session brings back a ruleset item the detailed inventory names and no stack holds as that
  // item, under the name its entry shows, and never adds one a stack still holds.
  assert.deepEqual(
    shape(
      carryGameInventory(
        [{ id: "a1", name: "Arrows", item: "outfitter/arrows", quantity: 3 }],
        [
          { item: "outfitter/arrows", name: "Arrows", description: "", quantity: 3, location: "" },
          { item: "outfitter/hand-axe", name: "Old Bitey", description: "", quantity: 1, location: "" },
        ],
      ),
    ),
    [
      ["Arrows", "outfitter/arrows", 3, null],
      ["Old Bitey", "outfitter/hand-axe", 1, null],
    ],
  );
  // With the ruleset's items, an id the ruleset no longer has comes back by its entry's name, while one
  // a layer hides is still that item.
  assert.deepEqual(
    shape(
      carryGameInventory(
        [],
        [
          { item: "outfitter/gone", name: "Old lantern", description: "", quantity: 1, location: "" },
          { item: "kit/veiled", name: "Veiled lamp", description: "", quantity: 1, location: "" },
        ],
        rules(),
      ),
    ),
    [
      ["Old lantern", null, 1, null],
      ["Veiled lamp", "kit/veiled", 1, null],
    ],
  );
  // With the ruleset's items, what comes back is stacked as its item allows, and an entry written
  // without an id whose name is one of them comes back as that item.
  assert.deepEqual(
    shape(
      carryGameInventory(
        [],
        [
          { item: "outfitter/arrows", name: "Arrows", description: "", quantity: 30, location: "" },
          { name: "hand axe", description: "", quantity: 1, location: "" },
        ],
        rules(),
      ),
    ),
    [
      ["Arrows", "outfitter/arrows", 20, null],
      ["Arrows", "outfitter/arrows", 10, null],
      ["Hand axe", "outfitter/hand-axe", 1, null],
    ],
  );
}

// ── Wearing and carrying ──
{
  const known: GameInventoryRulesetItem[] = [
    { item: "gear/coat", name: "Coat", weight: 3, slots: { body: 1 } },
    { item: "gear/bow", name: "Bow", weight: 2, slots: { hands: 2 } },
    { item: "gear/axe", name: "Axe", weight: 1, slots: { hands: 1 } },
    { item: "gear/ring", name: "Ring", slots: { finger: 1 }, binds: { cursed: true } },
    { item: "gear/bell", name: "Bell", binds: {} },
    { item: "gear/arrow", name: "Arrow", weight: 1, stack: 20 },
    { item: "gear/dart", name: "Dart", weight: 0.25 },
    { item: "gear/feather", name: "Feather" },
  ];
  // The player carries 6 without strain and 12 at most; Bram 9 and 12. Each binds one item.
  const bearers: Record<string, GameInventoryBearer> = {
    "": { encumberedAbove: 6, limit: 12, bindingMax: 1 },
    bram: { encumberedAbove: 9, limit: 12, bindingMax: 1 },
  };
  const rules = (actor: "player" | "game-master" = "player"): GameInventoryItemRules => ({
    itemNamed: (name) => known.find((each) => each.name.toLowerCase() === name.trim().toLowerCase()),
    itemOf: (item) => known.find((each) => each.item === item),
    offers: (item) => known.some((each) => each.item === item),
    slots: [
      { id: "body", label: "Body", count: 1 },
      { id: "hands", label: "Hands", count: 2 },
      { id: "finger", label: "Finger", count: 1 },
    ],
    bearer: (holder) => bearers[holder ? holder.toLowerCase() : ""] ?? {},
    actor,
  });
  let n = 0;
  const next = () => `w${++n}`;
  const of = (name: string, quantity = 1, extra: Partial<GameInventoryStack> = {}): GameInventoryStack => ({
    id: extra.id ?? `s-${name.toLowerCase()}-${quantity}`,
    name,
    item: known.find((each) => each.name === name)!.item,
    quantity,
    ...extra,
  });
  const worn = (stacks: GameInventoryStack[]) =>
    stacks.map(
      (stack) =>
        `${stack.name} ${stack.quantity} ${stack.holder ?? "player"}${stack.equipped ? " worn" : ""}${stack.bound ? " bound" : ""}`,
    );

  // Saved worn and bound marks are read on one item only.
  assert.deepEqual(
    worn(
      normalizeGameInventoryStacks([
        { id: "a", name: "Bow", item: "gear/bow", quantity: 1, equipped: true, bound: true },
        { id: "b", name: "Bow", item: "gear/bow", quantity: 2, equipped: true },
        { id: "c", name: "Bow", item: "gear/bow", quantity: 1, equipped: "yes" },
      ]),
    ),
    ["Bow 1 player worn bound", "Bow 2 player", "Bow 1 player"],
  );

  // Equipping one bow of two takes it into its own stack, right after, which is the one returned; it
  // takes both hands, so the other finds none free.
  const bows = [of("Bow", 2, { id: "bows" })];
  const onBow = wearGameInventoryStack(bows, "bows", "equip", next, rules());
  assert.ok(onBow && !("refused" in onBow));
  assert.deepEqual(worn(onBow.stacks), ["Bow 1 player", "Bow 1 player worn"]);
  assert.equal(onBow.id, onBow.stacks[1]!.id);
  assert.deepEqual(wearGameInventoryStack(onBow.stacks, "bows", "equip", next, rules()), { refused: "no-slot" });
  // The coat takes the body, beside the bow; the bell takes no slot, so it cannot be worn.
  const coat = [...onBow.stacks, of("Coat", 1, { id: "coat" }), of("Bell", 1, { id: "bell" })];
  const onCoat = wearGameInventoryStack(coat, "coat", "equip", next, rules());
  assert.ok(onCoat && !("refused" in onCoat));
  assert.deepEqual(wearGameInventoryStack(coat, "bell", "equip", next, rules()), { refused: "not-wearable" });
  // Slots are per bearer: Bram's hands are his own.
  const bramsBow = [...onBow.stacks, of("Bow", 1, { id: "bram-bow", holder: "Bram" })];
  const onBram = wearGameInventoryStack(bramsBow, "bram-bow", "equip", next, rules());
  assert.ok(onBram && !("refused" in onBram));
  // Taking it off frees the hands; taking off what is not worn changes nothing.
  const off = wearGameInventoryStack(onBow.stacks, onBow.id, "unequip", next, rules());
  assert.ok(off && !("refused" in off));
  assert.deepEqual(worn(off.stacks), ["Bow 1 player", "Bow 1 player"]);
  assert.equal(
    (wearGameInventoryStack(off.stacks, onBow.id, "unequip", next, rules()) as { stacks: unknown }).stacks,
    off.stacks,
  );
  assert.equal(wearGameInventoryStack(off.stacks, "missing", "equip", next, rules()), null);

  // Binding: one item each, only an item that binds, and a bound cursed ring stays bound for the
  // player (who cannot take it off either), while the Game Master can end the curse.
  const trinkets = [of("Ring", 1, { id: "ring" }), of("Bell", 1, { id: "bell" }), of("Axe", 1, { id: "axe" })];
  const ring = wearGameInventoryStack(trinkets, "ring", "bind", next, rules());
  assert.ok(ring && !("refused" in ring));
  assert.deepEqual(wearGameInventoryStack(ring.stacks, "bell", "bind", next, rules()), { refused: "binding-full" });
  assert.deepEqual(wearGameInventoryStack(trinkets, "axe", "bind", next, rules()), { refused: "not-bindable" });
  assert.deepEqual(wearGameInventoryStack(ring.stacks, "ring", "unbind", next, rules()), { refused: "cursed" });
  const ringOn = wearGameInventoryStack(ring.stacks, "ring", "equip", next, rules());
  assert.ok(ringOn && !("refused" in ringOn));
  assert.deepEqual(wearGameInventoryStack(ringOn.stacks, "ring", "unequip", next, rules()), { refused: "cursed" });
  // Worn by a tag and not bound, an item that works only bound says so, so the Game Master binds it;
  // once bound, or for an item that never binds, nothing is said.
  const hint = "It does nothing until it is bound too";
  const party = { members: ["Bram"] };
  const wornRing = applyGameInventoryTags(`[inventory: action="equip" item="Ring"]`, trinkets, party, next, rules());
  assert.ok(wornRing.content.includes(hint), wornRing.content);
  assert.ok(
    !applyGameInventoryTags(
      `[inventory: action="equip" item="Ring"]`,
      ring.stacks,
      party,
      next,
      rules(),
    ).content.includes(hint),
  );
  assert.ok(
    !applyGameInventoryTags(`[inventory: action="equip" item="Coat"]`, coat, party, next, rules()).content.includes(
      hint,
    ),
  );
  const lifted = wearGameInventoryStack(ring.stacks, "ring", "unbind", next, rules("game-master"));
  assert.ok(lifted && !("refused" in lifted));
  assert.deepEqual(worn(lifted.stacks), ["Ring 1 player", "Bell 1 player", "Axe 1 player"]);
  // A bound item of Bram's is his: the player's binding limit counts only their own.
  const bramsRing = [
    ...trinkets,
    { id: "bram-ring", name: "Ring", item: "gear/ring", quantity: 1, holder: "Bram", bound: true as const },
  ];
  const mineToo = wearGameInventoryStack(bramsRing, "ring", "bind", next, rules());
  assert.ok(mineToo && !("refused" in mineToo));
  // Nor use it up by name (a classic fight's Use takes by name), though the Game Master can.
  assert.deepEqual(takeFromGameInventory(ring.stacks, "ring", 1, undefined, rules()).taken, 0);
  assert.equal(takeFromGameInventory(ring.stacks, "ring", 1, undefined, rules("game-master")).taken, 1);
  assert.deepEqual(
    applyGameInventoryOps(ring.stacks, [{ op: "take", name: "Ring", count: 1 }], next, rules()).results,
    [{ ok: false, reason: "cursed" }],
  );
  // Nor can the player give it away or throw it out, though the Game Master can.
  assert.equal(giveGameInventoryStack(ring.stacks, "ring", "Bram", undefined, next, rules()), null);
  assert.equal(setGameInventoryStackQuantity(ring.stacks, "ring", 0, next, rules()), ring.stacks);
  assert.ok(giveGameInventoryStack(ring.stacks, "ring", "Bram", undefined, next, rules("game-master")));

  // A worn or bound stack stays one item: never topped up or merged, and anything set past one goes
  // beside it unworn. Handed to somebody else, it is neither worn nor bound.
  const quiver = [of("Axe", 1, { id: "worn-axe", equipped: true }), of("Axe", 2, { id: "axes" })];
  assert.deepEqual(worn(addToGameInventoryNamed(quiver, "Axe", 1, next, undefined, rules())!.stacks), [
    "Axe 1 player worn",
    "Axe 3 player",
  ]);
  assert.deepEqual(worn(addToGameInventoryNamed([quiver[0]!], "Axe", 1, next, undefined, rules())!.stacks), [
    "Axe 1 player worn",
    "Axe 1 player",
  ]);
  assert.equal(mergeGameInventoryStacks(quiver, "axes", "worn-axe", rules()), quiver);
  assert.equal(mergeGameInventoryStacks(quiver, "worn-axe", "axes", rules()), quiver);
  assert.deepEqual(worn(setGameInventoryStackQuantity(quiver, "worn-axe", 3, next, rules())), [
    "Axe 1 player worn",
    "Axe 2 player",
    "Axe 2 player",
  ]);
  assert.deepEqual(worn(giveGameInventoryStack(quiver, "worn-axe", "Bram", undefined, next, rules())!.stacks), [
    "Axe 1 Bram",
    "Axe 2 player",
  ]);
  // Nobody is handed more than they can carry at all.
  const loaded = [of("Arrow", 11, { id: "full", holder: "Bram" }), of("Coat", 1, { id: "spare-coat" })];
  assert.equal(giveGameInventoryStack(loaded, "spare-coat", "Bram", undefined, next, rules()), null);
  assert.ok(giveGameInventoryStack(loaded, "spare-coat", "Bram", undefined, next, { ...rules(), bearer: undefined }));
  // Pouring a stack into somebody else's hands it over, so it is held to their limit like a give: the
  // player's two arrows would take Bram's eleven to 13 of 12. Within one bag nothing changes hands,
  // so a player at their limit still pours their own stacks together.
  const poured = [of("Arrow", 11, { id: "bram-arrows", holder: "Bram" }), of("Arrow", 2, { id: "my-arrows" })];
  assert.equal(mergeGameInventoryStacks(poured, "my-arrows", "bram-arrows", rules()), poured);
  assert.deepEqual(
    applyGameInventoryOps(poured, [{ op: "merge", from: "my-arrows", into: "bram-arrows" }], next, rules()).results,
    [{ ok: false, reason: "too-heavy" }],
  );
  assert.deepEqual(
    worn(mergeGameInventoryStacks(poured, "my-arrows", "bram-arrows", { ...rules(), bearer: undefined })),
    ["Arrow 13 Bram"],
  );
  const full = [of("Arrow", 10, { id: "ten" }), of("Arrow", 2, { id: "two" })];
  assert.deepEqual(worn(mergeGameInventoryStacks(full, "two", "ten", rules())), ["Arrow 12 player"]);
  // Only what moves is weighed: with five arrows to a stack, one of the player's five goes into Bram's
  // four, which takes him from 11 to 12.
  const fives: GameInventoryItemRules = {
    ...rules(),
    itemOf: (item) => {
      const found = rules().itemOf(item);
      return found?.item === "gear/arrow" ? { ...found, stack: 5 } : found;
    },
  };
  const topped = [
    of("Arrow", 4, { id: "bram-four", holder: "Bram" }),
    of("Coat", 1, { id: "bram-coat", holder: "Bram" }),
    of("Axe", 4, { id: "bram-axes", holder: "Bram" }),
    of("Arrow", 5, { id: "my-five" }),
  ];
  assert.deepEqual(worn(mergeGameInventoryStacks(topped, "my-five", "bram-four", fives)), [
    "Arrow 5 Bram",
    "Coat 1 Bram",
    "Axe 4 Bram",
    "Arrow 4 player",
  ]);
  // Taking by name takes what nobody wears first.
  assert.deepEqual(worn(takeFromGameInventory(quiver, "axe", 2).stacks), ["Axe 1 player worn"]);

  // Loads: an item's weight times how many, fractions included.
  const packed = [of("Coat"), of("Arrow", 5, { holder: "Bram" }), of("Dart", 8), of("Feather", 3)];
  assert.equal(gameInventoryLoad(packed, undefined, rules()), 5);
  assert.equal(gameInventoryLoad(packed, "Bram", rules()), 5);
  assert.equal(gameInventoryLoad(packed, undefined, undefined), 0, "without rules nothing weighs anything");
  assert.deepEqual(gameInventoryBearerStatus(packed, undefined, rules()), {
    load: 5,
    encumberedAbove: 6,
    limit: 12,
    encumbered: false,
    bound: 0,
    bindingMax: 1,
    slots: [
      { id: "body", label: "Body", count: 1, used: 0 },
      { id: "hands", label: "Hands", count: 2, used: 0 },
      { id: "finger", label: "Finger", count: 1, used: 0 },
    ],
  });
  assert.equal(gameInventoryBearerStatus([...packed, of("Axe", 2)], undefined, rules()).encumbered, true);

  // Placing an addition into the shared view.
  const shared = { among: [undefined, "Bram"] };
  const place = (
    stacks: GameInventoryStack[],
    name: string,
    count: number,
    into: Parameters<typeof placeGameInventoryAddition>[3] = shared,
  ) =>
    placeGameInventoryAddition(
      stacks,
      { name, item: known.find((each) => each.name === name)!.item },
      count,
      into,
      rules(),
    );
  // All of it to the first who can carry it without strain: the player, then Bram.
  assert.deepEqual(place([], "Coat", 1), { shares: [{ holder: undefined, count: 1 }], left: 0 });
  const strained = [of("Coat"), of("Arrow", 5, { holder: "Bram" })];
  assert.deepEqual(place(strained, "Arrow", 4), { shares: [{ holder: "Bram", count: 4 }], left: 0 });
  // Nobody has room for all five, but there is room between them: the most room first, so Bram's 4,
  // then 1 for the player.
  assert.deepEqual(place(strained, "Arrow", 5), {
    shares: [
      { holder: undefined, count: 1 },
      { holder: "Bram", count: 4 },
    ],
    left: 0,
  });
  // Nobody has room for all ten: split by the room left (Bram 4, the player 3), then one at a time to
  // whoever is then least over.
  assert.deepEqual(place(strained, "Arrow", 10), {
    shares: [
      { holder: undefined, count: 5 },
      { holder: "Bram", count: 5 },
    ],
    left: 0,
  });
  // A bag named twice is asked once: Bram (room 7 to his limit) is never counted twice.
  assert.deepEqual(place(strained, "Arrow", 20, { among: ["Bram", "bram", "BRAM"] }), {
    shares: [{ holder: "Bram", count: 7 }],
    left: 13,
  });
  // Past everyone's limit, the rest is left behind.
  const heavy = [of("Coat"), of("Arrow", 5), of("Arrow", 10, { holder: "Bram" })];
  assert.deepEqual(place(heavy, "Bow", 4), {
    shares: [
      { holder: undefined, count: 2 },
      { holder: "Bram", count: 1 },
    ],
    left: 1,
  });
  // What weighs nothing, and anything in a game that does not say what anyone carries, goes to the first.
  assert.deepEqual(place(heavy, "Feather", 50), { shares: [{ holder: undefined, count: 50 }], left: 0 });
  assert.deepEqual(
    placeGameInventoryAddition(heavy, { name: "Bow", item: "gear/bow" }, 4, shared, { ...rules(), bearer: undefined }),
    { shares: [{ holder: undefined, count: 4 }], left: 0 },
  );
  // Into one bag: up to its bearer's limit, never past it; nothing when nothing fits.
  assert.deepEqual(place(heavy, "Arrow", 6, {}), { shares: [{ holder: undefined, count: 4 }], left: 2 });
  assert.deepEqual(place(heavy, "Bow", 1, { holder: "Bram" }), { shares: [{ holder: "Bram", count: 1 }], left: 0 });
  assert.deepEqual(place([...heavy, of("Axe", 2, { holder: "Bram" })], "Bow", 1, { holder: "Bram" }), {
    shares: [],
    left: 1,
  });
  // A quarter-pound dart fits exactly, with no rounding error.
  assert.deepEqual(place([of("Coat"), of("Axe", 8)], "Dart", 4, {}), {
    shares: [{ holder: undefined, count: 4 }],
    left: 0,
  });

  // The operations: an add into the shared view says where each part went and what was left; an add
  // nobody can carry is refused; a give past the receiver's limit and a cursed item's refusals say so;
  // equipping answers with the stack it ended in.
  const ops = applyGameInventoryOps(
    heavy,
    [
      { op: "add", name: "Bow", count: 4, among: ["", "Bram"], log: true },
      { op: "add", name: "Bow", count: 1, among: ["", "Bram"] },
      { op: "add", name: "Feather", count: 2, holder: "Bram" },
    ],
    next,
    rules(),
  );
  assert.deepEqual(ops.results, [
    {
      ok: true,
      id: ops.stacks.find((stack) => stack.name === "Bow" && !stack.holder)!.id,
      count: 3,
      now: 2,
      placed: [
        { count: 2, now: 2 },
        { holder: "Bram", count: 1, now: 1 },
      ],
      left: 1,
    },
    { ok: false, reason: "too-heavy" },
    { ok: true, id: ops.stacks.find((stack) => stack.name === "Feather")!.id, count: 2, now: 2 },
  ]);
  assert.deepEqual(ops.journal, [{ item: "Bow", action: "acquired", quantity: 3 }]);
  const wearOps = applyGameInventoryOps(
    [...trinkets, of("Bow", 1, { id: "bow" }), of("Axe", 1, { id: "bram-axe", holder: "Bram" })],
    [
      { op: "bind", id: "ring" },
      { op: "unbind", id: "ring" },
      { op: "give", id: "ring", to: "Bram" },
      { op: "set", id: "ring", quantity: 0 },
      { op: "equip", id: "bell" },
      // The player carries 3 (an axe and a bow): five more bows (10) would pass 12, four (8) would not.
      { op: "set", id: "bow", quantity: 6 },
      { op: "set", id: "bow", quantity: 5 },
      { op: "set", id: "bow", quantity: 1 },
      { op: "give", id: "bow", to: "Bram", count: 1 },
      { op: "equip", id: "missing" },
    ],
    next,
    rules(),
  );
  assert.deepEqual(
    wearOps.results.map((result) => (result.ok ? `ok ${result.id ?? ""}` : result.reason)),
    [
      "ok ring",
      "cursed",
      "cursed",
      "cursed",
      "not-wearable",
      "too-heavy",
      "ok bow",
      "ok bow",
      "ok bow",
      "missing-stack",
    ],
  );

  // Worn and bound counts are part of an item's line, and of whether two inventories are the same.
  assert.deepEqual(
    gameInventoryTotals([of("Axe", 1, { equipped: true }), of("Axe", 2), of("Ring", 1, { bound: true })]),
    [
      { name: "Axe", quantity: 3, item: "gear/axe", equipped: 1 },
      { name: "Ring", quantity: 1, item: "gear/ring", bound: 1 },
    ],
  );
  assert.equal(sameGameInventory([of("Axe", 1, { equipped: true })], [of("Axe", 1)]), false);
  assert.equal(sameGameInventory([of("Ring", 1, { bound: true })], [of("Ring", 1)]), false);
}

// ── The amount field ──
{
  assert.equal(parseInventoryAmount("300", 10), 300);
  assert.equal(parseInventoryAmount(" +100 ", 300), 400);
  assert.equal(parseInventoryAmount("-50", 300), 250);
  assert.equal(parseInventoryAmount("- 500", 300), 0, "taking more than there is empties the stack");
  assert.equal(parseInventoryAmount("0", 300), 0);
  for (const text of ["", "abc", "1.5", "+", "3e2", "--5"]) {
    assert.equal(parseInventoryAmount(text, 300), null, `"${text}" is not an amount`);
  }
  assert.equal(parseInventoryAmount(String(GAME_INVENTORY_MAX_QUANTITY + 1), 0), null);
  assert.equal(parseInventoryAmount("+1", GAME_INVENTORY_MAX_QUANTITY), null);
  assert.equal(defaultInventorySplitSize(300), 150);
  assert.equal(defaultInventorySplitSize(3), 1);
  assert.equal(defaultInventorySplitSize(2), 1);
}

console.log("game-inventory-stacks regression passed");
