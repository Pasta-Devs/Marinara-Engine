// ──────────────────────────────────────────────
// A setting's battlefields (worldgen W6d): the kinds of place its fights happen in, in its own words,
// each laid out on a tactical board like one of the engine's sixteen (so the generated terrain and the
// weather still know what a "rooftop" or a "teahouse" is), and its words for the six kinds of tile. The
// model picks a scene by the setting's word; the engine reads the battlefield it is like.
// ──────────────────────────────────────────────
import { gameWorldKitFromMetadata, type WorldKit } from "../../schemas/world-kit.schema.js";
import {
  TACTICAL_ENVIRONMENTS,
  TACTICAL_TERRAINS,
  type TacticalEnvironment,
  type TacticalTerrain,
} from "../tactical-combat/environments.js";

export interface WorldBattlefields {
  scenes: Array<{ label: string; like: TacticalEnvironment }>;
  tiles: Record<TacticalTerrain, string>;
}

/** The engine's own tile words. */
const TILE_WORDS: Record<TacticalTerrain, string> = {
  plains: "Plains",
  forest: "Forest",
  mountain: "Mountain",
  ruin: "Ruins",
  water: "Water",
  wall: "Wall",
};

/** The engine's own sixteen, each as itself (its id), and the engine's tile words. */
export const WORLD_DEFAULT_BATTLEFIELDS: WorldBattlefields = Object.freeze({
  scenes: Object.freeze(
    // Each named by its own id, so a game without a kit is asked exactly what it always was.
    TACTICAL_ENVIRONMENTS.map((like) => Object.freeze({ label: like, like })),
  ) as WorldBattlefields["scenes"],
  tiles: Object.freeze({ ...TILE_WORDS }),
}) as WorldBattlefields;

/** A game's battlefields: its kit's scenes and tile words (each falling back to the engine's), or the engine's. */
export function worldBattlefields(kit: WorldKit | null | undefined): WorldBattlefields {
  if (!kit?.scenes && !kit?.tiles) return WORLD_DEFAULT_BATTLEFIELDS;
  return {
    scenes: kit.scenes ?? WORLD_DEFAULT_BATTLEFIELDS.scenes,
    tiles: Object.fromEntries(
      TACTICAL_TERRAINS.map((terrain) => [terrain, kit.tiles?.[terrain]?.trim() || TILE_WORDS[terrain]]),
    ) as Record<TacticalTerrain, string>,
  };
}

/** A game's own battlefields from its stored kit, or undefined when the kit names none. */
export function gameWorldBattlefields(
  metadata: Record<string, unknown> | null | undefined,
): WorldBattlefields | undefined {
  const kit = gameWorldKitFromMetadata(metadata);
  return kit?.scenes || kit?.tiles ? worldBattlefields(kit) : undefined;
}

/** The battlefield a scene word is laid out like: a setting scene by its label (any case), or one of the
 *  engine's sixteen by name. Undefined for a word that is neither. */
export function worldSceneLike(
  fields: WorldBattlefields,
  word: string | null | undefined,
): TacticalEnvironment | undefined {
  const key = word?.trim().toLowerCase();
  if (!key) return undefined;
  const scene = fields.scenes.find((each) => each.label.trim().toLowerCase() === key);
  if (scene) return scene.like;
  return TACTICAL_ENVIRONMENTS.find((each) => each === key);
}

/** The engine's battlefields a place's own words say it is, first match first: a cistern or a crypt is a
 *  dungeon, an arena or a keep a castle, a hall or a tavern a mansion. Never the open ground. */
const PLACE_WORDS: ReadonlyArray<readonly [TacticalEnvironment, RegExp]> = [
  ["cave", /\b(caves?|caverns?|grottos?|grottoes|mineshafts?|mines)\b/u],
  [
    "dungeon",
    /\b(underground|subterranean|cisterns?|sewers?|tunnels?|crypts?|catacombs?|tombs?|vaults?|cellars?|basements?|dungeons?|undercroft|oubliette|labyrinth|ossuary|mausoleum|prison|jail|bunker)\b/u,
  ],
  [
    "castle",
    /\b(arenas?|colosseum|coliseum|amphitheat(?:re|er)|fighting pits?|gladiator\w*|castles?|fortress(?:es)?|forts?|citadels?|battlements?|ramparts?|throne rooms?)\b/u,
  ],
  [
    "mansion",
    /\b(mansions?|manors?|halls?|taverns?|inns?|librar(?:y|ies)|temples?|chapels?|churche?s?|cathedrals?|shrines?|palaces?|ballrooms?|warehouses?|workshops?|forges?|foundry|foundries|chambers?|indoors?)\b/u,
  ],
  ["ruins", /\b(ruins?|ruined)\b/u],
  ["city", /\b(streets?|alleys?|alleyways?|markets?|plaza|town square|docks?|harbou?rs?|rooftops?)\b/u],
];

/** The scenes a place under a roof or underground is laid out as. */
const ENCLOSED: ReadonlySet<TacticalEnvironment> = new Set(["cave", "dungeon", "castle", "mansion"]);

/** Words that say a place is open ground after all. */
const OPEN_GROUND =
  /\b(plains?|fields?|meadows?|grasslands?|prairies?|steppes?|outside|outdoors?|open air|open-air)\b/u;

/** The battlefield a place's own words name, or undefined when they name none. */
function placeWordsLike(text: string | null | undefined): TacticalEnvironment | undefined {
  const lower = text?.toLowerCase() ?? "";
  return lower ? PLACE_WORDS.find(([, words]) => words.test(lower))?.[0] : undefined;
}

/**
 * The scene a fight is laid out as, from the Game Master's scene word and the place it described (cheap-GM
 * playtest 2026-10-26: an iron arena and an underground cistern were fought on Plains boards). A
 * setting's own scene is kept as the setting says it; an engine scene is kept too, except the open
 * plains where the place is plainly a cistern, an arena or a hall. A word that is no scene at all is read
 * for the place it names, then the description. Undefined where neither says anything.
 */
export function worldSceneForPlace(
  fields: WorldBattlefields,
  word: string | null | undefined,
  description: string | null | undefined,
): string | undefined {
  const key = word?.trim() ?? "";
  const like = worldSceneLike(fields, key);
  const named = placeWordsLike(key) ?? placeWordsLike(description);
  if (like === undefined) return named ?? (key || undefined);
  const setting = fields.scenes.find((scene) => scene.label.trim().toLowerCase() === key.toLowerCase());
  if (setting && setting.label !== setting.like) return key;
  if (like !== "plains" || !named || !ENCLOSED.has(named)) return key;
  // Plains said of a place that is open ground too ("the field below the castle") stay plains.
  return OPEN_GROUND.test(`${description ?? ""}`.toLowerCase()) ? key : named;
}
