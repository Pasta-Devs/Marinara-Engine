// ──────────────────────────────────────────────
// Location backgrounds: pin a chat background to a story place.
//
// A pin says "while the story is in this place, show this picture". It names
// the place the way the story writes it ("John's bedroom", with other wordings
// such as "John's room"), or follows one World Maps place by id. The most
// specific name wins, so "John's bedroom" and "{{user}}'s bedroom" never mix
// up, and a plain "bedroom" pin only fills in for bedrooms nobody pinned.
// ──────────────────────────────────────────────

/** Chat metadata key holding the chat's pins. */
export const LOCATION_BACKGROUND_PINS_KEY = "locationBackgroundPins";
/** Chat metadata key holding the id of the pin last shown, so a manual pick stays until the place changes. */
export const LOCATION_BACKGROUND_PIN_SHOWN_KEY = "locationBackgroundPinShown";

export const LOCATION_BACKGROUND_PIN_LIMIT = 100;
export const LOCATION_BACKGROUND_NAME_LIMIT = 12;
const NAME_MAX_LENGTH = 80;

export interface LocationBackgroundPin {
  id: string;
  /** What the story calls the place; the first is the label, the rest are other wordings. */
  names: string[];
  /** A World Maps place this pin follows exactly (and the places inside it that have no pin). */
  placeId?: string | null;
  /** The chat background, as stored in chat metadata (a library file name or `gameAsset:<path>`). */
  background: string;
}

export interface LocationBackgroundPlace {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface LocationBackgroundContext {
  /** The World State tracker's location text. */
  location?: string | null;
  /** The World Maps current place id, with the map's places to walk up from it. */
  placeId?: string | null;
  places?: readonly LocationBackgroundPlace[];
  /** Fills {{user}} in pin names. */
  userName?: string | null;
  /** Fill {{char}} in pin names (each character of the chat). */
  characterNames?: readonly string[];
  /**
   * Who wrote the message this location belongs to: "my bedroom" in John's reply is John's
   * bedroom. The persona's name when it is the user's own message.
   */
  speakerName?: string | null;
}

export interface LocationBackgroundMatch {
  pin: LocationBackgroundPin;
  /** "place": a World Maps place pin; "name": a name found in the location text. */
  by: "place" | "name";
  /** The name or place name that matched, for the "Here now" label. */
  matched: string;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Pins from chat metadata, cleaned: unknown shapes dropped, names trimmed and capped. */
export function normalizeLocationBackgroundPins(
  value: unknown,
  limit: number = LOCATION_BACKGROUND_PIN_LIMIT,
): LocationBackgroundPin[] {
  if (!Array.isArray(value)) return [];
  const pins: LocationBackgroundPin[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    const id = readString(record.id).slice(0, 64);
    if (!id || seen.has(id)) continue;
    const names = Array.isArray(record.names)
      ? Array.from(new Set(record.names.map((name) => readString(name).slice(0, NAME_MAX_LENGTH)).filter(Boolean)))
      : [];
    const placeId = readString(record.placeId).slice(0, 128) || null;
    const background = readString(record.background).slice(0, 512);
    seen.add(id);
    pins.push({ id, names: names.slice(0, LOCATION_BACKGROUND_NAME_LIMIT), placeId, background });
    if (pins.length >= limit) break;
  }
  return pins;
}

/** Place names typed out in pins (comma separated) <-> name lists. */
export function splitLocationBackgroundNames(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[,;\n]/u)
        .map((name) => name.trim().slice(0, NAME_MAX_LENGTH))
        .filter(Boolean),
    ),
  ).slice(0, LOCATION_BACKGROUND_NAME_LIMIT);
}

/**
 * Place text in one comparable form: lower case, no accents, possessives folded
 * ("John's" and "Johns'" both read "john"), punctuation as spaces.
 */
export function normalizeLocationText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/gu, "'")
    .replace(/(\p{L})'s(?![\p{L}\p{N}])/gu, "$1")
    .replace(/(\p{L})s'(?![\p{L}\p{N}])/gu, "$1s")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function expandNameMacros(name: string, context: LocationBackgroundContext): string[] {
  const user = readString(context.userName);
  const characters = (context.characterNames ?? []).map(readString).filter(Boolean);
  const withUser = /\{\{\s*user\s*\}\}/iu.test(name)
    ? user
      ? [name.replace(/\{\{\s*user\s*\}\}/giu, user)]
      : []
    : [name];
  const out: string[] = [];
  for (const candidate of withUser) {
    if (/\{\{\s*char\s*\}\}/iu.test(candidate)) {
      for (const character of characters) out.push(candidate.replace(/\{\{\s*char\s*\}\}/giu, character));
    } else {
      out.push(candidate);
    }
  }
  return out;
}

/**
 * The location with "my/our ..." read as the speaker's and "your ..." as the other side's
 * (the persona in a character's message; the only character in the user's own), or "" when
 * nothing changes. Works on normalized text, where "John's" is already "john".
 */
export function resolveSpeakerPossessives(text: string, context: LocationBackgroundContext): string {
  const speaker = normalizeLocationText(readString(context.speakerName));
  if (!speaker || !/(^| )(my|our|your)( |$)/u.test(text)) return "";
  const user = normalizeLocationText(readString(context.userName));
  const characters = (context.characterNames ?? []).map((name) => normalizeLocationText(readString(name)));
  const speakerIsUser = !!user && speaker === user;
  const otherCharacters = characters.filter((name) => name && name !== speaker);
  const listener = speakerIsUser ? (otherCharacters.length === 1 ? otherCharacters[0]! : "") : user;
  const out = text
    .split(" ")
    .map((word) => (word === "my" || word === "our" ? speaker : word === "your" ? listener || word : word))
    .join(" ");
  return out === text ? "" : out;
}

/** Where a pin's name sits in the normalized location, or -1. Whole words only. */
function phraseIndex(haystack: string, needle: string): number {
  if (!needle) return -1;
  const index = ` ${haystack} `.indexOf(` ${needle} `);
  return index;
}

/** Most extra words a name may have between its own words: "Kit's rented bedroom" is still "Kit's bedroom". */
const NAME_GAP_LIMIT = 2;

/** Stands where the place text had a comma, dash or bracket: a gapped name never reaches across it. */
const GAP_BREAK = "xgapbreakx";

/** The place text for gapped names: normalized, with its punctuation breaks kept as GAP_BREAK. */
function gapAwareLocationText(text: string | null | undefined): string {
  return normalizeLocationText((text ?? "").replace(/[,;:()[\]|/]|\s[-–—]\s/gu, ` ${GAP_BREAK} `));
}

/**
 * A pin name of two or more words found in order with a few words between them, as
 * { index, gaps } (where its first word starts, words skipped), or null. The words in between
 * never include a punctuation break or another owner's name, so "John's house, Mara's bedroom"
 * is not "John's bedroom".
 */
function gappedPhrase(
  haystack: string,
  needle: string,
  blocked: ReadonlySet<string>,
): { index: number; gaps: number } | null {
  const words = haystack.split(" ");
  const parts = needle.split(" ");
  if (parts.length < 2) return null;
  let best: { index: number; gaps: number } | null = null;
  for (let start = 0; start < words.length; start++) {
    if (words[start] !== parts[0]) continue;
    let at = start;
    let gaps = 0;
    let ok = true;
    for (const part of parts.slice(1)) {
      let next = -1;
      for (let i = at + 1; i <= Math.min(words.length - 1, at + 1 + NAME_GAP_LIMIT); i++) {
        if (words[i] === part) {
          next = i;
          break;
        }
        if (words[i] === GAP_BREAK || blocked.has(words[i]!)) break;
      }
      if (next < 0) {
        ok = false;
        break;
      }
      gaps += next - at - 1;
      at = next;
    }
    if (ok && gaps <= NAME_GAP_LIMIT && (!best || gaps < best.gaps)) {
      best = { index: words.slice(0, start).join(" ").length + (start > 0 ? 1 : 0), gaps };
    }
  }
  return best;
}

/**
 * The pin for where the story is now, or null.
 *
 * 1. A pin on the exact World Maps place.
 * 2. The most specific pin name found in the location text (or the current place's name):
 *    more words beats fewer, so "John's bedroom" beats "bedroom"; equal ones go to the name
 *    that comes first in the text. A name may have up to two words between its own words
 *    ("John's guest bedroom" is "John's bedroom"), behind an exact match of the same size.
 * 3. A pin on a World Maps place the current place is inside (the house for its hallway).
 */
export function resolveLocationBackgroundPin(
  pinsInput: readonly LocationBackgroundPin[] | unknown,
  context: LocationBackgroundContext,
): LocationBackgroundMatch | null {
  const pins = Array.isArray(pinsInput)
    ? // The chat's own pins are capped where they are stored; gallery pins added after them all count.
      normalizeLocationBackgroundPins(pinsInput, Number.POSITIVE_INFINITY).filter((pin) => pin.background)
    : [];
  if (pins.length === 0) return null;

  const places = new Map((context.places ?? []).map((place) => [place.id, place]));
  const currentPlace = context.placeId ? places.get(context.placeId) : undefined;

  if (context.placeId) {
    const exact = pins.find((pin) => pin.placeId === context.placeId);
    if (exact) return { pin: exact, by: "place", matched: currentPlace?.name ?? exact.names[0] ?? "" };
  }

  const locationText = normalizeLocationText(context.location);
  const gapLocationText = gapAwareLocationText(context.location);
  // "my bedroom" in John's reply is tried as "john bedroom" first, then as written.
  const texts = [
    {
      text: resolveSpeakerPossessives(locationText, context),
      gapText: resolveSpeakerPossessives(gapLocationText, context),
    },
    { text: locationText, gapText: gapLocationText },
    { text: normalizeLocationText(currentPlace?.name), gapText: gapAwareLocationText(currentPlace?.name) },
  ].filter((entry) => entry.text);
  // Owners a gapped name can't skip over: the chat's people, and anyone written as "Mara's" in the place.
  const possessiveOwners = Array.from(
    (context.location ?? "").matchAll(/(\p{L}[\p{L}\p{N}-]*)['‘’ʼ`´]s?(?![\p{L}\p{N}])/gu),
    (found) => found[1],
  );
  const ownerWords = new Set(
    [context.userName, context.speakerName, ...(context.characterNames ?? []), ...possessiveOwners]
      .flatMap((name) => normalizeLocationText(readString(name)).split(" "))
      .filter(Boolean),
  );
  type Candidate = { match: LocationBackgroundMatch; words: number; gaps: number; length: number; index: number };
  let best = null as Candidate | null;
  for (const [textOrder, { text, gapText }] of texts.entries()) {
    for (const pin of pins) {
      for (const name of pin.names) {
        for (const expanded of expandNameMacros(name, context)) {
          const needle = normalizeLocationText(expanded);
          const exactIndex = phraseIndex(text, needle);
          // Words in between ("Kit's rented bedroom") still match, behind an exact match of the same size.
          const gapped =
            exactIndex < 0 && needle
              ? gappedPhrase(
                  gapText || text,
                  needle,
                  new Set([...ownerWords].filter((word) => !needle.split(" ").includes(word))),
                )
              : null;
          if (exactIndex < 0 && !gapped) continue;
          const index = exactIndex >= 0 ? exactIndex : gapped!.index;
          const gaps = gapped?.gaps ?? 0;
          const words = needle.split(" ").length;
          // The tracker text outranks the map place name at the same specificity.
          const position = textOrder * 100_000 + index;
          if (
            !best ||
            words > best.words ||
            (words === best.words && gaps < best.gaps) ||
            (words === best.words && gaps === best.gaps && needle.length > best.length) ||
            (words === best.words && gaps === best.gaps && needle.length === best.length && position < best.index)
          ) {
            best = {
              match: { pin, by: "name", matched: expanded },
              words,
              gaps,
              length: needle.length,
              index: position,
            };
          }
        }
      }
    }
    if (best) break;
  }
  const found = best as Candidate | null;
  if (found) return found.match;

  // Walk up the map: a pinned building covers its unpinned rooms.
  let parentId = currentPlace?.parentId ?? null;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parentPin = pins.find((pin) => pin.placeId === parentId);
    if (parentPin) return { pin: parentPin, by: "place", matched: places.get(parentId)?.name ?? "" };
    parentId = places.get(parentId)?.parentId ?? null;
  }
  return null;
}

/** Pin ids of gallery backgrounds start with this, so they never clash with the chat's own pins. */
export const GALLERY_BACKGROUND_PIN_PREFIX = "gallery:";

/**
 * A character's or persona's gallery pictures labeled "background" with places, as pins.
 * They follow the character into every chat. In a character's gallery {{char}} is that
 * character; in a persona's, {{user}} is that persona. The chat's own pins go first, so they
 * win a tie.
 */
export function galleryBackgroundPins(
  owner: { type: "character" | "persona"; id: string; name: string },
  images: ReadonlyArray<{ id: string; url: string; customKind?: string | null; customName?: string | null }>,
): LocationBackgroundPin[] {
  const pins: LocationBackgroundPin[] = [];
  for (const image of images) {
    if (image.customKind !== "background" || !image.url) continue;
    const names = splitLocationBackgroundNames(image.customName ?? "").map((name) =>
      owner.type === "character"
        ? name.replace(/\{\{\s*char\s*\}\}/giu, owner.name)
        : name.replace(/\{\{\s*user\s*\}\}/giu, owner.name),
    );
    if (names.length === 0) continue;
    pins.push({ id: `${GALLERY_BACKGROUND_PIN_PREFIX}${image.id}`, names, placeId: null, background: image.url });
  }
  return pins;
}

/** Gallery file URL the server serves (and the chat stores as its background). */
export function galleryBackgroundUrl(ownerType: "character" | "persona", ownerId: string, filePath: string): string {
  const filename = filePath.split("/").pop() ?? "";
  return ownerType === "character"
    ? `/api/characters/${ownerId}/gallery/file/${encodeURIComponent(filename)}`
    : `/api/characters/personas/${ownerId}/gallery/file/${encodeURIComponent(filename)}`;
}
