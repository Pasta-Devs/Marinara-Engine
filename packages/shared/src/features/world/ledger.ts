// ──────────────────────────────────────────────
// A world's ledger (worldgen W4): what the story does to the world. The Game Master writes a deed or a
// fact as a `[world: ...]` tag in its reply, answered in place against the world and the kinds of change
// it allows. The ledger is those answered tags in the visible replies, oldest first, so a swipe, a
// regeneration, a deleted message, a branch and a checkpoint all take a world change back or keep it,
// exactly as they do the place. Nothing is stored beside the replies. The present world is the compile,
// then the history, then the ledger folded over them; the seed never overwrites what the story did.
// In play (worldgen W5) the fold also steps the world as the Game Master says time passes, a week at a
// time, with the party where the replies last put it, so its own business goes on around the story.
// ──────────────────────────────────────────────
import { WORLD_CHANGE_KINDS, type WorldChangeKind } from "../../schemas/world-kit.schema.js";
import { lastGamePlace } from "../../utils/game-place-tag.js";
import { readGmTagAttributes } from "../../utils/skill-check-tag.js";
import type { WorldPlace, WorldProsperity } from "./compile.js";
import {
  WORLD_PLAY_BUILD_UP,
  WORLD_STEP_DAYS,
  stepWorld,
  worldFortuneBand,
  worldSettlementOf,
  worldTravelDays,
  type WorldEngineState,
  type WorldNews,
  type WorldPending,
} from "./engine.js";
import type { GameWorld } from "./game-world.js";
import { worldHistory } from "./history.js";

/** What the story can do to a world, and the kind of change each one is. */
export const WORLD_DEED_KINDS = Object.freeze({
  help: "fortunes",
  hinder: "fortunes",
  befriend: "rivalry",
  set_against: "rivalry",
  improve: "fortunes",
  damage: "crime",
  ally: "rivalry",
  betray: "rivalry",
  take: "conflict",
  destroy: "conflict",
  crown: "leadership",
  fall: "catastrophe",
} as const satisfies Record<string, WorldChangeKind>);
export type WorldDeed = keyof typeof WORLD_DEED_KINDS;
const DEEDS = Object.keys(WORLD_DEED_KINDS) as WorldDeed[];

export interface WorldLedgerEntry {
  deed?: WorldDeed;
  fact?: "place" | "group";
  /** The group a deed is done to, or the first of two. */
  group?: string;
  /** The second group of `befriend` and `set_against`. */
  with?: string;
  place?: string;
  /** Who `crown` makes a group's head. */
  who?: string;
  /** A fact's new place or group, and where it is or what kind. */
  name?: string;
  in?: string;
  kind?: string;
  seat?: string;
  note?: string;
  /** Time passing (worldgen W5): how many days, 1 to 365. */
  days?: string;
  /** Something the Game Master narrates beyond the party, of a kind of change (`kind`). */
  event?: string;
  /** A pending outcome the Game Master holds, and on which ground; or lets go. */
  hold?: string;
  ground?: string;
  release?: string;
  /** Where an answered place tag put the party, read from the replies, never written. */
  at?: string;
  /** Only ever the first entry: the living world a session starts from (W11), folded on from. */
  from?: WorldFold;
}

/** The living world as a game's earlier sessions left it (worldgen W11): the present, and the settlement
 *  the party was in. A session folds its own turns on from it, so a change to how the world steps never
 *  remakes the weeks earlier sessions played. */
export interface WorldFold {
  present: WorldPresent;
  partyAt?: string;
}

/** The world as the story has left it. */
export interface WorldPresent extends WorldEngineState {
  /** How each settlement is doing, in the band its fortune is in. */
  prosperity: Record<string, WorldProsperity>;
  /** The party's standing with each group it has dealt with (-100 to 100). */
  standing: Record<string, number>;
  /** Places the story added. */
  places: Array<{ id: string; name: string; parentId: string }>;
  /** What the story did at each place, oldest first. */
  done: Record<string, string[]>;
  /** Every deed at a known place in the order it was done, across places. */
  deeds: Array<{ placeId: string; text: string }>;
  /** How many deeds the party has done: with its holdings, how far its word reaches. */
  renown: number;
  /** The places the party took, and for which group. */
  taken: Record<string, string>;
}

/** The two grounds on which the Game Master may hold a pending outcome (worldgen plan section 7). */
export const WORLD_HOLD_REASONS = Object.freeze(["no-sense", "no-agency"] as const);
/** The most days one tag may pass. */
export const WORLD_DAYS_CAP = 365;
const FORTUNE_OF: Record<WorldProsperity, number> = { struggling: 20, modest: 50, thriving: 80 };

// A body never holds "[", so each tag is read in one pass: a tag opener repeated without a "]" cannot
// make every start scan to the end of the reply.
const WORLD_TAG = /\[world:([^[\]]*)\]/gi;
const LEDGER_TAG = /\[(world|place):([^[\]]*)\]/gi;
// A site the Game Master opened (`[map: reveal ...]`, or gone into by name with `[map: name="..."]`) stays
// open in the sessions after. Only site locks read these carried tags: no map opens from them. A band the
// story set (`[danger:]`, region spawns) holds in the sessions after too.
const CARRIED_TAG =
  /\[(?:(?:world|place|story|danger):|map:(?!\s*leave\b)(?![^[\]]*\baction\s*=\s*"leave"))[^[\]]*\]/gi;
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const clamp = (value: number) => Math.max(-100, Math.min(100, value));

function tagValues(body: string): Map<string, string> {
  return new Map(
    readGmTagAttributes(body).map((attribute) => [
      attribute.key.trim().toLowerCase(),
      attribute.rawValue
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/[\s"[\]]+/g, " ")
        .trim()
        .slice(0, 200),
    ]),
  );
}

function serialize(entry: WorldLedgerEntry, answer: { result: "ok" } | { result: "refused"; reason: string }): string {
  const parts = Object.entries(entry)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}="${value}"`);
  parts.push(`result="${answer.result}"`);
  if (answer.result === "refused") parts.push(`reason="${answer.reason}"`);
  return `[world: ${parts.join(" ")}]`;
}

/** The world's places and groups as the story has left them, to read a tag's names against. */
function known(game: GameWorld, present: WorldPresent) {
  const places = new Map<string, string>();
  for (const place of game.world.places) {
    // A name a place went by before a hand edit renamed it (W9c) still reads as that place.
    for (const alias of place.aliases ?? []) places.set(alias.toLowerCase(), place.name);
  }
  for (const place of game.world.places) places.set(place.name.toLowerCase(), place.name);
  for (const place of present.places) places.set(place.name.toLowerCase(), place.name);
  const groups = new Map<string, string>();
  for (const group of game.brief.groups) groups.set(group.name.toLowerCase(), group.name);
  for (const group of present.groups) groups.set(group.name.toLowerCase(), group.name);
  for (const gone of present.gone) groups.delete(gone.toLowerCase());
  return { places, groups };
}

/**
 * Every world tag in a reply, answered in place: a deed of a kind the world allows, on places and
 * groups it has, is ok (with their names as the world spells them); anything else is refused with the
 * reason. Facts and deeds earlier in the same reply count for the ones after them.
 */
export function applyWorldTags(content: string, game: GameWorld, before: WorldLedgerEntry[]): string {
  const ledger = [...before];
  return content.replace(WORLD_TAG, (_whole, body: string) => {
    const values = tagValues(body);
    const present = worldPresent(game, ledger);
    const { places, groups } = known(game, present);
    const entry: WorldLedgerEntry = {};
    for (const key of [
      "deed",
      "fact",
      "event",
      "days",
      "hold",
      "release",
      "ground",
      "name",
      "in",
      "kind",
      "group",
      "with",
      "place",
      "who",
      "seat",
      "note",
    ] as const) {
      const value = values.get(key);
      if (value) (entry as Record<string, string>)[key] = value;
    }
    const refuse = (reason: string) => serialize(entry, { result: "refused", reason });
    const placeName = (value: string | undefined) => (value ? places.get(value.toLowerCase()) : undefined);
    const groupName = (value: string | undefined) => (value ? groups.get(value.toLowerCase()) : undefined);

    if (entry.fact === "place" || entry.fact === "group") {
      if (!entry.name) return refuse("unreadable");
      if (entry.fact === "place") {
        if (places.has(entry.name.toLowerCase())) return refuse("exists");
        const inside = placeName(entry.in);
        if (!inside) return refuse("unknown-place");
        entry.in = inside;
      } else {
        if (groups.has(entry.name.toLowerCase())) return refuse("exists");
        if (!game.kit.groupKinds.some((kind) => kind.id === entry.kind)) return refuse("unknown-kind");
        if (entry.seat) {
          const seat = placeName(entry.seat);
          if (!seat) return refuse("unknown-place");
          entry.seat = seat;
        }
      }
      ledger.push(entry);
      return serialize(entry, { result: "ok" });
    }

    // Time passing: the world steps as the fold reads it.
    if (entry.days !== undefined && !entry.deed) {
      const days = Number(entry.days);
      if (!Number.isInteger(days) || days < 1) return refuse("unreadable");
      entry.days = String(Math.min(WORLD_DAYS_CAP, days));
      ledger.push(entry);
      return serialize(entry, { result: "ok" });
    }
    // A hold on a pending outcome, on one of the two grounds, or letting it go.
    if (entry.hold !== undefined || entry.release !== undefined) {
      const id = (entry.hold ?? entry.release)!.toLowerCase();
      const pending = present.pending.find((each) => each.id === id);
      if (!pending) return refuse("unknown-pending");
      if (entry.hold !== undefined) {
        if (!WORLD_HOLD_REASONS.some((ground) => ground === entry.ground)) return refuse("unreadable");
        if (pending.held) return refuse("held");
        entry.hold = id;
      } else {
        if (!pending.held) return refuse("not-held");
        entry.release = id;
      }
      ledger.push(entry);
      return serialize(entry, { result: "ok" });
    }
    // Something narrated beyond the party, of a kind the world has.
    if (entry.event !== undefined && !entry.deed) {
      const kind = WORLD_CHANGE_KINDS.find((each) => each === entry.kind);
      if (!kind) return refuse("unknown-kind");
      if (!game.kit.change.kinds[kind].on) return refuse("kind-off");
      if (entry.place) {
        const place = placeName(entry.place);
        if (!place) return refuse("unknown-place");
        entry.place = place;
      }
      if (entry.group) {
        const group = groupName(entry.group);
        if (!group) return refuse("unknown-group");
        entry.group = group;
      }
      ledger.push(entry);
      return serialize(entry, { result: "ok" });
    }

    const deed = DEEDS.find((each) => each === entry.deed);
    if (!deed) return refuse("unreadable");
    if (!game.kit.change.kinds[WORLD_DEED_KINDS[deed]].on) return refuse("kind-off");
    const needsGroup = ["help", "hinder", "befriend", "set_against", "ally", "betray", "take", "destroy", "crown"];
    const needsPlace = ["improve", "damage", "take", "fall"];
    if (needsGroup.includes(deed)) {
      const group = groupName(entry.group);
      if (!group) return refuse("unknown-group");
      entry.group = group;
    }
    if (deed === "befriend" || deed === "set_against") {
      const other = groupName(entry.with);
      if (!other || other === entry.group) return refuse("unknown-group");
      entry.with = other;
    }
    if (needsPlace.includes(deed)) {
      const place = placeName(entry.place);
      if (!place) return refuse("unknown-place");
      entry.place = place;
    }
    if (deed === "crown" && !entry.who) return refuse("unreadable");
    ledger.push(entry);
    return serialize(entry, { result: "ok" });
  });
}

/** The ledger: every world tag answered ok in these replies, oldest first, and where each answered place
 *  tag put the party between them. */
export function readWorldLedger(replies: readonly string[]): WorldLedgerEntry[] {
  const entries: WorldLedgerEntry[] = [];
  for (const reply of replies) {
    for (const match of reply.matchAll(LEDGER_TAG)) {
      if (match[1]!.toLowerCase() === "place") {
        const place = lastGamePlace([match[0]]);
        if (place?.name) entries.push({ at: place.name });
        continue;
      }
      const values = tagValues(match[2] ?? "");
      if (values.get("result") !== "ok") continue;
      values.delete("result");
      entries.push(Object.fromEntries(values) as WorldLedgerEntry);
    }
  }
  return entries;
}

/** What a game's earlier sessions carry into the next (each session is its own chat): every ledger tag
 *  of their Game Master's replies, in order, and how many replies there were. */
export interface WorldLedgerCarry {
  replies: number;
  tags: string;
  /** The tags of the session's last reply with anything in it: what the Game Master tripped there in a
   *  story (worldgen W10) arrives at the start of the next session's first reply. */
  last?: string;
}

/** A session's carry as stored in its metadata, or null. */
export function worldLedgerCarry(value: unknown): WorldLedgerCarry | null {
  if (!value || typeof value !== "object") return null;
  const { replies, tags, last } = value as Record<string, unknown>;
  return typeof tags === "string" && typeof replies === "number" && Number.isInteger(replies) && replies >= 0
    ? { replies, tags, ...(typeof last === "string" && last ? { last } : {}) }
    : null;
}

/** The carry into the next session: what this one carried in, then its own Game Master's replies. */
export function carryWorldLedger(carried: WorldLedgerCarry | null, replies: readonly string[]): WorldLedgerCarry {
  // The world's tags, and the story's (worldgen W10), which fold the same way, and the sites opened.
  const tags = replies.flatMap((reply) => [...reply.matchAll(CARRIED_TAG)].map((match) => match[0]));
  const lastReply = [...replies].reverse().find((reply) => reply.trim());
  const last = lastReply ? [...lastReply.matchAll(CARRIED_TAG)].map((match) => match[0]).join("") : carried?.last;
  return {
    replies: (carried?.replies ?? 0) + replies.length,
    tags: [carried?.tags ?? "", ...tags].filter(Boolean).join("\n"),
    ...(last ? { last } : {}),
  };
}

/** The ledger entries of the Engine's own walk and visit tags (worldgen W8), which go before a reply
 *  unanswered and are answered with it: read as they will be, for what this turn already knows. */
export function readToldLedger(tags: string): WorldLedgerEntry[] {
  return readWorldLedger([tags.replace(/\]/g, ' result="ok"]')]);
}

// A few folds of each world, by their ledger, as the history keeps its runs: a turn folds the same replies
// once for the prompt and again for each tag a reply writes. Keyed by the world itself, never its recipe:
// a world read from its snapshot (W11) and one made now from the same recipe may differ.
const presentCache = new WeakMap<object, Map<string, WorldPresent>>();
const PRESENT_CACHE_SIZE = 16;

/** The world as the history left it, with the ledger folded over it, stepping as time passes. */
export function worldPresent(game: GameWorld, ledger: readonly WorldLedgerEntry[]): WorldPresent {
  const key = JSON.stringify(ledger);
  const folds = presentCache.get(game.world) ?? new Map<string, WorldPresent>();
  presentCache.set(game.world, folds);
  const hit = folds.get(key);
  if (hit) return structuredClone(hit);
  const { present } = foldPresent(game, ledger);
  folds.set(key, present);
  if (folds.size > PRESENT_CACHE_SIZE) folds.delete(folds.keys().next().value!);
  return structuredClone(present);
}

/** The living world after a ledger, to start the next session from (W11). */
export function worldFold(game: GameWorld, ledger: readonly WorldLedgerEntry[]): WorldFold {
  const { present, partyAt } = foldPresent(game, ledger);
  return { present, ...(partyAt ? { partyAt } : {}) };
}

function foldPresent(
  game: GameWorld,
  ledger: readonly WorldLedgerEntry[],
): { present: WorldPresent; partyAt?: string } {
  const history = worldHistory(game);
  const byName = new Map([
    ...game.world.places.flatMap((place) =>
      (place.aliases ?? []).map((alias) => [alias.toLowerCase(), place] as const),
    ),
    ...game.world.places.map((place) => [place.name.toLowerCase(), place] as const),
  ]);
  const from = ledger[0]?.from;
  const present: WorldPresent = from
    ? structuredClone(from.present)
    : {
        day: 0,
        fortune: Object.fromEntries(
          game.world.places
            .filter((place) => place.prosperity)
            .map((place) => [place.id, FORTUNE_OF[place.prosperity!]]),
        ),
        prosperity: {},
        ruined: [],
        keepers: { ...history.keepers },
        leaders: { ...history.leaders },
        relations: { ...history.relations },
        standing: {},
        gone: [],
        places: [],
        groups: [],
        done: {},
        deeds: [],
        news: [],
        pending: [],
        raised: 0,
        renown: 0,
        taken: {},
      };
  const placeId = (name: string | undefined) => {
    if (!name) return undefined;
    return (
      byName.get(name.toLowerCase())?.id ??
      present.places.find((place) => place.name.toLowerCase() === name.toLowerCase())?.id
    );
  };
  // The world place a name is, or the one an added place is within.
  const worldPlaceId = (name: string | undefined) => {
    const id = placeId(name);
    return present.places.find((place) => place.id === id)?.parentId ?? id;
  };
  const record = (name: string | undefined, line: string) => {
    const id = placeId(name);
    if (!id) return;
    present.done[id] = [...(present.done[id] ?? []), line];
    present.deeds.push({ placeId: id, text: line });
  };
  const shift = (id: string, by: number) => {
    present.fortune[id] = Math.max(0, Math.min(100, (present.fortune[id] ?? 50) + by));
  };
  // Where the party is, for the scene-first rule: the settlement the replies last put it in.
  let partyAt = from ? from.partyAt : worldSettlementOf(game, game.world.startId)?.id;
  for (const entry of from ? ledger.slice(1) : ledger) {
    if (entry.at !== undefined) {
      partyAt = worldSettlementOf(game, worldPlaceId(entry.at))?.id;
      continue;
    }
    if (entry.days !== undefined && !entry.deed) {
      const to = present.day + Math.min(WORLD_DAYS_CAP, Math.max(0, Math.floor(Number(entry.days)) || 0));
      for (let step = Math.floor(present.day / WORLD_STEP_DAYS) + 1; step <= Math.floor(to / WORLD_STEP_DAYS); step++) {
        stepWorld(game, present, step, partyAt);
      }
      present.day = to;
      continue;
    }
    if (entry.hold !== undefined || entry.release !== undefined) {
      const pending = present.pending.find((each) => each.id === (entry.hold ?? entry.release));
      const ground = WORLD_HOLD_REASONS.find((each) => each === entry.ground);
      if (pending && entry.hold !== undefined && ground) pending.held = ground;
      if (pending && entry.release !== undefined) delete pending.held;
      continue;
    }
    if (entry.event !== undefined && !entry.deed) {
      const kind = WORLD_CHANGE_KINDS.find((each) => each === entry.kind);
      if (!kind) continue;
      const seat = entry.group
        ? (game.brief.groups.find((group) => group.name === entry.group)?.seat ??
          present.groups.find((group) => group.name === entry.group)?.seat)
        : undefined;
      const at = worldSettlementOf(game, worldPlaceId(entry.place ?? seat))?.id;
      // Severe events move the place they happened in, as the engine's own would.
      const toll = { crime: -8, conflict: -25, catastrophe: -40 } as Partial<Record<WorldChangeKind, number>>;
      if (at && toll[kind]) shift(at, toll[kind]!);
      present.news.push({
        day: present.day,
        kind,
        text: entry.event,
        ...(at ? { placeId: at } : {}),
        ...(kind === "conflict" || kind === "catastrophe" ? { severe: true as const } : {}),
      });
      continue;
    }
    const note = entry.note ? ` (${entry.note})` : "";
    if (entry.fact === "place" && entry.name && entry.in) {
      // Inside a place the story added, it is within that place's own world place.
      const key = entry.in.toLowerCase();
      const parentId =
        byName.get(key)?.id ?? present.places.find((place) => place.name.toLowerCase() === key)?.parentId;
      if (parentId) present.places.push({ id: `x${present.places.length + 1}`, name: entry.name, parentId });
      continue;
    }
    if (entry.fact === "group" && entry.name && entry.kind) {
      present.groups.push({ name: entry.name, kind: entry.kind, ...(entry.seat ? { seat: entry.seat } : {}) });
      // A group the story brings back under a gone group's name is a group again.
      present.gone = present.gone.filter((gone) => gone.toLowerCase() !== entry.name!.toLowerCase());
      continue;
    }
    if (!entry.deed) continue;
    // The party's word reaches as far as its renown: half as far as a stranger's at first, twice as
    // far once it has done twenty deeds.
    const reach = 0.5 + 1.5 * Math.min(1, worldRenown(present) / 20);
    const push = (amount: number) => Math.round(amount * reach);
    present.renown += 1;
    const group = entry.group ?? "";
    const id = placeId(entry.place);
    switch (entry.deed) {
      case "help":
      case "hinder":
        present.standing[group] = clamp((present.standing[group] ?? 0) + push(entry.deed === "help" ? 15 : -15));
        break;
      case "ally":
      case "betray":
        present.standing[group] = clamp((present.standing[group] ?? 0) + push(entry.deed === "ally" ? 50 : -50));
        break;
      case "befriend":
      case "set_against": {
        const key = pairKey(group, entry.with ?? "");
        present.relations[key] = clamp((present.relations[key] ?? 0) + push(entry.deed === "befriend" ? 25 : -25));
        break;
      }
      case "improve":
      case "damage":
        if (id) shift(id, entry.deed === "improve" ? 30 : -30);
        record(entry.place, `${entry.deed === "improve" ? "The party improved it" : "The party damaged it"}${note}.`);
        break;
      case "take":
        if (id) present.keepers[id] = group;
        if (id) present.taken[id] = group;
        record(entry.place, `${group} took it${note}.`);
        break;
      case "destroy":
        present.gone.push(group);
        for (const [place, keeper] of Object.entries(present.keepers))
          if (keeper === group) delete present.keepers[place];
        present.pending = present.pending.filter((pending) => !pending.groups.includes(group));
        break;
      case "crown":
        present.leaders[group] = { name: entry.who ?? "", sinceYearsAgo: 0 };
        break;
      case "fall":
        if (id && !present.ruined.includes(id)) present.ruined.push(id);
        record(entry.place, `It fell to ruin${note}.`);
        break;
    }
  }
  present.prosperity = Object.fromEntries(
    Object.entries(present.fortune).map(([id, fortune]) => [id, worldFortuneBand(fortune)]),
  );
  return { present, partyAt };
}

/** A place the story added, by name, as the place tag reads it. */
export function worldAddedPlace(
  game: GameWorld,
  present: WorldPresent,
  name: string,
): { place: { id: string; name: string }; within: WorldPlace } | undefined {
  const added = present.places.find((place) => place.name.toLowerCase() === name.trim().toLowerCase());
  const within = added ? game.world.places.find((place) => place.id === added.parentId) : undefined;
  return added && within ? { place: added, within } : undefined;
}

/** How the Game Master records what the story does to the world, for the deeds this world allows. */
export function worldLedgerInstructions(game: GameWorld): string {
  const on = (deed: WorldDeed) => game.kit.change.kinds[WORLD_DEED_KINDS[deed]].on;
  const list = (deeds: WorldDeed[]) => deeds.filter(on).join(", ");
  const toGroup = list(["help", "hinder", "ally", "betray", "destroy"]);
  const toTwo = list(["befriend", "set_against"]);
  const toPlace = list(["improve", "damage", "fall"]);
  const kindsOn = WORLD_CHANGE_KINDS.filter((kind) => game.kit.change.kinds[kind].on);
  return [
    `When the party changes the world, record it in your reply and the world remembers it, with note="what happened" on any of these:`,
    ...(toGroup ? [`- To a group: [world: deed="..." group="Name"] for ${toGroup}.`] : []),
    ...(on("crown") ? [`- A group's new head: [world: deed="crown" group="Name" who="Their name"].`] : []),
    ...(toTwo ? [`- Between two groups: [world: deed="..." group="Name" with="Other"] for ${toTwo}.`] : []),
    ...(toPlace ? [`- To a place: [world: deed="..." place="Name"] for ${toPlace}.`] : []),
    ...(on("take") ? [`- A place taken for a group: [world: deed="take" place="Name" group="Name"].`] : []),
    `- A place or group the story brings in: [world: fact="place" name="Name" in="Where it is"] or [world: fact="group" name="Name" kind="${game.kit.groupKinds[0]!.id}" seat="Where"], kind one of ${game.kit.groupKinds.map((kind) => kind.id).join(", ")}.`,
    `- When time passes in the story (a journey, a night's rest, a wait), say how long: [world: days="N"]. The world goes on with its own business a week at a time, and its news reaches the party as it travels.`,
    ...(kindsOn.length
      ? [
          `- Something you narrate beyond the party: [world: event="what happened" kind="..." place="Name"], kind one of ${kindsOn.join(", ")}.`,
        ]
      : []),
    ...(game.kit.change.kinds.conflict.on
      ? [
          `- A war the world has brewing, shown with its id, may be held only when it makes no sense for this world, or would wreck the game with no real chance for the party to stop it: [world: hold="p1" ground="no-sense"] or ground="no-agency". [world: release="p1"] lets it go.`,
        ]
      : []),
  ].join("\n");
}

/** How widely the party is known, as bands the screen names in its own language (worldgen W7). */
export const WORLD_RENOWN_BANDS = Object.freeze(["famous", "regional", "local", "unknown"] as const);
export type WorldRenownBand = (typeof WORLD_RENOWN_BANDS)[number];
const RENOWN_WORDS: Array<[number, WorldRenownBand, string]> = [
  [20, "famous", "famous"],
  [8, "regional", "known in the region"],
  [3, "local", "known locally"],
  [0, "unknown", "unknown"],
];

/** How widely the party is known: its deeds, and three for each place it took for a group that still
 *  keeps it and trusts the party (its holdings). */
export function worldRenown(present: WorldPresent): number {
  const holdings = Object.entries(present.taken).filter(
    ([id, group]) => present.keepers[id] === group && (present.standing[group] ?? 0) >= 50,
  ).length;
  return present.renown + 3 * holdings;
}

/** How widely the party is known, in words. */
export function worldRenownWord(renown: number): string {
  return RENOWN_WORDS.find(([floor]) => renown >= floor)![2];
}

/** How widely the party is known, as a band. */
export function worldRenownBand(renown: number): WorldRenownBand {
  return RENOWN_WORDS.find(([floor]) => renown >= floor)![1];
}

/** News from further than this many days away is still only a rumour when it arrives. */
const RUMOUR_DAYS = 10;

/** The news that has reached a settlement by now, newest first, with how many days ago it happened
 *  and whether it is still only a rumour. News from a place no way reaches never arrives. */
export function worldNewsHere(
  game: GameWorld,
  present: WorldPresent,
  homeId: string | undefined,
  limit = 5,
): Array<{ news: WorldNews; ago: number; rumour: boolean }> {
  const travel = homeId ? worldTravelDays(game, homeId) : undefined;
  const heard = present.news.flatMap((news) => {
    const way = news.placeId === undefined || news.placeId === homeId ? 0 : travel?.get(news.placeId);
    if (way === undefined || news.day + way > present.day) return [];
    return [{ news, ago: present.day - news.day, rumour: way > RUMOUR_DAYS }];
  });
  return heard.slice(-limit).reverse();
}

/** The outcomes the world has pending near a settlement, or that word of has reached it: each with how
 *  many weeks it has brewed, whether it could happen any week now, whether it is here, and whether the
 *  party has heard of it. */
export function worldBrewingNear(
  game: GameWorld,
  present: WorldPresent,
  homeId: string | undefined,
): Array<{ pending: WorldPending; weeks: number; ripe: boolean; here: boolean; heard: boolean }> {
  const travel = homeId ? worldTravelDays(game, homeId) : undefined;
  const step = Math.floor(present.day / WORLD_STEP_DAYS);
  return present.pending.flatMap((pending) => {
    const kept = Object.entries(present.keepers)
      .filter(([, keeper]) => pending.groups.includes(keeper))
      .map(([id]) => id);
    const here = homeId !== undefined && kept.includes(homeId);
    const near = here || kept.some((id) => (travel?.get(id) ?? Infinity) <= RUMOUR_DAYS);
    const warning = present.news.find((news) => news.pending === pending.id);
    const way = !warning?.placeId || warning.placeId === homeId ? 0 : travel?.get(warning.placeId);
    const heard = warning !== undefined && way !== undefined && warning.day + way <= present.day;
    if (!near && !heard) return [];
    const weeks = step - pending.sinceStep;
    return [{ pending, weeks, ripe: weeks >= WORLD_PLAY_BUILD_UP, here, heard }];
  });
}

/** The party's standing with a group, as bands the screen names in its own language (worldgen W7). */
export const WORLD_STANDING_BANDS = Object.freeze(["trusted", "good", "neither", "bad", "enemies"] as const);
export type WorldStandingBand = (typeof WORLD_STANDING_BANDS)[number];
const STANDING_WORDS: Array<[number, WorldStandingBand, string]> = [
  [50, "trusted", "trusted"],
  [15, "good", "on good terms"],
  [-14, "neither", "neither"],
  [-49, "bad", "on bad terms"],
  [-100, "enemies", "enemies"],
];

/** The party's standing with a group, in words. */
export function worldStandingWord(standing: number): string {
  return STANDING_WORDS.find(([floor]) => standing >= floor)![2];
}

/** The party's standing with a group, as a band. */
export function worldStandingBand(standing: number): WorldStandingBand {
  return STANDING_WORDS.find(([floor]) => standing >= floor)![1];
}

/** What the story has changed across the world since play began, for the per-turn reminder. */
export function worldChangesLines(game: GameWorld, present: WorldPresent): string[] {
  const history = worldHistory(game);
  const nameOf = (id: string) =>
    game.world.places.find((place) => place.id === id)?.name ?? present.places.find((place) => place.id === id)?.name;
  const changes = [
    ...Object.entries(present.leaders)
      .filter(([group, leader]) => !present.gone.includes(group) && history.leaders[group]?.name !== leader.name)
      .map(([group, leader]) => `${group} is now led by ${leader.name}.`),
    ...present.gone.map((group) => `${group} is gone.`),
    ...present.ruined.flatMap((id) => (nameOf(id) ? [`${nameOf(id)} lies in ruins.`] : [])),
    ...present.groups
      .filter((group) => !present.gone.includes(group.name))
      .map((group) => {
        const kind = game.kit.groupKinds.find((each) => each.id === group.kind)?.label ?? group.kind;
        return `${group.name} (${kind}${group.seat ? `, at ${group.seat}` : ""}) has come into the world.`;
      }),
  ];
  const standing = Object.entries(present.standing)
    .filter(([group, value]) => !present.gone.includes(group) && worldStandingWord(value) !== "neither")
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 8);
  return [
    ...(worldRenown(present) >= 3 ? [`- The party is ${worldRenownWord(worldRenown(present))}.`] : []),
    ...(changes.length ? [`- Since play began: ${changes.join(" ")}`] : []),
    ...(standing.length
      ? [
          `- The party's standing: ${standing.map(([group, value]) => `${group} (${worldStandingWord(value)})`).join(", ")}.`,
        ]
      : []),
  ];
}
