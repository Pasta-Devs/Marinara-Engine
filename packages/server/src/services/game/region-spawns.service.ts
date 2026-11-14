// ──────────────────────────────────────────────
// Game: region spawns (Overworld, 2026-11-13)
//
// A Classic (MRPG) game with a world map meets the land's own foes: each stretch of the map has a fixed
// level band and a spawn table (shared world/spawns.ts). A walk on the overworld may meet them on the way,
// rolled by the server and seeded by the walk, and the Game Master tells the meeting; a fight the Game
// Master starts anywhere else draws from the table where the party is, at that land's levels, never the
// party's. Nothing here applies to a game with a ruleset, a Legacy game or a game without a world.
// ──────────────────────────────────────────────
import {
  gameDungeonMapFromMetadata,
  lastGamePlace,
  marinaraBestiaryMenu,
  marinaraBestiarySetting,
  marinaraEnemyFamily,
  marinaraEnemyName,
  marinaraRandom,
  normalizeGameDifficulty,
  readMarinaraCardProgression,
  worldPlaceByName,
  worldRegionDangerText,
  worldRegionEncounterText,
  worldRegionFoeLines,
  worldRegionSpawnTable,
  worldWalkEncounter,
  worldWalkSchema,
  type GameWorld,
  type MarinaraBestiarySetting,
  type WorldCell,
  type WorldRegionEncounter,
  type WorldSpawnTable,
  type WorldWalk,
} from "@marinara-engine/shared";

/** What a game's region spawns need: its world, bestiary setting, difficulty and party. */
export interface RegionSpawnGame {
  game: GameWorld;
  setting: MarinaraBestiarySetting;
  difficulty: string;
  partyLevels: number[];
}

const parseMeta = (value: unknown): Record<string, any> | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, any>;
    } catch {
      return null;
    }
  }
  return value as Record<string, any>;
};

/** A game that meets the land's own foes: Classic (MRPG) classes, no ruleset, a world and a known setting. */
export function regionSpawnGame(
  game: GameWorld | null | undefined,
  chatMeta: Record<string, any> | null | undefined,
): RegionSpawnGame | null {
  const setup = chatMeta?.gameSetupConfig as Record<string, unknown> | undefined;
  if (!game || setup?.marinaraClasses !== true || chatMeta?.gameRuleset) return null;
  // On a dungeon map the site's own foes hold (the dungeon spawns): the region's never apply there.
  if (gameDungeonMapFromMetadata(chatMeta) !== null) return null;
  const setting = marinaraBestiarySetting(
    typeof chatMeta?.gameWorldKit?.id === "string" ? chatMeta.gameWorldKit.id : null,
    typeof setup?.genre === "string" ? setup.genre : null,
  );
  if (!setting) return null;
  const partyLevels = (Array.isArray(chatMeta?.gameCharacterCards) ? chatMeta.gameCharacterCards : []).flatMap(
    (card: Record<string, unknown>) => {
      const progression = readMarinaraCardProgression(card.marinara);
      return progression && !progression.fallen ? [progression.level] : [];
    },
  );
  return { game, setting, difficulty: normalizeGameDifficulty(setup?.difficulty), partyLevels };
}

const partyLevelOf = (levels: readonly number[]) =>
  levels.length ? levels.reduce((sum, one) => sum + one, 0) / levels.length : 1;

/** The fight a walk meets on the way, or null on a quiet road. Seeded by the walk: told again, it is the same. */
export function regionWalkEncounter(spawns: RegionSpawnGame, walk: WorldWalk): WorldRegionEncounter | null {
  return worldWalkEncounter({
    game: spawns.game,
    walk,
    setting: spawns.setting,
    difficulty: spawns.difficulty,
    partySize: Math.max(1, spawns.partyLevels.length || 1),
  });
}

/** The walk line's addition: the meeting on the way, for the Game Master to tell. */
export function regionWalkEncounterText(spawns: RegionSpawnGame, walk: WorldWalk): string {
  const met = regionWalkEncounter(spawns, walk);
  return met ? worldRegionEncounterText(spawns.game, spawns.setting, met) : "";
}

/** Where on the map the party is, by the last place the replies named (or where the world starts it). */
export function regionPartyCell(spawns: RegionSpawnGame, replies: readonly string[]): WorldCell {
  const { world } = spawns.game;
  const named = lastGamePlace(replies)?.name;
  const place = worldPlaceByName(world, named) ?? world.places.find((each) => each.id === world.startId);
  return place?.at ?? { x: Math.floor(world.width / 2), y: Math.floor(world.height / 2) };
}

/** The walk a Game Master reply told, from the message's kept extra. */
function toldWalk(extra: unknown): WorldWalk | null {
  const parsed = worldWalkSchema.safeParse(parseMeta(extra)?.worldWalk);
  return parsed.success ? parsed.data : null;
}

/** What a fight's setup draws its foes from: the walk's own meeting when one of the last two Game Master
 *  replies told a walk that met foes not yet fought, else the table where the party is. */
export interface RegionFightPlan {
  table: WorldSpawnTable;
  /** The foes a walk met, when this fight is that meeting. */
  met: WorldRegionEncounter | null;
  /** The walk whose meeting this is, kept so it is fought once. */
  walkId: string | null;
}

export function regionFightPlan(
  spawns: RegionSpawnGame,
  messages: ReadonlyArray<{ role: string; content: string; extra?: unknown }>,
  foughtWalkId: unknown,
): RegionFightPlan {
  const replies = messages.filter((message) => message.role === "assistant");
  for (const reply of replies.slice(-2).reverse()) {
    const walk = toldWalk(reply.extra);
    if (!walk || walk.id === foughtWalkId) continue;
    const met = regionWalkEncounter(spawns, walk);
    if (met) {
      return {
        table: worldRegionSpawnTable(spawns.game, met.at, spawns.setting, spawns.difficulty),
        met,
        walkId: walk.id,
      };
    }
  }
  const at = regionPartyCell(
    spawns,
    replies.map((reply) => reply.content),
  );
  return { table: worldRegionSpawnTable(spawns.game, at, spawns.setting, spawns.difficulty), met: null, walkId: null };
}

/** The bestiary menu the fight's setup shows: the table's families only, at the band's middle. */
export function regionFightMenu(spawns: RegionSpawnGame, plan: RegionFightPlan) {
  const middle = Math.round((plan.table.band.low + plan.table.band.high) / 2);
  const ids = new Set(plan.table.families.map((entry) => entry.familyId));
  return marinaraBestiaryMenu(spawns.setting, middle).filter((entry) => ids.has(entry.familyId));
}

/** What the fight's setup is told about the land's foes. */
export function regionFightPromptText(spawns: RegionSpawnGame, plan: RegionFightPlan): string {
  const band = plan.table.band;
  if (plan.met) {
    return [
      `This fight is the meeting on the road the story just told. Its enemies are exactly these, in this order, and no others: ${worldRegionFoeLines(spawns.setting, plan.met.foes).join(", ")}.`,
      `Give one enemy entry for each (a group of several is several entries), with its family id from the bestiary list and its tier. Their levels are the land's (${band.low} to ${band.high}); do not change them.`,
    ].join(" ");
  }
  return `Unnamed enemies here are the land's own: pick their families only from the bestiary list (what lives here, at levels ${band.low} to ${band.high}), whatever anyone asked for. A named foe of the story may stand apart.`;
}

/**
 * The setup's enemies as the land makes them. For a walk's meeting, the enemies are the rolled foes, one
 * each, keeping what the model wrote for the one in its place (its looks, its words) and naming any extra.
 * Otherwise each unnamed enemy from the table gets a level inside the band, and one from outside the table
 * fights by its tier at the land's level. Named foes and bosses of the story keep the party's measure.
 */
export function regionFightEnemies(
  spawns: RegionSpawnGame,
  plan: RegionFightPlan,
  enemies: ReadonlyArray<Record<string, any>>,
  seed: string,
): Array<Record<string, any>> {
  const band = plan.table.band;
  const random = marinaraRandom(`region-fight:${seed}`);
  const inBand = () => band.low + Math.floor(random() * (band.high - band.low + 1));
  if (plan.met && enemies.length) {
    const counts = new Map<string, number>();
    const names = plan.met.foes.map((foe) => {
      const family = marinaraEnemyFamily(foe.familyId);
      return (family && marinaraEnemyName(family, spawns.setting, foe.level)) ?? foe.familyId;
    });
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
    const seen = new Map<string, number>();
    return plan.met.foes.map((foe, index) => {
      const base = enemies[Math.min(index, enemies.length - 1)]!;
      const name = names[index]!;
      const nth = (seen.get(name) ?? 0) + 1;
      seen.set(name, nth);
      const shown = (counts.get(name) ?? 1) > 1 ? `${name} ${String.fromCharCode(64 + nth)}` : name;
      return {
        ...base,
        name: shown,
        family: foe.familyId,
        tier: foe.tier,
        boss: undefined,
        aiHints: { ...(base.aiHints ?? {}), named: false, leader: undefined },
        regionFoe: { familyId: foe.familyId, tier: foe.tier, level: foe.level },
      };
    });
  }
  const table = new Set(plan.table.families.map((entry) => entry.familyId));
  return enemies.map((enemy) => {
    if (enemy.boss || enemy.aiHints?.named === true) return enemy;
    const family = typeof enemy.family === "string" ? enemy.family.trim() : "";
    if (family && table.has(family)) return { ...enemy, regionFoe: { familyId: family, level: inBand() } };
    // Not something that lives here: it fights as what it is, at the land's level.
    const { family: _dropped, ...rest } = enemy;
    return { ...rest, regionFoe: { level: inBand() } };
  });
}

/** One line for the per-turn context: how dangerous the land round the party is for it. */
export function regionDangerLine(spawns: RegionSpawnGame, at: WorldCell): string {
  return worldRegionDangerText(spawns.game, at, partyLevelOf(spawns.partyLevels), spawns.difficulty);
}
