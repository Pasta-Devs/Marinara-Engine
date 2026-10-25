// ──────────────────────────────────────────────
// A world's edit layer (worldgen W9c): the hand edits kept with a world, applied after its seeded
// compile so every reader of the world (the Game Master's prompt, the World tab, the overworld, towns,
// the atlas) sees the edited world. A world stays its seed, kit and brief plus this small layer: the
// ground painted cell by cell, compiled places renamed or moved, places added, drawn people renamed,
// people added, tactical boards painted for places (W9g), and towns laid out by hand (W9h). Nothing
// compiled is removed.
//
// A layer is checked strictly when it is saved (an unknown place, a cell off the map, a name another
// place has is refused with the reason), and again when its world is read: one that does not fit (written
// around the editor's route) is not applied at all, so a stored layer never makes a world unreadable or
// breaks what the check keeps (one name per place).
// ──────────────────────────────────────────────
import { z } from "zod";
import type { WorldKit } from "../../schemas/world-kit.schema.js";
import { promptSafeText } from "../../schemas/ruleset.schema.js";
import { compileLinks, worldTerrainEntries, type CompiledWorld, type WorldPlace } from "./compile.js";
import { WORLD_BATTLEFIELDS_MAX, worldBattlefieldIssues, worldBattlefieldMapSchema } from "./battlefield-maps.js";
import { WORLD_FURNITURE, WORLD_INTERIOR_USES } from "./furniture.js";

/** The most places a layer adds, people it renames or adds, and compiled places it changes. */
export const WORLD_EDITS_MAX_ADDED = 200;
export const WORLD_EDITS_MAX_PEOPLE = 500;
/** The most pieces of furniture a building's rooms hold by hand. */
export const WORLD_INTERIOR_EDIT_PIECES = 256;
/** Towns laid out freely (map editor Phase 2, `editsVersion` 3): what a cell of a town's painted ground may be
 *  ("." as laid out, s street, q square, o open ground kept clear, t a tree, w a well, f a field, p a path,
 *  ~ water, b a bridge, h a hedge or fence), which of them a walk crosses, the sides a placed building's door
 *  opens on, and a town's decorations (a pack's eight props, drawn only: never in the way). */
export const WORLD_TOWN_GROUND = ".sqotwfp~bh";
export const WORLD_TOWN_WALKABLE = ".sqofpb";
export const WORLD_TOWN_DOOR_SIDES = Object.freeze(["s", "w", "e"] as const);
export const WORLD_TOWN_PROPS = Object.freeze([
  "town_prop0",
  "town_prop1",
  "town_prop2",
  "town_prop3",
  "town_prop4",
  "town_prop5",
  "town_prop6",
  "town_prop7",
] as const);
export const WORLD_TOWN_DECO_MAX = 256;
/** Maps made by hand for places (map editor Phase 3, `editsVersion` 3): a cell is "#" wall, "." floor or "~"
 *  liquid (a cave's water, a crypt's ooze, a station's coolant: the map's pack says), at most WORLD_MAP_MAX
 *  cells across and down; props are a dungeon pack's eight (`dn_prop5` the way out), drawn only. */
export const WORLD_MAP_MAX = Object.freeze({ width: 64, height: 48 });
export const WORLD_MAPS_MAX = 16;
export const WORLD_MAP_PROPS = Object.freeze([
  "dn_prop0",
  "dn_prop1",
  "dn_prop2",
  "dn_prop3",
  "dn_prop4",
  "dn_prop5",
  "dn_prop6",
  "dn_prop7",
] as const);
export const WORLD_MAP_PROPS_MAX = 256;
/** A site's lock on the overworld, as its creator sets it (a cave, mine or ruin outside any town; Engine's
 *  overworld sites): hidden (off the map until the Game Master reveals it), sealed (shown, closed until
 *  revealed) or open (never locked, even when the story names it). */
export const WORLD_SITE_LOCKS = Object.freeze(["hidden", "sealed", "open"] as const);
/** Spots on a hand-made map where people stand, by the hour (map editor Phase 3, B3). */
export const WORLD_MAP_SPOTS_MAX = 32;
export const WORLD_MAP_SPOT_PEOPLE_MAX = 8;
/** The largest ground a world has (the world scale's 96 by 64 cells). */
const MAX_CELLS = 96 * 64;

const ref = z.string().max(40);
const placeId = z.string().min(1).max(16);
/** A hand map's own words for the Game Master (Capability API 1.357). */
export const worldMapWordsSchema = z
  .object({
    floor: promptSafeText(80).optional(),
    wall: promptSafeText(80).optional(),
    liquid: promptSafeText(80).optional(),
    props: z.array(promptSafeText(60).nullable()).max(8).optional(),
  })
  .strict();
export type WorldMapWords = z.infer<typeof worldMapWordsSchema>;
const placeName = promptSafeText(60).refine((value) => value.trim().length > 0, "A name needs more than spaces");
const personName = promptSafeText(40).refine((value) => value.trim().length > 0, "A name needs more than spaces");
const cell = z.object({ x: z.number().int().min(0).max(255), y: z.number().int().min(0).max(255) }).strict();

export const worldEditsSchema = z
  .object({
    /** 3 when the layer lays towns out freely, holds maps of places (map editor Phases 2 and 3) or sites'
     *  locks, 2 when it
     *  holds rooms drawn by hand (W13c), so an older Engine refuses it; 1 otherwise. */
    editsVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** The ground as painted: one character per cell, "." where it is as compiled, else the base-36
     *  index of a kit terrain class. */
    ground: z
      .string()
      .max(MAX_CELLS)
      .regex(/^[.0-9a-z]*$/, "The painted ground is one of . 0-9 a-z per cell")
      .optional(),
    /** Compiled places renamed or moved. */
    places: z
      .array(z.object({ id: placeId, name: placeName.optional(), at: cell.optional() }).strict())
      .max(WORLD_EDITS_MAX_PEOPLE)
      .optional(),
    /** Places added by hand: `e<n>` ids, in the order they were added (a place's parent before it). */
    added: z
      .array(
        z
          .object({
            id: z.string().regex(/^e\d{1,4}$/, "An added place's id is e and a number"),
            name: placeName,
            layer: ref,
            parentId: placeId.optional(),
            at: cell,
            size: ref.optional(),
            tags: z.array(ref).max(4).optional(),
            note: promptSafeText(240).optional(),
          })
          .strict(),
      )
      .max(WORLD_EDITS_MAX_ADDED)
      .optional(),
    /** Drawn people renamed, by id (`<placeId>-<n>`). */
    people: z
      .array(z.object({ id: z.string().min(1).max(24), name: personName }).strict())
      .max(WORLD_EDITS_MAX_PEOPLE)
      .optional(),
    /** People added by hand to a place: `<placeId>-e<n>` ids. */
    addedPeople: z
      .array(
        z
          .object({
            id: z
              .string()
              .regex(/^[a-z0-9]{1,16}-e\d{1,4}$/, "An added person's id is the place's id, -e and a number"),
            placeId,
            name: personName,
            role: promptSafeText(40).optional(),
          })
          .strict(),
      )
      .max(WORLD_EDITS_MAX_PEOPLE)
      .optional(),
    /** Tactical boards painted for places (worldgen W9g): `b<n>` ids. */
    battlefields: z.array(worldBattlefieldMapSchema).max(WORLD_BATTLEFIELDS_MAX).optional(),
    /** Towns laid out by hand (worldgen W9h): buildings moved between the town's lots (a lot by its
     *  top-left corner and its width, as two lots can share a corner), in turn, and its ground painted: "." as laid out, else s street, q square, o open ground, t a
     *  tree, w a well. Checked against the town when saved (`worldTownEditIssues`). */
    towns: z
      .array(
        z
          .object({
            settlement: placeId,
            moves: z
              .array(
                z
                  .object({
                    building: z.string().min(1).max(16),
                    x: z.number().int().min(0).max(255),
                    y: z.number().int().min(0).max(255),
                    w: z.number().int().min(1).max(16),
                  })
                  .strict(),
              )
              .max(WORLD_EDITS_MAX_PEOPLE)
              .optional(),
            /** Buildings placed anywhere free (Phase 2), after the moves (a placed building's move is dropped):
             *  its top-left cell, its size its own, and the side its door opens on (south by default). */
            place: z
              .array(
                z
                  .object({
                    building: z.string().min(1).max(16),
                    x: z.number().int().min(0).max(255),
                    y: z.number().int().min(0).max(255),
                    door: z.enum(WORLD_TOWN_DOOR_SIDES).optional(),
                  })
                  .strict(),
              )
              .max(WORLD_EDITS_MAX_PEOPLE)
              .optional(),
            ground: z
              .string()
              // The biggest town, a city's 52 by 36 cells.
              .max(52 * 36)
              .regex(/^[.sqotwfp~bh]*$/, "A town's painted ground is one of . s q o t w f p ~ b h per cell")
              .optional(),
            /** Decorations (Phase 2): a pack's props anywhere clear, drawn only. */
            deco: z
              .array(
                z
                  .object({
                    tile: z.enum(WORLD_TOWN_PROPS),
                    x: z.number().int().min(0).max(255),
                    y: z.number().int().min(0).max(255),
                  })
                  .strict(),
              )
              .max(WORLD_TOWN_DECO_MAX)
              .optional(),
          })
          .strict(),
      )
      .max(WORLD_EDITS_MAX_ADDED)
      .optional(),
    /** Buildings' rooms furnished by hand (worldgen W13): a building's furniture in place of the pieces
     *  its rooms were laid out with, for rooms of the size they were laid out at (the walls never move).
     *  Checked against the rooms when saved (`worldInteriorEditIssues`). */
    interiors: z
      .array(
        z
          .object({
            settlement: placeId,
            building: z.string().min(1).max(16),
            width: z.number().int().min(3).max(64),
            height: z.number().int().min(3).max(64),
            /** What the rooms were furnished as when furnished (a home, a tavern ...). */
            use: z.enum(WORLD_INTERIOR_USES).optional(),
            /** Rooms drawn by hand (W13c, `editsVersion` 2): the walls, floor and doorways, one character per
             *  cell ("#" wall, "." floor, "d" a doorway between rooms, "D" the way out), in place of the
             *  laid-out rooms, at their own size (at most WORLD_HAND_ROOM_MAX each way). */
            ground: z
              .string()
              .max(64 * 64)
              .regex(/^[#.dD]*$/, "Rooms drawn by hand are one of # . d D per cell")
              .optional(),
            furniture: z
              .array(
                z
                  .object({
                    x: z.number().int().min(0).max(63),
                    y: z.number().int().min(0).max(63),
                    kind: z.enum(WORLD_FURNITURE),
                  })
                  .strict(),
              )
              .max(WORLD_INTERIOR_EDIT_PIECES),
          })
          .strict(),
      )
      .max(WORLD_EDITS_MAX_PEOPLE)
      .optional(),
    /** Maps made by hand for places (map editor Phase 3): when a place has one, entering it opens this map
     *  instead of a generated one. Checked when saved (`worldMapEditIssues`). */
    maps: z
      .array(
        z
          .object({
            id: z.string().regex(/^m\d{1,3}$/, "A map's id is m and a number"),
            place: placeId,
            /** The image pack the map is drawn from (a cave, crypt or station set), by its id; the game's own
             *  pack when none is named. */
            pack: z
              .string()
              .max(80)
              .regex(/^[a-z0-9][a-z0-9_/-]*$/, "A pack's id is lowercase letters, digits, _ - and /")
              .optional(),
            /** Its own words for the Game Master (Capability API 1.357): what its floor, walls and liquid
             *  are, and each prop slot 0..7 (null for a slot left unsaid), so a map drawn from a pack of
             *  its own (a corn maze, a flooded orchard) reads as what it is. */
            words: worldMapWordsSchema.optional(),
            width: z.number().int().min(4).max(WORLD_MAP_MAX.width),
            height: z.number().int().min(4).max(WORLD_MAP_MAX.height),
            /** One character per cell, row by row: "#" wall, "." floor, "~" liquid. */
            ground: z
              .string()
              .max(WORLD_MAP_MAX.width * WORLD_MAP_MAX.height)
              .regex(/^[#.~]*$/, "A map's ground is one of # . ~ per cell"),
            /** Where the party steps in. */
            entry: cell,
            props: z
              .array(
                z
                  .object({
                    tile: z.enum(WORLD_MAP_PROPS),
                    x: z.number().int().min(0).max(255),
                    y: z.number().int().min(0).max(255),
                  })
                  .strict(),
              )
              .max(WORLD_MAP_PROPS_MAX)
              .optional(),
            /** Where people stand (B3): a named spot, who stands there, and the hours (from, up to but not
             *  including to; all day when left out). */
            spots: z
              .array(
                z
                  .object({
                    id: z.string().regex(/^s\d{1,2}$/, "A spot's id is s and a number"),
                    x: z.number().int().min(0).max(255),
                    y: z.number().int().min(0).max(255),
                    name: personName,
                    people: z
                      .array(z.string().regex(/^[a-z0-9]{1,16}-e?\d{1,4}$/, "A person's id"))
                      .max(WORLD_MAP_SPOT_PEOPLE_MAX)
                      .optional(),
                    from: z.number().int().min(0).max(23).optional(),
                    to: z.number().int().min(1).max(24).optional(),
                  })
                  .strict(),
              )
              .max(WORLD_MAP_SPOTS_MAX)
              .optional(),
          })
          .strict(),
      )
      .max(WORLD_MAPS_MAX)
      .optional(),
    /** Sites locked or opened by hand (`editsVersion` 3): a place outside any town and its lock. Checked when
     *  saved (`worldSiteEditIssues`). */
    sites: z
      .array(z.object({ place: placeId, lock: z.enum(WORLD_SITE_LOCKS) }).strict())
      .max(WORLD_EDITS_MAX_PEOPLE)
      .optional(),
  })
  .strict();
export type WorldEdits = z.infer<typeof worldEditsSchema>;
export type WorldEditsInput = z.input<typeof worldEditsSchema>;

/** True for a person added by hand (`<placeId>-e<n>`); drawn people are `<placeId>-<n>`. */
export const worldPersonByHand = (id: string) => /-e\d+$/.test(id);

/** A layer as saved: `editsVersion` 3 when it lays towns out freely (placed buildings, decorations, the new
 *  ground kinds) or holds maps of places or sites' locks, 2 when it holds rooms drawn by hand (W13c), so an older Engine refuses
 *  it rather than misreading it; 1 otherwise, so a layer without them stays readable by older Engines. */
export function worldEditsVersioned(edits: WorldEdits): WorldEdits {
  const freeTowns = edits.towns?.some(
    (each) => each.place?.length || each.deco?.length || /[fp~bh]/.test(each.ground ?? ""),
  );
  const version =
    freeTowns || edits.maps?.length || edits.sites?.length
      ? 3
      : edits.interiors?.some((each) => each.ground !== undefined)
        ? 2
        : 1;
  return edits.editsVersion === version ? edits : { ...edits, editsVersion: version };
}

/** True when a layer changes nothing. */
export function worldEditsEmpty(edits: WorldEdits | null | undefined): boolean {
  return (
    !edits ||
    (!edits.ground?.replace(/\./g, "") &&
      !edits.places?.length &&
      !edits.added?.length &&
      !edits.people?.length &&
      !edits.addedPeople?.length &&
      !edits.battlefields?.length &&
      !edits.towns?.length &&
      !edits.interiors?.length &&
      !edits.maps?.length &&
      !edits.sites?.length)
  );
}

const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Why a layer cannot be kept with this world, or nothing when it can: checked against the world as
 * compiled, before any edit. Drawn people are checked by their id's place and number, since they are
 * drawn rather than stored.
 */
export function checkWorldEdits(
  kit: WorldKit,
  world: CompiledWorld,
  edits: WorldEdits,
  castSize: (place: WorldPlace) => number,
): string[] {
  const issues: string[] = [];
  const inside = (at: { x: number; y: number }) => at.x < world.width && at.y < world.height;
  if (edits.ground !== undefined && edits.ground.length > 0) {
    if (edits.ground.length !== world.width * world.height) {
      issues.push(`The painted ground has ${edits.ground.length} cells; this world has ${world.width * world.height}.`);
    } else if ([...edits.ground].some((char) => char !== "." && parseInt(char, 36) >= world.terrain.length)) {
      issues.push("The painted ground uses a terrain this world's kit does not have.");
    }
  }
  const byId = new Map(world.places.map((place) => [place.id, place]));
  const names = new Map(world.places.map((place) => [place.id, place.name]));
  const seen = new Set<string>();
  for (const edit of edits.places ?? []) {
    if (!byId.has(edit.id)) issues.push(`No place "${edit.id}" to change.`);
    else if (seen.has(edit.id)) issues.push(`Place "${edit.id}" is changed twice.`);
    seen.add(edit.id);
    if (edit.at && !inside(edit.at)) issues.push(`Place "${edit.id}" is moved off the map.`);
    if (edit.name) names.set(edit.id, edit.name.trim());
  }
  const settlementsDepth = kit.layers.findIndex((layer) => layer.settlements);
  const added = new Map<string, { depth: number }>();
  for (const add of edits.added ?? []) {
    const depth = kit.layers.findIndex((layer) => layer.id === add.layer);
    const parent = add.parentId ? (byId.get(add.parentId) ?? added.get(add.parentId)) : undefined;
    if (byId.has(add.id) || added.has(add.id)) issues.push(`Place "${add.id}" is added twice.`);
    if (depth < 0) issues.push(`"${add.name}": no layer "${add.layer}" in this kit.`);
    else if (depth === 0 && add.parentId) issues.push(`"${add.name}": a place in the outermost layer has no parent.`);
    else if (depth > 0 && parent?.depth !== depth - 1) {
      issues.push(`"${add.name}": its parent must be a place one layer out.`);
    }
    if (!inside(add.at)) issues.push(`"${add.name}" is off the map.`);
    if (add.size !== undefined && (depth !== settlementsDepth || !kit.sizes.some((size) => size.id === add.size))) {
      issues.push(`"${add.name}": "${add.size}" is not a settlement size of this kit.`);
    }
    for (const tag of add.tags ?? []) {
      if (!kit.placeTags.some((entry) => entry.id === tag)) issues.push(`"${add.name}": no place tag "${tag}".`);
    }
    names.set(add.id, add.name.trim());
    if (depth >= 0) added.set(add.id, { depth });
  }
  // Every place keeps a name of its own: the Game Master and the ledger find places by name.
  const taken = new Map<string, string>();
  // A renamed place still answers to its old name, so no other place may take it.
  for (const edit of edits.places ?? []) {
    const original = byId.get(edit.id);
    if (edit.name && original && nameKey(edit.name) !== nameKey(original.name)) {
      taken.set(nameKey(original.name), edit.id);
    }
  }
  for (const [id, name] of names) {
    const key = nameKey(name);
    if (taken.has(key) && taken.get(key) !== id) issues.push(`Two places would be called "${name}".`);
    taken.set(key, id);
  }
  const peopleSeen = new Set<string>();
  for (const edit of edits.people ?? []) {
    const match = /^(.+)-(\d+)$/.exec(edit.id);
    const place = match ? byId.get(match[1]!) : undefined;
    if (!match || !place || Number(match[2]) < 1 || Number(match[2]) > castSize(place)) {
      issues.push(`No person "${edit.id}" to rename.`);
    }
    if (peopleSeen.has(edit.id)) issues.push(`Person "${edit.id}" is renamed twice.`);
    peopleSeen.add(edit.id);
  }
  for (const person of edits.addedPeople ?? []) {
    const place = byId.get(person.placeId) ?? added.get(person.placeId);
    if (!place) issues.push(`"${person.name}": no place "${person.placeId}".`);
    else if (place.depth < settlementsDepth)
      issues.push(`"${person.name}": people live in a settlement or in a place inside one.`);
    if (!person.id.startsWith(`${person.placeId}-e`))
      issues.push(`"${person.name}": the id must start with its place's.`);
    if (peopleSeen.has(person.id)) issues.push(`Person "${person.id}" is added twice.`);
    peopleSeen.add(person.id);
  }
  const battlefieldsSeen = new Set<string>();
  for (const map of edits.battlefields ?? []) {
    if (!byId.has(map.place) && !added.has(map.place)) issues.push(`"${map.name}": no place "${map.place}".`);
    if (battlefieldsSeen.has(map.id)) issues.push(`Battlefield "${map.id}" is given twice.`);
    battlefieldsSeen.add(map.id);
    for (const issue of worldBattlefieldIssues(map)) issues.push(`"${map.name}": ${issue}`);
  }
  return [...new Set(issues)].slice(0, 20);
}

/** The world with its edit layer applied: anything that no longer fits is skipped. */
export function applyWorldEdits(
  kit: WorldKit,
  world: CompiledWorld,
  edits: WorldEdits | null | undefined,
): CompiledWorld {
  if (worldEditsEmpty(edits)) return world;
  const { width } = world;
  const inside = (at: { x: number; y: number }) => at.x >= 0 && at.y >= 0 && at.x < width && at.y < world.height;
  let ground = world.ground;
  if (edits!.ground && edits!.ground.length === ground.length) {
    ground = Array.from(ground, (compiled, index) => {
      const painted = edits!.ground![index]!;
      return painted === "." || parseInt(painted, 36) >= world.terrain.length ? compiled : painted;
    }).join("");
  }
  let relink = ground !== world.ground;

  const places = world.places.map((place) => ({ ...place }));
  const byId = new Map(places.map((place) => [place.id, place]));
  for (const edit of edits!.places ?? []) {
    const place = byId.get(edit.id);
    if (!place) continue;
    const name = edit.name?.trim();
    if (name && name !== place.name) {
      place.aliases = [...(place.aliases ?? []), place.name];
      place.name = name;
    }
    if (edit.at && inside(edit.at) && (edit.at.x !== place.at.x || edit.at.y !== place.at.y)) {
      place.at = { x: edit.at.x, y: edit.at.y };
      relink = true;
    }
  }
  const settlementsDepth = kit.layers.findIndex((layer) => layer.settlements);
  for (const add of edits!.added ?? []) {
    const depth = kit.layers.findIndex((layer) => layer.id === add.layer);
    const parent = add.parentId ? byId.get(add.parentId) : undefined;
    if (depth < 0 || byId.has(add.id) || !inside(add.at)) continue;
    if (depth === 0 ? add.parentId : parent?.depth !== depth - 1) continue;
    const settlement = depth === settlementsDepth;
    const rank = Math.max(
      0,
      kit.sizes.findIndex((size) => size.id === add.size),
    );
    const place: WorldPlace = {
      id: add.id,
      name: add.name.trim(),
      layer: add.layer,
      depth,
      parentId: parent?.id ?? null,
      at: { x: add.at.x, y: add.at.y },
      culture: parent?.culture ?? kit.cultures[0]?.id ?? world.places[0]?.culture ?? "",
      ...(settlement ? { size: kit.sizes[rank]!.id, rank, prosperity: "modest" as const } : {}),
      tags: [...(add.tags ?? [])],
      ...(add.note ? { note: add.note } : {}),
      named: true,
      byHand: true,
    };
    places.push(place);
    byId.set(place.id, place);
    if (settlement) relink = true;
  }

  const terrain = worldTerrainEntries(kit);
  const links = relink
    ? compileLinks(
        kit,
        Uint8Array.from(ground, (char) => parseInt(char, 36)),
        world.terrain.map((id) => terrain.find((entry) => entry.id === id) ?? { kind: "open" }),
        width,
        places.filter((place) => place.depth === settlementsDepth),
      )
    : world.links;
  return { ...world, ground, places, links };
}

/** The world's place a name is, by its name or a name it went by, ignoring case and spacing. */
export function worldPlaceNamed<T extends { name: string; aliases?: string[] }>(
  places: readonly T[],
  name: string | undefined,
): T | undefined {
  if (!name) return undefined;
  const key = nameKey(name);
  return (
    places.find((place) => nameKey(place.name) === key) ??
    places.find((place) => place.aliases?.some((alias) => nameKey(alias) === key))
  );
}
