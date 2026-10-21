// ──────────────────────────────────────────────
// Item uses that cost a story number (Capability API 1.359): an Experience's overlay names an item whose
// use adds to (spends) one of its story's number flags, refused while the flag is below what it needs.
// A use in a fight is checked here before the fight takes it, and what it spent is kept with the game
// until the next story turn records it (`StorySpend`).
// ──────────────────────────────────────────────
import { randomUUID } from "node:crypto";
import {
  currentRulesetActor,
  experienceStoryUse,
  gameStoryFromMetadata,
  readStoryLedger,
  rulesetCombatant,
  storySpendsDue,
  storyState,
  type ExperienceStoryUse,
  type RulesetDefinition,
  type RulesetEncounterState,
  type StoryLedgerEntry,
  type StoryScript,
  type StorySpend,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { gameRepliesBefore } from "./game-market.service.js";
import { loadGameWorld } from "./game-world.service.js";

/** The most spends a game keeps (the oldest are long recorded). */
const STORY_SPENDS_KEPT = 64;

/** The spends a game keeps, as its metadata holds them. */
export function gameStorySpends(meta: Record<string, unknown>): StorySpend[] {
  const list = Array.isArray(meta.gameStorySpends) ? meta.gameStorySpends : [];
  return list.flatMap((each): StorySpend[] => {
    if (!each || typeof each !== "object") return [];
    const { id, flag, add, label } = each as Record<string, unknown>;
    return typeof id === "string" && typeof flag === "string" && typeof add === "number" && Number.isFinite(add)
      ? [{ id, flag, add, ...(typeof label === "string" ? { label } : {}) }]
      : [];
  });
}

/** The item a fight's option uses, and its story cost: the one acting's sheet item at the option's place
 *  (`use:<n>`, or `use:<n>:<more>`), when the overlay merged into this ruleset gives it one. */
export function storyUseOfOption(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  optionId: string,
): { use: ExperienceStoryUse; label: string } | null {
  const place = /^use:(\d+)(?::\d+)?$/u.exec(optionId);
  if (!place) return null;
  const held = encounter.window;
  const acting = held ? rulesetCombatant(encounter, held.waiting[0] ?? "") : currentRulesetActor(encounter);
  const item = acting?.sheet?.items?.[Number(place[1])];
  const ref = item?.stack?.ref;
  const use = ref ? experienceStoryUse(definition, ref) : undefined;
  return use ? { use, label: item?.name ?? ref! } : null;
}

/**
 * Whether the game's story can pay for this use now, its spends not yet recorded counted: why not, or
 * the spend to keep once the fight has taken it. A game without the story, or whose story has no such
 * number, cannot pay.
 */
export async function checkStoryItemUse(
  db: DB,
  chatId: string,
  meta: Record<string, unknown>,
  found: { use: ExperienceStoryUse; label: string },
): Promise<{ refusal: string } | { spend: StorySpend }> {
  const world = await loadGameWorld(db, chatId, meta);
  const story = gameStoryFromMetadata(meta, world);
  const replies = story ? await gameRepliesBefore(db, chatId) : null;
  return storyItemUseVerdict(story, readStoryLedger(replies?.all ?? []), gameStorySpends(meta), found);
}

/** The verdict on a use, from the story as its replies left it and the spends not yet recorded. */
export function storyItemUseVerdict(
  story: StoryScript | null,
  ledger: readonly StoryLedgerEntry[],
  spends: readonly StorySpend[],
  found: { use: ExperienceStoryUse; label: string },
): { refusal: string } | { spend: StorySpend } {
  const flag = story?.flags.find((each) => each.id === found.use.flag && each.kind === "number");
  if (!story || !flag) return { refusal: `${found.label} needs a story this game does not have.` };
  const flags = { ...storyState(story, ledger).flags };
  storySpendsDue(story, ledger, spends, flags);
  const now = Number(flags[flag.id] ?? 0);
  const name = flag.clock?.title ?? flag.quest?.title ?? flag.id;
  if (found.use.atLeast !== undefined && now < found.use.atLeast) {
    return { refusal: `${found.label} needs ${found.use.atLeast} ${name}; the party has ${now}.` };
  }
  return { spend: { id: randomUUID(), flag: flag.id, add: found.use.add, label: found.label } };
}

/** Keeps a spend with the game, for its next story turn to record. */
export async function keepStorySpend(db: DB, chatId: string, spend: StorySpend): Promise<void> {
  await createChatsStorage(db).patchMetadata(chatId, (current) => ({
    gameStorySpends: [...gameStorySpends(current), spend].slice(-STORY_SPENDS_KEPT),
  }));
}
