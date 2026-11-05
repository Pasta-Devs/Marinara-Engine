// ──────────────────────────────────────────────
// Inventory tag — `[inventory: action="add" item="Rope" count="2" who="Bram"]`
//
// The Game Master says what the party gained, lost or handed over; the Engine owns whether it can
// happen. So, as with sheet commands, the reader takes the REQUEST only: a `result`, `reason` or
// `now` in the input is ignored, and the server rewrites each tag with what it actually did. A tag
// naming several items becomes one tag per item, so every item carries its own outcome.
// ──────────────────────────────────────────────

import { GAME_INVENTORY_MAX_QUANTITY, type GameInventoryItemProposal } from "./game-inventory-stacks.js";
import { readGmTagAttributes } from "./skill-check-tag.js";

/** Longest body an inventory tag can carry, so a reply full of unclosed heads stays cheap to scan. */
const MAX_INVENTORY_TAG_BODY = 1500;
/** The most one tag may add, take or give of an item. */
export const INVENTORY_TAG_COUNT_MAX = 9999;
/** Longest item or character name a tag keeps. */
const MAX_TAG_NAME_LENGTH = 120;
/** Longest note an answer carries: what the Engine changed about an item the Game Master invented. */
const MAX_TAG_NOTE_LENGTH = 600;
/** The most parts one proposed item's list (its tags, stats or slots) is read for. */
const MAX_PROPOSAL_PARTS = 24;

export type InventoryTagAction =
  | "add"
  | "remove"
  | "give"
  | "equip"
  | "unequip"
  | "bind"
  | "unbind"
  | "use"
  | "pay"
  | "earn"
  | "buy"
  | "sell"
  /** A fake shown for what it truly is (Capability API 1.79). */
  | "reveal"
  /** A character looks an item over before trusting it (Capability API 1.802). */
  | "inspect";

const INVENTORY_TAG_ACTIONS: readonly InventoryTagAction[] = [
  "add",
  "remove",
  "give",
  "equip",
  "unequip",
  "bind",
  "unbind",
  "use",
  "pay",
  "earn",
  "buy",
  "sell",
  "reveal",
  "inspect",
];

function readAction(value: string | undefined): InventoryTagAction | undefined {
  return INVENTORY_TAG_ACTIONS.find((action) => action === value);
}

export interface InventoryTagRequest {
  action: InventoryTagAction;
  items: string[];
  /** What a list of items said before it was split at its commas, when it had any: one name that holds
   *  a comma ("Rope, hempen (50 feet)") read as the list it looks like. Whoever knows the items reads
   *  it whole when it is the name of one. */
  whole?: string;
  count: number;
  /** Whose bag: the receiver of an add, the one who loses a remove, the giver of a give, the one who
   *  puts on, takes off, binds or unbinds. */
  who?: string;
  /** Who receives a give. */
  to?: string;
  /** An add that proposes an item of the ruleset: the parts the Game Master gave it. */
  proposal?: Omit<GameInventoryItemProposal, "name">;
  /** A buy's price level and seller, as the Game Master named them (#6917); an inspection's seller,
   *  whose ware is looked at (1.802). */
  level?: string;
  seller?: string;
  /** An inspection's way of seeing through fakes, cast on the item (1.802). */
  with?: string;
  /** An add that vanishes after so many minutes of game time (Capability API 1.760): 5e's Creation. */
  lasts?: number;
}

/** The most a thing made to vanish lasts, in minutes (1.760): ten years. */
const MOST_LASTS_MINUTES = 5_256_000;
const LASTS_UNITS: ReadonlyArray<[RegExp, number]> = [
  [/^(?:m|mins?|minutes?)$/, 1],
  [/^(?:h|hrs?|hours?)$/, 60],
  [/^(?:d|days?)$/, 1440],
  [/^(?:w|weeks?)$/, 10080],
];

/** How long an add lasts (1.760), in minutes: "10 minutes", "12 hours", "1 day", "2 weeks", or a bare
 *  number of minutes. Undefined when it says nothing it can read. */
export function readInventoryLasts(text: string | undefined): number | undefined {
  const match = /^(\d{1,7})\s*([a-z]*)$/i.exec(text?.trim().toLowerCase() ?? "");
  if (!match) return undefined;
  const count = Number.parseInt(match[1]!, 10);
  const unit = match[2] ? LASTS_UNITS.find(([pattern]) => pattern.test(match[2]!))?.[1] : 1;
  if (!unit || count < 1) return undefined;
  return Math.min(MOST_LASTS_MINUTES, count * unit);
}

/** Minutes said the way a person would (1.760): "1 day", "12 hours", "10 minutes". */
export function inventoryLastsWords(minutes: number): string {
  const [count, unit] =
    minutes % 1440 === 0 ? [minutes / 1440, "day"] : minutes % 60 === 0 ? [minutes / 60, "hour"] : [minutes, "minute"];
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** "damage=1d8, bulk: 2; hands" as parts: each `key=value` or `key: value`, split only before the
 *  next key so a value may hold a comma. A part without a value is the key alone. */
function readParts(text: string): Array<[string, string]> {
  return text
    .split(/[;,]\s*(?=[\p{L}\p{N}_ -]{1,40}(?:[=:]|$|[;,]))/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, MAX_PROPOSAL_PARTS)
    .map((part): [string, string] => {
      const at = part.search(/[=:]/);
      return at < 0 ? [part, ""] : [part.slice(0, at).trim(), part.slice(at + 1).trim()];
    })
    .filter(([key]) => key.length > 0 && key.length <= 40);
}

/** The parts of an item the Game Master proposes, or undefined when an add names only its item. */
function readProposal(values: Map<string, string>): Omit<GameInventoryItemProposal, "name"> | undefined {
  const text = (key: string, max = 80) => {
    const value = values.get(key)?.trim().replace(/\s+/g, " ");
    return value ? value.slice(0, max) : undefined;
  };
  // A list written as "none" is given, and empty.
  const list = (key: string) => {
    const value = values.get(key);
    return value !== undefined && /^\s*(?:none|no|nothing)\s*$/i.test(value) ? "" : value;
  };
  const like = text("like", 121);
  const category = text("category");
  const rarity = text("rarity");
  const binds = text("binds", 20);
  const worn = text("worn", 300);
  const carried = text("carried", 300);
  const summary = text("summary", 300);
  const tags = list("tags")
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, MAX_PROPOSAL_PARTS);
  const stats = values.has("stats") ? Object.fromEntries(readParts(list("stats")!)) : undefined;
  const slots = values.has("slots") ? Object.fromEntries(readParts(list("slots")!)) : undefined;
  const proposal = {
    ...(like ? { like } : {}),
    ...(category ? { category } : {}),
    ...(rarity ? { rarity } : {}),
    ...(tags ? { tags } : {}),
    ...(stats ? { stats } : {}),
    ...(slots ? { slots } : {}),
    ...(binds ? { binds } : {}),
    ...(worn ? { worn } : {}),
    ...(carried ? { carried } : {}),
    ...(summary ? { summary } : {}),
  };
  return Object.keys(proposal).length > 0 ? proposal : undefined;
}

/** A fresh global, case-insensitive matcher over `[inventory: ...]` tags. One bounded run of anything
 *  but `]` for the body, so the pattern cannot backtrack. */
export function createInventoryTagRegex(): RegExp {
  return new RegExp(`\\[inventory:([^\\]]{0,${MAX_INVENTORY_TAG_BODY}})\\]`, "gi");
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  if ((first === '"' || first === "'") && trimmed.endsWith(first) && trimmed.length >= 2) return trimmed.slice(1, -1);
  return trimmed;
}

function cleanName(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_NAME_LENGTH);
  return cleaned ? cleaned : undefined;
}

/** Words a leading number measures rather than counts: "50 feet of hempen rope" is one rope. */
const MEASURE_WORDS =
  /^(?:feet|foot|ft|inch|inches|yards?|miles?|days?|hours?|pounds?|lbs?|gallons?|pints?|quarts?|ounces?|oz|years?|percent)\b/i;

/** The count a name carries in itself, and the name without it: "Arrows ×10", "Arrows x10", "10
 *  Arrows". Null for a name with none, or a number that measures it ("50 feet of rope"). A number in
 *  brackets may be the item's own name ("Arrows (20)"), so it stays. */
export function inventoryNameCount(name: string): { name: string; count: number } | null {
  // Each pattern is anchored on one side and has no two repeats that can take the same characters, so
  // a long name cannot make it backtrack.
  const trailing = /\s[×x]\s*(\d{1,4})$/i.exec(name) ?? /×\s*(\d{1,4})$/.exec(name);
  const counted = trailing ? name.slice(0, trailing.index).trim() : "";
  if (trailing && counted) {
    const count = Number(trailing[1]);
    return count > 0 ? { name: counted, count } : null;
  }
  const leading = /^(\d{1,4})\s+(\S.*)$/.exec(name);
  if (leading && !MEASURE_WORDS.test(leading[2]!)) {
    const count = Number(leading[1]);
    return count > 0 ? { name: leading[2]!.trim(), count } : null;
  }
  return null;
}

/**
 * Read one tag body, leniently: attributes in any order, quoted or not, `item` or `items`, `count`,
 * `quantity` or `qty`, and a bare action word (`add`, `remove`, `equip`...) in place of `action=`. An unquoted item runs to
 * the next attribute, so `item=Bronze Key who=Bram` names the Bronze Key. Null when no item is named.
 */
export function parseInventoryTagBody(body: string): InventoryTagRequest | null {
  const attributes = readGmTagAttributes(body);
  const values = new Map<string, string>();
  attributes.forEach((attribute, index) => {
    const key = attribute.key.trim().toLowerCase();
    if (!key || values.has(key)) return;
    const quoted = /^["']/.test(attribute.rawValue);
    // An unquoted value is read to the next attribute rather than to the next space.
    const valueStart = attribute.end - attribute.rawValue.length;
    const raw = quoted ? attribute.rawValue : body.slice(valueStart, attributes[index + 1]?.start ?? body.length);
    values.set(key, unquote(raw));
  });

  const actionValue = values.get("action")?.toLowerCase();
  let action: InventoryTagAction = readAction(actionValue) ?? "add";
  if (actionValue === undefined) {
    // A bare word, read only before the first attribute so an item's own name never counts.
    const bare = /\b(add|remove|give|equip|unequip|bind|unbind|use|pay|earn|buy|sell|reveal|inspect)\b/i.exec(
      body.slice(0, Math.min(attributes[0]?.start ?? body.length, 40)),
    );
    if (bare) action = bare[1]!.toLowerCase() as InventoryTagAction;
  }

  // A payment or an earning names its coins as an amount ("5 gold"), or as an item and a count.
  const amount =
    action === "pay" || action === "earn" ? /^(\d{1,9})\s*(\S.*)$/.exec(values.get("amount")?.trim() ?? "") : null;
  const listed = amount ? amount[2]! : (values.get("items") ?? values.get("item") ?? "");
  const items = listed
    .split(",")
    .map((item) => cleanName(unquote(item)))
    .filter((item): item is string => Boolean(item));
  if (items.length === 0) return null;
  const whole = items.length > 1 ? cleanName(unquote(listed)) : undefined;

  let countText = amount?.[1] ?? values.get("count") ?? values.get("quantity") ?? values.get("qty");
  // A count written into one item's name, with none beside it: "Arrows ×10", "Arrows x10", "10 Arrows"
  // (cloud re-test 2026-10-25: each a new item at 1).
  if (countText === undefined && items.length === 1) {
    const counted = inventoryNameCount(items[0]!);
    if (counted) {
      items[0] = counted.name;
      countText = String(counted.count);
    }
  }
  const parsedCount = countText && /^\d{1,9}$/.test(countText.trim()) ? Number.parseInt(countText, 10) : 1;
  // Coins come by the thousand, so a payment or an earning is held only to what one stack may hold.
  const most = action === "pay" || action === "earn" ? GAME_INVENTORY_MAX_QUANTITY : INVENTORY_TAG_COUNT_MAX;
  const count = parsedCount > 0 ? Math.min(parsedCount, most) : 1;
  const who = cleanName(values.get("who"));
  const to = cleanName(values.get("to"));
  const proposal = action === "add" ? readProposal(values) : undefined;
  const level = action === "buy" ? cleanName(values.get("level")) : undefined;
  const seller =
    action === "buy" || action === "sell" || action === "inspect" ? cleanName(values.get("seller")) : undefined;
  const by = action === "inspect" ? cleanName(values.get("with")) : undefined;
  const lasts = action === "add" ? readInventoryLasts(values.get("lasts")) : undefined;
  return {
    action,
    items,
    ...(whole ? { whole } : {}),
    count,
    ...(who ? { who } : {}),
    ...(to ? { to } : {}),
    ...(proposal ? { proposal } : {}),
    ...(level ? { level } : {}),
    ...(seller ? { seller } : {}),
    ...(by ? { with: by } : {}),
    ...(lasts ? { lasts } : {}),
  };
}

/** The Game Master's `[loot: table="..." who="..."]`: one of the ruleset's loot tables, rolled. */
export function createLootTagRegex(): RegExp {
  return new RegExp(`\\[loot:([^\\]]{0,${MAX_INVENTORY_TAG_BODY}})\\]`, "gi");
}

/** One loot tag body read leniently, as an inventory tag's is: the table (or a bare word naming it) and
 *  whose bag, if any. Null when it names no table. */
export function parseLootTagBody(body: string): { table: string; who?: string } | null {
  const values = new Map<string, string>();
  for (const attribute of readGmTagAttributes(body)) {
    const key = attribute.key.trim().toLowerCase();
    if (key && !values.has(key)) values.set(key, unquote(attribute.rawValue));
  }
  const table = cleanName(values.get("table") ?? (values.size === 0 ? body : undefined));
  if (!table) return null;
  const who = cleanName(values.get("who"));
  return { table, ...(who ? { who } : {}) };
}

/** A loot tag that dropped nothing, answered in place: rolled and empty, or refused and why. What it did
 *  drop is answered as the inventory's own resolved adds instead. */
export function serializeLootTag(input: { table: string; who?: string } | { raw: string }, refused?: string): string {
  const parts: string[] = [];
  const attribute = (key: string, value: string) => parts.push(`${key}="${sanitize(value)}"`);
  if ("raw" in input) attribute("raw", input.raw);
  else {
    attribute("table", input.table);
    if (input.who) attribute("who", input.who);
  }
  if (refused) {
    attribute("result", "refused");
    attribute("reason", refused);
  } else attribute("result", "nothing");
  return `[loot: ${parts.join(" ")}]`;
}

/** What the Engine did with one item of a tag. `count` is how many really moved and `now` how many
 *  of it the bag holds afterwards: the receiver's for a give. */
export type InventoryTagOutcome = { ok: true; count: number; now: number } | { ok: false; reason: string };

function sanitize(value: string, max = MAX_TAG_NAME_LENGTH): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/["[\]]/g, "")
    .slice(0, max)
    .trim();
}

/** The canonical form of one resolved item, built from what the Engine read and did, never spliced
 *  out of what the model wrote. `raw` stands in for a body nothing could be read from. */
export function serializeInventoryTag(
  input:
    | {
        action: InventoryTagAction;
        item: string;
        count: number;
        who?: string;
        to?: string;
        /** A buy's level and seller, and, bought, what it cost (#6917); bought from a seller's stock
         *  today, or a sale's seller and what it fetched (#6934). */
        level?: string;
        seller?: string;
        price?: string;
        stock?: true;
        /** A fake shown for what it truly is: its true name (a reveal, or a sale an honest buyer saw
         *  through). */
        revealed?: string;
        /** How long an add lasts before it vanishes, in minutes (1.760). */
        lasts?: number;
        /** What an inspection found (1.802): fake, named, genuine or unsure. */
        found?: string;
      }
    | { raw: string },
  outcome: InventoryTagOutcome,
  /** What the Engine changed about an item the Game Master invented. */
  note?: string,
): string {
  const parts: string[] = [];
  const attribute = (key: string, value: string | number, max?: number) =>
    parts.push(`${key}="${sanitize(String(value), max)}"`);
  if ("raw" in input) attribute("raw", input.raw);
  else {
    attribute("action", input.action);
    attribute("item", input.item);
    attribute("count", outcome.ok ? outcome.count : input.count);
    if (input.who) attribute("who", input.who);
    if (input.to) attribute("to", input.to);
    if (input.level) attribute("level", input.level);
    if (input.seller) attribute("seller", input.seller);
    if (input.revealed) attribute("revealed", input.revealed);
    if (input.found) attribute("found", input.found);
    if (input.lasts) attribute("lasts", inventoryLastsWords(input.lasts));
  }
  if (outcome.ok) {
    attribute("result", "ok");
    attribute("now", outcome.now);
    if (!("raw" in input) && input.price) attribute("price", input.price);
    if (!("raw" in input) && input.stock) attribute("stock", "true");
  } else {
    attribute("result", "refused");
    attribute("reason", outcome.reason);
  }
  if (note) attribute("note", note, MAX_TAG_NOTE_LENGTH);
  return `[inventory: ${parts.join(" ")}]`;
}

export interface ResolvedInventoryTag {
  action: InventoryTagAction;
  item: string;
  count: number;
  who?: string;
  to?: string;
  ok: boolean;
  now?: number;
  reason?: string;
  /** What a buy cost or a sale fetched, said in the ruleset's coins. */
  price?: string;
  /** A buy's seller, and whether it came out of their stock today (#6934). */
  seller?: string;
  stock?: boolean;
  /** A fake's true name, once it is shown for what it is (1.79). */
  revealed?: string;
  /** What an inspection found (1.802). */
  found?: "fake" | "named" | "genuine" | "unsure";
  /** What the Engine said about it: an inspection's roll and finding, a held buy's warning. */
  note?: string;
}

const FOUND = new Set(["fake", "named", "genuine", "unsure"]);

/** Read one resolved tag body, or null for one the Engine has not answered. */
export function readResolvedInventoryTagBody(body: string): ResolvedInventoryTag | null {
  const values = new Map<string, string>();
  for (const attribute of readGmTagAttributes(body)) {
    const key = attribute.key.trim().toLowerCase();
    if (key && !values.has(key)) values.set(key, unquote(attribute.rawValue));
  }
  const result = values.get("result")?.toLowerCase();
  if (result !== "ok" && result !== "refused") return null;
  const action: InventoryTagAction = readAction(values.get("action")?.toLowerCase()) ?? "add";
  const item = cleanName(values.get("item"));
  if (!item) return null;
  const count = Number.parseInt(values.get("count") ?? "", 10);
  const now = Number.parseInt(values.get("now") ?? "", 10);
  const who = cleanName(values.get("who"));
  const to = cleanName(values.get("to"));
  const reason = values.get("reason")?.trim();
  const price = values.get("price")?.trim();
  return {
    action,
    item,
    // Zero is kept: a put-on or a binding that found nothing left to change moved none.
    count: Number.isFinite(count) && count >= 0 ? count : 1,
    ...(who ? { who } : {}),
    ...(to ? { to } : {}),
    ok: result === "ok",
    ...(result === "ok" && Number.isFinite(now) ? { now } : {}),
    ...(reason && result !== "ok" ? { reason } : {}),
    ...(price && result === "ok" && (action === "buy" || action === "sell") ? { price } : {}),
    // A buy held for a warning keeps its seller too (1.802), for the day's count of them.
    ...(values.get("seller")?.trim() && (result === "ok" || reason === "held")
      ? { seller: values.get("seller")!.trim() }
      : {}),
    ...(values.get("stock")?.trim() === "true" && result === "ok" ? { stock: true } : {}),
    ...(cleanName(values.get("revealed")) ? { revealed: cleanName(values.get("revealed"))! } : {}),
    ...(action === "inspect" && result === "ok" && FOUND.has(values.get("found") ?? "")
      ? { found: values.get("found") as NonNullable<ResolvedInventoryTag["found"]> }
      : {}),
    ...(values.get("note")?.trim() ? { note: values.get("note")!.trim() } : {}),
  };
}

/** The outcomes an already-resolved reply carries, in order, for the client to announce. A tag the
 *  Engine never answered is not reported: nothing happened for it. */
export function readResolvedInventoryTags(text: string): ResolvedInventoryTag[] {
  const found: ResolvedInventoryTag[] = [];
  for (const match of text.matchAll(createInventoryTagRegex())) {
    const resolved = readResolvedInventoryTagBody(match[1] ?? "");
    if (resolved) found.push(resolved);
  }
  return found;
}

/** `text` with its last `replacements.length` inventory tags replaced by those, in order: the tags a
 *  reply just added, whatever an earlier telling of the same message already said before them. */
export function replaceTrailingInventoryTags(text: string, replacements: readonly string[]): string {
  const count = [...text.matchAll(createInventoryTagRegex())].length;
  const first = count - replacements.length;
  if (first < 0 || replacements.length === 0) return text;
  let index = 0;
  return text.replace(createInventoryTagRegex(), (whole) => {
    const at = index++;
    return at >= first ? replacements[at - first]! : whole;
  });
}
