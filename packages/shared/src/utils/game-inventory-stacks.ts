/**
 * Game Mode's inventory as stacks.
 *
 * The inventory is a list of stacks, and two stacks may hold the same item: a player can split 300
 * apples into 200 and 100, and both stay apart until the player merges them again. So every stack
 * has an id, and everything that points at ONE stack (the inventory screen) uses it.
 *
 * Every stack is also some ITEM, and every stack of an item agrees on which (`gameInventoryItemId`).
 * A stack keeps the item's own name, the name it was made with, and a rename only gives it a
 * `nickname` to be shown by instead. So identity, merging, totals and fights never follow what the
 * player calls a stack. What names an item (the Game Master's `[inventory: ...]` tag, a fight
 * spending one) finds it by its own name or by any nickname a stack of it has.
 *
 * A stack can also be one of the game's ruleset's items (`item`, "<catalog>/<entry>"), which is then
 * its identity, whatever it is called. A plain item's id is worked out from its own name, so a plain
 * stack stores none. What a ruleset says about its items (which names are its items, how many one
 * stack holds, whether anything else may be added) reaches the changes as `GameInventoryItemRules`.
 *
 * Every stack is in somebody's bag. `holder` names the party member who carries it, as their card
 * names them; a stack without one is the player's own, which is every stack saved before there were
 * bags. The whole list is the shared view, so a bag is simply the stacks with one holder.
 *
 * Every function is pure and returns the same array when nothing changed, so a caller can tell a
 * refused change from an accepted one by reference.
 */

import { normalizeCharacterLookupName } from "./character-lookup-name.js";

export interface GameInventoryStack {
  id: string;
  /** The item's own name, as it was made. A rename never changes it. */
  name: string;
  /** What this stack is called instead, when the player renamed it. Never the own name again. */
  nickname?: string;
  /** The ruleset item it is, "<catalog>/<entry>". Absent for a plain item. */
  item?: string;
  quantity: number;
  /** The party member who carries it. Absent for the player's own character. */
  holder?: string;
  /** Worn by whoever carries it: it takes up their slots. A worn stack is always one item. */
  equipped?: true;
  /** Bound to whoever carries it (attuned, invested). A bound stack is always one item. */
  bound?: true;
  /** What a weapon with a clip has loaded, as a ruleset fight left it. Kept on a stack of one item
   *  only, since a loaded count is one weapon's; a weapon without one is loaded full.
   *  ponytail: a stack of several of a weapon forgets the count (each reads as full), so pouring an
   *  emptied one into another and splitting it off again reloads it; a count per weapon in the stack
   *  is the upgrade if that ever matters. */
  loaded?: number;
  /** The charges an item holds, as a ruleset fight left them. Kept on a stack of one item only, as a
   *  loaded count is, and an item without one holds all it can. */
  charges?: number;
  /** What a weapon has taken off its damage rolls for good (Capability API 1.551), corroded by what
   *  it hit, as a ruleset fight left it. Kept on a stack of one item only, as charges are. */
  corroded?: number;
  /** The levels it has ever taken in (Capability API 1.571), a Rod of Absorption's toward its 50, as a
   *  ruleset fight left them. Kept on a stack of one item only, as charges are. */
  absorbedEver?: number;
  /** Its rolled call's lasting state (Capability API 1.591): an Efreeti Bottle's kept roll (from 1),
   *  its openings, and whether it is spent for good. Kept on a stack of one item only. */
  callRoll?: GameInventoryCallRoll;
  /** The form it is in (Capability API 1.575), from 1 in its item's `forms.into`; absent, as it was
   *  made. Kept on a stack of one item only. */
  form?: number;
  /** What is left of each of its further uses that counts its own (Capability API 1.519), by its
   *  place in `moreUses` from 1. Kept on a stack of one item only, as charges are; one not here is full.
   *  Under `o` (1.624), the times it was used on with no charges left since they last came back. */
  usesLeft?: Record<string, number>;
  /** How long it has waited, in minutes of game time, for its charges (`"charges"`) or a use's own
   *  uses (its `usesLeft` key) to come back `after` a wait (Capability API 1.556), and how long it
   *  waits in all. Kept on a stack of one item only, as charges are. */
  waits?: Record<string, GameInventoryWait>;
  /** What is stored in it to be cast later (Capability API 1.524): a Ring of Spell Storing's spells.
   *  Kept on a stack of one item only, as charges are. */
  storedEntries?: GameInventoryStoredEntry[];
  /** Its switch is on (Capability API 1.170): a flame tongue's flames. Kept on a stack of one item
   *  only, as charges are; off without it. */
  on?: true;
  /** A fake (Capability API 1.79): the ruleset item this truly is, while `item` and `name` are what it
   *  passes for. Set only by a dishonest seller's sale, never by an op a client sends. Only the Game
   *  Master's view, curses, use, sale and a reveal read it; everything the player sees reads `item`. */
  truly?: string;
  /** Who has looked it over (Capability API 1.802), by their names compared without case: one try
   *  each. */
  inspected?: string[];
  /** Who looked it over and thinks it is a fake (Capability API 1.802), by their card's name: shown
   *  beside it, while it is still called what it passes for. */
  suspect?: string;
  /** The minutes of game time left before it vanishes (Capability API 1.760), counted as the clock
   *  moves: 5e's Creation, a day of vegetable matter. Kept on a stack of any size, all of it made
   *  together; nothing else is ever added to it, nor it to anything else. */
  vanishesIn?: number;
}

/** The longest a thing made to vanish lasts, in minutes of game time (1.760): ten years. */
export const GAME_INVENTORY_VANISHES_MAX_MINUTES = 5_256_000;

/** Whose bag: `holder` as a stack has it, so `{}` is the player's own. */
export interface GameInventoryBagRef {
  holder?: string;
}

/** The longest holder name kept, as long as any name a card may have. */
export const GAME_INVENTORY_HOLDER_MAX_LENGTH = 80;

/** The longest item name or nickname kept. */
export const GAME_INVENTORY_NAME_MAX_LENGTH = 120;

/** The most one stack may hold. Far past any real pile, and small enough to stay an exact integer
 *  through every sum a screen or a prompt makes of it. */
export const GAME_INVENTORY_MAX_QUANTITY = 999_999;

/** What a stack's `item` looks like: a catalog id and one of its entries' ids, `invented:` and the id
 *  of an item the Game Master invented, or `coin:` and the id of one of the ruleset's coins. No catalog
 *  id has a colon, so none can share an id with another, nor with a plain item's `plain:` one. */
export const GAME_INVENTORY_ITEM_REF_PATTERN =
  /^(?:(?:[a-z][a-z0-9_]{0,39}\/|invented:)[a-z0-9]+(?:-[a-z0-9]+)*|coin:[a-z][a-z0-9_]{0,39})$/;

/** A stack of one of the ruleset's coins is held as this `item`: coins are stacks, so a purse is the
 *  coins in one bag. */
export const GAME_INVENTORY_COIN_PREFIX = "coin:";

/** The `item` of a coin, by its unit's id. */
export function gameInventoryCoinRef(unit: string): string {
  return `${GAME_INVENTORY_COIN_PREFIX}${unit}`;
}

/** One of a ruleset's coins as the inventory pays with it: its `item`, its name, and what it is worth
 *  in its family's smallest coin. */
export interface GameInventoryCoin {
  item: string;
  name: string;
  /** Its name for exactly one, where the ruleset gives one (1.89). */
  one?: string;
  value: number;
}

/** The longest `item` kept: the longest catalog id, a slash and the longest entry id. */
const GAME_INVENTORY_ITEM_REF_MAX_LENGTH = 121;

/** One of the ruleset's items, as the inventory's changes need it. */
export interface GameInventoryRulesetItem {
  /** "<catalog>/<entry>". */
  item: string;
  /** Its label, which a stack of it is made with as its own name. */
  name: string;
  /** The most one stack of it holds, when the ruleset limits it. */
  stack?: number;
  /** What one of it weighs: its value of the ruleset's carry stat. Absent weighs nothing. */
  weight?: number;
  /** The slots it takes while equipped, by slot id. Without any, it cannot be equipped. */
  slots?: Readonly<Record<string, number>>;
  /** Drawn as it is used (Capability API 1.808): one of the ruleset's `items.drawOnUse` that takes
   *  slots. It is used while only carried, and a use puts it on (`drawGameInventoryStack`). */
  drawOnUse?: true;
  /** It has to be bound to work; `cursed` keeps it bound. Without this, it cannot be bound. Its bearer
   *  binds it only with one item of each `needsWorn` group worn, and it comes unbound when one comes
   *  off (1.313). */
  binds?: { cursed?: boolean; needsWorn?: ReadonlyArray<{ anyOf: readonly string[] }> };
  /** Bought and never carried (#6917): nothing adds it to a bag. */
  service?: true;
  /** A use spends `cost` of the `max` charges it holds (a stack without a count is full), and the last
   *  one spent rolls a d`die` that breaks it at `atMost` or under, or at `regains.atLeast` or over
   *  gives back `count`d`sides` + `flat` charges (1.271). */
  charges?: {
    cost: number;
    max: number;
    breaksOn?: {
      die: number;
      atMost?: number;
      regains?: { atLeast: number; count: number; sides: number; flat: number };
      /** What it becomes in place of breaking (1.272), "<catalog>/<entry>". */
      becomes?: string;
    };
  };
  /** It has a switch (Capability API 1.170): what turning it on does, in the ruleset's words. */
  toggle?: { label: string; freesSlots?: true };
  /** The forms it changes into (Capability API 1.575): what it is as made, then each form, by label. */
  forms?: string[];
}

/** An item the Game Master proposes, as its inventory tag gives it: every part optional, each in the
 *  ruleset's own words (an id or a label). `like` names one of the ruleset's items to start from. */
export interface GameInventoryItemProposal {
  name: string;
  like?: string;
  category?: string;
  rarity?: string;
  tags?: string[];
  /** By stat, the value as written: "1d8", "2", "yes". */
  stats?: Record<string, string>;
  /** By slot, how many it takes, as written. */
  slots?: Record<string, string>;
  /** "yes", "cursed" or "no". */
  binds?: string;
  /** What it does while worn, and while only carried, as written: "+1 Sneak; disadvantage on saves". */
  worn?: string;
  carried?: string;
  summary?: string;
}

/** What one character can carry and bind, read off their own sheet. A part the ruleset does not
 *  declare is absent: no `carry` block, nobody is ever encumbered; no `binding`, nothing binds. */
export interface GameInventoryBearer {
  /** The load they carry without being encumbered. */
  encumberedAbove?: number;
  /** The most they can carry at all. */
  limit?: number;
  /** How many items they can have bound at once. */
  bindingMax?: number;
}

/**
 * What a game's ruleset says about its items, for the changes that need it. A game without a
 * ruleset, or whose ruleset has no items, has none: every item is plain, and a stack holds up to the
 * inventory's bound.
 */
export interface GameInventoryItemRules {
  /** The ruleset's item a name is: its label, in any case. */
  itemNamed(name: string): GameInventoryRulesetItem | undefined;
  /** The ruleset's item with this id, while the ruleset still has it. */
  itemOf(item: string): GameInventoryRulesetItem | undefined;
  /** Whether an item may be added by its id: the ruleset has it and no layer of this game hides it.
   *  An item a layer hides can still be held, and `itemOf` still reads it. */
  offers(item: string): boolean;
  /** "refuse" when only the ruleset's items may be added: a player's typed-in item under
   *  `freeform: "refuse"`. */
  plain?: "allow" | "refuse";
  /** The slots every character has, by id, when the ruleset declares slots. */
  slots?: ReadonlyArray<{ id: string; label: string; count: number }>;
  /** What one character can carry and bind (`holder` as a stack has it, absent for the player). */
  bearer?(holder: string | undefined): GameInventoryBearer;
  /** What a weight is counted in ("lb"), said after one wherever it is shown (1.791). */
  weightUnit?: string;
  /** Whose change this is. The player's own leave a bound cursed item bound and where it is; the
   *  Game Master can end a curse in the story. */
  actor?: "player" | "game-master";
  /** Whether the Game Master's bare `[inventory: add]` of this item is refused (cheap-GM playtest
   *  2026-10-26: a potion added from nowhere healed twice): an item a use spends, in a game whose
   *  ruleset sells or drops its items, so it comes by a buy, a loot roll, a won fight or a give. */
  sourcedOnly?(item: string): boolean;
  /** The item a Game Master's proposal makes (or the one of that name it made before, while any of it
   *  is held), with what the Engine changed. Absent where the ruleset has no items to invent. */
  invent?(
    proposal: GameInventoryItemProposal,
    stacks: readonly GameInventoryStack[],
  ): { item: string; notes: string[] } | { refused: "no-invention" | "unreadable" | "too-many" };
  /** The coin a name is (its id or label, one or many of it, any case), with every coin of its family,
   *  largest first. Absent where the ruleset has no currencies. */
  coinNamed?(name: string):
    | {
        coin: GameInventoryCoin;
        family: readonly GameInventoryCoin[];
        /** The coins of the family some price is written in, which change comes back in where they
         *  make it. Absent when every coin of it is, or none. */
        usual?: readonly string[];
      }
    | undefined;
}

/** The most new stacks one change may start, so a small stack size can never flood a bag. */
export const GAME_INVENTORY_MAX_NEW_STACKS = 50;

/** The one spelling two names are compared by: trimmed, single-spaced, any case. */
export function gameInventoryNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Words a loose name drops: "Potion of Healing" is a "Healing Potion". */
const LOOSE_NAME_SKIPPED = new Set(["a", "an", "the", "of"]);

/** One of a word: "crossbows", "torches", "berries" are a crossbow, a torch, a berry. A last "e"
 *  goes too, so "axes" (an axe or an ax) and "axe" are one word. */
function oneOf(word: string): string {
  const one =
    word.length <= 3
      ? word
      : word.endsWith("ies")
        ? `${word.slice(0, -3)}y`
        : /(?:ches|shes|xes|sses|zes)$/.test(word)
          ? word.slice(0, -2)
          : word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")
            ? word.slice(0, -1)
            : word;
  return one.length > 2 && one.endsWith("e") ? one.slice(0, -1) : one;
}

/** A name's words in any order, each as one of it ("Crossbow, heavy" and "Heavy Crossbows"): what a
 *  name is matched by when nothing has it as written (laptop playtest 2026-10-25). */
export function gameInventoryLooseNameKey(name: string): string {
  return (
    name
      .toLowerCase()
      // A hyphen and an apostrophe keep a word whole: "hand-axe" is an id, not the Hand axe.
      .split(/[^\p{L}\p{N}'-]+/u)
      .filter((word) => word.length > 0 && !LOOSE_NAME_SKIPPED.has(word))
      .map(oneOf)
      .sort()
      .join(" ")
  );
}

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** The name a stack is shown by: its nickname, or the item's own name when it has none. */
export function gameInventoryStackLabel(stack: { name: string; nickname?: string }): string {
  return stack.nickname ?? stack.name;
}

/** A short, stable fingerprint of a name, for ids that cannot be spelled out (FNV-1a). */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * The id of the item a name makes: `plain:` and the name in lowercase letters and digits of any
 * script, joined by dashes, so "Rope", "rope" and "ROPE!" are one item and "Меч" keeps its letters.
 * A name with no letter or digit (an emoji, "???") gets a fingerprint instead, and a very long one
 * keeps its start and a fingerprint of the whole, so two names never share an id by being cut short.
 */
export function gameInventoryPlainItemId(name: string): string {
  // Accents come off Latin, Greek and Cyrillic letters only ("Épée" is "epee"); in other scripts a mark
  // is part of the letter (a Japanese dakuten, a Devanagari vowel sign), so it stays.
  const key = gameInventoryNameKey(name)
    .normalize("NFKD")
    .replace(/([\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}])\p{M}+/gu, "$1")
    .normalize("NFC");
  // A sign in front of a number is part of the name, so "Sword +1" and "Sword -1" stay two items; a
  // dash right after a letter or digit is only a hyphen. Every other mark between words is a dash.
  const dashed = key
    .replace(/(\+)(?=\p{N})|(?<![\p{L}\p{N}\p{M}])([-\u2212])(?=\p{N})|[^\p{L}\p{N}\p{M}]/gu, (_, plus, minus) =>
      plus ? "-+" : minus ? "-\u2212" : "-",
    )
    .replace(/-+/g, "-");
  // Leading and trailing dashes are trimmed by walking in from each end, not by an anchored pattern,
  // which could backtrack over a long run of dashes in a name the player typed.
  let start = 0;
  let end = dashed.length;
  while (start < end && dashed[start] === "-") start += 1;
  while (end > start && dashed[end - 1] === "-") end -= 1;
  const spelled = [...dashed.slice(start, end)];
  if (spelled.length === 0) return `plain:~${fingerprint(key)}`;
  if (spelled.length > 40) return `plain:${spelled.slice(0, 32).join("")}-${fingerprint(key)}`;
  return `plain:${spelled.join("")}`;
}

/** Which item a stack is: the ruleset item it names, or the plain item its own name makes. Every
 *  stack of an item agrees, whatever its nickname. */
export function gameInventoryItemId(stack: { name: string; item?: string }): string {
  return stack.item ?? gameInventoryPlainItemId(stack.name);
}

/** What stacks merge by: the item, and for a fake what it truly is too, so a fake never joins the real
 *  thing it passes for (or another fake of it that is something else). */
export function gameInventoryStackKind(stack: { name: string; item?: string; truly?: string }): string {
  const item = gameInventoryItemId(stack);
  return stack.truly ? `${item}|truly:${stack.truly}` : item;
}

/** The most one stack of an item holds: what its ruleset says, within the inventory's own bound. */
function stackLimit(item: string, rules: GameInventoryItemRules | undefined): number {
  return Math.min(GAME_INVENTORY_MAX_QUANTITY, rules?.itemOf(item)?.stack ?? GAME_INVENTORY_MAX_QUANTITY);
}

/** Loads are sums of weights that may be fractions (a quarter-pound dart), so they are compared to a
 *  character's limits with this much slack. */
const LOAD_SLACK = 1e-9;

/** What one of a stack's item weighs under the rules: nothing for a plain item. */
function weightOf(stack: { name: string; item?: string }, rules: GameInventoryItemRules | undefined): number {
  return stack.item ? (rules?.itemOf(stack.item)?.weight ?? 0) : 0;
}

/** What one bag weighs: every stack in it, its weight times how many. */
export function gameInventoryLoad(
  stacks: readonly GameInventoryStack[],
  holder: string | undefined,
  rules: GameInventoryItemRules | undefined,
): number {
  const bag = { holder };
  return stacks.reduce((load, stack) => load + (inBag(stack, bag) ? weightOf(stack, rules) * stack.quantity : 0), 0);
}

/** Whether `weight` more would take this bag's bearer past the most they can carry. */
function pastLimit(
  stacks: readonly GameInventoryStack[],
  holder: string | undefined,
  weight: number,
  rules: GameInventoryItemRules | undefined,
): boolean {
  if (weight <= 0) return false;
  const limit = rules?.bearer?.(holder).limit;
  return limit !== undefined && gameInventoryLoad(stacks, holder, rules) + weight > limit + LOAD_SLACK;
}

/** Whether a stack is a bound cursed item the player cannot part with. */
function keptByCurse(stack: GameInventoryStack, rules: GameInventoryItemRules | undefined): boolean {
  return (
    rules?.actor === "player" &&
    stack.bound === true &&
    stack.item !== undefined &&
    rules.itemOf(stack.item)?.binds?.cursed === true
  );
}

/** A holder as it is kept: cleaned, and absent for nobody in particular. */
export function cleanGameInventoryHolder(holder: unknown): string | undefined {
  if (typeof holder !== "string") return undefined;
  const cleaned = cleanName(holder).slice(0, GAME_INVENTORY_HOLDER_MAX_LENGTH);
  // A name with no letter or digit in it keys to nothing, which cannot be told apart from the
  // player's own bag, so it is the player's.
  return cleaned && normalizeCharacterLookupName(cleaned) ? cleaned : undefined;
}

/** The key two bags are compared by, matched the way a `who=` is: case and accents aside. The
 *  player's own bag is the empty key. */
export function gameInventoryBagKey(holder: string | undefined): string {
  return holder ? normalizeCharacterLookupName(holder) : "";
}

function inBag(stack: GameInventoryStack, bag: GameInventoryBagRef): boolean {
  return gameInventoryBagKey(stack.holder) === gameInventoryBagKey(bag.holder);
}

function withHolder<T extends GameInventoryStack>(stack: T, holder: string | undefined): T {
  const { holder: _dropped, ...rest } = stack;
  return (holder ? { ...rest, holder } : rest) as T;
}

/** A stack as it is kept: the nickname only when it is not the item's own name. */
function makeStack(stack: {
  id: string;
  name: string;
  nickname?: string;
  item?: string;
  quantity: number;
  holder?: string;
  equipped?: boolean;
  bound?: boolean;
  loaded?: number;
  charges?: number;
  corroded?: number;
  absorbedEver?: number;
  callRoll?: GameInventoryCallRoll;
  form?: number;
  usesLeft?: Record<string, number>;
  waits?: Record<string, GameInventoryWait>;
  storedEntries?: GameInventoryStoredEntry[];
  on?: boolean;
  truly?: string;
  inspected?: string[];
  suspect?: string;
  vanishesIn?: number;
}): GameInventoryStack {
  const { id, name, nickname, item, quantity, holder, equipped, bound, loaded, charges, usesLeft, on, truly } = stack;
  const { corroded, absorbedEver, callRoll, form, waits, vanishesIn, inspected, suspect } = stack;
  const { storedEntries } = stack;
  const named = nickname && gameInventoryNameKey(nickname) !== gameInventoryNameKey(name) ? { nickname } : {};
  return {
    id,
    name,
    ...named,
    ...(item ? { item } : {}),
    quantity,
    ...(holder ? { holder } : {}),
    ...(equipped ? { equipped: true as const } : {}),
    ...(bound ? { bound: true as const } : {}),
    ...(loaded !== undefined && quantity === 1 ? { loaded } : {}),
    ...(charges !== undefined && quantity === 1 ? { charges } : {}),
    ...(corroded && quantity === 1 ? { corroded } : {}),
    ...(absorbedEver && quantity === 1 ? { absorbedEver } : {}),
    ...(callRoll && quantity === 1 ? { callRoll } : {}),
    ...(form && quantity === 1 ? { form } : {}),
    ...(usesLeft && Object.keys(usesLeft).length > 0 && quantity === 1 ? { usesLeft } : {}),
    ...(waits && Object.keys(waits).length > 0 && quantity === 1 ? { waits } : {}),
    ...(storedEntries && quantity === 1 ? { storedEntries } : {}),
    ...(on && quantity === 1 ? { on: true as const } : {}),
    ...(truly && item && truly !== item ? { truly } : {}),
    ...(inspected?.length ? { inspected: inspected.slice(0, INSPECTED_MAX) } : {}),
    ...(suspect ? { suspect } : {}),
    ...(vanishesIn !== undefined && vanishesIn >= 1 ? { vanishesIn } : {}),
  };
}

/** The most inspectors one stack remembers (1.802): a party's worth. */
const INSPECTED_MAX = 12;

/**
 * A stack once somebody has looked it over (Capability API 1.802): `by`, their name, among those who
 * have tried (`tried`; a spell cast on it is no try), and the one who thinks it a fake when they do
 * (`suspect`). Unchanged for any other stack.
 */
export function markGameInventoryInspected(
  stacks: GameInventoryStack[],
  id: string,
  by: string,
  found: { tried: boolean; suspect: boolean },
): GameInventoryStack[] {
  const key = gameInventoryNameKey(by);
  return stacks.map((stack) => {
    if (stack.id !== id) return stack;
    const inspected =
      found.tried && !stack.inspected?.includes(key) ? [...(stack.inspected ?? []), key] : stack.inspected;
    return makeStack({
      ...stack,
      ...(inspected ? { inspected } : {}),
      ...(found.suspect ? { suspect: cleanName(by).slice(0, GAME_INVENTORY_HOLDER_MAX_LENGTH) } : {}),
    });
  });
}

/** Whether a stack is worn or bound: one item, kept apart from the rest of its kind. */
export function gameInventoryStackWorn(stack: { equipped?: boolean; bound?: boolean }): boolean {
  return stack.equipped === true || stack.bound === true;
}

/** A stack as it is once it leaves the one who wore it: neither worn nor bound. */
function unworn<T extends GameInventoryStack>(stack: T): T {
  const { equipped: _equipped, bound: _bound, ...rest } = stack;
  return rest as T;
}

function readItemRef(raw: unknown): string | undefined {
  return typeof raw === "string" &&
    raw.length <= GAME_INVENTORY_ITEM_REF_MAX_LENGTH &&
    GAME_INVENTORY_ITEM_REF_PATTERN.test(raw)
    ? raw
    : undefined;
}

function clampQuantity(quantity: number): number {
  return Math.max(0, Math.min(GAME_INVENTORY_MAX_QUANTITY, Math.floor(quantity)));
}

function slug(name: string): string {
  const dashed = gameInventoryNameKey(name).replace(/[^a-z0-9]+/g, "-");
  // Leading and trailing dashes are trimmed by walking in from each end, not by an anchored pattern,
  // which could backtrack over a long run of dashes in a name the player typed.
  let start = 0;
  let end = dashed.length;
  while (start < end && dashed[start] === "-") start += 1;
  while (end > start && dashed[end - 1] === "-") end -= 1;
  return dashed.slice(start, Math.min(end, start + 40)) || "item";
}

/** A fresh id no stack in `stacks` has. */
export function newGameInventoryStackId(stacks: readonly { id?: string }[]): string {
  const taken = new Set(stacks.map((stack) => stack.id));
  for (;;) {
    const id = `st-${Math.random().toString(36).slice(2, 10)}`;
    if (!taken.has(id)) return id;
  }
}

/** An entry stored in an item (Capability API 1.524): which (`<catalog>/<entry>`), the level it was
 *  paid at, and its caster's save difficulty and attack, which whoever casts it from the item uses. */
export interface GameInventoryStoredEntry {
  entry: string;
  /** Its name as it was stored. */
  label?: string;
  level: number;
  saveDifficulty?: number;
  toHit?: number;
}

/** What a stack stores (1.524) as stored: up to 20 entries, each naming one and a whole level. */
function readStoredEntries(raw: unknown): GameInventoryStoredEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const whole = (value: unknown, min: number, max: number) =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
  const kept = raw.slice(0, 20).flatMap((one): GameInventoryStoredEntry[] => {
    if (!one || typeof one !== "object" || Array.isArray(one)) return [];
    const source = one as Record<string, unknown>;
    if (typeof source.entry !== "string" || !/^[^/\s]{1,80}\/[^/\s]{1,120}$/.test(source.entry)) return [];
    if (!whole(source.level, 0, 40)) return [];
    return [
      {
        entry: source.entry,
        ...(typeof source.label === "string" && source.label.trim() && source.label.length <= 120
          ? { label: source.label.trim() }
          : {}),
        level: source.level as number,
        ...(whole(source.saveDifficulty, 1, 60) ? { saveDifficulty: source.saveDifficulty as number } : {}),
        ...(whole(source.toHit, -50, 100) ? { toHit: source.toHit as number } : {}),
      },
    ];
  });
  // Kept empty too (1.576): an item found holding some that has been emptied stays empty.
  return kept;
}

/** A stack's own uses left (1.519) as stored: whole counts by a further use's place, from 1. */
/** A wait counted in game time (1.556): the minutes waited so far, and the minutes it waits in all. */
export interface GameInventoryWait {
  waited: number;
  for: number;
}

const WAIT_MINUTES_MAX = 3650 * 24 * 60;

function readWaits(raw: unknown): Record<string, GameInventoryWait> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const minutes = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= WAIT_MINUTES_MAX;
  const kept = Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) => {
    if (!/^(?:charges|[1-9]|1[0-6]|h[1-4])$/.test(key) || !value || typeof value !== "object") return [];
    const { waited, for: needs } = value as Record<string, unknown>;
    return minutes(waited) && minutes(needs) && needs > 0 ? [[key, { waited, for: needs }] as const] : [];
  });
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/** An item's rolled call kept over its existence (Capability API 1.591). */
export interface GameInventoryCallRoll {
  kept?: number;
  ever?: number;
  spent?: true;
  /** Rounds the creature it called still stays past the fight (1.612), before a wait from its
   *  departure starts. */
  outRounds?: number;
}

function readCallRoll(raw: unknown): GameInventoryCallRoll | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const count = (value: unknown, most: number) =>
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= most ? value : undefined;
  const kept = count(source.kept, 8);
  const ever = count(source.ever, 1000);
  const outRounds = count(source.outRounds, 1_000_000);
  const read: GameInventoryCallRoll = {
    ...(kept !== undefined ? { kept } : {}),
    ...(ever !== undefined ? { ever } : {}),
    ...(outRounds !== undefined ? { outRounds } : {}),
    ...(source.spent === true ? { spent: true as const } : {}),
  };
  return Object.keys(read).length > 0 ? read : undefined;
}

function readUsesLeft(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const kept = Object.entries(raw as Record<string, unknown>).filter(
    (entry): entry is [string, number] =>
      // A further use's place from 1, or a hit's spend's after "h" (1.534), or "o" for the times it
      // was used on with no charges left (1.624).
      /^(?:[1-9]|1[0-6]|h[1-4]|o)$/.test(entry[0]) &&
      typeof entry[1] === "number" &&
      Number.isInteger(entry[1]) &&
      entry[1] >= 0 &&
      entry[1] <= 100,
  );
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/**
 * Stacks as they are stored, read tolerantly. An entry with no name is dropped, and a quantity that
 * is missing, broken or below one reads as one, as it always has. A nickname that is the item's own
 * name again, in any case, is dropped.
 *
 * An entry saved before stacks had ids gets one here, worked out from its name and how many entries
 * of that name came before it. The same saved list therefore reads with the same ids every time,
 * which keeps a selection on screen across a reload, and the id is stored with the next change.
 */
export function normalizeGameInventoryStacks(raw: unknown): GameInventoryStack[] {
  if (!Array.isArray(raw)) return [];
  const entries = raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const source = entry as Record<string, unknown>;
    const name = typeof source.name === "string" ? cleanName(source.name) : "";
    if (!name) return [];
    const parsed =
      typeof source.quantity === "number" ? source.quantity : Number.parseInt(String(source.quantity ?? ""), 10);
    const quantity =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(GAME_INVENTORY_MAX_QUANTITY, Math.floor(parsed)) : 1;
    const stored = typeof source.id === "string" ? source.id.trim() : "";
    const nickname =
      typeof source.nickname === "string"
        ? cleanName(source.nickname).slice(0, GAME_INVENTORY_NAME_MAX_LENGTH) || undefined
        : undefined;
    return [
      {
        name,
        nickname,
        item: readItemRef(source.item),
        truly: readItemRef(source.truly),
        inspected: Array.isArray(source.inspected)
          ? source.inspected
              .filter((each): each is string => typeof each === "string" && each.trim().length > 0)
              .map((each) => gameInventoryNameKey(each).slice(0, GAME_INVENTORY_HOLDER_MAX_LENGTH))
          : undefined,
        suspect:
          typeof source.suspect === "string"
            ? cleanName(source.suspect).slice(0, GAME_INVENTORY_HOLDER_MAX_LENGTH) || undefined
            : undefined,
        // Worn and bound are one item each, so a stack saved with more is read as a plain stack.
        equipped: source.equipped === true && quantity === 1,
        bound: source.bound === true && quantity === 1,
        loaded:
          typeof source.loaded === "number" && Number.isInteger(source.loaded) && source.loaded >= 0
            ? Math.min(GAME_INVENTORY_MAX_QUANTITY, source.loaded)
            : undefined,
        charges:
          typeof source.charges === "number" && Number.isInteger(source.charges) && source.charges >= 0
            ? Math.min(GAME_INVENTORY_MAX_QUANTITY, source.charges)
            : undefined,
        corroded:
          typeof source.corroded === "number" && Number.isInteger(source.corroded) && source.corroded > 0
            ? Math.min(100, source.corroded)
            : undefined,
        absorbedEver:
          typeof source.absorbedEver === "number" && Number.isInteger(source.absorbedEver) && source.absorbedEver > 0
            ? Math.min(1000, source.absorbedEver)
            : undefined,
        callRoll: readCallRoll(source.callRoll),
        form:
          typeof source.form === "number" && Number.isInteger(source.form) && source.form > 0 && source.form <= 8
            ? source.form
            : undefined,
        usesLeft: readUsesLeft(source.usesLeft),
        waits: readWaits(source.waits),
        storedEntries: readStoredEntries(source.storedEntries),
        on: source.on === true && quantity === 1,
        vanishesIn:
          typeof source.vanishesIn === "number" && Number.isInteger(source.vanishesIn) && source.vanishesIn >= 1
            ? Math.min(GAME_INVENTORY_VANISHES_MAX_MINUTES, source.vanishesIn)
            : undefined,
        quantity,
        stored,
        holder: cleanGameInventoryHolder(source.holder),
      },
    ];
  });
  // Every stored id is reserved before any is worked out, so an entry saved without one can never
  // take the id of a stack saved after it. A stored id that repeats is kept by its first holder only.
  const used = new Set<string>();
  const keeps = entries.map((entry) => {
    if (!entry.stored || used.has(entry.stored)) return false;
    used.add(entry.stored);
    return true;
  });
  const seenByName = new Map<string, number>();
  return entries.map((entry, index) => {
    const key = gameInventoryNameKey(entry.name);
    const occurrence = seenByName.get(key) ?? 0;
    seenByName.set(key, occurrence + 1);
    const { stored, ...kept } = entry;
    if (keeps[index]) return makeStack({ ...kept, id: stored });
    let id = `st-${slug(entry.name)}-${occurrence}`;
    while (used.has(id)) id = `${id}-x`;
    used.add(id);
    return makeStack({ ...kept, id });
  });
}

/** The items among `stacks` whose own name a name is, spelling aside: a plain item and a ruleset item
 *  may both be called it. */
export function gameInventoryItemsOwnNamed(stacks: readonly GameInventoryStack[], name: string): Set<string> {
  const own = gameInventoryPlainItemId(name);
  return new Set(
    stacks.filter((stack) => gameInventoryPlainItemId(stack.name) === own).map((stack) => gameInventoryItemId(stack)),
  );
}

/**
 * The items a name means among `stacks`: the items whose own name it is, when a stack of one is
 * there; otherwise every item a stack of which is nicknamed that, ignoring case; otherwise the plain
 * item the name would make. So an item's own name always wins over another item's nickname.
 */
function itemsNamed(stacks: readonly GameInventoryStack[], name: string): Set<string> {
  if (!gameInventoryNameKey(name)) return new Set();
  const own = gameInventoryPlainItemId(name);
  const ownNamed = gameInventoryItemsOwnNamed(stacks, name);
  if (ownNamed.size > 0) return ownNamed;
  const key = gameInventoryNameKey(name);
  const nicknamed = stacks.filter((stack) => stack.nickname && gameInventoryNameKey(stack.nickname) === key);
  return new Set(nicknamed.length > 0 ? nicknamed.map(gameInventoryItemId) : [own]);
}

/** The stack a name finds in one bag (the player's when `from` is absent) that a take by name takes
 *  first: the one a sale by name is about. With `fake`, a fake the name finds comes before the real
 *  thing, as a reveal by name wants. */
export function gameInventoryStackNamed(
  stacks: readonly GameInventoryStack[],
  name: string,
  from?: GameInventoryBagRef,
  fake = false,
): GameInventoryStack | undefined {
  const found = stacksNamed(stacks, name, from ?? {}).map(({ stack }) => stack);
  return (fake ? found.find((stack) => stack.truly) : undefined) ?? found[0];
}

/** A fake shown for what it truly is (Capability API 1.79): the stack becomes its true item, by that
 *  item's own name, keeping its count, its bag, its nickname and whether it is worn or bound. A count
 *  of loads or charges was the item it passed for, so it goes. Unchanged for a stack that is no fake. */
export function revealGameInventoryFake(
  stacks: GameInventoryStack[],
  id: string,
  rules?: Pick<GameInventoryItemRules, "itemOf">,
): GameInventoryStack[] {
  return stacks.map((stack) => {
    if (stack.id !== id || !stack.truly) return stack;
    const {
      truly,
      loaded: _loaded,
      charges: _charges,
      corroded: _corroded,
      absorbedEver: _absorbedEver,
      callRoll: _callRoll,
      form: _form,
      usesLeft: _usesLeft,
      waits: _waits,
      storedEntries: _stored,
      on: _on,
      suspect: _suspect,
      ...rest
    } = stack;
    return makeStack({ ...rest, item: truly, name: rules?.itemOf(truly)?.name ?? rest.name });
  });
}

/**
 * The items a name means, read against one bag's stacks when `from` is given (as a take or a give by
 * name reads it). Settled before a change, so what the change did can be counted afterwards by item,
 * even once the stacks the name was found on are gone.
 */
export function gameInventoryItemsNamed(
  stacks: readonly GameInventoryStack[],
  name: string,
  from?: GameInventoryBagRef,
): Set<string> {
  return itemsNamed(from ? stacks.filter((stack) => inBag(stack, from)) : stacks, name);
}

/** How many stacks of these items hold, across every bag or in one bag's. */
export function gameInventoryCountItems(
  stacks: readonly GameInventoryStack[],
  items: ReadonlySet<string>,
  from?: GameInventoryBagRef,
): number {
  return stacks.reduce(
    (total, stack) =>
      total + (items.has(gameInventoryItemId(stack)) && (!from || inBag(stack, from)) ? stack.quantity : 0),
    0,
  );
}

/** One line of `gameInventoryTotals`: an item, the name it is shown by, and how many there are. */
export interface GameInventoryTotal {
  name: string;
  quantity: number;
  /** The item's own name, when `name` is a nickname a player gave it. */
  ownName?: string;
  /** The ruleset item it is, when it is one. */
  item?: string;
  /** A fake's true item (`GameInventoryStack.truly`): for the Game Master's view only. */
  truly?: string;
  /** Who thinks it is a fake (1.802). */
  suspect?: string;
  /** How many of it are worn, and how many bound, when any are. */
  equipped?: number;
  bound?: number;
  /** What each stack of an item that holds charges has left, for whoever reads them. */
  charges?: Array<{ now: number; max: number }>;
}

/** One line per item: every stack of an item added together, in the order the items first appear,
 *  shown by the first stack's name. What the Game Master and a fight read, since a split is the
 *  player's own arrangement. */
export function gameInventoryTotals(
  stacks: readonly GameInventoryStack[],
  /** What a stack's item holds of its charges, for an item that holds any. */
  chargesOf?: (stack: GameInventoryStack) => { now: number; max: number } | undefined,
  /** As the party sees them, as a fight lists them: a fake on the line of what it passes for, with
   *  no truth on any line (1.79). Without it, a fake is a line of its own that carries its truth. */
  asSeen = false,
): GameInventoryTotal[] {
  const totals = new Map<string, GameInventoryTotal>();
  for (const stack of stacks) {
    const item = asSeen ? gameInventoryItemId(stack) : gameInventoryStackKind(stack);
    const line =
      totals.get(item) ??
      totals
        .set(item, {
          name: gameInventoryStackLabel(stack),
          quantity: 0,
          ...(stack.nickname ? { ownName: stack.name } : {}),
          ...(stack.item ? { item: stack.item } : {}),
          ...(stack.truly && !asSeen ? { truly: stack.truly } : {}),
        })
        .get(item)!;
    if (stack.suspect && !line.suspect) line.suspect = stack.suspect;
    line.quantity += stack.quantity;
    if (stack.equipped) line.equipped = (line.equipped ?? 0) + stack.quantity;
    if (stack.bound) line.bound = (line.bound ?? 0) + stack.quantity;
    const charges = chargesOf?.(stack);
    if (charges) line.charges = [...(line.charges ?? []), charges];
  }
  return [...totals.values()];
}

/** One line a fight lists: a total, under a name no other line has. */
export interface GameInventoryFightLine extends GameInventoryTotal {
  /** The name the item is shown by in the inventory, before anything was added to keep `name` unique. */
  shown: string;
}

/**
 * The lines a fight lists: `gameInventoryTotals`, each under a name no other line has, since a fight
 * tells items apart by name. A nickname that another line also goes by is shown with the item's own
 * name, such as "Potion (Cord)" beside a real "Potion", and a name still taken after that gets a
 * number. `ownName` stays what a spend is taken by.
 */
export function gameInventoryFightLines(stacks: readonly GameInventoryStack[]): GameInventoryFightLine[] {
  // A fake is listed as what it passes for, on that item's own line: which use is a fake's is known
  // only as it is spent (`gameInventoryFightSpendStack`).
  const totals = gameInventoryTotals(stacks, undefined, true);
  const uses = new Map<string, number>();
  for (const line of totals) {
    const key = gameInventoryNameKey(line.name);
    uses.set(key, (uses.get(key) ?? 0) + 1);
  }
  const taken = new Set<string>();
  return totals.map((line) => {
    const base =
      line.ownName && (uses.get(gameInventoryNameKey(line.name)) ?? 0) > 1
        ? `${line.name} (${line.ownName})`
        : line.name;
    let name = base;
    for (let n = 2; taken.has(gameInventoryNameKey(name)); n += 1) name = `${base} ${n}`;
    taken.add(gameInventoryNameKey(name));
    // A line listed under anything but the item's own name says what that own name is, which is what
    // a spend is taken by.
    const ownName = line.ownName ?? (name === line.name ? undefined : line.name);
    return { ...line, name, ...(ownName ? { ownName } : {}), shown: line.name };
  });
}

/**
 * A fight's item effects, each under the name of the line it belongs to. Every line first takes the
 * effect named by its item's own name, since a line's listed name may be one another item really
 * goes by (a cord nicknamed "Potion" is listed as "Potion (Cord)" beside an item called that). A
 * line with none then takes one named as it is listed or shown, unless another line took that effect
 * by its own name. Effects no line takes are kept as they are.
 */
export function gameInventoryFightEffects<T extends { name: string }>(
  lines: readonly GameInventoryFightLine[],
  effects: readonly T[],
): T[] {
  const byName = (name: string | undefined) =>
    name ? effects.find((effect) => gameInventoryNameKey(effect.name) === gameInventoryNameKey(name)) : undefined;
  const given = new Map<string, T>();
  for (const line of lines) {
    const effect = byName(line.ownName ?? line.shown);
    if (effect) given.set(line.name, effect);
  }
  const claimed = new Set(given.values());
  for (const line of lines) {
    if (given.has(line.name)) continue;
    const effect = [line.name, line.shown].map(byName).find((found) => found && !claimed.has(found));
    if (effect) given.set(line.name, effect);
  }
  const used = new Set(given.values());
  return [
    ...lines.flatMap((line) => {
      const effect = given.get(line.name);
      return effect ? [effect.name === line.name ? effect : { ...effect, name: line.name }] : [];
    }),
    ...effects.filter((effect) => !used.has(effect)),
  ];
}

/** The stacks with one party member's own bag folded into the player's (none of theirs keeps a
 *  holder): the first character card of a game with no persona, which plays as the player, so what
 *  was put in its own name and what is in the player's bag are one bag. Unchanged without one. */
export function gameInventoryFoldStandIn(
  stacks: readonly GameInventoryStack[],
  standIn: string | undefined,
): GameInventoryStack[] {
  const key = standIn ? gameInventoryBagKey(standIn) : "";
  if (!key || !stacks.some((stack) => stack.holder && gameInventoryBagKey(stack.holder) === key)) return [...stacks];
  return stacks.map((stack): GameInventoryStack => {
    if (!stack.holder || gameInventoryBagKey(stack.holder) !== key) return stack;
    const { holder: _holder, ...rest } = stack;
    return rest;
  });
}

/** Each bag's own totals, the player's first and then in the order a holder first appears. Only bags
 *  that hold something are listed. */
export function gameInventoryBags(
  stacks: readonly GameInventoryStack[],
  chargesOf?: (stack: GameInventoryStack) => { now: number; max: number } | undefined,
): Array<{ holder?: string; items: GameInventoryTotal[] }> {
  const bags = new Map<string, { holder?: string; stacks: GameInventoryStack[] }>([["", { stacks: [] }]]);
  for (const stack of stacks) {
    const key = gameInventoryBagKey(stack.holder);
    const bag = bags.get(key) ?? { ...(stack.holder ? { holder: stack.holder } : {}), stacks: [] };
    bag.stacks.push(stack);
    bags.set(key, bag);
  }
  return [...bags.values()]
    .filter((bag) => bag.stacks.length > 0)
    .map((bag) => ({
      ...(bag.holder ? { holder: bag.holder } : {}),
      items: gameInventoryTotals(bag.stacks, chargesOf),
    }));
}

/** How many of an item there are, across all its stacks, or in one bag's. */
export function gameInventoryCount(
  stacks: readonly GameInventoryStack[],
  name: string,
  from?: GameInventoryBagRef,
): number {
  const scope = from ? stacks.filter((stack) => inBag(stack, from)) : stacks;
  const items = itemsNamed(scope, name);
  return scope.reduce((total, stack) => total + (items.has(gameInventoryItemId(stack)) ? stack.quantity : 0), 0);
}

/**
 * `amount` of the item `like` is into one bag: onto the bag's stacks of that item in order, each up to
 * `limit` (never onto a worn or bound one, which stays one item), then as new stacks of at most
 * `limit` at the end, called what the bag's first stack of it is called (or what `like` is). So nothing added is ever lost, and one change never starts more than
 * `GAME_INVENTORY_MAX_NEW_STACKS` stacks: past that it is refused (null). `id` is the stack it went
 * onto first.
 */
function addLike(
  stacks: GameInventoryStack[],
  like: { name: string; nickname?: string; item?: string; truly?: string; vanishesIn?: number },
  amount: number,
  holder: string | undefined,
  makeId: () => string,
  limit: number = GAME_INVENTORY_MAX_QUANTITY,
): { stacks: GameInventoryStack[]; id: string } | null {
  const kind = gameInventoryStackKind(like);
  const bag = { holder };
  let left = amount;
  let id: string | undefined;
  let first: GameInventoryStack | undefined;
  const next = stacks.map((stack) => {
    if (gameInventoryStackKind(stack) !== kind || !inBag(stack, bag)) return stack;
    first ??= stack;
    // A worn stack, or one switched on (one item only), takes nothing more; nor does what is to vanish,
    // or anything onto what is not (1.760): each lasts as long as it was made to.
    if (gameInventoryStackWorn(stack) || stack.on || stack.vanishesIn || like.vanishesIn) return stack;
    const topUp = Math.min(Math.max(0, limit - stack.quantity), left);
    if (topUp < 1) return stack;
    left -= topUp;
    id ??= stack.id;
    return { ...stack, quantity: stack.quantity + topUp };
  });
  if (left > 0 && Math.ceil(left / limit) > GAME_INVENTORY_MAX_NEW_STACKS) return null;
  const named = first ?? like;
  const fresh: GameInventoryStack[] = [];
  while (left > 0) {
    const quantity = Math.min(left, limit);
    left -= quantity;
    fresh.push(
      makeStack({
        id: makeId(),
        name: named.name,
        nickname: named.nickname,
        item: like.item,
        truly: like.truly,
        quantity,
        holder,
        vanishesIn: like.vanishesIn,
      }),
    );
  }
  return { stacks: fresh.length > 0 ? [...next, ...fresh] : next, id: id ?? fresh[0]?.id ?? first!.id };
}

/**
 * The item a name adds into one bag (the player's when `holder` is absent). The name finds a held
 * item as every name does, the bag's own first, and otherwise the ruleset's item of that name. A
 * ruleset item also wins over a plain item that only has its name as its own. A name that finds
 * neither is a new plain item, unless the rules refuse plain items (undefined).
 */
export function gameInventoryAddedItem(
  stacks: readonly GameInventoryStack[],
  name: string,
  holder?: string,
  rules?: GameInventoryItemRules,
): { name: string; item?: string } | undefined {
  const cleaned = cleanName(name).slice(0, GAME_INVENTORY_NAME_MAX_LENGTH);
  if (!cleaned) return undefined;
  const bag = { holder: cleanGameInventoryHolder(holder) };
  const items = itemsNamed(stacks, cleaned);
  const typed = rules?.itemNamed(cleaned);
  const plainOwn = gameInventoryPlainItemId(cleaned);
  const held = (stack: GameInventoryStack) =>
    items.has(gameInventoryItemId(stack)) && !(typed && gameInventoryItemId(stack) === plainOwn);
  const known = stacks.find((stack) => held(stack) && inBag(stack, bag)) ?? stacks.find(held);
  if (known) return { name: known.name, ...(known.item ? { item: known.item } : {}) };
  if (typed) return { name: typed.name, item: typed.item };
  return rules?.plain === "refuse" ? undefined : { name: cleaned };
}

/**
 * Adding by name into one bag (the player's when `holder` is absent): the item
 * `gameInventoryAddedItem` finds, onto the bag's stacks of it, or as a new stack at the end called by
 * the item's own name. One addition is at most one stack's worth of the inventory's bound, and a
 * count past that, one that is not a number, a name the rules refuse, or an addition that would start
 * too many stacks is refused and changes nothing. `id` is the stack it went onto.
 */
export function addToGameInventoryNamed(
  stacks: GameInventoryStack[],
  name: string,
  count: number,
  newId?: () => string,
  holder?: string,
  rules?: GameInventoryItemRules,
): { stacks: GameInventoryStack[]; id: string } | null {
  if (!Number.isFinite(count)) return null;
  const amount = Math.floor(count);
  if (amount < 1 || amount > GAME_INVENTORY_MAX_QUANTITY) return null;
  const like = gameInventoryAddedItem(stacks, name, holder, rules);
  if (!like) return null;
  const makeId = newId ?? (() => newGameInventoryStackId(stacks));
  const bag = cleanGameInventoryHolder(holder);
  return addLike(stacks, like, amount, bag, makeId, stackLimit(gameInventoryItemId(like), rules));
}

/** One of the ruleset's items added by its id, as `addToGameInventoryNamed` adds by name: refused
 *  when the rules do not offer it (they do not have it, or a layer hides it). */
export function addGameInventoryRulesetItem(
  stacks: GameInventoryStack[],
  item: string,
  count: number,
  newId?: () => string,
  holder?: string,
  rules?: GameInventoryItemRules,
): { stacks: GameInventoryStack[]; id: string } | null {
  const known = rules?.offers(item) ? rules.itemOf(item) : undefined;
  if (!known || !Number.isFinite(count)) return null;
  const amount = Math.floor(count);
  if (amount < 1 || amount > GAME_INVENTORY_MAX_QUANTITY) return null;
  const makeId = newId ?? (() => newGameInventoryStackId(stacks));
  const like = { name: known.name, item: known.item };
  return addLike(stacks, like, amount, cleanGameInventoryHolder(holder), makeId, stackLimit(item, rules));
}

/** `addToGameInventoryNamed`, for a caller that only needs the stacks. */
export function addToGameInventory(
  stacks: GameInventoryStack[],
  name: string,
  count: number,
  newId?: () => string,
  holder?: string,
  rules?: GameInventoryItemRules,
): GameInventoryStack[] {
  return addToGameInventoryNamed(stacks, name, count, newId, holder, rules)?.stacks ?? stacks;
}

/** The stacks a name finds, in the order they are taken or given from: with `from`, only that bag's
 *  (and the name is read against that bag); without, the player's own bag first and then the rest of
 *  the party's, top to bottom, and in each bag what nobody wears before what is worn or bound. */
function stacksNamed(
  stacks: readonly GameInventoryStack[],
  name: string,
  from?: GameInventoryBagRef,
): Array<{ stack: GameInventoryStack; index: number }> {
  const items = itemsNamed(from ? stacks.filter((stack) => inBag(stack, from)) : stacks, name);
  return stacks
    .map((stack, index) => ({ stack, index }))
    .filter(({ stack }) => items.has(gameInventoryItemId(stack)) && (!from || inBag(stack, from)))
    .sort(
      (a, b) =>
        (from ? 0 : Number(Boolean(a.stack.holder)) - Number(Boolean(b.stack.holder))) ||
        Number(gameInventoryStackWorn(a.stack)) - Number(gameInventoryStackWorn(b.stack)) ||
        a.index - b.index,
    );
}

/**
 * Taking by name: from the stacks of the item it finds, in `stacksNamed` order, until `count` is met,
 * removing each one it empties. Asking for more than there is takes all of it; `taken` says how many
 * really went.
 */
export function takeFromGameInventory(
  stacks: GameInventoryStack[],
  name: string,
  count: number,
  from?: GameInventoryBagRef,
  /** With the player's rules, a bound cursed item is never taken: the curse keeps it. */
  rules?: GameInventoryItemRules,
  /** Only from stacks the item may be used from, as a fight uses it (`gameInventoryUsableStack`). */
  worn = false,
  /** Only from stacks of this `gameInventoryStackKind`, so a sale never takes a fake with the real
   *  thing it passes for, or the real thing with a fake (1.79). */
  kind?: string,
): {
  stacks: GameInventoryStack[];
  taken: number;
  /** How many of what was taken were fakes, by what each truly is (1.79). */
  fakes?: Map<string, number>;
} {
  // Not held to one stack's bound: the stacks of an item together may hold more than one stack can.
  let left = Number.isFinite(count) ? Math.floor(count) : 0;
  if (!gameInventoryNameKey(name) || left < 1) return { stacks, taken: 0 };
  const takeAt = new Map<number, number>();
  const fakes = new Map<string, number>();
  let taken = 0;
  for (const { stack, index } of stacksNamed(stacks, name, from)) {
    if (left < 1) break;
    if (keptByCurse(stack, rules) || (worn && !gameInventoryUsableStack(stack, rules))) continue;
    if (kind !== undefined && gameInventoryStackKind(stack) !== kind) continue;
    const take = Math.min(left, stack.quantity);
    left -= take;
    taken += take;
    takeAt.set(index, take);
    if (stack.truly) fakes.set(stack.truly, (fakes.get(stack.truly) ?? 0) + take);
  }
  if (taken === 0) return { stacks, taken: 0 };
  const next = stacks.flatMap((stack, index) => {
    const take = takeAt.get(index) ?? 0;
    if (take === 0) return [stack];
    return stack.quantity - take > 0 ? [{ ...stack, quantity: stack.quantity - take }] : [];
  });
  return { stacks: next, taken, ...(fakes.size > 0 ? { fakes } : {}) };
}

/**
 * The stack a fight's next use of an item comes out of, `nth` uses on (0 for the next): a fight spends
 * by the item's name, from the stacks it may be used from, in the order a take by that name takes them.
 * What a fake passes for and the real thing are one item to a fight, so whether the use is a fake's is
 * known only here (1.79). Undefined when there are not that many.
 */
export function gameInventoryFightSpendStack(
  stacks: readonly GameInventoryStack[],
  name: string,
  rules?: GameInventoryItemRules,
  nth = 0,
): GameInventoryStack | undefined {
  let left = nth;
  for (const { stack } of stacksNamed(stacks, name)) {
    if (keptByCurse(stack, rules) || !gameInventoryUsableStack(stack, rules)) continue;
    if (left < stack.quantity) return stack;
    left -= stack.quantity;
  }
  return undefined;
}

/**
 * Some or all of one stack handed to another party member (`to` absent for the player): taken off
 * that stack and added to their bag onto their stacks of the same item, or as new stacks called what
 * this one is called. Giving to the bag it is already in, or a count that is not from 1 to the
 * stack's size, changes nothing. `id` is the stack that received it, so a screen can follow it.
 */
export function giveGameInventoryStack(
  stacks: GameInventoryStack[],
  id: string,
  to: string | undefined,
  count?: number,
  newId?: () => string,
  rules?: GameInventoryItemRules,
): { stacks: GameInventoryStack[]; id: string } | null {
  const source = stacks.find((stack) => stack.id === id);
  if (!source) return null;
  const amount = count === undefined ? source.quantity : count;
  if (!Number.isInteger(amount) || amount < 1 || amount > source.quantity) return null;
  const receiver = { holder: cleanGameInventoryHolder(to) };
  if (inBag(source, receiver)) return { stacks, id };
  // A cursed item stays with whoever it is bound to, and nobody is handed more than they can carry.
  if (keptByCurse(source, rules) || pastLimit(stacks, receiver.holder, weightOf(source, rules) * amount, rules)) {
    return null;
  }
  const makeId = newId ?? (() => newGameInventoryStackId(stacks));
  const item = gameInventoryItemId(source);
  const kind = gameInventoryStackKind(source);
  const rest =
    amount === source.quantity
      ? stacks.filter((stack) => stack.id !== id)
      : stacks.map((stack) => (stack.id === id ? { ...stack, quantity: stack.quantity - amount } : stack));
  // What is to vanish (1.760) joins nothing, and nothing joins it.
  const existing = rest.find(
    (stack) =>
      gameInventoryStackKind(stack) === kind && inBag(stack, receiver) && !stack.vanishesIn && !source.vanishesIn,
  );
  // A whole stack given to somebody with none of it keeps its id, so a selection follows it. Whoever
  // receives it is not wearing it and has not bound it.
  if (!existing && amount === source.quantity) {
    const index = stacks.findIndex((stack) => stack.id === id);
    return {
      stacks: stacks.map((stack, i) => (i === index ? withHolder(unworn(stack), receiver.holder) : stack)),
      id,
    };
  }
  return addLike(rest, source, amount, receiver.holder, makeId, stackLimit(item, rules));
}

/**
 * Giving by name: `count` of the item a name finds, out of one bag (the player's when `from` is
 * absent) and into another's (`to`), stack by stack in the bag's order, each as
 * `giveGameInventoryStack` hands it over, so nicknames travel with the stacks they are on. Giving
 * into the same bag, or when the bag holds none, changes nothing. `given` says how many went.
 */
export function giveFromGameInventoryNamed(
  stacks: GameInventoryStack[],
  name: string,
  count: number,
  from: GameInventoryBagRef,
  to: string | undefined,
  newId?: () => string,
  rules?: GameInventoryItemRules,
): { stacks: GameInventoryStack[]; given: number } {
  let left = Number.isFinite(count) ? Math.floor(count) : 0;
  const receiver = { holder: cleanGameInventoryHolder(to) };
  if (left < 1 || gameInventoryBagKey(from.holder) === gameInventoryBagKey(receiver.holder)) {
    return { stacks, given: 0 };
  }
  let current = stacks;
  let given = 0;
  for (const { stack } of stacksNamed(stacks, name, from)) {
    if (left < 1) break;
    const amount = Math.min(left, stack.quantity);
    const next = giveGameInventoryStack(current, stack.id, receiver.holder, amount, newId, rules);
    if (!next) break;
    current = next.stacks;
    left -= amount;
    given += amount;
  }
  return given > 0 ? { stacks: current, given } : { stacks, given: 0 };
}

/** What an addition may be put into: one bag, or the shared view, which picks among these bags in
 *  the order they are asked (the player's first, `undefined`, then the party in order). */
export type GameInventoryDestination = { holder?: string } | { among: ReadonlyArray<string | undefined> };

/** Where an addition went: how many into whose bag, and the stack it went onto first there. */
export interface GameInventoryShare {
  holder?: string;
  count: number;
  id: string;
}

/** The whole-item counts a weight fits into, with the slack loads are compared with. */
function fits(room: number, weight: number): number {
  return room === Infinity ? Infinity : Math.max(0, Math.floor(room / weight + LOAD_SLACK));
}

/**
 * How many of an item go into whose bag (section 4.7 of the ruleset items plan). An item that weighs
 * nothing, or a game whose ruleset does not say what anyone carries, goes where it is put: the bag
 * named, or the first of `among`. Into one bag, what would take its bearer past the most they can
 * carry is left behind. Into the shared view:
 *   1. all of it to the first who can carry it without becoming encumbered;
 *   2. otherwise split by the room each has left before becoming encumbered, most room first;
 *   3. what still does not fit, one at a time to whoever would then be least over;
 *   4. and what nobody can carry without passing their limit is left behind.
 */
export function placeGameInventoryAddition(
  stacks: readonly GameInventoryStack[],
  like: { name: string; item?: string; truly?: string },
  amount: number,
  destination: GameInventoryDestination,
  rules?: GameInventoryItemRules,
  /** Into one bag, all of it, past its bearer's limit. */
  options?: { pastLimit?: boolean },
): { shares: Array<{ holder?: string; count: number }>; left: number } {
  // Each bag once, however often it is named: a bag asked twice would have its room counted twice.
  const seen = new Set<string>();
  const candidates = ("among" in destination ? destination.among : [destination.holder])
    .map((holder) => cleanGameInventoryHolder(holder))
    .filter((holder) => {
      const key = gameInventoryBagKey(holder);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const weight = weightOf(like, rules);
  if (candidates.length === 0) return { shares: [], left: amount };
  if (weight <= 0 || !rules?.bearer) return { shares: [{ holder: candidates[0], count: amount }], left: 0 };
  const bearers = candidates.map((holder) => {
    const bearer = rules.bearer!(holder);
    const load = gameInventoryLoad(stacks, holder, rules);
    return {
      holder,
      free: fits((bearer.encumberedAbove ?? Infinity) - load, weight),
      most: fits((bearer.limit ?? Infinity) - load, weight),
      over: load - (bearer.encumberedAbove ?? Infinity),
      got: 0,
    };
  });
  if (!("among" in destination)) {
    const count = options?.pastLimit ? amount : Math.min(amount, bearers[0]!.most);
    return { shares: count > 0 ? [{ holder: candidates[0], count }] : [], left: amount - count };
  }
  let left = amount;
  const whole = bearers.find((bearer) => Math.min(bearer.free, bearer.most) >= amount);
  if (whole) {
    whole.got = amount;
    left = 0;
  } else {
    for (const bearer of [...bearers].sort((a, b) => b.free - a.free)) {
      const take = Math.min(left, bearer.free, bearer.most);
      bearer.got += take;
      left -= take;
    }
    // Past everyone's ease: each one to whoever is then least over, while it stays within their limit.
    while (left > 0) {
      let best: (typeof bearers)[number] | undefined;
      let bestOver = Infinity;
      for (const bearer of bearers) {
        if (bearer.got >= bearer.most) continue;
        const over = bearer.over + weight * (bearer.got + 1);
        if (over < bestOver) {
          best = bearer;
          bestOver = over;
        }
      }
      if (!best) break;
      best.got += 1;
      left -= 1;
    }
  }
  const shares = bearers.flatMap((bearer) => (bearer.got > 0 ? [{ holder: bearer.holder, count: bearer.got }] : []));
  return { shares, left };
}

/**
 * An addition put into one bag or the shared view (`placeGameInventoryAddition`), each share onto
 * that bag's stacks of the item as `addToGameInventoryNamed` adds. Null when a share would start too
 * many stacks; `shares` is empty when nobody could carry any of it, and `left` says what stayed behind.
 */
export function addGameInventoryPlaced(
  stacks: GameInventoryStack[],
  like: { name: string; item?: string; truly?: string; vanishesIn?: number },
  amount: number,
  destination: GameInventoryDestination,
  newId?: () => string,
  rules?: GameInventoryItemRules,
  options?: { pastLimit?: boolean },
): { stacks: GameInventoryStack[]; shares: GameInventoryShare[]; left: number } | null {
  const placed = placeGameInventoryAddition(stacks, like, amount, destination, rules, options);
  const makeId = newId ?? (() => newGameInventoryStackId(current));
  let current = stacks;
  const shares: GameInventoryShare[] = [];
  for (const share of placed.shares) {
    const added = addLike(
      current,
      like,
      share.count,
      share.holder,
      makeId,
      stackLimit(gameInventoryItemId(like), rules),
    );
    if (!added) return null;
    current = added.stacks;
    shares.push({ ...(share.holder ? { holder: share.holder } : {}), count: share.count, id: added.id });
  }
  return { stacks: current, shares, left: placed.left };
}

/** Which slots one bag's worn items take, by slot id. */
export function gameInventorySlotsUsed(
  stacks: readonly GameInventoryStack[],
  holder: string | undefined,
  rules: GameInventoryItemRules | undefined,
): Record<string, number> {
  const used: Record<string, number> = {};
  const bag = { holder };
  for (const stack of stacks) {
    if (!stack.equipped || !inBag(stack, bag) || !stack.item) continue;
    const known = rules?.itemOf(stack.item);
    // Switched on to hover (1.706): an Animated Shield leaves its hand free.
    if (stack.on && known?.toggle?.freesSlots) continue;
    for (const [slot, count] of Object.entries(known?.slots ?? {})) {
      used[slot] = (used[slot] ?? 0) + count * stack.quantity;
    }
  }
  return used;
}

/** How many items one bag's bearer has bound. */
export function gameInventoryBoundCount(stacks: readonly GameInventoryStack[], holder: string | undefined): number {
  const bag = { holder };
  return stacks.reduce((total, stack) => total + (stack.bound && inBag(stack, bag) ? stack.quantity : 0), 0);
}

/** What one character carries and wears, against what they can: for the screen and the Game Master. */
export interface GameInventoryBearerStatus {
  /** What their bag weighs. */
  load: number;
  encumberedAbove?: number;
  limit?: number;
  /** Carrying more than they can without being encumbered. */
  encumbered: boolean;
  bound: number;
  bindingMax?: number;
  /** Every slot the ruleset declares, with how many of it their worn items take. */
  slots: Array<{ id: string; label: string; used: number; count: number }>;
}

/** One character's load, bound items and slots in use (`holder` absent for the player). */
export function gameInventoryBearerStatus(
  stacks: readonly GameInventoryStack[],
  holder: string | undefined,
  rules: GameInventoryItemRules | undefined,
): GameInventoryBearerStatus {
  const bearer = rules?.bearer?.(holder) ?? {};
  const load = gameInventoryLoad(stacks, holder, rules);
  const used = gameInventorySlotsUsed(stacks, holder, rules);
  return {
    load,
    ...(bearer.encumberedAbove !== undefined ? { encumberedAbove: bearer.encumberedAbove } : {}),
    ...(bearer.limit !== undefined ? { limit: bearer.limit } : {}),
    encumbered: bearer.encumberedAbove !== undefined && load > bearer.encumberedAbove + LOAD_SLACK,
    bound: gameInventoryBoundCount(stacks, holder),
    ...(bearer.bindingMax !== undefined ? { bindingMax: bearer.bindingMax } : {}),
    slots: (rules?.slots ?? []).map((slot) => ({ ...slot, used: used[slot.id] ?? 0 })),
  };
}

/** Whether a bearer carries more than the most they can (only Free edit's starting gear puts them there). */
export function gameInventoryOverLimit(status: Pick<GameInventoryBearerStatus, "load" | "limit">): boolean {
  return status.limit !== undefined && status.load > status.limit + LOAD_SLACK;
}

/** A weight as it is shown: at most two decimals (a quarter of a pound), and what the ruleset counts
 *  weights in after it where it says (1.791). */
export function gameInventoryWeightText(value: number, unit?: string): string {
  const shown = String(Math.round(value * 100) / 100);
  return unit ? `${shown} ${unit}` : shown;
}

/** Putting an item on or taking it off, binding or unbinding it. */
export type GameInventoryWear = "equip" | "unequip" | "bind" | "unbind";

/** Why a stack could not be worn or bound: it takes no slots, its slots are taken, it does not bind,
 *  its bearer has bound all they can, or it is a bound cursed item the player cannot part with. */
export type GameInventoryWearRefusal =
  "not-wearable" | "no-slot" | "not-bindable" | "binding-full" | "cursed" | "needs-worn";

/**
 * One stack put on, taken off, bound or unbound by whoever carries it. Only a ruleset item that takes
 * slots can be equipped, while its bearer has those slots free, and only one that binds can be bound,
 * while its bearer is under their binding maximum. One item of a larger stack is taken into a stack
 * of its own right after it, which is the stack returned. Taking off or unbinding what is not worn or
 * bound changes nothing. The player cannot take off or unbind a bound cursed item. Null when there
 * is no such stack.
 */
export function wearGameInventoryStack(
  stacks: GameInventoryStack[],
  id: string,
  wear: GameInventoryWear,
  newId: () => string = () => newGameInventoryStackId(stacks),
  rules?: GameInventoryItemRules,
): { stacks: GameInventoryStack[]; id: string } | { refused: GameInventoryWearRefusal } | null {
  const index = stacks.findIndex((stack) => stack.id === id);
  if (index < 0) return null;
  // A fake bound is found out (1.79), however the bind is asked for: binding is attuning, and a curse
  // shows itself. It is bound as what it truly is.
  if (wear === "bind" && stacks[index]!.truly) stacks = revealGameInventoryFake(stacks, id, rules);
  const stack = stacks[index]!;
  const flag = wear === "equip" || wear === "unequip" ? "equipped" : "bound";
  if (wear === "unequip" || wear === "unbind") {
    if (!stack[flag]) return { stacks, id };
    if (keptByCurse(stack, rules)) return { refused: "cursed" };
    const { [flag]: _dropped, ...rest } = stack;
    // Whatever its binding needed worn, it no longer is (1.313).
    return {
      stacks: releaseGameInventoryUnmetBindings(
        stacks.map((each, i) => (i === index ? rest : each)),
        rules,
      ),
      id,
    };
  }
  if (stack[flag]) return { stacks, id };
  const known = stack.item ? rules?.itemOf(stack.item) : undefined;
  if (flag === "equipped") {
    const takes = Object.entries(known?.slots ?? {}).filter(([, count]) => count > 0);
    if (takes.length === 0) return { refused: "not-wearable" };
    const used = gameInventorySlotsUsed(stacks, stack.holder, rules);
    for (const [slot, count] of takes) {
      const has = rules?.slots?.find((each) => each.id === slot)?.count ?? 0;
      if ((used[slot] ?? 0) + count > has) return { refused: "no-slot" };
    }
  } else {
    if (!known?.binds) return { refused: "not-bindable" };
    if (!bindingNeedsMet(stacks, stack, rules)) return { refused: "needs-worn" };
    const max = rules?.bearer?.(stack.holder).bindingMax;
    if (max !== undefined && gameInventoryBoundCount(stacks, stack.holder) + 1 > max) {
      return { refused: "binding-full" };
    }
  }
  if (stack.quantity === 1) {
    return { stacks: stacks.map((each, i) => (i === index ? { ...each, [flag]: true as const } : each)), id };
  }
  const one = { ...stack, id: newId(), quantity: 1, [flag]: true as const };
  return {
    stacks: [...stacks.slice(0, index), { ...stack, quantity: stack.quantity - 1 }, one, ...stacks.slice(index + 1)],
    id: one.id,
  };
}

/** Why the player cannot hand this much of a stack to that bag: a bound cursed item stays, and nobody
 *  is given more than they can carry. */
export function gameInventoryGiveRefusal(
  stacks: readonly GameInventoryStack[],
  stack: GameInventoryStack,
  to: string | undefined,
  amount: number,
  rules: GameInventoryItemRules | undefined,
): "cursed" | "too-heavy" | undefined {
  if (keptByCurse(stack, rules)) return "cursed";
  if (pastLimit(stacks, cleanGameInventoryHolder(to), weightOf(stack, rules) * amount, rules)) return "too-heavy";
  return undefined;
}

/** Whether `amount` more of a stack's item would take its bearer past the most they can carry. */
export function gameInventoryOverloads(
  stacks: readonly GameInventoryStack[],
  stack: GameInventoryStack,
  amount: number,
  rules: GameInventoryItemRules | undefined,
): boolean {
  return pastLimit(stacks, stack.holder, weightOf(stack, rules) * amount, rules);
}

/** What a ruleset's item asks of a stack before it may be used: worn where it takes slots, bound
 *  where it binds. The one rule the Use button, the fight menu and a fight's spends all read. An item
 *  drawn as it is used (1.808) is used while only carried, and the use puts it on; it is still bound
 *  where it binds (laptop v3 2026-10-26: a carried Longbow was never offered as an attack). */
export function gameInventoryWearNeeds(item: {
  slots?: Readonly<Record<string, number>>;
  binds?: unknown;
  drawOnUse?: boolean;
}): {
  equipped?: true;
  bound?: true;
} {
  const takesSlots = !item.drawOnUse && Object.values(item.slots ?? {}).some((count) => count > 0);
  return { ...(takesSlots ? { equipped: true as const } : {}), ...(item.binds ? { bound: true as const } : {}) };
}

/** Whether what a stack's binding needs worn is worn (1.313): for each group of its item's
 *  `binds.needsWorn`, another stack in its bearer's bag of one of the items named, worn and bound as
 *  that item asks. */
function bindingNeedsMet(
  stacks: readonly GameInventoryStack[],
  stack: GameInventoryStack,
  rules: GameInventoryItemRules | undefined,
): boolean {
  const needs = stack.item ? rules?.itemOf(stack.item)?.binds?.needsWorn : undefined;
  if (!needs?.length) return true;
  const bag = gameInventoryBagKey(stack.holder);
  return needs.every((group) =>
    stacks.some((other) => {
      if (other === stack || !other.item || !group.anyOf.includes(other.item)) return false;
      if (gameInventoryBagKey(other.holder) !== bag) return false;
      const item = rules?.itemOf(other.item);
      // Worn as it is, never as it may be drawn (1.808): a belt is needed on, not carried.
      const wears = item ? gameInventoryWearNeeds({ slots: item.slots, binds: item.binds }) : {};
      return (wears.equipped || wears.bound) === true && gameInventoryWearMet(other, wears);
    }),
  );
}

/** The stacks with every binding whose needed items are no longer worn undone (1.313): the hammer
 *  unbound once its belt or gauntlets come off, or leave its bearer's bag. A curse still holds what
 *  it holds, as it does when the player unbinds it by hand. */
export function releaseGameInventoryUnmetBindings(
  stacks: GameInventoryStack[],
  rules: GameInventoryItemRules | undefined,
): GameInventoryStack[] {
  let current = stacks;
  for (;;) {
    const at = current.findIndex(
      (stack) => stack.bound === true && !keptByCurse(stack, rules) && !bindingNeedsMet(current, stack, rules),
    );
    if (at < 0) return current;
    const { bound: _bound, ...rest } = current[at]!;
    current = current.map((each, i) => (i === at ? rest : each));
  }
}

/** Whether a stack is worn and bound as `needs` asks. */
export function gameInventoryWearMet(
  stack: Pick<GameInventoryStack, "equipped" | "bound">,
  needs: { equipped?: boolean; bound?: boolean } | undefined,
): boolean {
  return (!needs?.equipped || stack.equipped === true) && (!needs?.bound || stack.bound === true);
}

/** Whether a stack may be used as its item asks (`gameInventoryWearNeeds`). A plain item, or one the
 *  rules do not know, always may. */
export function gameInventoryUsableStack(
  stack: GameInventoryStack,
  rules: GameInventoryItemRules | undefined,
): boolean {
  const read = stack.item ? rules?.itemOf(stack.item) : undefined;
  return !read || gameInventoryWearMet(stack, gameInventoryWearNeeds(read));
}

/** One thing a character holds, as drawing an item weighs it (1.808): the slots it takes while worn
 *  (none for one that leaves its slots free), how many of it, whether it is worn now, whether it is
 *  drawn as it is used, and whether it may not come off (a bound cursed item). */
export interface GameInventoryDrawHeld {
  slots?: Readonly<Record<string, number>>;
  quantity: number;
  worn: boolean;
  drawOnUse: boolean;
  kept: boolean;
}

/** What drawing one item takes (1.808): nothing for one already worn; the fewest other worn items
 *  drawn as they are used to put away to make room, by place; or, where that cannot make room, the
 *  places of the worn items that stand in its way and may not be put away for it (empty when the
 *  character has too few of a slot at all). */
export type GameInventoryDrawPlan = { stow: number[] } | { blockedBy: number[] };

/**
 * How one item (at `index` of `held`) is drawn in its holder's hands as it is used (Capability API
 * 1.808): it takes its slots, and where they are full, the fewest other worn items that are drawn as
 * they are used and that are not cursed onto their bearer are put away to make room. A shield, armor,
 * or anything else that is not drawn as it is used is never taken off for it: then the plan names
 * what stands in the way, and the use is refused. One of a stack is drawn.
 */
export function gameInventoryDrawPlan(
  held: readonly GameInventoryDrawHeld[],
  index: number,
  slotCounts: Readonly<Record<string, number>>,
): GameInventoryDrawPlan {
  const own = held[index];
  if (!own || own.worn) return { stow: [] };
  const needs = Object.entries(own.slots ?? {}).filter(([, count]) => count > 0);
  const used: Record<string, number> = {};
  held.forEach((one, at) => {
    if (!one.worn || at === index) return;
    for (const [slot, count] of Object.entries(one.slots ?? {})) used[slot] = (used[slot] ?? 0) + count * one.quantity;
  });
  const short = (freed: ReadonlySet<number>) =>
    needs.filter(([slot, count]) => {
      let taken = used[slot] ?? 0;
      for (const at of freed) taken -= (held[at]!.slots?.[slot] ?? 0) * held[at]!.quantity;
      return taken + count > (slotCounts[slot] ?? 0);
    });
  if (short(new Set()).length === 0) return { stow: [] };
  const inTheWay = (at: number) =>
    at !== index && held[at]!.worn && needs.some(([slot]) => (held[at]!.slots?.[slot] ?? 0) > 0);
  const may = held.flatMap((one, at) => (inTheWay(at) && one.drawOnUse && !one.kept ? [at] : []));
  // The fewest put away, the first held first among as few: a handful of weapons at most.
  const pick = may.slice(0, 12);
  for (let size = 1; size <= pick.length; size++) {
    const found = subsetsOf(pick, size).find((subset) => short(new Set(subset)).length === 0);
    if (found) return { stow: found };
  }
  return { blockedBy: held.flatMap((one, at) => (inTheWay(at) && (!one.drawOnUse || one.kept) ? [at] : [])) };
}

/** Every choice of `size` of `from`, in order. */
function subsetsOf(from: readonly number[], size: number): number[][] {
  if (size === 0) return [[]];
  if (from.length < size) return [];
  const [first, ...rest] = from;
  return [...subsetsOf(rest, size - 1).map((tail) => [first!, ...tail]), ...subsetsOf(rest, size)];
}

/** Why a stack could not be drawn as it is used (1.808): what holds the slots it needs, by name, or
 *  too few of a slot at all. */
export type GameInventoryDrawRefusal = { refused: "hands-full"; by: string[] } | { refused: "no-slot" };

/** What one bag's stacks hold, as drawing weighs it (1.808), with the stacks they are. */
function drawHeld(
  stacks: readonly GameInventoryStack[],
  holder: string | undefined,
  rules: GameInventoryItemRules,
): { stacks: GameInventoryStack[]; held: GameInventoryDrawHeld[] } {
  const bag = { holder };
  const mine = stacks.filter((stack) => inBag(stack, bag) && stack.item);
  return {
    stacks: mine,
    held: mine.map((stack) => {
      const known = rules.itemOf(stack.item!);
      return {
        // Switched on to hover (1.706): its hand is free.
        slots: stack.on && known?.toggle?.freesSlots ? {} : (known?.slots ?? {}),
        quantity: stack.quantity,
        worn: stack.equipped === true,
        drawOnUse: known?.drawOnUse === true,
        kept: stack.bound === true && known?.binds?.cursed === true,
      };
    }),
  };
}

/** Why this stack could not be drawn as it is used now (1.808), or undefined when it can (or need not
 *  be: it is worn already, or it is not drawn as it is used). */
export function gameInventoryDrawRefusal(
  stacks: readonly GameInventoryStack[],
  stack: GameInventoryStack,
  rules: GameInventoryItemRules | undefined,
): GameInventoryDrawRefusal | undefined {
  const known = stack.item ? rules?.itemOf(stack.item) : undefined;
  if (!rules || !known?.drawOnUse || stack.equipped) return undefined;
  const { stacks: mine, held } = drawHeld(stacks, stack.holder, rules);
  const at = mine.findIndex((each) => each.id === stack.id);
  if (at < 0) return undefined;
  const plan = gameInventoryDrawPlan(
    held.map((one, i) => (i === at ? { ...one, quantity: 1 } : one)),
    at,
    Object.fromEntries((rules.slots ?? []).map((slot) => [slot.id, slot.count])),
  );
  if ("stow" in plan) return undefined;
  return plan.blockedBy.length
    ? { refused: "hands-full", by: plan.blockedBy.map((i) => mine[i]!.nickname || mine[i]!.name) }
    : { refused: "no-slot" };
}

/**
 * One stack drawn as it is used (Capability API 1.808): one of it put on, as a free swap that first
 * puts away the fewest other worn items drawn as they are used where its slots are full
 * (`gameInventoryDrawPlan`). Unchanged for a stack already worn, or of an item not drawn as it is used.
 * `id` is the stack drawn (one of a larger stack is taken into a stack of its own), and `stowed` the
 * names of what was put away. Refused, nothing is changed. Null when there is no such stack.
 */
export function drawGameInventoryStack(
  stacks: GameInventoryStack[],
  id: string,
  rules: GameInventoryItemRules | undefined,
  newId: () => string = () => newGameInventoryStackId(stacks),
): { stacks: GameInventoryStack[]; id: string; stowed: string[] } | GameInventoryDrawRefusal | null {
  const stack = stacks.find((each) => each.id === id);
  if (!stack) return null;
  const known = stack.item ? rules?.itemOf(stack.item) : undefined;
  if (!rules || !known?.drawOnUse || stack.equipped) return { stacks, id, stowed: [] };
  const refusal = gameInventoryDrawRefusal(stacks, stack, rules);
  if (refusal) return refusal;
  const { stacks: mine, held } = drawHeld(stacks, stack.holder, rules);
  const at = mine.findIndex((each) => each.id === id);
  const plan = gameInventoryDrawPlan(
    held.map((one, i) => (i === at ? { ...one, quantity: 1 } : one)),
    at,
    Object.fromEntries((rules.slots ?? []).map((slot) => [slot.id, slot.count])),
  );
  const stow = new Set("stow" in plan ? plan.stow.map((i) => mine[i]!.id) : []);
  const stowed = mine.filter((each) => stow.has(each.id)).map((each) => each.nickname || each.name);
  // Put away first, so the slots it needs are free; a binding that needed one of them on ends (1.313).
  const away = releaseGameInventoryUnmetBindings(
    stacks.map((each) => {
      if (!stow.has(each.id)) return each;
      const { equipped: _equipped, ...rest } = each;
      return rest;
    }),
    rules,
  );
  const worn = wearGameInventoryStack(away, id, "equip", newId, rules);
  if (!worn || "refused" in worn) return { refused: "no-slot" };
  return { stacks: worn.stacks, id: worn.id, stowed };
}

/**
 * One of the Engine's own fights using an item by its name (1.808): where it is drawn as it is used,
 * one stack of it is drawn, unless one is already on. The stacks a fight would spend come first (the
 * player's own, then the rest), and the first that can be drawn is. Unchanged where the item is not
 * drawn as it is used; refused where no stack of it can be drawn.
 */
export function drawGameInventoryFightItem(
  stacks: GameInventoryStack[],
  name: string,
  rules: GameInventoryItemRules | undefined,
): { stacks: GameInventoryStack[]; stowed: string[] } | GameInventoryDrawRefusal {
  const found = stacksNamed(stacks, name)
    .map(({ stack }) => stack)
    .filter((stack) => !keptByCurse(stack, rules) && gameInventoryUsableStack(stack, rules));
  const draws = found.filter((stack) => stack.item && rules?.itemOf(stack.item)?.drawOnUse);
  if (draws.length === 0 || draws.some((stack) => stack.equipped)) return { stacks, stowed: [] };
  let refusal: GameInventoryDrawRefusal | undefined;
  for (const stack of draws) {
    const drawn = drawGameInventoryStack(stacks, stack.id, rules);
    if (!drawn) continue;
    if (!("refused" in drawn)) return { stacks: drawn.stacks, stowed: drawn.stowed };
    refusal ??= drawn;
  }
  return refusal ?? { refused: "no-slot" };
}

/** Whether the player's own change would part them from this stack: a bound cursed item. */
export function gameInventoryKeptByCurse(
  stack: GameInventoryStack,
  rules: GameInventoryItemRules | undefined,
): boolean {
  return keptByCurse(stack, rules);
}

/** Two stacks trading places, wherever they are in the list. */
export function swapGameInventoryStacks(
  stacks: GameInventoryStack[],
  firstId: string,
  secondId: string,
): GameInventoryStack[] {
  const first = stacks.findIndex((stack) => stack.id === firstId);
  const second = stacks.findIndex((stack) => stack.id === secondId);
  if (first < 0 || second < 0 || first === second) return stacks;
  const next = stacks.slice();
  [next[first], next[second]] = [next[second]!, next[first]!];
  return next;
}

/**
 * One stack set to a count. Zero removes it. A count past what one stack of the item holds fills this
 * stack and puts the rest in new stacks right after it, like it, unless that would start too many
 * stacks, which changes nothing. A worn or bound stack holds one, so what is added beside it is
 * neither. The player cannot take a bound cursed item away. Nothing passes the inventory's bound.
 */
export function setGameInventoryStackQuantity(
  stacks: GameInventoryStack[],
  id: string,
  quantity: number,
  newId: () => string = () => newGameInventoryStackId(stacks),
  rules?: GameInventoryItemRules,
): GameInventoryStack[] {
  const index = stacks.findIndex((stack) => stack.id === id);
  if (index < 0 || !Number.isFinite(quantity)) return stacks;
  const stack = stacks[index]!;
  const next = clampQuantity(quantity);
  if (next === stack.quantity) return stacks;
  if (next < stack.quantity && keptByCurse(stack, rules)) return stacks;
  if (next === 0) return stacks.filter((_, i) => i !== index);
  // A worn stack and one switched on stay one item; what is added beside them is neither, and holds
  // its own loads and charges.
  const single = gameInventoryStackWorn(stack) || stack.on === true;
  const limit = single ? 1 : stackLimit(gameInventoryItemId(stack), rules);
  if (next <= limit) return stacks.map((each, i) => (i === index ? { ...each, quantity: next } : each));
  const beside = single ? stackLimit(gameInventoryItemId(stack), rules) : limit;
  if (Math.ceil((next - limit) / beside) > GAME_INVENTORY_MAX_NEW_STACKS) return stacks;
  const {
    on: _on,
    loaded: _loaded,
    charges: _charges,
    corroded: _corroded,
    absorbedEver: _absorbedEver,
    callRoll: _callRoll,
    form: _form,
    usesLeft: _usesLeft,
    waits: _waits,
    storedEntries: _stored,
    ...off
  } = unworn(stack);
  const rest: GameInventoryStack[] = [];
  for (let left = next - limit; left > 0; left -= beside) {
    rest.push({ ...off, id: newId(), quantity: Math.min(left, beside) });
  }
  return [...stacks.slice(0, index), { ...stack, quantity: limit }, ...rest, ...stacks.slice(index + 1)];
}

/**
 * Part of a stack moved into a new stack right after it, with the same item and nickname. The size
 * has to leave something behind and move something, so it is at least one and less than the stack;
 * anything else changes nothing. The total never changes.
 */
export function splitGameInventoryStack(
  stacks: GameInventoryStack[],
  id: string,
  size: number,
  newId: () => string = () => newGameInventoryStackId(stacks),
): GameInventoryStack[] {
  const index = stacks.findIndex((stack) => stack.id === id);
  if (index < 0 || !Number.isInteger(size)) return stacks;
  const stack = stacks[index]!;
  if (size < 1 || size >= stack.quantity) return stacks;
  return [
    ...stacks.slice(0, index),
    { ...stack, quantity: stack.quantity - size },
    { ...stack, id: newId(), quantity: size },
    ...stacks.slice(index + 1),
  ];
}

/** How many of one stack pouring into another would move: what the stack poured into has room for,
 *  and none when they cannot merge. */
function mergeAmount(
  from: GameInventoryStack,
  into: GameInventoryStack,
  rules: GameInventoryItemRules | undefined,
): number {
  if (from.id === into.id || gameInventoryStackKind(from) !== gameInventoryStackKind(into)) return 0;
  // A worn or bound item is one item on its own, and what is to vanish lasts on its own (1.760).
  if (gameInventoryStackWorn(from) || gameInventoryStackWorn(into)) return 0;
  if (from.vanishesIn || into.vanishesIn) return 0;
  return Math.max(0, Math.min(from.quantity, stackLimit(gameInventoryItemId(into), rules) - into.quantity));
}

/** Whether pouring one stack into another in somebody else's bag would hand them more than they can
 *  carry. Pouring within one bag moves nothing between bearers, so it never is. */
export function gameInventoryMergeOverloads(
  stacks: readonly GameInventoryStack[],
  from: GameInventoryStack,
  into: GameInventoryStack,
  rules: GameInventoryItemRules | undefined,
): boolean {
  return (
    !inBag(from, into) && pastLimit(stacks, into.holder, weightOf(from, rules) * mergeAmount(from, into, rules), rules)
  );
}

/** One stack poured into another of the same item, which keeps its place, its bag and its nickname,
 *  so pouring into a stack in somebody else's bag hands it over, and like a give never past what they
 *  can carry. Only as much as the stack it is poured into can hold moves, and the rest stays where it
 *  was; into a full stack nothing does. Two different items never merge, whatever they are called,
 *  and a stack never merges into itself. */
export function mergeGameInventoryStacks(
  stacks: GameInventoryStack[],
  fromId: string,
  intoId: string,
  rules?: GameInventoryItemRules,
): GameInventoryStack[] {
  const from = stacks.find((stack) => stack.id === fromId);
  const into = stacks.find((stack) => stack.id === intoId);
  if (!from || !into) return stacks;
  const moved = mergeAmount(from, into, rules);
  if (moved < 1 || gameInventoryMergeOverloads(stacks, from, into, rules)) return stacks;
  return stacks.flatMap((stack) => {
    if (stack.id === intoId) {
      // Several now, and a loaded count or charges are one item's: each of them reads as full.
      const {
        loaded: _loaded,
        charges: _charges,
        corroded: _corroded,
        absorbedEver: _absorbedEver,
        callRoll: _callRoll,
        form: _form,
        usesLeft: _usesLeft,
        waits: _waits,
        storedEntries: _stored,
        on: _on,
        ...rest
      } = stack;
      return [{ ...rest, quantity: stack.quantity + moved }];
    }
    if (stack.id !== fromId) return [stack];
    return moved < stack.quantity ? [{ ...stack, quantity: stack.quantity - moved }] : [];
  });
}

/**
 * One stack called something else: its nickname, which is all a rename changes. Renaming it back to
 * the item's own name, in any case, clears the nickname. A rename never changes which item it is and
 * never merges it into anything. An empty name is refused.
 */
export function renameGameInventoryStack(
  stacks: GameInventoryStack[],
  id: string,
  nextName: string,
): { stacks: GameInventoryStack[]; id: string } | null {
  const cleaned = cleanName(nextName).slice(0, GAME_INVENTORY_NAME_MAX_LENGTH);
  const source = stacks.find((stack) => stack.id === id);
  if (!source || !cleaned) return null;
  const renamed = makeStack({ ...source, nickname: cleaned });
  if (gameInventoryStackLabel(renamed) === gameInventoryStackLabel(source)) return { stacks, id };
  return { stacks: stacks.map((stack) => (stack.id === id ? renamed : stack)), id };
}

/**
 * The inventory a new session starts with: every stack the last one ended with, ids, splits, bags and
 * nicknames kept, plus anything the detailed inventory on its last game state names that no stack
 * holds, which goes to the player. `rules` are the game's ruleset's items: what comes back that way is
 * stacked no higher than its item allows, and a name that is one of them comes back as that item.
 */
export function carryGameInventory(
  gameInventory: unknown,
  detailedInventory: unknown,
  rules?: GameInventoryItemRules,
): GameInventoryStack[] {
  let stacks = normalizeGameInventoryStacks(gameInventory);
  // Read against the stacks as saved, so two detailed entries of an item no stack holds both count.
  const saved = stacks;
  const held = new Set(saved.map(gameInventoryItemId));
  for (const raw of Array.isArray(detailedInventory) ? detailedInventory : []) {
    const [entry] = normalizeGameInventoryStacks([raw]);
    if (!entry) continue;
    const item = (raw as { item?: unknown }).item;
    // An entry that follows an item by id is held exactly when that item is; only one without an id
    // is judged by its name.
    if (typeof item === "string" ? held.has(item) : gameInventoryCount(saved, entry.name) > 0) continue;
    // A ruleset item comes back as that item, under the name its entry shows.
    // Only one the ruleset still has, when its items are known; any other goes back by its name.
    const ref = readItemRef(item);
    const typed = ref && (!rules || rules.itemOf(ref)) ? ref : undefined;
    if (typed) {
      const makeId = () => newGameInventoryStackId(stacks);
      stacks =
        addLike(stacks, { name: entry.name, item: typed }, entry.quantity, undefined, makeId, stackLimit(typed, rules))
          ?.stacks ?? stacks;
      continue;
    }
    // An entry whose name is not its item's own (a nickname) comes back as that item, its own name
    // read off the id and the entry's name kept as the nickname, rather than as whatever that name
    // finds. Only an own name that makes that same id again is trusted: one cut short and
    // fingerprinted cannot be read back, and comes back by name.
    const own =
      typeof item === "string" && item.startsWith("plain:") ? item.slice("plain:".length).replace(/-/g, " ") : "";
    if (own && gameInventoryPlainItemId(own) === item && gameInventoryPlainItemId(entry.name) !== item) {
      const makeId = () => newGameInventoryStackId(stacks);
      stacks =
        addLike(stacks, { name: own, nickname: entry.name }, entry.quantity, undefined, makeId)?.stacks ?? stacks;
      continue;
    }
    stacks = addToGameInventory(stacks, entry.name, entry.quantity, undefined, undefined, rules);
  }
  return stacks;
}
