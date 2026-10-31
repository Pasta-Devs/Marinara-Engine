/**
 * Game Mode's inventory, slice I2: a bag per party member, one route for every change, and the Game
 * Master's tags applied on the server.
 *
 * What is pinned here:
 *   - A stack's `holder` names who carries it; none is the player, so a saved game reads unchanged.
 *     Adding and renaming stay inside one bag, taking by name without a bag takes the player's own
 *     first, giving moves some or all of a stack into another bag, and a merge follows its target.
 *   - Every change is one operation, applied in order by one function, a refused one changing nothing
 *     and stopping nothing; the detailed inventory follows by difference and keeps its notes.
 *   - The `[inventory:]` grammar: every form the browser read before, plus `who`, `to` and `give`; a
 *     `result` the Game Master writes is never believed, and each item is answered on its own.
 *   - Applying a reply's tags: who and to are matched like a sheet command's who, a refusal says why,
 *     and the journal hears of what was gained and lost.
 *   - The route saves the stacks, the detailed inventory and the journal together, and refuses a
 *     malformed request whole.
 *   - A tracker rebuilding a turn's row keeps that turn's detailed inventory.
 *   - The Game Master sees who carries what once anyone but the player carries something.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  addToGameInventory,
  applyGameInventoryOps,
  applyGameInventoryTags,
  carryGameInventory,
  followGameInventoryDetails,
  gameInventoryFightEffects,
  gameInventoryFightLines,
  gameInventoryPlainItemId,
  gameInventoryTotals,
  gameInventoryBags,
  gameInventoryForTelling,
  gameInventoryTellingStart,
  readGameInventoryTurn,
  recordGameInventoryTelling,
  sameGameInventory,
  gameInventoryCount,
  giveGameInventoryStack,
  mergeGameInventoryStacks,
  normalizeGameInventoryStacks,
  parseInventoryTagBody,
  readResolvedInventoryTags,
  refuseGameInventoryTags,
  renameGameInventoryStack,
  replaceTrailingInventoryTags,
  resolveGameInventoryHolder,
  serializeInventoryTag,
  swapGameInventoryStacks,
  takeFromGameInventory,
  type GameInventoryItemRules,
  type GameInventoryStack,
  type InventoryItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-inventory-bags-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

let counter = 0;
const nextId = () => `st-new-${++counter}`;
const bag = (): GameInventoryStack[] => [
  { id: "a", name: "Rope", quantity: 2 },
  { id: "b", name: "Arrow", quantity: 10, holder: "Bram" },
  { id: "c", name: "Arrow", quantity: 5 },
  { id: "d", name: "Torch", quantity: 1, holder: "Cass" },
];

try {
  // ── Holders are read, kept and compared like a name on a card ──
  {
    const read = normalizeGameInventoryStacks([
      { id: "x", name: "Rope", quantity: 1, holder: "  Bram   Stoker " },
      { id: "y", name: "Map", quantity: 1, holder: "   " },
      { id: "z", name: "Coin", quantity: 3, holder: 42 },
      // No letter or digit keys to nothing, which is the player's bag, so it is kept as the player's.
      { id: "w", name: "Gem", quantity: 1, holder: "???" },
    ]);
    assert.deepEqual(read, [
      { id: "x", name: "Rope", quantity: 1, holder: "Bram Stoker" },
      { id: "y", name: "Map", quantity: 1 },
      { id: "z", name: "Coin", quantity: 3 },
      { id: "w", name: "Gem", quantity: 1 },
    ]);
    // A saved game from before bags is the player's own bag, byte for byte.
    const legacy = [{ id: "st-rope-0", name: "Rope", quantity: 2 }];
    assert.deepEqual(normalizeGameInventoryStacks(legacy), legacy);
    assert.deepEqual(
      carryGameInventory(bag(), [{ name: "Lantern", quantity: 1 }]).map((stack) => stack.holder ?? "player"),
      ["player", "Bram", "player", "Cass", "player"],
      "the next session keeps every bag, and a detailed-only item goes to the player",
    );
  }

  // ── Adding stays inside one bag ──
  {
    const toBram = addToGameInventory(bag(), "arrow", 3, nextId, "bram");
    assert.equal(toBram.find((stack) => stack.id === "b")?.quantity, 13, "Bram's arrows, matched any case");
    assert.equal(toBram.find((stack) => stack.id === "c")?.quantity, 5, "the player's arrows untouched");
    const toCass = addToGameInventory(bag(), "Rope", 1, nextId, "Cass");
    assert.deepEqual(toCass.at(-1), { id: `st-new-${counter}`, name: "Rope", quantity: 1, holder: "Cass" });
    assert.equal(toCass.find((stack) => stack.id === "a")?.quantity, 2, "the player's rope is not Cass's");
    const toPlayer = addToGameInventory(bag(), "Torch", 1, nextId);
    assert.equal(toPlayer.at(-1)?.holder, undefined, "no holder is the player's own bag");
  }

  // ── Taking by name: one bag, or the player's own first ──
  {
    const anyone = takeFromGameInventory(bag(), "Arrow", 7);
    assert.equal(anyone.taken, 7);
    assert.equal(
      anyone.stacks.find((stack) => stack.id === "c"),
      undefined,
      "the player's 5 went first",
    );
    assert.equal(anyone.stacks.find((stack) => stack.id === "b")?.quantity, 8, "then 2 of Bram's");
    const bramOnly = takeFromGameInventory(bag(), "Arrow", 99, { holder: "BRAM" });
    assert.equal(bramOnly.taken, 10);
    assert.equal(bramOnly.stacks.find((stack) => stack.id === "c")?.quantity, 5);
    assert.equal(takeFromGameInventory(bag(), "Torch", 1, {}).taken, 0, "the player has no torch");
    assert.equal(gameInventoryCount(bag(), "arrow"), 15);
    assert.equal(gameInventoryCount(bag(), "arrow", { holder: "Bram" }), 10);
    assert.equal(gameInventoryCount(bag(), "arrow", {}), 5);
  }

  // ── Bags for the Game Master: the player's first, empty ones left out ──
  {
    assert.deepEqual(gameInventoryBags(bag()), [
      {
        items: [
          { name: "Rope", quantity: 2 },
          { name: "Arrow", quantity: 5 },
        ],
      },
      { holder: "Bram", items: [{ name: "Arrow", quantity: 10 }] },
      { holder: "Cass", items: [{ name: "Torch", quantity: 1 }] },
    ]);
    assert.deepEqual(gameInventoryBags([{ id: "q", name: "Map", quantity: 1, holder: "Bram" }]), [
      { holder: "Bram", items: [{ name: "Map", quantity: 1 }] },
    ]);
    // The player's own bag leads even when a companion's stack is listed first.
    assert.deepEqual(
      gameInventoryBags([
        { id: "q", name: "Map", quantity: 1, holder: "Bram" },
        { id: "r", name: "Rope", quantity: 1 },
      ]).map((entry) => entry.holder ?? "player"),
      ["player", "Bram"],
    );
  }

  // ── Giving, swapping, renaming and merging across bags ──
  {
    const whole = giveGameInventoryStack(bag(), "a", "Bram", undefined, nextId);
    assert.deepEqual(whole?.stacks[0], { id: "a", name: "Rope", quantity: 2, holder: "Bram" }, "keeps its id");
    const part = giveGameInventoryStack(bag(), "c", "Bram", 2, nextId);
    assert.equal(part?.id, "b", "onto the receiver's own stack of the item");
    assert.equal(part?.stacks.find((stack) => stack.id === "b")?.quantity, 12);
    assert.equal(part?.stacks.find((stack) => stack.id === "c")?.quantity, 3);
    const back = giveGameInventoryStack(bag(), "d", undefined, undefined, nextId);
    assert.equal(back?.stacks.find((stack) => stack.id === "d")?.holder, undefined, "to the player");
    const unnamed = giveGameInventoryStack(bag(), "d", "…", undefined, nextId);
    assert.equal(unnamed?.stacks.find((stack) => stack.id === "d")?.holder, undefined, "a name keying to nothing too");
    const same = bag();
    assert.equal(giveGameInventoryStack(same, "b", "bram")?.stacks, same, "into its own bag changes nothing");
    for (const count of [0, 11, 1.5, Number.NaN]) {
      assert.equal(giveGameInventoryStack(bag(), "b", "Cass", count), null, `a count of ${count} is refused`);
    }
    assert.equal(giveGameInventoryStack(bag(), "missing", "Cass"), null);

    const swapped = swapGameInventoryStacks(bag(), "a", "d");
    assert.deepEqual(
      swapped.map((stack) => stack.id),
      ["d", "b", "c", "a"],
    );
    assert.equal(swapGameInventoryStacks(same, "a", "nope"), same);

    // A rename is a nickname: arrows called Rope are still arrows, in their own stack.
    const renamed = renameGameInventoryStack(bag(), "c", "Rope");
    assert.equal(renamed?.id, "c");
    assert.deepEqual(
      renamed?.stacks.find((stack) => stack.id === "c"),
      {
        id: "c",
        name: "Arrow",
        nickname: "Rope",
        quantity: 5,
      },
    );
    assert.equal(renamed?.stacks.find((stack) => stack.id === "a")?.quantity, 2, "the rope is untouched");
    // A nickname travels with its stack, part of it or all of it, into a bag that has none of the item.
    const partNicknamed = renameGameInventoryStack(bag(), "a", "Grandpa's rope")!.stacks;
    assert.deepEqual(giveGameInventoryStack(partNicknamed, "a", "Cass", 1, nextId)?.stacks.at(-1), {
      id: `st-new-${counter}`,
      name: "Rope",
      nickname: "Grandpa's rope",
      quantity: 1,
      holder: "Cass",
    });
    const nicknamed = renameGameInventoryStack(bag(), "d", "Brand")!.stacks;
    assert.deepEqual(giveGameInventoryStack(nicknamed, "d", undefined, undefined, nextId)?.stacks.at(-1), {
      id: "d",
      name: "Torch",
      nickname: "Brand",
      quantity: 1,
    });

    // A merge follows its target, so dropping onto another bag's stack hands it over.
    const merged = mergeGameInventoryStacks(bag(), "c", "b");
    assert.deepEqual(
      merged.find((stack) => stack.id === "b"),
      {
        id: "b",
        name: "Arrow",
        quantity: 15,
        holder: "Bram",
      },
    );
  }

  // ── Operations: in order, results each, refusals change nothing and stop nothing ──
  {
    const outcome = applyGameInventoryOps(
      bag(),
      [
        { op: "add", name: "Map", count: 1, holder: "Cass", log: true },
        { op: "take", name: "Lantern", count: 1 },
        { op: "give", id: "b", to: "Cass", count: 4 },
        { op: "set", id: "a", quantity: 1 },
        { op: "split", id: "b", size: 2 },
        { op: "merge", from: "missing", into: "a" },
        { op: "rename", id: "d", name: "Brand" },
        { op: "swap", first: "a", second: "c" },
        { op: "take", name: "Arrow", count: 3, as: "used" },
      ],
      nextId,
    );
    assert.deepEqual(
      outcome.results.map((result) => (result.ok ? "ok" : result.reason)),
      ["ok", "none-held", "ok", "ok", "ok", "missing-stack", "ok", "ok", "ok"],
    );
    assert.deepEqual(outcome.results[0], {
      ok: true,
      id: outcome.results[0]!.ok ? outcome.results[0]!.id : "",
      count: 1,
      now: 1,
    });
    assert.equal(outcome.results[2]!.ok && outcome.results[2]!.now, 4, "Cass now holds 4 arrows");
    assert.deepEqual(outcome.journal, [
      { item: "Map", action: "acquired", quantity: 1 },
      { item: "Rope", action: "removed", quantity: 1 },
      { item: "Arrow", action: "used", quantity: 3 },
    ]);
    assert.deepEqual(
      outcome.stacks.find((stack) => stack.id === "d"),
      { id: "d", name: "Torch", nickname: "Brand", quantity: 1, holder: "Cass" },
      "a rename is a nickname on its stack",
    );
    assert.equal(gameInventoryCount(outcome.stacks, "Arrow", {}), 2, "the player's arrows went first");
    // Nothing that was refused moved anything.
    const untouched = bag();
    const refused = applyGameInventoryOps(untouched, [
      { op: "set", id: "nope", quantity: 3 },
      { op: "split", id: "d", size: 1 },
      { op: "give", id: "a", to: "Bram", count: 3 },
    ]);
    assert.equal(refused.stacks, untouched);
    assert.deepEqual(
      refused.results.map((result) => (result.ok ? "ok" : result.reason)),
      ["missing-stack", "refused", "refused"],
    );
  }

  // ── The detailed inventory is the player's own bag, one entry per item ──
  {
    const rope = gameInventoryPlainItemId("Rope");
    const arrow = gameInventoryPlainItemId("Arrow");
    const detailed: InventoryItem[] = [
      { item: rope, name: "Rope", description: "Hemp", quantity: 2, location: "pack" },
      { item: arrow, name: "Arrow", description: "", quantity: 5, location: "on_person" },
    ];
    const before = bag();
    // What a companion carries is theirs, however it changes.
    const betweenCompanions = applyGameInventoryOps(before, [{ op: "give", id: "b", to: "Cass" }]);
    assert.equal(
      followGameInventoryDetails(detailed, before, betweenCompanions.stacks),
      detailed,
      "a gift between two",
    );
    const bramGains = applyGameInventoryOps(before, [{ op: "add", name: "Arrow", count: 4, holder: "Bram" }]);
    assert.equal(followGameInventoryDetails(detailed, before, bramGains.stacks), detailed, "a companion's gain");
    const cassRenames = applyGameInventoryOps(before, [{ op: "rename", id: "d", name: "Brand" }]);
    assert.equal(followGameInventoryDetails(detailed, before, cassRenames.stacks), detailed, "a companion's rename");
    // The player's own arrows, given away, leave it.
    const given = applyGameInventoryOps(before, [{ op: "give", id: "c", to: "Cass" }]);
    assert.deepEqual(followGameInventoryDetails(detailed, before, given.stacks), [detailed[0]]);
    // A nickname is only the name the entry shows: the description and place stay, and no rename is
    // ever guessed from names, whatever else happens in the same batch.
    const renamed = applyGameInventoryOps(before, [{ op: "rename", id: "a", name: "Grandpa's rope" }]);
    assert.deepEqual(followGameInventoryDetails(detailed, before, renamed.stacks), [
      { item: rope, name: "Grandpa's rope", description: "Hemp", quantity: 2, location: "pack" },
      detailed[1],
    ]);
    const twice = applyGameInventoryOps(before, [
      { op: "rename", id: "a", name: "Brand" },
      { op: "rename", id: "a", name: "Beacon" },
      { op: "rename", id: "d", name: "Rope" },
      { op: "add", name: "Brand", count: 1, holder: "Bram" },
    ]);
    assert.deepEqual(followGameInventoryDetails(detailed, before, twice.stacks), [
      { item: rope, name: "Beacon", description: "Hemp", quantity: 2, location: "pack" },
      detailed[1],
    ]);
    // Taking takes the player's own first, and only that part leaves the player's list.
    const changed = applyGameInventoryOps(before, [
      { op: "take", name: "Arrow", count: 15 },
      { op: "add", name: "Map", count: 2 },
    ]);
    assert.deepEqual(followGameInventoryDetails(detailed, before, changed.stacks), [
      detailed[0],
      { item: gameInventoryPlainItemId("Map"), name: "Map", description: "", quantity: 2, location: "on_person" },
    ]);
    // An entry written without an item id (by a tracker, or before entries had them) is found by name
    // once, and keeps the id from then on.
    const unmarked: InventoryItem[] = [{ name: "rope", description: "Hemp", quantity: 2, location: "pack" }];
    const oneLess = applyGameInventoryOps(before, [{ op: "set", id: "a", quantity: 1 }]);
    assert.deepEqual(followGameInventoryDetails(unmarked, before, oneLess.stacks), [
      { item: rope, name: "Rope", description: "Hemp", quantity: 1, location: "pack" },
    ]);
    assert.equal(followGameInventoryDetails(unmarked, before, before), unmarked, "nothing moved, nothing written");
    // Another item's entry of the same name is never drawn from: an entry without an id is, and keeps
    // the id from then on.
    const cordNamedRope: InventoryItem[] = [
      { item: gameInventoryPlainItemId("Cord"), name: "Rope", description: "Thin", quantity: 1, location: "" },
      { name: "Rope", description: "Hemp", quantity: 2, location: "pack" },
    ];
    assert.deepEqual(followGameInventoryDetails(cordNamedRope, before, oneLess.stacks), [
      cordNamedRope[0],
      { item: rope, name: "Rope", description: "Hemp", quantity: 1, location: "pack" },
    ]);
    // An entry carrying the item's id is moved before one found only by name, and an entry nothing
    // was taken from is left exactly as it was.
    const both: InventoryItem[] = [
      { name: "Rope", description: "Old", quantity: 1, location: "" },
      { item: rope, name: "Rope", description: "Hemp", quantity: 2, location: "pack" },
    ];
    assert.deepEqual(followGameInventoryDetails(both, before, oneLess.stacks), [
      both[0],
      { item: rope, name: "Rope", description: "Hemp", quantity: 1, location: "pack" },
    ]);
    assert.deepEqual(
      followGameInventoryDetails(
        both,
        before,
        applyGameInventoryOps(before, [{ op: "set", id: "a", quantity: 3 }]).stacks,
      ),
      [both[0], { item: rope, name: "Rope", description: "Hemp", quantity: 3, location: "pack" }],
    );
    const oneMore = applyGameInventoryOps(before, [{ op: "set", id: "a", quantity: 3 }]);
    assert.deepEqual(followGameInventoryDetails(unmarked, before, oneMore.stacks), [
      { item: rope, name: "Rope", description: "Hemp", quantity: 3, location: "pack" },
    ]);
    // An entry follows its item by id whatever it is called, and an entry of another item is never
    // moved for sharing a name.
    const coil: InventoryItem[] = [
      { item: rope, name: "Coil", description: "Hemp", quantity: 2, location: "pack" },
      { item: gameInventoryPlainItemId("Cord"), name: "Rope", description: "Thin", quantity: 1, location: "" },
    ];
    assert.deepEqual(followGameInventoryDetails(coil, before, oneMore.stacks), [
      { item: rope, name: "Rope", description: "Hemp", quantity: 3, location: "pack" },
      coil[1],
    ]);
    // An entry without an id under another held item's own name is that item's: a cord nicknamed
    // "Rope" takes the cord's entry, gained or lost, never the real rope's.
    const cord = gameInventoryPlainItemId("Cord");
    const ropeAndCord: GameInventoryStack[] = [
      { id: "r", name: "Rope", quantity: 2 },
      { id: "k", name: "Cord", quantity: 1 },
    ];
    const tracked: InventoryItem[] = [
      { name: "Rope", description: "Hemp", quantity: 2, location: "pack" },
      { name: "Cord", description: "Thin", quantity: 1, location: "" },
    ];
    const cordRenamed = applyGameInventoryOps(ropeAndCord, [{ op: "rename", id: "k", name: "Rope" }]).stacks;
    assert.deepEqual(followGameInventoryDetails(tracked, ropeAndCord, cordRenamed), [
      tracked[0],
      { item: cord, name: "Rope", description: "Thin", quantity: 1, location: "" },
    ]);
    const cordGone = applyGameInventoryOps(cordRenamed, [{ op: "set", id: "k", quantity: 0 }]).stacks;
    assert.deepEqual(followGameInventoryDetails(tracked, cordRenamed, cordGone), [tracked[0]]);
    // A name the item went by is looked for before the name it takes now.
    const coiled: GameInventoryStack[] = [{ id: "r", name: "Rope", nickname: "Coil", quantity: 2 }];
    const stray: InventoryItem[] = [
      { name: "Beacon", description: "Stray", quantity: 1, location: "" },
      { name: "Coil", description: "Hemp", quantity: 2, location: "pack" },
    ];
    const toBeacon = applyGameInventoryOps(coiled, [{ op: "rename", id: "r", name: "Beacon" }]).stacks;
    assert.deepEqual(followGameInventoryDetails(stray, coiled, toBeacon), [
      stray[0],
      { item: rope, name: "Beacon", description: "Hemp", quantity: 2, location: "pack" },
    ]);
  }

  // ── The grammar: every old form, plus who, to and give ──
  {
    const forms: Array<[string, ReturnType<typeof parseInventoryTagBody>]> = [
      [
        ` action="add" item="Bronze Key, Health Potion"`,
        { action: "add", items: ["Bronze Key", "Health Potion"], whole: "Bronze Key, Health Potion", count: 1 },
      ],
      [` add item="Bronze Key"`, { action: "add", items: ["Bronze Key"], count: 1 }],
      [` item="Bronze Key" action=add`, { action: "add", items: ["Bronze Key"], count: 1 }],
      [` items="Bronze Key, Map"`, { action: "add", items: ["Bronze Key", "Map"], whole: "Bronze Key, Map", count: 1 }],
      [` remove item=Bronze Key`, { action: "remove", items: ["Bronze Key"], count: 1 }],
      [
        ` action=remove item=Bronze Key who=Bram qty=3`,
        { action: "remove", items: ["Bronze Key"], count: 3, who: "Bram" },
      ],
      [
        ` action="give" item="Rope" count="2" who="Ada" to="Bram"`,
        { action: "give", items: ["Rope"], count: 2, who: "Ada", to: "Bram" },
      ],
      [` give item="Rope" to="Bram"`, { action: "give", items: ["Rope"], count: 1, to: "Bram" }],
      [` action="add" item="Gold" quantity="50000"`, { action: "add", items: ["Gold"], count: 9999 }],
      [` action="add" item="Gold" count="-3"`, { action: "add", items: ["Gold"], count: 1 }],
      [` action="remove" note="nothing named"`, null],
      // Wearing and binding (#6801).
      [` equip item="Hand axe" who="Bram"`, { action: "equip", items: ["Hand axe"], count: 1, who: "Bram" }],
      [` action="unbind" item="Widow's ring"`, { action: "unbind", items: ["Widow's ring"], count: 1 }],
      [
        ` action="unequip" item="Coat, Bow"`,
        { action: "unequip", items: ["Coat", "Bow"], whole: "Coat, Bow", count: 1 },
      ],
      [` bind item="Bell"`, { action: "bind", items: ["Bell"], count: 1 }],
      // A count written into the name (cloud re-test 2026-10-25: "Arrows ×10" was a new item at 1).
      [` add item="Arrows ×10"`, { action: "add", items: ["Arrows"], count: 10 }],
      [` add item="Arrows x10"`, { action: "add", items: ["Arrows"], count: 10 }],
      [` add item="Crossbow bolts×20"`, { action: "add", items: ["Crossbow bolts"], count: 20 }],
      [` add item="20 crossbow bolts"`, { action: "add", items: ["crossbow bolts"], count: 20 }],
      [` add item="50 feet of hempen rope"`, { action: "add", items: ["50 feet of hempen rope"], count: 1 }],
      [` add item="Arrows (20)"`, { action: "add", items: ["Arrows (20)"], count: 1 }],
      [` add item="Arrows ×10" count="3"`, { action: "add", items: ["Arrows ×10"], count: 3 }],
      [` add item="Box"`, { action: "add", items: ["Box"], count: 1 }],
    ];
    for (const [body, expected] of forms) assert.deepEqual(parseInventoryTagBody(body), expected, body);
    // What the Game Master claims happened is not part of the request.
    assert.deepEqual(parseInventoryTagBody(` action="add" item="Gold" result="ok" now="999"`), {
      action: "add",
      items: ["Gold"],
      count: 1,
    });
    assert.equal(
      serializeInventoryTag(
        { action: "add", item: `Odd "Name" [x]`, count: 2, who: "Bram" },
        { ok: true, count: 2, now: 4 },
      ),
      `[inventory: action="add" item="Odd Name x" count="2" who="Bram" result="ok" now="4"]`,
    );
    assert.deepEqual(
      readResolvedInventoryTags(
        `A [inventory: action="remove" item="Rope" count="1" result="refused" reason="none-held"] b [inventory: action="add" item="Map"]`,
      ),
      [{ action: "remove", item: "Rope", count: 1, ok: false, reason: "none-held" }],
      "only answered tags are announced",
    );
    // An answer that changed nothing keeps its zero, so nothing is announced for it.
    assert.deepEqual(
      readResolvedInventoryTags(`[inventory: action="equip" item="Coat" count="0" result="ok" now="1"]`),
      [{ action: "equip", item: "Coat", count: 0, ok: true, now: 1 }],
    );
  }

  // ── A count typed into the Give and Split rows is digits only ──
  {
    const { parseInventoryCount } = await import("../../packages/client/src/lib/game-inventory-amount.js");
    assert.equal(parseInventoryCount(" 2 ", 3), 2);
    assert.equal(parseInventoryCount("3", 3), 3);
    for (const text of ["2abc", "1.5", "", "0", "4", "-1", "+2", "1e2"]) {
      assert.equal(parseInventoryCount(text, 3), null, `"${text}" is not a count up to 3`);
    }
  }

  // ── Correcting a saved reply's answers: only the tags this telling added ──
  {
    const earlier = `[inventory: action="add" item="Map" count="1" result="ok" now="1"]`;
    const said = `[inventory: action="remove" item="Rope" count="1" result="ok" now="0"]`;
    const really = `[inventory: action="remove" item="Rope" count="1" result="refused" reason="none-held"]`;
    assert.equal(
      replaceTrailingInventoryTags(`${earlier} The rope snaps. ${said}`, [really]),
      `${earlier} The rope snaps. ${really}`,
      "a continuation keeps what its earlier part already said",
    );
    assert.equal(replaceTrailingInventoryTags(said, []), said);
    assert.equal(
      replaceTrailingInventoryTags(`no tags`, [really]),
      `no tags`,
      "more answers than tags changes nothing",
    );
  }

  // ── The browser announces answered tags only, as the player reaches them ──
  {
    const { parseGmTags, parseSegmentInventoryUpdates } =
      await import("../../packages/client/src/lib/game-tag-parser.js");
    const saved = [
      `The chest creaks open.`,
      `[inventory: action="add" item="Map" count="1" result="ok" now="1"]`,
      ``,
      `Bram pockets a coin. [inventory: action="add" item="Coin" count="1" who="Bram" result="ok" now="3"]`,
      `A stray request nobody answered. [inventory: action="add" item="Gold"]`,
    ].join("\n");
    const tags = parseGmTags(saved);
    assert.deepEqual(
      tags.inventoryUpdates.map((tag) => `${tag.item} ${tag.who ?? "player"}`),
      ["Map player", "Coin Bram"],
    );
    assert.doesNotMatch(tags.cleanContent, /\[inventory:/, "every tag, answered or not, is kept out of the narration");
    assert.deepEqual(
      parseSegmentInventoryUpdates(saved).map((entry) => `${entry.segment} ${entry.update.item}`),
      ["0 Map", "1 Coin"],
    );
  }

  // ── The tellings of one turn (#6774) ──
  {
    const start = [{ id: "r", name: "Rope", quantity: 1 }];
    const withSword = [...start, { id: "s", name: "Sword", quantity: 1 }];
    const withShield = [...start, { id: "h", name: "Shield", quantity: 1 }];
    const told = `[inventory: action="add" item="Sword" count="1" result="ok" now="1"]`;
    const turn = recordGameInventoryTelling("m1", start, {}, 0, withSword);
    assert.deepEqual(readGameInventoryTurn(JSON.parse(JSON.stringify(turn))), turn, "stored and read back");
    assert.equal(readGameInventoryTurn({ messageId: "", before: [] }), null);

    // A retelling starts where the turn began while the stacks are what the telling it replaces left.
    const again = gameInventoryTellingStart(turn, withSword, {
      kind: "regenerate",
      messageId: "m1",
      replaced: 0,
      replacedContent: told,
    });
    assert.deepEqual(again.start, start);
    assert.deepEqual(Object.keys(again.swipes), ["0"], "the replaced telling can still be swiped back to");
    // Changed since: it builds on the stacks as they are, and forgets what it can no longer undo.
    const edited = [...withSword, { id: "m", name: "Map", quantity: 1 }];
    const onTop = gameInventoryTellingStart(turn, edited, {
      kind: "regenerate",
      messageId: "m1",
      replaced: 0,
      replacedContent: told,
    });
    assert.equal(onTop.start, edited);
    assert.deepEqual(onTop.swipes, {});
    // A telling that changed nothing left the stacks as the turn began, whatever the record says.
    const quiet = gameInventoryTellingStart(null, start, {
      kind: "regenerate",
      messageId: "m2",
      replaced: 0,
      replacedContent: `[inventory: action="remove" item="Crown" count="1" result="refused" reason="none-held"]`,
    });
    assert.equal(quiet.start, start);
    assert.deepEqual(quiet.swipes, { "0": start });
    // A continuation adds to the telling, and a new turn starts fresh.
    const continued = gameInventoryTellingStart(turn, withSword, {
      kind: "continue",
      messageId: "m1",
      replaced: 0,
      replacedContent: told,
    });
    assert.equal(continued.start, withSword);
    assert.deepEqual(continued.before, start);
    assert.deepEqual(gameInventoryTellingStart(turn, withSword, { kind: "new" }).swipes, {});

    // Switching tellings shows what the other one left, only while nothing changed the stacks.
    const two = recordGameInventoryTelling("m1", start, turn.swipes, 1, withShield);
    assert.deepEqual(gameInventoryForTelling(two, withShield, "m1", 1, 0), withSword);
    assert.equal(gameInventoryForTelling(two, edited, "m1", 0, 1), null, "changed since: left alone");
    assert.equal(gameInventoryForTelling(two, withShield, "m2", 1, 0), null, "another turn: left alone");
    assert.equal(gameInventoryForTelling(two, withShield, "m1", 1, 7), null, "a telling it never saw");
    assert.ok(sameGameInventory(withSword, JSON.parse(JSON.stringify(withSword))));
    assert.ok(!sameGameInventory(withSword, withShield));
    assert.ok(
      !sameGameInventory(withSword, renameGameInventoryStack(withSword, withSword[0]!.id, "Old faithful")!.stacks),
      "a nickname the player gave since is a change of theirs",
    );
    // Only the newest tellings are kept.
    let many = recordGameInventoryTelling("m1", start, {}, 0, start);
    for (let swipe = 1; swipe < 30; swipe += 1)
      many = recordGameInventoryTelling("m1", start, many.swipes, swipe, start);
    assert.equal(Object.keys(many.swipes).length, 20);
    assert.equal(Object.keys(many.swipes)[0], "10");
  }

  // ── Who and to, matched like a sheet command's who ──
  {
    const party = { player: "Ada Lovelace", members: ["Bram", "Cass", "Cass"] };
    assert.deepEqual(resolveGameInventoryHolder(undefined, party), { ok: true, bag: undefined });
    assert.deepEqual(resolveGameInventoryHolder("party", party), { ok: true, bag: undefined });
    assert.deepEqual(resolveGameInventoryHolder("ada lovelace", party), { ok: true, bag: {} });
    assert.deepEqual(resolveGameInventoryHolder("BRAM", party), { ok: true, bag: { holder: "Bram" } });
    assert.deepEqual(resolveGameInventoryHolder("Cass", party), { ok: false, reason: "ambiguous-character" });
    assert.deepEqual(resolveGameInventoryHolder("Dmitri", party), { ok: false, reason: "unknown-character" });
    // Somebody who left the party but still carries something can still be named.
    assert.deepEqual(
      resolveGameInventoryHolder("dmitri", party, [{ id: "q", name: "Map", quantity: 1, holder: "Dmitri" }]),
      { ok: true, bag: { holder: "Dmitri" } },
    );
  }

  // ── A reply's tags, applied and answered ──
  {
    const party = { player: "Ada", members: ["Bram", "Cass"] };
    const reply = [
      `Ada pockets a map. [inventory: action="add" item="Map, Compass" count="2"]`,
      `Bram shoulders the rope. [inventory: action="give" item="Rope" count="1" to="Bram"]`,
      `[inventory: action="remove" item="Arrow" count="7"]`,
      `[inventory: action="remove" item="Torch" who="Bram"]`,
      `[inventory: action="add" item="Gold" who="Dmitri"]`,
      `[inventory: action="give" item="Rope"]`,
      `[inventory: action="add" item="Crown" result="ok" now="1"]`,
      `[inventory: gibberish]`,
    ].join("\n");
    const outcome = applyGameInventoryTags(reply, bag(), party, nextId);
    const resolved = readResolvedInventoryTags(outcome.content);
    assert.deepEqual(
      resolved.map((tag) => `${tag.action} ${tag.item} ${tag.ok ? `ok ${tag.count}->${tag.now}` : tag.reason}`),
      [
        "add Map ok 2->2",
        "add Compass ok 2->2",
        "give Rope ok 1->1",
        "remove Arrow ok 7->8",
        "remove Torch none-held",
        "add Gold unknown-character",
        "give Rope no-recipient",
        "add Crown ok 1->1",
      ],
    );
    assert.match(outcome.content, /\[inventory: raw="gibberish" result="refused" reason="unreadable"\]/);
    assert.equal(outcome.tags, 8);
    assert.equal(gameInventoryCount(outcome.stacks, "Rope", { holder: "Bram" }), 1);
    assert.equal(gameInventoryCount(outcome.stacks, "Arrow", {}), 0, "the player's 5 arrows went first");
    assert.equal(gameInventoryCount(outcome.stacks, "Arrow", { holder: "Bram" }), 8);
    assert.deepEqual(outcome.journal, [
      { item: "Map", action: "acquired", quantity: 2 },
      { item: "Compass", action: "acquired", quantity: 2 },
      { item: "Arrow", action: "lost", quantity: 7 },
      { item: "Crown", action: "acquired", quantity: 1 },
    ]);
    // A give with no who comes out of the player's own bag, never out of someone it did not name.
    const onlyCass = applyGameInventoryTags(`[inventory: action="give" item="Torch" to="Bram"]`, bag(), party, nextId);
    assert.deepEqual(
      readResolvedInventoryTags(onlyCass.content).map((tag) => tag.reason),
      ["none-held"],
    );
    assert.equal(gameInventoryCount(onlyCass.stacks, "Torch", { holder: "Cass" }), 1);

    // A nicknamed item is found by either name, and a give hands its stack over, nickname and all.
    const nicknamed = renameGameInventoryStack(bag(), "a", "Grandpa's rope")!.stacks;
    const byOwn = applyGameInventoryTags(`[inventory: action="remove" item="rope"]`, nicknamed, party, nextId);
    assert.deepEqual(
      readResolvedInventoryTags(byOwn.content).map((tag) => `${tag.item} ${tag.ok ? `ok ${tag.now}` : tag.reason}`),
      ["rope ok 1"],
    );
    const handed = applyGameInventoryTags(
      `[inventory: action="give" item="Grandpa's rope" count="2" to="Bram"]`,
      nicknamed,
      party,
      nextId,
    );
    assert.deepEqual(
      readResolvedInventoryTags(handed.content).map((tag) => `${tag.ok ? `ok ${tag.count}->${tag.now}` : tag.reason}`),
      ["ok 2->2"],
    );
    assert.deepEqual(
      handed.stacks.find((stack) => stack.id === "a"),
      {
        id: "a",
        name: "Rope",
        nickname: "Grandpa's rope",
        quantity: 2,
        holder: "Bram",
      },
    );
    // Adding by a name another bag holds makes that item, called by its own name, not a new one.
    const added = applyGameInventoryTags(
      `[inventory: action="add" item="GRANDPA'S ROPE" who="Cass"]`,
      nicknamed,
      party,
      nextId,
    );
    assert.deepEqual(added.stacks.at(-1), { id: `st-new-${counter}`, name: "Rope", quantity: 1, holder: "Cass" });
    assert.deepEqual(
      readResolvedInventoryTags(added.content).map((tag) => `${tag.ok ? `ok ${tag.now}` : tag.reason}`),
      ["ok 1"],
      "and says how many of it Cass now holds",
    );
    // An item's own name wins over another item's nickname; a named bag is read on its own, so there a
    // nickname finds its item even when somebody else holds an item of that own name.
    const cordCalledRope = [
      { id: "c", name: "Cord", nickname: "Rope", quantity: 1, holder: "Bram" },
      { id: "r", name: "Rope", quantity: 2 },
    ];
    assert.deepEqual(takeFromGameInventory(cordCalledRope, "rope", 1).stacks, [
      cordCalledRope[0],
      { id: "r", name: "Rope", quantity: 1 },
    ]);
    assert.deepEqual(takeFromGameInventory(cordCalledRope, "rope", 1, { holder: "Bram" }).stacks, [cordCalledRope[1]]);
    assert.equal(gameInventoryCount(cordCalledRope, "Rope"), 2);
    assert.equal(gameInventoryCount(cordCalledRope, "Rope", { holder: "Bram" }), 1);
    assert.equal(
      gameInventoryCount([cordCalledRope[0]!], "Rope"),
      1,
      "with no rope at all, the nickname finds the cord",
    );
    // A fight lists every item under a name no other line has, and spends it by its own name.
    assert.deepEqual(gameInventoryFightLines(cordCalledRope), [
      { name: "Rope (Cord)", quantity: 1, ownName: "Cord", shown: "Rope" },
      { name: "Rope", quantity: 2, shown: "Rope" },
    ]);
    assert.deepEqual(gameInventoryFightLines([cordCalledRope[0]!]), [
      { name: "Rope", quantity: 1, ownName: "Cord", shown: "Rope" },
    ]);
    // Even when a third item is really called what that line became.
    const lines = gameInventoryFightLines([...cordCalledRope, { id: "t", name: "Rope (Cord)", quantity: 1 }]);
    assert.deepEqual(
      lines.map((line) => [line.name, line.ownName ?? null]),
      [
        ["Rope (Cord)", "Cord"],
        ["Rope", null],
        ["Rope (Cord) 2", "Rope (Cord)"],
      ],
      "and a line listed under a number still spends its item by its own name",
    );
    assert.equal(
      takeFromGameInventory([...cordCalledRope, { id: "t", name: "Rope (Cord)", quantity: 1 }], lines[2]!.ownName!, 1)
        .taken,
      1,
    );
    // Each line's effect is found by its item's own name first, so the item really called
    // "Rope (Cord)" keeps its own effect though the cord is listed under that name, and the cord takes
    // the effect named for it.
    const heal = { name: "rope", type: "heal" };
    const tie = { name: "Cord", type: "utility" };
    const odd = { name: "Rope (Cord)", type: "buff" };
    assert.deepEqual(gameInventoryFightEffects(lines, [heal, tie, odd]), [
      { name: "Rope (Cord)", type: "utility" },
      { name: "Rope", type: "heal" },
      { name: "Rope (Cord) 2", type: "buff" },
    ]);
    // A line with no effect under its own name takes one under the name it is listed or shown by,
    // unless another line took that effect by its own name.
    assert.deepEqual(gameInventoryFightEffects(lines, [heal, odd]), [
      { name: "Rope", type: "heal" },
      { name: "Rope (Cord) 2", type: "buff" },
    ]);
    const elixir = gameInventoryFightLines([{ id: "p", name: "Healing Potion", nickname: "Elixir", quantity: 2 }]);
    assert.deepEqual(
      gameInventoryFightEffects(elixir, [
        { name: "Healing Potion", type: "heal" },
        { name: "Map", type: "utility" },
      ]),
      [
        { name: "Elixir", type: "heal" },
        { name: "Map", type: "utility" },
      ],
    );
    assert.deepEqual(
      gameInventoryFightEffects(elixir, [{ name: "elixir", type: "heal" }]),
      [{ name: "Elixir", type: "heal" }],
      "an effect named by the nickname reaches it too",
    );
    // A take answers with how many are left of the item it took, even once the last stack of it is gone
    // and the name alone would now find another item by its nickname.
    const lastRope = applyGameInventoryOps(cordCalledRope, [{ op: "take", name: "rope", count: 2 }]);
    assert.deepEqual(lastRope.stacks, [cordCalledRope[0]]);
    assert.deepEqual(lastRope.results, [{ ok: true, count: 2, now: 0 }]);
    // A give by a nickname answers with how many of the item the receiver holds, though nothing of
    // theirs carries that nickname.
    const toBramsRope = applyGameInventoryTags(
      `[inventory: action="give" item="Grandpa's rope" count="1" to="Bram"]`,
      [
        { id: "a", name: "Rope", nickname: "Grandpa's rope", quantity: 3 },
        { id: "b", name: "Rope", quantity: 2, holder: "Bram" },
      ],
      party,
      nextId,
    );
    assert.deepEqual(
      readResolvedInventoryTags(toBramsRope.content).map(
        (tag) => `${tag.ok ? `ok ${tag.count}->${tag.now}` : tag.reason}`,
      ),
      ["ok 1->3"],
    );
    // Taking by a nickname takes the item from every stack of it, whatever each one is called.
    const split = [
      { id: "g", name: "Apple", nickname: "Green apple", quantity: 100 },
      { id: "r", name: "Apple", quantity: 200 },
    ];
    assert.deepEqual(takeFromGameInventory(split, "green apple", 250).stacks, [
      { id: "r", name: "Apple", quantity: 50 },
    ]);

    // Past the cap, tags are answered as refused rather than read at any cost, even one that
    // claims it already happened.
    const flood = [
      ...Array.from({ length: 44 }, () => `[inventory: action="add" item="Pebble"]`),
      `[inventory: action="add" item="Crown" result="ok" now="1"]`,
    ].join(" ");
    const capped = applyGameInventoryTags(flood, [], party, nextId);
    assert.equal(gameInventoryCount(capped.stacks, "Pebble"), 40);
    const answers = readResolvedInventoryTags(capped.content);
    assert.equal(answers.filter((tag) => tag.ok).length, 40);
    assert.deepEqual(
      answers.filter((tag) => !tag.ok).map((tag) => `${tag.item} ${tag.reason}`),
      ["Pebble too-many", "Pebble too-many", "Pebble too-many", "Pebble too-many", "Crown too-many"],
    );

    // A reply whose tags could not be carried out at all says that nothing happened.
    const unapplied = refuseGameInventoryTags(
      `A crown! [inventory: action="add" item="Crown, Orb" result="ok" now="1"] [inventory: nonsense]`,
      "unapplied",
    );
    assert.deepEqual(
      readResolvedInventoryTags(unapplied).map((tag) => `${tag.item} ${tag.ok ? "ok" : tag.reason}`),
      ["Crown unapplied", "Orb unapplied"],
    );
    assert.match(unapplied, /\[inventory: raw="nonsense" result="refused" reason="unapplied"\]/);
  }

  // ── Wearing and carrying in the Game Master's tags (#6801) ──
  {
    const known = [
      { item: "gear/coat", name: "Coat", weight: 3, slots: { body: 1 } },
      { item: "gear/ring", name: "Ring", slots: { finger: 1 }, binds: { cursed: true } },
      { item: "gear/arrow", name: "Arrow", weight: 1 },
    ];
    const rules: GameInventoryItemRules = {
      itemNamed: (name) => known.find((each) => each.name.toLowerCase() === name.trim().toLowerCase()),
      itemOf: (item) => known.find((each) => each.item === item),
      offers: (item) => known.some((each) => each.item === item),
      slots: [
        { id: "body", label: "Body", count: 1 },
        { id: "finger", label: "Finger", count: 1 },
      ],
      // The player carries 6 without strain and 12 at most; Bram 9 and 12.
      bearer: (holder) =>
        holder ? { encumberedAbove: 9, limit: 12, bindingMax: 1 } : { encumberedAbove: 6, limit: 12, bindingMax: 1 },
      actor: "game-master",
    };
    const party = { player: "Ada", members: ["Bram"] };
    const answers = (text: string, stacks: GameInventoryStack[]) => {
      const outcome = applyGameInventoryTags(text, stacks, party, nextId, rules);
      return {
        stacks: outcome.stacks,
        tags: readResolvedInventoryTags(outcome.content).map(
          (tag) =>
            `${tag.action} ${tag.item} ${tag.who ?? "-"} ${tag.ok ? `ok ${tag.count}->${tag.now}` : `${tag.reason} ${tag.count}`}`,
        ),
      };
    };
    const packed: GameInventoryStack[] = [
      { id: "coat", name: "Coat", item: "gear/coat", quantity: 1 },
      { id: "bram-arrows", name: "Arrow", item: "gear/arrow", quantity: 5, holder: "Bram" },
    ];
    // An add with nobody named goes to whoever can carry it, answered per bag, the player's naming
    // nobody; what nobody can carry is refused as too heavy.
    assert.deepEqual(answers(`[inventory: action="add" item="Arrow" count="10"]`, packed).tags, [
      "add Arrow - ok 5->5",
      "add Arrow Bram ok 5->10",
    ]);
    assert.deepEqual(answers(`[inventory: action="add" item="Arrow" count="30"]`, packed).tags, [
      "add Arrow - ok 9->9",
      "add Arrow Bram ok 7->12",
      "add Arrow - too-heavy 14",
    ]);
    // Into one bag, only as much as its bearer can carry at all.
    assert.deepEqual(answers(`[inventory: action="add" item="Arrow" count="10" who="Bram"]`, packed).tags, [
      "add Arrow Bram ok 7->12",
      "add Arrow Bram too-heavy 3",
    ]);
    // A give past the receiver's limit is refused whole.
    assert.deepEqual(
      answers(`[inventory: action="give" item="Arrow" count="5" who="Bram" to="Ada"]`, [
        ...packed,
        { id: "arrows", name: "Arrow", item: "gear/arrow", quantity: 8 },
      ]).tags,
      ["give Arrow Bram too-heavy 5"],
    );
    // Asking for more than the giver holds weighs only what they hold: Bram's 5 fit the player.
    assert.deepEqual(answers(`[inventory: action="give" item="Arrow" count="20" who="Bram" to="Ada"]`, packed).tags, [
      "give Arrow Bram ok 5->5",
    ]);
    // Putting on, binding, and the Game Master ending a curse; each answers how many are so now.
    const ring: GameInventoryStack[] = [...packed, { id: "rings", name: "Ring", item: "gear/ring", quantity: 2 }];
    const worn = answers(
      [
        `[inventory: action="equip" item="Coat"]`,
        `[inventory: action="bind" item="Ring" count="2"]`,
        `[inventory: action="equip" item="Ring"]`,
        `[inventory: action="unbind" item="Ring"]`,
        `[inventory: action="equip" item="Arrow" who="Bram"]`,
        `[inventory: action="unequip" item="Lantern"]`,
        `[inventory: action="unequip" item="Coat"]`,
        `[inventory: action="unequip" item="Coat"]`,
      ].join(" "),
      ring,
    );
    assert.deepEqual(worn.tags, [
      "equip Coat - ok 1->1",
      "bind Ring - ok 1->1",
      "equip Ring - ok 1->1",
      "unbind Ring - ok 1->0",
      "equip Arrow Bram not-wearable 1",
      "unequip Lantern - none-held 1",
      "unequip Coat - ok 1->0",
      "unequip Coat - ok 0->0",
    ]);
    assert.deepEqual(
      worn.stacks.map(
        (stack) => `${stack.name} ${stack.quantity}${stack.equipped ? " worn" : ""}${stack.bound ? " bound" : ""}`,
      ),
      ["Coat 1", "Arrow 5", "Ring 1", "Ring 1 worn"],
    );
  }

  // ── The route and the storage ──
  const Fastify = createRequire(new URL("../../packages/server/package.json", import.meta.url))(
    "fastify",
  ) as typeof import("fastify").default;
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
  const { gameInventoryRoutes } = await import("../../packages/server/src/routes/game-inventory.routes.js");
  const { commitGameInventoryChange, followGameInventoryOnRow } =
    await import("../../packages/server/src/services/game/game-inventory.service.js");
  const { buildGmFormatReminder } = await import("../../packages/server/src/services/game/gm-prompts.js");
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(gameInventoryRoutes, { prefix: "/inventory" });
  const chats = createChatsStorage(db);
  const states = createGameStateStorage(db);
  try {
    const chat = await chats.create({ name: "Bags proof", mode: "game", characterIds: [] });
    const message = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The road." });
    await chats.patchMetadata(chat.id, { gameInventory: bag() });
    const stats = (inventory: InventoryItem[]) => ({
      stats: [],
      attributes: null,
      skills: {},
      inventory,
      activeQuests: [],
      status: "",
    });
    await states.create({
      chatId: chat.id,
      messageId: message.id,
      swipeIndex: 0,
      date: null,
      time: null,
      location: null,
      weather: null,
      temperature: null,
      presentCharacters: [],
      recentEvents: [],
      playerStats: stats([{ name: "Rope", description: "Hemp", quantity: 2, location: "pack" }]) as never,
      personaStats: null,
    });
    const post = (payload: unknown) => app.inject({ method: "POST", url: "/inventory", payload });
    const readChat = async () => {
      const row = await chats.getById(chat.id);
      return (typeof row!.metadata === "string" ? JSON.parse(row!.metadata) : row!.metadata) as Record<string, any>;
    };
    const readRow = async () => {
      const row = await states.getByChatAndMessage(chat.id, message.id, 0);
      return JSON.parse(row!.playerStats as string) as { inventory: InventoryItem[] };
    };

    const response = await post({
      chatId: chat.id,
      ops: [
        { op: "set", id: "a", quantity: 1 },
        { op: "give", id: "c", to: "Cass" },
        { op: "take", name: "Lantern", count: 1 },
      ],
    });
    assert.equal(response.statusCode, 200, response.body);
    const body = response.json() as {
      inventory: GameInventoryStack[];
      results: Array<{ ok: boolean }>;
      playerStats?: unknown;
    };
    assert.deepEqual(
      body.results.map((result) => result.ok),
      [true, true, false],
    );
    const meta = await readChat();
    assert.deepEqual(meta.gameInventory, body.inventory, "the stacks the route answered with are the saved ones");
    assert.equal(normalizeGameInventoryStacks(meta.gameInventory).find((stack) => stack.id === "c")?.holder, "Cass");
    assert.deepEqual(
      (meta.gameJournal?.inventoryLog ?? []).map((entry: { item: string; action: string; quantity: number }) => [
        entry.item,
        entry.action,
        entry.quantity,
      ]),
      [["Rope", "removed", 1]],
      "the journal in the same write",
    );
    assert.deepEqual(
      (await readRow()).inventory,
      [{ name: "Rope", description: "Hemp", quantity: 1, location: "pack", item: gameInventoryPlainItemId("Rope") }],
      "the entry it moved keeps the item it follows from then on",
    );
    assert.ok(body.playerStats, "the stats written come back for the screen");

    // A malformed request changes nothing at all.
    const before = await readChat();
    for (const payload of [
      { chatId: chat.id, ops: [] },
      { chatId: chat.id, ops: [{ op: "add", name: "Map", count: 0 }] },
      {
        chatId: chat.id,
        ops: [
          { op: "add", name: "Map", count: 1 },
          { op: "teleport", id: "a" },
        ],
      },
      { chatId: chat.id, ops: [{ op: "give", id: "a", to: "x".repeat(81) }] },
    ]) {
      assert.equal((await post(payload)).statusCode, 400, JSON.stringify(payload));
    }
    assert.deepEqual((await readChat()).gameInventory, before.gameInventory);
    assert.equal((await post({ chatId: "no-such-chat", ops: [{ op: "add", name: "Map", count: 1 }] })).statusCode, 404);

    // A change that refuses itself leaves everything as it was, the journal included.
    await assert.rejects(
      commitGameInventoryChange(db, chat.id, () => {
        throw new Error("refused whole");
      }),
      /refused whole/,
    );
    assert.deepEqual((await readChat()).gameInventory, before.gameInventory);

    // A turn's tags: the stacks first, then the turn's own row, cloned from the one before it.
    const turn = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Next." });
    const committed = await commitGameInventoryChange(
      db,
      chat.id,
      (stacks) => {
        const outcome = applyGameInventoryTags(`[inventory: action="add" item="Rope" count="2"]`, stacks, {
          members: ["Cass"],
        });
        return {
          stacks: outcome.stacks,
          journal: outcome.journal,
          value: { before: stacks, content: outcome.content },
        };
      },
      { kind: "none" },
    );
    assert.ok(committed);
    const baseSnapshot = await states.getByChatAndMessage(chat.id, message.id, 0);
    await followGameInventoryOnRow(db, chat.id, committed.value.before, committed.stacks, {
      kind: "message",
      messageId: turn.id,
      swipeIndex: 0,
      baseSnapshot,
    });
    const turnRow = async () =>
      JSON.parse((await states.getByChatAndMessage(chat.id, turn.id, 0))!.playerStats as string) as {
        inventory: InventoryItem[];
      };
    assert.equal((await turnRow()).inventory[0]!.quantity, 3, "the turn's row has the rope it gained");
    assert.equal((await readRow()).inventory[0]!.quantity, 1, "the turn before keeps what it had");

    // A tracker that rebuilds the turn's row from the turn before keeps what the tags did.
    const rebuild = (inventory: InventoryItem[], keepReplacedInventory?: boolean) =>
      states.create(
        {
          chatId: chat.id,
          messageId: turn.id,
          swipeIndex: 0,
          date: "Day 2",
          time: null,
          location: null,
          weather: null,
          temperature: null,
          presentCharacters: [],
          recentEvents: [],
          playerStats: stats(inventory) as never,
          personaStats: null,
        },
        null,
        keepReplacedInventory === undefined ? undefined : { keepReplacedInventory },
      );
    const turnBefore = [{ name: "Rope", description: "Hemp", quantity: 1, location: "pack" }];
    await rebuild(turnBefore, true);
    assert.equal((await turnRow()).inventory[0]!.quantity, 3);
    // Any other write of the row keeps the inventory it is given, an empty one included.
    await rebuild(turnBefore);
    assert.equal((await turnRow()).inventory[0]!.quantity, 1);
    await rebuild([]);
    assert.deepEqual((await turnRow()).inventory, []);
  } finally {
    await app.close();
    await closeDB();
  }

  // ── What the Game Master is shown ──
  {
    const base = { hasSceneModel: true, playerName: "Ada" } as never as Parameters<typeof buildGmFormatReminder>[0];
    const playerOnly = buildGmFormatReminder({
      ...base,
      playerInventory: [{ name: "Rope", quantity: 2 }],
      partyInventory: gameInventoryBags([{ id: "a", name: "Rope", quantity: 2 }]),
    });
    assert.match(playerOnly, /PLAYER INVENTORY: Rope ×2/, "only the player carries anything: the line is as it was");
    assert.doesNotMatch(playerOnly, /PARTY INVENTORY/);
    const shared = buildGmFormatReminder({
      ...base,
      playerInventory: [{ name: "Rope", quantity: 2 }],
      partyInventory: gameInventoryBags(bag()),
    });
    assert.match(shared, /PARTY INVENTORY:\n- Ada: Rope ×2; Arrow ×5\n- Bram: Arrow ×10\n- Cass: Torch/);
    assert.doesNotMatch(shared, /PLAYER INVENTORY/);
    assert.match(
      shared,
      /\[inventory: action="add\|remove\|give" item="Item A, Item B" count="3" who="Name" to="Name"\]/,
    );
    assert.match(shared, /Never write result, reason or now yourself/);
    // A nickname is shown with the item's own name, which the Game Master may use as well.
    const nicknamed = buildGmFormatReminder({
      ...base,
      playerInventory: gameInventoryTotals(renameGameInventoryStack(bag(), "a", "Grandpa's rope")!.stacks),
      partyInventory: gameInventoryBags(renameGameInventoryStack(bag(), "a", "Grandpa's rope")!.stacks),
    });
    assert.match(nicknamed, /- Ada: Grandpa's rope \(Rope\) ×2; Arrow ×5/);
    assert.match(nicknamed, /An item listed as "Nickname \(Name\)" is one item: write either name in item, never both/);
    // Starting gear not taken yet is the player's to take, never handed out by the Game Master (laptop v3
    // 2026-10-26: the opening gave class gear, then the kit doubled it).
    const waiting = buildGmFormatReminder({
      ...base,
      partyInventory: gameInventoryBags(bag()),
      startingGearWaiting: ["Bram", "Cass"],
    });
    assert.match(waiting, /STARTING GEAR not taken yet by Bram, Cass: the player takes each one's kit/);
    assert.doesNotMatch(shared, /STARTING GEAR/);
  }

  console.info("game inventory bag regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
