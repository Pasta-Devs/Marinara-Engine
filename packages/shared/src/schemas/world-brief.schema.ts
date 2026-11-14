// ──────────────────────────────────────────────
// A world's brief (worldgen W1): what exists, written once by the model at setup in the setting kit's
// words, and read by the compile, which decides where everything is. Pixelforge's rule: the model says
// what exists, code says where. Bounded lists and the kit's own ids; a reference the kit does not have
// is dropped with a note rather than trusted.
// ──────────────────────────────────────────────
import { z } from "zod";
import { promptSafeText } from "./ruleset.schema.js";
import { normalizeWeatherType } from "../features/combat-conditions.js";
import { WORLD_CHANGE_KINDS, type WorldKit } from "./world-kit.schema.js";
import { isOverusedName } from "../features/world/overused-names.js";

export const WORLD_BRIEF_LIMITS = Object.freeze({
  places: 60,
  names: 160,
  cultures: 12,
  allNames: 400,
  groups: 24,
  peopleNames: 150,
  allPeopleNames: 1500,
  events: 30,
  /** Places the setting holds outside nature: always winter, always night. */
  environments: 24,
});
/** How a culture puts a person's names together. */
export const WORLD_NAME_ORDERS = Object.freeze(["given-family", "family-given", "given"] as const);

const ref = z.string().max(40);
/** A place's or a group's name: something besides spaces, since a map or a tag has to name it. */
const placeName = promptSafeText(60).refine((value) => value.trim().length > 0, "A name needs more than spaces");

const briefPlace = z
  .object({
    name: placeName,
    /** One of the kit's layers. */
    layer: ref,
    /** The name of the place it lies in, one of this brief's places in an outer layer. */
    parent: placeName.optional(),
    /** One of the kit's sizes, for a place in the settlements layer. */
    size: ref.optional(),
    tags: z.array(ref).max(4).default([]),
    note: promptSafeText(240).optional(),
    /** Where the party starts. */
    start: z.literal(true).optional(),
    /** The lore entries this place comes from (canon), when it was read from the player's lore. */
    lore: z.array(z.string().max(64)).max(20).optional(),
  })
  .strict();

const personName = promptSafeText(40);

const briefGroup = z
  .object({
    name: placeName,
    /** One of the kit's group kinds. */
    kind: ref,
    /** The name of the brief place it is seated in. */
    seat: placeName.optional(),
    /** What it wants, in one line. */
    note: promptSafeText(240).optional(),
    allies: z.array(placeName).max(8).default([]),
    rivals: z.array(placeName).max(8).default([]),
  })
  .strict();

/** A place the setting holds outside nature (user, 2026-11-14: a lorebook's "cursed to forever winter"):
 *  its weather, season or light, whatever the climate or the clock, from the game's first day. The Game
 *  Master can let it go in play (environment.ts). `place` is a brief place's name, or "world". */
const briefEnvironment = z
  .object({
    place: placeName,
    /** A weather type (combat-conditions' names); one the Engine does not know is left out. */
    weather: z.string().max(40).optional(),
    season: z.enum(["spring", "summer", "autumn", "winter"]).optional(),
    /** Always night, dusk or day. */
    light: z.enum(["dark", "dusk", "day"]).optional(),
    /** Why: the curse, the power. */
    note: promptSafeText(200).optional(),
    lore: z.array(z.string().max(64)).max(20).optional(),
  })
  .strict();

/** A dated event of the world's past (worldgen W3): a fixed point its history is steered through. */
const briefEvent = z
  .object({
    yearsAgo: z.number().int().min(1).max(5000),
    kind: z.enum(WORLD_CHANGE_KINDS),
    /** What happened, in one line, in the setting's words. */
    text: promptSafeText(240),
    places: z.array(placeName).max(4).default([]),
    groups: z.array(placeName).max(4).default([]),
    /** The lore entries that state it, when it was read from the player's lore. */
    lore: z.array(z.string().max(64)).max(20).optional(),
  })
  .strict();

export const worldBriefSchema = z
  .object({
    briefVersion: z.literal(1),
    /** The present day: what is going on as the game begins. */
    premise: promptSafeText(600),
    places: z.array(briefPlace).max(WORLD_BRIEF_LIMITS.places).default([]),
    /** Names for the places the compile draws, per culture, in that culture's own sound. */
    placeNames: z
      .array(z.object({ culture: ref, names: z.array(placeName).max(WORLD_BRIEF_LIMITS.names) }).strict())
      .max(WORLD_BRIEF_LIMITS.cultures)
      .default([])
      .refine((groups) => groups.reduce((sum, group) => sum + group.names.length, 0) <= WORLD_BRIEF_LIMITS.allNames, {
        message: `At most ${WORLD_BRIEF_LIMITS.allNames} place names in all`,
      }),
    /** The dated events of the past the history must pass through (worldgen W3). */
    events: z.array(briefEvent).max(WORLD_BRIEF_LIMITS.events).default([]),
    /** The groups that matter (worldgen W2): powers and the everyday groups the premise turns on. */
    groups: z.array(briefGroup).max(WORLD_BRIEF_LIMITS.groups).default([]),
    /** Places held outside nature from the first day (environment.ts). */
    environments: z.array(briefEnvironment).max(WORLD_BRIEF_LIMITS.environments).default([]),
    /** Names for the people the compile draws, per culture, in that culture's own sound and order. */
    peopleNames: z
      .array(
        z
          .object({
            culture: ref,
            given: z.array(personName).max(WORLD_BRIEF_LIMITS.peopleNames),
            family: z.array(personName).max(WORLD_BRIEF_LIMITS.peopleNames).default([]),
            order: z.enum(WORLD_NAME_ORDERS).default("given-family"),
          })
          .strict(),
      )
      .max(WORLD_BRIEF_LIMITS.cultures)
      .default([])
      .refine(
        (groups) =>
          groups.reduce((sum, group) => sum + group.given.length + group.family.length, 0) <=
          WORLD_BRIEF_LIMITS.allPeopleNames,
        { message: `At most ${WORLD_BRIEF_LIMITS.allPeopleNames} people's names in all` },
      ),
  })
  .strict();

export type WorldBrief = z.infer<typeof worldBriefSchema>;
export type WorldBriefInput = z.input<typeof worldBriefSchema>;
export type WorldBriefPlace = WorldBrief["places"][number];
export type WorldBriefGroup = WorldBrief["groups"][number];
export type WorldBriefEvent = WorldBrief["events"][number];

/** The deepest layer a brief may place: the settlements layer, and for a world of one site or one
 *  town the layer inside it too, since that town is the whole world. */
export function worldBriefDeepestLayer(kit: WorldKit): number {
  const settlements = kit.layers.findIndex((layer) => layer.settlements);
  return (kit.scale === "site" || kit.scale === "town") && settlements + 1 < kit.layers.length
    ? settlements + 1
    : settlements;
}

/**
 * Reads a brief against its kit: the shape is checked (refused with the reasons when it is wrong), and
 * every reference the kit or the brief does not have is dropped with a note, so one stray tag never
 * costs the player their world.
 */
export function checkWorldBrief(
  kit: WorldKit,
  input: unknown,
): { ok: true; brief: WorldBrief; repairs: string[] } | { ok: false; issues: string[] } {
  const parsed = worldBriefSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "brief"}: ${issue.message}`),
    };
  }
  const repairs: string[] = [];
  const layerAt = new Map(kit.layers.map((layer, index) => [layer.id, index]));
  const settlements = kit.layers.findIndex((layer) => layer.settlements);
  const deepest = worldBriefDeepestLayer(kit);
  const sizes = new Set(kit.sizes.map((size) => size.id));
  const tags = new Set(kit.placeTags.map((tag) => tag.id));
  const cultures = new Set(kit.cultures.map((culture) => culture.id));

  const seen = new Set<string>();
  let started = false;
  const places: WorldBriefPlace[] = [];
  for (const place of parsed.data.places) {
    const key = place.name.toLowerCase();
    const depth = layerAt.get(place.layer);
    if (depth === undefined || depth > deepest) {
      repairs.push(`${place.name}: left out, "${place.layer}" is not a layer a world is made of`);
      continue;
    }
    if (seen.has(key)) {
      repairs.push(`${place.name}: left out, the name is already used`);
      continue;
    }
    seen.add(key);
    const next: WorldBriefPlace = { ...place, tags: place.tags.filter((tag) => tags.has(tag)) };
    if (next.tags.length < place.tags.length) repairs.push(`${place.name}: a tag the kit does not have was left out`);
    if (place.size !== undefined && depth !== settlements) {
      delete next.size;
      repairs.push(`${place.name}: its size was left out, since only a settlement has one`);
    } else if (place.size !== undefined && !sizes.has(place.size)) {
      delete next.size;
      repairs.push(`${place.name}: its size was left out, the compile gives it one`);
    }
    if (place.start) {
      if (started) {
        delete next.start;
        repairs.push(`${place.name}: only the first starting place is kept`);
      }
      started = true;
    }
    places.push(next);
  }
  // Parents are read once every place is known, so a brief may list a town before its province.
  const depthOf = new Map(places.map((place) => [place.name.toLowerCase(), layerAt.get(place.layer)!]));
  for (const place of places) {
    if (place.parent === undefined) continue;
    const parentDepth = depthOf.get(place.parent.toLowerCase());
    if (parentDepth === undefined || parentDepth >= layerAt.get(place.layer)!) {
      repairs.push(`${place.name}: "${place.parent}" is not a place it can lie in, the compile places it`);
      delete place.parent;
    }
  }

  // A name list keeps each name once, and none that models overuse.
  const fresh = (where: string, names: string[], also: (name: string) => boolean = () => false) => {
    const unique = [...new Set(names.map((name) => name.trim()))].filter((name) => name && !also(name));
    const overused = unique.filter(isOverusedName);
    if (overused.length) repairs.push(`${where}: names models overuse were left out (${overused.join(", ")})`);
    return unique.filter((name) => !isOverusedName(name));
  };

  const placeNames: WorldBrief["placeNames"] = [];
  for (const group of parsed.data.placeNames) {
    if (!cultures.has(group.culture)) {
      repairs.push(`placeNames: "${group.culture}" is not one of the kit's cultures`);
      continue;
    }
    placeNames.push({
      culture: group.culture,
      names: fresh(`placeNames (${group.culture})`, group.names, (name) => seen.has(name.toLowerCase())),
    });
  }

  const peopleNames: WorldBrief["peopleNames"] = [];
  for (const group of parsed.data.peopleNames) {
    if (!cultures.has(group.culture) || peopleNames.some((each) => each.culture === group.culture)) {
      repairs.push(`peopleNames: "${group.culture}" is not one of the kit's cultures, or is listed twice`);
      continue;
    }
    peopleNames.push({
      ...group,
      given: fresh(`peopleNames (${group.culture})`, group.given),
      family: fresh(`peopleNames (${group.culture})`, group.family),
    });
  }

  const kinds = new Set(kit.groupKinds.map((kind) => kind.id));
  const groupNames = new Set<string>();
  const groups: WorldBrief["groups"] = [];
  for (const group of parsed.data.groups) {
    const key = group.name.toLowerCase();
    if (!kinds.has(group.kind) || groupNames.has(key)) {
      repairs.push(
        `${group.name}: left out, "${group.kind}" is not one of the kit's kinds of group, or the name is used`,
      );
      continue;
    }
    groupNames.add(key);
    const next = { ...group };
    if (group.seat !== undefined && !seen.has(group.seat.toLowerCase())) {
      repairs.push(`${group.name}: "${group.seat}" is not one of the brief's places, its seat was left out`);
      delete next.seat;
    }
    groups.push(next);
  }
  // Allies and rivals are read once every group is known.
  for (const group of groups) {
    const known = (name: string) =>
      groupNames.has(name.toLowerCase()) && name.toLowerCase() !== group.name.toLowerCase();
    if (![...group.allies, ...group.rivals].every(known)) {
      repairs.push(`${group.name}: an ally or rival that is not one of the brief's groups was left out`);
    }
    group.allies = group.allies.filter(known);
    group.rivals = group.rivals.filter(known);
  }
  // Past events keep only the brief's own places and groups. One the model wrote of a kind of change
  // this world does not have is left out; one read from the player's lore stays, as all canon does.
  const events: WorldBrief["events"] = [];
  for (const event of parsed.data.events) {
    if (!event.lore?.length && !kit.change.kinds[event.kind].on) {
      repairs.push(`An event of a kind this world does not have was left out: "${event.text}"`);
      continue;
    }
    const placesKnown = event.places.filter((name) => seen.has(name.toLowerCase()));
    const groupsKnown = event.groups.filter((name) => groupNames.has(name.toLowerCase()));
    if (placesKnown.length < event.places.length || groupsKnown.length < event.groups.length) {
      repairs.push(`"${event.text}": a place or group that is not in the brief was left out of it`);
    }
    events.push({ ...event, places: placesKnown, groups: groupsKnown });
  }
  // Held places: one of the brief's places (or the whole world), a weather the Engine knows, and at least
  // one thing held; one hold a place, a later one filling what the first left out.
  const environments: WorldBrief["environments"] = [];
  for (const each of parsed.data.environments) {
    const key = each.place.trim().toLowerCase();
    const isWorld = key === "world" || key === "everywhere";
    if (!isWorld && !seen.has(key)) {
      repairs.push(`A held environment on "${each.place}", not one of the brief's places, was left out`);
      continue;
    }
    const next = { ...each, place: isWorld ? "world" : each.place.trim() };
    if (each.weather !== undefined) {
      const weather = normalizeWeatherType(each.weather);
      if (weather) next.weather = weather;
      else {
        repairs.push(`${each.place}: the held weather "${each.weather}" is not one the game knows`);
        delete next.weather;
      }
    }
    if (!next.weather && !next.season && !next.light) continue;
    const earlier = environments.find((other) => other.place.toLowerCase() === next.place.toLowerCase());
    if (earlier) Object.assign(earlier, { ...next, ...earlier });
    else environments.push(next);
  }
  return {
    ok: true,
    brief: { ...parsed.data, places, placeNames, peopleNames, groups, events, environments },
    repairs,
  };
}

const nameOf = (item: unknown) =>
  item && typeof item === "object" ? String((item as { name?: unknown }).name ?? "").toLowerCase() : "";
const textOf = (item: unknown) =>
  item && typeof item === "object" ? String((item as { text?: unknown }).text ?? "").toLowerCase() : "";

/**
 * A brief with the lore's places and events put back (worldgen W1, W3): each replaces the brief's own
 * of the same name or text and goes first, a place keeps the brief's choice to start the party there,
 * and what the brief adds is kept after them, within the brief's limits. Used on the model's reply and
 * when lore is read again after a brief was written, so the brief never drifts from the lore.
 */
export function withWorldCanon(
  written: unknown,
  canon: WorldBriefPlace[],
  canonEvents: WorldBriefEvent[] = [],
  /** Places the lore holds outside nature: always winter, always night. */
  canonEnvironments: WorldBrief["environments"] = [],
): unknown {
  if (!written || typeof written !== "object" || Array.isArray(written)) return written;
  if (canon.length === 0 && canonEvents.length === 0 && canonEnvironments.length === 0) return written;
  const record = { ...(written as Record<string, unknown>) };
  // The lore's held places replace the brief's own hold on the same place.
  if (canonEnvironments.length) {
    const own = Array.isArray(record.environments) ? (record.environments as unknown[]) : [];
    const placeOf = (item: unknown) =>
      item && typeof item === "object" ? String((item as { place?: unknown }).place ?? "").toLowerCase() : "";
    const places = new Set(canonEnvironments.map((each) => each.place.toLowerCase()));
    record.environments = [...canonEnvironments, ...own.filter((each) => !places.has(placeOf(each)))].slice(
      0,
      WORLD_BRIEF_LIMITS.environments,
    );
  }
  if (canonEvents.length > 0) {
    const events = Array.isArray(record.events) ? (record.events as unknown[]) : [];
    const texts = new Set(canonEvents.map((event) => event.text.toLowerCase()));
    record.events = [...canonEvents, ...events.filter((event) => !texts.has(textOf(event)))].slice(
      0,
      WORLD_BRIEF_LIMITS.events,
    );
  }
  if (canon.length > 0) {
    const places = Array.isArray(record.places) ? (record.places as unknown[]) : [];
    const names = new Set(canon.map((place) => place.name.toLowerCase()));
    const startsAt = places.find(
      (place) =>
        place && typeof place === "object" && (place as { start?: unknown }).start === true && names.has(nameOf(place)),
    );
    const startKey = startsAt ? nameOf(startsAt) : undefined;
    record.places = [
      ...canon.map((place) => (place.name.toLowerCase() === startKey ? { ...place, start: true as const } : place)),
      ...places.filter((place) => !names.has(nameOf(place))),
    ].slice(0, WORLD_BRIEF_LIMITS.places);
  }
  return record;
}
