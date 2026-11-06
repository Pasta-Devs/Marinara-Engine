// ──────────────────────────────────────────────
// Hand-made battlefields (worldgen W9g): tactical boards painted for a world's places, kept in its hand
// edits so they travel wherever the world does (world files, map packs, the library, a new game's
// setup). A fight that starts while the party is at a place, or at a place inside it, is fought on one
// of that place's boards exactly as painted, instead of a generated one: the nearest place up that has
// any, and of several, the one the fight's seed picks.
// ──────────────────────────────────────────────
import { z } from "zod";
import { promptSafeText } from "../../schemas/ruleset.schema.js";
import { TACTICAL_ENVIRONMENTS, TACTICAL_TERRAINS } from "../tactical-combat/environments.js";
import { gridDimensions, tacticalMadeBoardIssues } from "../tactical-combat/grid-gen.js";
import type { TacticalGrid, TacticalMadeBattlefield, TacticalTerrain } from "../tactical-combat/types.js";
import { BOARD_PROP_ART } from "./board-pack.js";
import type { GameWorld } from "./game-world.js";

/** The seasons a board's tiles may be painted in: the world's (overworld.ts WORLD_SEASONS). */
const BATTLEFIELD_SEASONS = ["spring", "summer", "autumn", "winter"] as const;

/** The most battlefields a world has. */
export const WORLD_BATTLEFIELDS_MAX = 32;

/** One character per tile in a painted row. */
export const WORLD_BATTLEFIELD_TILE_CHARS: Readonly<Record<TacticalTerrain, string>> = Object.freeze({
  plains: "p",
  forest: "f",
  mountain: "m",
  ruin: "r",
  water: "w",
  wall: "#",
});
const TERRAIN_OF = new Map(TACTICAL_TERRAINS.map((terrain) => [WORLD_BATTLEFIELD_TILE_CHARS[terrain], terrain]));

/** The most props one battlefield has. */
export const WORLD_BATTLEFIELD_PROPS_MAX = 24;

const damageWords = z.array(z.string().trim().min(1).max(40)).max(16).optional();

/** A thing standing on a painted board that may be broken (1.316), on the tiles it fills. Broken in a
 *  fight, its label is told to the story as what was broken. */
export const worldBattlefieldPropSchema = z
  .object({
    /** `p<n>`, as the editor numbers them. */
    id: z.string().regex(/^p\d{1,4}$/, "A prop's id is p and a number"),
    label: promptSafeText(40)
      .refine((value) => value.trim().length > 0, "A prop's label needs more than spaces")
      // The recap lists what broke split by semicolons, and a story reads it back that way.
      .refine((value) => !value.includes(";"), "A prop's label cannot contain a semicolon"),
    cells: z
      .array(z.object({ x: z.number().int().min(0).max(13), y: z.number().int().min(0).max(9) }).strict())
      .min(1)
      .max(16),
    health: z.number().int().min(1).max(1000),
    /** What a blow must reach to hit it; 10 when not said. */
    defense: z.number().int().min(0).max(40).optional(),
    resist: damageWords,
    vulnerable: damageWords,
    immune: damageWords,
    /** Whether it closes its tiles while it stands: to walking, to seeing through, or both. */
    blocks: z.object({ move: z.boolean().optional(), sight: z.boolean().optional() }).strict().optional(),
    /** Anything that hits it breaks it. */
    fragile: z.boolean().optional(),
    /** Somebody beside it may light it again (1.332): `light` within `squares` of it. */
    relight: z
      .object({
        light: z.enum(["bright", "dim", "sunlight"]),
        squares: z.number().int().min(0).max(12),
        budget: z.string().trim().min(1).max(40).optional(),
      })
      .strict()
      .optional(),
    /** Its sprite in the board's pack (1.333): `bp_<name>`, and `bp_<name>_broken` once broken. */
    art: z.string().max(60).regex(BOARD_PROP_ART, "A prop's art is bp_ then lowercase words joined by _").optional(),
  })
  .strict();
export type WorldBattlefieldProp = z.infer<typeof worldBattlefieldPropSchema>;

const boardCell = z.object({ x: z.number().int().min(0).max(13), y: z.number().int().min(0).max(9) }).strict();
const reach = z.number().int().min(0).max(14);
const boardCarry = z
  .object({ toward: z.enum(["north", "south", "east", "west"]), squares: z.number().int().min(1).max(6) })
  .strict();

/** Something a painted board does on its own each round (Capability API 1.318): growth spreading,
 *  ice cracking, a wheel turning, the ground freezing in rings. */
export const worldBattlefieldEventSchema = z
  .object({
    id: z.string().regex(/^e\d{1,4}$/, "A board event's id is e and a number"),
    label: promptSafeText(60).optional(),
    at: z.enum(["round-start", "round-end"]),
    from: z.number().int().min(1).max(100).optional(),
    every: z.number().int().min(1).max(100).optional(),
    until: z.number().int().min(1).max(100).optional(),
    where: z.union([
      z.object({ cells: z.array(boardCell).min(1).max(140) }).strict(),
      z
        .object({
          block: z
            .object({
              x: z.number().int().min(0).max(13),
              y: z.number().int().min(0).max(9),
              w: z.number().int().min(1).max(14),
              h: z.number().int().min(1).max(10),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          ring: z
            .object({
              x: z.number().int().min(0).max(13),
              y: z.number().int().min(0).max(9),
              start: reach,
              step: reach,
              filled: z.literal(true).optional(),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          sweep: z
            .object({
              from: z.enum(["north", "south", "east", "west"]),
              start: reach,
              step: reach,
              filled: z.literal(true).optional(),
            })
            .strict(),
        })
        .strict(),
      z.object({ spread: z.literal("growth") }).strict(),
    ]),
    onlyOn: z.array(z.enum(TACTICAL_TERRAINS)).min(1).max(6).optional(),
    change: z
      .object({
        terrain: z.enum(TACTICAL_TERRAINS).optional(),
        height: z.number().int().min(0).max(3).optional(),
        light: z.enum(["bright", "dim", "dark", "sunlight", "clear"]).optional(),
        obscured: z.enum(["light", "heavy", "clear"]).optional(),
        growth: z.boolean().optional(),
        season: z.union([z.string().trim().min(1).max(40), z.null()]).optional(),
        rotate: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        /** Carries whoever stands there, or what obscures it, toward an edge (1.329). */
        push: boardCarry.optional(),
        drift: boardCarry.optional(),
        tell: promptSafeText(200).optional(),
      })
      .strict()
      .refine((change) => Object.keys(change).length > 0, "A board event changes something"),
  })
  .strict()
  .refine(
    (event) => !event.change.rotate || ("block" in event.where && event.where.block.w === event.where.block.h),
    "Only a square block turns",
  );
export type WorldBattlefieldEvent = z.infer<typeof worldBattlefieldEventSchema>;

export const worldBattlefieldMapSchema = z
  .object({
    /** `b<n>`, as the editor numbers them. */
    id: z.string().regex(/^b\d{1,4}$/, "A battlefield's id is b and a number"),
    name: promptSafeText(60).refine((value) => value.trim().length > 0, "A name needs more than spaces"),
    /** The place it is fought at: a compiled place or one added by hand. */
    place: z.string().min(1).max(16),
    size: z.enum(["small", "medium", "large"]),
    /** The battlefield it looks like: its colours, and the weather's reach. */
    scene: z.enum(TACTICAL_ENVIRONMENTS),
    /** The board pack it is drawn with (Capability API 1.333), by its library id; none for its
     *  scene's own (the library's pack for that environment, then the built-in one). */
    pack: z
      .string()
      .max(80)
      .regex(
        /^(?:[a-z0-9][a-z0-9_-]{0,15}\/)?[a-z0-9][a-z0-9_-]{0,63}$/,
        "A pack's id is lowercase letters, digits, _ and -",
      )
      .optional(),
    /** Its tiles, a row of characters each (p plains, f forest, m mountain, r ruin, w water, # wall). */
    rows: z
      .array(z.string().regex(/^[pfmrw#]{1,14}$/, "A battlefield row is p, f, m, r, w or # per tile"))
      .min(1)
      .max(10),
    /** How high each tile stands (combat C6b), a row of digits 0 to 3 each, the same shape as `rows`.
     *  Left out on level ground. A step of two levels or more is a cliff nobody walks. */
    heights: z
      .array(z.string().regex(/^[0-3]{1,14}$/, "A battlefield's height row is a digit from 0 to 3 per tile"))
      .min(1)
      .max(10)
      .optional(),
    /** What stands on it that may be broken (Capability API 1.316): a jar, a lantern, a door. */
    props: z.array(worldBattlefieldPropSchema).max(WORLD_BATTLEFIELD_PROPS_MAX).optional(),
    /** Growth on its tiles from the start (Capability API 1.318), a row of characters each, the same
     *  shape as `rows`: g growth, . none. */
    growth: z
      .array(z.string().regex(/^[g.]{1,14}$/, "A battlefield's growth row is g or . per tile"))
      .min(1)
      .max(10)
      .optional(),
    /** What it does on its own each round (Capability API 1.318). */
    events: z.array(worldBattlefieldEventSchema).max(16).optional(),
    /** What standing in some light does on it (Capability API 1.319): every `rounds` round ends
     *  wholly in one of these lights (bright light and sunlight when not said), its tracks move and
     *  these conditions go on, except on whoever `spares` names. Noonfield's exhaustion. */
    lightRule: z
      .object({
        label: z.string().trim().min(1).max(60).optional(),
        in: z
          .array(z.enum(["sunlight", "bright", "dim", "dark"]))
          .min(1)
          .max(4)
          .optional(),
        rounds: z.number().int().min(1).max(100).optional(),
        tracks: z
          .array(
            z
              .object({
                track: z.string().trim().min(1).max(40),
                by: z.number().int().min(-10).max(10),
                /** As far as it moves the track (Capability API 1.321): exhaustion 3 at most. */
                upTo: z.number().int().min(-1000).max(1000).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(4)
          .optional(),
        applies: z.array(z.string().trim().min(1).max(40)).min(1).max(4).optional(),
        /** A save that escapes it this time (Capability API 1.321), and what it counts as being
         *  against for a save modifier's `against`: a straw hat's advantage on Noonfield's. */
        save: z
          .object({
            save: z.string().trim().min(1).max(40),
            difficulty: z.number().int().min(0).max(1000),
            against: z
              .object({
                conditions: z.array(z.string().trim().min(1).max(40)).min(1).max(8).optional(),
                damage: z.array(z.string().trim().min(1).max(40)).min(1).max(8).optional(),
              })
              .strict()
              .optional(),
          })
          .strict()
          .optional(),
        spares: z
          .object({
            types: z.array(z.string().trim().min(1).max(40)).min(1).max(12).optional(),
            tags: z.array(z.string().trim().min(1).max(40)).min(1).max(12).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .refine((rule) => !!rule.tracks || !!rule.applies, {
        message: "A light rule moves a track or puts a condition on",
      })
      .optional(),
    /** The season each tile is in (Capability API 1.351), a row of letters each, the same shape as `rows`:
     *  a letter `seasonKeys` names, or `.` for the season of the place it is fought at. A fight starts with
     *  them, and the round's map events may change them. */
    seasons: z
      .array(z.string().regex(/^[a-z.]{1,14}$/, "A battlefield's season row is a letter or . per tile"))
      .min(1)
      .max(10)
      .optional(),
    /** What each letter of `seasons` is: `{ "a": "autumn", "w": "winter" }`. */
    seasonKeys: z.record(z.string().regex(/^[a-z]$/u), z.enum(BATTLEFIELD_SEASONS)).optional(),
  })
  .strict();
export type WorldBattlefieldMap = z.infer<typeof worldBattlefieldMapSchema>;

/** A painted board as the tactical engine reads it. */
export function worldBattlefieldGrid(map: Pick<WorldBattlefieldMap, "rows" | "heights">): TacticalGrid {
  const tiles = map.rows.map((row) => [...row].map((char) => TERRAIN_OF.get(char) ?? "plains"));
  const elevation = map.heights?.map((row) => [...row].map(Number));
  return {
    width: tiles[0]?.length ?? 0,
    height: tiles.length,
    tiles,
    // Whenever painted, so its shape is checked against the tiles' with them.
    ...(elevation ? { elevation } : {}),
  };
}

/** Why a painted board cannot be fought on, or nothing (`tacticalMadeBoardIssues`). */
export function worldBattlefieldIssues(map: WorldBattlefieldMap): string[] {
  const grid = worldBattlefieldGrid(map);
  const issues = tacticalMadeBoardIssues(map.size, grid);
  // Each prop on the board (1.316), and no two with one id.
  const ids = new Set<string>();
  if (
    map.growth &&
    (map.growth.length !== map.rows.length || map.growth.some((row, y) => row.length !== map.rows[y]!.length))
  )
    issues.push("Its growth rows are not the shape of its tiles");
  const eventIds = new Set<string>();
  for (const event of map.events ?? []) {
    if (eventIds.has(event.id)) issues.push(`Two board events are numbered ${event.id}`);
    eventIds.add(event.id);
  }
  for (const prop of map.props ?? []) {
    if (ids.has(prop.id)) issues.push(`Two props are numbered ${prop.id}`);
    ids.add(prop.id);
    if (prop.cells.some((cell) => cell.x >= grid.width || cell.y >= grid.height)) {
      issues.push(`${prop.label} stands off the board`);
    }
  }
  if (map.seasons) {
    if (map.seasons.length !== map.rows.length || map.seasons.some((row, y) => row.length !== map.rows[y]!.length)) {
      issues.push("Its seasons are not the shape of its tiles.");
    }
    const unnamed = [...new Set(map.seasons.join("").replace(/\./g, ""))].filter((key) => !map.seasonKeys?.[key]);
    if (unnamed.length) issues.push(`Its seasons use ${unnamed.join(", ")}, which seasonKeys does not name.`);
  }
  return issues;
}

/** The seasons a board's tiles are painted in (1.351), keyed "x,y" as a fight's `grid.seasons`; a tile
 *  left `.` is in `here` (the season of the place it is fought at), or not in it without one. */
export function worldBattlefieldSeasons(
  map: Pick<WorldBattlefieldMap, "seasons" | "seasonKeys">,
  here?: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  map.seasons?.forEach((row, y) =>
    [...row].forEach((key, x) => {
      const season = key === "." ? here : map.seasonKeys?.[key];
      if (season) out[`${x},${y}`] = season;
    }),
  );
  return out;
}

/** A painted board, made to be fought on: its tiles, and their seasons when it is painted with them
 *  (1.351; `here` the season of the place it is fought at). */
export function worldBattlefieldMade(map: WorldBattlefieldMap, here?: string): TacticalMadeBattlefield {
  return {
    id: map.id,
    name: map.name,
    size: map.size,
    scene: map.scene,
    ...(map.pack ? { pack: map.pack } : {}),
    grid: worldBattlefieldGrid(map),
    ...(map.props?.length ? { props: map.props.map((prop) => structuredClone(prop)) } : {}),
    ...(map.events?.length ? { events: map.events.map((event) => structuredClone(event)) } : {}),
    ...(map.growth ? worldBattlefieldGrowth(map.growth) : {}),
    ...(map.lightRule ? { lightRule: structuredClone(map.lightRule) } : {}),
    ...(map.seasons ? { seasons: worldBattlefieldSeasons(map, here) } : {}),
  };
}

/**
 * A stored layer with the boards that cannot be fought on left out, and their names: a board checked by an
 * older Engine, or written around the editor's route, never costs a world its other hand edits.
 */
export function worldEditsFightable<T extends { battlefields?: WorldBattlefieldMap[] }>(
  edits: T,
): { edits: T; dropped: string[] } {
  const unfit = (edits.battlefields ?? []).filter((map) => worldBattlefieldIssues(map).length > 0);
  if (!unfit.length) return { edits, dropped: [] };
  const kept = edits.battlefields!.filter((map) => !unfit.includes(map));
  const { battlefields: _all, ...rest } = edits;
  return { edits: (kept.length ? { ...rest, battlefields: kept } : rest) as T, dropped: unfit.map((map) => map.name) };
}

/** Painted growth rows as the cells it lies on (1.318). */
function worldBattlefieldGrowth(rows: string[]): { growth?: Array<{ x: number; y: number }> } {
  const growth = rows.flatMap((row, y) => [...row].flatMap((char, x) => (char === "g" ? [{ x, y }] : [])));
  return growth.length ? { growth } : {};
}

/** A board of the size, plains throughout: where painting one starts. */
export function worldBattlefieldBlankRows(size: WorldBattlefieldMap["size"]): string[] {
  const { width, height } = gridDimensions(0, size);
  return Array.from({ length: height }, () => "p".repeat(width));
}

/**
 * The board a fight at `placeId` is fought on: one of the place's own, else of the nearest place it is
 * inside that has any; of several, the one the seed picks. Null where none applies.
 */
export function worldBattlefieldHere(
  game: GameWorld,
  placeId: string | null | undefined,
  seed: number,
  /** The season of the place the fight is at (1.351), for a board's tiles painted `.`. */
  season?: string,
): TacticalMadeBattlefield | null {
  const maps = game.edits?.battlefields;
  if (!maps?.length) return null;
  const parents = new Map(game.world.places.map((place) => [place.id, place.parentId]));
  for (let at = placeId ?? null, hops = 0; at && hops < 64; at = parents.get(at) ?? null, hops++) {
    const here = maps.filter((map) => map.place === at);
    if (!here.length) continue;
    const map = here[(seed >>> 0) % here.length]!;
    return worldBattlefieldMade(map, season);
  }
  return null;
}
