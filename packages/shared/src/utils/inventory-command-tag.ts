// ──────────────────────────────────────────────
// Inventory tag — `[inventory: action="add" item="Rope" count="2" who="Bram"]`
//
// The Game Master says what the party gained, lost or handed over; the Engine owns whether it can
// happen. So, as with sheet commands, the reader takes the REQUEST only: a `result`, `reason` or
// `now` in the input is ignored, and the server rewrites each tag with what it actually did. A tag
// naming several items becomes one tag per item, so every item carries its own outcome.
// ──────────────────────────────────────────────

import type { GameInventoryItemProposal } from "./game-inventory-stacks.js";
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

export type InventoryTagAction = "add" | "remove" | "give" | "equip" | "unequip" | "bind" | "unbind" | "use";

const INVENTORY_TAG_ACTIONS: readonly InventoryTagAction[] = [
  "add",
  "remove",
  "give",
  "equip",
  "unequip",
  "bind",
  "unbind",
  "use",
];

function readAction(value: string | undefined): InventoryTagAction | undefined {
  return INVENTORY_TAG_ACTIONS.find((action) => action === value);
}

export interface InventoryTagRequest {
  action: InventoryTagAction;
  items: string[];
  count: number;
  /** Whose bag: the receiver of an add, the one who loses a remove, the giver of a give, the one who
   *  puts on, takes off, binds or unbinds. */
  who?: string;
  /** Who receives a give. */
  to?: string;
  /** An add that proposes an item of the ruleset: the parts the Game Master gave it. */
  proposal?: Omit<GameInventoryItemProposal, "name">;
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
    const bare = /\b(add|remove|give|equip|unequip|bind|unbind|use)\b/i.exec(
      body.slice(0, Math.min(attributes[0]?.start ?? body.length, 40)),
    );
    if (bare) action = bare[1]!.toLowerCase() as InventoryTagAction;
  }

  const items = (values.get("items") ?? values.get("item") ?? "")
    .split(",")
    .map((item) => cleanName(unquote(item)))
    .filter((item): item is string => Boolean(item));
  if (items.length === 0) return null;

  const countText = values.get("count") ?? values.get("quantity") ?? values.get("qty");
  const parsedCount = countText && /^\d{1,9}$/.test(countText.trim()) ? Number.parseInt(countText, 10) : 1;
  const count = parsedCount > 0 ? Math.min(parsedCount, INVENTORY_TAG_COUNT_MAX) : 1;
  const who = cleanName(values.get("who"));
  const to = cleanName(values.get("to"));
  const proposal = action === "add" ? readProposal(values) : undefined;
  return { action, items, count, ...(who ? { who } : {}), ...(to ? { to } : {}), ...(proposal ? { proposal } : {}) };
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
  input: { action: InventoryTagAction; item: string; count: number; who?: string; to?: string } | { raw: string },
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
  }
  if (outcome.ok) {
    attribute("result", "ok");
    attribute("now", outcome.now);
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
}

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
