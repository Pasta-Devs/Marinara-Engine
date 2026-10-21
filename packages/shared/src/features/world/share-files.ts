// ──────────────────────────────────────────────
// Kit and world share files (worldgen W9d): a setting kit, or a whole world (its kit, seed, brief and
// hand edits, and its story script since W10), as a file to pass on, read back into a new game's setup. Read strictly: a file in
// another format, a kit or brief that does not read, or a world from another generator is refused with
// the reason; what of the brief the kit no longer fits is left out with a note, as are hand edits that
// do not fit the world, so one stray part never costs the player the rest.
//
// A world file of version 2 (W11) also carries the world's snapshot: a world made by another generator
// is read from it, as it was made, so a file stays readable after the generator changes.
// ──────────────────────────────────────────────
import { parseWorldKit, type WorldKit } from "../../schemas/world-kit.schema.js";
import { checkWorldBrief, type WorldBrief } from "../../schemas/world-brief.schema.js";
import { worldGeneratorReads } from "./compile.js";
import type { WorldEdits } from "./edits.js";
import {
  compileGameWorld,
  gameWorldSchema,
  worldEditIssues,
  type GameWorld,
  type WORLD_GROUNDINGS,
} from "./game-world.js";
import { gameWorldFromSnapshot, readWorldSnapshot, type WorldSnapshot } from "./snapshot.js";
import { checkStoryScript, type StoryScript } from "./story.js";
import { worldEditsFightable } from "./battlefield-maps.js";
import { worldTownEditIssues } from "./town.js";

export const WORLD_KIT_FILE_FORMAT = "marinara-world-kit";
export const WORLD_FILE_FORMAT = "marinara-world";
export const WORLD_SHARE_FILE_VERSION = 1;
/** A world file's format: 2 carries the world's snapshot (W11); 1 is still read. */
export const WORLD_FILE_VERSION = 2;
/** The largest share file read: room for a large world with its snapshot (W11) and many towns laid out
 *  by hand. */
export const WORLD_SHARE_FILE_MAX_BYTES = 8_000_000;

export interface WorldKitFile {
  format: typeof WORLD_KIT_FILE_FORMAT;
  version: typeof WORLD_SHARE_FILE_VERSION;
  exportedAt: string;
  kit: WorldKit;
}

/** A world as a file: everything its compile needs, and the hand edits kept with it. */
export interface WorldFileWorld {
  seed: number;
  generatorVersion: number;
  grounding: (typeof WORLD_GROUNDINGS)[number];
  brief: WorldBrief;
  edits?: WorldEdits;
}

export interface WorldFile {
  format: typeof WORLD_FILE_FORMAT;
  version: typeof WORLD_FILE_VERSION;
  exportedAt: string;
  name: string;
  kit: WorldKit;
  world: WorldFileWorld;
  /** The world's story script (worldgen W10). Beside the world, not in it, so an Engine without stories
   *  still reads the world. */
  story?: StoryScript;
  /** The world as it was made (W11), read when another generator made it. */
  snapshot?: WorldSnapshot;
}

export const worldKitFile = (kit: WorldKit, exportedAt = new Date().toISOString()): WorldKitFile => ({
  format: WORLD_KIT_FILE_FORMAT,
  version: WORLD_SHARE_FILE_VERSION,
  exportedAt,
  kit,
});

export const worldFile = (
  name: string,
  kit: WorldKit,
  world: WorldFileWorld,
  story?: StoryScript | null,
  snapshot?: WorldSnapshot | null,
): WorldFile => ({
  format: WORLD_FILE_FORMAT,
  version: WORLD_FILE_VERSION,
  exportedAt: new Date().toISOString(),
  name: name.trim().slice(0, 120) || kit.label,
  kit,
  world,
  ...(story ? { story } : {}),
  ...(snapshot ? { snapshot } : {}),
});

/** An installed Experience's map pack (worldgen W9e) as the Engine read and checked it: its setting kit,
 *  the ready-made worlds built with it, and its tile pack. */
export interface ExperienceMapPack {
  packageId: string;
  /** The Experience's name. */
  name: string;
  kit: WorldKit;
  worlds: Array<{ path: string; name: string; world: WorldFileWorld; story?: StoryScript; snapshot?: WorldSnapshot }>;
  tiles: import("./tile-pack.js").TilePack | null;
  /** Its creature packs (Capability API 1.344), for its fights, before the library's. */
  creatures?: import("./creature-pack.js").CreaturePack[];
  /** Its music (Capability API 1.345), each track with the address it is served at. */
  music?: import("../../schemas/capability-package.schema.js").ExperienceMusic & {
    urls: Record<string, string>;
  };
  /** Its people (Capability API 1.346; companions 1.347), with the address each of its pictures is
   *  served at, by path. */
  people?: import("./experience-people.js").ExperiencePeople & { urls: Record<string, string> };
}

/**
 * The Experience track for where the party is (Capability API 1.345): the story's cue while it holds,
 * else the track of the place or of the nearest place it is inside that has one, else the pack's
 * `default`; null when none applies (the Engine's own music plays).
 */
export function experienceTrackHere(
  music: import("../../schemas/capability-package.schema.js").ExperienceMusic,
  game: GameWorld,
  placeId: string | null | undefined,
  cue: string | undefined,
): string | null {
  const tracks = new Set(music.tracks.map((track) => track.id));
  if (cue && tracks.has(cue)) return cue;
  const parents = new Map(game.world.places.map((place) => [place.id, place.parentId]));
  for (let at = placeId ?? null, hops = 0; at && hops < 64; at = parents.get(at) ?? null, hops++) {
    const own = music.places?.find((each) => each.place === at);
    if (own && tracks.has(own.track)) return own.track;
  }
  return music.default && tracks.has(music.default) ? music.default : null;
}

type Read<T> = ({ ok: true; notes: string[] } & T) | { ok: false; issues: string[] };

/** The file's JSON object of the given format, or why it is not one. */
function readShareFile(
  text: string,
  format: string,
  versions: readonly number[],
): { ok: true; value: Record<string, unknown> } | { ok: false; issues: string[] } {
  if (new TextEncoder().encode(text).length > WORLD_SHARE_FILE_MAX_BYTES) {
    return { ok: false, issues: ["The file is larger than a share file can be."] };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, issues: ["The file is not JSON."] };
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ok: false, issues: ["The file is not a share file."] };
  const file = value as Record<string, unknown>;
  if (file.format !== format) {
    return {
      ok: false,
      issues: [
        file.format === WORLD_FILE_FORMAT || file.format === WORLD_KIT_FILE_FORMAT
          ? `This is a ${file.format === WORLD_FILE_FORMAT ? "world" : "setting kit"} file, not a ${format === WORLD_FILE_FORMAT ? "world" : "setting kit"} file.`
          : "The file is not a setting kit or world file.",
      ],
    };
  }
  if (!versions.includes(file.version as number)) {
    return { ok: false, issues: ["The file was made by a newer version of Marinara Engine."] };
  }
  return { ok: true, value: file };
}

/** A setting kit file, read. */
export function readWorldKitFile(text: string): Read<{ kit: WorldKit }> {
  const file = readShareFile(text, WORLD_KIT_FILE_FORMAT, [WORLD_SHARE_FILE_VERSION]);
  if (!file.ok) return file;
  const kit = parseWorldKit(file.value.kit);
  if (!kit.ok) return { ok: false, issues: kit.issues.slice(0, 5) };
  return { ok: true, kit: kit.kit, notes: [] };
}

/** A world file, read: its kit, its world as this Engine would make it, and its story when it fits. */
export function readWorldFile(
  text: string,
): Read<{ name: string; kit: WorldKit; world: WorldFileWorld; story?: StoryScript; snapshot?: WorldSnapshot }> {
  const file = readShareFile(text, WORLD_FILE_FORMAT, [1, WORLD_FILE_VERSION]);
  if (!file.ok) return file;
  const name =
    typeof file.value.name === "string" && file.value.name.trim() ? file.value.name.trim().slice(0, 120) : undefined;
  // Another generator's world is read from its snapshot (W11), as it was made, when the file's recipe and
  // snapshot name the same generator; one that says otherwise does not hold together.
  const recipe = file.value.world as { generatorVersion?: unknown } | undefined;
  const madeBy = (file.value.snapshot as { generatorVersion?: unknown } | null | undefined)?.generatorVersion;
  if (!worldGeneratorReads(recipe?.generatorVersion) && file.value.snapshot != null) {
    if (madeBy !== recipe?.generatorVersion) {
      return { ok: false, issues: ["The world file's snapshot and recipe name different generators."] };
    }
    return readSnapshotWorld(file.value.snapshot, name, file.value.story);
  }
  const kit = parseWorldKit(file.value.kit);
  if (!kit.ok) return { ok: false, issues: kit.issues.slice(0, 5) };
  const stored = gameWorldSchema.safeParse(file.value.world);
  if (!stored.success) {
    return {
      ok: false,
      issues: stored.error.issues.slice(0, 5).map((issue) => `world.${issue.path.join(".")}: ${issue.message}`),
    };
  }
  if (!worldGeneratorReads(stored.data.generatorVersion)) {
    return { ok: false, issues: ["This world was made by another version of the generator."] };
  }
  const brief = checkWorldBrief(kit.kit, stored.data.brief);
  if (!brief.ok) return { ok: false, issues: brief.issues.slice(0, 5) };
  const notes = [...brief.repairs];
  // Made again as the generator version that made it: a version 1 world has no sites.
  const inputs = {
    kit: kit.kit,
    seed: stored.data.seed,
    grounding: stored.data.grounding,
    brief: brief.brief,
    generatorVersion: stored.data.generatorVersion,
  };
  let edits = stored.data.edits;
  if (edits) {
    // A board that cannot be fought on is left out on its own, never with the rest of the layer.
    const fightable = worldEditsFightable(edits);
    if (fightable.dropped.length) {
      notes.push(`Battlefields that cannot be fought on were left out: ${fightable.dropped.join(", ")}.`);
    }
    edits = fightable.edits;
    const unfit = worldEditIssues(inputs, edits);
    // A town laid out by hand that does not fit its town is left out on its own, too (W9h).
    if (!unfit.length && edits.towns?.length) {
      const whole = edits;
      const game = { ...inputs, edits: whole, world: compileGameWorld({ ...inputs, edits: whole }) };
      const kept = whole.towns!.filter((town) => {
        const issues = worldTownEditIssues(game, { ...whole, towns: [town] });
        if (issues.length) notes.unshift(`A town laid out by hand does not fit it, so it was left out: ${issues[0]}`);
        return !issues.length;
      });
      const { towns: _towns, ...rest } = whole;
      edits = kept.length ? { ...rest, towns: kept } : rest;
    }
    if (unfit.length) {
      // First, so it is never cut off behind the brief's own notes.
      notes.unshift(`The world's hand edits do not fit it, so they were left out: ${unfit[0]}`);
      edits = undefined;
    }
  }
  // The story names the world's places and people, so it is checked against this world as read.
  let story: StoryScript | undefined;
  if (file.value.story != null) {
    const full = edits ? { ...inputs, edits } : inputs;
    const checked = checkStoryScript({ ...full, world: compileGameWorld(full) }, file.value.story);
    if (checked.ok) story = checked.story;
    else notes.unshift(`The world's story does not fit it, so it was left out: ${checked.issues[0]}`);
  }
  return {
    ok: true,
    name: name ?? kit.kit.label,
    kit: kit.kit,
    world: {
      seed: inputs.seed,
      generatorVersion: inputs.generatorVersion,
      grounding: inputs.grounding,
      brief: brief.brief,
      ...(edits ? { edits } : {}),
    },
    ...(story ? { story } : {}),
    notes,
  };
}

/** A world file's world as its snapshot keeps it (W11): its kit, recipe and edits the snapshot's, and its
 *  story when it fits that world. */
function readSnapshotWorld(
  value: unknown,
  name: string | undefined,
  storyValue: unknown,
): Read<{ name: string; kit: WorldKit; world: WorldFileWorld; story?: StoryScript; snapshot?: WorldSnapshot }> {
  const read = readWorldSnapshot(value);
  if (!read.ok) return { ok: false, issues: read.issues.slice(0, 5) };
  const snapshot = read.snapshot;
  const notes: string[] = [];
  let story: StoryScript | undefined;
  if (storyValue != null) {
    const checked = checkStoryScript(gameWorldFromSnapshot(snapshot), storyValue);
    if (checked.ok) story = checked.story;
    else notes.push(`The world's story does not fit it, so it was left out: ${checked.issues[0]}`);
  }
  return {
    ok: true,
    name: name ?? snapshot.kit.label,
    kit: snapshot.kit,
    world: {
      seed: snapshot.seed,
      generatorVersion: snapshot.generatorVersion,
      grounding: snapshot.grounding,
      brief: snapshot.brief,
      ...(snapshot.edits ? { edits: snapshot.edits } : {}),
    },
    ...(story ? { story } : {}),
    snapshot,
    notes,
  };
}
