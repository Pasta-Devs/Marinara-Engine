// ──────────────────────────────────────────────
// Place tag — `[place: name="Millbrook" size="town"]` (#6917)
//
// The Game Master says which place a scene is in and how big it is, on the ladder of places the
// ruleset's market declares. The Engine answers each tag in place, as it does an inventory tag, so the
// size is always one of the ladder's own. The place in force is the last one answered: in the messages
// the player sees, and then in the reply. A place with no size has no market (the road, the wilds).
// A market day (#6934) lasts until the place changes, or until the Game Master says the same place
// again with `day="new"`.
// ──────────────────────────────────────────────

import { readGmTagAttributes } from "./skill-check-tag.js";

/** Longest body a place tag can carry. */
const MAX_PLACE_TAG_BODY = 400;
/** Longest place name kept. */
const MAX_PLACE_NAME_LENGTH = 120;

/** The place a scene is in: its name, and its size by the ladder's id. */
export interface GamePlace {
  name?: string;
  size?: string;
  /** Said with `day="new"`: a new market day at the same place. */
  newDay?: true;
}

/** An answered place tag where it stands: which text (oldest first) and where in it. */
export interface GamePlaceMark {
  place: GamePlace;
  text: number;
  /** Where the tag ends in its text: what follows it happened at that place. */
  end: number;
}

/** A fresh global, case-insensitive matcher over `[place: ...]` tags. */
export function createPlaceTagRegex(): RegExp {
  return new RegExp(`\\[place:([^\\]]{0,${MAX_PLACE_TAG_BODY}})\\]`, "gi");
}

function clean(value: string | undefined): string | undefined {
  const cleaned = value
    ?.trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[\r\n"[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PLACE_NAME_LENGTH);
  return cleaned ? cleaned : undefined;
}

function readValues(body: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const attribute of readGmTagAttributes(body)) {
    const key = attribute.key.trim().toLowerCase();
    if (key && !values.has(key)) values.set(key, attribute.rawValue);
  }
  return values;
}

/** The `day` attributes of a place tag's body that say a new day, as the Engine reads them. */
function newDayAttributes(body: string) {
  return readGmTagAttributes(body).filter(
    (attribute) => attribute.key.trim().toLowerCase() === "day" && clean(attribute.rawValue)?.toLowerCase() === "new",
  );
}

/** Whether a `[place: ...]` tag begins a new market day, however its `day="new"` is quoted. */
export function gamePlaceTagBeginsDay(tag: string): boolean {
  const body = new RegExp(createPlaceTagRegex().source, "i").exec(tag)?.[1];
  if (body === undefined) return false;
  const first = readGmTagAttributes(body).find((attribute) => attribute.key.trim().toLowerCase() === "day");
  return !!first && clean(first.rawValue)?.toLowerCase() === "new";
}

/** Every `[place: ...]` tag of `text` with any new day it says taken out, the rest as written. */
export function withoutGamePlaceNewDays(text: string): string {
  return text.replace(createPlaceTagRegex(), (whole, body: string) => {
    let kept = body;
    for (const attribute of newDayAttributes(body).reverse()) {
      const before = kept.slice(0, attribute.start).replace(/\s+$/, "");
      kept = `${before}${kept.slice(attribute.end)}`;
    }
    return kept === body ? whole : `[place:${kept}]`;
  });
}

function serialize(place: GamePlace, answer: { result: "ok" } | { result: "refused"; reason: string }): string {
  const parts: string[] = [];
  if (place.name) parts.push(`name="${place.name}"`);
  if (place.size) parts.push(`size="${place.size}"`);
  if (place.newDay) parts.push(`day="new"`);
  parts.push(`result="${answer.result}"`);
  if (answer.result === "refused") parts.push(`reason="${answer.reason}"`);
  return `[place: ${parts.join(" ")}]`;
}

/**
 * Every place tag in a reply, answered in place: a size the ladder has becomes its id, a size it does
 * not have is refused (and changes nothing), and a tag naming neither a place nor a size is refused.
 * With a world (worldgen W1), a name that is one of its places takes its size from the world, whatever
 * size was written: `known` answers such a name, and undefined for a name the world does not list.
 * `place` is the last place the reply moved to, or undefined when it moved nowhere.
 */
export function applyGamePlaceTags(
  content: string,
  sizeOf: (word: string) => { id: string } | undefined,
  known?: (name: string) => { name: string; size?: string } | undefined,
): { content: string; place?: GamePlace } {
  let place: GamePlace | undefined;
  const next = content.replace(createPlaceTagRegex(), (_whole, body: string) => {
    const values = readValues(body);
    const name = clean(values.get("name"));
    const written = clean(values.get("size"));
    if (!name && !written) return serialize({}, { result: "refused", reason: "unreadable" });
    // A new day at a world's place as at any other.
    const newDay = clean(values.get("day"))?.toLowerCase() === "new";
    const listed = name && known ? known(name) : undefined;
    if (listed) {
      place = {
        name: listed.name,
        ...(listed.size ? { size: listed.size } : {}),
        ...(newDay ? { newDay: true as const } : {}),
      };
      return serialize(place, { result: "ok" });
    }
    const size = written === undefined ? undefined : sizeOf(written);
    if (written !== undefined && !size) {
      return serialize({ ...(name ? { name } : {}), size: written }, { result: "refused", reason: "unknown-size" });
    }
    place = {
      ...(name ? { name } : {}),
      ...(size ? { size: size.id } : {}),
      ...(newDay ? { newDay: true as const } : {}),
    };
    return serialize(place, { result: "ok" });
  });
  return { content: next, ...(place ? { place } : {}) };
}

/** Every place tag the Engine answered ok in these texts, oldest first, with where each stands. */
export function answeredGamePlaces(texts: readonly string[]): GamePlaceMark[] {
  const marks: GamePlaceMark[] = [];
  texts.forEach((text, index) => {
    for (const match of text.matchAll(createPlaceTagRegex())) {
      const values = readValues(match[1] ?? "");
      if (clean(values.get("result"))?.toLowerCase() !== "ok") continue;
      const name = clean(values.get("name"));
      const size = clean(values.get("size"));
      const newDay = clean(values.get("day"))?.toLowerCase() === "new";
      marks.push({
        place: { ...(name ? { name } : {}), ...(size ? { size } : {}), ...(newDay ? { newDay: true as const } : {}) },
        text: index,
        end: (match.index ?? 0) + match[0].length,
      });
    }
  });
  return marks;
}

/** The place in force after these texts, oldest first: the last place tag the Engine answered ok, or
 *  null when none was. */
export function lastGamePlace(texts: readonly string[]): GamePlace | null {
  return answeredGamePlaces(texts).at(-1)?.place ?? null;
}

/**
 * Which of these marks began the market day the last of them is in (#6934): a day begins where the
 * place changes (another name, whatever its case, or size) or where the Game Master says `day="new"`. `ordinal` is that
 * mark's place among all of them, which names the day. Null when there is no mark.
 */
export function gameMarketDayStart(marks: readonly GamePlaceMark[]): { mark: GamePlaceMark; ordinal: number } | null {
  if (marks.length === 0) return null;
  let ordinal = 0;
  for (let index = 1; index < marks.length; index++) {
    const before = marks[index - 1]!.place;
    const here = marks[index]!.place;
    const renamed = (here.name ?? "").toLowerCase() !== (before.name ?? "").toLowerCase();
    if (here.newDay || renamed || here.size !== before.size) ordinal = index;
  }
  return { mark: marks[ordinal]!, ordinal };
}
