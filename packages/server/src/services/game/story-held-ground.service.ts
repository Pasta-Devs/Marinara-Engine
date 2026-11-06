// ──────────────────────────────────────────────
// Held Ground let go (Capability API 1.369): the story's held ground stops holding (the Held Autumn's year
// turns) and what it held comes due. In a ruleset fight still running on it, the fight director lets it go
// there and then (1.330), in the very step that let it go: the hymn's last verse sung, the Year-Wheel
// broken. Out of a fight, each of the party rolls the dying saves their marks of Owing cost, off their own
// sheet, by the ruleset's own dying rule, as the fight would have. A turn that lets go of ground a fight
// already let go of rolls nothing twice.
// ──────────────────────────────────────────────
import {
  gameStoryFromMetadata,
  normalizeCharacterLookupName,
  readRulesetLive,
  readStoryLedger,
  storyHeldGroundReleaseInFight,
  storyPartyOf,
  type StoryHeldGroundRelease,
  type StoryTurn,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createGameEngineStateStorage } from "../storage/game-engine-state.storage.js";
import type { CombatDirectorState } from "./combat-director.service.js";
import { rollDieSecurely, type DieRoller } from "./dice-rng.js";
import { gameNoncombatants, gamePartySize, storyPartyNames } from "./experience-companions.service.js";
import { gameRepliesBefore } from "./game-market.service.js";
import { loadGameWorld } from "./game-world.service.js";
import type { SkillCheckModifierContext } from "./skill-check-resolution.service.js";
import { storyPartyMembers } from "./story-exposure-saves.service.js";
import { gameStorySpends } from "./story-item-uses.service.js";

/** The fight director's saves, as combat-director.routes keeps them. */
const COMBAT_DIRECTOR_SCOPE = "experience:marinara-engine.combat";

/** What the game keeps of a release a fight made: which ground, and how many replies the game had then,
 *  so the story turn that records it (and that turn regenerated) knows it is done. */
interface HeldGroundReleasedRecord {
  id: string;
  replies: number;
}

function releasedRecord(meta: Record<string, unknown>): HeldGroundReleasedRecord | null {
  const kept = meta.gameHeldGroundReleased as Partial<HeldGroundReleasedRecord> | null | undefined;
  return kept && typeof kept.id === "string" && typeof kept.replies === "number"
    ? { id: kept.id, replies: kept.replies }
    : null;
}

/** A release the story left with the game for an unfinished fight, and which fight (its id) it was left for. */
export type PendingHeldGroundRelease = StoryHeldGroundRelease & { fight?: string };

export function pendingRelease(meta: Record<string, unknown>): PendingHeldGroundRelease | null {
  const kept = meta.gameHeldGroundPending as Partial<PendingHeldGroundRelease> | null | undefined;
  if (!kept || typeof kept.id !== "string") return null;
  return {
    ...(typeof kept.fight === "string" ? { fight: kept.fight } : {}),
    id: kept.id,
    ...(typeof kept.label === "string" ? { label: kept.label } : {}),
    felled: kept.felled === "down" ? "down" : "die",
    ...(kept.owing && typeof kept.owing === "object"
      ? {
          owing: {
            ...(typeof kept.owing.track === "string" ? { track: kept.owing.track } : {}),
            ...(typeof kept.owing.bonus === "number" ? { bonus: kept.owing.bonus } : {}),
          },
        }
      : {}),
  };
}

/**
 * Whether a ruleset fight on Held Ground lets it go after the step it just took (1.369): a release the
 * story left waiting for it, or what the fight did (the story's numbers its items spent, the props it
 * broke) letting the held ground's conditions go. Null when it still holds, the fight is not on Held
 * Ground, or the game has no story.
 */
export async function heldGroundReleaseDueInFight(
  db: DB,
  chatId: string,
  state: CombatDirectorState,
): Promise<StoryHeldGroundRelease | null> {
  const encounter = state.style === "ruleset" ? state.rulesetFight?.encounter : undefined;
  if (!encounter?.heldGround || state.outcome) return null;
  try {
    const chat = await createChatsStorage(db).getById(chatId);
    const meta = JSON.parse(chat?.metadata || "{}") as Record<string, unknown>;
    // A release left for this fight is let go in it; one left for another fight is not this ground's to
    // spend, and the story turn settles it out of the fight.
    const pending = pendingRelease(meta);
    if (pending) {
      if (pending.fight !== state.id) return null;
      const { fight: _fight, ...release } = pending;
      return release;
    }
    const game = await loadGameWorld(db, chatId, meta);
    const story = gameStoryFromMetadata(meta, game);
    if (!game || !story?.heldGround.length) return null;
    const replies = await gameRepliesBefore(db, chatId);
    const party = storyPartyOf(
      game,
      story,
      storyPartyNames(meta),
      gamePartySize(meta, await gameNoncombatants(db, chatId, meta)),
    );
    return storyHeldGroundReleaseInFight(story, readStoryLedger(replies.all), {
      spends: gameStorySpends(meta),
      broken: encounter.board?.broken ?? [],
      party,
    });
  } catch (err) {
    logger.warn(err, "Held ground release check failed for chat %s", chatId);
    return null;
  }
}

/** Keeps with the game that a fight let this ground go, and drops a release left waiting for it, while
 *  `save` keeps the step that let it go: a save that throws puts both back as they were, so the story
 *  turn neither skips what came due nor rolls it twice. */
export async function keepHeldGroundReleasedWhile<T>(
  db: DB,
  chatId: string,
  id: string,
  save: () => Promise<T>,
): Promise<T> {
  const chats = createChatsStorage(db);
  const replies = await gameRepliesBefore(db, chatId);
  let before: { gameHeldGroundReleased: unknown; gameHeldGroundPending: unknown } | null = null;
  await chats.patchMetadata(chatId, (current) => {
    before = {
      gameHeldGroundReleased: current.gameHeldGroundReleased ?? null,
      gameHeldGroundPending: current.gameHeldGroundPending ?? null,
    };
    return {
      gameHeldGroundReleased: { id, replies: replies.all.length } satisfies HeldGroundReleasedRecord,
      gameHeldGroundPending: null,
    };
  });
  try {
    return await save();
  } catch (error) {
    try {
      const kept = before as { gameHeldGroundReleased: unknown; gameHeldGroundPending: unknown } | null;
      if (kept) {
        await chats.patchMetadata(chatId, {
          gameHeldGroundReleased: kept.gameHeldGroundReleased,
          gameHeldGroundPending: kept.gameHeldGroundPending,
        });
      }
    } catch (restore) {
      logger.warn(
        restore,
        "[game/story] Chat %s's record that its fight let %s go could not be taken back after the step failed",
        chatId,
        id,
      );
    }
    throw error;
  }
}

/** Whether a fight already let this turn's released ground go (and rolled what came due): the story turn
 *  that records it, whose replies before it are the ones the fight saw. */
export function heldGroundReleasedInFight(
  meta: Record<string, unknown>,
  released: StoryHeldGroundRelease,
  repliesBefore: number,
): boolean {
  const kept = releasedRecord(meta);
  return !!kept && kept.id === released.id && kept.replies >= repliesBefore;
}

/** The game's latest ruleset fight, by its id, when it is unfinished and still on Held Ground: a release
 *  then waits for its next step, which lets it go in the fight. Null when there is none; `unknown` when the
 *  fight could not be read, so nothing is settled or parked on a guess. */
export async function heldGroundFightUnfinished(db: DB, chatId: string): Promise<string | null | "unknown"> {
  try {
    const row = await createGameEngineStateStorage(db).getLatest(chatId, COMBAT_DIRECTOR_SCOPE);
    if (!row) return null;
    const state = JSON.parse(row.state) as Partial<CombatDirectorState>;
    return state.style === "ruleset" && !state.outcome && state.rulesetFight?.encounter?.heldGround
      ? (state.id ?? null)
      : null;
  } catch (err) {
    logger.warn(err, "Held ground fight lookup failed for chat %s", chatId);
    return "unknown";
  }
}

/** Leaves a release with the game for the unfinished fight (by its id) on that ground, to let go on its next step. */
export async function keepHeldGroundPending(
  db: DB,
  chatId: string,
  release: StoryHeldGroundRelease,
  fight: string,
): Promise<void> {
  await createChatsStorage(db).patchMetadata(chatId, { gameHeldGroundPending: { ...release, fight } });
}

/** Drops a release left for a fight once the story turn has settled it out of the fight. */
export async function dropHeldGroundPending(db: DB, chatId: string): Promise<void> {
  await createChatsStorage(db).patchMetadata(chatId, { gameHeldGroundPending: null });
}

// A tag's body ends at its first `]`, so brackets are taken out, as the story's own sheet tags do.
const sheetValue = (value: string) => value.replace(/"/g, "'").replace(/[[\]]/g, "");

/**
 * What comes due as held ground lets go out of a fight (1.369): each of the party with marks on the Owing
 * track rolls one of the ruleset's dying saves a mark, the bonus added, until the marks run out or the
 * count is decided, exactly as `rulesetReleaseHeldGround` (1.330) rolls them in a fight. The marks are
 * spent; three failures are death, kept on the sheet as the count full; anybody alive has the count
 * cleared, since they were never dying. What it costs joins the turn's sheet commands, what was rolled
 * its tells. A turn that lets nothing go, or whose release has no Owing, is returned as it is.
 */
export function rollStoryOwingWith(
  context: SkillCheckModifierContext | null,
  meta: Record<string, unknown>,
  turn: StoryTurn,
  rollDie: DieRoller = rollDieSecurely,
): StoryTurn {
  const released = turn.released;
  const track = released?.owing?.track;
  const ruleset = context?.ruleset;
  const dying = ruleset?.definition.combat?.dying;
  if (!released || !track) return turn;
  const label = released.label ?? "Held Ground";
  if (!ruleset) {
    return {
      ...turn,
      tells: [
        ...turn.tells,
        `${label} has let go, but the party's sheets could not be read, so its debts of ${track} could not be rolled. Settle them by the ruleset's own rules.`,
      ],
    };
  }
  if (!dying) {
    return {
      ...turn,
      tells: [
        ...turn.tells,
        `${label} has let go, but this game's ruleset has no dying saves, so its debts of ${track} could not be rolled. Settle them by the ruleset's own rules.`,
      ],
    };
  }
  const bonus = Math.trunc(released.owing?.bonus ?? 0);
  const sheet: string[] = [];
  const said: string[] = [];
  for (const who of storyPartyMembers(meta, context)) {
    const key = normalizeCharacterLookupName(who);
    const build = ruleset.builds.get(key);
    if (!build) continue;
    const live = readRulesetLive(ruleset.definition, build, ruleset.live[key]);
    const value = (id: string) => live.tracks.find((entry) => entry.id === id);
    const marks = value(track)?.value ?? 0;
    if (marks <= 0) continue;
    const successesMax = value(dying.successes)?.max ?? 0;
    const failuresMax = value(dying.failures)?.max ?? 0;
    let successes = value(dying.successes)?.value ?? 0;
    let failures = value(dying.failures)?.value ?? 0;
    const rolls: number[] = [];
    let dead = false;
    for (let mark = 0; mark < marks; mark++) {
      let kept = 0;
      for (let die = 0; die < dying.dice.count; die++) kept += rollDie(dying.dice.sides);
      rolls.push(kept);
      const single = dying.dice.count === 1;
      const top = single && kept === dying.dice.sides;
      const bottom = single && kept === 1;
      let failed = 0;
      if (bottom && dying.naturals.min === "two-failures") failed = 2;
      else if (bottom && dying.naturals.min === "one-failure") failed = 1;
      else if (!(top && dying.naturals.max !== "none") && kept + bonus < dying.succeedAt) failed = 1;
      if (failed > 0) {
        failures = Math.min(failuresMax, failures + failed);
        if (failures >= failuresMax) {
          dead = true;
          break;
        }
      } else {
        successes = Math.min(successesMax, successes + 1);
        if (successes >= successesMax) break;
      }
    }
    const name = sheetValue(who);
    sheet.push(`[sheet: who="${name}" op="track" track="${sheetValue(track)}" by="${-marks}"]`);
    const start = (id: string) => {
      const declared = ruleset.definition.sheet.live.tracks.find((entry) => entry.id === id);
      return declared?.default ?? declared?.min ?? 0;
    };
    sheet.push(
      `[sheet: who="${name}" op="track" track="${sheetValue(dying.failures)}" to="${dead ? failures : start(dying.failures)}"]`,
      `[sheet: who="${name}" op="track" track="${sheetValue(dying.successes)}" to="${dead ? successes : start(dying.successes)}"]`,
    );
    const shown = rolls.map((roll) => (bonus ? `${roll} + ${bonus}` : `${roll}`)).join(", ");
    said.push(
      `${who}'s debt comes due, ${rolls.length} save${rolls.length === 1 ? "" : "s"} (${shown}), and ${dead ? "they die" : "they live"}`,
    );
  }
  const tell = `${label} has let go: death is death again, and what was owed comes due. The Engine rolled each one's dying saves, one for each mark of ${track}${bonus ? ` with ${bonus >= 0 ? "+" : ""}${bonus}` : ""}: ${said.length ? `${said.join("; ")}.` : "nobody owed anything."} The marks are spent${said.some((line) => line.endsWith("they die")) ? ", and whoever died is dead on their sheet" : ""}.`;
  return { ...turn, sheet: [turn.sheet, ...sheet].filter(Boolean).join(" "), tells: [...turn.tells, tell] };
}
