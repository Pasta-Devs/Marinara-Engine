// Hand-made battlefields (worldgen W9g): the board painted for where a fight starts.
import {
  gameStoryFromMetadata,
  lastGamePlace,
  readStoryLedger,
  storySeasonAt,
  storyState,
  worldAddedPlace,
  worldBattlefieldHere,
  worldBattlefieldMade,
  worldSeason,
  worldPlaceByName,
  worldPlaceInForce,
  worldPresent,
  worldTown,
  worldTownVisitFromMetadata,
  worldWalkFromMetadata,
  type GameWorld,
} from "@marinara-engine/shared";
import { createInitialTime, type GameTime } from "./time.service.js";
import { loadGameWorld } from "./game-world.service.js";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { resolveOwnerSpatialProjection } from "../spatial-context/projection.js";
import { gameRepliesBefore } from "./game-market.service.js";
import { latestStoryFight } from "./story-fight.service.js";

/**
 * The board painted by hand for where a fight starts: at the place the party is in as a turn reads it, one
 * of its boards or of the nearest place it is inside, the fight's seed picking among several. Where the
 * party is, as the Game Master's own prompt has it: a visit in town to a named place, else a walk, that
 * the next turn will tell has already taken the party there; else the map's location when it is a world
 * place, the place last said, or where the world starts the party. A place the story added is inside the
 * world's place it was added to. Null for a game without a world or where none applies: the fight's board
 * is generated.
 */
export async function gameBattlefieldHere(db: DB, chatId: string, meta: Record<string, unknown>, seed: number) {
  // A board is never worth a fight that does not start: a lookup that fails generates one.
  try {
    return await battlefieldHere(db, chatId, meta, seed);
  } catch (err) {
    logger.warn(err, "Hand-made battlefield lookup failed for chat %s; generating the board", chatId);
    return null;
  }
}

async function battlefieldHere(db: DB, chatId: string, meta: Record<string, unknown>, seed: number) {
  const world = await loadGameWorld(db, chatId, meta);
  if (!world?.edits?.battlefields?.length) return null;
  const replies = await gameRepliesBefore(db, chatId);
  // A fight the story set on a board of its own (Capability API 1.343) is fought there, wherever it starts.
  const fight = await latestStoryFight(db, chatId, meta);
  const board = fight?.battlefield ? world.edits.battlefields.find((map) => map.id === fight.battlefield) : undefined;
  if (board) {
    const at = board.seasons ? await partyPlace(world, chatId, meta, replies) : null;
    return worldBattlefieldMade(board, board.seasons ? seasonAt(world, meta, replies.all, at) : undefined);
  }
  const placeId = await partyPlace(world, chatId, meta, replies);
  return worldBattlefieldHere(world, placeId, seed, seasonAt(world, meta, replies.all, placeId));
}

/** The season at a place (1.351): the one the story holds it at, else the game day's. */
function seasonAt(world: GameWorld, meta: Record<string, unknown>, replies: readonly string[], placeId: string | null) {
  const day = ((meta.gameTime as GameTime | undefined) ?? createInitialTime()).day;
  const story = gameStoryFromMetadata(meta, world);
  if (!story) return worldSeason(day);
  return storySeasonAt(story, storyState(story, readStoryLedger(replies)).seasons, world, placeId, day).season;
}

/** Where the party is, as a fight starting now reads it. */
async function partyPlace(
  world: GameWorld,
  chatId: string,
  meta: Record<string, unknown>,
  replies: Awaited<ReturnType<typeof gameRepliesBefore>>,
): Promise<string | null> {
  const present = () => worldPresent(world, replies.ledger);
  const walk = worldWalkFromMetadata(meta);
  const visit = worldTownVisitFromMetadata(meta);
  const visited =
    visit && (!walk || visit.settlementId === walk.to)
      ? worldTown(world, visit.settlementId, present())?.buildings.find((building) => building.id === visit.to)?.placeId
      : undefined;
  const walkedTo = walk && world.world.places.some((place) => place.id === walk.to) ? walk.to : undefined;
  if (visited ?? walkedTo) return (visited ?? walkedTo)!;
  const place = worldPlaceInForce(
    world,
    lastGamePlace(replies.scoped),
    (await resolveOwnerSpatialProjection(chatId, {}, meta))?.currentLocationId,
  );
  return place?.name
    ? (worldPlaceByName(world.world, place.name)?.id ??
        worldAddedPlace(world, present(), place.name)?.within.id ??
        null)
    : world.world.startId;
}
